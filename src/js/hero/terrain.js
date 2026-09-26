// Rolling KwaZulu-Natal midlands in late winter: straw-gold grassland with
// greener drainage lines, eroded soil on steeper ground, farmland blocks,
// acacia, eucalyptus windbreaks, scrub, dolerite boulders and farmhouses.
// Flattened along the highway.
import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep, clamp } from './noise.js';
import { withAtmosphere, extendMaterial } from './atmosphere.js';

const CENTER = new THREE.Vector2(150, 250);
const TERRAIN_W = 2600;
const TERRAIN_D = 3000;

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

// World-space cloud shadows (and, for the terrain, the farmland tint and a
// macro colour variation that breaks up texture tiling).
export function groundPatch(uniforms, farmland = null) {
  return (material) =>
    extendMaterial(material, farmland ? 'ground-farm' : 'ground', (shader) => {
      shader.uniforms.uCloud = uniforms.uCloud;
      shader.uniforms.uCloudOffset = uniforms.uCloudOffset;
      shader.uniforms.uCloudAmount = uniforms.uCloudAmount;
      let decl = '';
      let extra = '';
      if (farmland) {
        shader.uniforms.uFields = { value: farmland.texture };
        shader.uniforms.uFieldsOrigin = { value: farmland.origin };
        shader.uniforms.uFieldsSize = { value: farmland.size };
        decl = '\nuniform sampler2D uFields;\nuniform vec2 uFieldsOrigin;\nuniform vec2 uFieldsSize;';
        extra =
          '\ndiffuseColor.rgb *= texture2D(uFields, (vGroundWorld.xz - uFieldsOrigin) / uFieldsSize).rgb * 2.0;' +
          '\ndiffuseColor.rgb *= mix(0.86, 1.12, texture2D(uCloud, vGroundWorld.xz / 170.0 + 0.37).r);' +
          '\ndiffuseColor.rgb *= mix(0.84, 1.1, texture2D(uCloud, vGroundWorld.xz / 38.0 + 0.61).r);' +
          '\ndiffuseColor.rgb *= mix(0.9, 1.06, texture2D(uCloud, vGroundWorld.xz / 9.0 + 0.23).r);';
      }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;\nuniform sampler2D uCloud;\nuniform vec2 uCloudOffset;\nuniform float uCloudAmount;' + decl)
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat cloudShade = texture2D(uCloud, vGroundWorld.xz / 1900.0 + uCloudOffset).r;\ndiffuseColor.rgb *= mix(1.0, cloudShade, uCloudAmount);' + extra);
    });
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
    { tint: [0.62, 1.04, 0.56], rows: 'rgba(20,40,10,0.2)', spacing: 3 }, // sugar cane
    { tint: [0.84, 0.98, 0.66], rows: null }, // pasture
    { tint: [0.86, 0.66, 0.52], rows: 'rgba(30,18,8,0.22)', spacing: 2.5 }, // ploughed
    { tint: [1.24, 1.12, 0.9], rows: 'rgba(60,50,30,0.16)', spacing: 3 }, // stubble
    { tint: [1.1, 1.0, 0.82], rows: null }, // fallow
    { tint: [0.74, 1.0, 0.62], rows: 'rgba(20,40,10,0.16)', spacing: 4 }, // young crop
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
      ctx.strokeStyle = fill([1.26, 1.12, 0.94]);
      ctx.lineWidth = 3.2 * sx;
      ctx.beginPath();
      [[-W0 / 2, -H0 / 2], [W0 / 2, -H0 / 2], [W0 / 2, H0 / 2], [-W0 / 2, H0 / 2]]
        .map(([u, w]) => px(...toWorld(u, w)))
        .forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.closePath();
      ctx.stroke();
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
  const segX = quality.tier === 'high' ? 260 : 170;
  const segZ = Math.round(segX * (D / W));
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(CENTER.x, 0, CENTER.y);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const nC = createNoise2D(303);
  const nD = createNoise2D(404);

  // sRGB picks, converted to linear by THREE.Color
  const straw = new THREE.Color('#c9a86a');
  const gold = new THREE.Color('#b08e52');
  const dry = new THREE.Color('#9c8752');
  const green = new THREE.Color('#77803f');
  const earth = new THREE.Color('#946a44');
  const verge = new THREE.Color('#a8905c');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = path.distance(x, z, 140);
    const h = height(x, z, d);
    pos.setY(i, h);
    uv.setXY(i, x / 5, z / 5);

    const patch = fbm(nC, x * 0.009, z * 0.009, 3) * 0.5 + 0.5;
    const wet = fbm(nD, x * 0.004 + 7, z * 0.004 - 3, 3) * 0.5 + 0.5;
    tmp.copy(gold).lerp(straw, smoothstep(0.5, 0.82, patch));
    tmp.lerp(dry, smoothstep(0.45, 0.2, patch) * 0.8);
    tmp.lerp(green, smoothstep(0.5, 0.82, wet) * 0.75);
    tmp.lerp(earth, smoothstep(0.8, 0.95, patch) * 0.5);
    tmp.lerp(verge, 1 - smoothstep(18, 34, d));
    const far = smoothstep(700, 1300, Math.hypot(x - CENTER.x, z - CENTER.y));
    tmp.lerp(green, far * 0.3);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Exact height of the rendered surface (same triangles as PlaneGeometry),
  // so grass, trees and rocks sit on the mesh rather than the ideal field
  const nx = segX + 1;
  const x0 = CENTER.x - W / 2, z0 = CENTER.y - D / 2;
  const cw = W / segX, cd = D / segZ;
  function surface(x, z) {
    const u = Math.min(Math.max((x - x0) / cw, 0), segX - 1e-4);
    const v = Math.min(Math.max((z - z0) / cd, 0), segZ - 1e-4);
    const ix = Math.floor(u), iz = Math.floor(v);
    const fx = u - ix, fz = v - iz;
    const a = pos.getY(iz * nx + ix);
    const b = pos.getY((iz + 1) * nx + ix);
    const c = pos.getY((iz + 1) * nx + ix + 1);
    const d = pos.getY(iz * nx + ix + 1);
    return fx + fz <= 1 ? a + (d - a) * fx + (b - a) * fz : c + (b - c) * (1 - fx) + (d - c) * (1 - fz);
  }

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: tex.grass.map,
    normalMap: tex.grass.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 1,
    metalness: 0,
  });
  withAtmosphere(mat);
  // Ground patch first: it keeps the map_fragment include the terrain patch replaces
  groundPatch(cloudUniforms, farmland)(mat);
  extendMaterial(mat, 'terrain', (shader) => {
    shader.uniforms.uSoil = { value: tex.soil };
    shader.uniforms.uSoilColor = { value: new THREE.Color('#8c6c4c') };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUpness;\nvarying vec3 vTerrW;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUpness = normalize(objectNormal).y;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vUpness;\nvarying vec3 vTerrW;\nuniform sampler2D uSoil;\nuniform vec3 uSoilColor;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          float dfade = smoothstep(70.0, 520.0, length(vTerrW - cameraPosition));
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.66, 0.61, 0.5), dfade);
          diffuseColor *= sampledDiffuseColor;
        #endif
        // Steeper ground: bare, eroded soil
        float steep = smoothstep(0.93, 0.8, vUpness);
        vec3 soil = uSoilColor * texture2D(uSoil, vTerrW.xz / 7.0).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, soil, steep * 0.75);`);
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  mesh.userData.surface = surface;
  return mesh;
}

// Where the trees, bushes, boulders and houses go
export function scatter(path, height, quality, farmland) {
  const rand = mulberry32(77);
  const density = createNoise2D(505);
  const high = quality.tier === 'high';
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
  const tree = ([x, z, d], s) => ({ x, y: height(x, z, d), z, s, r: rand() * Math.PI * 2, hue: rand(), sat: rand(), lum: rand() });
  const acacia = place(high ? 520 : 260, 26, (dn) => rand() < smoothstep(0.35, 0.8, dn)).map((p) => tree(p, 0.8 + rand() * 0.5));
  const bush = place(high ? 1400 : 650, 22, (dn) => rand() < 0.25 + dn * 0.6).map((p) => tree(p, 0.6 + rand() * 0.9));
  const hedgeList = farmland ? farmland.hedges.slice(0, high ? 1300 : 600) : [];
  const gum = hedgeList.map(([x, z]) => ({ x, y: height(x, z), z, s: 0.75 + rand() * 0.45, r: rand() * Math.PI * 2, hue: rand(), sat: rand(), lum: rand() }));
  // Dolerite boulders on the steeper slopes and ridges
  const rocks = [];
  let guard = 0;
  while (rocks.length < (high ? 420 : 200) && guard++ < 20000) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const d = path.distance(x, z, 140);
    if (d < 30) continue;
    const h = height(x, z, d);
    const slope = Math.abs(height(x + 4, z, d) - height(x - 4, z, d)) + Math.abs(height(x, z + 4, d) - height(x, z - 4, d));
    if (slope < 1.6 && rand() > 0.08) continue;
    rocks.push({ x, y: h, z, s: 0.5 + Math.pow(rand(), 2) * 2.4, r: rand() * 6.28 });
  }
  return { acacia, bush, gum, rocks, houses: farmland ? farmland.houses : [] };
}

export function createRocks(list, tex) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const n = createNoise2D(909);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + fbm(n, v.x * 1.3 + v.z, v.y * 1.3 - v.z, 3) * 0.35;
    v.multiplyScalar(k);
    v.y = v.y * 0.62 + 0.18;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x7c776e, map: tex.soil, bumpMap: tex.soil, bumpScale: 2, roughness: 0.92 }));
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const pp = new THREE.Vector3();
  list.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(0.2 * Math.sin(r.r * 3), r.r, 0.2 * Math.cos(r.r * 5)));
    m4.compose(pp.set(r.x, r.y - r.s * 0.25, r.z), q, s.set(r.s * 1.2, r.s, r.s));
    im.setMatrixAt(i, m4);
  });
  im.count = list.length;
  im.castShadow = true;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}

// Farmhouses: white walls, corrugated iron roofs, a water tank
export function createHouses(list, height) {
  const group = new THREE.Group();
  if (!list.length) return group;
  const wallGeo = new THREE.BoxGeometry(9, 3.2, 14);
  wallGeo.translate(0, 1.6, 0);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-5.3, 0); roofShape.lineTo(0, 2.3); roofShape.lineTo(5.3, 0); roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 15, bevelEnabled: false });
  roofGeo.translate(0, 3.2, -7.5);
  const tankGeo = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16);
  tankGeo.translate(6, 1.1, 4);
  const walls = new THREE.InstancedMesh(wallGeo, withAtmosphere(new THREE.MeshStandardMaterial({ color: 0xe8e3d6, roughness: 0.9 })), list.length);
  const roofs = new THREE.InstancedMesh(roofGeo, withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x8d8f8e, roughness: 0.45, metalness: 0.6 })), list.length);
  const tanks = new THREE.InstancedMesh(tankGeo, withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x3d4a3a, roughness: 0.6 })), list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  list.forEach(([x, z, a], i) => {
    p.set(x, height(x, z) - 0.2, z);
    q.setFromAxisAngle(up, a);
    m.compose(p, q, s);
    walls.setMatrixAt(i, m);
    roofs.setMatrixAt(i, m);
    tanks.setMatrixAt(i, m);
  });
  for (const mesh of [walls, roofs, tanks]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

export { clamp };
