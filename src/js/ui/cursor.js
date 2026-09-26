// Custom cursor (fine pointers only) and magnetic buttons.
import { gsap } from 'gsap';

export function initCursor(ctx) {
  const { root, env } = ctx;
  const magnets = root.querySelectorAll('[data-magnetic]');

  if (env.finePointer && !env.reduced) {
    magnets.forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      const strength = el.classList.contains('cta__button') ? 0.35 : 0.22;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  const cursor = root.querySelector('[data-cursor]');
  if (!cursor || !env.finePointer || env.reduced) return;
  const dot = cursor.querySelector('[data-cursor-dot]');
  const ring = cursor.querySelector('[data-cursor-ring]');
  const label = cursor.querySelector('[data-cursor-label]');
  gsap.set([dot, ring], { xPercent: 0, yPercent: 0, x: -100, y: -100 });
  const dotX = gsap.quickSetter(dot, 'x', 'px');
  const dotY = gsap.quickSetter(dot, 'y', 'px');
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  let armed = false;

  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!armed) {
      armed = true;
      root.classList.add('has-cursor');
    }
    dotX(e.clientX);
    dotY(e.clientY);
    ringX(e.clientX);
    ringY(e.clientY);
    cursor.classList.remove('is-hidden');
  }, { passive: true });

  root.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('a, button, [data-cursor], [role="tab"]');
    cursor.classList.toggle('is-link', !!t && !t.dataset.cursor);
    cursor.classList.toggle('is-label', !!t && !!t.dataset.cursor);
    label.textContent = t?.dataset.cursor || '';
  });
  document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  window.addEventListener('blur', () => cursor.classList.add('is-hidden'));
}
