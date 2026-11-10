// Képek betöltése és rajzolási segédek (a GameArt / ArtDraw átirata Canvas 2D-re).

const BASE = 'assets/img/';
const images = new Map(); // kulcs: "robots/arm_basic" → HTMLImageElement
const accents = new Map();
let meta = { images: {}, anchors: {}, sockets: {}, footGaps: {}, surfaces: {}, accents: [] };
const listeners = new Set();
export let revision = 0;

export function onArtChange(fn) { listeners.add(fn); }

function loadImg(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

/** Az összes kép betöltése; a [progress] 0..1 visszahívás a betöltő képernyőhöz. */
export async function loadArt(progress) {
  meta = await (await fetch('assets/art.json')).json();
  const keys = Object.keys(meta.images);
  let done = 0;
  const jobs = keys.map(async (k) => {
    const im = await loadImg(BASE + k + '.webp');
    if (im) images.set(k, im);
    if (meta.accents.includes(k)) {
      const a = await loadImg(BASE + k + '__accent.webp');
      if (a) accents.set(k, a);
    }
    done++;
    if (progress) progress(done / keys.length);
  });
  await Promise.all(jobs);
  revision++;
  listeners.forEach((fn) => fn());
}

const strip = (p) => p.replace(/\.png$/, '');
/** null = nincs saját kép. A kulcs lehet "robots/x.png" vagy "robots/x". */
export const img = (path) => images.get(strip(path)) || null;
export const accent = (path) => accents.get(strip(path)) || null;
export const armAnchor = (path) => { const a = meta.anchors[strip(path)]; return a ? { x: a[0], y: a[1] } : null; };
export const socketX = (path) => meta.sockets[strip(path)] ?? 0.5;
export const footGap = (path) => meta.footGaps[strip(path)] ?? 0;
export const surface = (path) => meta.surfaces[strip(path)] ?? 0;

export const Paths = {
  head: (style) => ({ ROUND: 'robots/head_round', SQUARE: 'robots/head_square', POINTED: 'robots/head_pointed' })[style],
  BODY: 'robots/body_base',
  arm: (id) => ({ strong_arm: 'robots/arm_strong', extend_arm: 'robots/arm_extend', lamp_arm: 'robots/arm_lamp', basic_arm: 'robots/arm_basic' })[id] || `robots/arm_${id}`,
  mobility: (id) => `robots/mobility_${id}`,
  background: (w) => `backgrounds/bg_world_${w + 1}`,
  ground: (w) => `levels/ground_world_${w + 1}`,
  GROUND_TILE: 'levels/ground_tile', WATER_TILE: 'levels/water_tile', QUICKSAND_TILE: 'levels/quicksand_tile',
  LAVA_TILE: 'levels/lava_tile', LAVA_COOLED_TILE: 'levels/lava_cooled_tile', SPACE_TILE: 'levels/space_tile', DEEP_WATER_TILE: 'levels/deep_water_tile',
  obstacle: (n) => `obstacles/${n}`,
};

// ---- Színek ----------------------------------------------------------------------------------

export const C = {
  SkyBlue: '#3D8BFF', SkyLight: '#BFE6FF', Cream: '#FDF7EC', Sunny: '#FFC83D', Orange: '#FF8A3D', Leaf: '#4CC38A',
  Ink: '#26303D', InkSoft: '#5B6B7F', Metal: '#B8C4D3', MetalDark: '#7D8A9C', Soil: '#B98552', SoilDark: '#8A5E35',
  Grass: '#6BCB5B', PitDark: '#3A3550', ButtonOrange: '#C2570C', ButtonBlue: '#2F6FD6', ButtonGreen: '#1F8A5B',
  Danger: '#E5484D', Outline: '#D5DEE9', WaterLight: '#7FD3FF', WaterDeep: '#3D8BFF', Wood: '#D9A066', WoodDark: '#8A5E35',
  Steel: '#5B6B7F', CaveDark: '#2B2540',
};
export const ROBOT_COLORS = { BLUE: '#4A90F0', ORANGE: '#FF9A4D', GREEN: '#4CC38A', PURPLE: '#9B7BEA', RED: '#F06A6A' };

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
export function mix(h1, h2, t) {
  const a = hexToRgb(h1); const b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---- Rajzolás --------------------------------------------------------------------------------

const tintCache = new Map();
/** A kép színezve (Modulate: a szín és a kép szorzata, az alfa marad). */
function tinted(im, color) {
  const key = im.src + '|' + color;
  let c = tintCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(im, 0, 0);
  tintCache.set(key, c);
  return c;
}

export function drawStretch(g, im, l, t, r, b, tint = null, alpha = 1) {
  if (!im || r - l < 0.5 || b - t < 0.5) return;
  const src = tint ? tinted(im, tint) : im;
  if (alpha !== 1) { g.save(); g.globalAlpha *= alpha; g.drawImage(src, l, t, r - l, b - t); g.restore(); } else g.drawImage(src, l, t, r - l, b - t);
}

/** Arányt tartva a téglalapba; anchor: 'TOP' | 'CENTER' | 'BOTTOM'. Visszaadja a tényleges téglalapot. */
export function drawFit(g, im, l, t, r, b, anchor = 'BOTTOM', tint = null, alpha = 1) {
  if (!im) return null;
  const ar = im.naturalWidth / im.naturalHeight;
  let w = r - l; let h = w / ar;
  if (h > b - t) { h = b - t; w = h * ar; }
  const left = l + (r - l - w) / 2;
  const top = anchor === 'TOP' ? t : anchor === 'CENTER' ? t + (b - t - h) / 2 : b - h;
  drawStretch(g, im, left, top, left + w, top + h, tint, alpha);
  return [left, top, left + w, top + h];
}

export function fitRect(im, l, t, r, b, anchor = 'BOTTOM') {
  const ar = im.naturalWidth / im.naturalHeight;
  let w = r - l; let h = w / ar;
  if (h > b - t) { h = b - t; w = h * ar; }
  const left = l + (r - l - w) / 2;
  const top = anchor === 'TOP' ? t : anchor === 'CENTER' ? t + (b - t - h) / 2 : b - h;
  return [left, top, left + w, top + h];
}

export function drawCover(g, im, l, t, r, b, alpha = 1) {
  if (!im) return;
  const iw = im.naturalWidth; const ih = im.naturalHeight;
  const ar = iw / ih; const target = (r - l) / (b - t);
  let sw, sh;
  if (ar > target) { sh = ih; sw = ih * target; } else { sw = iw; sh = iw / target; }
  g.save(); g.globalAlpha *= alpha;
  g.drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, l, t, r - l, b - t);
  g.restore();
}

/** Vízszintesen ismételve, minden második darab tükrözve. */
export function drawTiled(g, im, l, t, r, b, tileH = b - t, originX = 0, alpha = 1, tint = null) {
  if (!im || r - l < 1 || b - t < 1 || tileH < 1) return;
  const src = tint ? tinted(im, tint) : im;
  const tileW = tileH * im.naturalWidth / im.naturalHeight;
  g.save();
  g.beginPath(); g.rect(l, t, r - l, b - t); g.clip();
  g.globalAlpha *= alpha;
  let k = Math.floor((l - originX) / tileW);
  let x = originX + k * tileW;
  while (x < r) {
    if (k % 2 !== 0) {
      g.save(); g.translate(x + tileW / 2, 0); g.scale(-1, 1);
      g.drawImage(src, -tileW / 2 - 0.5, t, tileW + 1, tileH);
      g.restore();
    } else g.drawImage(src, x, t, tileW + 1, tileH);
    k++; x += tileW;
  }
  g.restore();
}

// kis geometriai segédek
export function circle(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
export function ring(g, x, y, r, stroke, w) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); }
export function line(g, x1, y1, x2, y2, color, w, cap = 'butt') {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = color; g.lineWidth = w; g.lineCap = cap; g.stroke();
}
export function rrect(g, x, y, w, h, r, fill, stroke = null, sw = 1) {
  g.beginPath();
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.roundRect ? g.roundRect(x, y, w, h, rr) : g.rect(x, y, w, h);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = sw; g.stroke(); }
}
export function oval(g, x, y, w, h, fill) { g.beginPath(); g.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
/** Compose drawArc: start/sweep fokban, a téglalapba írt ellipszis ívén. */
export function arc(g, x, y, w, h, startDeg, sweepDeg, useCenter, color, strokeW = null, cap = 'butt') {
  g.beginPath();
  const cx = x + w / 2; const cy = y + h / 2;
  const a0 = startDeg * Math.PI / 180; const a1 = (startDeg + sweepDeg) * Math.PI / 180;
  if (useCenter) g.moveTo(cx, cy);
  g.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, a0, a1, sweepDeg < 0);
  if (useCenter) g.closePath();
  if (strokeW == null) { g.fillStyle = color; g.fill(); } else { g.strokeStyle = color; g.lineWidth = strokeW; g.lineCap = cap; g.stroke(); }
}

