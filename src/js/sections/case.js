// Case study: pinned on wide screens, stepping through challenge -> solution
// -> results as you scroll. Stacked and static everywhere else.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initCase(ctx) {
  const { root } = ctx;
  const section = root.querySelector('#case-study');
  if (!section) return;
  const track = section.querySelector('[data-case-track]');
  const panels = Array.from(section.querySelectorAll('[data-case-panel]'));
  const tabs = Array.from(section.querySelectorAll('[data-case-tab]'));
  const fills = Array.from(section.querySelectorAll('[data-case-fill]'));

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 900px)', reduced: '(prefers-reduced-motion: reduce)' }, (c) => {
    const { desktop, reduced } = c.conditions;
    if (!desktop || reduced) return;
    root.classList.add('case-pinned');
    let current = -1;

    const show = (i) => {
      if (i === current) return;
      const dir = i > current ? 1 : -1;
      const prev = panels[current];
      const next = panels[i];
      current = i;
      tabs.forEach((t, k) => t.classList.toggle('is-active', k === i));
      if (prev) gsap.to(prev, { autoAlpha: 0, y: -36 * dir, duration: 0.45, ease: 'power2.in', overwrite: true });
      gsap.fromTo(next, { autoAlpha: 0, y: 40 * dir }, { autoAlpha: 1, y: 0, duration: 0.9, delay: prev ? 0.2 : 0, ease: 'expo.out', overwrite: true });
      gsap.fromTo(next.children, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.07, duration: 0.8, delay: prev ? 0.25 : 0, ease: 'expo.out', overwrite: true });
    };

    gsap.set(panels, { autoAlpha: 0, yPercent: -50 });
    show(0);
    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const p = self.progress * 3;
        show(Math.min(2, Math.floor(p)));
        fills.forEach((f, k) => gsap.set(f, { scaleX: gsap.utils.clamp(0, 1, p - k) }));
      },
    });

    return () => {
      st.kill();
      root.classList.remove('case-pinned');
      gsap.set(panels, { clearProps: 'all' });
      gsap.set(panels.flatMap((p) => Array.from(p.children)), { clearProps: 'all' });
    };
  });
}
