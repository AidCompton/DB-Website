// Accessible tabs (WAI-ARIA pattern) with animated panel changes.
import { gsap } from 'gsap';

export function initTabs(ctx) {
  const { root, env } = ctx;
  root.querySelectorAll('[data-tabs]').forEach((wrap) => {
    const tabs = Array.from(wrap.querySelectorAll('[data-tab]'));
    const panels = Array.from(wrap.querySelectorAll('[data-tabpanel]'));
    const holder = panels[0]?.parentElement;
    let current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    if (current < 0) current = 0;

    // Reserve the tallest panel's height so the page below never jumps
    const reserve = () => {
      if (!holder) return;
      holder.style.minHeight = '';
      let max = 0;
      panels.forEach((p) => {
        const wasHidden = p.hidden;
        p.hidden = false;
        max = Math.max(max, p.offsetHeight);
        p.hidden = wasHidden;
      });
      holder.style.minHeight = `${max}px`;
    };
    reserve();
    ctx.onResize(reserve);

    function select(i, focus = false) {
      if (i === current) {
        if (focus) tabs[i].focus();
        return;
      }
      const out = panels[current];
      const inn = panels[i];
      tabs[current].setAttribute('aria-selected', 'false');
      tabs[current].tabIndex = -1;
      tabs[i].setAttribute('aria-selected', 'true');
      tabs[i].tabIndex = 0;
      if (focus) tabs[i].focus();
      current = i;
      if (env.reduced) {
        out.hidden = true;
        inn.hidden = false;
        return;
      }
      gsap.to(out, {
        autoAlpha: 0,
        y: 14,
        duration: 0.22,
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => {
          out.hidden = true;
          gsap.set(out, { clearProps: 'opacity,visibility,transform' });
          inn.hidden = false;
          gsap.fromTo(
            inn.querySelectorAll('.tabpanel__title, .tabpanel__main p, .tabpanel__side'),
            { y: 34, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, stagger: 0.07, duration: 0.8, ease: 'expo.out', overwrite: true }
          );
        },
      });
    }

    tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
    wrap.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
      const n = tabs.length;
      let i = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (current + 1) % n;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (current - 1 + n) % n;
      if (e.key === 'Home') i = 0;
      if (e.key === 'End') i = n - 1;
      if (i === null) return;
      e.preventDefault();
      select(i, true);
    });
  });
}
