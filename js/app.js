// Little Robot Factory – webes változat. Navigáció, mentés, képernyők (a GameViewModel + Compose képernyők átirata).
import * as E from './engine.js';
import { loadArt, img, Paths, C, ROBOT_COLORS, drawFit, drawStretch, drawTiled, drawCover, surface, drawStar, mix, rgba, rotated } from './art.js';
import { drawRobot, pose, drawMobilityThumb, drawArmThumb, G } from './robot.js';
import { drawMission, newCamera, theme } from './scene.js';

const VERSION = '1.5.9-web';

// ---- Szövegek ------------------------------------------------------------------------------
let STR = {};
const LANGS = [['hu', 'Magyar'], ['de', 'Deutsch'], ['en', 'English']];
const EXTRA = {
  fullscreen: { hu: 'Teljes képernyő', de: 'Vollbild', en: 'Full screen' },
  landscape: { hu: 'Fekvő nézet', de: 'Querformat', en: 'Landscape' },
  ios_full_title: { hu: 'Teljes képernyő iPhone-on', de: 'Vollbild auf dem iPhone', en: 'Full screen on iPhone' },
  ios_full_text: {
    hu: 'iPhone-on a böngésző nem engedi a teljes képernyőt. Tedd a játékot a kezdőképernyőre: Safariban koppints a Megosztás gombra (négyzet felfelé mutató nyíllal), majd válaszd a „Főképernyőhöz adás” pontot. Az ikonról indítva a játék böngészősáv nélkül, teljes képernyőn fut.',
    de: 'Auf dem iPhone erlaubt der Browser kein Vollbild. Lege das Spiel auf den Home-Bildschirm: In Safari auf „Teilen“ tippen (Quadrat mit Pfeil nach oben) und „Zum Home-Bildschirm“ wählen. Über das Symbol gestartet, läuft das Spiel ohne Browserleiste im Vollbild.',
    en: 'On iPhone the browser does not allow full screen. Add the game to your Home Screen: in Safari tap Share (square with an arrow), then “Add to Home Screen”. Started from that icon, the game runs full screen without the browser bar.' },
  ios_rotate_text: {
    hu: 'Ha a kép nem fordul el fekvőbe, kapcsold ki a tájolászárat a Vezérlőközpontban (lakat nyíllal), vagy kapcsold be a „Fekvő nézet” gombot.',
    de: 'Dreht sich das Bild nicht ins Querformat, schalte die Ausrichtungssperre im Kontrollzentrum aus (Schloss mit Pfeil) oder tippe auf „Querformat“.',
    en: 'If the picture does not turn to landscape, switch off Portrait Orientation Lock in Control Center (lock with an arrow), or turn on “Landscape”.' },
};
let lang = 'en';
function t(key, ...args) {
  let s = (STR[lang] && STR[lang][key]) ?? STR.en?.[key] ?? EXTRA[key]?.[lang] ?? key;
  args.forEach((a, i) => { s = s.replace(new RegExp(`%${i + 1}\\$[sd]`, 'g'), String(a)); });
  return s;
}
const partName = (id) => t('part_' + id);
const missionTitle = (m) => t(m.titleKey) === m.titleKey ? t('mission_unknown') : t(m.titleKey);

function detectLang() {
  const saved = store.lang;
  if (saved && LANGS.some((l) => l[0] === saved)) return saved;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return nav === 'hu' || nav === 'de' ? nav : 'en';
}

// ---- Hang ----------------------------------------------------------------------------------
const SFX = ['tap', 'select', 'start', 'jump', 'fly', 'swim', 'climb', 'push', 'switch', 'light', 'blocked', 'success', 'new_part'];
let audioCtx = null;
const buffers = {};
async function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await Promise.all(SFX.map(async (n) => {
      try {
        const data = await (await fetch(`assets/sounds/${n}.wav`)).arrayBuffer();
        buffers[n] = await audioCtx.decodeAudioData(data);
      } catch (e) { /* hiányzó hang: csendes */ }
    }));
  } catch (e) { audioCtx = null; }
}
function play(name, vol = 0.8) {
  if (!state.soundOn || !audioCtx || !buffers[name]) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const src = audioCtx.createBufferSource(); src.buffer = buffers[name];
    const g = audioCtx.createGain(); g.gain.value = vol;
    src.connect(g).connect(audioCtx.destination); src.start();
  } catch (e) { /* */ }
}
// az első érintés engedélyezi a hangot (böngésző-szabály)
window.addEventListener('pointerdown', () => { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { once: false, passive: true });

// ---- Mentés --------------------------------------------------------------------------------
const STORE_KEY = 'littleRobotFactory.v1';
let store = {};
try { store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { store = {}; }
function persist() {
  store.completed = [...state.completed];
  store.team = state.team.map(E.encodeRobot);
  store.sound = state.soundOn;
  store.garage = state.garage.map((r) => (r ? E.encodeRobot(r) : null));
  store.lang = lang;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* privát mód */ }
}

// ---- Állapot -------------------------------------------------------------------------------
const DEFAULT_TEAM = Array.from({ length: E.MAX_TEAM }, (_, i) => E.robot({ color: E.COLORS[i % E.COLORS.length] }));
const state = {
  missions: [], completed: new Set(), team: DEFAULT_TEAM.map((r) => ({ ...r })), selected: 0,
  screen: { k: 'worlds' }, newPartId: null, soundOn: true, garage: [null, null, null],
  failures: {}, hintLevel: {}, lastFailure: {}, session: null, expanded: new Set(),
};
const available = () => E.availableParts(state.missions, state.completed);
const isUnlocked = (i) => E.isMissionUnlocked(state.missions, i, state.completed);
const worldCount = () => Math.ceil(state.missions.length / E.MISSIONS_PER_WORLD);
const worldRange = (w) => { const a = w * E.MISSIONS_PER_WORLD; const b = Math.min(state.missions.length, (w + 1) * E.MISSIONS_PER_WORLD); return Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i); };
const isWorldUnlocked = (w) => isUnlocked(w * E.MISSIONS_PER_WORLD);
const completedIn = (w) => worldRange(w).filter((i) => state.completed.has(state.missions[i].id)).length;
const worldOf = (i) => Math.floor(i / E.MISSIONS_PER_WORLD);

function loadProgress() {
  state.completed = new Set(store.completed || []);
  state.soundOn = store.sound !== false;
  const avail = available();
  const team = (store.team || []).map(E.decodeRobot);
  state.team = DEFAULT_TEAM.map((d, i) => E.sanitizeAvailable(team[i] || d, avail));
  state.garage = [0, 1, 2].map((i) => E.decodeRobot((store.garage || [])[i]));
}

// ---- Navigáció -----------------------------------------------------------------------------
function go(screen) {
  stopRun();
  state.screen = screen;
  state.expanded.clear();
  render();
}
function back() {
  const s = state.screen;
  if (s.k === 'parent' || s.k === 'missions') go({ k: 'worlds' });
  else if (s.k === 'workshop') go({ k: 'missions', world: worldOf(s.index) });
  else if (s.k === 'run') { state.newPartId = null; go({ k: 'workshop', index: s.index }); }
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (closeDialog()) return; back(); } });
// Android „vissza” gomb / böngésző vissza: egy szinttel feljebb
history.replaceState({ lrf: 0 }, '');
history.pushState({ lrf: 1 }, '');
window.addEventListener('popstate', () => {
  history.pushState({ lrf: 1 }, '');
  if (closeDialog()) return;
  back();
});

