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
    quality: { tier, dpr, shadow: tier === 'high' ? 2048 : 1024 },
  };
}
