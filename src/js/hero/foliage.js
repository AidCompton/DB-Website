// Procedural trees for the midlands: umbrella-thorn acacias, eucalyptus
// windbreaks and scrub. Branches are tapered cylinders; canopies are clusters
// of alpha-tested leaf cards with normals bent outward from the crown, so they
// light like a volume. Leaves sway and glow when the low sun is behind them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { withAtmosphere, extendMaterial } from './atmosphere.js';
import { mulberry32 } from './noise.js';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _d = new THREE.Vector3();

function limb(a, b, r0, r1, radial = 5) {
  _d.subVectors(b, a);
  const len = _d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0);
  _q.setFromUnitVectors(UP, _d.normalize());
  g.applyQuaternion(_q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// A leaf card centred at p, size s, with normals pointing away from `centre`
function card(p, s, rand, centre, flatten, tilt = 0.6) {
  const g = new THREE.PlaneGeometry(s, s * (0.7 + rand() * 0.3));
  g.rotateX(-Math.PI / 2 + (rand() - 0.5) * tilt * 2);
  g.rotateY(rand() * Math.PI * 2);
  g.rotateZ((rand() - 0.5) * tilt);
  g.translate(p.x, p.y, p.z);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i) - centre.x, (pos.getY(i) - centre.y) * flatten, pos.getZ(i) - centre.z).normalize();
    n.lerp(UP, 0.35).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

function acacia(seed) {
  const rand = mulberry32(seed);
  const bark = [];
  const leaves = [];
  const h1 = 1.4 + rand() * 1.0;
  const lean = new THREE.Vector3((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
  const base = new THREE.Vector3(0, -0.2, 0);
  const fork = new THREE.Vector3(lean.x, h1, lean.z);
  bark.push(limb(base, fork, 0.2, 0.15, 6));
  const crownY = h1 + 1.8 + rand() * 1.6;
  const spread = 2.6 + rand() * 2.2;
  const centre = new THREE.Vector3(fork.x, crownY, fork.z);
  const nb = 3 + ((rand() * 3) | 0);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + rand() * 0.8;
    const r = spread * (0.45 + rand() * 0.35);
    const end = new THREE.Vector3(fork.x + Math.cos(a) * r, crownY - 0.2 + rand() * 0.5, fork.z + Math.sin(a) * r);
    bark.push(limb(fork, end, 0.12, 0.05, 5));
    for (let j = 0; j < 2; j++) {
      const a2 = a + (rand() - 0.5) * 1.4;
      const tip = new THREE.Vector3(end.x + Math.cos(a2) * spread * 0.4, end.y + 0.2 + rand() * 0.3, end.z + Math.sin(a2) * spread * 0.4);
      bark.push(limb(end, tip, 0.05, 0.02, 4));
    }
  }
  // Flat-topped umbrella canopy
  const nCards = 44 + ((rand() * 12) | 0);
  for (let i = 0; i < nCards; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * spread;
    const y = crownY + 0.35 + (1 - (d / spread) ** 2) * 0.55 + (rand() - 0.5) * 0.5;
    const p = new THREE.Vector3(centre.x + Math.cos(a) * d, y, centre.z + Math.sin(a) * d);
    leaves.push(card(p, 1.8 + rand() * 1.3, rand, centre, 2.6, 0.45));
  }
  return { bark: mergeGeometries(bark), leaves: mergeGeometries(leaves) };
}

function gum(seed) {
  const rand = mulberry32(seed);
  const bark = [];
  const leaves = [];
  const H = 13 + rand() * 9;
  const top = new THREE.Vector3((rand() - 0.5) * 0.8, H, (rand() - 0.5) * 0.8);
  bark.push(limb(new THREE.Vector3(0, -0.3, 0), top, 0.28, 0.08, 6));
  const centre = new THREE.Vector3(top.x * 0.6, H * 0.68, top.z * 0.6);
  const nLimbs = 5 + ((rand() * 4) | 0);
  for (let i = 0; i < nLimbs; i++) {
    const y = H * (0.4 + rand() * 0.45);
    const a = rand() * Math.PI * 2;
    const from = new THREE.Vector3(top.x * (y / H), y, top.z * (y / H));
    const to = new THREE.Vector3(from.x + Math.cos(a) * 2.2, y + 2.5 + rand() * 2, from.z + Math.sin(a) * 2.2);
    bark.push(limb(from, to, 0.09, 0.03, 4));
  }
  const nCards = 46 + ((rand() * 14) | 0);
  for (let i = 0; i < nCards; i++) {
    const t = rand();
    const y = H * (0.36 + t * 0.66);
    const rad = (2.2 + rand() * 1.6) * Math.sin(Math.PI * (0.15 + t * 0.85)) + 0.6;
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * rad;
    const p = new THREE.Vector3(centre.x + Math.cos(a) * d, y, centre.z + Math.sin(a) * d);
    leaves.push(card(p, 2.1 + rand() * 1.6, rand, centre, 0.8, 1.2));
  }
  return { bark: mergeGeometries(bark), leaves: mergeGeometries(leaves) };
}

function bush(seed) {
  const rand = mulberry32(seed);
  const leaves = [];
  const R = 0.9 + rand() * 0.5;
  const centre = new THREE.Vector3(0, R * 0.35, 0);
  const n = 14 + ((rand() * 6) | 0);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const el = rand() * Math.PI * 0.45;
    const d = R * (0.4 + rand() * 0.6);
    const p = new THREE.Vector3(Math.cos(a) * Math.cos(el) * d, centre.y + Math.sin(el) * d * 0.9, Math.sin(a) * Math.cos(el) * d);
    leaves.push(card(p, 0.9 + rand() * 0.7, rand, centre, 1.2, 1.0));
  }
  return { bark: null, leaves: mergeGeometries(leaves) };
}