function openMission(i) {
  if (!isUnlocked(i)) return;
  state.newPartId = null; state.selected = 0;
  go({ k: 'workshop', index: i });
}
function updateRobot(r) {
  const safe = E.sanitizeAvailable(r, available());
  const i = state.selected;
  const before = E.encodeRobot(state.team[i]);
  state.team[i] = safe;
  if (E.encodeRobot(safe) !== before) play('select');
  persist();
  render();
}
const teamFor = (m) => state.team.slice(0, Math.min(Math.max(1, m.team), E.MAX_TEAM));

// ---- Futás ---------------------------------------------------------------------------------
let raf = 0;
function startMission() {
  const s = state.screen; if (s.k !== 'workshop') return;
  const m = state.missions[s.index];
  const team = teamFor(m).map(E.sanitizeRobot);
  state.session = { mission: m, team, run: E.buildRun(m, team), startedAt: performance.now(), runId: (state.session?.runId || 0) + 1, counted: false, camera: newCamera(), prev: null, shown: null };
  state.newPartId = null;
  state.screen = { k: 'run', index: s.index };
  render();
}
function retry() {
  const se = state.session; if (!se) return;
  state.newPartId = null;
  state.session = { ...se, run: E.buildRun(se.mission, se.team), startedAt: performance.now(), runId: se.runId + 1, counted: false, camera: newCamera(), prev: null, shown: null };
  render();
}
function stopRun() { state.session = null; }
function nextMission() {
  const s = state.screen; if (s.k !== 'run') return;
  const next = s.index + 1;
  if (next < state.missions.length && isUnlocked(next)) {
    const avail = available();
    state.team = state.team.map((r) => E.sanitizeAvailable(r, avail));
    state.selected = 0; state.newPartId = null;
    go({ k: 'workshop', index: next });
  } else go({ k: 'missions', world: worldOf(s.index) });
}

function onFrame(f) {
  const se = state.session; if (!se) return;
  const id = se.mission.id;
  if (f.state.k === 'Success' && !state.completed.has(id)) {
    const reward = se.mission.rewardPartId && !available().has(se.mission.rewardPartId) ? se.mission.rewardPartId : null;
    state.newPartId = reward;
    state.completed.add(id);
    persist();
  }
  if (f.state.k === 'Failure' && !se.counted) {
    se.counted = true;
    state.failures[id] = (state.failures[id] || 0) + 1;
    state.lastFailure[id] = f.robots;
  }
  if (f.state.k === 'Success') delete state.lastFailure[id];
}

function runSounds(se, f) {
  const overall = f.state.k === 'Ready' ? 'ready' : f.state.k === 'Success' ? 'success' : f.state.k === 'Failure' ? 'fail' : 'run';
  const keys = f.robots.map((r) => `${r.phase}:${r.obstacleId}`);
  const prev = se.prev; se.prev = { overall, keys };
  const prevOverall = prev?.overall; const prevKeys = prev?.keys || [];
  if (overall === 'run' && prevOverall !== 'run') play('start');
  if (overall === 'success' && prevOverall !== 'success') { setTimeout(() => play(state.newPartId ? 'new_part' : 'success'), 120); return; }
  if (overall !== 'run') return;
  for (let i = 0; i < f.robots.length; i++) {
    if (prevKeys[i] === keys[i]) continue;
    const r = f.robots[i];
    let cue = null;
    if (r.phase === 'CROSSING') cue = r.assisted ? assistedSfx(se.mission, r.obstacleId) : capSfx(r.capability);
    else if (r.phase === 'HELPING') cue = 'switch';
    else if (r.phase === 'BLOCKED') cue = 'blocked';
    if (cue) { play(cue); break; }
  }
}
function assistedSfx(m, id) {
  const type = m.obstacles.find((o) => o.id === id)?.type;
  return type === 'TRAMPOLINE_CLIFF' ? 'jump' : type === 'MAGNET_LIFT' ? 'climb' : type === 'BUTTON' ? 'switch' : null;
}
function capSfx(c) {
  switch (c) {
    case 'JUMP': return 'jump';
    case 'FLY': case 'JET': case 'HOVER': case 'SWING': case 'GLIDE': case 'BLOW': return 'fly';
    case 'SWIM': case 'DIVE': return 'swim';
    case 'CLIMB': case 'GRIP': case 'MAGNET': case 'WALL_WALK': case 'LIGHTWEIGHT': return 'climb';
    case 'PUSH': case 'DIG': case 'CUT': return 'push';
    case 'REACH': case 'TURN': case 'REMOTE': return 'switch';
    case 'LIGHT': case 'GRAB_LIGHT': case 'HEAT': case 'COOL': case 'BUBBLE': case 'SCOOP': case 'RESONATE': return 'light';
    default: return null;
  }
}

// ---- DOM-segédek ---------------------------------------------------------------------------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const iconSrc = (name) => `assets/img/ui/icon_${name}.webp`;
const icon = (name, cls = 'ico') => h('img', { class: cls, src: iconSrc(name), alt: '', draggable: 'false' });

/** Rajzvászon: a draw(g, w, h) a CSS-méretben kap koordinátát; live = minden képkockán újrarajzol. */
const liveCanvases = new Set();
function canvas(draw, { cls = '', w = null, hgt = null, live = false, style = null } = {}) {
  const c = h('canvas', { class: cls });
  if (w) c.style.width = w + 'px';
  if (hgt) c.style.height = hgt + 'px';
  if (style) Object.assign(c.style, style);
  c._draw = draw;
  if (live) liveCanvases.add(c);
  requestAnimationFrame(() => paint(c));
  return c;
}
function paint(c) {
  if (!c.isConnected) { liveCanvases.delete(c); return; }
  // offsetWidth/Height: elforgatott (fekvő) nézetben is a vászon saját mérete
  const r = { width: c.offsetWidth, height: c.offsetHeight };
  if (r.width < 1 || r.height < 1) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const W = Math.round(r.width * dpr); const H = Math.round(r.height * dpr);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);
  g.imageSmoothingQuality = 'high';
  c._draw(g, r.width, r.height);
}

function gameButton(text, iconName, onClick, { color = 'orange', full = false, minH = 60, disabled = false } = {}) {
  const pill = { orange: 'button_orange', blue: 'button_blue', green: 'button_green', grey: 'button_grey' }[color];
  const btn = h('button', { class: 'game-btn' + (full ? ' full' : '') + (disabled ? ' disabled' : '') + (pill ? '' : ' plain'), style: { minHeight: minH + 'px', '--c': color } },
    iconName ? (typeof iconName === 'string' ? icon(iconName) : iconName) : null, h('span', {}, text));
  if (pill && img('ui/' + pill)) {
    btn.prepend(canvas((g, w, hh) => drawPill(g, img('ui/' + pill), w, hh), { cls: 'pill' }));
  } else if (pill) btn.style.background = { orange: C.ButtonOrange, blue: C.ButtonBlue, green: C.ButtonGreen, grey: '#6B7A90' }[color];
  btn.addEventListener('click', () => { play('tap'); onClick(); });
  return btn;
}
/** Pirula-kép 3 részes nyújtással (a végek nem torzulnak). */
function drawPill(g, im, w, hh) {
  if (!im) return;
  const sh = im.naturalHeight; const sw = im.naturalWidth;
  const cap = Math.min(sh / 2, sw / 2);
  const dcap = Math.min(hh * cap / sh, w / 2);
  g.drawImage(im, 0, 0, cap, sh, 0, 0, dcap, hh);
  g.drawImage(im, cap, 0, Math.max(1, sw - 2 * cap), sh, dcap, 0, Math.max(1, w - 2 * dcap), hh);
  g.drawImage(im, sw - cap, 0, cap, sh, w - dcap, 0, dcap, hh);
}
function roundButton(iconName, label, onClick, size = 56) {
  const b = h('button', { class: 'round-btn', 'aria-label': label, style: { width: size + 'px', height: size + 'px', backgroundImage: img('ui/button_round') ? 'url(assets/img/ui/button_round.webp)' : '' } }, icon(iconName, ''));
  if (!img('ui/button_round')) b.classList.add('plainbg');
  b.addEventListener('click', () => { play('tap'); onClick(); });
  return b;
}
function starCanvas(size, gold = true) { return canvas((g, w, hh) => drawStar(g, w / 2, hh / 2, Math.min(w, hh) / 2, gold), { w: size, hgt: size }); }

