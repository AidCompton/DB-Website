// Shared scroll reveals: split headings, fade-ups, the belief statement that
// lights up word by word, counters, the results range chart and the footer.
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

export function initReveals(ctx) {
  const { root, env } = ctx;
  const qa = (s) => Array.from(root.querySelectorAll(s));

  // Footer wordmark always fits the width, whatever the font's metrics
  const word = root.querySelector('[data-footer-word]');
  const fit = () => {
    if (!word) return;
    word.style.fontSize = '100px';
    word.style.width = 'max-content';
    const w = word.getBoundingClientRect().width;
    word.style.width = '';
    const cs = getComputedStyle(word.parentElement);
    const target = word.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (w > 0) word.style.fontSize = `${Math.floor(((100 * target) / w) * 0.99)}px`;
  };
  fit();
  ctx.onResize(fit);

  const year = root.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  if (env.reduced) return;

  qa('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 105,
          duration: 1.15,
          stagger: 0.09,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        }),
    });
  });

  qa('.section .label').forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0,
      x: -16,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  qa('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 36,
      autoAlpha: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  // Belief statement: words light up as it scrolls through the viewport
  const statement = root.querySelector('[data-highlight]');
  if (statement) {
    SplitText.create(statement, {
      type: 'words',
      wordsClass: 'hl-word',
      autoSplit: true,
      onSplit: (self) =>
        gsap.fromTo(
          self.words,
          { opacity: 0.16 },
          {
            opacity: 1,
            stagger: 0.1,
            ease: 'none',
            scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 48%', scrub: true },
          }
        ),
    });
  }

  // Products and stats arrive with a stagger
  const products = qa('[data-product]');
  if (products.length) {
    gsap.from(products, {
      y: 70,
      autoAlpha: 0,
      duration: 1.2,
      stagger: 0.12,
      ease: 'expo.out',
      scrollTrigger: { trigger: products[0].parentElement, start: 'top 80%', once: true },
    });
  }

  qa('[data-stat]').forEach((stat, i) => {
    gsap.from(stat, {
      y: 40,
      autoAlpha: 0,
      duration: 1,
      delay: (i % 4) * 0.08,
      ease: 'power3.out',
      scrollTrigger: { trigger: stat, start: 'top 90%', once: true },
    });
  });

  // Count-ups keep their real value in the markup until they animate
  qa('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    const o = { v: 0 };
    gsap.to(o, {
      v: end,
      duration: 1.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => { el.textContent = (0).toFixed(decimals); },
      },
      onUpdate: () => { el.textContent = o.v.toFixed(decimals); },
    });
  });

  const range = root.querySelector('[data-range]');
  if (range) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: range, start: 'top 80%', once: true } });
    const mark = range.querySelector('[data-range-mark]');
    if (mark) tl.from(mark, { scaleY: 0, duration: 0.6, ease: 'power3.out' }, 0);
    tl.from(range.querySelector('[data-range-band]'), { scaleX: 0, duration: 1.4, ease: 'expo.out' }, 0.2)
      .from(range.querySelectorAll('.range__notes li'), { y: 12, autoAlpha: 0, stagger: 0.1, duration: 0.7 }, 0.5);
  }

  // Resources rows
  qa('.res__list li').forEach((li) => {
    gsap.from(li, {
      y: 20,
      autoAlpha: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: li, start: 'top 94%', once: true },
    });
  });

  // Footer wordmark rises letter by letter
  if (word) {
    SplitText.create(word, {
      type: 'chars',
      mask: 'chars',
      onSplit: (self) => {
        fit(); // splitting drops kerning, so measure again
        return gsap.from(self.chars, {
          yPercent: 100,
          duration: 1.2,
          stagger: 0.035,
          ease: 'expo.out',
          scrollTrigger: { trigger: word, start: 'top 98%', once: true },
        });
      },
    });
  }
}
