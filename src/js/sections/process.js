// "How it works": four steps travel sideways while the section is pinned
// (desktop), with a small truck driving the progress line. Each step has a
// looping illustration that only runs while it can be seen.
import { gsap } from 'gsap';

const SVGNS = 'http://www.w3.org/2000/svg';

export function initProcess(ctx) {
  const { root, env } = ctx;
  const section = root.querySelector('#how');
  if (!section) return;
  const track = section.querySelector('[data-process-track]');
  const sticky = section.querySelector('[data-process-sticky]');
  const rail = section.querySelector('[data-process-rail]');
  const fill = section.querySelector('[data-process-fill]');
  const truck = section.querySelector('[data-process-truck]');
  const progressEl = truck?.parentElement;

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 900px)', reduced: '(prefers-reduced-motion: reduce)' }, (c) => {
    const { desktop, reduced } = c.conditions;
    if (!desktop || reduced) {
      track.style.height = '';
      return;
    }
    root.classList.add('process-h');
    const distance = () => Math.max(0, rail.scrollWidth - sticky.clientWidth);
    const setHeight = () => { track.style.height = `${distance() + sticky.clientHeight}px`; };
    setHeight();

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.8,
        invalidateOnRefresh: true,
        onRefreshInit: setHeight,
      },
    });
    tl.to(rail, { x: () => -distance() }, 0)
      .fromTo(fill, { scaleX: 0 }, { scaleX: 1 }, 0)
      .fromTo(truck, { x: 0 }, { x: () => progressEl.clientWidth - 64 }, 0);

    return () => {
      root.classList.remove('process-h');
      track.style.height = '';
    };
  });

  if (!env.reduced) initArt(section);
}

// Play an illustration only while it's actually on screen. An
// IntersectionObserver sees where it really is while the rail is pinned and
// sliding sideways; a ScrollTrigger on it only knows its unpinned position,
// so it switched off (freezing the art half-drawn) while still in view.
function whileVisible(el, anim) {
  anim.pause();
  if (!('IntersectionObserver' in window)) {
    anim.play();
    return;
  }
  new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? anim.play() : anim.pause()));
  }).observe(el);
}

function initArt(section) {
  // 01 Assess: a target drifts along a path, the reticle chases it
  const assess = section.querySelector('[data-art="assess"]');
  if (assess) {
    const path = assess.querySelector('[data-assess-path]');
    const target = assess.querySelector('[data-assess-target]');
    const reticle = assess.querySelector('[data-assess-reticle]');
    const len = path.getTotalLength();
    const p = { t: 0 };
    let rx = 160, ry = 110;
    const anim = gsap.to(p, {
      t: 1,
      duration: 7,
      repeat: -1,
      ease: 'none',
      onUpdate: () => {
        const pt = path.getPointAtLength(p.t * len);
        target.setAttribute('cx', pt.x.toFixed(1));
        target.setAttribute('cy', pt.y.toFixed(1));
        rx += (pt.x - rx) * 0.09;
        ry += (pt.y - ry) * 0.09;
        reticle.setAttribute('transform', `translate(${rx.toFixed(1)} ${ry.toFixed(1)})`);
      },
    });
    whileVisible(assess, anim);
  }

  // 02 Profile: the ability shape shifts; risk perception stays flagged
  const profile = section.querySelector('[data-profile-shape]');
  if (profile) {
    const anim = gsap.to(profile, {
      attr: { points: '0,-60 78,-25.3 27,37.2 -44,60.6 -70,-22.7' },
      duration: 2.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    whileVisible(profile.ownerSVGElement, anim);
  }

  // 03 Train: an EyeGym-style drill, dots light up in quick succession
  const grid = section.querySelector('[data-train-grid]');
  if (grid) {
    const cells = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const circle = document.createElementNS(SVGNS, 'circle');
        circle.setAttribute('cx', String(c * 36));
        circle.setAttribute('cy', String(r * 36));
        circle.setAttribute('r', '10');
        circle.setAttribute('class', 'art__cell');
        grid.appendChild(circle);
        cells.push(circle);
      }
    }
    let last = -1;
    const flash = () => {
      let i;
      do { i = Math.floor(Math.random() * cells.length); } while (i === last);
      last = i;
      const cell = cells[i];
      cell.classList.add('is-on');
      gsap.fromTo(cell, { attr: { r: 6 } }, { attr: { r: 12 }, duration: 0.25, ease: 'back.out(3)' });
      gsap.delayedCall(0.42, () => cell.classList.remove('is-on'));
    };
    const anim = gsap.timeline({ repeat: -1 }).call(flash).to({}, { duration: 0.55 });
    whileVisible(grid.ownerSVGElement, anim);
  }

  // 04 Measure: the trend line draws in once and stays drawn (a chart that
  // erases itself reads as one that failed to load); the latest reading pulses
  const line = section.querySelector('[data-measure-line]');
  if (line) {
    const dot = section.querySelector('[data-measure-dot]');
    gsap.set(dot, { transformOrigin: '50% 50%', scale: 0 });
    gsap.set(line, { drawSVG: '0%' });
    const pulse = gsap.to(dot, { scale: 1.35, duration: 0.9, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true });
    const draw = gsap
      .timeline({ paused: true, onComplete: () => pulse.play() })
      .to(line, { drawSVG: '100%', duration: 2, ease: 'power2.inOut' })
      .to(dot, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, '-=0.25');
    whileVisible(line.ownerSVGElement, {
      play: () => (draw.progress() < 1 ? draw.play() : pulse.play()),
      pause: () => {
        draw.pause();
        pulse.pause();
      },
    });
  }
}
