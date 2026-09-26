// "The gap": the 90% figure counts up and gains weight (Montserrat's variable
// weight axis) as the section arrives; the three cards stack on top of each other.
import { gsap } from 'gsap';

export function initProblem(ctx) {
  const { root, env } = ctx;
  const section = root.querySelector('#problem');
  if (!section) return;
  const num = section.querySelector('[data-problem-number]');
  const wrap = num?.closest('.problem__number');
  const cards = Array.from(section.querySelectorAll('[data-pcard]'));
  cards.forEach((c, i) => c.style.setProperty('--i', i));

  if (env.reduced) return;

  if (num && wrap) {
    const o = { v: 0 };
    gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 80%', end: 'top 10%', scrub: 1 },
    })
      .fromTo(o, { v: 0 }, { v: 90, ease: 'power1.out', onUpdate: () => { num.textContent = String(Math.round(o.v)); } }, 0)
      .fromTo(wrap, { fontWeight: 200 }, { fontWeight: 700, ease: 'power2.inOut' }, 0);
  }

  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: 0.93,
      '--shade': 0.55,
      ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 30%', scrub: true },
    });
  });

  gsap.from(cards, {
    y: 80,
    autoAlpha: 0,
    duration: 1.1,
    ease: 'expo.out',
    stagger: 0.1,
    scrollTrigger: { trigger: cards[0], start: 'top 90%', once: true },
  });
}
