// The highway: an N3-style dual carriageway. Traffic keeps left (South Africa),
// edge lines are yellow and lane dividers are broken white lines.
//
// Lateral offsets are measured from the centre of the median; positive values
// are to the LEFT of the direction of travel, i.e. our carriageway.
import * as THREE from 'three';
import { withAtmosphere, extendMaterial, atmosphere } from './atmosphere.js';
import { mulberry32 } from './noise.js';

export const ROAD = {
  median: 3.0, // half-width of the grass median
  innerEdge: 3.6, // yellow line next to the median
  divider: 7.3, // broken white lane line
  outerEdge: 11.0, // yellow line next to the hard shoulder
  asphalt: 13.6, // end of the paved shoulder
  verge: 17.2, // end of the gravel verge
  fence: 31, // road reserve fence
  laneSlow: 9.15, // centre of the left (slow) lane
  laneFast: 5.45, // centre of the right (overtaking) lane
};

const CONTROL = [
  [-12, -1400], [0, -1050], [18, -700], [5, -360], [0, -60],
  [8, 120], [52, 300], [130, 470], [186, 640], [178, 820],
  [116, 1000], [60, 1180], [46, 1420], [70, 1750], [40, 2100],
];

export function createRoadPath() {
  const pts = CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = 3000;
  const length = curve.getLength();

  const step = 2;
  const count = Math.ceil(length / step) + 1;
  const ds = length / (count - 1);
  const px = new Float32Array(count);
  const pz = new Float32Array(count);
  const tx = new Float32Array(count);
  const tz = new Float32Array(count);
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    t.y = 0;
    t.normalize();
    px[i] = p.x; pz[i] = p.z;
    tx[i] = t.x; tz[i] = t.z;
  }

  // Spatial hash of samples for nearest-distance queries (terrain, scattering)
  const CELL = 40;
  const grid = new Map();
  const key = (cx, cz) => cx * 100003 + cz;
  for (let i = 0; i < count; i++) {
    const k = key(Math.floor(px[i] / CELL), Math.floor(pz[i] / CELL));
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(i);
  }

  // Distance from (x, z) to the road centreline, searching up to `radius` m.
  function distance(x, z, radius = 120) {
    const r = Math.ceil(radius / CELL);
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = Infinity;
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        const arr = grid.get(key(cx + a, cz + b));
        if (!arr) continue;
        for (let n = 0; n < arr.length; n++) {
          const i = arr[n];
          const dx = px[i] - x;
          const dz = pz[i] - z;
          const d = dx * dx + dz * dz;
          if (d < best) best = d;
        }
      }
    }
    return Math.sqrt(best);
  }

  // Interpolated frame at arc length s: position, tangent and left vector
  function frameAt(s, out = {}) {
    const f = Math.min(Math.max(s / ds, 0), count - 1.0001);
    const i = Math.floor(f);
    const k = f - i;
    const x = px[i] + (px[i + 1] - px[i]) * k;
    const z = pz[i] + (pz[i + 1] - pz[i]) * k;
    let dx = tx[i] + (tx[i + 1] - tx[i]) * k;
    let dz = tz[i] + (tz[i + 1] - tz[i]) * k;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    out.x = x; out.z = z;
    out.tx = dx; out.tz = dz;
    out.lx = dz; out.lz = -dx; // left = up x tangent
    return out;
  }

  // Arc length where the road crosses z = 0: the truck's starting point.
  let start = 0;
  let bestZ = Infinity;
  for (let i = 0; i < count; i++) {
    if (Math.abs(pz[i]) < bestZ) { bestZ = Math.abs(pz[i]); start = i * ds; }
  }

  return { curve, length, count, ds, px, pz, tx, tz, distance, frameAt, start };
}

