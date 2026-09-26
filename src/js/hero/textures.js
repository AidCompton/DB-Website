// Procedural textures, painted on canvases at load time so the site ships
// without image files: road aggregate, grass, foliage, bark, tyre tread,
// grille mesh, lamp glows. Height maps are converted to normal maps here too.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function finish(canvas, renderer, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  else tex.colorSpace = THREE.NoColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

// Tileable value noise (period p cells), used for height/colour variation
function tileNoise(seed, period) {
  const rand = mulberry32(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const at = (x, y) => g[((y % period + period) % period) * period + ((x % period + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// fbm over a tile of `size` px with `cells` noise cells across (tileable)
function fbmField(size, cells, octaves, seed) {
  const out = new Float32Array(size * size);
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(tileNoise(seed + o * 17, cells << o));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0, a = 0.5, n = 0;
      for (let o = 0; o < octaves; o++) {
        const f = (cells << o) / size;
        s += a * layers[o](x * f, y * f);
        n += a;
        a *= 0.5;
      }
      out[y * size + x] = s / n;
    }
  }
  return out;
}

// Height (canvas red channel, or a Float32Array) -> tangent-space normal map
export function heightToNormal(src, w, h, strength = 2, wrap = true) {
  let H;
  if (src instanceof Float32Array) H = src;
  else {
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    H = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) H[i] = d[i * 4] / 255;
  }
  const at = wrap
    ? (x, y) => H[((y + h) % h) * w + ((x + w) % w)]
    : (x, y) => H[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength; // canvas y runs down = -v
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------- road
// Fine asphalt aggregate, tileable, ~1.6 m across. Returns map, normal, rough.
export function asphaltDetail(renderer) {
  const S = 512;
  const rand = mulberry32(12);
  const col = makeCanvas(S, S);
  const hgt = makeCanvas(S, S);
  const cx = col.getContext('2d');
  const hx = hgt.getContext('2d');
  const base = fbmField(S, 8, 4, 40);
  const img = cx.createImageData(S, S);
  const himg = hx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = base[i];
    const v = 46 + (n - 0.5) * 26 + (rand() - 0.5) * 18;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v + 1;
    img.data[i * 4 + 2] = v + 3;
    img.data[i * 4 + 3] = 255;
    const hv = 70 + (n - 0.5) * 50 + (rand() - 0.5) * 30;
    himg.data[i * 4] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = hv;
    himg.data[i * 4 + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  hx.putImageData(himg, 0, 0);
  // Aggregate stones: lighter chips proud of the binder, wrapped at edges
  for (let i = 0; i < 5200; i++) {
    const x = rand() * S, y = rand() * S;
    const r = 0.8 + Math.pow(rand(), 2.2) * 5.5;
    const t = rand();
    const lum = t < 0.7 ? 70 + rand() * 50 : 120 + rand() * 60;
    const warm = rand() * 10;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (x + ox < -8 || x + ox > S + 8 || y + oy < -8 || y + oy > S + 8) continue;
      cx.fillStyle = `rgba(${lum + warm},${lum + warm * 0.5},${lum},${0.55 + rand() * 0.4})`;
      cx.beginPath();
      cx.ellipse(x + ox, y + oy, r, r * (0.6 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
      cx.fill();
      const g = hx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r * 1.2);
      g.addColorStop(0, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      hx.fillStyle = g;
      hx.fillRect(x + ox - r * 1.2, y + oy - r * 1.2, r * 2.4, r * 2.4);
    }
  }
  const nrm = heightToNormal(hgt, S, S, 3.2);
  // Roughness: binder rough, polished stone tops a little smoother
  const rough = makeCanvas(S, S);
  const rx = rough.getContext('2d');
  const hd = hx.getImageData(0, 0, S, S).data;
  const rimg = rx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const r = 240 - hd[i * 4] * 0.28;
    rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = r;
    rimg.data[i * 4 + 3] = 255;
  }
  rx.putImageData(rimg, 0, 0);
  return {
    map: finish(col, renderer, { repeat: true, aniso: 16 }),
    normalMap: finish(nrm, renderer, { repeat: true, srgb: false, aniso: 16 }),
    roughnessMap: finish(rough, renderer, { repeat: true, srgb: false, aniso: 16 }),
  };
}

// Large-scale wear across one carriageway (u: median edge -> verge, 10.6 m;
// v: 24 m along the road): tyre tracks, oil line, patches, sealed cracks.
export function asphaltWear(renderer) {
  const W = 512, H = 1024;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(11);
  const toX = (lat) => ((lat - 3.0) / 10.6) * W;
  // Polished, darker wheel paths in both lanes; oil drip line between them
  for (const lat of [4.55, 6.35, 8.25, 10.05]) {
    const x = toX(lat);
    const g = ctx.createLinearGradient(x - 22, 0, x + 22, 0);
    g.addColorStop(0, 'rgba(90,90,92,0)');
    g.addColorStop(0.5, 'rgba(90,90,92,0.55)');
    g.addColorStop(1, 'rgba(90,90,92,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, 0, 44, H);
  }
  for (const lat of [5.45, 9.15]) {
    const x = toX(lat);
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = `rgba(40,40,42,${0.05 + rand() * 0.12})`;
      ctx.fillRect(x - 6 + (rand() - 0.5) * 8, y, 4 + rand() * 8, 3);
    }
  }
  // Lighter, less trafficked shoulder and inner edge
  ctx.fillStyle = 'rgba(200,196,188,0.22)';
  ctx.fillRect(toX(11.0), 0, W - toX(11.0), H);
  ctx.fillRect(0, 0, toX(3.6), H);
  // Patch repairs (darker, crisp edged rectangles)
  for (let i = 0; i < 4; i++) {
    const x = toX(4 + rand() * 6.5), y = rand() * H;
    ctx.fillStyle = `rgba(70,70,74,${0.3 + rand() * 0.25})`;
    ctx.fillRect(x, y, 30 + rand() * 60, 50 + rand() * 120);
  }
  // Sealed cracks ("tar snakes")
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    let x = rand() * W, y = rand() * H;
    ctx.strokeStyle = `rgba(20,20,22,${0.35 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const len = 8 + ((rand() * 20) | 0);
    const dir = rand() < 0.6 ? Math.PI / 2 : rand() * Math.PI;
    for (let k = 0; k < len; k++) {
      x += Math.cos(dir + (rand() - 0.5) * 1.4) * 9;
      y += Math.sin(dir + (rand() - 0.5) * 1.4) * 9;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = finish(c, renderer, { srgb: false, aniso: 16 });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Worn paint for road markings: mostly solid, with chipped, scuffed patches
export function markingWear(renderer) {
  const W = 128, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const f = fbmField(128, 4, 4, 90);
  const img = ctx.createImageData(W, H);
  const rand = mulberry32(5);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = f[(y % 128) * 128 + x];
      const v = Math.min(1, Math.max(0, (n - 0.28) * 3.2)) * (0.75 + rand() * 0.25);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, renderer, { repeat: true, srgb: false });
}

export function gravelTexture(renderer) {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a8c76';
  ctx.fillRect(0, 0, S, S);
  const rand = mulberry32(5);
  for (let i = 0; i < 16000; i++) {
    const v = 110 + rand() * 110;
    ctx.fillStyle = `rgba(${v + 8},${v},${v - 16},${0.4 + rand() * 0.5})`;
    const s = 1 + rand() * 3.4;
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, s, s * 0.7, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, renderer, { repeat: true });
}

// ---------------------------------------------------------------- terrain
// Dry winter grass, near white so the terrain colours multiply through it.
// Returns an albedo detail map and a matching normal map.
export function grassDetail(renderer) {
  const S = 512;
  const c = makeCanvas(S, S);
  const h = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const hx = h.getContext('2d');
  ctx.fillStyle = '#d9d2bd';
  ctx.fillRect(0, 0, S, S);
  hx.fillStyle = '#404040';
  hx.fillRect(0, 0, S, S);
  const rand = mulberry32(3);
  ctx.lineCap = hx.lineCap = 'round';
  for (let i = 0; i < 26000; i++) {
    const x = rand() * S, y = rand() * S;
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.6, l = 3 + rand() * 9;
    const v = rand();
    const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      if (Math.max(x, ex) + ox < 0 || Math.min(x, ex) + ox > S || Math.max(y, ey) + oy < 0 || Math.min(y, ey) + oy > S) continue;
      ctx.strokeStyle = v < 0.45 ? `rgba(96,86,58,${0.12 + v * 0.3})` : v < 0.9 ? `rgba(255,246,214,${0.1 + (v - 0.45) * 0.4})` : `rgba(120,132,70,0.25)`;
      ctx.lineWidth = 0.8 + rand() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(ex + ox, ey + oy);
      ctx.stroke();
      hx.strokeStyle = `rgba(255,255,255,${0.15 + rand() * 0.35})`;
      hx.lineWidth = 1.2;
      hx.beginPath();
      hx.moveTo(x + ox, y + oy);
      hx.lineTo(ex + ox, ey + oy);
      hx.stroke();
    }
  }
  const nrm = heightToNormal(h, S, S, 2.4);
  return {
    map: finish(c, renderer, { repeat: true }),
    normalMap: finish(nrm, renderer, { repeat: true, srgb: false }),
  };
}

// Bare soil / eroded ground detail, near white, tileable
export function soilDetail(renderer) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const f = fbmField(S, 6, 5, 70);
  const img = ctx.createImageData(S, S);
  const rand = mulberry32(8);
  for (let i = 0; i < S * S; i++) {
    const v = 190 + (f[i] - 0.5) * 90 + (rand() - 0.5) * 30;
    img.data[i * 4] = v + 10;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v - 14;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, renderer, { repeat: true });
}

// ---------------------------------------------------------------- foliage
// Leaf clusters for cards (RGBA, alpha-tested). kind: 'acacia' | 'gum' | 'bush'.
// Dense enough that canopies read as solid masses once mip-mapped.
export function leafCluster(renderer, kind = 'acacia') {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const rand = mulberry32(kind === 'acacia' ? 51 : kind === 'gum' ? 52 : 53);
  const palettes = {
    acacia: ['#5d6a35', '#4e5c2d', '#6c7a3b', '#44522a', '#7a8742', '#66733a'],
    gum: ['#6f7b58', '#5f6b4b', '#7f8a66', '#56624a', '#8b9570'],
    bush: ['#5f6936', '#515c2f', '#6d743b', '#48532b', '#7b7e44'],
  }[kind];
  const blobs = kind === 'gum' ? 8 : 11;
  for (let b = 0; b < blobs; b++) {
    const bx = S * (0.2 + rand() * 0.6), by = S * (0.22 + rand() * 0.56);
    const br = S * (kind === 'gum' ? 0.2 : 0.22) * (0.75 + rand() * 0.45);
    const n = kind === 'gum' ? 260 : 900;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * br;
      const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d * 0.8;
      const edge = d / br;
      ctx.fillStyle = palettes[(rand() * palettes.length) | 0];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(kind === 'gum' ? Math.PI / 2 + (rand() - 0.5) * 0.9 : rand() * Math.PI);
      ctx.beginPath();
      if (kind === 'gum') ctx.ellipse(0, 0, 16 + rand() * 10, 4 + rand() * 2, 0, 0, Math.PI * 2);
      else ctx.ellipse(0, 0, 5 + rand() * 6, 2.6 + rand() * 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Self-shadowing: darker inside and underneath each clump
      if (edge < 0.7 || y > by) {
        ctx.fillStyle = `rgba(22,28,12,${0.1 + (1 - edge) * 0.12})`;
        ctx.fillRect(x - 2.5, y - 1.5, 5, 3);
      }
    }
  }
  ctx.strokeStyle = 'rgba(58,46,34,0.9)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    const x = S * (0.3 + rand() * 0.4), y = S * (0.35 + rand() * 0.4);
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 160, y + (rand() - 0.5) * 120);
    ctx.stroke();
  }
  const tex = finish(c, renderer);
  tex.generateMipmaps = true;
  return tex;
}

// Grass tussock card (RGBA): blades fan out from a narrow base, tallest in
// the middle, straw-gold with a few russet seed heads (red grass, Themeda)
export function grassBlades(renderer) {
  const W = 256, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rand = mulberry32(19);
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const bx = W * (0.5 + (rand() - 0.5) * 0.3);
    const spread = (rand() - 0.5) * 2; // -1..1
    const h = H * (0.45 + (1 - Math.abs(spread)) * 0.5) * (0.7 + rand() * 0.3);
    const tipX = bx + spread * W * 0.42 + (rand() - 0.5) * 20;
    const v = rand();
    const top = v < 0.72
      ? `rgb(${205 + rand() * 38},${172 + rand() * 34},${112 + rand() * 30})`
      : v < 0.9
        ? `rgb(${172 + rand() * 30},${116 + rand() * 24},${72 + rand() * 20})`
        : `rgb(${150 + rand() * 30},${150 + rand() * 26},${88 + rand() * 20})`;
    const g = ctx.createLinearGradient(0, H, 0, H - h);
    g.addColorStop(0, '#8d8452');
    g.addColorStop(0.2, top);
    g.addColorStop(1, top);
    ctx.strokeStyle = g;
    ctx.lineWidth = 0.9 + rand() * 1.3;
    ctx.beginPath();
    ctx.moveTo(bx, H);
    ctx.quadraticCurveTo(bx + (tipX - bx) * 0.2, H - h * 0.65, tipX, H - h);
    ctx.stroke();
  }
  return finish(c, renderer);
}

// Grass "fur" for shell layers: alpha = blade height (tileable), colour =
// straw with russet and green-grey variation
export function grassFur(renderer) {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const clump = fbmField(S, 16, 3, 33);
  const tint = fbmField(S, 6, 3, 34);
  const rand = mulberry32(35);
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const r = rand();
    // Sparse tall blades on top of a dense short sward
    const h = r < 0.035 ? 0.9 + rand() * 0.1 : Math.max(0, Math.min(1, clump[i] * 1.2 - 0.25 + (rand() - 0.5) * 0.5));
    const t = tint[i];
    const russet = Math.max(0, (t - 0.55) * 2.2);
    const green = Math.max(0, (0.42 - t) * 2.0);
    const v = 0.85 + rand() * 0.3;
    img.data[i * 4] = Math.min(255, (214 - green * 50 + russet * 10) * v);
    img.data[i * 4 + 1] = Math.min(255, (180 - russet * 40 - green * 10) * v);
    img.data[i * 4 + 2] = Math.min(255, (116 - russet * 34 - green * 20) * v);
    img.data[i * 4 + 3] = h * 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = finish(c, renderer, { repeat: true });
  tex.premultiplyAlpha = false;
  return tex;
}

export function barkTexture(renderer, kind = 'acacia') {
  const W = 128, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = kind === 'gum' ? '#b9ad98' : '#3b3129';
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(kind === 'gum' ? 61 : 62);
  for (let i = 0; i < 90; i++) {
    const x = rand() * W;
    ctx.strokeStyle = kind === 'gum' ? `rgba(${120 + rand() * 60},${110 + rand() * 50},${90 + rand() * 40},0.6)` : `rgba(18,14,10,${0.3 + rand() * 0.5})`;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let px = x;
    for (let y = 0; y <= H; y += 16) {
      px += (rand() - 0.5) * 6;
      ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  return finish(c, renderer, { repeat: true });
}

// ---------------------------------------------------------------- truck
// Tyre: u runs around the circumference, v across the profile (bead ->
// sidewall -> tread -> sidewall -> bead). Albedo + normal.
export function tyreTextures(renderer) {
  const W = 1024, H = 256;
  const h = makeCanvas(W, H);
  const hx = h.getContext('2d');
  hx.fillStyle = 'rgb(140,140,140)';
  hx.fillRect(0, 0, W, H);
  const rand = mulberry32(71);
  const tread0 = H * 0.36, tread1 = H * 0.64;
  // Sidewall: fine concentric ribs and a raised rim protector
  for (const [a, b] of [[0, tread0], [tread1, H]]) {
    for (let y = a; y < b; y += 3) {
      hx.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.04})`;
      hx.fillRect(0, y, W, 1);
    }
  }
  hx.fillStyle = 'rgba(255,255,255,0.35)';
  hx.fillRect(0, H * 0.06, W, 6);
  hx.fillRect(0, H * 0.94 - 6, W, 6);
  // Raised sidewall lettering blocks (reads as moulded text at a distance)
  for (const y of [H * 0.18, H * 0.82]) {
    for (let x = 30; x < W; x += W / 2) {
      for (let k = 0; k < 16; k++) {
        hx.fillStyle = 'rgba(255,255,255,0.28)';
        hx.fillRect(x + k * 14, y - 7, 9, 14);
      }
    }
  }
  // Tread blocks: 4 circumferential grooves, zig-zag shoulders, sipes
  hx.fillStyle = 'rgb(210,210,210)';
  hx.fillRect(0, tread0, W, tread1 - tread0);
  hx.fillStyle = 'rgb(30,30,30)';
  const grooves = [0.2, 0.4, 0.6, 0.8].map((t) => tread0 + (tread1 - tread0) * t);
  for (const g of grooves) {
    hx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const y = g + ((x / 16) % 2 ? 2.5 : -2.5);
      if (x === 0) hx.moveTo(x, y - 3);
      hx.lineTo(x, y - 3);
    }
    for (let x = W; x >= 0; x -= 16) hx.lineTo(x, g + ((x / 16) % 2 ? 2.5 : -2.5) + 3);
    hx.closePath();
    hx.fill();
  }
  hx.strokeStyle = 'rgba(60,60,60,0.8)';
  hx.lineWidth = 1.5;
  for (let x = 0; x < W; x += 12) {
    hx.beginPath();
    hx.moveTo(x, tread0 + 2);
    hx.lineTo(x + 5, tread1 - 2);
    hx.stroke();
  }
  const nrm = heightToNormal(h, W, H, 3.5, true);
  const c = makeCanvas(W, H);
  const cx = c.getContext('2d');
  cx.fillStyle = '#1c1c1d';
  cx.fillRect(0, 0, W, H);
  // Dust on the sidewalls, scrubbed tread
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(120,104,82,0.25)');
  g.addColorStop(0.3, 'rgba(120,104,82,0.08)');
  g.addColorStop(0.5, 'rgba(90,90,90,0.12)');
  g.addColorStop(0.7, 'rgba(120,104,82,0.08)');
  g.addColorStop(1, 'rgba(120,104,82,0.25)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, H);
  return {
    map: finish(c, renderer, { repeat: true }),
    normalMap: finish(nrm, renderer, { repeat: true, srgb: false }),
  };
}

// Honeycomb grille mesh: dark holes, satin lattice (colour map)
export function grilleTextures(renderer) {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050607';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2b2e33';
  ctx.lineWidth = 3;
  const r = 8;
  const dx = r * Math.sqrt(3), dy = r * 1.5;
  for (let row = 0, y = 0; y < H + r; y += dy, row++) {
    for (let x = row % 2 ? dx / 2 : 0; x < W + r; x += dx) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const tex = finish(c, renderer, { repeat: true });
  tex.repeat.set(3, 2);
  return tex;
}

// ---------------------------------------------------------------- light
export function glowTexture(renderer) {
  const S = 128;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.1)');
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
  const f = fbmField(S, 4, 5, 9);
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 255 - Math.min(1, Math.max(0, (f[i] - 0.48) * 4)) * 150;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, renderer, { repeat: true, srgb: false });
}
