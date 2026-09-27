// Build script. Produces:
//   dist/index.html + dist/assets/*       standalone site (preview, any static host)
//   dist/driver-bureau-embed.html         single file for a Wix "Embed HTML" element
//   dist/wix/driver-bureau-element.js     Wix Custom Element (recommended)
//   dist/preview/driver-bureau.html       page fragment used for the claude.ai preview
//
//   node build.mjs          one-off build
//   node build.mjs --watch  rebuild when src/ changes
import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { LOGO_PIECES, LOGO_VIEWBOX, BRAND_BLUE } from './src/js/brand.js';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const r = (...p) => path.join(ROOT, ...p);

// Brand typeface (Driver Bureau brand guidelines): Montserrat
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap';
const TITLE = 'Driver Bureau | Fleet safety through psychomotor training';
const DESCRIPTION =
  "Driver Bureau profiles each driver's psychomotor ability and trains it with individualised programmes, for a 28% to 55% improvement in harsh braking and acceleration.";

// Inline SVG of the monogram. Each of the four pieces is its own path so the
// preloader can assemble it.
const logoSvg = () =>
  `<svg class="logo-mark" viewBox="${LOGO_VIEWBOX.join(' ')}" aria-hidden="true" focusable="false">` +
  Object.entries(LOGO_PIECES).map(([k, d]) => `<path data-piece="${k}" d="${d}"/>`).join('') +
  '</svg>';
const withLogos = (html) => html.replace(/<!--logo-->/g, logoSvg());

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 ${LOGO_VIEWBOX[2] + 48} ${LOGO_VIEWBOX[3] + 48}">` +
    `<path fill="${BRAND_BLUE}" fill-rule="evenodd" d="${Object.values(LOGO_PIECES).join('')}"/></svg>`
)}`;

const HEAD_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_URL}">`;

// Styles for the Wix overlay (shadow DOM host + its scroll container)
const HOST_CSS = `
:host { all: initial; }
.db-scroller {
  position: fixed; inset: 0;
  overflow-x: hidden; overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: #0e243e;
  scrollbar-width: thin;
  scrollbar-color: #8bb3e4 transparent;
  outline: none;
}
/* Keep the scrollbar's space while locked (preloader): no sideways shift */
.db-scroller.lenis-stopped { overflow: hidden; scrollbar-gutter: stable; }
.db-scroller.lenis-smooth { scroll-behavior: auto; }
`;

const inlineScript = (js) => js.replace(/<\/script/gi, '<\\/script');

// Pages that are their own document switch to the scripted layout as soon as
// the root is parsed, so the preloader covers everything from the first paint
// (instead of the static page flashing up while the big script loads). If
// the script never mounts, the static page comes back once the page loads.
// (The Wix element mounts synchronously, so it doesn't need this.)
const EARLY_JS = `<script>(function(){var r=document.currentScript.parentNode;r.classList.add('js');addEventListener('load',function(){if(!r.__dbMounted)r.classList.remove('js')})})()</script>`;
const withEarlyJs = (markup) => markup.replace('<div class="db" data-db-root>', (m) => `${m}\n${EARLY_JS}`);

async function bundleJs() {
  const out = await esbuild.build({
    entryPoints: [r('src/js/main.js')],
    bundle: true,
    format: 'iife',
    globalName: 'DriverBureau',
    minify: true,
    target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
    legalComments: 'eof',
    write: false,
    logLevel: 'warning',
  });
  return out.outputFiles[0].text;
}

async function bundleCss(entry) {
  const out = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    target: ['chrome111', 'safari16.2', 'firefox113'],
    write: false,
    logLevel: 'warning',
    loader: { '.css': 'css' },
  });
  return out.outputFiles[0].text;
}

