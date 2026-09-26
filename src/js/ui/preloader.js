// Counts 000 -> 100 while fonts and the 3D world load, then wipes away. The
// four pieces of the Driver Bureau monogram assemble while it counts.
import { gsap } from 'gsap';

export function createPreloader(root, env) {
  const el = root.querySelector('[data-preloader]');
  if (!el) return { progress() {}, done: async () => {} };
  const count = el.querySelector('[data-preloader-count]');
  const bar = el.querySelector('[data-preloader-bar]');
  const mark = el.querySelector('.preloader__mark');
  const word = el.querySelector('.preloader__word');
  const piece = (k) => mark.querySelector(`[data-piece="${k}"]`);
  const started = performance.now();
  const MIN_TIME = env.reduced ? 0 : 1100;
  const shown = { v: 0 };
  let target = 0;

  const render = () => {
    shown.v += (target - shown.v) * 0.1;
    if (target - shown.v < 0.002) shown.v = target;
    count.textContent = String(Math.round(shown.v * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${shown.v.toFixed(4)})`;
  };
  gsap.ticker.add(render);
  if (!env.reduced) {
    // Each piece arrives from its own corner and locks into place
    const from = {
      pill: { x: -120, y: -110, rotation: -24 },
      top: { x: 120, y: -110, rotation: 20 },
      bottomRight: { x: 120, y: 110, rotation: -20 },
      bottomLeft: { x: -120, y: 110, rotation: 24 },
    };
    const tl = gsap.timeline();
    Object.entries(from).forEach(([k, v], i) => {
      const p = piece(k);
      if (!p) return;
      tl.from(p, { ...v, autoAlpha: 0, transformOrigin: '50% 50%', duration: 1.1, ease: 'expo.out' }, 0.08 + i * 0.09);
    });
    if (word) tl.from(word, { autoAlpha: 0, y: 14, letterSpacing: '0.5em', duration: 1.1, ease: 'expo.out' }, 0.45);
  }

  function progress(p) {
    target = Math.max(target, Math.min(1, p));
  }

  async function done() {
    target = 1;
    const wait = Math.max(0, MIN_TIME - (performance.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    // Let the counter land on 100, but never hang if frames are throttled
    await new Promise((r) => {
      const t0 = performance.now();
      const check = () => (shown.v >= 0.999 || performance.now() - t0 > 900 ? r() : setTimeout(check, 30));
      check();
    });
    gsap.ticker.remove(render);
    count.textContent = '100';
    bar.style.transform = 'scaleX(1)';
    if (env.reduced) {
      el.remove();
      return;
    }
    await gsap
      .timeline()
      .to([mark, word].filter(Boolean), { scale: 0.86, autoAlpha: 0, duration: 0.45, ease: 'power3.in', stagger: 0.04 })
      .to(el.querySelector('.preloader__foot'), { autoAlpha: 0, y: -12, duration: 0.35 }, 0)
      .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.0, ease: 'expo.inOut' }, 0.25);
    el.remove();
  }

  return { progress, done };
}