// ---- Dialógus ------------------------------------------------------------------------------
const overlay = () => document.getElementById('overlay');
function openDialog(content, small = false) {
  const wrap = h('div', { class: 'dialog-wrap', onclick: (e) => { if (e.target === wrap) closeDialog(); } }, h('div', { class: 'dialog' + (small ? ' small' : '') }, content));
  overlay().replaceChildren(wrap);
}
function closeDialog() { if (!overlay().firstChild) return false; overlay().replaceChildren(); return true; }
function confirmDialog(title, text, yes, onYes) {
  openDialog([h('div', { class: 'h-l' }, title), text ? h('div', { class: 'b-l soft' }, text) : null,
    h('div', { class: 'dlg-actions' }, h('button', { class: 'text-btn', onclick: closeDialog }, t('cancel')), h('button', { class: 'text-btn', onclick: () => { closeDialog(); onYes(); } }, yes))], true);
}

// ---- Képernyők -----------------------------------------------------------------------------
const app = () => document.getElementById('app');
function render() {
  const s = state.screen;
  let el;
  if (s.k === 'worlds') el = worldsScreen();
  else if (s.k === 'missions') el = missionsScreen(s.world);
  else if (s.k === 'workshop') el = workshopScreen(s.index);
  else if (s.k === 'run') el = runScreen(s.index);
  else el = parentScreen();
  const prevKind = app().firstChild?.dataset?.kind;
  el.dataset.kind = s.k + (s.index ?? s.world ?? '');
  if (prevKind !== el.dataset.kind) el.classList.add('fade');
  const keepScroll = prevKind === el.dataset.kind ? [...app().querySelectorAll('.scroll')].map((x) => x.scrollTop) : null;
  app().replaceChildren(el);
  if (keepScroll) [...el.querySelectorAll('.scroll')].forEach((x, i) => { x.scrollTop = keepScroll[i] || 0; });
}

// --- Világok
function worldsScreen() {
  const W = appW(); const H = appH();
  const wide = W >= 560; const portrait = H > W;
  const cols = portrait ? (W >= 600 ? 3 : 2) : 3;
  const total = state.missions.length;
  const doneAll = [...state.completed].filter((id) => state.missions.some((m) => m.id === id)).length;
  const logo = img('ui/logo');
  const header = h('div', { class: 'row' },
    logo ? canvas((g, w, hh) => drawFit(g, logo, 0, 0, w, hh, 'CENTER'), { hgt: wide ? 72 : 56, w: (wide ? 72 : 56) * logo.naturalWidth / logo.naturalHeight })
      : h('div', { class: 'h-l' }, t('app_name')),
    h('div', { class: 'grow b-m soft' }, wide ? t('app_subtitle') : ''),
    h('div', { class: 'pill-chip h-l' }, `${doneAll}/${total}`),
    roundButton(state.soundOn ? 'sound_on' : 'sound_off', t(state.soundOn ? 'sound_on' : 'sound_off'), () => { state.soundOn = !state.soundOn; persist(); render(); }, 52),
    parentGate());
  const cardH = wide ? 210 : 180;
  const grid = h('div', { class: 'worlds-grid', style: { '--cols': cols } });
  for (let w = 0; w < worldCount(); w++) grid.append(worldCard(w, wide, cardH));
  const langRow = h('div', { class: 'row', style: { paddingTop: '4px', paddingBottom: '8px', flexWrap: 'wrap' } },
    h('div', { class: 't-m soft' }, t('language')),
    ...LANGS.map(([code, label]) => h('button', { class: 'lang-chip' + (code === lang ? ' sel' : ''), onclick: () => setLang(code) }, label)),
    h('div', { class: 'grow' }),
    !STANDALONE ? gameButton(t('fullscreen'), fullscreenIcon(), toggleFullscreen, { color: 'grey', minH: 52 }) : null,
    IS_TOUCH && !CAN_LOCK ? gameButton(t('landscape'), rotateIcon(), toggleLandscape, { color: store.forceLandscape ? 'blue' : 'grey', minH: 52 }) : null);
  return h('div', { class: 'screen', style: { background: `linear-gradient(${C.SkyLight}, ${C.Cream})` } }, header,
    h('div', { class: 'scroll grow', style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, grid, langRow));
}
/** Fehér teljesképernyő-jel: négy sarok (teljes képernyőn befelé mutat). */
function fullscreenIcon() {
  const inside = !!document.fullscreenElement;
  const d = inside
    ? 'M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6'
    : 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6';
  const wrap = h('span', { class: 'ico', style: { display: 'inline-flex' } });
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  return wrap;
}
document.addEventListener('fullscreenchange', () => { if (state.screen.k === 'worlds') render(); });
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_TOUCH = navigator.maxTouchPoints > 0;
const STANDALONE = window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || navigator.standalone === true;
const CAN_LOCK = !!(document.fullscreenEnabled && screen.orientation && screen.orientation.lock) && !IS_IOS;
function rotateIcon() {
  const wrap = h('span', { class: 'ico', style: { display: 'inline-flex' } });
  wrap.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="11" rx="2.2"/><path d="M8 4.5h5.5a4 4 0 0 1 4 4"/><path d="M15.5 6.5l2 2 2-2"/></svg>';
  return wrap;
}
function toggleLandscape() {
  store.forceLandscape = !store.forceLandscape;
  persist(); setAppHeight(); render();
  if (store.forceLandscape && realH() <= realW()) return;
}
function iosFullscreenHelp() {
  openDialog([h('div', { class: 'h-l' }, t('ios_full_title')), h('div', { class: 'b-l' }, t('ios_full_text')), h('div', { class: 'b-m soft' }, t('ios_rotate_text')),
    h('div', { class: 'dlg-actions' }, h('button', { class: 'text-btn', onclick: closeDialog }, t('hint_close')))], true);
}
function toggleFullscreen() {
  if (!document.fullscreenEnabled) { iosFullscreenHelp(); return; }
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
}
function setLang(code) { lang = code; document.documentElement.lang = code; persist(); render(); }

function worldCard(w, wide, cardH) {
  const unlocked = isWorldUnlocked(w); const done = completedIn(w); const total = worldRange(w).length;
  const card = h('button', { class: 'world-card' + (unlocked && done < total ? ' next' : ''), style: { '--card-h': cardH + 'px' } });
  const robot = state.team[0];
  const pic = h('div', { class: 'pic' }, canvas((g, cw, ch) => {
    g.globalAlpha = unlocked ? 1 : 0.45;
    const gy = ch * 0.78;
    const bg = img(Paths.background(w));
    if (bg) drawCover(g, bg, 0, 0, cw, ch); else { g.fillStyle = theme(w).skyTop; g.fillRect(0, 0, cw, ch); }
    const gk = Paths.ground(w); const gr = img(gk);
    if (gr) { const top = Math.min(0.4, surface(gk)); const tileH = (ch - gy) / (1 - top); drawTiled(g, gr, 0, gy - tileH * top, cw, ch, tileH, 0); }
    const hh = Math.min(ch * 0.55, cw * 0.45 / 0.66);
    drawRobot(g, robot, pose({ happy: done === total, flame: w === 5 && robot.mobility === 'rocket' }), cw * 0.3, gy, hh);
  }),
  h('div', { class: 'badge-num' + (unlocked ? '' : ' off') }, w + 1),
  !unlocked ? h('img', { class: 'world-lock', src: 'assets/img/ui/lock_badge.webp', alt: '' }) : null,
  done === total && total > 0 ? h('div', { class: 'world-star' }, starCanvas(34)) : null);
  card.append(pic, h('div', { class: 'info' },
    h('div', { class: 'row' }, h('div', { class: 'h-l grow ellipsis' }, t('world_' + w)), h('div', { class: 't-m soft' }, t('world_progress', done, total))),
    wide ? h('div', { class: 'b-m soft clamp2' }, t('world_desc_' + w)) : null));
  card.setAttribute('aria-label', unlocked ? `${t('world_open', t('world_' + w))}, ${done} / ${total}` : `${t('world_' + w)} – ${t('world_locked')}`);
  card.addEventListener('click', () => { if (!unlocked) return; play('tap'); go({ k: 'missions', world: w }); });
  return card;
}

/** Szülői zár: kb. 2 mp nyomva tartás; rövid koppintásra buborék. */
function parentGate() {
  const wrap = h('div', { class: 'parent-gate' });
  const btn = roundButton('parent', t('parent_hold'), () => {}, 52);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 52 52');
  const circ = document.createElementNS(svgNS, 'circle');
  Object.entries({ cx: 26, cy: 26, r: 23.4, fill: 'none', stroke: C.ButtonBlue, 'stroke-width': 5.2, 'stroke-dasharray': '147', 'stroke-dashoffset': '147', transform: 'rotate(-90 26 26)' }).forEach(([k, v]) => circ.setAttribute(k, v));
  svg.append(circ); btn.append(svg);
  let timer = null; let start = 0; let bubble = null;
  const showBubble = (ms) => {
    if (!bubble) { bubble = h('div', { class: 'bubble' }, t('parent_hold_hint')); wrap.append(bubble); }
    clearTimeout(bubble._t);
    if (ms) bubble._t = setTimeout(() => { bubble?.remove(); bubble = null; }, ms);
  };
  const tick = () => {
    const p = Math.min(1, (performance.now() - start) / 1800);
    circ.setAttribute('stroke-dashoffset', String(147 * (1 - p)));
    if (p >= 1) { cancel(); bubble?.remove(); bubble = null; go({ k: 'parent' }); return; }
    timer = requestAnimationFrame(tick);
  };
  const cancel = () => { cancelAnimationFrame(timer); timer = null; circ.setAttribute('stroke-dashoffset', '147'); };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start = performance.now(); showBubble(0); timer = requestAnimationFrame(tick); });
  const up = () => { if (timer) { cancel(); showBubble(1500); } };
  btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  wrap.append(btn);
  return wrap;
}

