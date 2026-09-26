// A European cab-over tractor unit and 13.6 m box trailer, modelled from
// primitives. Static parts are merged per material to keep draw calls low;
// wheels stay separate so they can turn.
//
// Local axes: +Z forward, +X left, +Y up. Tractor origin = fifth wheel on the
// ground. Trailer origin = kingpin on the ground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();

function part(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}
const box = (w, h, d, mat, x, y, z, rx, ry, rz) => part(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
function cylX(r, len, seg, mat, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return part(g, mat, x, y, z);
}
function cylZ(r, len, seg, mat, x, y, z) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return part(g, mat, x, y, z);
}

// Bake every mesh in `group` into one mesh per material (except meshes flagged
// keep = true). Keeps the scene at a few dozen draw calls.
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.keep || Array.isArray(o.material)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.clearGroups();
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    _m.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(_m);
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: o.castShadow });
    buckets.get(key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const { mat, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = !mat.userData.noShadow;
    mesh.receiveShadow = !mat.userData.noReceive;
    group.add(mesh);
  }
}

function makeWheel(r, dual, M) {
  const g = new THREE.Group();
  const tireW = dual ? 0.29 : 0.34;
  const offsets = dual ? [-0.155, 0.155] : [0];
  for (const ox of offsets) {
    const tire = cylX(r, tireW, 30, M.tire, ox, 0, 0);
    const shoulder = new THREE.TorusGeometry(r - 0.05, 0.05, 6, 30);
    shoulder.rotateY(Math.PI / 2);
    g.add(tire);
    g.add(part(shoulder, M.tire, ox + tireW / 2 - 0.02, 0, 0));
    g.add(part(shoulder.clone(), M.tire, ox - tireW / 2 + 0.02, 0, 0));
  }
  const width = dual ? 0.62 : 0.36;
  g.add(cylX(r * 0.6, width + 0.012, 24, M.rim, 0, 0, 0));
  g.add(cylX(0.13, width + 0.07, 14, M.chrome, 0, 0, 0));
  // Hand holes on both faces so rotation reads on screen
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const y = Math.cos(a) * r * 0.42;
    const z = Math.sin(a) * r * 0.42;
    for (const side of [1, -1]) {
      g.add(cylX(0.045, 0.02, 8, M.black, side * (width / 2 + 0.008), y, z));
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function cabShape() {
  const s = new THREE.Shape();
  s.moveTo(2.25, 1.12);
  s.lineTo(4.5, 1.12);
  s.quadraticCurveTo(4.6, 1.12, 4.6, 1.24);
  s.lineTo(4.6, 2.3);
  s.lineTo(4.46, 3.3);
  s.quadraticCurveTo(4.42, 3.56, 4.16, 3.58);
  s.lineTo(2.4, 3.58);
  s.quadraticCurveTo(2.25, 3.58, 2.25, 3.43);
  s.lineTo(2.25, 1.12);
  return s;
}

function fairingShape() {
  const s = new THREE.Shape();
  s.moveTo(3.95, 3.56);
  s.quadraticCurveTo(3.5, 3.6, 3.2, 3.9);
  s.lineTo(2.34, 3.98);
  s.quadraticCurveTo(2.28, 3.98, 2.28, 3.9);
  s.lineTo(2.28, 3.56);
  s.lineTo(3.95, 3.56);
  return s;
}

function extrudeAcross(shape, width, bevel = 0.07, curveSegments = 10) {
  const depth = width - bevel * 2;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 4, curveSegments, steps: 1,
  });
  g.rotateY(-Math.PI / 2); // shape u -> +Z, extrusion -> -X
  g.translate(depth / 2, 0, 0);
  return g;
}