function page({ css, js, markup, cssHref, jsSrc, embed = false }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta name="theme-color" content="#0e243e">
<link rel="icon" href="${FAVICON}">
${embed ? '<base target="_top">\n' : ''}${HEAD_FONTS}
${cssHref ? `<link rel="stylesheet" href="${cssHref}">` : `<style>${css}</style>`}
</head>
<body>
${markup}
${jsSrc ? `<script src="${jsSrc}"></script>` : `<script>${inlineScript(js)}</script>`}
<script>DriverBureau.mount();</script>
</body>
</html>
`;
}

function artifactFragment({ css, js, markup }) {
  // The claude.ai artifact host supplies <html>/<head>/<body> itself.
  return `<title>Driver Bureau</title>
<meta name="description" content="${DESCRIPTION}">
${HEAD_FONTS}
<style>${css}</style>
${markup}
<script>${inlineScript(js)}</script>
<script>DriverBureau.mount();</script>
`;
}

function wixElement({ css, js, markup, stamp }) {
  return `/*!
 * Driver Bureau website: Wix Custom Element  <driver-bureau-site>
 * Built ${stamp}. Source: src/ (see README.md). Includes GSAP (standard
 * no-charge licence), three.js (MIT) and Lenis (MIT); licences at the end.
 *
 * Attributes
 *   mode="auto"   (default) full-screen experience on the live site, a small
 *                 placeholder inside the Wix editor
 *   mode="live"   always render (set from Velo to see it in Preview)
 *   mode="off"    placeholder only
 *   book-url, portal-url, resources-url, faqs-url, about-url,
 *   case-studies-url, use-cases-url   override link targets
 *   z-index       stacking order of the overlay (default 9000)
 */
(function () {
  'use strict';
  if (window.customElements.get('driver-bureau-site')) return;

  var FONTS_URL = ${JSON.stringify(FONTS_URL)};
  var CSS = ${JSON.stringify(HOST_CSS + css)};
  var HTML = ${JSON.stringify(markup)};
  var LINK_KEYS = ['book', 'portal', 'resources', 'faqs', 'about', 'case-studies', 'use-cases'];

${js}

  function ensureFonts() {
    if (document.querySelector('link[data-driver-bureau-fonts]')) return;
    var pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = 'https://fonts.gstatic.com';
    pre.crossOrigin = 'anonymous';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    link.setAttribute('data-driver-bureau-fonts', '');
    document.head.appendChild(pre);
    document.head.appendChild(link);
  }

  var PLACEHOLDER =
    '<style>:host{display:block;height:100%;min-height:120px}' +
    '.ph{box-sizing:border-box;height:100%;min-height:120px;display:grid;place-content:center;gap:8px;padding:24px;' +
    'background:#0e243e;color:#fff;font:500 13px/1.5 Montserrat,system-ui,sans-serif;text-align:center;border:2px dashed #8bb3e4}' +
    '.ph b{font-size:15px;letter-spacing:.04em}.ph span{opacity:.7}</style>' +
    '<div class="ph"><b>DRIVER BUREAU</b><span>Full-screen scroll experience. It takes over the page on the published site.</span>' +
    '<span>To see it in Preview, set mode="live" from page code.</span></div>';

  class DriverBureauSite extends HTMLElement {
    static get observedAttributes() { return ['mode']; }

    connectedCallback() { this._render(); }
    attributeChangedCallback() { if (this.isConnected) this._render(); }
    disconnectedCallback() { this._teardown(); }

    _takeOver() {
      var mode = String(this.getAttribute('mode') || 'auto').toLowerCase();
      if (mode === 'off') return false;
      if (mode === 'live' || mode === 'on') return true;
      try { return window.top === window.self; } catch (e) { return false; }
    }

    _render() {
      if (!this._own) this._own = this.attachShadow({ mode: 'open' });
      if (this._takeOver()) {
        this._own.innerHTML = '';
        this._mount();
      } else {
        this._teardown();
        this._own.innerHTML = PLACEHOLDER;
      }
    }

    _links() {
      var map = {};
      for (var i = 0; i < LINK_KEYS.length; i++) {
        var v = this.getAttribute(LINK_KEYS[i] + '-url');
        if (v) map[LINK_KEYS[i]] = v;
      }
      return map;
    }

    _mount() {
      if (this._host) return;
      ensureFonts();
      var host = document.createElement('div');
      host.setAttribute('data-driver-bureau', '');
      host.style.cssText = 'position:fixed;inset:0;z-index:' + (this.getAttribute('z-index') || '9000') + ';';
      var shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<style>' + CSS + '</style><div class="db-scroller" data-db-scroller tabindex="-1">' + HTML + '</div>';
      document.body.appendChild(host);
      this._host = host;
      this._overflow = [document.documentElement.style.overflow, document.body.style.overflow];
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      var scroller = shadow.querySelector('[data-db-scroller]');
      scroller.focus({ preventScroll: true });
      var self = this;
      DriverBureau.mount({ root: shadow, scroller: scroller, links: this._links() })
        .then(function (app) { self._app = app; })
        .catch(function (err) { console.error('[Driver Bureau] failed to start', err); });
    }

    _teardown() {
      if (this._app) { try { this._app.destroy(); } catch (e) {} }
      this._app = null;
      if (this._host) {
        this._host.remove();
        this._host = null;
        document.documentElement.style.overflow = this._overflow[0];
        document.body.style.overflow = this._overflow[1];
      }
    }
  }

  window.customElements.define('driver-bureau-site', DriverBureauSite);
})();
`;
}

async function build() {
  const t0 = Date.now();
  const [js, css, standaloneCss, markupRaw] = await Promise.all([
    bundleJs(),
    bundleCss(r('src/styles/main.css')),
    bundleCss(r('src/styles/standalone.css')),
    readFile(r('src/site.html'), 'utf8'),
  ]);
  const markup = withLogos(markupRaw.trim());
  const docMarkup = withEarlyJs(markup);
  if (docMarkup === markup) throw new Error('site.html: root element not found for the early script');
  const pageCss = standaloneCss + css;
  const stamp = new Date().toISOString().slice(0, 10);

  await mkdir(r('dist/assets'), { recursive: true });
  await mkdir(r('dist/wix'), { recursive: true });
  await mkdir(r('dist/preview'), { recursive: true });

  await Promise.all([
    writeFile(r('dist/assets/app.js'), js),
    writeFile(r('dist/assets/site.css'), pageCss),
    writeFile(r('dist/index.html'), page({ markup: docMarkup, cssHref: 'assets/site.css', jsSrc: 'assets/app.js' })),
    writeFile(r('dist/driver-bureau-embed.html'), page({ css: pageCss, js, markup: docMarkup, embed: true })),
    writeFile(r('dist/wix/driver-bureau-element.js'), wixElement({ css, js, markup, stamp })),
    writeFile(r('dist/preview/driver-bureau.html'), artifactFragment({ css: pageCss, js, markup: docMarkup })),
    copyFile(r('src/wix/velo-page-code.js'), r('dist/wix/velo-page-code.js')),
  ]);
  const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
  console.log(`built in ${Date.now() - t0} ms  (js ${kb(js)}, css ${kb(pageCss)})`);
}

await build();

if (process.argv.includes('--watch')) {
  let timer = 0;
  watch(r('src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120);
  });
  console.log('watching src/ ...');
}
