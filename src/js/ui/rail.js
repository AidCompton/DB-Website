// "Road rail": a lane line down the left edge whose dashes run past as you
// scroll, with a stop for every section.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initRail(ctx) {
  const { root } = ctx;
  const rail = root.querySelector('[data-rail]');
  const heroTrack = root.querySelector('[data-hero-track]');
  if (!rail) return;
  const dashes = rail.querySelector('[data-rail-dashes]');

  ScrollTrigger.create({
    trigger: heroTrack,
    start: 'bottom 70%',
    onEnter: () => gsap.to(rail, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out' }),
    onLeaveBack: () => gsap.to(rail, { autoAlpha: 0, x: -12, duration: 0.4 }),
  });
  gsap.set(rail, { x: -12 });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      dashes.style.setProperty('--dash', `${((self.scroll() * 0.2) % 20).toFixed(1)}px`);
    },
  });

  rail.querySelectorAll('[data-rail-stop]').forEach((stop) => {
    const section = root.querySelector(`#${stop.dataset.railStop}`);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => stop.classList.toggle('is-active', self.isActive),
    });
  });
}
