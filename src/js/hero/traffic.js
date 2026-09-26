// Other traffic: sedans, an SUV, a bakkie and a minibus taxi, oncoming on the
// far carriageway or overtaking the truck. Positions derive from the truck's
// travel so the whole scene scrubs forwards and backwards with the scroll.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROAD } from './road.js';
import { withAtmosphere } from './atmosphere.js';

const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

function clean(g) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  out.clearGroups();
  return out;
}

// Taper the upper half of a box into a glasshouse: narrower roof, raked
// screens front and back
function glasshouse(w, h, d, { roofW = 0.84, front = 0.62, back = 0.78, shiftZ = 0 } = {}) {
  const g = rbox(w, h, d, 0.12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h; // 0 bottom, 1 top
    const x = p.getX(i) * (1 - (1 - roofW) * t);
    let z = p.getZ(i);
    z = z > 0 ? z * (1 - (1 - front) * t) : z * (1 - (1 - back) * t);
    p.setXYZ(i, x, p.getY(i), z + shiftZ * t);
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

function wheelGeos() {
  const tyre = new THREE.CylinderGeometry(0.33, 0.33, 0.23, 20);
  tyre.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.21, 0.21, 0.235, 16);
  rim.rotateZ(Math.PI / 2);
  return { tyre, rim };
}

// Returns { paint: [...], glass: [...], dark: [...], chrome: [...], head, tail } geometry lists
function carParts(kind) {
  const P = { paint: [], glass: [], dark: [], chrome: [], head: [], tail: [], tyre: [] };
  const add = (list, g, x = 0, y = 0, z = 0) => { const c = clean(g); c.translate(x, y, z); list.push(c); };
  const W = kind === 'taxi' ? 1.9 : kind === 'suv' ? 1.88 : 1.8;
  const L = kind === 'taxi' ? 5.0 : kind === 'bakkie' ? 5.2 : kind === 'suv' ? 4.7 : 4.6;
  const wheelZ = kind === 'taxi' ? 1.55 : 1.45;
  const clear = kind === 'suv' || kind === 'bakkie' ? 0.22 : 0.16;
  if (kind === 'taxi') {
    add(P.paint, rbox(W, 1.55, L, 0.2), 0, clear + 0.95, 0);
    add(P.glass, rbox(W + 0.01, 0.55, L - 0.9, 0.12), 0, clear + 1.3, -0.2);
    add(P.glass, glasshouse(W - 0.1, 0.6, 0.4, { roofW: 0.95, front: 0.6, back: 1 }), 0, clear + 1.3, L / 2 - 0.35);
  } else if (kind === 'bakkie') {
    add(P.paint, rbox(W, 0.62, L, 0.14), 0, clear + 0.52, 0);
    add(P.glass, glasshouse(W - 0.08, 0.62, 1.95, { roofW: 0.86, front: 0.6, back: 0.94 }), 0, clear + 1.12, 0.55);
    add(P.paint, rbox(W - 0.24, 0.07, 1.25, 0.03), 0, clear + 1.45, 0.45);
    add(P.dark, rbox(W - 0.2, 0.5, 1.85, 0.03), 0, clear + 0.95, -1.5); // load bed
    add(P.paint, rbox(W, 0.52, 0.06, 0.02), 0, clear + 1.0, -L / 2 + 0.03);
  } else {
    const tall = kind === 'suv' ? 0.75 : 0.62;
    add(P.paint, rbox(W, tall, L, 0.18), 0, clear + tall / 2 + 0.22, 0);
    const gh = kind === 'suv' ? 0.62 : 0.55;
    add(P.glass, glasshouse(W - 0.08, gh, kind === 'suv' ? 2.9 : 2.5, { roofW: 0.84, front: kind === 'suv' ? 0.7 : 0.58, back: kind === 'suv' ? 0.92 : 0.66, shiftZ: -0.1 }), 0, clear + tall + 0.22 + gh / 2 - 0.02, kind === 'suv' ? -0.1 : -0.15);
    add(P.paint, rbox(W - 0.34, 0.06, kind === 'suv' ? 2.4 : 1.55, 0.03), 0, clear + tall + 0.22 + gh - 0.02, kind === 'suv' ? -0.2 : -0.25);
  }
  // Bumpers, lamps, mirrors, wheels
  add(P.dark, rbox(W + 0.02, 0.2, 0.18, 0.06), 0, clear + 0.28, L / 2 - 0.05);
  add(P.dark, rbox(W + 0.02, 0.2, 0.18, 0.06), 0, clear + 0.28, -L / 2 + 0.05);
  for (const s of [1, -1]) {
    add(P.head, rbox(0.34, 0.1, 0.06, 0.02), s * (W / 2 - 0.3), clear + 0.62, L / 2 - 0.02);
    add(P.tail, rbox(0.3, 0.12, 0.06, 0.02), s * (W / 2 - 0.25), clear + 0.72, -L / 2 + 0.02);
    add(P.dark, rbox(0.18, 0.12, 0.08, 0.03), s * (W / 2 + 0.06), clear + 1.02, L / 2 - 1.4);
    const { tyre, rim } = wheelGeos();
    for (const z of [wheelZ, -wheelZ]) {
      add(P.tyre, tyre.clone(), s * (W / 2 - 0.12), 0.33, z);
      add(P.chrome, rim.clone(), s * (W / 2 - 0.12), 0.33, z);
    }
  }
  const out = {};
  for (const [k, list] of Object.entries(P)) if (list.length) out[k] = mergeGeometries(list);
  return out;
}

export function createTraffic(path, tex) {
  const group = new THREE.Group();
  group.name = 'traffic';

  const shared = {
    glass: withAtmosphere(new THREE.MeshPhysicalMaterial({ color: 0x141b22, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 })),
    dark: withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.6 })),
    chrome: withAtmosphere(new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.3 })),
    tyre: withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x141415, roughness: 0.9 })),
    head: withAtmosphere(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 6 })),
    tail: withAtmosphere(new THREE.MeshStandardMaterial({ color: 0x400806, emissive: 0xff2616, emissiveIntensity: 5 })),
  };
  for (const k of ['head', 'tail', 'glass']) shared[k].userData.noShadow = true;
  const glowHead = new THREE.SpriteMaterial({ map: tex.glow, color: 0xfff1d8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
  const glowTail = new THREE.SpriteMaterial({ map: tex.glow, color: 0xff3b24, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 });

  const kinds = { sedan: carParts('sedan'), suv: carParts('suv'), bakkie: carParts('bakkie'), taxi: carParts('taxi') };
  const paints = ['#e6e7e8', '#9aa1a8', '#23272d', '#7d1c1c', '#1f3350', '#d5d2cb', '#4a4f55'];
  const paintMats = paints.map((c) => withAtmosphere(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 })));

  // lane: lateral offset; dir: +1 with the truck, -1 oncoming; offset: start arc length relative to the truck
  const plan = [
    { kind: 'sedan', lane: ROAD.laneFast, dir: 1, speed: 31, offset: -70, paint: 0 },
    { kind: 'suv', lane: ROAD.laneFast, dir: 1, speed: 33, offset: -260, paint: 3 },
    { kind: 'bakkie', lane: -ROAD.laneFast, dir: -1, speed: 33, offset: 180, paint: 5 },
    { kind: 'taxi', lane: -ROAD.laneSlow, dir: -1, speed: 26, offset: 320, paint: 5 },
    { kind: 'sedan', lane: -ROAD.laneFast, dir: -1, speed: 35, offset: 560, paint: 4 },
    { kind: 'suv', lane: -ROAD.laneSlow, dir: -1, speed: 27, offset: 760, paint: 1 },
    { kind: 'sedan', lane: -ROAD.laneFast, dir: -1, speed: 34, offset: 980, paint: 2 },
  ];

  const cars = plan.map((c) => {
    const car = new THREE.Group();
    const parts = kinds[c.kind];
    const mats = { paint: paintMats[c.paint], ...shared };
    for (const [k, geo] of Object.entries(parts)) {
      const m = new THREE.Mesh(geo, mats[k]);
      m.castShadow = !mats[k].userData.noShadow;
      m.receiveShadow = true;
      car.add(m);
    }
    const L = c.kind === 'taxi' ? 5.0 : c.kind === 'bakkie' ? 5.2 : 4.6;
    for (const s of [1, -1]) {
      const hg = new THREE.Sprite(glowHead);
      hg.scale.set(0.9, 0.9, 1);
      hg.position.set(s * 0.6, 0.8, L / 2 + 0.15);
      const tg = new THREE.Sprite(glowTail);
      tg.scale.set(0.6, 0.6, 1);
      tg.position.set(s * 0.65, 0.9, -L / 2 - 0.12);
      car.add(hg, tg);
    }
    group.add(car);
    return { ...c, car };
  });

  const fr = {};
  const WINDOW_BACK = 320;
  const WINDOW_AHEAD = 900;
  const span = WINDOW_BACK + WINDOW_AHEAD;

  // t: virtual seconds since the truck set off; truckS: truck arc length
  function update(truckS, t, truckStart) {
    for (const c of cars) {
      const travelled = c.dir * c.speed * t;
      let rel = truckStart + c.offset + travelled - truckS; // position relative to the truck
      rel = ((((rel + WINDOW_BACK) % span) + span) % span) - WINDOW_BACK;
      const s = truckS + rel;
      path.frameAt(s, fr);
      c.car.position.set(fr.x + fr.lx * c.lane, 0.02, fr.z + fr.lz * c.lane);
      const yaw = Math.atan2(fr.tx, fr.tz) + (c.dir < 0 ? Math.PI : 0);
      c.car.rotation.set(0, yaw, 0);
      // Hide cars right at the wrap seam so they never pop in view
      c.car.visible = rel > -WINDOW_BACK + 20 && rel < WINDOW_AHEAD - 20;
    }
  }

  return { group, update };
}
