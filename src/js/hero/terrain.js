// Rolling KwaZulu-Natal midlands: golden grass, acacia and bush, hills that
// rise into an escarpment on the horizon. Flattened along the highway.
import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep, clamp } from './noise.js';

const CENTER = new THREE.Vector2(150, 250);

export function createHeightField(path) {
  const n1 = createNoise2D(101);
  const n2 = createNoise2D(202);
  return function height(x, z, d = path.distance(x, z)) {
    const hills = Math.pow(Math.max(0, fbm(n1, x * 0.0021, z * 0.0021, 4) * 0.5 + 0.5), 2.0) * 50;
    const bumps = fbm(n2, x * 0.011, z * 0.011, 3) * 2.4;
    const rim = Math.hypot(x - CENTER.x, (z - CENTER.y) * 0.8);
    const escarpment = smoothstep(620, 1350, rim) * (90 + fbm(n2, x * 0.004, z * 0.004, 2) * 60);
    const k = smoothstep(20, 130, d);
    return -0.14 + (hills + bumps + escarpment) * k;
  };
}

const TERRAIN_W = 2600;
const TERRAIN_D = 3000;

// Adds world-space cloud shadows to any MeshStandardMaterial. With
// `farmland`, also tints by the field map and breaks up texture tiling.
export function addCloudShadows(material, uniforms, farmland = null) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCloud = uniforms.uCloud;
    shader.uniforms.uCloudOffset = uniforms.uCloudOffset;
    shader.uniforms.uCloudAmount = uniforms.uCloudAmount;
    let extra = '';
    let decl = '';
    if (farmland) {
      shader.uniforms.uFields = { value: farmland.texture };
      shader.uniforms.uFieldsOrigin = { value: farmland.origin };
      shader.uniforms.uFieldsSize = { value: farmland.size };
      decl = '\nuniform sampler2D uFields;\nuniform vec2 uFieldsOrigin;\nuniform vec2 uFieldsSize;';
      extra =
        '\ndiffuseColor.rgb *= texture2D(uFields, (vCloudWorld.xz - uFieldsOrigin) / uFieldsSize).rgb * 2.0;' +
        '\ndiffuseColor.rgb *= mix(0.88, 1.1, texture2D(uCloud, vCloudWorld.xz / 150.0 + 0.37).r);';
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloudWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCloudWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloudWorld;\nuniform sampler2D uCloud;\nuniform vec2 uCloudOffset;\nuniform float uCloudAmount;' + decl)
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat cloudShade = texture2D(uCloud, vCloudWorld.xz / 1900.0 + uCloudOffset).r;\ndiffuseColor.rgb *= mix(1.0, cloudShade, uCloudAmount);' + extra);
  };
  material.customProgramCacheKey = () => (farmland ? 'terrain-farmland' : 'cloud-shadow');
}

