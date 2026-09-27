// A European-style 6x4 cab-over tractor in Driver Bureau blue, pulling a
// 13.6 m box trailer in the brand livery. Built from rounded, bevelled parts
// so edges catch the light, with physically based materials: clearcoat
// paint, polished alloy rims, tyres with moulded tread, reflective glass.
//
// Local axes: +Z forward, +X left, +Y up. Tractor origin = fifth wheel on the
// ground. Trailer origin = kingpin on the ground. Static parts are merged per
// material; the 12 wheels are instanced and rolled every frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { withAtmosphere, extendMaterial } from './atmosphere.js';
import * as Liv from './livery.js';
import { BRAND_BLUE } from '../brand.js';

// ------------------------------------------------------------------ layout
export const RIG = {
  cabBack: 2.28,
  cabFront: 4.64, // at the bottom of the cab front
  cabBottom: 1.22,
  cabTop: 3.78,
  cabHalfW: 1.245,
  frontSlope: 0.075, // front face leans back 7.5 cm per metre of height
  frontAxle: 3.5,
  rearAxles: [0.56, -0.81],
  fifthWheel: -0.12,
  wheelR: 0.535,
  trailerFront: 1.2,
  trailerRear: -12.4,
  trailerAxles: [-7.9, -9.21, -10.52],
  trailerBottom: 1.28,
  trailerTop: 4.0,
};
const frontZ = (y) => RIG.cabFront - (y - RIG.cabBottom) * RIG.frontSlope;
const FRONT_TILT = -Math.atan(RIG.frontSlope);

// ------------------------------------------------------------------ helpers
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

function clean(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  return g;
}