/** Forgatás egy pont körül (Compose rotate(deg, pivot)). */
export function rotated(g, deg, px, py, fn) {
  g.save(); g.translate(px, py); g.rotate(deg * Math.PI / 180); g.translate(-px, -py); fn(); g.restore();
}
export function scaled(g, sx, sy, px, py, fn) {
  g.save(); g.translate(px, py); g.scale(sx, sy); g.translate(-px, -py); fn(); g.restore();
}
export function clipped(g, l, t, r, b, fn) { g.save(); g.beginPath(); g.rect(l, t, r - l, b - t); g.clip(); fn(); g.restore(); }

/** Csillag: saját kép (arany / üres), különben rajzolt. */
export function drawStar(g, cx, cy, outer, gold = true, rot = 0) {
  const im = img(gold ? 'ui/star' : 'ui/star_empty');
  if (im) {
    const r = outer * 1.08;
    rotated(g, rot, cx, cy, () => drawFit(g, im, cx - r, cy - r, cx + r, cy + r, 'CENTER'));
    return;
  }
  const inner = outer * 0.45;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (rot - 90 + i * 36) * Math.PI / 180;
    const x = cx + Math.cos(a) * r; const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath(); g.fillStyle = gold ? C.Sunny : C.Outline; g.fill();
}

export function drawQuestionBubble(g, cx, cy, r) {
  circle(g, cx, cy, r, '#fff');
  ring(g, cx, cy, r, rgba(C.Ink, 0.25), r * 0.12);
  const q = r * 0.4;
  arc(g, cx - q, cy - q * 2, q * 2, q * 2, 180, 270, false, C.Orange, r * 0.22, 'round');
  line(g, cx, cy, cx, cy + q * 0.6, C.Orange, r * 0.22, 'round');
  circle(g, cx, cy + q * 1.5, r * 0.14, C.Orange);
}