// --- Küldetések
function missionsScreen(world) {
  const th = theme(world);
  const dark = world === 5 || world === 9;
  const W = appW();
  const cols = Math.max(2, Math.min(6, Math.floor((W - 40 - 32) / 150)));
  const range = worldRange(world);
  const grid = h('div', { class: 'missions-grid', style: { '--cols': cols } });
  range.forEach((i) => grid.append(missionCard(i)));
  return h('div', { class: 'screen', style: { background: `linear-gradient(${th.skyTop}, ${dark ? th.skyBottom : C.Cream})` } },
    h('div', { class: 'row', style: { gap: '12px' } },
      roundButton('back', t('back'), back, 52),
      h('div', { class: 'h-xl grow ellipsis', style: { color: dark ? '#fff' : C.Ink } }, `${world + 1}. ${t('world_' + world)}`),
      h('div', { class: 'pill-chip h-l' }, t('world_progress', completedIn(world), range.length))),
    h('div', { class: 'scroll grow' }, grid));
}
function missionCard(i) {
  const m = state.missions[i];
  const unlocked = isUnlocked(i); const done = state.completed.has(m.id); const next = unlocked && !done;
  const card = h('button', { class: 'mission-card' + (unlocked ? '' : ' locked') + (next ? ' next' : ''), 'aria-label': `${i + 1}. ${missionTitle(m)}` });
  const top = h('div', { class: 'top' }, h('div', { class: 'num' + (unlocked ? '' : ' off') }, i + 1));
  if (unlocked && m.isTeam) top.append(h('span', { class: 'team-badge', title: t('mission_team_badge', m.team) }, icon('team', ''), m.team));
  if (unlocked && m.hard) top.append(h('img', { class: 'ico-s', src: iconSrc('bulb'), title: t('mission_hard_badge'), alt: '' }));
  top.append(h('div', { class: 'grow' }));
  if (done) top.append(starCanvas(26));
  if (!unlocked) top.append(icon('lock', 'ico-s'));
  card.append(top);
  if (unlocked) {
    const shown = distinctBy(m.obstacles.filter((o) => o.type !== 'BUTTON' && o.type !== 'LINKED_GATE'), (o) => o.type + [...o.required].join());
    card.append(obstacleThumbRow(shown, m.world, 3, 38, 30, 'm' + i), h('div', { class: 'l-m clamp2' }, missionTitle(m)));
  } else card.append(h('div'));
  card.addEventListener('click', (e) => { if (e.target.closest('.thumbs')) return; if (!unlocked) return; play('tap'); openMission(i); });
  return card;
}
function distinctBy(list, key) { const seen = new Set(); return list.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); }

