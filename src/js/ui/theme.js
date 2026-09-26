// Page colour follows the section in the middle of the viewport. GSAP tweens
// the root colour variables; everything else derives from them or from
// currentColor. All four themes use the brand blue #24599A, white, and
// shades/tints of the blue.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const THEMES = {
  navy: { bg: '#0e243e', fg: '#ffffff', acc: '#8bb3e4', onAcc: '#0e243e', pbg: '#ffffff', pfg: '#24599a' },
  blue: { bg: '#24599a', fg: '#ffffff', acc: '#ffffff', onAcc: '#24599a', pbg: '#ffffff', pfg: '#24599a' },
  white: { bg: '#ffffff', fg: '#0b1b2e', acc: '#24599a', onAcc: '#ffffff', pbg: '#24599a', pfg: '#ffffff' },
  mist: { bg: '#eef3f9', fg: '#0b1b2e', acc: '#24599a', onAcc: '#ffffff', pbg: '#24599a', pfg: '#ffffff' },
};

export function initTheme(ctx) {
  const { root, env } = ctx;
  let current = null;

  function apply(name, instant = false) {
    const t = THEMES[name] || THEMES.navy;
    if (current === name) return;
    current = name;
    root.dataset.currentTheme = name;
    gsap.to(root, {
      '--bgc': t.bg,
      '--fgc': t.fg,
      '--acc': t.acc,
      '--on-acc': t.onAcc,
      '--pbg': t.pbg,
      '--pfg': t.pfg,
      duration: instant || env.reduced ? 0 : 0.75,
      ease: 'power2.out',
      overwrite: true,
    });
  }
  apply('navy', true);

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
