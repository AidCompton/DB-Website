// Late-afternoon sky over the KZN midlands: a deep blue zenith, a pale haze
// band on the horizon, a warm forward-scattering glow around a low sun, and a
// deck of altocumulus lit from the side. Output is linear HDR (tone mapped in
// post). The same model, evaluated in JS, gives the haze colours so distant
// hills dissolve into the horizon in every direction.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(0.52, 0.245, 0.82).normalize();

const P = {
  zenith: new THREE.Color(0.055, 0.14, 0.36),
  mid: new THREE.Color(0.22, 0.36, 0.62),
  horizon: new THREE.Color(0.78, 0.8, 0.84),
  horizonWarm: new THREE.Color(1.35, 0.86, 0.5),
  ground: new THREE.Color(0.24, 0.19, 0.12),
  sun: new THREE.Color(1.0, 0.72, 0.44),
  cloudLit: new THREE.Color(1.6, 1.12, 0.78),
  cloudShade: new THREE.Color(0.34, 0.37, 0.5),
};

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
  uniform vec3 uHorizon;
  uniform vec3 uHorizonWarm;
  uniform vec3 uGround;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform float uCloudCover;
  uniform float uTime;
  uniform float uSunDisk;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < CLOUD_OCTAVES; i++) { s += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return s;
  }

  vec3 skyBase(vec3 d) {
    float h = clamp(d.y, 0.0, 1.0);
    float mu = dot(d, uSunDir);
    vec3 col = mix(uMid, uZenith, smoothstep(0.08, 0.75, h));
    col = mix(uHorizon, col, smoothstep(0.0, 0.32, pow(h, 0.72)));
    // Warm band hugging the horizon on the sun's side
    vec2 fd = normalize(d.xz + 1e-5), fs = normalize(uSunDir.xz);
    float side = pow(dot(fd, fs) * 0.5 + 0.5, 3.0);
    col += uHorizonWarm * side * pow(1.0 - h, 7.0) * 0.9;
    // Forward scattering around the sun (Henyey-Greenstein)
    float g = 0.78;
    float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
    col += uSun * hg * 0.022 * (0.35 + 0.65 * pow(1.0 - h, 2.0));
    return col;
  }

  void main() {
    vec3 d = normalize(vDir);
    vec3 col;
    if (d.y < 0.0) {
      // Below the horizon (only seen in reflections): hazy sunlit ground
      col = mix(skyBase(vec3(d.x, 0.0, d.z)), uGround, smoothstep(0.0, -0.18, d.y));
    } else {
      col = skyBase(d);
      float h = clamp(d.y, 0.0, 1.0);
      float mu = dot(d, uSunDir);
      // Sun disc with limb darkening, bright enough to bloom
      float disk = smoothstep(0.99975, 0.9999, mu);
      col += uSun * disk * uSunDisk;

      // Cloud deck, projected onto a plane
      vec2 p = d.xz / (d.y + 0.06) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
      vec2 w = vec2(fbm(p * 0.35 + 3.1), fbm(p * 0.35 - 7.4));
      float n = fbm(p * 0.9 + w * 1.6);
      float cover = smoothstep(uCloudCover, uCloudCover + 0.22, n);
      vec2 sp = normalize(uSunDir.xz) * 0.22;
      float n2 = fbm((p + sp) * 0.9 + w * 1.6);
      float lit = clamp(0.55 + (n - n2) * 5.0, 0.0, 1.0);
      float thin = 1.0 - smoothstep(uCloudCover + 0.05, uCloudCover + 0.45, n);
      float toward = pow(max(mu, 0.0), 6.0);
      vec3 cloud = mix(uCloudShade, uCloudLit, lit);
      cloud += uSun * (thin * 1.4 + toward * 1.8) * 0.9 * lit; // silver lining
      // Thin, distant cloud melts into the horizon haze
      float fade = smoothstep(0.015, 0.2, d.y);
      col = mix(col, cloud * (0.75 + 0.25 * h), cover * fade * 0.92);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky({ octaves = 5, cover = 0.56, sunDisk = 60 } = {}) {
  const uniforms = {
    uZenith: { value: P.zenith.clone() },
    uMid: { value: P.mid.clone() },
    uHorizon: { value: P.horizon.clone() },
    uHorizonWarm: { value: P.horizonWarm.clone() },
    uGround: { value: P.ground.clone() },
    uSun: { value: P.sun.clone() },
    uSunDir: { value: SUN_DIR.clone() },
    uCloudLit: { value: P.cloudLit.clone() },
    uCloudShade: { value: P.cloudShade.clone() },
    uCloudCover: { value: cover },
    uTime: { value: 0 },
    uSunDisk: { value: sunDisk },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    defines: { CLOUD_OCTAVES: octaves },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms };
}

// JS mirror of skyBase() for haze colours (linear RGB)
const _c = new THREE.Color();
export function skyBaseColor(dir, out = new THREE.Color()) {
  const h = Math.min(Math.max(dir.y, 0), 1);
  const mu = dir.dot(SUN_DIR);
  const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  out.copy(P.mid).lerp(P.zenith, ss(0.08, 0.75, h));
  _c.copy(P.horizon);
  out.copy(_c.lerp(out, ss(0, 0.32, Math.pow(h, 0.72))));
  const fl = Math.hypot(dir.x, dir.z) || 1, sl = Math.hypot(SUN_DIR.x, SUN_DIR.z);
  const side = Math.pow(((dir.x * SUN_DIR.x + dir.z * SUN_DIR.z) / (fl * sl)) * 0.5 + 0.5, 3);
  const k = side * Math.pow(1 - h, 7) * 0.9;
  out.r += P.horizonWarm.r * k; out.g += P.horizonWarm.g * k; out.b += P.horizonWarm.b * k;
  const g = 0.78;
  const hg = (1 - g * g) / Math.pow(1 + g * g - 2 * g * mu, 1.5);
  const m = hg * 0.022 * (0.35 + 0.65 * Math.pow(1 - h, 2));
  out.r += P.sun.r * m; out.g += P.sun.g * m; out.b += P.sun.b * m;
  return out;
}