// --- Akadály-bélyegképek
function thumbNames(o, world) {
  switch (o.type) {
    case 'STEEP_SLOPE': return ['hill'];
    case 'LEDGE': return [`ledge_world_${world + 1}`, 'ledge'];
    case 'ICE_SLOPE': return ['ice_hill'];
    case 'TRAMPOLINE_CLIFF': return ['cliff'];
    case 'METAL_TOWER': case 'MAGNET_LIFT': return ['metal_tower'];
    case 'HIGH_SWITCH': return ['switch_off'];
    case 'DARK': return ['cave'];
    case 'ROCK_WALL': return ['rock_wall'];
    case 'PLATE_DOOR': return ['door', 'gate'];
    case 'LEVER_GATE': return ['lever_up'];
    case 'LINKED_GATE': return ['gate'];
    case 'BUTTON': return ['button_up'];
    case 'HEAVY_BOX': return ['box'];
    case 'BOULDER': return ['boulder'];
    case 'ICE_BLOCK': return ['ice_block'];
    case 'THORNS': return ['thorns'];
    case 'CRANE_BRIDGE': return ['crane_post'];
    case 'RAFT_RIVER': return ['raft'];
    case 'VINE_CHASM': return ['vine_branch'];
    case 'SEAWEED': return ['seaweed'];
    case 'CLAM': return ['clam'];
    case 'KEY': return ['key'];
    case 'LOCKED_DOOR': return ['locked_door'];
    case 'STICKY_GUM': return ['sticky_gum'];
    case 'CHOCOLATE_WALL': return ['chocolate_wall'];
    case 'PUDDING': return ['pudding'];
    case 'FRAGILE_BRIDGE': return [({ 7: 'bridge_wafer', 9: 'bridge_crystal', 10: 'bridge_cloud' })[world] || 'bridge_glass'];
    case 'CONVEYOR': return ['conveyor'];
    case 'GEAR_GATE': return ['gear_gate'];
    case 'DOUBLE_PLATE': return ['plate_up'];
    case 'CRYSTAL_WALL': return ['crystal_wall'];
    case 'CRYSTAL_SPIKES': return ['crystal_spikes'];
    case 'CLOUD_WALL': return ['cloud_wall'];
    case 'WINDMILL': return ['windmill_tower'];
    case 'TRAFFIC_GATE': return ['traffic_gate_post'];
    default: return [];
  }
}
const HOLE_TEX = { WATER: Paths.WATER_TILE, DEEP_WATER: Paths.DEEP_WATER_TILE, QUICKSAND: Paths.QUICKSAND_TILE, LAVA: Paths.LAVA_TILE, SPACE_GAP: Paths.SPACE_TILE };
function obstacleThumb(o, world, w, hh) {
  const c = canvas((g, cw, ch) => {
    g.fillStyle = '#E8F4FF'; g.beginPath(); g.roundRect(0, 0, cw, ch, 10); g.fill(); g.save(); g.clip();
    const gy = ch * 0.74;
    const gk = Paths.ground(world); const ground = img(gk);
    const tex = HOLE_TEX[o.type] ? img(HOLE_TEX[o.type]) : null;
    const pic = thumbNames(o, world).map((n) => img(Paths.obstacle(n))).find(Boolean);
    if (!ground) { g.restore(); return; }
    const top = Math.min(0.4, surface(gk)); const tileH = (ch - gy) / (1 - top);
    const groundPart = (x1, x2) => { g.save(); g.beginPath(); g.rect(x1, 0, x2 - x1, ch); g.clip(); drawTiled(g, ground, 0, gy - tileH * top, cw, ch, tileH, 0); g.restore(); };
    const hole = tex || ['GAP', 'FRAGILE_BRIDGE', 'CRANE_BRIDGE', 'VINE_CHASM', 'RAFT_RIVER'].includes(o.type);
    if (hole) {
      const a = cw * 0.24;
      groundPart(0, a); groundPart(cw - a, cw);
      if (tex) drawTiled(g, tex, a, gy + ch * 0.03, cw - a, ch, ch - gy, 0); else { g.fillStyle = '#3A3550'; g.fillRect(a, gy, cw - 2 * a, ch - gy); }
      if (pic && (o.type === 'FRAGILE_BRIDGE' || o.type === 'RAFT_RIVER')) drawStretch(g, pic, a - cw * 0.02, gy - ch * 0.08, cw - a + cw * 0.02, gy + ch * 0.06);
      if (pic && (o.type === 'CRANE_BRIDGE' || o.type === 'VINE_CHASM')) drawFit(g, pic, cw * 0.08, ch * 0.06, cw * 0.92, gy);
    } else {
      groundPart(0, cw);
      if (pic) drawFit(g, pic, cw * 0.1, ch * 0.06, cw * 0.9, gy + ch * 0.03);
    }
    g.restore();
  }, { w, hgt: hh });
  c.style.flex = 'none';
  return c;
}
/** „+n”, ha nem fér ki mind; a sorra koppintva kinyílik. [key] a kinyitott állapot megőrzéséhez. */
function obstacleThumbRow(list, world, maxShown, w, hh, key) {
  const open = state.expanded.has(key);
  const overflow = list.length > maxShown;
  const shown = open || !overflow ? list : list.slice(0, maxShown);
  const row = h('div', { class: 'thumbs' + (open ? ' open' : '') }, ...shown.map((o) => obstacleThumb(o, world, w, hh)));
  if (overflow && !open) row.append(h('div', { class: 'more', style: { width: hh + 'px', height: hh + 'px' } }, `+${list.length - maxShown}`));
  if (overflow) row.addEventListener('click', (e) => { e.stopPropagation(); play('tap'); if (open) state.expanded.delete(key); else state.expanded.add(key); render(); });
  return row;
}

