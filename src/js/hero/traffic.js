// A handful of cars: oncoming traffic on the far carriageway and one or two
// overtaking the truck. Positions derive from the truck's travel so the whole
// scene scrubs forwards and backwards with the scroll.
import * as THREE from 'three';
import { ROAD } from './road.js';

function carBodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.25, 0.32);
  s.lineTo(2.1, 0.32);
  s.quadraticCurveTo(2.3, 0.34, 2.3, 0.6);
  s.quadraticCurveTo(2.28, 0.84, 1.9, 0.9);
  s.lineTo(1.05, 0.98);
  s.lineTo(0.35, 1.42);
  s.lineTo(-1.15, 1.44);
  s.quadraticCurveTo(-1.9, 1.3, -2.2, 1.0);
  s.quadraticCurveTo(-2.3, 0.8, -2.25, 0.32);
  return s;
}

function extrude(shape, width, bevel) {
  const depth = width - bevel * 2;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  return g;
}

export function createTraffic(path, tex) {
  const group = new THREE.Group();
  group.name = 'traffic';

  const bodyGeo = extrude(carBodyShape(), 1.8, 0.08);
  const glassShape = new THREE.Shape();
  glassShape.moveTo(1.0, 1.0); glassShape.lineTo(0.37, 1.39); glassShape.lineTo(-1.1, 1.41);
  glassShape.quadraticCurveTo(-1.75, 1.3, -1.95, 1.05); glassShape.lineTo(1.0, 1.0);
  const glassGeo = extrude(glassShape, 1.84, 0.02);
  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const lampGeo = new THREE.BoxGeometry(0.34, 0.1, 0.06);

  const glass = new THREE.MeshStandardMaterial({ color: 0x4f5b66, roughness: 0.08, metalness: 0.85, envMapIntensity: 1.3 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.9 });
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 2.4 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x400806, emissive: 0xff2616, emissiveIntensity: 2 });
  const glowHead = new THREE.SpriteMaterial({ map: tex.glow, color: 0xfff1d8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
  const glowTail = new THREE.SpriteMaterial({ map: tex.glow, color: 0xff3b24, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 });

  const paints = ['#e9e9e6', '#9aa1a8', '#2b2f36', '#8c1d1d', '#1f3b63', '#d9d6cf', '#4a4f55'];
  // lane: lateral offset; dir: +1 with the truck, -1 oncoming; offset: start arc length relative to the truck
  const plan = [
    { lane: ROAD.laneFast, dir: 1, speed: 31, offset: -70, paint: 0 },
    { lane: ROAD.laneFast, dir: 1, speed: 33, offset: -260, paint: 3 },
    { lane: -ROAD.laneFast, dir: -1, speed: 33, offset: 180, paint: 1 },
    { lane: -ROAD.laneSlow, dir: -1, speed: 26, offset: 320, paint: 2 },
    { lane: -ROAD.laneFast, dir: -1, speed: 35, offset: 560, paint: 4 },
    { lane: -ROAD.laneSlow, dir: -1, speed: 27, offset: 760, paint: 5 },
    { lane: -ROAD.laneFast, dir: -1, speed: 34, offset: 980, paint: 6 },
  ];

  const cars = plan.map((c) => {
    const car = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: paints[c.paint], roughness: 0.3, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 });
    const b = new THREE.Mesh(bodyGeo, paint);
    const g = new THREE.Mesh(glassGeo, glass);
    b.castShadow = g.castShadow = true;
    car.add(b, g);
    for (const x of [0.78, -0.78]) {
      for (const z of [1.42, -1.38]) {
        const w = new THREE.Mesh(wheelGeo, tire);
        w.position.set(x, 0.33, z);
        car.add(w);
      }
      const hl = new THREE.Mesh(lampGeo, head);
      hl.position.set(x * 0.9, 0.68, 2.29);
      const tl = new THREE.Mesh(lampGeo, tail);
      tl.position.set(x * 0.92, 0.82, -2.27);
      car.add(hl, tl);
      const hg = new THREE.Sprite(glowHead);
      hg.scale.set(1.2, 1.2, 1);
      hg.position.set(x * 0.9, 0.68, 2.45);
      const tg = new THREE.Sprite(glowTail);
      tg.scale.set(0.8, 0.8, 1);
      tg.position.set(x * 0.92, 0.82, -2.4);
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
