// Device capability and preference detection, decided once at mount.
export function detectEnv() {
  const mq = (q) => window.matchMedia(q).matches;
  const reduced = mq('(prefers-reduced-motion: reduce)');
  const touch = mq('(hover: none), (pointer: coarse)');
  const finePointer = mq('(hover: hover) and (pointer: fine)');
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;

  let webgl = false;
  // Test harnesses can skip the 3D scene (window.__DB_NOGL__ = true)
  if (window.__DB_NOGL__) return { reduced, touch, finePointer, webgl: false, quality: { tier: 'medium', dpr: 1, shadow: 1024, msaa: false, ao: false } };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    webgl = !!gl;
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }

  const low = touch || small || cores < 4 || memory < 4;
  const tier = low ? 'medium' : 'high';
  const dpr = Math.min(window.devicePixelRatio || 1, tier === 'high' ? 1.75 : 1.5);

  return {
    reduced,
    touch,
    finePointer,
    webgl,
    // high: desktop GPUs get MSAA, ambient occlusion and 4K shadows
    quality: {
      tier,
      dpr: tier === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1.25),
      shadow: tier === 'high' ? 4096 : 2048,
      msaa: tier === 'high',
      ao: tier === 'high',
    },
  };
}