// --- Műhely
function workshopScreen(index) {
  const m = state.missions[index];
  const teamSize = Math.min(Math.max(1, m.team), state.team.length);
  state.selected = Math.min(Math.max(0, state.selected), teamSize - 1);
  const robot = state.team[state.selected];
  const portrait = appH() > appW();
  const failures = state.failures[m.id] || 0;
  const showHint = m.hard || failures >= 1;
  const header = h('div', { class: 'row', style: { gap: '14px' } },
    roundButton('back', t('back'), back),
    h('div', { class: 'grow' }, h('div', { class: 'l-m soft' }, t('mission_number', index + 1)), h('div', { class: 'h-l clamp2' }, missionTitle(m))),
    !portrait && m.obstacles.length ? obstacleStrip(m) : null,
    showHint ? hintButton(failures >= 2, () => hintDialog(m)) : null,
    !portrait ? gameButton(t('workshop_start'), 'play', startMission) : null);
  const left = h('div', { class: 'ws-left' },
    m.isTeam ? teamBar(m) : null,
    robotStage(robot),
    garagePanel(robot));
  if (portrait) left.querySelector('.stage').style.setProperty('--stage-h', (appH() * (m.isTeam ? 0.22 : 0.28)) + 'px');
  const body = h('div', { class: 'ws-body' }, left, h('div', { class: 'ws-right scroll' }, partsPanel(robot)));
  return h('div', { class: 'screen' }, header,
    portrait && m.obstacles.length ? h('div', { style: { alignSelf: 'center' } }, obstacleStrip(m)) : null,
    body,
    portrait ? gameButton(t('workshop_start'), 'play', startMission, { full: true, minH: 64 }) : null);
}
function obstacleStrip(m) {
  const shown = distinctBy(m.obstacles.filter((o) => o.type !== 'BUTTON'), (o) => o.type + [...o.required].join());
  return h('div', { class: 'strip', 'aria-label': t('workshop_obstacles') }, obstacleThumbRow(shown, m.world, 4, 52, 40, 'ws'));
}
function hintButton(pulse, onClick) {
  const glowing = pulse && img('ui/bulb_on');
  const b = glowing
    ? h('button', { class: 'hint-bulb pulse', 'aria-label': t('hint_button') }, h('img', { src: 'assets/img/ui/bulb_on.webp', alt: '' }))
    : roundButton('bulb', t('hint_button'), () => {});
  if (pulse && !glowing) b.classList.add('pulse');
  b.addEventListener('click', () => { play('tap'); onClick(); });
  return b;
}
function teamBar(m) {
  const tabs = h('div', { class: 'team-tabs' });
  for (let i = 0; i < m.team; i++) {
    const r = state.team[i]; const sel = i === state.selected;
    const tab = h('button', { class: 'team-tab' + (sel ? ' sel' : ''), 'aria-label': t(m.isLanes ? 'team_lane' : 'team_robot', i + 1) },
      canvas((g, w, hh) => drawRobot(g, r, pose({ lampOn: r.arm === 'lamp_arm' }), w / 2, hh * 0.98, hh * 0.9, 0, false)),
      h('div', { class: 'n', style: { background: ROBOT_COLORS[r.color] } }, i + 1));
    tab.addEventListener('click', () => { if (!sel) play('select'); state.selected = i; render(); });
    tabs.append(tab);
  }
  return h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' } }, tabs,
    h('div', { class: 'row team-info', style: { gap: '6px' } }, icon('team', 'ico-s'), h('div', { class: 'b-m soft clamp2' }, t(m.isLanes ? 'team_lanes_info' : 'team_relay_info'))));
}
function robotStage(robot) {
  let popStart = performance.now();
  const c = canvas((g, w, hh) => {
    const t0 = performance.now();
    const tt = t0 % 20000;
    const k = Math.min(1, (t0 - popStart) / 450);
    const pop = 1 - 0.1 * Math.exp(-6 * k) * Math.cos(10 * k);
    g.save(); g.translate(w / 2, hh / 2); g.scale(pop, pop); g.translate(-w / 2, -hh / 2);
    const groundY = hh * 0.88;
    const rh = Math.min(hh * 0.72, w * 0.8 / G.ASPECT);
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(w / 2, groundY + rh * 0.01, rh * 0.45, rh * 0.06, 0, 0, Math.PI * 2); g.fill();
    drawRobot(g, robot, pose({
      wheelAngleDeg: tt * 0.12,
      springStretch: robot.mobility === 'spring' ? 0.15 * Math.sin(tt * 0.004) : 0,
      propellerPhase: tt * 0.02,
      hover: robot.mobility === 'propeller' ? 5 + 2 * Math.sin(tt * 0.005) : 0,
      armUp: robot.arm === 'extend_arm' ? 0.35 + 0.35 * Math.sin(tt * 0.002) : 0,
      lampOn: robot.arm === 'lamp_arm',
    }), w / 2, groundY, rh);
    g.restore();
  }, { live: true });
  return h('div', { class: 'stage', 'aria-label': `${t('robot_description')}: ${partName(robot.mobility)}, ${partName(robot.arm)}` }, c);
}
function garagePanel(robot) {
  const row = h('div', { class: 'garage-row' });
  for (let slot = 0; slot < E.GARAGE_SLOTS; slot++) {
    const saved = state.garage[slot];
    const isCur = saved && E.encodeRobot(saved) === E.encodeRobot(robot);
    const save = () => { play('new_part', 0.6); state.garage[slot] = { ...robot }; persist(); render(); };
    const el = h('button', { class: 'garage-slot' + (saved ? ' full' : '') + (isCur ? ' cur' : ''), 'aria-label': saved ? t('garage_load', slot + 1) : t('garage_empty', slot + 1) });
    if (!saved) el.append(h('div', { class: 'plus' }, '+'));
    else {
      el.append(canvas((g, w, hh) => drawRobot(g, saved, pose({ lampOn: saved.arm === 'lamp_arm' }), w / 2, hh * 0.96, hh * 0.82, 0, false)));
      const s = h('span', { class: 'save', role: 'button', 'aria-label': t('garage_save', slot + 1) }, icon('save', ''));
      s.addEventListener('click', (e) => { e.stopPropagation(); save(); });
      el.append(s);
    }
    el.addEventListener('click', () => { if (!saved) save(); else { play('select'); updateRobot(saved); } });
    row.append(el);
  }
  return h('div', { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    h('div', { class: 'row', style: { gap: '6px' } }, icon('garage', 'ico-s'), h('div', { class: 't-m' }, t('garage_title'))), row);
}
function partsPanel(robot) {
  const avail = available();
  const W = (appH() > appW() ? appW() - 32 : (appW() - 48) * 0.62);
  const colsFor = (n) => Math.max(2, Math.min(n, Math.floor(W / 104)));
  const card = (id, sel, locked, onClick, height, pic) => {
    const c = h('button', { class: 'part-card' + (sel ? ' sel' : '') + (locked ? ' locked' : ''), style: { height: height + 'px' }, 'aria-label': locked ? `${partName(id)} – ${t('workshop_locked')}` : partName(id) },
      h('div', { class: 'inner' }, pic, h('div', { class: 'name' }, partName(id))));
    if (sel) c.append(h('div', { class: 'check' }, icon('check', '')));
    if (locked) c.append(h('div', { class: 'lockdot' }, icon('lock', '')));
    c.addEventListener('click', () => { if (!locked) onClick(); });
    return c;
  };
  const mob = h('div', { class: 'parts-grid', style: { '--cols': colsFor(E.MOBILITY_IDS.length) } },
    ...E.MOBILITY_IDS.map((id) => card(id, robot.mobility === id, !avail.has(id), () => updateRobot({ ...robot, mobility: id }), 92,
      canvas((g, w, hh) => drawMobilityThumb(g, id, w, hh), { hgt: 44 }))));
  const arms = h('div', { class: 'parts-grid', style: { '--cols': colsFor(E.ARM_IDS.length) } },
    ...E.ARM_IDS.map((id) => card(id, robot.arm === id, !avail.has(id), () => updateRobot({ ...robot, arm: id }), 78,
      canvas((g, w, hh) => drawArmThumb(g, id, w, hh), { hgt: 30 }))));
  const look = h('div', { class: 'row', style: { overflowX: 'auto', paddingBottom: '4px' } },
    ...E.COLORS.map((c) => {
      const sel = robot.color === c;
      const b = h('button', { class: 'color-dot' + (sel ? ' sel' : ''), style: { background: ROBOT_COLORS[c] }, 'aria-label': c }, sel ? icon('check', '') : null);
      b.addEventListener('click', () => updateRobot({ ...robot, color: c }));
      return b;
    }),
    h('div', { style: { width: '8px', flex: 'none' } }),
    ...E.HEADS.map((hd) => {
      const sel = robot.head === hd;
      const b = h('button', { class: 'head-chip' + (sel ? ' sel' : ''), 'aria-label': hd },
        canvas((g, w, hh) => drawRobot(g, { ...robot, head: hd, mobility: 'wheels' }, pose(), w / 2, hh * 1.84, hh * 1.7, 0, false)));
      b.addEventListener('click', () => updateRobot({ ...robot, head: hd }));
      return b;
    }));
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
    h('div', { class: 't-m' }, t('workshop_mobility')), mob,
    h('div', { class: 't-m' }, t('workshop_arm')), arms,
    h('div', { class: 't-m' }, t('workshop_look')), look);
}

