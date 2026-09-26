// "How quick are your reactions?" A three-attempt simple reaction test.
import { gsap } from 'gsap';

export function initReaction(ctx) {
  const { root, env } = ctx;
  const wrap = root.querySelector('[data-reaction]');
  if (!wrap) return;
  const pad = wrap.querySelector('[data-reaction-pad]');
  const big = wrap.querySelector('[data-reaction-big]');
  const small = wrap.querySelector('[data-reaction-small]');
  const slots = Array.from(wrap.querySelectorAll('[data-reaction-attempts] b'));
  const avgEl = wrap.querySelector('[data-reaction-avg]');
  const live = wrap.querySelector('[data-reaction-live]');

  let state = 'idle';
  let timer = 0;
  let goAt = 0;
  let results = [];

  function set(next, bigText, smallText) {
    state = next;
    pad.dataset.state = next;
    big.textContent = bigText;
    small.textContent = smallText;
  }

  function pop() {
    if (!env.reduced) gsap.fromTo(big, { scale: 0.86 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
  }

  function reset() {
    results = [];
    slots.forEach((s) => { s.textContent = '–'; });
    avgEl.textContent = '–';
  }

  function arm() {
    set('wait', 'Wait…', 'Tap when it turns yellow');
    const delay = 1200 + Math.random() * 2300;
    timer = window.setTimeout(() => {
      goAt = performance.now();
      set('go', 'Tap!', 'Now');
    }, delay);
  }

  function press() {
    if (state === 'wait') {
      window.clearTimeout(timer);
      set('early', 'Too soon', 'Wait for yellow · tap to retry');
      live.textContent = 'Too soon. Wait for the pad to turn yellow.';
      pop();
      return;
    }
    if (state === 'go') {
      const ms = Math.round(performance.now() - goAt);
      results.push(ms);
      slots[results.length - 1].textContent = `${ms}`;
      if (results.length >= 3) {
        const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
        avgEl.textContent = `${avg} ms`;
        set('done', `${avg} ms`, 'Your average · tap to go again');
        live.textContent = `Your average reaction time is ${avg} milliseconds.`;
      } else {
        set('result', `${ms} ms`, `Attempt ${results.length} of 3 · tap for the next`);
        live.textContent = `${ms} milliseconds.`;
      }
      pop();
      return;
    }
    if (state === 'done') reset();
    arm();
  }

  pad.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    press();
  });
  pad.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) press();
    }
  });
  // Keyboard/assistive "click" without a pointerdown (e.g. screen readers)
  pad.addEventListener('click', (e) => {
    if (e.detail === 0) press();
  });
}
