// Driver Bureau livery, painted on canvases at runtime: the official monogram
// (vector, from brand.js), the name set in Montserrat Bold, brand blue #24599A
// on white. Includes light road grime so the trailer doesn't look brand new.
import * as THREE from 'three';
import { LOGO_PIECES, LOGO_VIEWBOX, BRAND_BLUE } from '../brand.js';
import { mulberry32 } from './noise.js';

const WHITE = '#f4f6f8';
const INK = '#0b1b2e';
const FONT = 'Montserrat, "Helvetica Neue", Arial, sans-serif';

const logoPaths = () => Object.values(LOGO_PIECES).map((d) => new Path2D(d));

// The blue block at the back of the trailer, as a fraction of its length.
// The sides and the roof both use it, so the two blocks line up.
export const REAR_BLOCK = 0.2;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, renderer, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate = true;
  return t;
}

// Monogram with its top-left at (x, y), `h` pixels tall
export function drawLogo(ctx, x, y, h, color = BRAND_BLUE) {
  const s = h / LOGO_VIEWBOX[3];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  for (const p of logoPaths()) ctx.fill(p, 'evenodd');
  ctx.restore();
  return LOGO_VIEWBOX[2] * s; // drawn width
}

function text(ctx, str, x, y, size, { weight = 700, color = INK, align = 'left', spacing = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function measure(ctx, str, size, { weight = 700, spacing = 0 } = {}) {
  ctx.save();
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.font = `${weight} ${size}px ${FONT}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// Road film: darker toward the bottom, heavier behind the wheels, faint
// vertical rain streaks from the top rail.
function grime(ctx, W, H, seed, { bottom = 0.3, wheelsAt = [] } = {}) {
  const rand = mulberry32(seed);
  const g = ctx.createLinearGradient(0, H, 0, H * 0.45);
  g.addColorStop(0, `rgba(88,74,56,${bottom})`);
  g.addColorStop(0.35, `rgba(88,74,56,${bottom * 0.3})`);
  g.addColorStop(1, 'rgba(88,74,56,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const wx of wheelsAt) {
    const r = ctx.createRadialGradient(wx, H, 0, wx, H, H * 0.55);
    r.addColorStop(0, 'rgba(70,58,44,0.22)');
    r.addColorStop(1, 'rgba(70,58,44,0)');
    ctx.fillStyle = r;
    ctx.fillRect(wx - H * 0.6, H * 0.4, H * 1.2, H * 0.6);
  }
  for (let i = 0; i < 140; i++) {
    const x = rand() * W;
    const len = H * (0.08 + rand() * 0.35);
    const a = 0.015 + rand() * 0.035;
    const s = ctx.createLinearGradient(0, 0, 0, len);
    s.addColorStop(0, `rgba(60,56,50,${a})`);
    s.addColorStop(1, 'rgba(60,56,50,0)');
    ctx.fillStyle = s;
    ctx.fillRect(x, 0, 1 + rand() * 2.5, len);
  }
}

// Trailer side, 13.6 m x 2.72 m. `frontAt` = 'left' when the trailer's front
// is at the canvas's left edge (the truck's left-hand side). The lockup
// (monogram, then name) is never mirrored; it sits at the front on both sides,
// and a solid brand-blue block carries the web address at the rear.
export function trailerSide(renderer, { frontAt = 'left' } = {}) {
  const W = 4096, H = 820;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const front = frontAt === 'left';
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, W, H);

  // Rear block (square: 20% of 13.6 m is the 2.72 m height) and a thin band
  // along the bottom
  const blockW = Math.round(W * REAR_BLOCK);
  ctx.fillStyle = BRAND_BLUE;
  ctx.fillRect(front ? W - blockW : 0, 0, blockW, H);
  ctx.fillRect(0, H - 40, W, 40);
  const bx = front ? W - blockW / 2 : blockW / 2;
  const smallH = 170;
  const smallW = (LOGO_VIEWBOX[2] / LOGO_VIEWBOX[3]) * smallH;
  drawLogo(ctx, bx - smallW / 2, H * 0.2, smallH, '#ffffff');
  text(ctx, 'driverib.com', bx, H * 0.2 + smallH + 120, 88, { weight: 600, color: '#ffffff', align: 'center' });

  // Lockup: monogram + name, with the brand line underneath
  const markH = H * 0.5;
  const markW = (LOGO_VIEWBOX[2] / LOGO_VIEWBOX[3]) * markH;
  const name = 'Driver Bureau';
  const gap = 90;
  let size = 290;
  const room = W - blockW - 400 - markW - gap;
  if (measure(ctx, name, size) > room) size *= room / measure(ctx, name, size);
  const nw = measure(ctx, name, size);
  const lockW = markW + gap + nw;
  const x0 = front ? 200 : W - 200 - lockW;
  drawLogo(ctx, x0, H * 0.2, markH);
  const textX = x0 + markW + gap;
  text(ctx, name, textX, H * 0.55, size, { color: BRAND_BLUE });
  const tag = 'Because Peace of Mind Matters';
  let ts = 84;
  const tw = measure(ctx, tag, ts, { weight: 500 });
  if (tw > nw) ts *= nw / tw;
  text(ctx, tag, textX + 6, H * 0.55 + ts * 1.9, ts, { weight: 500, color: INK });

  // Panel joints, then road film
  ctx.fillStyle = 'rgba(11,27,46,0.05)';
  for (let x = 205; x < W; x += 410) ctx.fillRect(x, 0, 3, H - 40);
  const wheels = front ? [W * 0.66, W * 0.72, W * 0.78] : [W * 0.34, W * 0.28, W * 0.22];
  grime(ctx, W, H, front ? 31 : 32, { bottom: 0.22, wheelsAt: wheels });
  return toTexture(c, renderer);
}

// Roof, read from the drone shot. Canvas x runs front -> rear; the canvas top
// faces the truck's right-hand side.
// span: the share of the trailer's length the roof decal covers (it stops just
// short of the rounded edges), so the blue block can match the sides exactly
export function trailerRoof(renderer, { span = 1 } = {}) {
  const W = 4096, H = 768;
  const blockX = (W * (1 - REAR_BLOCK - (1 - span) / 2)) / span;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eef1f3';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(21);
  // Roof bows and dust
  ctx.fillStyle = 'rgba(11,27,46,0.05)';
  for (let x = 60; x < W; x += 150) ctx.fillRect(x, 0, 4, H);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(96,84,66,${0.015 + rand() * 0.04})`;
    const r = 20 + rand() * 120;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, r * 2.5, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const markH = H * 0.62;
  const mw = drawLogo(ctx, 260, (H - markH) / 2, markH);
  let size = 330;
  const room = blockX - 260 - (260 + mw + 110);
  const w = measure(ctx, 'Driver Bureau', size);
  if (w > room) size *= room / w;
  text(ctx, 'Driver Bureau', 260 + mw + 110, H / 2 + size * 0.36, size, { color: BRAND_BLUE });
  ctx.fillStyle = BRAND_BLUE;
  ctx.fillRect(blockX, 0, W - blockX, H);
  text(ctx, 'driverib.com', (blockX + W) / 2, H / 2 + 34, 96, { weight: 600, color: '#ffffff', align: 'center' });
  return toTexture(c, renderer);
}

// Rear doors, 2.55 m x 2.72 m
export function trailerRear(renderer) {
  const W = 1024, H = 1092;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, W, H);
  // Door split, frame shading
  ctx.fillStyle = 'rgba(11,27,46,0.5)';
  ctx.fillRect(W / 2 - 3, 0, 6, H);
  ctx.fillStyle = 'rgba(11,27,46,0.08)';
  ctx.fillRect(0, 0, W, 16);
  const markH = 250;
  const mw = (LOGO_VIEWBOX[2] / LOGO_VIEWBOX[3]) * markH;
  drawLogo(ctx, (W - mw) / 2, H * 0.2, markH);
  text(ctx, 'Driver Bureau', W / 2, H * 0.2 + markH + 110, 84, { color: BRAND_BLUE, align: 'center' });
  text(ctx, 'driverib.com', W / 2, H * 0.2 + markH + 190, 44, { weight: 500, color: INK, align: 'center' });
  // Red and white retro-reflective tape
  for (let x = 0; x < W; x += 80) {
    ctx.fillStyle = (x / 80) % 2 ? '#f4f2ee' : '#c8261c';
    ctx.fillRect(x, H - 92, 80, 40);
  }
  for (let y = 40; y < H - 120; y += 80) {
    for (const x of [8, W - 38]) {
      ctx.fillStyle = (y / 80) % 2 ? '#f4f2ee' : '#c8261c';
      ctx.fillRect(x, y, 30, 80);
    }
  }
  grime(ctx, W, H, 44, { bottom: 0.34 });
  return toTexture(c, renderer);
}

// Door decal on the tractor: white monogram and name on the blue paint
export function doorDecal(renderer) {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const markH = 200;
  const mw = drawLogo(ctx, 40, 56, markH, '#ffffff');
  const x = 40 + mw + 46;
  text(ctx, 'Driver', x, 150, 100, { color: '#ffffff' });
  text(ctx, 'Bureau', x, 252, 100, { color: '#ffffff' });
  text(ctx, 'driverib.com', 44, 390, 54, { weight: 500, color: 'rgba(255,255,255,0.88)' });
  return toTexture(c, renderer);
}

// Lettering on the sun visor
export function visorDecal(renderer) {
  const W = 2048, H = 160;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  text(ctx, 'DRIVER BUREAU', W / 2, H * 0.72, 104, { color: '#ffffff', align: 'center', spacing: 26 });
  return toTexture(c, renderer);
}

// Grille badge: the monogram in brushed silver on a transparent ground
export function badge(renderer) {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const h = S * 0.86;
  const w = (LOGO_VIEWBOX[2] / LOGO_VIEWBOX[3]) * h;
  drawLogo(ctx, (S - w) / 2, (S - h) / 2, h, '#ffffff');
  return toTexture(c, renderer);
}

// South African style number plate (reflective white, black characters)
export function numberPlate(renderer, str = 'ND 245-99') {
  const W = 1040, H = 220;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f7f2';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  text(ctx, str, W / 2, H * 0.74, 150, { weight: 700, color: '#111', align: 'center', spacing: 4 });
  return toTexture(c, renderer);
}