// --- Tippek
function hintText(o, nobodyArrived) {
  if (!o) return t('hint_generic');
  const helper = ['PLATE_DOOR', 'LEVER_GATE', 'CRANE_BRIDGE', 'RAFT_RIVER', 'TRAMPOLINE_CLIFF', 'MAGNET_LIFT'];
  if (o.type === 'GAP') return t(o.required.has('JUMP') ? 'hint_GAP' : 'hint_GAP_FLY');
  if ((o.type === 'DOUBLE_PLATE' || o.type === 'WINDMILL' || helper.includes(o.type)) && nobodyArrived) return t('hint_team_goal');
  if (o.type === 'BUTTON') return t(o.required.size === 0 ? 'hint_BUTTON' : 'hint_BUTTON_HIGH');
  const k = 'hint_' + o.type;
  return t(k) === k ? t('hint_generic') : t(k);
}
function partThumbRow(ids, key) {
  const open = state.expanded.has(key);
  const overflow = ids.length > 4;
  const shown = open || !overflow ? ids : ids.slice(0, 4);
  const row = h('div', { class: 'part-thumbs' }, ...shown.map((id) => h('div', { class: 'part-thumb' },
    canvas((g, w, hh) => (E.findPart(id)?.slot === 'MOBILITY' ? drawMobilityThumb(g, id, w, hh) : drawArmThumb(g, id, w, hh))),
    partName(id))));
  if (overflow && !open) row.append(h('div', { class: 'more-circle' }, `+${ids.length - 4}`));
  if (overflow) row.addEventListener('click', () => { play('tap'); if (open) state.expanded.delete(key); else state.expanded.add(key); refreshDialog(); });
  return row;
}
function obstacleHelp(o, avail, nobodyArrived, compact, world, key) {
  const alone = E.Hints.partsFor(o).filter((id) => avail.has(id));
  const el = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    h('div', { class: 'row' }, obstacleThumb(o, world, compact ? 72 : 96, compact ? 50 : 66), h('div', { class: (compact ? 'b-m' : 'b-l') + ' grow' }, hintText(o, nobodyArrived && E.isHelperPost(o)))));
  const soft = (k) => h('div', { class: 'b-m soft' }, t(k));
  if (o.type === 'LINKED_GATE') el.append(soft('hint_other_lane'));
  else if (o.type === 'LOCKED_DOOR' || o.type === 'KEY') el.append(soft('diag_key'), partThumbRow(alone, key));
  else if (E.isHelperPost(o)) {
    if (E.Hints.anyoneCanHelp(o)) el.append(soft('hint_anyone_helps'));
    else el.append(soft('diag_helper_needs'), partThumbRow(E.Hints.helperPartsFor(o).filter((id) => avail.has(id)), key));
  } else {
    if (o.type === 'FRAGILE_BRIDGE') el.append(soft('diag_light'));
    if (alone.length) el.append(soft('diag_needs'), partThumbRow(alone, key));
  }
  return el;
}
function diagnosis(m, robots, avail) {
  const nobodyArrived = !robots.some((r) => r.phase === 'DONE');
  const col = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
  if (robots.length <= 1) {
    const o = m.obstacles.find((x) => x.id === robots[0]?.obstacleId);
    if (o) col.append(h('div', { class: 't-m' }, t('diag_stuck_single')), obstacleHelp(o, avail, nobodyArrived, false, m.world, 'd0'));
    return col;
  }
  robots.forEach((r, i) => {
    const o = m.obstacles.find((x) => x.id === r.obstacleId);
    const stuck = ['STUCK', 'BLOCKED', 'WAITING'].includes(r.phase);
    const label = r.phase === 'DONE' ? t('diag_done', i + 1) : r.phase === 'HELPING' ? t('diag_helping', i + 1) : t('diag_stuck', i + 1);
    col.append(h('div', { class: 'diag ' + (stuck ? 'bad' : 'ok') },
      h('div', { class: 'row', style: { gap: '8px' } }, h('div', { class: 'dot24', style: { background: stuck ? C.Danger : C.ButtonBlue } }, i + 1), h('div', { class: 't-m' }, label)),
      stuck && o ? obstacleHelp(o, avail, nobodyArrived, true, m.world, 'd' + i) : null));
  });
  if (nobodyArrived && !m.isLanes) col.append(h('div', { class: 'b-m soft' }, t('diag_order')));
  return col;
}
let refreshDialog = () => {};
function hintDialog(m) {
  const build = () => {
    const level = state.hintLevel[m.id] || 0;
    const avail = available();
    const last = state.lastFailure[m.id];
    const key = E.Hints.keyObstacle(m);
    const step = (n, title, ...content) => h('div', { class: 'hint-step' }, h('div', { class: 'row', style: { gap: '8px' } }, h('div', { class: 'step-n' }, n), h('div', { class: 't-m' }, title)), ...content);
    const parts = [h('div', { class: 'row', style: { gap: '8px' } }, icon('bulb', 'ico-s'), h('div', { class: 'h-xl' }, t('hint_title')))];
    if (level >= 1) {
      parts.push(step(1, t(last ? 'diag_title' : 'hint_step1'),
        last && last.some((r) => r.obstacleId) ? diagnosis(m, last, avail) : key ? obstacleHelp(key, avail, false, false, m.world, 'k') : null));
    }
    if (level >= 2) {
      const distinct = distinctBy(m.obstacles.filter((o) => o.type !== 'BUTTON' && o.type !== 'KEY'), (o) => o.type + [...o.required].join() + '|' + (o.helperAnyOf ? [...o.helperAnyOf].join() : '-'));
      parts.push(step(2, t('hint_step2_all'), h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, ...distinct.map((o, i) => obstacleHelp(o, avail, false, true, m.world, 'a' + i)))));
    }
    if (level >= 3 && m.solution.length) {
      const sols = h('div', { class: 'part-thumbs' }, ...m.solution.map((sol, i) => {
        const r = { ...(state.team[i] || E.robot()), mobility: sol.mobility, arm: sol.arm };
        return h('div', { class: 'sol-card' },
          canvas((g, w, hh) => drawRobot(g, r, pose({ lampOn: r.arm === 'lamp_arm' }), w / 2, hh * 0.98, hh * 0.92, 0, false), { w: 80, hgt: 84 }),
          h('div', { class: 'l-m' }, `${i + 1}.`), h('div', { class: 'l-m soft' }, `${partName(sol.mobility)} + ${partName(sol.arm)}`));
      }));
      parts.push(step(3, t('hint_solution'), sols, gameButton(t('hint_apply'), 'wrench', () => { applySolution(m); closeDialog(); }, { color: 'green', full: true, minH: 56 })));
    }
    const nextLabel = ['hint_step1', 'hint_step2', 'hint_step3'][level];
    if (nextLabel) {
      const b = gameButton(t(nextLabel), 'bulb', () => { state.hintLevel[m.id] = Math.min(3, level + 1); refreshDialog(); }, { color: '#E0A030', full: true, minH: 56 });
      b.style.background = '#E0A030';
      parts.push(b);
    }
    parts.push(h('div', { class: 'dlg-actions' }, h('button', { class: 'text-btn', onclick: closeDialog }, t('hint_close'))));
    return parts;
  };
  refreshDialog = () => {
    const d = overlay().querySelector('.dialog');
    const top = d ? d.scrollTop : 0;
    openDialog(build());
    const nd = overlay().querySelector('.dialog'); if (nd) nd.scrollTop = top;
  };
  state.expanded.clear();
  openDialog(build());
}
function applySolution(m) {
  const avail = available();
  m.solution.forEach((sol, i) => { if (i < state.team.length) state.team[i] = E.sanitizeAvailable({ ...state.team[i], mobility: sol.mobility, arm: sol.arm }, avail); });
  state.selected = 0;
  persist(); render();
}