export function createTruck(tex) {
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xf5b300, roughness: 0.38, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x55616d, roughness: 0.07, metalness: 0.85, envMapIntensity: 1.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.75 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8dce1, roughness: 0.18, metalness: 1 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.32, metalness: 0.85 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x121213, roughness: 0.94 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.35, metalness: 0.75 }),
    white: new THREE.MeshStandardMaterial({ color: 0xefeee9, roughness: 0.5, metalness: 0.05 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 0, roughness: 0.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x5a0d08, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.3 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x6b4300, emissive: 0xffa21a, emissiveIntensity: 0, roughness: 0.3 }),
    badge: new THREE.MeshStandardMaterial({ map: tex.badge, roughness: 0.4, metalness: 0.2 }),
    arch: new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.75, side: THREE.DoubleSide }),
  };
  for (const k of ['head', 'tail', 'amber', 'glass']) M[k].userData.noShadow = true;

  // =============================================================== tractor
  const tractor = new THREE.Group();
  tractor.name = 'tractor';
  const body = new THREE.Group(); // sprung mass: cab + chassis
  tractor.add(body);

  body.add(part(extrudeAcross(cabShape(), 2.5), M.paint));
  body.add(part(extrudeAcross(fairingShape(), 2.36, 0.05), M.paint));
  // Side fairings bridging the cab to the trailer
  for (const s of [1, -1]) body.add(box(0.05, 2.0, 0.55, M.paint, s * 1.2, 2.55, 2.0));

  // Glazing
  const ws = new THREE.PlaneGeometry(2.24, 0.98);
  body.add(part(ws, M.glass, 0, 2.82, 4.605, -0.139));
  const win = new THREE.Shape();
  win.moveTo(3.5, 2.44); win.lineTo(4.46, 2.44); win.lineTo(4.34, 3.26); win.lineTo(3.5, 3.26); win.closePath();
  const winGeo = new THREE.ShapeGeometry(win);
  winGeo.rotateY(-Math.PI / 2);
  const glassDouble = M.glass.clone();
  glassDouble.side = THREE.DoubleSide;
  glassDouble.userData.noShadow = true;
  body.add(part(winGeo, glassDouble, -1.254, 0, 0));
  body.add(part(winGeo.clone(), glassDouble, 1.254, 0, 0));

  // Driver silhouette on the right (South African trucks are right-hand drive)
  const driver = new THREE.Group();
  driver.add(part(new THREE.SphereGeometry(0.13, 12, 10), M.black, 0, 0.36, 0));
  driver.add(box(0.44, 0.5, 0.3, M.black, 0, 0.0, -0.04));
  driver.position.set(-0.62, 2.62, 3.72);
  body.add(driver);

  // Front end
  body.add(box(1.92, 0.94, 0.05, M.plastic, 0, 1.78, 4.665));
  for (let i = 0; i < 5; i++) body.add(box(1.82, 0.05, 0.04, M.chrome, 0, 1.42 + i * 0.17, 4.69));
  body.add(part(new THREE.CircleGeometry(0.17, 28), M.badge, 0, 1.78, 4.715));
  body.add(box(2.46, 0.4, 0.34, M.black, 0, 0.96, 4.58));
  body.add(box(2.1, 0.08, 0.1, M.chrome, 0, 1.2, 4.75));
  body.add(box(2.34, 0.07, 0.36, M.black, 0, 3.42, 4.62, 0.26));
  for (const s of [1, -1]) {
    body.add(box(0.5, 0.2, 0.06, M.chrome, s * 0.92, 1.37, 4.69));
    body.add(box(0.44, 0.15, 0.05, M.head, s * 0.92, 1.37, 4.72));
    // Mirrors
    body.add(box(0.36, 0.04, 0.05, M.black, s * 1.42, 3.0, 4.34));
    body.add(box(0.1, 0.52, 0.24, M.black, s * 1.62, 2.76, 4.3));
    body.add(box(0.1, 0.26, 0.2, M.black, s * 1.58, 2.3, 4.34));
    body.add(box(0.08, 0.5, 0.05, M.black, s * 1.34, 2.72, 4.36));
    // Steps + door handle + seam
    body.add(box(0.26, 0.05, 0.52, M.black, s * 1.17, 0.74, 3.86));
    body.add(box(0.26, 0.05, 0.52, M.black, s * 1.17, 0.44, 3.86));
    body.add(box(0.02, 0.06, 0.22, M.black, s * 1.26, 2.2, 3.62));
    body.add(box(0.012, 2.1, 0.02, M.black, s * 1.253, 2.28, 3.42));
    // Wheel arch
    const arch = new THREE.CylinderGeometry(0.64, 0.64, 0.4, 20, 1, true, 0, Math.PI);
    arch.rotateZ(Math.PI / 2);
    body.add(part(arch, M.arch, s * 1.06, 0.52, 3.55));
  }
  // Cab roof marker lights
  for (let i = 0; i < 5; i++) {
    body.add(box(0.1, 0.05, 0.05, M.amber, -0.6 + i * 0.3, 3.63, 4.3));
  }
  // Wipers
  body.add(box(0.9, 0.03, 0.03, M.black, 0.45, 2.34, 4.66, 0, 0, 0.12));
  body.add(box(0.9, 0.03, 0.03, M.black, -0.5, 2.34, 4.66, 0, 0, 0.12));

  // Chassis
  for (const s of [1, -1]) body.add(box(0.12, 0.3, 6.0, M.black, s * 0.45, 0.9, 1.4));
  body.add(cylZ(0.33, 1.3, 20, M.alu, 1.0, 0.86, 1.86));
  body.add(cylZ(0.2, 0.6, 16, M.white, -1.0, 0.82, 1.47));
  body.add(box(0.5, 0.46, 0.9, M.black, -0.98, 0.84, 2.22));
  body.add(part(new THREE.CylinderGeometry(0.52, 0.52, 0.1, 24), M.black, 0, 1.13, 0.1));
  for (const s of [1, -1]) {
    body.add(box(0.66, 0.05, 2.55, M.black, s * 0.95, 1.11, -0.05));
    body.add(box(0.56, 0.46, 0.02, M.black, s * 0.95, 0.66, -1.42));
    body.add(box(0.18, 0.1, 0.05, M.tail, s * 0.95, 0.82, -1.5));
  }

  mergeByMaterial(body);

  const tractorWheels = [];
  const addWheel = (group, list, r, dual, x, z) => {
    const w = makeWheel(r, dual, M);
    w.position.set(x, r, z);
    group.add(w);
    list.push(w);
  };
  for (const s of [1, -1]) {
    addWheel(tractor, tractorWheels, 0.52, false, s * 1.06, 3.55);
    addWheel(tractor, tractorWheels, 0.52, true, s * 0.93, 0.62);
    addWheel(tractor, tractorWheels, 0.52, true, s * 0.93, -0.72);
  }

  // =============================================================== trailer
  const trailer = new THREE.Group();
  trailer.name = 'trailer';
  const tBody = new THREE.Group();
  trailer.add(tBody);

  const sideL = new THREE.MeshStandardMaterial({ map: tex.sideLeft, roughness: 0.5, metalness: 0.05 });
  const sideR = new THREE.MeshStandardMaterial({ map: tex.sideRight, roughness: 0.5, metalness: 0.05 });
  const rear = new THREE.MeshStandardMaterial({ map: tex.rear, roughness: 0.5, metalness: 0.05 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.75, 13.6), [sideL, sideR, M.white, M.black, M.white, rear]);
  shell.position.set(0, 2.625, -5.6);
  shell.castShadow = true;
  shell.receiveShadow = true;
  tBody.add(shell);

  // Roof decal (plane mapped so canvas x runs rear -> front)
  const roofGeo = new THREE.PlaneGeometry(13.6, 2.55);
  roofGeo.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
  roofGeo.rotateY(Math.PI); // canvas x: front -> rear; canvas top: truck's right
  const roofMat = new THREE.MeshStandardMaterial({
    map: tex.roof, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 4.003, -5.6);
  roof.receiveShadow = true;
  roof.userData.keep = true;
  tBody.add(roof);

  // Front reefer unit
  tBody.add(box(1.9, 1.05, 0.36, M.white, 0, 3.2, 1.38));
  tBody.add(box(1.4, 0.6, 0.02, M.plastic, 0, 3.22, 1.57));
  // Chassis, landing gear, side guards, rear bar
  for (const s of [1, -1]) {
    tBody.add(box(0.18, 0.26, 13.2, M.black, s * 0.46, 1.12, -5.6));
    tBody.add(box(0.12, 0.86, 0.12, M.alu, s * 0.88, 0.8, -1.9));
    tBody.add(box(0.3, 0.05, 0.3, M.black, s * 0.88, 0.36, -1.9));
    tBody.add(box(0.04, 0.12, 6.2, M.alu, s * 1.22, 0.72, -5.2));
    tBody.add(box(0.04, 0.5, 0.06, M.alu, s * 1.22, 0.96, -2.4));
    tBody.add(box(0.04, 0.5, 0.06, M.alu, s * 1.22, 0.96, -8.1));
    tBody.add(box(0.66, 0.05, 4.3, M.black, s * 0.93, 1.07, -10.6));
    tBody.add(box(0.56, 0.44, 0.02, M.black, s * 0.93, 0.62, -12.72));
    tBody.add(box(0.36, 0.2, 0.05, M.tail, s * 1.0, 0.98, -12.43));
    tBody.add(box(0.12, 0.06, 0.04, M.tail, s * 1.16, 3.96, -12.42));
    for (let z = 0.4; z > -12; z -= 2.5) tBody.add(box(0.03, 0.06, 0.12, M.amber, s * 1.283, 1.32, z));
  }
  tBody.add(box(2.3, 0.14, 0.12, M.alu, 0, 0.56, -12.36));
  tBody.add(box(0.14, 0.14, 0.3, M.alu, 0.8, 0.7, -12.2));
  tBody.add(box(0.14, 0.14, 0.3, M.alu, -0.8, 0.7, -12.2));

  mergeByMaterial(tBody);

  const trailerWheels = [];
  for (const s of [1, -1]) {
    for (const z of [-9.3, -10.6, -11.9]) addWheel(trailer, trailerWheels, 0.5, true, s * 0.93, z);
  }

  // =============================================================== light fx
  const glowMat = new THREE.SpriteMaterial({
    map: tex.glow, color: 0xfff0d2, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
  });
  const streakMat = new THREE.SpriteMaterial({
    map: tex.streak, color: 0xffe2b8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
  });
  const tailGlowMat = new THREE.SpriteMaterial({
    map: tex.glow, color: 0xff3a22, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
  });
  const glows = [];
  for (const s of [1, -1]) {
    const g = new THREE.Sprite(glowMat);
    g.scale.set(1.9, 1.9, 1);
    g.position.set(s * 0.92, 1.37, 4.78);
    body.add(g);
    const st = new THREE.Sprite(streakMat);
    st.scale.set(5.5, 0.5, 1);
    st.position.set(s * 0.92, 1.37, 4.8);
    body.add(st);
    const t = new THREE.Sprite(tailGlowMat);
    t.scale.set(1.1, 1.1, 1);
    t.position.set(s * 1.0, 0.98, -12.55);
    tBody.add(t);
    glows.push(g, st, t);
  }

  const beamMat = new THREE.MeshBasicMaterial({
    map: tex.beam, color: 0xffe7c4, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  });
  const beamGeo = new THREE.PlaneGeometry(12, 34);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.rotateY(Math.PI); // canvas top (far end of the beam) points forward
  beamGeo.translate(0, 0.07, 4.7 + 17);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  tractor.add(beam);

  // v: lights on (0..1); front/rear: how directly the lamps face the camera
  function setLights(v, front = 1, rear = 1) {
    M.head.emissiveIntensity = 3.2 * v;
    M.tail.emissiveIntensity = 2.2 * v;
    M.amber.emissiveIntensity = 2.4 * v;
    glowMat.opacity = 0.95 * v * Math.pow(front, 0.7);
    streakMat.opacity = 0.55 * v * front * front;
    tailGlowMat.opacity = 0.8 * v * Math.pow(rear, 0.7);
    beamMat.opacity = 0.26 * v;
  }
  setLights(0);

  return {
    tractor,
    trailer,
    body,
    trailerBody: tBody,
    wheels: [...tractorWheels, ...trailerWheels],
    setLights,
    // Cab bounding box in tractor space, used to aim the HUD at the driver
    cabBox: new THREE.Box3(new THREE.Vector3(-1.3, 1.05, 2.2), new THREE.Vector3(1.3, 4.0, 4.72)),
  };
}
