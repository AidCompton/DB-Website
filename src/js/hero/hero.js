// Hero controller. One GSAP timeline, scrubbed by ScrollTrigger across the
// tall hero track, drives everything: truck travel, the camera's rise from
// road level to a top-down drone shot, the story beats, the HUD and the fade
// into the page.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { createWorld } from './scene.js';

// Camera keyframes. theta: orbit angle around the truck (0 = in front,
// 90 = its left side, 180 = behind); phi: elevation; dist: metres from the
// focus point; shift: off-axis lens shift in NDC (moves the truck on screen).
const SHOTS = {
  landscape: {
    p0: { theta: 36, phi: 3.5, dist: 17, fov: 30, shiftX: 0.42, shiftY: -0.04, focusMix: 0, exposure: 0.96 },
    p1: { theta: 84, phi: 10, dist: 25, fov: 33, shiftX: 0.3, shiftY: 0.02, exposure: 1.0 },
    p2: { theta: 150, phi: 42, dist: 42, fov: 36, shiftX: 0.18, shiftY: 0.05, focusMix: 0.55, exposure: 1.12 },
    p3: { theta: 180, phi: 89.4, dist: 62, fov: 38, shiftX: 0.26, shiftY: 0, focusMix: 1, exposure: 1.32 },
    p4: { dist: 56 },
    p5: { dist: 170, shiftX: 0.06, exposure: 1.36 },
    p6: { dist: 600, shiftX: 0, exposure: 1.3 },
  },
  portrait: {
    p0: { theta: 28, phi: 5, dist: 25, fov: 44, shiftX: 0, shiftY: 0.38, focusMix: 0, exposure: 0.96 },
    p1: { theta: 72, phi: 12, dist: 31, fov: 46, shiftY: 0.34, exposure: 1.0 },
    p2: { theta: 150, phi: 46, dist: 52, fov: 48, shiftY: 0.26, focusMix: 0.55, exposure: 1.12 },
    p3: { theta: 180, phi: 89.4, dist: 108, fov: 50, shiftY: -0.12, focusMix: 1, exposure: 1.32 },
    p4: { dist: 100 },
    p5: { dist: 200, shiftY: 0.1, exposure: 1.36 },
    p6: { dist: 680, shiftY: 0, exposure: 1.3 },
  },
};

