// Header: transparent over the hero, solid after it, tucks away while
// scrolling down and returns on the way up. Also runs the mobile menu.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initHeader(ctx) {
  const { root, env } = ctx;
  const header = root.querySelector('[data-header]');
  const heroTrack = root.querySelector('[data-hero-track]');
  const toggle = root.querySelector('[data-menu-toggle]');
  const menu = root.querySelector('[data-mobile-menu]');
  let menuOpen = false;
  let hidden = false;

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      const heroEnd = heroTrack ? heroTrack.offsetHeight - heroTrack.firstElementChild.offsetHeight * 0.4 : 0;
      const onHero = y < heroEnd;
      header.classList.toggle('on-hero', onHero);
      header.classList.toggle('is-solid', !onHero && y > 10);
      const hide = !menuOpen && !onHero && self.direction === 1 && y > 240;
      if (hide !== hidden) {
        hidden = hide;
        header.classList.toggle('is-hidden', hidden);
      }
    },
  });
  header.classList.add('on-hero');

  // Current-section highlight in the nav
  root.querySelectorAll('.site-nav a[href^="#"]').forEach((link) => {
    const target = root.querySelector(link.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    });
  });

  // ---------------------------------------------------------------- menu
  if (!toggle || !menu) return { closeMenu() {} };
  const links = menu.querySelectorAll('.mobile-menu__nav a span');
  const foot = menu.querySelector('.mobile-menu__foot');

  function openMenu() {
    menuOpen = true;
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.querySelector('.menu-toggle__label').textContent = 'Close';
    header.classList.remove('is-hidden');
    ctx.lenis?.stop();
    if (!env.reduced) {
      gsap.timeline()
        .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' })
        .fromTo(links, { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.05, ease: 'expo.out' }, 0.3)
        .fromTo(foot, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.55);
    }
    menu.querySelector('a')?.focus({ preventScroll: true });
  }

  function closeMenu({ restoreFocus = true } = {}) {
    if (!menuOpen) return Promise.resolve();
    menuOpen = false;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.menu-toggle__label').textContent = 'Menu';
    ctx.lenis?.start();
    const finish = () => {
      menu.hidden = true;
      if (restoreFocus) toggle.focus({ preventScroll: true });
    };
    if (env.reduced) {
      finish();
      return Promise.resolve();
    }
    return gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'expo.inOut', onComplete: finish }).then(() => {});
  }

  toggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) closeMenu();
  });

  return { closeMenu, get menuOpen() { return menuOpen; } };
}
