// The highway: an N3-style dual carriageway. Traffic keeps left (South Africa),
// edge lines are yellow and lane dividers are broken white lines.
//
// Lateral offsets are measured from the centre of the median; positive values
// are to the LEFT of the direction of travel, i.e. our carriageway.
import * as THREE from 'three';

export const ROAD = {
  median: 3.0, // half-width of the grass median
  innerEdge: 3.6, // yellow line next to the median
  divider: 7.3, // broken white lane line
  outerEdge: 11.0, // yellow line next to the hard shoulder
  asphalt: 13.6, // end of the paved shoulder
  verge: 17.2, // end of the gravel verge
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
// [lateral, height] pairs ordered so the surface faces outward/up.
function sweep(path, profile, { from = 0, to = path.length, step = 2, vScale = 1 / 12, uv = null, y = 0 } = {}) {
  const n = Math.max(2, Math.ceil((to - from) / step) + 1);
  const m = profile.length;
  const pos = new Float32Array(n * m * 3);
  const uvs = new Float32Array(n * m * 2);
  const idx = [];
  const fr = {};
  // Cumulative profile length for u
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
  // Minimal merge for same-layout, indexed geometries
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

export function createRoadMeshes(path, tex, quality) {
  const group = new THREE.Group();
  group.name = 'road';
  const R = ROAD;
  const L = path.length;

  // --- Asphalt: both carriageways, u = 0 at the median edge, 1 at the verge
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: tex.asphalt, roughness: 0.92, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const asphalt = merge([
    sweep(path, [[R.median, 0], [R.asphalt, 0]], { uv: [0, 1], y: 0.02 }),
    sweep(path, [[-R.asphalt, 0], [-R.median, 0]], { uv: [1, 0], y: 0.02 }),
  ]);
  const asphaltMesh = new THREE.Mesh(asphalt, asphaltMat);
  asphaltMesh.receiveShadow = true;
  group.add(asphaltMesh);

  // --- Gravel verges, sloping slightly down into the terrain
  const gravelMat = new THREE.MeshStandardMaterial({
    color: 0x8a7a62, map: tex.gravel, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const verge = merge([
    sweep(path, [[R.asphalt, 0.02], [R.verge, -0.1]], { vScale: 1 / 4, y: 0 }),
    sweep(path, [[-R.verge, -0.1], [-R.asphalt, 0.02]], { vScale: 1 / 4, y: 0 }),
  ]);
  const vergeMesh = new THREE.Mesh(verge, gravelMat);
  vergeMesh.receiveShadow = true;
  group.add(vergeMesh);

  // --- Grass median
  const medianMat = new THREE.MeshStandardMaterial({ color: 0x6b6a3e, map: tex.grass, roughness: 1 });
  const median = sweep(path, [[-R.median, 0.0], [R.median, 0.0]], { vScale: 1 / 8, y: 0 });
  const medianUv = median.attributes.uv;
  for (let i = 0; i < medianUv.count; i++) medianUv.setX(i, medianUv.getX(i) * 0.75);
  const medianMesh = new THREE.Mesh(median, medianMat);
  medianMesh.receiveShadow = true;
  group.add(medianMesh);

  // --- Median barrier (concrete, New Jersey profile)
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 0.85 });
  const barrier = sweep(path, [[-0.32, 0], [-0.14, 0.32], [-0.1, 0.82], [0.1, 0.82], [0.14, 0.32], [0.32, 0]], { step: 4 });
  const barrierMesh = new THREE.Mesh(barrier, barrierMat);
  barrierMesh.castShadow = true;
  barrierMesh.receiveShadow = true;
  group.add(barrierMesh);

  // --- Road markings
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xf5b416, roughness: 0.6, emissive: 0x3a2800, emissiveIntensity: 0.4,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeea, roughness: 0.6, emissive: 0x202020, emissiveIntensity: 0.3,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const lineW = 0.16;
  const yellow = [];
  for (const lat of [R.innerEdge, R.outerEdge, -R.innerEdge, -R.outerEdge]) {
    const a = lat - lineW / 2, b = lat + lineW / 2;
    yellow.push(sweep(path, [[a, 0], [b, 0]], { y: 0.035 }));
  }
  group.add(new THREE.Mesh(merge(yellow), yellowMat));

  const dashes = [];
  const dash = 3, gap = 9;
  for (const lat of [R.divider, -R.divider]) {
    for (let s = 0; s < L - dash; s += dash + gap) {
      dashes.push(sweep(path, [[lat - 0.07, 0], [lat + 0.07, 0]], { from: s, to: s + dash, step: dash, y: 0.035 }));
    }
  }
  group.add(new THREE.Mesh(merge(dashes), whiteMat));

  // --- Delineator posts along both outer edges
  const postGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
  postGeo.translate(0, 0.5, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.7 });
  const spacing = 50;
  const perSide = Math.floor(L / spacing);
  const posts = new THREE.InstancedMesh(postGeo, postMat, perSide * 2);
  const reflectGeo = new THREE.BoxGeometry(0.11, 0.12, 0.11);
  reflectGeo.translate(0, 0.86, 0);
  const reflectMat = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff9a00, emissiveIntensity: 1.2 });
  const reflectors = new THREE.InstancedMesh(reflectGeo, reflectMat, perSide * 2);
  const m4 = new THREE.Matrix4();
  const fr = {};
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
  posts.castShadow = quality.tier === 'high';
  group.add(posts, reflectors);

  return group;
}
