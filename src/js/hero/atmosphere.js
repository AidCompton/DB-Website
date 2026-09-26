// Aerial perspective. Replaces three's distance fog, for materials that opt in
// (define SUN_FOG), with exponential height fog whose colour brightens and
// warms toward the sun. Distant hills turn hazy blue-grey away from the sun
// and glow gold toward it, as they do in real late-afternoon light.
import * as THREE from 'three';

export const atmosphere = {
  csm: null, // cascaded shadow maps, set by the scene before materials are built
  uniforms: {
    uFogDensity: { value: 0.00115 },
    uFogFalloff: { value: 0.0065 },
    uFogBase: { value: 0 },
    uSunFogColor: { value: new THREE.Color(1.1, 0.78, 0.52) },
    uSunDirW: { value: new THREE.Vector3(0, 1, 0) },
  },
};

const PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  #ifdef SUN_FOG
    varying vec3 vFogWorld;
  #endif
#endif
`;

const VERTEX = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  #ifdef SUN_FOG
    vec4 fogWP = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      fogWP = instanceMatrix * fogWP;
    #endif
    vFogWorld = ( modelMatrix * fogWP ).xyz;
  #endif
#endif
`;

const PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  #ifdef SUN_FOG
    varying vec3 vFogWorld;
    uniform float uFogDensity;
    uniform float uFogFalloff;
    uniform float uFogBase;
    uniform vec3 uSunFogColor;
    uniform vec3 uSunDirW;
  #endif
#endif
`;

const FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  #ifdef SUN_FOG
    vec3 fogRay = vFogWorld - cameraPosition;
    float fogDist = length( fogRay );
    vec3 fogDir = fogRay / max( fogDist, 1e-4 );
    float fogK = fogDir.y * uFogFalloff;
    float fogPath = abs( fogK ) < 1e-5 ? fogDist : ( 1.0 - exp( - fogDist * fogK ) ) / fogK;
    float fogAmount = uFogDensity * exp( - ( cameraPosition.y - uFogBase ) * uFogFalloff ) * fogPath;
    float fogFactor = 1.0 - exp( - max( fogAmount, 0.0 ) );
    float fogMu = max( dot( fogDir, uSunDirW ), 0.0 );
    vec3 fogTint = mix( fogColor, uSunFogColor, pow( fogMu, 5.0 ) * 0.85 + pow( fogMu, 40.0 ) * 0.15 );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );
  #else
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif
#endif
`;

THREE.ShaderChunk.fog_pars_vertex = PARS_VERTEX;
THREE.ShaderChunk.fog_vertex = VERTEX;
THREE.ShaderChunk.fog_pars_fragment = PARS_FRAGMENT;
THREE.ShaderChunk.fog_fragment = FRAGMENT;

// Chain several onBeforeCompile patches on one material and keep the
// program cache key unique per combination. (Kept out of userData, which
// Material.clone() copies through JSON.)
const PATCHES = new WeakMap();
export function extendMaterial(material, key, patch) {
  const patches = [...(PATCHES.get(material) || []), { key, patch }];
  PATCHES.set(material, patches);
  material.onBeforeCompile = (shader, renderer) => {
    for (const p of patches) p.patch(shader, renderer);
  };
  material.customProgramCacheKey = () => patches.map((p) => p.key).join('|');
  material.needsUpdate = true;
  return material;
}

// Opt a lit material into the sun-aware height fog and the cascaded sun
// shadows. Every lit material in the world must go through here: the sun is
// one light per cascade, and materials outside CSM would receive all of them.
export function withAtmosphere(material) {
  const csm = atmosphere.csm;
  material.defines = { ...(material.defines || {}), SUN_FOG: '' };
  if (csm) {
    material.defines.USE_CSM = 1;
    material.defines.CSM_CASCADES = csm.cascades;
    if (csm.fade) material.defines.CSM_FADE = '';
  }
  return extendMaterial(material, 'fog', (shader) => {
    Object.assign(shader.uniforms, atmosphere.uniforms);
    if (csm) {
      const breaks = [];
      csm._getExtendedBreaks(breaks);
      shader.uniforms.CSM_cascades = { value: breaks };
      shader.uniforms.cameraNear = { value: csm.camera.near };
      shader.uniforms.shadowFar = { value: Math.min(csm.camera.far, csm.maxFar) };
      csm.shaders.set(material, shader);
    }
  });
}
