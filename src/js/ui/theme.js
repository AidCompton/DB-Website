// Page colour follows the section in the middle of the viewport. GSAP tweens
// the two root colour variables; everything else derives from currentColor.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const THEMES = {
  dark: { bg: '#0d0f12', fg: '#edece8' },
  light: { bg: '#e3e2dc', fg: '#0d0f12' },
  signal: { bg: '#ffc21a', fg: '#0d0f12' },
};

export function initTheme(ctx) {
  const { root, env } = ctx;
  let current = null;

  function apply(name, instant = false) {
    const t = THEMES[name] || THEMES.dark;
    if (current === name) return;
    current = name;
    root.dataset.currentTheme = name;
    gsap.to(root, {
      '--bgc': t.bg,
      '--fgc': t.fg,
      duration: instant || env.reduced ? 0 : 0.75,
      ease: 'power2.out',
      overwrite: true,
    });
  }
  apply('dark', true);

  const sections = root.querySelectorAll('main > section[data-theme], footer[data-theme]');
  sections.forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) apply(section.dataset.theme); },
    });
  });

  return { apply, get current() { return current; } };
}