export function createHero(ctx) {
  const { root, env } = ctx;
  const q = (s) => root.querySelector(s);
  const qa = (s) => Array.from(root.querySelectorAll(s));

  const track = q('[data-hero-track]');
  const stage = q('[data-hero-stage]');
  const canvas = q('[data-hero-canvas]');
  const intro = q('[data-hero-intro]');
  const title = q('[data-hero-title]');
  const cue = q('[data-hero-cue]');
  const fade = q('[data-hero-fade]');
  const beats = qa('[data-beat]');
  const hud = q('[data-hud]');
  const hudTarget = q('[data-hud-target]');
  const hudPanel = q('[data-hud-panel]');
  const hudTag = q('[data-hud-tag]');
  const hudLeader = q('[data-hud-leader] polyline');
  const hudEvents = qa('[data-hud-event]');
  const hudMeters = qa('[data-hud-meter]');
  const hudVehicle = q('[data-hud-view="vehicle"]');
  const hudDriver = q('[data-hud-view="driver"]');
  const hudAssign = q('[data-hud-assign]');

  const portraitQuery = window.matchMedia('(max-aspect-ratio: 4/5)');
  const shots = () => (portraitQuery.matches ? SHOTS.portrait : SHOTS.landscape);

  const rig = { travel: 0, lights: 0, introDist: 0, introLift: 0, ...shots().p0 };
  const hudState = { on: 0, lock: 0 };

  let world = null;
  let active = false;
  const panelSize = { w: 0, h: 0 };
  let width = stage.clientWidth;
  let height = stage.clientHeight;
  let mm = null;
  let introSplit = null;

  // ------------------------------------------------------------ build
  async function build(onProgress) {
    if (!env.webgl) {
      root.classList.add('no-webgl');
      onProgress(1);
      return;
    }
    try {
      world = await createWorld(canvas, env.quality, onProgress);
      world.setSize(width, height);
      await world.warmup();
    } catch (err) {
      console.warn('[Driver Bureau] 3D scene unavailable, showing the static hero.', err);
      world = null;
      root.classList.add('no-webgl');
      onProgress(1);
    }
  }

  // ------------------------------------------------------------ timeline
  function buildTimeline() {
    mm = gsap.matchMedia();
    mm.add(
      { portrait: '(max-aspect-ratio: 4/5)', landscape: '(min-aspect-ratio: 4/5)', reduced: '(prefers-reduced-motion: reduce)' },
      (mctx) => {
        const { portrait, reduced } = mctx.conditions;
        const K = portrait ? SHOTS.portrait : SHOTS.landscape;
        Object.assign(rig, K.p0, { travel: 0 });

        if (reduced) {
          // Still frame, no pin: the track is one screen tall in CSS
          rig.lights = 1;
          renderOnce();
          return;
        }

        const tl = gsap.timeline({ defaults: { ease: 'none' } });

        // --- truck and camera
        tl.to(rig, { travel: 0.1, ease: 'power2.in', duration: 0.3 }, 0.04)
          .to(rig, { travel: 1, duration: 0.66 }, 0.34)
          .to(rig, { ...K.p1, ease: 'sine.inOut', duration: 0.16 }, 0.02)
          .to(rig, { ...K.p2, ease: 'sine.inOut', duration: 0.16 }, 0.18)
          .to(rig, { ...K.p3, ease: 'power2.inOut', duration: 0.16 }, 0.34)
          .to(rig, { ...K.p4, ease: 'sine.inOut', duration: 0.24 }, 0.5)
          .to(rig, { ...K.p5, ease: 'power2.in', duration: 0.12 }, 0.74)
          .to(rig, { ...K.p6, ease: 'power1.in', duration: 0.14 }, 0.86);

        // --- intro copy and scroll cue leave
        tl.to(intro, { yPercent: -18, autoAlpha: 0, ease: 'power2.in', duration: 0.07 }, 0.012)
          .to(cue, { autoAlpha: 0, duration: 0.03 }, 0);

        // --- story beats
        const windows = [
          [0.1, 0.25],
          [0.31, 0.47],
          [0.54, 0.71],
          [0.77, 0.92],
        ];
        beats.forEach((beat, i) => {
          const [a, b] = windows[i];
          const parts = beat.querySelectorAll('.beat__kicker, .beat__title .split-line, .beat__text');
          tl.set(beat, { autoAlpha: 1 }, a)
            .fromTo(parts, { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.006, ease: 'power3.out', duration: 0.05 }, a)
            .to(parts, { yPercent: -60, autoAlpha: 0, stagger: 0.004, ease: 'power2.in', duration: 0.04 }, b)
            .set(beat, { autoAlpha: 0 }, b + 0.045);
        });

        // --- HUD: lock on, telematics log, then the driver profile
        if (world) {
          tl.set(hud, { autoAlpha: 1 }, 0.4)
            .fromTo(hudState, { on: 0, lock: 0 }, { on: 1, lock: 1, ease: 'expo.out', duration: 0.05 }, 0.4)
            .fromTo(hudPanel, { autoAlpha: 0, x: 20 }, { autoAlpha: 1, x: 0, ease: 'power3.out', duration: 0.03 }, 0.425);
          hudEvents.forEach((row, i) => {
            tl.fromTo(row, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.012, ease: 'power2.out' }, 0.44 + i * 0.022);
          });
          tl.to(hudVehicle, { autoAlpha: 0, duration: 0.015 }, 0.535)
            .to(hudDriver, { autoAlpha: 1, duration: 0.015 }, 0.545)
            .to(hudTag, { scrambleText: { text: 'Driver', chars: 'upperCase', speed: 0.6 }, duration: 0.02 }, 0.54)
            .fromTo(hudState, { lock: 1 }, { lock: 0.82, duration: 0.012, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.54);
          hudMeters.forEach((m, i) => {
            const bar = m.querySelector('b');
            tl.fromTo(bar, { scaleX: 0 }, { scaleX: Number(m.dataset.hudMeter), duration: 0.03, ease: 'power2.out' }, 0.56 + i * 0.018);
            const flag = m.querySelector('em');
            if (flag) tl.fromTo(flag, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.56 + i * 0.018 + 0.03);
          });
          tl.fromTo(hudAssign, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.012 }, 0.66)
            .to(hudPanel, { autoAlpha: 0, x: 20, duration: 0.03, ease: 'power2.in' }, 0.72)
            .to(hudState, { on: 0, duration: 0.03, ease: 'power2.in' }, 0.73)
            .set(hud, { autoAlpha: 0 }, 0.765);
        }

        // --- fade into the page
        tl.fromTo(fade, { opacity: 0 }, { opacity: 1, ease: 'power2.in', duration: 0.08 }, 0.92);

        const st = ScrollTrigger.create({
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: env.touch ? 0.5 : 0.9,
          animation: tl,
        });

        // Test hook (only when a harness sets window.__DB_DEBUG__): seek the
        // hero to a progress value and render one frame synchronously.
        if (window.__DB_DEBUG__) {
          window.__dbHero = {
            seek(p, time = 1) {
              debugPaused = true;
              st.disable(false);
              tl.progress(p);
              if (world) {
                for (let i = 0; i < 3; i++) world.update(rig, 1 / 30, time + i / 30);
                updateHud();
                world.render(1 / 30);
              }
            },
            resume() { debugPaused = false; st.enable(); },
            world,
            rig,
          };
        }

        return () => { tl.kill(); };
      }
    );
  }

  // ------------------------------------------------------------ HUD
  const rect = {};
  const view = { x: 0, y: 0, w: 0, h: 0 };
  function updateHud() {
    if (!world || hudState.on <= 0.001) return;
    world.cabRect(width, height, rect);
    if (!rect.visible) return;
    const pad = 10;
    const minSize = width < 700 ? 54 : 70;
    let w = Math.max(rect.w + pad * 2, minSize);
    let h = Math.max(rect.h + pad * 2, minSize);
    let x = rect.x + rect.w / 2 - w / 2;
    let y = rect.y + rect.h / 2 - h / 2;
    // Lock-on: collapse from a wide frame onto the cab
    const k = hudState.lock;
    const bigW = width * 0.6, bigH = height * 0.6;
    x = gsap.utils.interpolate(width / 2 - bigW / 2, x, k);
    y = gsap.utils.interpolate(height / 2 - bigH / 2, y, k);
    w = gsap.utils.interpolate(bigW, w, k);
    h = gsap.utils.interpolate(bigH, h, k);
    view.x = x; view.y = y; view.w = w; view.h = h;
    hudTarget.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    hudTarget.style.width = `${w.toFixed(1)}px`;
    hudTarget.style.height = `${h.toFixed(1)}px`;
    hudTarget.style.opacity = String(hudState.on);

    // Panel beside the target, or pinned under the header on phones
    if (!panelSize.w) { panelSize.w = hudPanel.offsetWidth; panelSize.h = hudPanel.offsetHeight; }
    const pw = panelSize.w;
    const ph = panelSize.h;
    let px, py, lx, ly, ex, ey;
    if (width < 700) {
      px = (width - pw) / 2;
      py = Math.max(70, Math.min(y - ph - 28, 96));
      hudPanel.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
      return;
    }
    const gap = 64;
    const right = x + w + gap + pw < width - 24;
    px = right ? x + w + gap : x - gap - pw;
    py = gsap.utils.clamp(90, height - ph - 40, y - ph * 0.35);
    hudPanel.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    lx = right ? x + w : x;
    ly = y;
    ex = right ? px : px + pw;
    ey = py + 22;
    hudLeader.setAttribute('points', `${lx.toFixed(1)},${ly.toFixed(1)} ${(lx + (right ? 18 : -18)).toFixed(1)},${ey.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
    hudLeader.style.opacity = String(hudState.on);
  }

  // ------------------------------------------------------------ loop
  let perfFrames = 0;
  let perfTime = 0;
  let dpr = env.quality.dpr;
  // Below ~40 fps, step down: depth of field, then resolution, then AO and
  // the grass shells, then the last of the resolution
  let rungs = 0;
  function adaptResolution(dt) {
    perfFrames++;
    perfTime += dt;
    if (perfFrames < 90) return;
    const avg = perfTime / perfFrames;
    perfFrames = 0;
    perfTime = 0;
    if (avg <= 1 / 40) return;
    rungs++;
    const lowerDpr = () => {
      if (dpr <= 1) return false;
      dpr = Math.max(1, dpr - 0.25);
      world.setPixelRatio(dpr);
      world.setSize(width, height);
      return true;
    };
    if (rungs === 2 && lowerDpr()) return;
    if (!world.degrade()) lowerDpr();
  }

  let debugPaused = false;
  function tick(time, deltaMs) {
    // Reduced motion shows a still frame (renderOnce), so nothing to animate
    if (!world || !active || debugPaused || env.reduced) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    world.update(rig, dt, time);
    updateHud();
    world.render(dt);
    adaptResolution(dt);
  }

  function renderOnce() {
    if (!world) return;
    world.update(rig, 0.016, 0);
    world.render();
  }

  // ------------------------------------------------------------ intro
  function playIntro() {
    const tl = gsap.timeline();
    if (env.reduced) {
      rig.lights = 1;
      renderOnce();
      return tl;
    }
    introSplit = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    Object.assign(rig, { introDist: 9, introLift: 1.2 });
    tl.to(rig, { introDist: 0, introLift: 0, duration: 2.8, ease: 'power3.out' }, 0)
      .to(rig, { keyframes: [{ lights: 0.7, duration: 0.07 }, { lights: 0.05, duration: 0.09 }, { lights: 1, duration: 0.14 }] }, 0.5)
      .from(introSplit.lines, { yPercent: 108, duration: 1.2, stagger: 0.09, ease: 'expo.out' }, 0.15)
      .from(intro.querySelectorAll('.hero__eyebrow, .hero__lede, .hero__ctas'), { y: 26, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.5)
      .from(cue, { autoAlpha: 0, duration: 0.8 }, 1.1)
      .add(() => {
        // Hand the title back to normal text flow so it re-wraps on resize
        introSplit.revert();
        introSplit = null;
      });
    return tl;
  }

  // ------------------------------------------------------------ lifecycle
  function onResize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    panelSize.w = 0;
    if (world) {
      world.setSize(width, height);
      if (!active || env.reduced) renderOnce();
    }
  }
  const ro = new ResizeObserver(() => onResize());

  function start() {
    // Split beat titles once so the timeline can stagger their lines
    beats.forEach((b) => SplitText.create(b.querySelector('.beat__title'), { type: 'lines', mask: 'lines', linesClass: 'split-line' }));
    gsap.set(hudDriver, { autoAlpha: 0 });
    gsap.set(hud, { autoAlpha: 0 });
    buildTimeline();
    ro.observe(stage);
    const vis = ScrollTrigger.create({
      trigger: track,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => { active = self.isActive; },
    });
    active = vis.isActive;
    gsap.ticker.add(tick);
    renderOnce();
  }

  function destroy() {
    gsap.ticker.remove(tick);
    ro.disconnect();
    if (mm) mm.revert();
    if (world) world.dispose();
  }

  return { build, start, playIntro, destroy, rig };
}