// Farmland seen from the air: blocks of rotated fields (cane, pasture,
// ploughed soil, stubble) with crop rows, dirt tracks and gum-tree windbreaks.
// Painted into a world-aligned multiply map (0.5 = no change).
export function createFarmland(path, renderer) {
  const S = 2048;
  const ox = CENTER.x - TERRAIN_W / 2;
  const oz = CENTER.y - TERRAIN_D / 2;
  const sx = S / TERRAIN_W;
  const sz = S / TERRAIN_D;
  const px = (x, z) => [(x - ox) * sx, (z - oz) * sz];
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, S, S);
  const rand = mulberry32(606);
  const hedges = [];
  const houses = [];
  const types = [
    { tint: [0.6, 1.1, 0.52], rows: 'rgba(20,40,10,0.2)', spacing: 3 }, // sugar cane
    { tint: [0.8, 1.02, 0.64], rows: null }, // pasture
    { tint: [0.8, 0.58, 0.44], rows: 'rgba(30,18,8,0.22)', spacing: 2.5 }, // ploughed
    { tint: [1.32, 1.18, 0.9], rows: 'rgba(60,50,30,0.16)', spacing: 3 }, // stubble
    { tint: [1.12, 1.0, 0.78], rows: null }, // fallow
    { tint: [0.7, 1.06, 0.58], rows: 'rgba(20,40,10,0.16)', spacing: 4 }, // young crop
  ];
  const fill = (t) => `rgb(${Math.min(255, t[0] * 128) | 0},${Math.min(255, t[1] * 128) | 0},${Math.min(255, t[2] * 128) | 0})`;
  const fr = {};

  for (let s = path.start - 900; s < path.start + 1300; s += 120 + rand() * 90) {
    for (const side of [1, -1]) {
      if (rand() < 0.12) continue;
      path.frameAt(s, fr);
      const near = rand() < 0.5;
      const lat = side * (near ? 95 + rand() * 60 : 190 + rand() * 260);
      const R = {
        x: fr.x + fr.lx * lat,
        z: fr.z + fr.lz * lat,
        a: Math.atan2(fr.tx, fr.tz) + (rand() - 0.5) * 0.7,
        cols: 2 + ((rand() * 3) | 0),
        rows: 2 + ((rand() * 2) | 0),
        cw: 50 + rand() * 50,
        ch: 60 + rand() * 70,
      };
      if (path.distance(R.x, R.z, 160) < 60) continue;
      const ca = Math.cos(R.a), sa = Math.sin(R.a);
      const toWorld = (u, w) => [R.x + sa * w + ca * u, R.z + ca * w - sa * u];
      const W0 = R.cols * R.cw, H0 = R.rows * R.ch;
      for (let i = 0; i < R.cols; i++) {
        for (let j = 0; j < R.rows; j++) {
          const t = types[(rand() * types.length) | 0];
          const inset = 2.2;
          const u0 = -W0 / 2 + i * R.cw + inset, u1 = u0 + R.cw - inset * 2;
          const w0 = -H0 / 2 + j * R.ch + inset, w1 = w0 + R.ch - inset * 2;
          const quad = [toWorld(u0, w0), toWorld(u1, w0), toWorld(u1, w1), toWorld(u0, w1)].map(([x, z]) => px(x, z));
          ctx.beginPath();
          quad.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
          ctx.closePath();
          ctx.fillStyle = fill(t.tint);
          ctx.fill();
          if (t.rows) {
            ctx.save();
            ctx.clip();
            ctx.strokeStyle = t.rows;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let w = w0; w < w1; w += t.spacing) {
              const [a1, b1] = px(...toWorld(u0, w));
              const [a2, b2] = px(...toWorld(u1, w));
              ctx.moveTo(a1, b1);
              ctx.lineTo(a2, b2);
            }
            ctx.stroke();
            ctx.restore();
          }
          // Windbreak of gum trees along one edge of some fields
          if (rand() < 0.3) {
            const along = rand() < 0.5;
            const len = along ? u1 - u0 : w1 - w0;
            for (let d = 3; d < len - 3; d += 6 + rand() * 3) {
              const [x, z] = along ? toWorld(u0 + d, w0 - 1.5) : toWorld(u0 - 1.5, w0 + d);
              if (path.distance(x, z, 60) > 32) hedges.push([x, z]);
            }
          }
        }
      }
      // Farm track around the block
      ctx.strokeStyle = fill([1.28, 1.14, 0.94]);
      ctx.lineWidth = 3.2 * sx;
      ctx.beginPath();
      [[-W0 / 2, -H0 / 2], [W0 / 2, -H0 / 2], [W0 / 2, H0 / 2], [-W0 / 2, H0 / 2]]
        .map(([u, w]) => px(...toWorld(u, w)))
        .forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.closePath();
      ctx.stroke();
      // A farmhouse on some blocks
      if (rand() < 0.45) {
        const [hx, hz] = toWorld(-W0 / 2 - 14, -H0 / 2 + 20 + rand() * 30);
        if (path.distance(hx, hz, 80) > 45) houses.push([hx, hz, R.a]);
      }
    }
  }

  // Keep the highway corridor neutral
  ctx.strokeStyle = 'rgb(128,128,128)';
  ctx.lineWidth = 90 * sx;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < path.count; i += 4) {
    const [a, b] = px(path.px[i], path.pz[i]);
    if (i === 0) ctx.moveTo(a, b);
    else ctx.lineTo(a, b);
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return {
    texture,
    hedges,
    houses,
    origin: new THREE.Vector2(ox, oz),
    size: new THREE.Vector2(TERRAIN_W, TERRAIN_D),
  };
}

