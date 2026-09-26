// Builds the world and exposes a tiny API the scroll timeline drives:
//   world.update(rig, dt, time) -> places truck, traffic, camera, light
//   world.render()
import * as THREE from 'three';
import { createRoadPath, createRoadMeshes, ROAD } from './road.js';
import { createHeightField, createTerrain, createVegetation, createFarmland, addCloudShadows } from './terrain.js';
import { createSky, SUN_DIR } from './sky.js';
import { createTruck } from './truck.js';
import { createTraffic } from './traffic.js';
import * as T from './textures.js';
import { clamp, lerp, smoothstep } from './noise.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const pause = () => new Promise((r) => setTimeout(r, 16));

export const TRUCK_SPEED = 22; // m/s, used to convert travel into "virtual seconds"
export const DRIVE_DISTANCE = 480; // metres covered over the whole hero scroll

export async function createWorld(canvas, quality, onProgress = () => {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(quality.dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x0d0f12, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 5200);

  const tex = {
    asphalt: T.asphaltTexture(renderer),
    gravel: T.gravelTexture(renderer),
    grass: T.grassTexture(renderer),
    sideLeft: T.trailerSideTexture(renderer, { frontLeft: true }),
    sideRight: T.trailerSideTexture(renderer, { frontLeft: false }),
    roof: T.trailerRoofTexture(renderer),
    rear: T.trailerRearTexture(renderer),
    badge: T.badgeTexture(renderer),
    glow: T.glowTexture(renderer),
    streak: T.streakTexture(renderer),
    beam: T.beamTexture(renderer),
    cloud: T.cloudTexture(renderer),
  };
  onProgress(0.3);
  await pause();

  const path = createRoadPath();
  const height = createHeightField(path);
  const cloudUniforms = {
    uCloud: { value: tex.cloud },
    uCloudOffset: { value: new THREE.Vector2(0.13, 0.41) },
    uCloudAmount: { value: 0.16 },
  };

  const sky = createSky();
  scene.add(sky.mesh);
  scene.fog = new THREE.Fog(0xc9a58c, 160, 1600);

  const road = createRoadMeshes(path, tex, quality);
  road.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && o.material.isMeshStandardMaterial) addCloudShadows(o.material, cloudUniforms);
  });
  scene.add(road);
  onProgress(0.42);
  await pause();

  const farmland = createFarmland(path, renderer);
  const terrain = createTerrain(path, height, tex, quality, cloudUniforms, farmland);
  scene.add(terrain);
  onProgress(0.58);
  await pause();

  scene.add(createVegetation(path, height, quality, farmland));
  onProgress(0.68);
  await pause();

  const truck = createTruck(tex);
  scene.add(truck.tractor, truck.trailer);
  const traffic = createTraffic(path, tex);
  scene.add(traffic.group);

  // ---------------------------------------------------------------- light
  const hemi = new THREE.HemisphereLight(0xb4c3da, 0x4f4232, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc48a, 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 2.5;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1400;
  scene.add(sun, sun.target);

  // Image-based lighting from the same sky, for paint and glass reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(createSky().mesh);
  const envRT = pmrem.fromScene(envScene, 0.02, 0.1, 6000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  onProgress(0.8);
  await pause();

  // ---------------------------------------------------------------- state
  const state = {
    s: path.start, // tractor arc length
    prevS: path.start,
    speed: 0,
    distance: 0,
  };

  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const smoothFocus = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const left = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const fr = {};
  const fogColor = new THREE.Color();

  function laneFrame(s, lat) {
    path.frameAt(s, fr);
    return { x: fr.x + fr.lx * lat, z: fr.z + fr.lz * lat, tx: fr.tx, tz: fr.tz };
  }

  function placeTruck(s, dt, time) {
    const lat = ROAD.laneSlow;
    const a = laneFrame(s, lat);
    const ahead = laneFrame(s + 2.2, lat);
    const yaw = Math.atan2(ahead.x - a.x, ahead.z - a.z);
    truck.tractor.position.set(a.x, 0.02, a.z);
    truck.tractor.rotation.set(0, yaw, 0);

    // Trailer: kingpin rides on the fifth wheel, axles track the lane behind
    const axle = laneFrame(s - 10.4, lat);
    const tYaw = Math.atan2(a.x - axle.x, a.z - axle.z);
    truck.trailer.position.set(a.x, 0.02, a.z);
    truck.trailer.rotation.set(0, tYaw, 0);

    // Suspension: idle shake, road bounce, lean into curves, squat on throttle
    const spd = state.speed;
    const moving = clamp(spd / 20, 0, 1);
    const idle = 1 - moving;
    const curve = Math.atan2(Math.sin(tYaw - yaw), Math.cos(tYaw - yaw));
    truck.body.position.y = Math.sin(time * 47) * 0.004 * idle + Math.sin(time * 5.3 + s * 0.4) * 0.018 * moving;
    truck.body.rotation.z = clamp(curve * 0.35, -0.03, 0.03) * moving;
    truck.body.rotation.x = clamp(-state.accel * 0.0006, -0.012, 0.012);
    truck.trailerBody.position.y = Math.sin(time * 4.1 + s * 0.3) * 0.012 * moving;

    // Wheels roll with distance travelled
    const roll = (s - path.start) / 0.52;
    for (const w of truck.wheels) w.rotation.x = roll;
  }

  function updateCamera(rig, time) {
    const tr = truck.tractor;
    // Focus: the cab at road level, the whole rig from the air
    tr.localToWorld(v1.set(0, 2.25, 3.3));
    tr.localToWorld(v2.set(0, 1.8, -4.2));
    focus.copy(v1).lerp(v2, rig.focusMix);
    smoothFocus.copy(focus);

    // Camera basis from a smoothed road heading, so the drone doesn't twitch
    path.frameAt(state.s + 14, fr);
    const hx = fr.tx, hz = fr.tz;
    path.frameAt(state.s - 6, fr);
    heading.set(hx + fr.tx, 0, hz + fr.tz).normalize();
    left.crossVectors(UP, heading).normalize();

    const th = rig.theta * DEG;
    const ph = rig.phi * DEG;
    const d = rig.dist + rig.introDist;
    camera.position
      .copy(smoothFocus)
      .addScaledVector(left, Math.sin(th) * Math.cos(ph) * d)
      .addScaledVector(UP, Math.sin(ph) * d + rig.introLift)
      .addScaledVector(heading, Math.cos(th) * Math.cos(ph) * d);

    // Hover drift: a breath at ground level, a drone's sway in the air
    const alt = camera.position.y;
    const amp = 0.03 + smoothstep(4, 80, alt) * 0.9;
    camera.position.x += Math.sin(time * 0.53) * amp;
    camera.position.y += Math.sin(time * 0.71 + 1.3) * amp * 0.5;
    camera.position.z += Math.cos(time * 0.37) * amp;
    if (camera.position.y < 0.6) camera.position.y = 0.6;

    const topDown = smoothstep(55, 86, rig.phi);
    camUp.copy(UP).lerp(heading, topDown).normalize();
    camera.up.copy(camUp);
    camera.lookAt(smoothFocus);

    camera.fov = rig.fov;
    camera.updateProjectionMatrix();
    // Off-axis lens shift keeps the truck clear of the copy
    camera.projectionMatrix.elements[8] = -rig.shiftX;
    camera.projectionMatrix.elements[9] = -rig.shiftY;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function updateLightAndFog(dt) {
    const alt = camera.position.y;
    const half = clamp(60 + alt * 0.95, 60, 360);
    const sc = sun.shadow.camera;
    if (sc.right !== half) {
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    // Centre the shadow map on what the camera sees, snapped to texels
    camera.getWorldDirection(v1);
    v1.y = 0;
    const lean = alt < 20 ? half * 0.45 : 0;
    focus.copy(smoothFocus).addScaledVector(v1.normalize(), lean);
    const texel = (half * 2) / quality.shadow;
    focus.x = Math.round(focus.x / texel) * texel;
    focus.z = Math.round(focus.z / texel) * texel;
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(SUN_DIR, 600);

    scene.fog.near = 170 + alt * 1.2;
    scene.fog.far = 1700 + alt * 2.6;
    sky.fogColorFor(camera, fogColor);
    scene.fog.color.copy(fogColor);

    cloudUniforms.uCloudOffset.value.x += dt * 0.0035;
    cloudUniforms.uCloudOffset.value.y += dt * 0.0016;
  }

  function update(rig, dt, time) {
    const s = path.start + rig.travel * DRIVE_DISTANCE;
    const ds = s - state.s;
    const speed = dt > 0 ? Math.abs(ds) / dt : 0;
    state.accel = dt > 0 ? (speed - state.speed) / dt : 0;
    state.speed = lerp(state.speed, speed, 0.2);
    state.prevS = state.s;
    state.s = s;

    placeTruck(s, dt, time);
    traffic.update(s, (s - path.start) / TRUCK_SPEED, path.start);
    updateCamera(rig, time);
    updateLightAndFog(dt);
    renderer.toneMappingExposure = rig.exposure ?? 0.96;

    // Lens glows only read when the lamps face the camera
    const yaw = truck.tractor.rotation.y;
    truck.tractor.localToWorld(v1.set(0, 1.4, 4.7));
    v2.copy(camera.position).sub(v1).normalize();
    const facing = v2.x * Math.sin(yaw) + v2.z * Math.cos(yaw);
    truck.setLights(rig.lights, clamp(facing, 0, 1), clamp(-facing, 0, 1));
  }

  function render() {
    renderer.render(scene, camera);
  }

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setPixelRatio(dpr) {
    renderer.setPixelRatio(dpr);
  }

  // Project the cab's bounding box to a screen rectangle (CSS pixels)
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  function cabRect(width, height, out = {}) {
    const b = truck.cabBox;
    let i = 0;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      corners[i++].set(x, y, z);
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let behind = false;
    truck.tractor.updateMatrixWorld();
    for (const c of corners) {
      truck.tractor.localToWorld(c);
      c.project(camera);
      if (c.z > 1) behind = true;
      const sx = (c.x * 0.5 + 0.5) * width;
      const sy = (1 - (c.y * 0.5 + 0.5)) * height;
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    }
    out.x = minX; out.y = minY; out.w = maxX - minX; out.h = maxY - minY; out.visible = !behind;
    return out;
  }

  async function warmup() {
    const rig = { travel: 0, theta: 36, phi: 4, dist: 15, fov: 30, focusMix: 0, shiftX: 0.3, shiftY: 0, introDist: 0, introLift: 0, lights: 1 };
    update(rig, 0.016, 0);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    render();
    onProgress(1);
  }

  function dispose() {
    renderer.dispose();
    envRT.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    Object.values(tex).forEach((t) => t.dispose());
  }

  return { renderer, scene, camera, path, truck, state, update, render, setSize, setPixelRatio, cabRect, warmup, dispose };
}
