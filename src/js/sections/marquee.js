// Endless ticker of the abilities Driver Bureau measures. Scroll speed and
// direction push it along and skew it slightly.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initMarquee(ctx) {
  const { root, env } = ctx;
  const marquee = root.querySelector('[data-marquee]');
  const row = marquee?.querySelector('[data-marquee-row]');
  if (!row || env.reduced) return;

  row.innerHTML += row.innerHTML; // two identical halves -> seamless -50% loop
  const loop = gsap.to(row, { xPercent: -50, duration: 36, ease: 'none', repeat: -1 });
  const skew = gsap.quickTo(row, 'skewX', { duration: 0.5, ease: 'power3' });
  let dir = 1;

  ScrollTrigger.create({
    trigger: marquee,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
    onUpdate: (self) => {
      const v = self.getVelocity();
      if (self.direction !== dir) dir = self.direction;
      const boost = gsap.utils.clamp(-7, 7, v / 220);
      gsap.to(loop, { timeScale: dir * Math.max(1, Math.abs(boost)), duration: 0.25, overwrite: true });
      gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25, ease: 'power2.out' });
      skew(gsap.utils.clamp(-9, 9, -v / 500));
    },
  });
  ScrollTrigger.addEventListener('scrollEnd', () => skew(0));
}