// Sweep a cross-section profile along the road. `profile` is a list of
// [lateral, height] pairs ordered so the surface faces outward/up. UVs: u =
// metres across (or `uv` per profile point), v = metres along * vScale.
function sweep(path, profile, { from = 0, to = path.length, step = 2, vScale = 1 / 12, uv = null, y = 0 } = {}) {
  const n = Math.max(2, Math.ceil((to - from) / step) + 1);
  const m = profile.length;
  const pos = new Float32Array(n * m * 3);
  const uvs = new Float32Array(n * m * 2);
  const idx = [];
  const fr = {};
  const cum = [0];
  for (let j = 1; j < m; j++) {
    cum[j] = cum[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]);
  }
  const total = cum[m - 1] || 1;
  for (let i = 0; i < n; i++) {
    const s = from + ((to - from) * i) / (n - 1);
    path.frameAt(s, fr);
    for (let j = 0; j < m; j++) {
      const [lat, h] = profile[j];
      const o = (i * m + j) * 3;
      pos[o] = fr.x + fr.lx * lat;
      pos[o + 1] = y + h;
      pos[o + 2] = fr.z + fr.lz * lat;
      const q = (i * m + j) * 2;
      uvs[q] = uv ? uv[j] : cum[j] / total;
      uvs[q + 1] = s * vScale;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = (i + 1) * m + j;
      const c = i * m + j + 1;
      const d = (i + 1) * m + j + 1;
      idx.push(a, b, c, c, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function merge(geos) {
  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const src = g.index.array;
    for (let k = 0; k < src.length; k++) idx[io + k] = src[k] + vo;
    vo += g.attributes.position.count;
    io += src.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const DETAIL = 1.6; // metres per asphalt detail tile

export function createRoadMeshes(path, tex, quality, patchGround) {
  const group = new THREE.Group();
  group.name = 'road';
  const R = ROAD;
  const L = path.length;
  const W = R.asphalt - R.median;

  // --- Asphalt: aggregate detail (tiling) x wear map (per carriageway)
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.asphalt.map,
    normalMap: tex.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: tex.asphalt.roughnessMap,
    roughness: 1,
    metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  withAtmosphere(asphaltMat);
  extendMaterial(asphaltMat, 'asphalt', (shader) => {
    shader.uniforms.uWear = { value: tex.asphaltWear };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uWear;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 wearUv = vec2(vMapUv.x * ${(DETAIL / W).toFixed(5)}, vMapUv.y * ${(DETAIL / 24).toFixed(5)});
        float wear = texture2D(uWear, wearUv).r;
        diffuseColor.rgb *= mix(0.62, 1.32, wear);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= mix(0.74, 1.04, wear);`);
  });
  if (patchGround) patchGround(asphaltMat);
  const asphalt = merge([
    sweep(path, [[R.median, 0], [R.asphalt, 0]], { uv: [0, W / DETAIL], y: 0.02, vScale: 1 / DETAIL }),
    sweep(path, [[-R.asphalt, 0], [-R.median, 0]], { uv: [W / DETAIL, 0], y: 0.02, vScale: 1 / DETAIL }),
  ]);
  const asphaltMesh = new THREE.Mesh(asphalt, asphaltMat);
  asphaltMesh.receiveShadow = true;
  group.add(asphaltMesh);

  // --- Gravel verges, sloping slightly down into the terrain
  const gravelMat = new THREE.MeshStandardMaterial({
    color: 0xb3a38a, map: tex.gravel, bumpMap: tex.gravel, bumpScale: 1.4, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  withAtmosphere(gravelMat);
  if (patchGround) patchGround(gravelMat);
  const verge = merge([
    sweep(path, [[R.asphalt, 0.02], [R.verge, -0.12]], { vScale: 1 / 2.5, uv: [0, (R.verge - R.asphalt) / 2.5] }),
    sweep(path, [[-R.verge, -0.12], [-R.asphalt, 0.02]], { vScale: 1 / 2.5, uv: [(R.verge - R.asphalt) / 2.5, 0] }),
  ]);
  const vergeMesh = new THREE.Mesh(verge, gravelMat);
  vergeMesh.receiveShadow = true;
  group.add(vergeMesh);

  // --- Grass median
  const medianMat = new THREE.MeshStandardMaterial({ color: 0x8f8a5c, map: tex.grass.map, normalMap: tex.grass.normalMap, roughness: 1 });
  withAtmosphere(medianMat);
  if (patchGround) patchGround(medianMat);
  const median = sweep(path, [[-R.median, 0.0], [R.median, 0.0]], { vScale: 1 / 4, uv: [0, (2 * R.median) / 4] });
  const medianMesh = new THREE.Mesh(median, medianMat);
  medianMesh.receiveShadow = true;
  group.add(medianMesh);

  // --- Median barrier (concrete, New Jersey profile)
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xc2beb4, map: tex.concrete, bumpMap: tex.concrete, bumpScale: 0.6, roughness: 0.9 });
  withAtmosphere(barrierMat);
  const barrier = sweep(path, [[-0.32, 0], [-0.3, 0.08], [-0.14, 0.33], [-0.1, 0.8], [-0.08, 0.83], [0.08, 0.83], [0.1, 0.8], [0.14, 0.33], [0.3, 0.08], [0.32, 0]], { step: 3, vScale: 1 / 3 });
  const barrierMesh = new THREE.Mesh(barrier, barrierMat);
  barrierMesh.castShadow = true;
  barrierMesh.receiveShadow = true;
  group.add(barrierMesh);

  // --- Road markings: worn paint, retro-reflective beads
  const markMat = (color) => {
    const m = new THREE.MeshStandardMaterial({
      color, map: tex.markingWear, roughness: 0.55, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    withAtmosphere(m);
    return m;
  };
  const yellowMat = markMat(0xe9ad22);
  const whiteMat = markMat(0xecebe6);
  const lineW = 0.15;
  const yellow = [];
  for (const lat of [R.innerEdge, R.outerEdge, -R.innerEdge, -R.outerEdge]) {
    yellow.push(sweep(path, [[lat - lineW / 2, 0], [lat + lineW / 2, 0]], { y: 0.024, vScale: 1 / 6 }));
  }
  const yellowMesh = new THREE.Mesh(merge(yellow), yellowMat);
  yellowMesh.receiveShadow = true;
  group.add(yellowMesh);

  const dashes = [];
  const dash = 3, gap = 9;
  for (const lat of [R.divider, -R.divider]) {
    for (let s = 0; s < L - dash; s += dash + gap) {
      dashes.push(sweep(path, [[lat - 0.075, 0], [lat + 0.075, 0]], { from: s, to: s + dash, step: dash, y: 0.024, vScale: 1 / 6 }));
    }
  }
  const dashMesh = new THREE.Mesh(merge(dashes), whiteMat);
  dashMesh.receiveShadow = true;
  group.add(dashMesh);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const fr = {};
  const rand = mulberry32(404);

  // --- Guide posts along both outer edges
  const postGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
  postGeo.translate(0, 0.5, 0);
  const postMat = withAtmosphere(new THREE.MeshStandardMaterial({ color: 0xe6e4de, roughness: 0.6 }));
  const spacing = 50;
  const perSide = Math.floor(L / spacing);
  const posts = new THREE.InstancedMesh(postGeo, postMat, perSide * 2);
  const reflectGeo = new THREE.BoxGeometry(0.105, 0.14, 0.105);
  reflectGeo.translate(0, 0.84, 0);
  const reflectMat = withAtmosphere(new THREE.MeshStandardMaterial({ color: 0xc0201a, emissive: 0x7a0c06, emissiveIntensity: 0.6, roughness: 0.3 }));
  const reflectors = new THREE.InstancedMesh(reflectGeo, reflectMat, perSide * 2);
  let k = 0;
  for (let i = 0; i < perSide; i++) {
    const s = i * spacing + 20;
    path.frameAt(s, fr);
    for (const lat of [R.asphalt + 0.9, -(R.asphalt + 0.9)]) {
      m4.makeRotationY(Math.atan2(fr.tx, fr.tz));
      m4.setPosition(fr.x + fr.lx * lat, 0, fr.z + fr.lz * lat);
      posts.setMatrixAt(k, m4);
      reflectors.setMatrixAt(k, m4);
      k++;
    }
  }
  posts.castShadow = true;
  posts.receiveShadow = true;
  group.add(posts, reflectors);

  // --- Road reserve fence: weathered posts every 3.5 m and four wire strands
  const fenceFrom = Math.max(0, path.start - 260);
  const fenceTo = Math.min(L, path.start + 900);
  const fencePostGeo = new THREE.CylinderGeometry(0.045, 0.055, 1.3, 6);
  fencePostGeo.translate(0, 0.62, 0);
  const fenceMat = withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x6b5c48, roughness: 0.95 }));
  const nFence = Math.floor((fenceTo - fenceFrom) / 3.5) * 2;
  const fencePosts = new THREE.InstancedMesh(fencePostGeo, fenceMat, nFence);
  const wirePts = [];
  let f = 0;
  for (const side of [1, -1]) {
    let prev = null;
    for (let s = fenceFrom; s < fenceTo && f < nFence; s += 3.5) {
      path.frameAt(s, fr);
      const lat = side * ROAD.fence;
      const x = fr.x + fr.lx * lat, z = fr.z + fr.lz * lat;
      q.setFromAxisAngle(up, rand() * 6.28);
      sc.set(1, 0.9 + rand() * 0.2, 1);
      m4.compose(pp.set(x, -0.05, z), q, sc);
      fencePosts.setMatrixAt(f++, m4);
      if (prev) for (const h of [0.35, 0.62, 0.88, 1.12]) wirePts.push(prev[0], h, prev[1], x, h - 0.02, z);
      prev = [x, z];
    }
  }
  fencePosts.count = f;
  fencePosts.castShadow = true;
  group.add(fencePosts);
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  const wires = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x4c4a46, transparent: true, opacity: 0.55 }));
  group.add(wires);

  // --- Telephone line: wooden poles with a cross-arm, sagging wires
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.13, 8.5, 8);
  poleGeo.translate(0, 4.25, 0);
  const armGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
  armGeo.translate(0, 7.9, 0);
  const poleMat = withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.92 }));
  const poleFrom = Math.max(0, path.start - 700);
  const poleTo = Math.min(L, path.start + 1500);
  const nPoles = Math.floor((poleTo - poleFrom) / 55);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, nPoles);
  const arms = new THREE.InstancedMesh(armGeo, poleMat, nPoles);
  const cablePts = [];
  let prevTop = null;
  for (let i = 0; i < nPoles; i++) {
    const s = poleFrom + i * 55;
    path.frameAt(s, fr);
    const lat = -(ROAD.fence + 6);
    const x = fr.x + fr.lx * lat, z = fr.z + fr.lz * lat;
    q.setFromAxisAngle(up, Math.atan2(fr.lx, fr.lz));
    m4.compose(pp.set(x, -0.1, z), q, sc.set(1, 1, 1));
    poles.setMatrixAt(i, m4);
    arms.setMatrixAt(i, m4);
    const top = [];
    for (const off of [-0.7, 0, 0.7]) top.push([x + fr.lx * off, 7.95, z + fr.lz * off]);
    if (prevTop) {
      for (let w = 0; w < 3; w++) {
        const a = prevTop[w], b = top[w];
        for (let t = 0; t < 10; t++) {
          const t0 = t / 10, t1 = (t + 1) / 10;
          const sag = (u) => -Math.sin(u * Math.PI) * 0.9;
          cablePts.push(
            a[0] + (b[0] - a[0]) * t0, a[1] + sag(t0), a[2] + (b[2] - a[2]) * t0,
            a[0] + (b[0] - a[0]) * t1, a[1] + sag(t1), a[2] + (b[2] - a[2]) * t1,
          );
        }
      }
    }
    prevTop = top;
  }
  poles.castShadow = arms.castShadow = true;
  group.add(poles, arms);
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3));
  group.add(new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: 0x2c2b29, transparent: true, opacity: 0.7 })));

  return group;
}

// Short dry sward along the verges, near the start of the drive where the
// camera is at road level: shell texturing (stacked alpha-tested layers of
// the same strip, each lifted a little higher and sparser).
export function createGrassShells(path, height, tex, quality) {
  const layers = quality.tier === 'high' ? 12 : 6;
  const from = path.start - 90, to = path.start + 460;
  const geos = [];
  for (const side of [1, -1]) {
    const lats = [];
    for (let l = ROAD.verge - 0.4; l <= ROAD.verge + 34; l += 2.5) lats.push(side * l);
    if (side < 0) lats.reverse();
    const g = sweep(path, lats.map((l) => [l, 0]), { from, to, step: 2.5, vScale: 1 / 0.7, uv: lats.map((l) => l / 0.7) });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)) + 0.015);
    g.computeVertexNormals();
    geos.push(g);
  }
  const geo = merge(geos);
  const mat = new THREE.MeshStandardMaterial({ map: tex.grassFur, roughness: 0.95, color: 0xc8bea2, alphaTest: 0.01 });
  mat.alphaToCoverage = true;
  withAtmosphere(mat);
  const scale = { value: 1 };
  extendMaterial(mat, 'grass-shell', (shader) => {
    shader.uniforms.uShellScale = scale;
    shader.uniforms.uSunDirW = atmosphere.uniforms.uSunDirW;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uShellScale;
        uniform vec3 uSunDirW;
        varying float vLayer;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(0.0, 1.0, 0.0) + 0.5 * normalize(vec3(uSunDirW.x, 0.0, uSunDirW.z)));')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLayer = float(gl_InstanceID) / ${(layers - 1).toFixed(1)};
        transformed.y += vLayer * 0.24 * uShellScale;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLayer;')
      .replace('#include <alphatest_fragment>', `
        float blade = diffuseColor.a;
        if (blade < vLayer * 0.92 + 0.04) discard;
        diffuseColor.a = 1.0;
        diffuseColor.rgb *= mix(0.42, 1.08, vLayer);`);
  });
  const mesh = new THREE.InstancedMesh(geo, mat, layers);
  const id = new THREE.Matrix4();
  for (let i = 0; i < layers; i++) mesh.setMatrixAt(i, id);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.setScale = (v) => {
    scale.value = v;
    mesh.visible = v > 0.001;
  };
  return mesh;
}

// Clumps of dry grass along the verges and in the median, dense near the
// start of the drive where the camera is at road level.
export function createGrass(path, height, tex, quality) {
  const high = quality.tier === 'high';
  const count = high ? 9000 : 3500;
  // One tussock: four crossed, slightly leaning cards
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0);
    g.rotateX((i % 2 ? 1 : -1) * 0.12);
    g.rotateY((i / 4) * Math.PI + 0.3);
    cards.push(g);
  }
  const geo = mergeCards(cards);
  const mat = new THREE.MeshStandardMaterial({
    map: tex.grassBlades, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95,
    color: 0xd8d0b8,
  });
  mat.alphaToCoverage = true;
  withAtmosphere(mat);
  // Blades are lit from the side by a low sun: bend the shading normal from
  // straight up toward the sun, so tufts glow gold rather than go dark
  const grassScale = { value: 1 };
  extendMaterial(mat, 'grass-normal', (shader) => {
    shader.uniforms.uSunDirW = atmosphere.uniforms.uSunDirW;
    shader.uniforms.uGrassScale = grassScale;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirW;\nuniform float uGrassScale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= uGrassScale;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(0.0, 1.0, 0.0) + 0.55 * normalize(vec3(uSunDirW.x, 0.0, uSunDirW.z)));');
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const rand = mulberry32(88);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  const fr = {};
  let n = 0;
  while (n < count) {
    // Most tufts close to the start, thinning out down the road
    const along = path.start - 60 + Math.pow(rand(), 1.7) * 620;
    path.frameAt(along, fr);
    const r = rand();
    let lat;
    if (r < 0.12) lat = (rand() - 0.5) * 2 * (ROAD.median - 0.5);
    else lat = (rand() < 0.5 ? 1 : -1) * (ROAD.verge - 0.6 + Math.pow(rand(), 1.6) * 30);
    const x = fr.x + fr.lx * lat + (rand() - 0.5) * 2;
    const z = fr.z + fr.lz * lat + (rand() - 0.5) * 2;
    const y = Math.abs(lat) < ROAD.median ? 0 : height(x, z);
    const s = 0.32 + Math.pow(rand(), 1.5) * 0.45;
    q.setFromAxisAngle(up, rand() * Math.PI);
    m4.compose(pp.set(x, y - 0.03, z), q, sc.set(s * (1.1 + rand() * 0.5), s, s * (1.1 + rand() * 0.5)));
    mesh.setMatrixAt(n, m4);
    color.setHSL(0.1 + rand() * 0.035, 0.3 + rand() * 0.18, 0.84 + rand() * 0.12);
    mesh.setColorAt(n, color);
    n++;
  }
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  // Tufts only matter at road level; from the air they would read as crosses
  mesh.userData.setScale = (v) => {
    grassScale.value = v;
    mesh.visible = v > 0.001;
  };
  return mesh;
}

function mergeCards(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  for (const g of list) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    uv.push(...g.attributes.uv.array);
    for (const i of g.index.array) idx.push(i + base);
    base += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
