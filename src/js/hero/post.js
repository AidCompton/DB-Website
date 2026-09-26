// Post-processing: the "camera" part of the look. The scene renders linear
// HDR into a half-float buffer; then ambient occlusion (N8AO), bloom for lamps
// and sun glints, AgX-style filmic tone mapping, a gentle grade, lens
// vignette, chromatic fringing and film grain.
import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  DepthOfFieldEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SMAAEffect,
  SMAAPreset,
  Effect,
  EffectAttribute,
  BlendFunction,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// Grade + vignette + lateral chromatic aberration + grain in one pass
const lensFragment = /* glsl */ `
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uFringe;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSaturation;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  // Lateral chromatic aberration, strongest in the corners
  vec2 off = c * r2 * uFringe;
  vec3 col;
  col.r = texture2D(inputBuffer, uv - off).r;
  col.g = inputColor.g;
  col.b = texture2D(inputBuffer, uv + off).b;
  // Grade (display-referred, after tone mapping)
  col = col * uGain + uLift * (1.0 - col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  // Natural lens vignette
  float v = 1.0 - uVignette * smoothstep(0.08, 0.72, r2 * 1.6);
  col *= v;
  // Film grain, weighted to the mid-tones
  float n = hash(uv * resolution + fract(uTime) * 91.7) - 0.5;
  col += n * uGrain * (1.0 - abs(l - 0.5) * 1.4);
  outputColor = vec4(clamp(col, 0.0, 1.0), inputColor.a);
}
`;

class LensEffect extends Effect {
  constructor() {
    super('LensEffect', lensFragment, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uTime', new THREE.Uniform(0)],
        ['uVignette', new THREE.Uniform(0.28)],
        ['uGrain', new THREE.Uniform(0.022)],
        ['uFringe', new THREE.Uniform(0.005)],
        ['uLift', new THREE.Uniform(new THREE.Vector3(0.0, 0.002, 0.008))],
        ['uGain', new THREE.Uniform(new THREE.Vector3(1.02, 1.0, 0.98))],
        ['uSaturation', new THREE.Uniform(1.04)],
      ]),
    });
  }
  update(renderer, inputBuffer, dt) {
    this.uniforms.get('uTime').value += dt;
  }
}

export function createPost(renderer, scene, camera, quality) {
  const high = quality.tier === 'high';
  renderer.toneMapping = THREE.NoToneMapping;

  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: high && quality.msaa ? 4 : 0,
  });
  composer.addPass(new RenderPass(scene, camera));

  let ao = null;
  if (quality.ao) {
    ao = new N8AOPostPass(scene, camera, 1, 1);
    Object.assign(ao.configuration, {
      aoRadius: 1.6,
      distanceFalloff: 0.6,
      intensity: 2.4,
      aoSamples: high ? 16 : 8,
      denoiseSamples: high ? 8 : 4,
      denoiseRadius: 10,
      halfRes: true,
      depthAwareUpsampling: true,
      gammaCorrection: false,
      color: new THREE.Color(0x0b1016),
    });
    composer.addPass(ao);
  }

  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: 2.4,
    luminanceSmoothing: 0.4,
    intensity: 0.32,
    radius: 0.6,
  });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const lens = new LensEffect();
  // A long lens at road level: the truck sharp, the hills softly out of focus
  const dof = high ? new DepthOfFieldEffect(camera, { focusDistance: 18, focusRange: 16, bokehScale: 0, resolutionScale: 0.5 }) : null;
  // DoF gets its own pass so it can be switched off without rebuilding buffers
  const dofPass = dof ? new EffectPass(camera, dof) : null;
  if (dofPass) composer.addPass(dofPass);
  composer.addPass(new EffectPass(camera, bloom, tone));
  composer.addPass(new EffectPass(camera, lens));
  if (!composer.multisampling) {
    composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: high ? SMAAPreset.HIGH : SMAAPreset.MEDIUM })));
  }

  return {
    composer,
    ao,
    bloom,
    tone,
    lens,
    setSize(w, h) {
      composer.setSize(w, h, false);
    },
    // Drop one expensive feature; returns false when nothing is left to drop
    disable(name) {
      const pass = name === 'dof' ? dofPass : name === 'ao' ? ao : null;
      if (!pass || !pass.enabled) return false;
      pass.enabled = false;
      return true;
    },
    setFocus(distance, range, scale) {
      if (!dof || !dofPass.enabled) return;
      dof.cocMaterial.focusDistance = distance;
      dof.cocMaterial.focusRange = range;
      dof.bokehScale = scale;
    },
    render(dt) {
      composer.render(dt);
    },
    dispose() {
      composer.dispose();
    },
  };
}
