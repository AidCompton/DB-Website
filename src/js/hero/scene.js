// Builds the world and exposes a tiny API the scroll timeline drives:
//   world.update(rig, dt, time) -> places truck, traffic, camera, light
//   world.render(dt)
import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { atmosphere } from './atmosphere.js';
import { createRoadPath, createRoadMeshes, createGrass, createGrassShells, ROAD } from './road.js';
import { createHeightField, createTerrain, createFarmland, groundPatch, scatter, createRocks, createHouses } from './terrain.js';
import { createFoliageMaterials, createForest } from './foliage.js';
import { createSky, SUN_DIR, skyBaseColor } from './sky.js';
import { createTruck, RIG } from './truck.js';
import { createTraffic } from './traffic.js';
import { createPost } from './post.js';
import * as T from './textures.js';
import { clamp, lerp, smoothstep } from './noise.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const pause = () => new Promise((r) => setTimeout(r, 16));

export const TRUCK_SPEED = 22; // m/s, used to convert travel into "virtual seconds"
export const DRIVE_DISTANCE = 480; // metres covered over the whole hero scroll

// The livery is painted with Montserrat; make sure the weights are ready
async function brandFonts() {
  if (!document.fonts?.load) return;
  const loads = ['700 64px Montserrat', '600 64px Montserrat', '500 64px Montserrat'].map((f) => document.fonts.load(f));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
}

