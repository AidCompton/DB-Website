// Procedural canvas textures: asphalt, grass, truck livery, glows.
// Everything is drawn at runtime so the site ships without image assets.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const INK = '#0d0f12';
const SIGNAL = '#ffc21a';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas, renderer, { repeat = false, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

// Canvas text in the site's display face. `stretch` uses canvas fontStretch
// where supported and falls back to a horizontal scale. Returns drawn width.
function setWide(ctx, size, weight, stretch, spacing) {
  let scaleX = 1;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch;
  else if (stretch === 'expanded') scaleX = 1.16;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.font = `${weight} ${size}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  return scaleX;
}

function measureWide(ctx, text, size, { weight = 800, stretch = 'expanded', spacing = 0 } = {}) {
  ctx.save();
  const scaleX = setWide(ctx, size, weight, stretch, spacing);
  const w = ctx.measureText(text).width * scaleX;
  ctx.restore();
  return w;
}

function drawWide(ctx, text, x, y, size, { weight = 800, stretch = 'expanded', color = INK, spacing = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const scaleX = setWide(ctx, size, weight, stretch, spacing);
  ctx.translate(x, y);
  ctx.scale(scaleX, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawMono(ctx, text, x, y, size, { color = INK, align = 'left', spacing = 3, weight = 500 } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.font = `${weight} ${size}px "Martian Mono", ui-monospace, Menlo, monospace`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawMark(ctx, cx, cy, r, color = INK, dot = SIGNAL) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.69, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - r * 0.56);
  ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy + r * 0.56);
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx - r * 0.56, cy);
  ctx.moveTo(cx + r, cy); ctx.lineTo(cx + r * 0.56, cy);
  ctx.stroke();
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- road
// u runs across one carriageway (median edge -> outer verge, 10.6 m),
// v runs along the road (one tile = 12 m).
export function asphaltTexture(renderer) {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3c40';
  ctx.fillRect(0, 0, S, S);

  const rand = mulberry32(11);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let n = (rand() - 0.5) * 34;
    const r = rand();
    if (r < 0.035) n += 34;
    else if (r < 0.08) n -= 26;
    d[i] += n; d[i + 1] += n; d[i + 2] += n + 1;
  }
  ctx.putImageData(img, 0, 0);

  const toX = (lat) => ((lat - 3.0) / 10.6) * S;
  // Worn wheel paths in both lanes
  const paths = [4.5, 6.4, 8.2, 10.1];
  for (const lat of paths) {
    const x = toX(lat);
    const g = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    g.addColorStop(0, 'rgba(12,12,14,0)');
    g.addColorStop(0.5, 'rgba(12,12,14,0.3)');
    g.addColorStop(1, 'rgba(12,12,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 16, 0, 32, S);
  }
  // Lighter, rougher shoulders
  ctx.fillStyle = 'rgba(210,205,190,0.07)';
  ctx.fillRect(toX(11.0), 0, S - toX(11.0), S);
  ctx.fillRect(0, 0, toX(3.6), S);
  // A few patch repairs and oil stains
  for (let i = 0; i < 7; i++) {
    const x = toX(3.8 + rand() * 7), y = rand() * S;
    ctx.fillStyle = `rgba(8,8,10,${0.08 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + rand() * 14, 10 + rand() * 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = finish(c, renderer);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function gravelTexture(renderer) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d2c4';
  ctx.fillRect(0, 0, S, S);
  const rand = mulberry32(5);
  for (let i = 0; i < 5000; i++) {
    const v = 150 + rand() * 105;
    ctx.fillStyle = `rgba(${v},${v - 8},${v - 20},${0.35 + rand() * 0.5})`;
    const s = 1 + rand() * 2.2;
    ctx.fillRect(rand() * S, rand() * S, s, s);
  }
  return finish(c, renderer, { repeat: true });
}

// Near-white grass detail; multiplied with terrain vertex colours.
export function grassTexture(renderer) {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e2e0d6';
  ctx.fillRect(0, 0, S, S);
  const rand = mulberry32(3);
  ctx.lineCap = 'round';
  for (let i = 0; i < 14000; i++) {
    const x = rand() * S, y = rand() * S;
    const a = rand() * Math.PI * 2, l = 1.5 + rand() * 4.5;
    const v = rand();
    ctx.strokeStyle = v < 0.5 ? `rgba(110,106,82,${0.08 + v * 0.22})` : `rgba(255,250,228,${0.08 + (v - 0.5) * 0.35})`;
    ctx.lineWidth = 0.8 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return finish(c, renderer, { repeat: true });
}

// ---------------------------------------------------------------- livery
// Trailer side, 13.6 m x 2.75 m. `frontLeft` puts the front of the trailer at
// the left of the canvas (the truck's left-hand side).
export function trailerSideTexture(renderer, { frontLeft = true } = {}) {
  const W = 2048, H = 414;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f1f0eb';
  ctx.fillRect(0, 0, W, H);

  // Panel seams
  ctx.fillStyle = 'rgba(13,15,18,0.06)';
  for (let x = 90; x < W; x += 150) ctx.fillRect(x, 0, 2, H);
  // Top rail + bottom rail
  ctx.fillStyle = 'rgba(13,15,18,0.14)';
  ctx.fillRect(0, 0, W, 10);
  ctx.fillRect(0, H - 14, W, 14);
  // Yellow band with contour-marking dashes
  ctx.fillStyle = SIGNAL;
  ctx.fillRect(0, H * 0.8, W, H * 0.1);
  ctx.fillStyle = INK;
  ctx.fillRect(0, H * 0.8 - 5, W, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let x = 0; x < W; x += 64) ctx.fillRect(x, H * 0.905, 34, 7);

  const opts = { weight: 850 };
  let size = 150;
  const maxW = W - 520;
  let w = measureWide(ctx, 'DRIVER BUREAU', size, opts);
  if (w > maxW) { size *= maxW / w; w = maxW; }
  const markX = frontLeft ? 170 : W - 170;
  const textX = frontLeft ? 300 : W - 300 - w;
  drawMark(ctx, markX, H * 0.42, 92);
  drawWide(ctx, 'DRIVER BUREAU', textX, H * 0.52, size, opts);
  drawMono(ctx, 'PSYCHOMOTOR TRAINING & RISK REDUCTION', textX + 6, H * 0.69, 28, { color: 'rgba(13,15,18,0.62)', spacing: 5 });
  // Web address sits in the yellow band at the rear of the trailer
  drawMono(ctx, 'driverib.com', frontLeft ? W - 40 : 40, H * 0.878, 26, { align: frontLeft ? 'right' : 'left', color: INK, spacing: 2, weight: 600 });
  return finish(c, renderer);
}

// Roof decal, read from the drone view. Canvas x runs front -> rear and the
// top of the canvas faces the truck's right-hand side.
export function trailerRoofTexture(renderer) {
  const W = 2048, H = 384;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ecebe5';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(21);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(80,76,66,${0.02 + rand() * 0.04})`;
    ctx.fillRect(rand() * W, 0, 1 + rand() * 6, H);
  }
  ctx.fillStyle = 'rgba(13,15,18,0.05)';
  for (let x = 40; x < W; x += 76) ctx.fillRect(x, 0, 3, H);
  // Chevrons at the front, pointing the way the truck drives
  ctx.fillStyle = SIGNAL;
  for (let i = 0; i < 3; i++) {
    const x = 70 + i * 64;
    ctx.beginPath();
    ctx.moveTo(x + 90, H * 0.14);
    ctx.lineTo(x + 50, H * 0.14);
    ctx.lineTo(x, H * 0.5);
    ctx.lineTo(x + 50, H * 0.86);
    ctx.lineTo(x + 90, H * 0.86);
    ctx.lineTo(x + 40, H * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  drawMark(ctx, 420, H * 0.5, 120);
  let rs = 190;
  const rw = measureWide(ctx, 'DRIVER BUREAU', rs, { weight: 900 });
  const room = W - 590 - 90;
  if (rw > room) rs *= room / rw;
  drawWide(ctx, 'DRIVER BUREAU', 590, H * 0.5 + rs * 0.36, rs, { weight: 900 });
  ctx.fillStyle = 'rgba(13,15,18,0.18)';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);
  return finish(c, renderer);
}

export function trailerRearTexture(renderer) {
  const W = 512, H = 552;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e8e2';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(13,15,18,0.35)';
  ctx.fillRect(W / 2 - 2, 0, 4, H);
  ctx.fillStyle = 'rgba(13,15,18,0.12)';
  ctx.fillRect(0, 0, W, 12);
  ctx.fillRect(0, 0, 12, H);
  ctx.fillRect(W - 12, 0, 12, H);
  // Locking bars
  ctx.fillStyle = '#9da2a8';
  for (const x of [70, 176, 336, 442]) ctx.fillRect(x - 5, 16, 10, H - 30);
  ctx.fillStyle = '#6b7076';
  for (const x of [70, 176, 336, 442]) ctx.fillRect(x - 16, H * 0.56, 32, 14);
  // Red/white conspicuity tape
  for (let x = 0; x < W; x += 48) {
    ctx.fillStyle = (x / 48) % 2 ? '#f4f2ee' : '#d0271d';
    ctx.fillRect(x, H - 44, 48, 20);
  }
  drawMono(ctx, 'DRIVERIB.COM', W / 2, H * 0.4, 22, { align: 'center', color: 'rgba(13,15,18,0.55)', spacing: 4 });
  return finish(c, renderer);
}

export function badgeTexture(renderer) {
  const S = 128;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  ctx.fill();
  drawMark(ctx, S / 2, S / 2, S * 0.38, '#f1f0eb', SIGNAL);
  return finish(c, renderer);
}

// ---------------------------------------------------------------- light
export function glowTexture(renderer) {
  const S = 128;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finish(c, renderer);
}

// Horizontal anamorphic streak for headlight flares
export function streakTexture(renderer) {
  const W = 256, H = 32;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.5, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return finish(c, renderer);
}

// Fan-shaped pool of headlight on the road. Canvas top = far end of the beam.
export function beamTexture(renderer) {
  const W = 256, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, H, 0, 0);
  grd.addColorStop(0, 'rgba(255,240,210,0.95)');
  grd.addColorStop(0.35, 'rgba(255,236,200,0.45)');
  grd.addColorStop(1, 'rgba(255,230,190,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(W * 0.38, H);
  ctx.lineTo(W * 0.62, H);
  ctx.lineTo(W, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  // soften the edges
  const edge = ctx.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.3, 'rgba(0,0,0,0)');
  edge.addColorStop(0.7, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  return finish(c, renderer);
}

// Soft blobs for moving cloud shadows (single channel, repeat)
export function cloudTexture(renderer) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  const rand = mulberry32(9);
  for (let i = 0; i < 9; i++) {
    const x = rand() * S, y = rand() * S, r = 30 + rand() * 50;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return finish(c, renderer, { repeat: true, srgb: false });
}