export function createFoliageMaterials(tex) {
  const shared = { uTime: { value: 0 } };
  const leaf = (map) => {
    const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.36, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
    m.alphaToCoverage = true;
    withAtmosphere(m);
    extendMaterial(m, 'leaf', (shader) => {
      shader.uniforms.uTime = shared.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 seedXZ = instanceMatrix[3].xz;
          #else
            vec2 seedXZ = vec2(0.0);
          #endif
          float sway = sin(uTime * 1.3 + seedXZ.x * 0.21 + seedXZ.y * 0.17) * 0.5 + sin(uTime * 2.7 + position.x * 1.7) * 0.25;
          transformed.xz += sway * 0.035 * max(position.y, 0.0) * 0.25;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          float leafBack = pow(max(dot(normalize(-vViewPosition), directionalLights[0].direction), 0.0), 3.0);
          reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * leafBack * 0.28;
        #endif`);
    });
    return m;
  };
  return {
    shared,
    acaciaLeaves: leaf(tex.leafAcacia),
    gumLeaves: leaf(tex.leafGum),
    bushLeaves: leaf(tex.leafBush),
    acaciaBark: withAtmosphere(new THREE.MeshStandardMaterial({ map: tex.barkAcacia, roughness: 0.95, color: 0xcfc6ba })),
    gumBark: withAtmosphere(new THREE.MeshStandardMaterial({ map: tex.barkGum, roughness: 0.85 })),
  };
}

// placements: arrays of { x, y, z, s, r } per species
export function createForest(materials, placements, quality) {
  const group = new THREE.Group();
  group.name = 'foliage';
  const variants = quality.tier === 'high' ? 4 : 3;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tint = new THREE.Color();
  const species = [
    { key: 'acacia', make: acacia, leaves: materials.acaciaLeaves, bark: materials.acaciaBark, seed: 100 },
    { key: 'gum', make: gum, leaves: materials.gumLeaves, bark: materials.gumBark, seed: 200 },
    { key: 'bush', make: bush, leaves: materials.bushLeaves, bark: null, seed: 300 },
  ];
  for (const sp of species) {
    const list = placements[sp.key] || [];
    if (!list.length) continue;
    for (let v = 0; v < variants; v++) {
      const mine = list.filter((_, i) => i % variants === v);
      if (!mine.length) continue;
      const geo = sp.make(sp.seed + v * 7);
      const parts = [[geo.leaves, sp.leaves]];
      if (geo.bark && sp.bark) parts.push([geo.bark, sp.bark]);
      for (const [g, mat] of parts) {
        const im = new THREE.InstancedMesh(g, mat, mine.length);
        mine.forEach((it, i) => {
          q.setFromAxisAngle(UP, it.r);
          m4.compose(p.set(it.x, it.y, it.z), q, sc.setScalar(it.s));
          im.setMatrixAt(i, m4);
          if (mat === sp.leaves) {
            tint.setHSL(0.18 + (it.hue || 0) * 0.05, 0.25 + (it.sat || 0) * 0.2, 0.62 + (it.lum || 0) * 0.2);
            im.setColorAt(i, tint);
          }
        });
        im.castShadow = true;
        im.receiveShadow = true;
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
        group.add(im);
      }
    }
  }
  return group;
}