export async function createWorld(canvas, quality, onProgress = () => {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(quality.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x0e243e, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 6000);
  await brandFonts();

  // The sun: cascaded shadow maps, crisp around the truck, long golden-hour
  // shadows across the landscape. Splits as fractions of maxFar.
  const high = quality.tier === 'high';
  const splits = high ? [0.018, 0.08, 0.3, 1] : [0.03, 0.2, 1];
  const csm = new CSM({
    camera,
    parent: scene,
    cascades: splits.length,
    maxFar: 1600,
    mode: 'custom',
    customSplitsCallback: (n, near, far, target) => splits.forEach((v) => target.push(v)),
    shadowMapSize: high ? 2048 : 1024,
    lightDirection: SUN_DIR.clone().negate(),
    lightIntensity: 6.0,
    lightNear: 1,
    lightFar: 4000,
    lightMargin: 400,
    shadowBias: -0.00015,
  });
  csm.fade = true;
  // Keep our off-axis lens shift: CSM would otherwise reset the projection
  csm._initCascades = function () {
    this.mainFrustum.setFromProjectionMatrix(this.camera.projectionMatrix, this.maxFar);
    this.mainFrustum.split(this.breaks, this.frustums);
  };
  csm.lights.forEach((l, i) => {
    l.color.set(0xffd6ab);
    l.shadow.normalBias = 0.02 + i * 0.03;
    l.shadow.radius = 2;
    if (i >= 2) l.shadow.autoUpdate = false; // far cascades refresh every other frame
  });
  atmosphere.csm = csm;
  let frame = 0;

  const tex = {
    asphalt: T.asphaltDetail(renderer),
    asphaltWear: T.asphaltWear(renderer),
    markingWear: T.markingWear(renderer),
    gravel: T.gravelTexture(renderer),
    grass: T.grassDetail(renderer),
    soil: T.soilDetail(renderer),
    grassBlades: T.grassBlades(renderer),
    grassFur: T.grassFur(renderer),
    leafAcacia: T.leafCluster(renderer, 'acacia'),
    leafGum: T.leafCluster(renderer, 'gum'),
    leafBush: T.leafCluster(renderer, 'bush'),
    barkAcacia: T.barkTexture(renderer, 'acacia'),
    barkGum: T.barkTexture(renderer, 'gum'),
    tyre: T.tyreTextures(renderer),
    grille: T.grilleTextures(renderer),
    glow: T.glowTexture(renderer),
    streak: T.streakTexture(renderer),
    beam: T.beamTexture(renderer),
    cloud: T.cloudTexture(renderer),
  };
  tex.concrete = tex.soil;
  onProgress(0.25);
  await pause();

  const path = createRoadPath();
  const height = createHeightField(path);
  const cloudUniforms = {
    uCloud: { value: tex.cloud },
    uCloudOffset: { value: new THREE.Vector2(0.13, 0.41) },
    uCloudAmount: { value: 0.22 },
  };

  // ---------------------------------------------------------------- sky + air
  const sky = createSky({ octaves: quality.tier === 'high' ? 6 : 4 });
  scene.add(sky.mesh);
  const hazeAway = skyBaseColor(new THREE.Vector3(-SUN_DIR.z, 0.02, SUN_DIR.x).normalize());
  const hazeSun = skyBaseColor(new THREE.Vector3(SUN_DIR.x, 0.03, SUN_DIR.z).normalize());
  scene.fog = new THREE.Fog(hazeAway.clone(), 200, 2400);
  atmosphere.uniforms.uSunFogColor.value.copy(hazeSun).multiplyScalar(0.9);
  atmosphere.uniforms.uSunDirW.value.copy(SUN_DIR);
  atmosphere.uniforms.uFogDensity.value = 0.0006;
  atmosphere.uniforms.uFogFalloff.value = 0.0062;

  const farmland = createFarmland(path, renderer);
  const terrain = createTerrain(path, height, tex, quality, cloudUniforms, farmland);
  scene.add(terrain);
  const surface = terrain.userData.surface;
  onProgress(0.4);
  await pause();

  const groundCloud = groundPatch(cloudUniforms);
  const road = createRoadMeshes(path, tex, quality, groundCloud);
  scene.add(road);
  const grass = createGrass(path, surface, tex, quality);
  const sward = createGrassShells(path, surface, tex, quality);
  scene.add(grass, sward);
  onProgress(0.52);
  await pause();

  const spots = scatter(path, surface, quality, farmland);
  const foliageMats = createFoliageMaterials(tex);
  scene.add(createForest(foliageMats, spots, quality));
  scene.add(createRocks(spots.rocks, tex));
  scene.add(createHouses(spots.houses, surface));
  onProgress(0.64);
  await pause();

  const truck = createTruck(renderer, tex);
  scene.add(truck.tractor, truck.trailer, truck.wheelGroup);
  const traffic = createTraffic(path, tex);
  scene.add(traffic.group);
  onProgress(0.72);
  await pause();

  // ---------------------------------------------------------------- light
  const hemi = new THREE.HemisphereLight(0x9fb4d6, 0x5a4a34, 0.12);
  scene.add(hemi);

  // Image-based lighting from the same sky (clouds included) for paint,
  // glass and chrome reflections and for soft skylight everywhere
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = createSky({ octaves: 4, sunDisk: 8 });
  envScene.add(envSky.mesh);
  const envRT = pmrem.fromScene(envScene, 0.015, 0.1, 8000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.6;
  // Polished metal and glass read by what they reflect: give them the sky at
  // full strength (materials with their own envMap ignore the scene value)
  for (const k of ['alu', 'chrome', 'aluBrushed', 'mirror', 'screen', 'glass', 'paint']) {
    const m = truck.materials[k];
    m.envMap = envRT.texture;
    m.envMapIntensity = k === 'paint' ? 0.8 : 1.1;
    m.needsUpdate = true;
  }
  pmrem.dispose();
  envSky.mesh.geometry.dispose();
  envSky.mesh.material.dispose();

  const post = createPost(renderer, scene, camera, quality);
  onProgress(0.82);
  await pause();

  // ---------------------------------------------------------------- state
  const state = { s: path.start, prevS: path.start, speed: 0, accel: 0 };
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const left = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const fr = {};
  const trailerAxle = -(RIG.trailerAxles[1]);

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

    // Trailer: kingpin rides on the fifth wheel, the axle group tracks the lane
    const axle = laneFrame(s - trailerAxle, lat);
    const tYaw = Math.atan2(a.x - axle.x, a.z - axle.z);
    truck.trailer.position.set(a.x, 0.02, a.z);
    truck.trailer.rotation.set(0, tYaw, 0);

    // Suspension: idle shake, road bounce, lean into curves, squat on throttle
    const spd = state.speed;
    const moving = clamp(spd / 20, 0, 1);
    const idle = 1 - moving;
    const curve = Math.atan2(Math.sin(tYaw - yaw), Math.cos(tYaw - yaw));
    truck.body.position.y = Math.sin(time * 47) * 0.003 * idle + (Math.sin(time * 5.3 + s * 0.4) * 0.012 + Math.sin(time * 9.1 + s * 1.3) * 0.004) * moving;
    truck.body.rotation.z = clamp(curve * 0.35, -0.025, 0.025) * moving + Math.sin(time * 3.1 + s * 0.2) * 0.002 * moving;
    truck.body.rotation.x = clamp(-state.accel * 0.0005, -0.01, 0.01);
    truck.trailerBody.position.y = Math.sin(time * 4.1 + s * 0.3) * 0.01 * moving;
    truck.trailerBody.rotation.z = Math.sin(time * 2.3 + s * 0.15) * 0.0025 * moving;

    // Wheels roll with distance travelled; blur with angular speed
    truck.updateWheels((s - path.start) / RIG.wheelR, spd / RIG.wheelR);
  }

  function updateCamera(rig, time) {
    const tr = truck.tractor;
    // Focus: the cab at road level, the whole rig from the air
    tr.localToWorld(v1.set(0, 2.3, 3.4));
    tr.localToWorld(v2.set(0, 1.9, -4.4));
    focus.copy(v1).lerp(v2, rig.focusMix);

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
      .copy(focus)
      .addScaledVector(left, Math.sin(th) * Math.cos(ph) * d)
      .addScaledVector(UP, Math.sin(ph) * d + rig.introLift)
      .addScaledVector(heading, Math.cos(th) * Math.cos(ph) * d);

    // Hand-held breath at ground level, a drone's sway in the air
    const alt = camera.position.y;
    const amp = 0.025 + smoothstep(4, 80, alt) * 0.9;
    camera.position.x += Math.sin(time * 0.53) * amp + Math.sin(time * 1.9) * 0.006;
    camera.position.y += Math.sin(time * 0.71 + 1.3) * amp * 0.5 + Math.sin(time * 2.3) * 0.004;
    camera.position.z += Math.cos(time * 0.37) * amp;
    if (camera.position.y < 0.7) camera.position.y = 0.7;

    const topDown = smoothstep(55, 86, rig.phi);
    camUp.copy(UP).lerp(heading, topDown).normalize();
    camera.up.copy(camUp);
    camera.lookAt(focus);

    camera.fov = rig.fov;
    camera.updateProjectionMatrix();
    // Off-axis lens shift keeps the truck clear of the copy
    camera.projectionMatrix.elements[8] = -rig.shiftX;
    camera.projectionMatrix.elements[9] = -rig.shiftY;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function updateLightAndFog(dt, time) {
    const alt = camera.position.y;
    camera.updateMatrixWorld();
    csm.updateFrustums();
    csm.update();
    frame++;
    for (let i = 2; i < csm.lights.length; i++) csm.lights[i].shadow.needsUpdate = frame < 4 || (frame + i) % 2 === 0;
    grass.userData.setScale(1 - smoothstep(6, 16, alt));
    sward.userData.setScale(1 - smoothstep(10, 24, alt));

    // Plain fog (sprites, lines) roughly matches the height fog
    scene.fog.near = 220 + alt * 1.4;
    scene.fog.far = 2600 + alt * 3;

    cloudUniforms.uCloudOffset.value.x += dt * 0.0035;
    cloudUniforms.uCloudOffset.value.y += dt * 0.0016;
    sky.uniforms.uTime.value = time;
    foliageMats.shared.uTime.value = time;
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
    updateLightAndFog(dt, time);
    renderer.toneMappingExposure = (rig.exposure ?? 1) * 0.8;
    // Depth of field only at road level; gone once the drone climbs
    post.setFocus(camera.position.distanceTo(focus), 14 + rig.dist * 0.4, 1.8 * (1 - smoothstep(9, 24, rig.phi)));

    // Lens glows only read when the lamps face the camera
    const yaw = truck.tractor.rotation.y;
    truck.tractor.localToWorld(v1.set(0, 1.4, 4.8));
    v2.copy(camera.position).sub(v1).normalize();
    const facing = v2.x * Math.sin(yaw) + v2.z * Math.cos(yaw);
    truck.setLights(rig.lights, clamp(facing, 0, 1), clamp(-facing, 0, 1));
  }

  function render(dt = 0.016) {
    post.render(dt);
  }

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setPixelRatio(dpr) {
    renderer.setPixelRatio(dpr);
  }

  // Quality ladder for slow devices (the hero also lowers resolution)
  const ladder = [
    () => post.disable('dof'),
    () => post.disable('ao'),
    () => { const on = sward.visible; sward.userData.setScale(0); sward.userData.setScale = () => {}; return on; },
  ];
  function degrade() {
    while (ladder.length) if (ladder.shift()()) return true;
    return false;
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
    const rig = { travel: 0, theta: 36, phi: 4, dist: 17, fov: 30, focusMix: 0, shiftX: 0.3, shiftY: 0, introDist: 0, introLift: 0, lights: 1, exposure: 1 };
    update(rig, 0.016, 0);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    render();
    onProgress(1);
  }

  function dispose() {
    csm.dispose();
    atmosphere.csm = null;
    post.dispose();
    renderer.dispose();
    envRT.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    Object.values(tex).forEach((t) => {
      if (t?.isTexture) t.dispose();
      else if (t && typeof t === 'object') Object.values(t).forEach((x) => x?.isTexture && x.dispose());
    });
  }

  return { renderer, scene, camera, path, truck, state, post, csm, hemi, update, render, setSize, setPixelRatio, degrade, cabRect, warmup, dispose };
}
