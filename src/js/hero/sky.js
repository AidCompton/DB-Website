// Golden-hour sky dome: warm glow toward a low sun, a dusty pink band opposite
// it, deep blue overhead. Also drives fog colour so distant hills melt into
// the horizon from any camera heading.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(0.5, 0.29, 0.82).normalize();

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_Position.z = gl_Position.w; // pin to the far plane
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizonWarm;
  uniform vec3 uHorizonCool;
  uniform vec3 uGround;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec2 flatD = normalize(d.xz + 1e-5);
    vec2 flatS = normalize(uSunDir.xz);
    float toward = dot(flatD, flatS) * 0.5 + 0.5;          // 0 away from sun, 1 toward
    vec3 horizon = mix(uHorizonCool, uHorizonWarm, pow(toward, 1.6));

    vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.22, h));
    col = mix(col, uZenith, smoothstep(0.18, 0.85, h));
    // haze band just above the horizon
    col = mix(col, horizon * 1.08, (1.0 - smoothstep(0.0, 0.05, abs(h - 0.012))) * 0.6);
    col = mix(col, uGround, smoothstep(0.0, -0.12, h));

    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSun * (pow(sd, 5.0) * 0.28 + pow(sd, 60.0) * 0.55);
    col += uSun * smoothstep(0.99955, 0.9998, sd) * 4.0;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color('#1c2d4d') },
    uMid: { value: new THREE.Color('#5f7396') },
    uHorizonWarm: { value: new THREE.Color('#f2b27c') },
    uHorizonCool: { value: new THREE.Color('#b9a2ab') },
    uGround: { value: new THREE.Color('#3b3429') },
    uSun: { value: new THREE.Color('#ffc58a') },
    uSunDir: { value: SUN_DIR.clone() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  // Fog colour follows the horizon colour in the direction the camera faces
  const warm = uniforms.uHorizonWarm.value;
  const cool = uniforms.uHorizonCool.value;
  const fwd = new THREE.Vector3();
  function fogColorFor(camera, target) {
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    const toward = fwd.x * SUN_DIR.x + fwd.z * SUN_DIR.z;
    const t = Math.pow(Math.max(0, toward * 0.5 + 0.5), 1.6);
    return target.copy(cool).lerp(warm, t).multiplyScalar(0.92);
  }

  return { mesh, uniforms, fogColorFor };
}
