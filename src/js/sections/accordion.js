// FAQ accordion. Panels are open in the markup (so content survives without
// JS) and collapsed here; hidden panels are inert so they drop out of the tab
// order.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initAccordion(ctx) {
  const { root, env } = ctx;
  let t = 0;
  const refresh = () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => ScrollTrigger.refresh(), 150);
  };
  root.querySelectorAll('[data-acc]').forEach((acc) => {
    const btn = acc.querySelector('[data-acc-btn]');
    const panel = acc.querySelector('[data-acc-panel]');
    const inner = panel.querySelector('.acc__inner');
    panel.setAttribute('inert', '');

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      const d = env.reduced ? 0 : 1;
      if (open) {
        panel.setAttribute('inert', '');
        gsap.to(panel, { height: 0, duration: 0.5 * d, ease: 'power3.inOut', overwrite: true, onComplete: refresh });
      } else {
        panel.removeAttribute('inert');
        gsap.to(panel, { height: 'auto', duration: 0.7 * d, ease: 'expo.out', overwrite: true, onComplete: refresh });
        gsap.fromTo(inner, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 * d, delay: 0.08 * d, ease: 'power3.out' });
      }
    });
  });
}