export function createTerrain(path, height, tex, quality, cloudUniforms, farmland) {
  const W = TERRAIN_W, D = TERRAIN_D;
  const segX = quality.tier === 'high' ? 210 : 150;
  const segZ = Math.round(segX * (D / W));
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(CENTER.x, 0, CENTER.y);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const nC = createNoise2D(303);
  const nD = createNoise2D(404);

  const gold = new THREE.Color('#8f8250');
  const straw = new THREE.Color('#9d8d5a');
  const olive = new THREE.Color('#6b6d3e');
  const green = new THREE.Color('#4f6034');
  const earth = new THREE.Color('#6d5b41');
  const mown = new THREE.Color('#646637');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = path.distance(x, z, 140);
    const h = height(x, z, d);
    pos.setY(i, h);
    uv.setXY(i, x / 16, z / 16);

    const patch = fbm(nC, x * 0.009, z * 0.009, 3) * 0.5 + 0.5;
    const wet = fbm(nD, x * 0.004 + 7, z * 0.004 - 3, 3) * 0.5 + 0.5;
    tmp.copy(gold).lerp(straw, smoothstep(0.55, 0.85, patch));
    tmp.lerp(olive, smoothstep(0.45, 0.2, patch) * 0.8);
    tmp.lerp(green, smoothstep(0.45, 0.78, wet) * 0.85);
    tmp.lerp(earth, smoothstep(0.78, 0.95, patch) * 0.6);
    tmp.lerp(mown, 1 - smoothstep(18, 34, d));
    // Distant escarpment reads a little cooler and darker
    const far = smoothstep(700, 1300, Math.hypot(x - CENTER.x, z - CENTER.y));
    tmp.lerp(green, far * 0.35);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: tex.grass,
    roughness: 1,
    metalness: 0,
  });
  addCloudShadows(mat, cloudUniforms, farmland);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function jitter(geo, amount, seed) {
  const rand = mulberry32(seed);
  const p = geo.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let off = map.get(k);
    if (!off) map.set(k, (off = [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount]));
    p.setXYZ(i, p.getX(i) + off[0], p.getY(i) + off[1], p.getZ(i) + off[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createVegetation(path, height, quality, farmland) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const rand = mulberry32(77);
  const density = createNoise2D(505);
  const high = quality.tier === 'high';
  const nAcacia = high ? 560 : 300;
  const nBush = high ? 1500 : 760;

  // Acacia: thin trunk + wide flat canopy
  const canopyGeo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.3, 1);
  canopyGeo.scale(1, 0.46, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const bushGeo = jitter(new THREE.IcosahedronGeometry(1, 0), 0.35, 2);
  bushGeo.translate(0, 0.45, 0);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x3b3128, roughness: 1 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });

  const canopies = new THREE.InstancedMesh(canopyGeo, leafMat, nAcacia);
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, nAcacia);
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, nBush);

  const leafColors = ['#3e4a24', '#46522a', '#525c2f', '#384421'].map((c) => new THREE.Color(c));
  const bushColors = ['#5a5a31', '#4d5630', '#6a643a', '#5d6636', '#454f2a'].map((c) => new THREE.Color(c));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // Scatter area: around the section of road the camera sees
  const minX = -520, maxX = 780, minZ = -900, maxZ = 1250;
  function place(count, minRoad, test) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      const x = minX + rand() * (maxX - minX);
      const z = minZ + rand() * (maxZ - minZ);
      const d = path.distance(x, z, 140);
      if (d < minRoad) continue;
      const dn = density(x * 0.006, z * 0.006) * 0.5 + 0.5;
      if (!test(dn, d)) continue;
      out.push([x, z, d]);
    }
    return out;
  }

  const acacias = place(nAcacia, 24, (dn) => rand() < smoothstep(0.35, 0.8, dn));
  acacias.forEach(([x, z, d], i) => {
    const y = height(x, z, d);
    const trunkH = 2.2 + rand() * 1.8;
    const w = 2.6 + rand() * 2.8;
    p.set(x, y, z);
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    s.set(1, trunkH, 1);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    p.set(x, y + trunkH + 0.35, z);
    s.set(w, 1.2 + rand() * 0.8, w * (0.8 + rand() * 0.35));
    m.compose(p, q, s);
    canopies.setMatrixAt(i, m);
    canopies.setColorAt(i, leafColors[i % leafColors.length]);
  });
  canopies.count = trunks.count = acacias.length;

  const bushPts = place(nBush, 21, (dn) => rand() < 0.25 + dn * 0.6);
  bushPts.forEach(([x, z, d], i) => {
    const y = height(x, z, d);
    const r = 0.6 + rand() * 1.3;
    p.set(x, y - 0.1, z);
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    s.set(r * (0.8 + rand() * 0.5), r * (0.6 + rand() * 0.4), r * (0.8 + rand() * 0.5));
    m.compose(p, q, s);
    bushes.setMatrixAt(i, m);
    bushes.setColorAt(i, bushColors[i % bushColors.length]);
  });
  bushes.count = bushPts.length;

  // Gum-tree windbreaks along field edges: tall, narrow and dark
  const hedgeList = farmland ? farmland.hedges.slice(0, high ? 1400 : 700) : [];
  const gumGeo = jitter(new THREE.IcosahedronGeometry(1, 1), 0.25, 3);
  gumGeo.scale(1, 2.1, 1);
  gumGeo.translate(0, 1, 0);
  const gums = new THREE.InstancedMesh(gumGeo, leafMat, Math.max(1, hedgeList.length));
  const gumColors = ['#34401f', '#3b4726', '#2f3a1c', '#46502b'].map((c) => new THREE.Color(c));
  hedgeList.forEach(([x, z], i) => {
    const y = height(x, z);
    const r = 2.2 + rand() * 1.6;
    p.set(x, y + 1.5, z);
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    s.set(r, r * (1.8 + rand() * 1.2), r);
    m.compose(p, q, s);
    gums.setMatrixAt(i, m);
    gums.setColorAt(i, gumColors[i % gumColors.length]);
  });
  gums.count = hedgeList.length;

  // Farmhouses: white walls, corrugated roofs
  const houseList = farmland ? farmland.houses : [];
  const wallGeo = new THREE.BoxGeometry(9, 3.2, 14);
  wallGeo.translate(0, 1.6, 0);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-5.2, 0); roofShape.lineTo(0, 2.4); roofShape.lineTo(5.2, 0); roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 15, bevelEnabled: false });
  roofGeo.translate(0, 3.2, -7.5);
  const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.9 }), Math.max(1, houseList.length));
  const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.6, metalness: 0.3 }), Math.max(1, houseList.length));
  houseList.forEach(([x, z, a], i) => {
    p.set(x, height(x, z) - 0.2, z);
    q.setFromAxisAngle(up, a);
    s.set(1, 1, 1);
    m.compose(p, q, s);
    walls.setMatrixAt(i, m);
    roofs.setMatrixAt(i, m);
  });
  walls.count = roofs.count = houseList.length;

  for (const mesh of [canopies, trunks, bushes, gums, walls, roofs]) {
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

export { clamp };