// --- Pálya
function runScreen(index) {
  const se = state.session;
  const m = se.mission;
  const narrow = appW() < 600;
  const scene = canvas((g, w, hh) => {
    const s = state.session; if (!s) return;
    const now = performance.now();
    const f = s.run.frameAt(now - s.startedAt);
    onFrame(f);
    runSounds(s, f);
    drawMission(g, w, hh, s.mission, s.team, f, now % 12000, s.camera);
    updateRunUi(f);
  }, { cls: 'scene', live: true });
  const progress = m.length > 1 ? canvas((g, w, hh) => {
    const p = state.session?.uiProgress;
    if (p == null) return;
    const track = img('ui/progress_track'); const fill = img('ui/progress_fill');
    if (track && fill) {
      drawPill(g, track, w, hh);
      const fw = w * p;
      if (fw > hh * 0.6) { g.save(); g.beginPath(); g.rect(0, 0, fw, hh); g.clip(); drawPill(g, fill, w, hh); g.restore(); }
    }
  }, { cls: 'progress', live: true, style: { width: (narrow ? 96 : 160) + 'px' } }) : null;
  const top = h('div', { class: 'topbar' },
    roundButton('back', t('run_back'), back, 52),
    h('div', { class: 'grow' }, h('div', { class: (narrow ? 't-m' : 'h-l') + ' title-chip ellipsis' }, `${index + 1}. ${missionTitle(m)}`)),
    progress);
  const wrap = h('div', { class: 'screen run', style: { padding: 0, background: C.Cream } }, scene, top, h('div', { class: 'result-slot' }));
  return wrap;
}
function updateRunUi(f) {
  const se = state.session; if (!se) return;
  se.uiProgress = f.state.k === 'Moving' ? f.state.progress : f.state.k === 'Success' ? 1 : null;
  const terminal = E.isTerminal(f.state);
  const slot = app().querySelector('.result-slot');
  if (!slot) return;
  if (terminal && se.shown !== se.runId) {
    se.shown = se.runId;
    slot.replaceChildren(resultCard(f));
  } else if (!terminal && slot.firstChild) slot.replaceChildren();
}
function resultCard(f) {
  const se = state.session; const m = se.mission;
  const s = state.screen; const next = s.index + 1;
  const hasNext = next < state.missions.length && (isUnlocked(next) || f.state.k === 'Success');
  const narrow = appW() < 600;
  const card = h('div', { class: 'result-card' });
  if (f.state.k === 'Success') {
    card.append(canvas((g, w, hh) => {
      const r = hh * 0.42;
      drawStar(g, w * 0.2, hh * 0.58, r * 0.85, true, -12); drawStar(g, w * 0.5, hh * 0.46, r, true); drawStar(g, w * 0.8, hh * 0.58, r * 0.85, true, 12);
    }, { w: 180, hgt: 60 }), h('div', { class: 'h-xl' }, t(m.isTeam ? 'result_team_success' : 'result_success')));
    if (state.newPartId) {
      const id = state.newPartId;
      card.append(h('div', { class: 'new-part' },
        canvas((g, w, hh) => (E.findPart(id)?.slot === 'MOBILITY' ? drawMobilityThumb(g, id, w, hh) : drawArmThumb(g, id, w, hh)), { w: 72, hgt: 44 }),
        h('div', { class: 't-m' }, t('result_new_part', partName(id)))));
    }
    card.append(h('div', { class: 'btn-row', style: narrow ? { flexDirection: 'column', width: '100%' } : {} },
      gameButton(t('result_retry'), 'retry', retry, { color: 'blue', minH: 56, full: narrow }),
      hasNext ? gameButton(t('result_next'), 'next', nextMission, { minH: 56, full: narrow }) : gameButton(t('run_back'), 'back', back, { minH: 56, full: narrow })));
  } else {
    card.append(h('div', { class: 'h-xl' }, t('result_failure')), gameButton(t('result_workshop'), 'back', back, { full: narrow }));
  }
  return h('div', { class: 'result-wrap' }, card);
}

// --- Szülői oldal
function parentScreen() {
  const info = (title, body) => h('div', { class: 'info-card' }, h('div', { class: 'h-l' }, title), h('div', { class: 'b-l soft' }, body));
  const sw = h('button', { class: 'switch' + (state.soundOn ? ' on' : ''), 'aria-label': t('parent_sound'), onclick: () => { state.soundOn = !state.soundOn; persist(); render(); } });
  const reset = gameButton(t('reset_progress'), 'retry', () => confirmDialog(t('reset_progress'), t('reset_question'), t('reset_yes'), resetProgress), { color: '#B8323A', full: true, minH: 56 });
  reset.style.background = '#B8323A';
  const settings = h('div', { class: 'info-card', style: { gap: '12px' } }, h('div', { class: 'h-l' }, t('parent_settings_title')),
    h('div', { class: 'row' }, h('div', { class: 'b-l grow' }, t('parent_sound')), sw), reset,
    h('div', { class: 'b-m soft' }, t('parent_version', VERSION)));
  const two = appW() >= 840;
  const content = two
    ? h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } },
      h('div', { style: { flex: 0.62, display: 'flex', flexDirection: 'column', gap: '12px' } }, info(t('parent_about_title'), t('parent_about')), info(t('parent_play_title'), t('parent_play')), info(t('parent_data_title'), t('parent_data'))),
      h('div', { style: { flex: 0.38 } }, settings))
    : h('div', { style: { maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' } }, info(t('parent_about_title'), t('parent_about')), info(t('parent_play_title'), t('parent_play')), info(t('parent_data_title'), t('parent_data')), settings);
  return h('div', { class: 'screen' }, h('div', { class: 'row', style: { gap: '14px' } }, roundButton('back', t('back'), back), h('div', { class: 'h-xl' }, t('parent_title'))),
    h('div', { class: 'scroll grow' }, content));
}
function resetProgress() {
  state.completed = new Set(); state.team = DEFAULT_TEAM.map((r) => ({ ...r })); state.selected = 0; state.newPartId = null;
  state.failures = {}; state.hintLevel = {}; state.lastFailure = {}; state.garage = [null, null, null];
  persist(); go({ k: 'worlds' });
}

// ---- Látható magasság (a beépített böngészők – pl. Messenger – sávjai nélkül)
const realH = () => (window.visualViewport ? window.visualViewport.height : window.innerHeight);
const realW = () => (window.visualViewport ? window.visualViewport.width : window.innerWidth);
/** Kényszerített fekvő nézet (iPhone): álló készüléken a játékot 90°-kal elforgatva rajzoljuk. */
const rotated90 = () => !!store.forceLandscape && realH() > realW();
function appW() { return rotated90() ? realH() : realW(); }
function appH() { return rotated90() ? realW() : realH(); }
function setAppHeight() {
  document.documentElement.style.setProperty('--app-h', Math.round(realH()) + 'px');
  document.documentElement.style.setProperty('--app-w', Math.round(realW()) + 'px');
  document.documentElement.classList.toggle('rot90', rotated90());
  document.documentElement.classList.toggle('is-portrait', appH() > appW());
  document.documentElement.classList.toggle('is-short', appH() <= 520 && appW() > appH());
}
setAppHeight();
window.visualViewport?.addEventListener('resize', () => { setAppHeight(); clearTimeout(resizeT); resizeT = setTimeout(() => { if (state.screen.k !== 'run') render(); }, 150); });

// ---- Fő ciklus -----------------------------------------------------------------------------
function loop() {
  for (const c of liveCanvases) paint(c);
  raf = requestAnimationFrame(loop);
}
let resizeT = 0;
window.addEventListener('resize', () => { setAppHeight(); clearTimeout(resizeT); resizeT = setTimeout(() => { if (state.screen.k !== 'run') render(); else liveCanvases.forEach(paint); }, 120); });

async function main() {
  const fill = document.getElementById('loadFill');
  const [strings, missionsRaw] = await Promise.all([
    fetch('assets/strings.json').then((r) => r.json()),
    fetch('assets/missions.json').then((r) => r.json()),
    loadArt((p) => { if (fill) fill.style.width = Math.round(p * 100) + '%'; }),
  ]);
  STR = strings;
  lang = detectLang();
  document.documentElement.lang = lang;
  state.missions = missionsRaw.map((r) => E.parseMission(r)).filter((x) => x.mission).map((x) => x.mission);
  loadProgress();
  try { await document.fonts.ready; } catch (e) { /* */ }
  render();
  loop();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // új változat: ha az új offline-tároló átvette az oldalt, egyszer újratöltünk
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded || state.screen.k === 'run') return;
      reloaded = true; location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  }
}
main();

// tesztekhez
window.__lrf = { state, go, startMission, render, setLang, E };
