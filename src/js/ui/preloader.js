// Counts 000 -> 100 while fonts and the 3D world load, then wipes away.
import { gsap } from 'gsap';

export function createPreloader(root, env) {
  const el = root.querySelector('[data-preloader]');
  if (!el) return { progress() {}, done: async () => {} };
  const count = el.querySelector('[data-preloader-count]');
  const bar = el.querySelector('[data-preloader-bar]');
  const mark = el.querySelector('.preloader__mark');
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
    gsap.fromTo(mark, { rotate: -120, scale: 0.5, autoAlpha: 0 }, { rotate: 0, scale: 1, autoAlpha: 1, duration: 1.2, ease: 'expo.out' });
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
      .to(mark, { scale: 0.6, autoAlpha: 0, duration: 0.45, ease: 'power3.in' })
      .to(el.querySelector('.preloader__foot'), { autoAlpha: 0, y: -12, duration: 0.35 }, 0)
      .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.0, ease: 'expo.inOut' }, 0.25);
    el.remove();
  }

  return { progress, done };
}