// Collects geometry per material, then merges each bucket into one mesh
class Builder {
  constructor() { this.buckets = new Map(); }
  add(mat, geo, matrix) {
    const g = clean(geo);
    if (matrix) g.applyMatrix4(matrix);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
    return this;
  }
  build(parent) {
    for (const [mat, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !mat.userData.noShadow;
      mesh.receiveShadow = !mat.userData.noReceive;
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}

const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
function cylX(r, len, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open);
  g.rotateZ(Math.PI / 2);
  return g;
}
function cylZ(r, len, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// A flat part on the (sloped) cab front, centred at (x, y), pushed out by `out`
function onFront(x, y, out = 0.005) {
  return T(x, y, frontZ(y) + out, FRONT_TILT, 0, 0);
}
function tube(points, r, seg = 24, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
}

// ------------------------------------------------------------------ materials
function createMaterials(tex, renderer) {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    paint: phys({ color: BRAND_BLUE, roughness: 0.34, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.035 }),
    white: phys({ color: 0xdfe2e5, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
    blackGloss: phys({ color: 0x0c0d0f, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.06 }),
    plastic: std({ color: 0x1d1f22, roughness: 0.6 }),
    bumper: std({ color: 0x2c3036, roughness: 0.48, metalness: 0.1 }),
    rubber: std({ color: 0x0e0f10, roughness: 0.92 }),
    chrome: std({ color: 0xffffff, metalness: 1, roughness: 0.05 }),
    alu: std({ color: 0xe4e7eb, metalness: 1, roughness: 0.26 }),
    aluBrushed: phys({ color: 0xcfd3d8, metalness: 1, roughness: 0.32, anisotropy: 0.7 }),
    chassis: std({ color: 0x131416, roughness: 0.66, metalness: 0.25 }),
    darkMetal: std({ color: 0x2c2e31, roughness: 0.5, metalness: 0.6 }),
    glass: phys({ color: 0x131a22, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.01 }),
    screen: phys({ map: tex.screen, color: 0xb8bcc2, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.01, specularIntensity: 1.2 }),
    mirror: std({ color: 0xe8ecf0, metalness: 1, roughness: 0.015, envMapIntensity: 1.4 }),
    head: std({ color: 0xdfe3e8, emissive: 0xfff6ea, emissiveIntensity: 0, roughness: 0.12, metalness: 0.6 }),
    drl: std({ color: 0xdfe3e8, emissive: 0xf4f8ff, emissiveIntensity: 0, roughness: 0.2 }),
    tail: std({ color: 0x4d0805, emissive: 0xff2410, emissiveIntensity: 0, roughness: 0.22 }),
    amber: std({ color: 0x6e4400, emissive: 0xffa21e, emissiveIntensity: 0, roughness: 0.22 }),
    reflectorRed: std({ color: 0xb01a10, roughness: 0.3 }),
    tyre: std({ map: tex.tyre.map, normalMap: tex.tyre.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.86 }),
    grille: phys({ map: tex.grille, color: 0xffffff, roughness: 0.42, clearcoat: 0.4 }),
    sideL: phys({ map: tex.sideL, color: 0xe6e8ea, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.12 }),
    sideR: phys({ map: tex.sideR, color: 0xe6e8ea, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.12 }),
    rear: phys({ map: tex.rear, color: 0xe6e8ea, roughness: 0.4, clearcoat: 0.25 }),
    roofDecal: std({ map: tex.roof, color: 0xe6e8ea, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    doorDecal: phys({ map: tex.door, transparent: true, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }),
    visorDecal: std({ map: tex.visor, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }),
    badge: std({ map: tex.badge, transparent: true, alphaTest: 0.4, metalness: 1, roughness: 0.12, color: 0xe6eaee }),
    plate: std({ map: tex.plate, roughness: 0.35 }),
    hoseRed: std({ color: 0xb3261c, roughness: 0.45 }),
    hoseYellow: std({ color: 0xd6a312, roughness: 0.45 }),
    blur: std({ map: tex.rimBlur, transparent: true, opacity: 0, metalness: 0.8, roughness: 0.35, depthWrite: false }),
  };
  for (const k of ['head', 'drl', 'tail', 'amber', 'glass', 'screen', 'doorDecal', 'visorDecal', 'badge', 'blur', 'mirror']) M[k].userData.noShadow = true;
  for (const m of Object.values(M)) withAtmosphere(m);
  // Road dust on the lower cab and bumper (object-space height)
  for (const m of [M.paint]) {
    extendMaterial(m, 'dust', (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vObjY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjY = position.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vObjY;')
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          float dust = smoothstep(1.95, 1.0, vObjY) * 0.42;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.29, 0.22), dust * 0.55);
          roughnessFactor = mix(roughnessFactor, 0.85, dust);`);
    });
  }
  return M;
}

// Radially smeared rim face, shown when the wheels spin fast
function rimBlurTexture(renderer) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(200,204,210,0)');
  g.addColorStop(0.52, 'rgba(200,204,210,0)');
  g.addColorStop(0.58, 'rgba(110,114,120,0.85)');
  g.addColorStop(0.74, 'rgba(84,88,94,0.92)');
  g.addColorStop(0.88, 'rgba(150,154,160,0.75)');
  g.addColorStop(0.94, 'rgba(200,204,210,0)');
  g.addColorStop(1, 'rgba(200,204,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Windscreen: a dim view of the cab through tinted glass (dashboard, the
// steering wheel and driver on the right-hand side, as seen from in front,
// i.e. on the left of the texture), with a blue-grey sun strip on top.
// Reflections come from the clearcoat on top of this.
function screenTexture(renderer) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1e2c3d');
  bg.addColorStop(0.15, '#1e2c3d');
  bg.addColorStop(0.19, '#20262d');
  bg.addColorStop(0.6, '#181c21');
  bg.addColorStop(1, '#0f1215');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Back wall and the sleeper curtain
  ctx.fillStyle = 'rgba(40,44,50,0.35)';
  ctx.fillRect(0, H * 0.28, W, H * 0.34);
  // Seats: driver (left of texture) and passenger headrests
  const seat = (x) => {
    ctx.fillStyle = '#23272c';
    ctx.beginPath();
    ctx.ellipse(x, H * 0.5, 34, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 46, H * 0.56, 92, H * 0.3);
  };
  seat(W * 0.25);
  seat(W * 0.76);
  // Driver: head and shoulders, a little lighter than the cab
  ctx.fillStyle = '#2b2f35';
  ctx.beginPath();
  ctx.ellipse(W * 0.25, H * 0.47, 21, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W * 0.25, H * 0.74, 60, 34, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(W * 0.25 - 60, H * 0.74, 120, H * 0.2);
  ctx.fillStyle = 'rgba(120,98,84,0.35)';
  ctx.beginPath();
  ctx.ellipse(W * 0.25 + 4, H * 0.49, 13, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dashboard top edge with a soft highlight, steering wheel rim
  ctx.fillStyle = '#121518';
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
  ctx.fillStyle = 'rgba(150,160,170,0.18)';
  ctx.fillRect(0, H * 0.82, W, 2);
  ctx.strokeStyle = '#0c0e10';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(W * 0.25, H * 0.86, 54, 20, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Mirror and a hanging tag, for scale
  ctx.fillStyle = '#0c0e10';
  ctx.fillRect(W * 0.47, H * 0.2, 36, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ wheels
// Lathe profile of a 315/80 R22.5 tyre, (radius, axial) from bead to bead
function tyreGeometry(width = 0.315) {
  const h = width / 2;
  const R = RIG.wheelR;
  const prof = [
    [0.292, -h * 0.74], [0.31, -h * 0.9], [0.36, -h * 0.99], [0.42, -h * 1.0], [0.47, -h * 0.96],
    [0.5, -h * 0.9], [0.522, -h * 0.78], [0.532, -h * 0.62], [R, -h * 0.42], [R, 0], [R, h * 0.42],
    [0.532, h * 0.62], [0.522, h * 0.78], [0.5, h * 0.9], [0.47, h * 0.96], [0.42, h * 1.0],
    [0.36, h * 0.99], [0.31, h * 0.9], [0.292, h * 0.74],
  ];
  const g = new THREE.LatheGeometry(prof.map(([r, a]) => new THREE.Vector2(r, a)), 64);
  g.rotateZ(-Math.PI / 2); // lathe axis Y -> X
  return g;
}

// Polished 22.5" alloy rim: barrel + flanges (lathe) and a dished face with
// ten hand holes. `face` = +1 when the face points to +X.
function rimParts(face = 1) {
  const bar = [
    [0.27, -0.118], [0.302, -0.122], [0.304, -0.108], [0.278, -0.098], [0.272, 0.09], [0.3, 0.104],
    [0.306, 0.118], [0.294, 0.124], [0.268, 0.11],
  ];
  const barrel = new THREE.LatheGeometry(bar.map(([r, a]) => new THREE.Vector2(r, a * face)), 48);
  barrel.rotateZ(-Math.PI / 2);
  // Face disc with hand holes
  const disc = new THREE.Shape();
  disc.absarc(0, 0, 0.268, 0, Math.PI * 2, false);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const hole = new THREE.Path();
    const cx = Math.cos(a) * 0.2, cy = Math.sin(a) * 0.2;
    hole.absellipse(cx, cy, 0.034, 0.024, 0, Math.PI * 2, true, a);
    disc.holes.push(hole);
  }
  const hub = new THREE.Path();
  hub.absarc(0, 0, 0.11, 0, Math.PI * 2, true);
  disc.holes.push(hub);
  const faceGeo = new THREE.ExtrudeGeometry(disc, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 40 });
  faceGeo.rotateY(face * Math.PI / 2);
  faceGeo.translate(face * 0.07, 0, 0);
  // Hub, nuts and the drum behind
  const hubGeo = new THREE.CylinderGeometry(0.105, 0.112, 0.06, 32);
  hubGeo.rotateZ(Math.PI / 2);
  hubGeo.translate(face * 0.085, 0, 0);
  const cap = new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.rotateZ(-face * Math.PI / 2);
  cap.scale(0.6, 1, 1);
  cap.translate(face * 0.105, 0, 0);
  const nuts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const n = new THREE.CylinderGeometry(0.017, 0.017, 0.03, 6);
    n.rotateZ(Math.PI / 2);
    n.translate(face * 0.112, Math.cos(a) * 0.1675, Math.sin(a) * 0.1675);
    nuts.push(n);
  }
  const drum = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 28);
  drum.rotateZ(Math.PI / 2);
  drum.translate(-face * 0.02, 0, 0);
  const blur = new THREE.CircleGeometry(0.27, 40);
  blur.rotateY(face * Math.PI / 2);
  blur.translate(face * 0.093, 0, 0);
  return { barrel, faceGeo, hubGeo, cap, nuts: mergeGeometries(nuts.map(clean)), drum, blur };
}

// Per-material geometry for a single (front) or dual (rear) wheel whose
// outer face points to +X; right-hand wheels are mirrored by the instance matrix.
function wheelVariant(dual) {
  const parts = { tyre: [], alu: [], chrome: [], darkMetal: [], blur: [] };
  const offsets = dual ? [0.165, -0.165] : [0];
  offsets.forEach((ox, i) => {
    const outer = i === 0;
    parts.tyre.push(clean(tyreGeometry(dual ? 0.3 : 0.315)).applyMatrix4(T(ox)));
    const r = rimParts(outer ? 1 : -1);
    parts.alu.push(clean(r.barrel).applyMatrix4(T(ox)));
    if (outer) {
      parts.alu.push(clean(r.faceGeo).applyMatrix4(T(ox)));
      parts.chrome.push(clean(r.cap).applyMatrix4(T(ox)), clean(r.nuts).applyMatrix4(T(ox)));
      parts.alu.push(clean(r.hubGeo).applyMatrix4(T(ox)));
      parts.blur.push(clean(r.blur).applyMatrix4(T(ox)));
    }
    parts.darkMetal.push(clean(r.drum).applyMatrix4(T(ox)));
  });
  const out = {};
  for (const [k, list] of Object.entries(parts)) if (list.length) out[k] = mergeGeometries(list);
  return out;
}

// ------------------------------------------------------------------ tractor
function buildCab(b, M) {
  const W = RIG.cabHalfW * 2;
  const H = RIG.cabTop - RIG.cabBottom;
  const D = RIG.cabFront - RIG.cabBack;
  const cab = new RoundedBoxGeometry(W, H, D, 6, 0.14);
  cab.translate(0, RIG.cabBottom + H / 2, RIG.cabBack + D / 2);
  // Lean the whole front back (a shear) and fix the normals to match
  const p = cab.attributes.position;
  const n = cab.attributes.normal;
  const k = RIG.frontSlope;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < 3.4) continue;
    p.setZ(i, p.getZ(i) - (p.getY(i) - RIG.cabBottom) * k);
    const nx = n.getX(i), ny = n.getY(i) + k * n.getZ(i), nz = n.getZ(i);
    const l = Math.hypot(nx, ny, nz);
    n.setXYZ(i, nx / l, ny / l, nz / l);
  }
  b.add(M.paint, cab);

  // Windscreen: rubber surround, then glass
  b.add(M.rubber, new THREE.ShapeGeometry(roundedRectShape(2.24, 1.08, 0.13), 6), onFront(0, 2.92, 0.004));
  const screen = new THREE.ShapeGeometry(roundedRectShape(2.16, 1.0, 0.1), 6);
  const suv = screen.attributes.uv;
  for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i) / 2.16 + 0.5, suv.getY(i) / 1.0 + 0.5);
  b.add(M.screen, screen, onFront(0, 2.92, 0.008));
  // A-pillar air deflectors wrapping the front corners
  for (const s of [1, -1]) {
    b.add(M.plastic, rbox(0.05, 1.28, 0.2, 0.02), T(s * 1.2, 2.94, frontZ(2.94) - 0.05, FRONT_TILT, s * 0.72, 0));
  }
  // Grille panel surround (the tilting front panel's shut line)
  for (const [w, h, x, y] of [[2.02, 0.012, 0, 2.36], [2.02, 0.012, 0, 1.55], [0.012, 0.81, 1.01, 1.955], [0.012, 0.81, -1.01, 1.955]]) {
    b.add(M.rubber, rbox(w, h, 0.006, 0.002), onFront(x, y, 0.002));
  }
  // Wipers parked at the bottom of the screen
  for (const x of [0.52, -0.46]) b.add(M.plastic, rbox(0.95, 0.025, 0.025, 0.01), T(x, 2.45, frontZ(2.45) + 0.03, 0, 0, 0.06));

  // Sun visor with lettering
  const vz = frontZ(3.6) + 0.1, va = 0.18;
  b.add(M.paint, rbox(2.3, 0.16, 0.3, 0.05, 3), T(0, 3.6, vz, va));
  b.add(M.visorDecal, new THREE.PlaneGeometry(2.1, 0.14), T(0, 3.6 - 0.152 * Math.sin(va), vz + 0.152 * Math.cos(va), va));

  // Grille: honeycomb panel, three painted slats, the monogram badge
  b.add(M.grille, new THREE.PlaneGeometry(1.86, 0.56), onFront(0, 1.86, 0.004));
  for (const y of [1.66, 1.86, 2.06]) {
    b.add(M.paint, rbox(1.9, 0.07, 0.07, 0.03), onFront(0, y, 0.03));
    b.add(M.chrome, rbox(1.9, 0.012, 0.02, 0.005), onFront(0, y + 0.033, 0.055));
  }
  b.add(M.badge, new THREE.PlaneGeometry(0.2, 0.2 * (451.3 / 446.5)), onFront(0, 2.26, 0.012));

  // Headlamp clusters in the lower corners
  for (const s of [1, -1]) {
    const x = s * 0.88;
    b.add(M.blackGloss, rbox(0.62, 0.26, 0.1, 0.05, 3), onFront(x, 1.4, 0.01));
    for (const dx of [-0.13, 0.1]) {
      const lens = new THREE.SphereGeometry(0.068, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      lens.rotateX(Math.PI / 2);
      b.add(M.head, lens, onFront(x + s * dx, 1.37, 0.05));
      b.add(M.chrome, new THREE.TorusGeometry(0.075, 0.012, 8, 28), onFront(x + s * dx, 1.37, 0.056));
    }
    b.add(M.drl, rbox(0.5, 0.022, 0.03, 0.01), onFront(x, 1.495, 0.06));
    b.add(M.amber, rbox(0.1, 0.1, 0.03, 0.02), onFront(s * 1.18, 1.4, 0.05));
  }

  // Bumper, lower lip, fog lamps, plate
  const bump = rbox(2.52, 0.48, 0.46, 0.09, 3);
  b.add(M.bumper, bump, T(0, 0.98, frontZ(0.98) - 0.12));
  b.add(M.plastic, rbox(2.3, 0.1, 0.3, 0.04), T(0, 0.72, frontZ(0.72) - 0.1));
  for (let i = 0; i < 3; i++) b.add(M.plastic, rbox(1.2, 0.03, 0.02, 0.01), T(0, 1.1 - i * 0.05, frontZ(1.1) + 0.115));
  for (const s of [1, -1]) {
    b.add(M.plastic, cylZ(0.07, 0.04, 24), T(s * 0.95, 0.88, frontZ(0.88) + 0.1));
    b.add(M.head, cylZ(0.055, 0.02, 24), T(s * 0.95, 0.88, frontZ(0.88) + 0.12));
  }
  b.add(M.plate, new THREE.PlaneGeometry(0.52, 0.11), T(0, 0.93, frontZ(0.93) + 0.113));

  // Doors: panel gaps, handle, decal; side windows with rubber surrounds
  for (const s of [1, -1]) {
    const winShape = new THREE.Shape();
    // shape x runs rearward from the A-pillar (z decreasing)
    const zf = 4.34, zr = 3.3, y0 = 2.5, y1 = 3.34;
    const X = (z) => s * (zf - z); // shape x runs rearward on the left, forward on the right
    winShape.moveTo(X(zf - 0.02), y0);
    winShape.lineTo(X(zr), y0);
    winShape.lineTo(X(zr), y1);
    winShape.lineTo(X(zf - (y1 - y0) * RIG.frontSlope - 0.08), y1);
    winShape.closePath();
    const place = (out) => {
      const m = new THREE.Matrix4().compose(
        _p.set(s * (RIG.cabHalfW + out), 0, zf),
        _q.setFromEuler(_e.set(0, s * Math.PI / 2, 0)),
        _s.set(1, 1, 1),
      );
      return m;
    };
    b.add(M.rubber, new THREE.ShapeGeometry(winShape), place(0.003));
    const inner = new THREE.Shape();
    inner.moveTo(X(zf - 0.05), y0 + 0.035);
    inner.lineTo(X(zr + 0.035), y0 + 0.035);
    inner.lineTo(X(zr + 0.035), y1 - 0.035);
    inner.lineTo(X(zf - (y1 - y0) * RIG.frontSlope - 0.1), y1 - 0.035);
    inner.closePath();
    b.add(M.glass, new THREE.ShapeGeometry(inner), place(0.006));

    // Panel gaps (door outline) and the rear sleeper-panel joint
    const gap = (w, h, z, y) => b.add(M.rubber, rbox(0.006, h, w, 0.002), T(s * (RIG.cabHalfW + 0.001), y, z));
    gap(0.012, 2.1, 3.26, 2.3);
    gap(0.012, 0.9, 4.42, 1.75);
    gap(1.18, 0.012, 3.85, 1.27);
    b.add(M.plastic, rbox(0.03, 0.05, 0.2, 0.012), T(s * (RIG.cabHalfW + 0.012), 2.38, 3.42));
    // Door decal (reads left-to-right from outside on both sides)
    const decal = new THREE.PlaneGeometry(0.98, 0.49);
    b.add(M.doorDecal, decal, T(s * (RIG.cabHalfW + 0.004), 1.86, 3.82, 0, s * Math.PI / 2, 0));

    // Mirrors: arm, main mirror, wide-angle mirror, glass facing rearward
    b.add(M.plastic, tube([[s * 1.2, 3.34, 4.36], [s * 1.46, 3.44, 4.46], [s * 1.62, 3.3, 4.42]], 0.022, 16, 8));
    b.add(M.plastic, tube([[s * 1.2, 2.1, 4.3], [s * 1.42, 2.22, 4.4], [s * 1.6, 2.3, 4.4]], 0.02, 16, 8));
    b.add(M.plastic, rbox(0.1, 0.5, 0.2, 0.04, 3), T(s * 1.64, 2.95, 4.4));
    b.add(M.plastic, rbox(0.1, 0.24, 0.18, 0.04, 3), T(s * 1.63, 2.5, 4.4));
    b.add(M.mirror, new THREE.PlaneGeometry(0.075, 0.44), T(s * 1.64, 2.95, 4.297, 0, Math.PI, 0));
    b.add(M.mirror, new THREE.PlaneGeometry(0.075, 0.2), T(s * 1.63, 2.5, 4.307, 0, Math.PI, 0));

    // Entry steps behind the front wheel, grab handle beside the door
    b.add(M.plastic, rbox(0.14, 0.78, 0.52, 0.04), T(s * 1.14, 0.84, 2.72));
    for (const y of [0.56, 0.9]) {
      b.add(M.aluBrushed, rbox(0.2, 0.035, 0.46, 0.012), T(s * 1.17, y, 2.72));
    }
    b.add(M.chrome, tube([[s * 1.27, 1.55, 2.98], [s * 1.3, 2.1, 2.98], [s * 1.27, 2.65, 2.98]], 0.018, 12, 8));

    // Front wheel arch (liner and a painted flare)
    const arch = new THREE.CylinderGeometry(0.64, 0.64, 0.4, 32, 1, true, Math.PI * 0.05, Math.PI * 0.9);
    arch.rotateZ(Math.PI / 2);
    const archMat = M.plastic.clone();
    archMat.side = THREE.DoubleSide;
    withAtmosphere(archMat);
    b.add(archMat, arch, T(s * 1.02, RIG.wheelR, RIG.frontAxle));

    // Cab extenders (air deflectors bridging to the trailer)
    b.add(M.paint, rbox(0.045, 2.3, 0.56, 0.02), T(s * 1.215, 2.62, RIG.cabBack - 0.26));
  }

  // Roof marker lights and roof air deflector
  for (let i = 0; i < 5; i++) b.add(M.amber, rbox(0.12, 0.05, 0.05, 0.015), T(-0.6 + i * 0.3, RIG.cabTop + 0.02, frontZ(RIG.cabTop) - 0.12));
  const def = new THREE.Shape();
  def.moveTo(-4.2, RIG.cabTop - 0.02);
  def.quadraticCurveTo(-3.55, RIG.cabTop + 0.2, -2.9, 4.04);
  def.lineTo(-(RIG.cabBack + 0.04), 4.06);
  def.lineTo(-(RIG.cabBack + 0.04), RIG.cabTop - 0.02);
  def.closePath();
  const defGeo = new THREE.ExtrudeGeometry(def, { depth: 2.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4, curveSegments: 16 });
  defGeo.rotateY(Math.PI / 2); // shape x -> -z (so our z), extrusion -> +x
  defGeo.translate(-1.05, 0, 0);
  b.add(M.paint, defGeo);
}

function buildChassis(b, M) {
  // Frame rails and cross members
  for (const s of [1, -1]) b.add(M.chassis, rbox(0.1, 0.3, 6.5, 0.01), T(s * 0.43, 0.88, 1.2));
  for (const z of [4.2, 2.6, 1.2, -0.12, -1.4]) b.add(M.chassis, rbox(0.78, 0.18, 0.12, 0.01), T(0, 0.86, z));
  // Fuel tank (left) with straps, D-profile
  const d = new THREE.Shape();
  d.moveTo(0, 0);
  d.lineTo(0.42, 0);
  d.absarc(0.42, 0.3, 0.3, -Math.PI / 2, Math.PI / 2, false);
  d.lineTo(0, 0.6);
  d.closePath();
  const tank = new THREE.ExtrudeGeometry(d, { depth: 1.35, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 20 });
  tank.translate(0, 0, -0.675);
  b.add(M.aluBrushed, tank, T(0.52, 0.46, 1.72));
  for (const z of [1.3, 2.14]) {
    const strap = new THREE.TorusGeometry(0.335, 0.012, 6, 24, Math.PI);
    strap.rotateZ(-Math.PI / 2); // wrap the rounded outer side
    b.add(M.chassis, strap, T(0.94, 0.76, z));
  }
  // Battery box, AdBlue tank, air tanks (right)
  b.add(M.plastic, rbox(0.62, 0.52, 0.86, 0.04), T(-0.86, 0.8, 1.9));
  b.add(M.white, rbox(0.4, 0.44, 0.42, 0.08), T(-0.8, 0.74, 1.2));
  for (const z of [0.95, 2.6]) b.add(M.darkMetal, cylZ(0.13, 0.9, 20), T(-0.1, 0.62, z));
  // Fifth wheel
  b.add(M.chassis, rbox(1.0, 0.1, 1.2, 0.02), T(0, 1.07, RIG.fifthWheel));
  b.add(M.darkMetal, new THREE.CylinderGeometry(0.46, 0.46, 0.09, 36), T(0, 1.16, RIG.fifthWheel));
  // Rear mudguards, mud flaps, light bar
  for (const s of [1, -1]) {
    b.add(M.plastic, rbox(0.64, 0.05, 2.7, 0.02), T(s * 0.93, 1.12, (RIG.rearAxles[0] + RIG.rearAxles[1]) / 2));
    b.add(M.rubber, rbox(0.6, 0.55, 0.025, 0.01), T(s * 0.93, 0.62, RIG.rearAxles[1] - 0.66));
    b.add(M.plastic, rbox(0.56, 0.16, 0.12, 0.02), T(s * 0.9, 0.9, -1.92));
    b.add(M.tail, rbox(0.22, 0.1, 0.03, 0.01), T(s * 1.0, 0.9, -1.99));
    b.add(M.amber, rbox(0.1, 0.1, 0.03, 0.01), T(s * 0.8, 0.9, -1.99));
  }
  // Coiled air lines and the electrical cable to the trailer
  const coil = (x, color) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const z = RIG.cabBack - 0.05 - t * 0.92;
      const sag = Math.sin(t * Math.PI) * 0.28;
      const a = t * Math.PI * 16;
      pts.push([x + Math.cos(a) * 0.035, 2.55 - sag + Math.sin(a) * 0.035, z]);
    }
    b.add(color, tube(pts, 0.009, 240, 6));
  };
  coil(-0.15, M.hoseRed);
  coil(0.02, M.hoseYellow);
  coil(0.19, M.plastic);
}

// ------------------------------------------------------------------ trailer
// The roof decal stops just inside the shell's rounded edges (0.035 m radius)
const ROOF_SPAN = 1 - 0.07 / (RIG.trailerFront - RIG.trailerRear);
function buildTrailer(b, M, tBody) {
  const L = RIG.trailerFront - RIG.trailerRear;
  const zc = (RIG.trailerFront + RIG.trailerRear) / 2;
  const H = RIG.trailerTop - RIG.trailerBottom;
  const yc = RIG.trailerBottom + H / 2;
  // Box: materials per face (+x, -x, +y, -y, +z, -z). UVs are planar per
  // face so the livery maps exactly (canvas left = front on the left side).
  const shellGeo = new RoundedBoxGeometry(2.55, H, L, 2, 0.035);
  shellGeo.translate(0, yc, zc);
  const sp = shellGeo.attributes.position;
  const su = shellGeo.attributes.uv;
  shellGeo.groups.forEach((g, face) => {
    for (let i = g.start; i < g.start + g.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      const v = (y - RIG.trailerBottom) / H;
      if (face === 0) su.setXY(i, (RIG.trailerFront - z) / L, v);
      else if (face === 1) su.setXY(i, (z - RIG.trailerRear) / L, v);
      else if (face === 5) su.setXY(i, (1.275 - x) / 2.55, v);
    }
  });
  shellGeo.translate(0, -yc, -zc);
  const shell = new THREE.Mesh(shellGeo, [M.sideL, M.sideR, M.white, M.chassis, M.white, M.rear]);
  shell.position.set(0, yc, zc);
  shell.castShadow = shell.receiveShadow = true;
  tBody.add(shell);
  // Roof decal (canvas x runs front -> rear; canvas top faces the truck's right)
  const roofGeo = new THREE.PlaneGeometry(L * ROOF_SPAN, 2.48);
  roofGeo.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  roofGeo.rotateY(Math.PI);
  const roof = new THREE.Mesh(roofGeo, M.roofDecal);
  roof.position.set(0, RIG.trailerTop + 0.004, zc);
  roof.receiveShadow = true;
  tBody.add(roof);

  // Aluminium rails and corner posts
  for (const s of [1, -1]) {
    b.add(M.alu, rbox(0.05, 0.1, L + 0.02, 0.015), T(s * 1.27, RIG.trailerTop - 0.04, zc));
    b.add(M.alu, rbox(0.06, 0.16, L + 0.02, 0.015), T(s * 1.27, RIG.trailerBottom + 0.06, zc));
    for (const z of [RIG.trailerFront - 0.02, RIG.trailerRear + 0.02]) b.add(M.alu, rbox(0.06, H, 0.06, 0.015), T(s * 1.26, yc, z));
    // Side marker lamps along the bottom rail, yellow contour tape
    for (let z = RIG.trailerFront - 0.6; z > RIG.trailerRear + 0.4; z -= 2.2) b.add(M.amber, rbox(0.03, 0.06, 0.1, 0.01), T(s * 1.305, RIG.trailerBottom + 0.06, z));
  }
  // Rear frame, door hinges and locking bars
  const rz = RIG.trailerRear - 0.003;
  b.add(M.alu, rbox(2.55, 0.1, 0.06, 0.015), T(0, RIG.trailerTop - 0.05, rz));
  b.add(M.alu, rbox(2.55, 0.16, 0.08, 0.02), T(0, RIG.trailerBottom + 0.05, rz));
  for (const x of [0.36, 0.86, -0.36, -0.86]) {
    b.add(M.alu, new THREE.CylinderGeometry(0.018, 0.018, H * 0.9, 10), T(x, yc, rz - 0.03));
    for (const y of [RIG.trailerBottom + 0.35, RIG.trailerTop - 0.35]) b.add(M.alu, rbox(0.1, 0.06, 0.05, 0.01), T(x, y, rz - 0.035));
    b.add(M.chassis, rbox(0.12, 0.05, 0.05, 0.01), T(x, yc - 0.3, rz - 0.05));
  }
  for (const s of [1, -1]) {
    for (const y of [RIG.trailerBottom + 0.4, yc, RIG.trailerTop - 0.4]) b.add(M.chassis, rbox(0.14, 0.08, 0.05, 0.01), T(s * 1.2, y, rz - 0.03));
  }

  // Chassis beams, landing legs, side guards, toolbox, spare wheel
  for (const s of [1, -1]) b.add(M.chassis, rbox(0.12, 0.3, L - 0.6, 0.01), T(s * 0.45, RIG.trailerBottom - 0.16, zc - 0.2));
  for (let z = RIG.trailerFront - 0.6; z > RIG.trailerRear + 0.5; z -= 1.4) b.add(M.chassis, rbox(0.9, 0.12, 0.1, 0.01), T(0, RIG.trailerBottom - 0.1, z));
  for (const s of [1, -1]) {
    b.add(M.aluBrushed, rbox(0.12, 0.92, 0.12, 0.02), T(s * 0.9, 0.78, -1.9));
    b.add(M.chassis, rbox(0.34, 0.05, 0.34, 0.02), T(s * 0.9, 0.3, -1.9));
    for (const y of [0.6, 0.92]) b.add(M.alu, rbox(0.04, 0.1, 4.9, 0.015), T(s * 1.2, y, -4.65));
    for (const z of [-2.4, -4.6, -6.9]) b.add(M.alu, rbox(0.04, 0.46, 0.05, 0.01), T(s * 1.2, 0.95, z));
  }
  b.add(M.chassis, rbox(0.22, 0.05, 0.05, 0.01), T(1.02, 0.9, -1.9));
  b.add(M.plastic, rbox(0.5, 0.5, 0.9, 0.04), T(-0.85, 0.95, -3.4));
  // Mudguards and flaps over the tri-axle, rear underrun bar, rear lamps
  const axC = RIG.trailerAxles[1];
  for (const s of [1, -1]) {
    b.add(M.plastic, rbox(0.66, 0.05, 4.1, 0.02), T(s * 0.93, 1.13, axC));
    b.add(M.rubber, rbox(0.62, 0.52, 0.025, 0.01), T(s * 0.93, 0.62, RIG.trailerAxles[2] - 0.72));
    b.add(M.chassis, rbox(0.1, 0.5, 0.1, 0.01), T(s * 0.7, 0.78, RIG.trailerRear + 0.2));
    b.add(M.plastic, rbox(0.46, 0.18, 0.1, 0.02), T(s * 0.92, 1.05, RIG.trailerRear + 0.06));
    b.add(M.tail, rbox(0.2, 0.12, 0.03, 0.01), T(s * 1.0, 1.05, RIG.trailerRear + 0.005));
    b.add(M.amber, rbox(0.1, 0.12, 0.03, 0.01), T(s * 0.78, 1.05, RIG.trailerRear + 0.005));
    b.add(M.tail, rbox(0.1, 0.05, 0.03, 0.01), T(s * 1.16, RIG.trailerTop - 0.1, RIG.trailerRear - 0.02));
  }
  b.add(M.aluBrushed, rbox(2.3, 0.12, 0.12, 0.02), T(0, 0.56, RIG.trailerRear + 0.2));
  b.add(M.reflectorRed, rbox(2.2, 0.05, 0.02, 0.005), T(0, 0.56, RIG.trailerRear + 0.135));
}

// ------------------------------------------------------------------ assemble
export function createTruck(renderer, tex) {
  const T2 = {
    ...tex,
    sideL: Liv.trailerSide(renderer, { frontAt: 'left' }),
    sideR: Liv.trailerSide(renderer, { frontAt: 'right' }),
    rear: Liv.trailerRear(renderer),
    roof: Liv.trailerRoof(renderer, { span: ROOF_SPAN }),
    door: Liv.doorDecal(renderer),
    visor: Liv.visorDecal(renderer),
    badge: Liv.badge(renderer),
    plate: Liv.numberPlate(renderer),
    rimBlur: rimBlurTexture(renderer),
    screen: screenTexture(renderer),
  };
  const M = createMaterials(T2, renderer);

  const tractor = new THREE.Group();
  tractor.name = 'tractor';
  const body = new THREE.Group(); // sprung mass: cab + chassis
  tractor.add(body);
  const b = new Builder();
  buildCab(b, M);
  buildChassis(b, M);
  b.build(body);

  const trailer = new THREE.Group();
  trailer.name = 'trailer';
  const tBody = new THREE.Group();
  trailer.add(tBody);
  const tb = new Builder();
  buildTrailer(tb, M, tBody);
  tb.build(tBody);

  // ---------------------------------------------------------------- wheels
  const single = wheelVariant(false);
  const dual = wheelVariant(true);
  const slots = []; // { parent, x, z, side, variant }
  for (const s of [1, -1]) {
    slots.push({ parent: tractor, x: s * 1.06, z: RIG.frontAxle, side: s, dual: false });
    for (const z of RIG.rearAxles) slots.push({ parent: tractor, x: s * 0.935, z, side: s, dual: true });
    for (const z of RIG.trailerAxles) slots.push({ parent: trailer, x: s * 0.935, z, side: s, dual: true });
  }
  const matFor = { tyre: M.tyre, alu: M.alu, chrome: M.chrome, darkMetal: M.darkMetal, blur: M.blur };
  const wheelMeshes = [];
  for (const [variant, isDual] of [[single, false], [dual, true]]) {
    const mine = slots.filter((w) => w.dual === isDual);
    for (const [k, geo] of Object.entries(variant)) {
      const im = new THREE.InstancedMesh(geo, matFor[k], mine.length);
      im.castShadow = k !== 'blur';
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.userData.slots = mine;
      wheelMeshes.push(im);
    }
  }
  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'wheels';
  wheelMeshes.forEach((m) => wheelGroup.add(m));

  const wm = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const rot = new THREE.Matrix4();
  const mir = new THREE.Matrix4();
  function updateWheels(roll, spin) {
    tractor.updateMatrixWorld();
    trailer.updateMatrixWorld();
    for (const im of wheelMeshes) {
      im.userData.slots.forEach((w, i) => {
        local.makeTranslation(w.x, RIG.wheelR, w.z);
        rot.makeRotationX(roll);
        mir.makeScale(w.side, 1, 1);
        wm.copy(w.parent.matrixWorld).multiply(local).multiply(rot).multiply(mir);
        im.setMatrixAt(i, wm);
      });
      im.instanceMatrix.needsUpdate = true;
    }
    // Rim blur fades in with wheel speed (rad/s)
    M.blur.opacity = THREE.MathUtils.smoothstep(spin, 6, 26) * 0.95;
  }

  // ---------------------------------------------------------------- light fx
  const glowMat = new THREE.SpriteMaterial({ map: tex.glow, color: 0xfff3dc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  const streakMat = new THREE.SpriteMaterial({ map: tex.streak, color: 0xffe9c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  const tailGlowMat = new THREE.SpriteMaterial({ map: tex.glow, color: 0xff3a22, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  for (const s of [1, -1]) {
    const g = new THREE.Sprite(glowMat);
    g.scale.set(1.3, 1.3, 1);
    g.position.set(s * 0.88, 1.37, frontZ(1.37) + 0.14);
    body.add(g);
    const st = new THREE.Sprite(streakMat);
    st.scale.set(4.2, 0.36, 1);
    st.position.set(s * 0.88, 1.37, frontZ(1.37) + 0.16);
    body.add(st);
    const t = new THREE.Sprite(tailGlowMat);
    t.scale.set(0.9, 0.9, 1);
    t.position.set(s * 1.0, 1.05, RIG.trailerRear - 0.12);
    tBody.add(t);
  }
  const beamMat = new THREE.MeshBasicMaterial({
    map: tex.beam, color: 0xffe7c4, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  });
  const beamGeo = new THREE.PlaneGeometry(12, 34);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.rotateY(Math.PI);
  beamGeo.translate(0, 0.07, 4.8 + 17);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  tractor.add(beam);

  // v: lights on (0..1); front/rear: how directly the lamps face the camera
  function setLights(v, front = 1, rear = 1) {
    M.head.emissiveIntensity = 14 * v;
    M.drl.emissiveIntensity = 10 * v;
    M.tail.emissiveIntensity = 7 * v;
    M.amber.emissiveIntensity = 5 * v;
    glowMat.opacity = 0.55 * v * Math.pow(front, 0.7);
    streakMat.opacity = 0.35 * v * front * front;
    tailGlowMat.opacity = 0.6 * v * Math.pow(rear, 0.7);
    beamMat.opacity = 0.035 * v;
  }
  setLights(0);

  return {
    tractor,
    trailer,
    wheelGroup,
    body,
    trailerBody: tBody,
    updateWheels,
    setLights,
    materials: M,
    // Cab bounding box in tractor space, used to aim the HUD at the driver
    cabBox: new THREE.Box3(new THREE.Vector3(-1.3, 1.05, RIG.cabBack - 0.1), new THREE.Vector3(1.3, 4.05, 4.82)),
  };
}
