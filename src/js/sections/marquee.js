// Endless ticker of the abilities Driver Bureau measures. It drifts on its
// own, speeds up with the scroll and follows its direction, easing through
// every change (a reversal slows, stops and turns rather than snapping), and
// slows right down while the mouse is over it.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const BASE = 50 / 36; // xPercent per second: half the doubled row every 36 s

export function initMarquee(ctx) {
  const { root, env } = ctx;
  const marquee = root.querySelector('[data-marquee]');
  const row = marquee?.querySelector('[data-marquee-row]');
  if (!row || env.reduced) return;

  row.innerHTML += row.innerHTML; // two identical halves -> seamless loop
  const setX = gsap.quickSetter(row, 'xPercent');
  const setSkew = gsap.quickSetter(row, 'skewX', 'deg');
  const wrap = gsap.utils.wrap(-50, 0);

  // Position is integrated here every frame, so the loop never runs out
  // (a reversed repeating tween stalls at its start) and nothing jumps
  let x = 0;
  let dir = 1; // the scroll's direction: 1 down, -1 up
  let heading = 1; // eased towards dir
  let velocity = 0; // latest scroll velocity (px/s), fading once it stops
  let boost = 0;
  let skew = 0;
  let hover = 0;
  let hovering = false;
  let visible = false;

  ScrollTrigger.create({
    trigger: marquee,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => { visible = self.isActive; },
    onUpdate: (self) => {
      velocity = self.getVelocity();
      if (Math.abs(velocity) > 40) dir = velocity > 0 ? 1 : -1;
    },
  });
  marquee.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
  marquee.addEventListener('pointerleave', () => { hovering = false; });

  gsap.ticker.add((time, deltaMs) => {
    if (!visible) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const ease = (rate) => 1 - Math.exp(-rate * dt);
    velocity *= Math.exp(-4 * dt);
    heading += (dir - heading) * ease(2.2);
    boost += (Math.min(Math.abs(velocity) / 400, 5) - boost) * ease(3);
    hover += ((hovering ? 1 : 0) - hover) * ease(4);
    skew += (gsap.utils.clamp(-4, 4, -velocity / 1000) - skew) * ease(6);
    x = wrap(x - BASE * heading * (1 + boost) * (1 - hover * 0.8) * dt);
    setX(x);
    setSkew(skew);
  });
}
