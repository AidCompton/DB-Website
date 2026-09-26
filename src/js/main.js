// Driver Bureau site runtime.
//
//   DriverBureau.mount({ root, scroller, links })
//
// root     Document or ShadowRoot that contains the [data-db-root] markup
// scroller window (normal page) or the element that scrolls (Wix overlay)
// links    optional overrides for [data-link] URLs, e.g. { book: '/book-a-meeting' }
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

import { detectEnv } from './env.js';
import { createPreloader } from './ui/preloader.js';
import { initTheme } from './ui/theme.js';
import { initHeader } from './ui/header.js';
import { initRail } from './ui/rail.js';
import { initCursor } from './ui/cursor.js';
import { createHero } from './hero/hero.js';
import { initReveals } from './sections/reveals.js';
import { initProblem } from './sections/problem.js';
import { initProcess } from './sections/process.js';
import { initReaction } from './sections/reaction.js';
import { initCase } from './sections/case.js';
import { initTabs } from './sections/tabs.js';
import { initMarquee } from './sections/marquee.js';
import { initAccordion } from './sections/accordion.js';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, DrawSVGPlugin);

function safely(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.warn(`[Driver Bureau] ${name} failed to start`, err);
    return null;
  }
}

function fontsReady(timeout = 2500) {
  if (!document.fonts?.ready) return Promise.resolve();
  return Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, timeout))]);
}

export async function mount(options = {}) {
  const scope = options.root || document;
  const scrollerOpt = options.scroller || window;
  const root = scope.querySelector('[data-db-root]');
  if (!root || root.__dbMounted) return null;
  root.__dbMounted = true;

  const env = detectEnv();
  const isWindow = scrollerOpt === window;
  const scrollerEl = isWindow ? document.scrollingElement || document.documentElement : scrollerOpt;

  root.classList.add('js');
  if (env.reduced) root.classList.add('reduced');

  // Custom link targets (e.g. relative URLs when running inside Wix)
  const links = options.links || {};
  root.querySelectorAll('[data-link]').forEach((a) => {
    if (links[a.dataset.link]) a.setAttribute('href', links[a.dataset.link]);
  });

  if (isWindow && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!isWindow) ScrollTrigger.defaults({ scroller: scrollerOpt });
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Overlay mode: size "screens" from the scroller, not the window
  const resizeCallbacks = new Set();
  const setStage = () => {
    if (!isWindow) root.style.setProperty('--stage-h', `${scrollerOpt.clientHeight}px`);
  };
  setStage();
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      setStage();
      resizeCallbacks.forEach((fn) => safely('resize', fn));
    }, 120);
  };
  window.addEventListener('resize', onResize);

  // ---------------------------------------------------------------- scroll
  let lenis = null;
  if (!env.reduced) {
    lenis = new Lenis(
      isWindow
        ? { lerp: 0.09, smoothWheel: true }
        : { wrapper: scrollerOpt, content: root, eventsTarget: scrollerOpt, lerp: 0.09, smoothWheel: true }
    );
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  const headerOffset = () => (root.querySelector('[data-header]')?.offsetHeight || 0) * 0.5;
  function scrollToTarget(target, immediate = false) {
    if (!target) return;
    const offset = target.id === 'top' ? 0 : -headerOffset();
    if (lenis) {
      lenis.scrollTo(target.id === 'top' ? 0 : target, { offset, duration: immediate ? 0 : 1.8, immediate, force: true });
    } else {
      const y = target.getBoundingClientRect().top - (isWindow ? 0 : scrollerOpt.getBoundingClientRect().top) + scrollerEl.scrollTop + offset;
      scrollerEl.scrollTo({ top: target.id === 'top' ? 0 : y, behavior: 'auto' });
    }
    if (target.id !== 'top') {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  }

  const ctx = {
    root,
    env,
    lenis,
    scroller: scrollerOpt,
    scrollTo: scrollToTarget,
    onResize: (fn) => resizeCallbacks.add(fn),
  };

  const preloader = createPreloader(root, env);
  preloader.progress(0.04);

  // ---------------------------------------------------------------- chrome
  safely('theme', () => initTheme(ctx));
  const header = safely('header', () => initHeader(ctx));
  safely('rail', () => initRail(ctx));
  safely('cursor', () => initCursor(ctx));

  // In-page links scroll smoothly and never touch the host page's URL
  root.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-scroll-to]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (!hash || !hash.startsWith('#')) return;
    const target = root.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    if (header?.menuOpen) {
      header.closeMenu({ restoreFocus: false }).then(() => scrollToTarget(target));
    } else {
      scrollToTarget(target);
    }
  });

  await fontsReady();
  preloader.progress(0.15);

  // ---------------------------------------------------------------- sections
  safely('reveals', () => initReveals(ctx));
  safely('problem', () => initProblem(ctx));
  safely('process', () => initProcess(ctx));
  safely('reaction', () => initReaction(ctx));
  safely('case', () => initCase(ctx));
  safely('tabs', () => initTabs(ctx));
  safely('marquee', () => initMarquee(ctx));
  safely('accordion', () => initAccordion(ctx));

  // ---------------------------------------------------------------- hero
  const hero = createHero(ctx);
  await hero.build((p) => preloader.progress(0.15 + p * 0.85));
  safely('hero', () => hero.start());
  ScrollTrigger.refresh();

  await preloader.done();
  safely('intro', () => hero.playIntro());
  lenis?.start();

  // Deep link (#faq etc.) once everything has measured itself
  const hash = isWindow ? window.location.hash : '';
  if (hash && hash.length > 1) {
    const target = safely('hash', () => root.querySelector(hash));
    if (target) setTimeout(() => scrollToTarget(target, true), 60);
  }

  return {
    ctx,
    destroy() {
      window.removeEventListener('resize', onResize);
      hero.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      lenis?.destroy();
      gsap.globalTimeline.clear();
      root.__dbMounted = false;
    },
  };
}
