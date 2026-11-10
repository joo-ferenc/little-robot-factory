// A pálya oldalnézete (MissionCanvas + WorldTheme átirata). Minden a motor képkockájából számolódik.
import {
  img, Paths, footGap, surface, C, ROBOT_COLORS, rgba, mix, drawStretch, drawFit, fitRect, drawTiled,
  circle, ring, line, rrect, oval, arc, rotated, clipped, drawStar, drawQuestionBubble,
} from './art.js';
import { drawRobot, pose as mkPose, G } from './robot.js';
import { PARAMS, peakHeight, clamp, P } from './engine.js';

const LINK_COLORS = ['#3D8BFF', '#B04DE0', '#1F8A5B', '#FF8A3D'];

const THEMES = [
  [C.SkyLight, C.Cream, C.Soil, C.Grass, C.SoilDark, C.PitDark],
  ['#FFE3A8', '#FFF6E0', '#E2B865', '#F2D08A', '#B98A3E', '#6B4A2F'],
  ['#CDEBFF', '#F5FBFF', '#B7D3E6', '#FFFFFF', '#7FA3BD', '#2E4A66'],
  ['#BFE8C4', '#EFFBEA', '#7A5634', '#3F9A3A', '#543820', '#263322'],
  ['#FFC7A8', '#FFEFE3', '#5E4C46', '#7D655B', '#3E302B', '#2A1A16'],
  ['#12163A', '#2C3168', '#9AA3B5', '#C9D0DC', '#6E788C', '#070A1E'],
  ['#0E5A8A', '#3FA7C9', '#D9C08A', '#EAD6A6', '#A88E5C', '#0A2E4A'],
  ['#FFC9E3', '#FFF0F7', '#8A4B2F', '#FF9EC8', '#5E3220', '#4A2318'],
  ['#E9D9B8', '#F8F0DE', '#7A6448', '#B08D3C', '#4F3F2A', '#2E2416'],
  ['#1E1235', '#3B2361', '#4A3F5E', '#8C6CC9', '#2B2338', '#0E0818'],
  ['#8FD3FF', '#EAF7FF', '#8DBF6A', '#B8E68C', '#6B8F4E', '#BFE3FF'],
  ['#B8C7E0', '#E8EEF7', '#6E7685', '#9AA3B5', '#4A5160', '#2A2F3A'],
];
export function theme(world) {
  const t = THEMES[world] || THEMES[0];
  return { skyTop: t[0], skyBottom: t[1], ground: t[2], groundTop: t[3], groundDark: t[4], pit: t[5], world, isSpace: world === 5 };
}

const isHole = (o) => ['GAP', 'WATER', 'QUICKSAND', 'LAVA', 'VINE_CHASM', 'SPACE_GAP', 'CRANE_BRIDGE', 'RAFT_RIVER', 'DEEP_WATER', 'FRAGILE_BRIDGE', 'WIND_CHASM'].includes(o.type);
const gateOpen = (p) => clamp((p - 0.35) / 0.2, 0, 1);
const oimg = (n) => img(Paths.obstacle(n));

/** Kamera-állapot küldetésenként (a Composable remember megfelelője). */
export function newCamera() { return { cam: -1 }; }

/**
 * A teljes jelenet a [W]×[H] vásznon. [fx] folyamatos idő (ms, 12 s-os ciklus) a díszanimációkhoz.
 */
export function drawMission(g, W, H, mission, team, frame, fx, camera) {
  const th = theme(mission.world);
  const links = {};
  mission.obstacles.filter((o) => o.type === 'BUTTON').forEach((b, i) => { links[b.id] = LINK_COLORS[i % LINK_COLORS.length]; });
  const lanes = Math.max(1, mission.lanes);
  const unit = Math.max(W, H * 0.9);
  const sceneH = Math.min(H, unit * (lanes > 1 ? 0.75 : 0.56));
  const visible = W / unit;
  const target = cameraTarget(mission, frame, visible);
  const cam = (camera.cam < 0 || frame.state.k === 'Ready') ? target : camera.cam + (target - camera.cam) * 0.14;
  camera.cam = cam;

  g.fillStyle = th.skyTop; g.fillRect(0, 0, W, H);
  g.save(); g.translate(0, H - sceneH);
  const S = { w: W, h: sceneH };
  // ég / háttér
  const bg = img(Paths.background(mission.world));
  g.fillStyle = th.skyBottom; g.fillRect(0, 0, W, sceneH);
  if (bg) drawTiled(g, bg, 0, 0, W, sceneH, sceneH, -(cam * unit * 0.3));
  const laneH = sceneH / lanes;
  for (let lane = 0; lane < lanes; lane++) {
    g.save(); g.translate(0, lane * laneH);
    drawLane(g, { w: W, h: laneH }, mission, lane, lanes, team, frame, th, unit, cam, links, fx);
    g.restore();
  }
  g.restore();
}

function cameraTarget(m, f, visible) {
  const maxCam = Math.max(0, m.length - visible);
  if (f.robots.length === 1) return clamp(f.robots[0].x - 0.35 * visible, 0, maxCam);
  let active = f.robots.filter((r) => r.phase !== 'HELPING' && r.phase !== 'STUCK' && r.phase !== 'DONE');
  if (!active.length) active = f.robots.filter((r) => r.phase !== 'STUCK');
  if (!active.length) active = f.robots;
  const lead = Math.max(...active.map((r) => r.x));
  const rear = Math.min(...active.map((r) => r.x));
  let c = lead - 0.6 * visible;
  if (rear < c + 0.06) c = rear - 0.06;
  return clamp(c, 0, maxCam);
}

function drawLane(g, S, m, lane, lanes, team, f, th, unit, cam, links, fx) {
  const h = S.h;
  const gy = h * (lanes > 1 ? 0.8 : 0.72);
  const robotH = Math.min(2 * PARAMS.robotHalfWidth * unit / G.ASPECT, h * (lanes > 1 ? 0.4 : 0.24));
  const v = { unit, gy, robotH, cam, sx: (u) => (u - cam) * unit };
  const obstacles = m.laneObstacles(lane);

  drawGround(g, S, m, obstacles, v, th);
  for (const o of obstacles) drawObstacleBack(g, S, m, o, f, v, th, links, fx);
  drawFlags(g, m, v, fx);

  const robots = f.robots.map((r, i) => ({ i, r })).filter((x) => x.r.lane === lane);
  const order = [...robots].sort((a, b) => {
    const ka = (a.r.phase === 'HELPING' || a.r.phase === 'STUCK') ? 0 : 1;
    const kb = (b.r.phase === 'HELPING' || b.r.phase === 'STUCK') ? 0 : 1;
    return ka - kb || b.i - a.i;
  });
  const success = f.state.k === 'Success';
  for (const { i, r } of order) {
    const cfg = team[i] || team[0];
    const behind = r.phase === 'HELPING' || r.phase === 'STUCK';
    const hop = success && (r.phase === 'DONE' || f.robots.length === 1) ? Math.abs(Math.sin(fx * 0.006 + i)) * 0.12 : 0;
    const rx = v.sx(r.x);
    const ry = gy - (r.lift + hop) * robotH;
    const rSize = behind && f.robots.length > 1 ? robotH * 0.9 : robotH;
    const cap = r.capability;
    const airborne = ['JUMP', 'FLY', 'JET', 'GLIDE', 'WALL_WALK'].includes(cap) || (r.assisted && r.lift > 0.05);
    if (cap === 'SWING') drawRope(g, m, r, v, rx, ry, rSize);
    const onGround = !airborne && Math.abs(r.lift + hop) < 0.01;
    drawRobot(g, cfg, poseFor(cfg, r, m, f, fx, success), rx, ry, rSize, 0, onGround);
  }

  for (const o of obstacles) drawObstacleFront(g, S, m, o, f, v, team, th, fx);

  for (const { i, r } of robots) {
    const rx = v.sx(r.x);
    const ry = gy - r.lift * robotH;
    if (r.phase === 'BLOCKED' || (r.phase === 'STUCK' && f.state.k === 'Failure')) drawQuestionBubble(g, rx + robotH * 0.45, ry - robotH * 1.15, robotH * 0.2);
    if (success && (r.phase === 'DONE' || f.robots.length === 1)) {
      for (let k = 0; k < 6; k++) {
        const a = fx * 0.0015 + k * (2 * Math.PI / 6) + i;
        drawStar(g, rx + Math.cos(a) * robotH * 0.9, ry - robotH * 0.75 + Math.sin(a) * robotH * 0.55, robotH * 0.09, true, fx * 0.1);
      }
    }
    const col = ROBOT_COLORS[team[i]?.color] || C.Steel;
    if (f.robots.length > 1) drawRobotNumber(g, i, rx, ry - robotH * 1.12, robotH * 0.13, col);
    if (r.carriesKey) drawKey(g, rx + robotH * 0.3, ry - robotH * 1.12, robotH * 0.16);
  }
  if (lanes > 1) drawLaneBadge(g, lane, robotH * 0.3, gy - robotH * 1.25, robotH * 0.16, ROBOT_COLORS[team[lane]?.color] || C.Steel);
}

function drawRobotNumber(g, i, cx, cy, r, color) {
  circle(g, cx, cy, r, '#fff');
  ring(g, cx, cy, r, color, r * 0.25);
  const n = i + 1;
  for (let k = 0; k < n; k++) circle(g, cx + (k - (n - 1) / 2) * r * 0.55, cy, r * 0.18, color);
}

function drawLaneBadge(g, lane, cx, cy, r, color) {
  const n = lane + 1;
  const badge = img('ui/robot_badge');
  if (badge) {
    const br = r * 1.35;
    drawFit(g, badge, cx - br, cy - br * 1.1, cx + br, cy + br * 0.9, 'CENTER', mix(color, '#FFFFFF', 0.15));
    for (let k = 0; k < n; k++) {
      const px = cx + (k - (n - 1) / 2) * r * 0.6; const py = cy + br * 1.15;
      circle(g, px, py, r * 0.26, color); circle(g, px, py, r * 0.16, '#fff');
    }
    return;
  }
  rrect(g, cx - r, cy - r, r * 2, r * 2, r * 0.4, color);
  for (let k = 0; k < n; k++) circle(g, cx + (k - (n - 1) / 2) * r * 0.55, cy, r * 0.2, '#fff');
}

// ---- Talaj ---------------------------------------------------------------------------------

function drawGround(g, S, m, obstacles, v, th) {
  const holes = [];
  for (const o of obstacles) {
    if (isHole(o)) holes.push([m.startOf(o), m.endOf(o)]);
    else if (o.type === 'HEAVY_BOX' || o.type === 'BOULDER') holes.push([m.startOf(o) + o.width / 2, m.endOf(o)]);
  }
  holes.sort((a, b) => a[0] - b[0]);
  let cursor = -1;
  for (const [a, b] of holes) { groundSegment(g, S, cursor, a, v, th); cursor = b; }
  groundSegment(g, S, cursor, m.length + 1, v, th);
}

function groundSegment(g, S, a, b, v, th) {
  const left = Math.max(v.sx(a), -2); const right = Math.min(v.sx(b), S.w + 2);
  if (right <= left) return;
  const key = img(Paths.ground(th.world)) ? Paths.ground(th.world) : Paths.GROUND_TILE;
  const im = img(key);
  if (im) {
    const top = clamp(surface(key), 0, 0.4);
    const tileH = (S.h - v.gy) / (1 - top);
    drawTiled(g, im, left, v.gy - tileH * top, right, S.h, tileH, v.sx(0));
  } else {
    g.fillStyle = th.ground; g.fillRect(left, v.gy, right - left, S.h - v.gy);
    g.fillStyle = th.groundTop; g.fillRect(left, v.gy, right - left, S.h * 0.035);
  }
}

function holeTexture(g, S, im, s, e, top, v, alpha = 1) {
  if (!im) return false;
  drawTiled(g, im, s, top, e, S.h, S.h - top, v.sx(0), alpha);
  return true;
}

function drawFlags(g, m, v, fx) {
  const gy = v.gy; const rh = v.robotH; const pole = rh * 1.25;
  const sx = v.sx(0.035);
  const st = oimg('flag_start');
  if (st) drawFit(g, st, sx - rh * 0.15, gy - rh * 1.4, sx + rh * 0.7, gy + rh * 0.02);
  const gx = v.sx(m.length - 0.045);
  const top = gy - pole * 1.25;
  const goal = oimg('flag_goal');
  if (goal) drawFit(g, goal, gx - rh * 0.7, top, gx + rh * 0.2, gy + rh * 0.02);
  drawStar(g, gx, top - pole * 0.2, pole * 0.18 * (1 + 0.08 * Math.sin(fx * 0.004)), true);
}

// ---- Hátsó réteg ---------------------------------------------------------------------------

function drawPit(g, S, s, e, gy, th) {
  const gr = g.createLinearGradient(0, gy, 0, S.h);
  gr.addColorStop(0, rgba(th.pit, 0.55)); gr.addColorStop(1, th.pit);
  g.fillStyle = gr; g.fillRect(s, gy, e - s, S.h - gy);
  g.fillStyle = th.groundDark;
  g.fillRect(s, gy, S.h * 0.012, S.h - gy);
  g.fillRect(e - S.h * 0.012, gy, S.h * 0.012, S.h - gy);
}

function drawWater(g, S, s, e, gy, fx, alpha, wild = false, tex = null, v = null) {
  const top = gy + S.h * 0.03;
  if (tex && v) holeTexture(g, S, tex, s, e, top, v, alpha);
  else {
    const gr = g.createLinearGradient(0, top, 0, S.h);
    gr.addColorStop(0, rgba(C.WaterLight, alpha)); gr.addColorStop(1, rgba(C.WaterDeep, alpha));
    g.fillStyle = gr; g.fillRect(s, top, e - s, S.h - top);
  }
  const amp = wild ? 0.016 : 0.008;
  g.beginPath(); g.moveTo(s, top);
  const n = 24;
  for (let i = 1; i <= n; i++) g.lineTo(s + (e - s) * i / n, top + S.h * amp * Math.sin(fx * (wild ? 0.008 : 0.004) + i * 0.9));
  g.strokeStyle = `rgba(255,255,255,${0.8 * alpha})`; g.lineWidth = S.h * 0.008; g.lineCap = 'round'; g.stroke();
}

function drawObstacleBack(g, S, m, o, f, v, th, links, fx) {
  const s = v.sx(m.startOf(o)); const e = v.sx(m.endOf(o));
  if (e < -S.w * 0.3 || s > S.w * 1.3) return;
  const gy = v.gy; const rh = v.robotH;
  const p = f.obstacleProgress[o.id] || 0;
  if (drawObstacleBackImage(g, S, m, o, p, v, s, e, links)) return;
  switch (o.type) {
    case 'GAP': case 'VINE_CHASM': case 'SPACE_GAP': case 'CRANE_BRIDGE': {
      if (o.type === 'SPACE_GAP' && holeTexture(g, S, img(Paths.SPACE_TILE), s, e, gy, v)) return;
      drawPit(g, S, s, e, gy, th);
      if (o.type === 'SPACE_GAP' || th.isSpace) for (let k = 0; k < 8; k++) circle(g, s + (e - s) * ((k * 0.37) % 1), gy + (S.h - gy) * ((k * 0.61) % 1), rh * 0.02, 'rgba(255,255,255,0.7)');
      if (o.type === 'VINE_CHASM') { const b = oimg('vine_branch'); if (b) drawFit(g, b, s - rh * 0.3, gy - rh * 2.6, e + rh * 0.3, gy - rh * 0.4, 'TOP'); }
      if (o.type === 'CRANE_BRIDGE') { const post = oimg('crane_post'); if (post) drawFit(g, post, s - rh * 0.72, gy - rh * 1.9, s + rh * 0.43, gy + rh * 0.02, 'BOTTOM'); }
      break;
    }
    case 'WATER': case 'RAFT_RIVER': drawWater(g, S, s, e, gy, fx, 1, o.type === 'RAFT_RIVER', img(Paths.WATER_TILE), v); break;
    case 'QUICKSAND': {
      const top = gy + S.h * 0.03;
      holeTexture(g, S, img(Paths.QUICKSAND_TILE), s, e, top, v);
      break;
    }
    case 'LAVA': {
      const top = gy + S.h * 0.03;
      const cool = clamp(p / 0.5, 0, 1);
      if (cool < 1) holeTexture(g, S, img(Paths.LAVA_TILE), s, e, top, v);
      if (cool > 0) holeTexture(g, S, img(Paths.LAVA_COOLED_TILE), s, e, top, v, cool);
      break;
    }
    case 'HEAVY_BOX': case 'BOULDER': {
      const mid = v.sx(m.startOf(o) + o.width / 2); const side = e - mid;
      g.fillStyle = rgba(th.pit, 0.75); g.fillRect(mid, gy, side, side);
      g.fillStyle = th.ground; g.fillRect(mid, gy + side, side, S.h - gy - side);
      break;
    }
    case 'LINKED_GATE':
      g.fillStyle = C.Steel; g.fillRect(s - rh * 0.05, gy - rh * 1.55, e - s + rh * 0.1, rh * 0.1);
      circle(g, (s + e) / 2, gy - rh * 1.72, rh * 0.12, links[o.opensBy] || C.Steel);
      break;
    case 'DEEP_WATER': {
      const top = gy + S.h * 0.03;
      holeTexture(g, S, img(Paths.DEEP_WATER_TILE), s, e, top, v);
      drawWater(g, S, s, e, gy, fx, 0.25);
      break;
    }
    case 'FRAGILE_BRIDGE': {
      drawPit(g, S, s, e, gy, th);
      const wobble = f.robots.some((r) => r.obstacleId === o.id && r.phase === 'CROSSING' && r.capability === 'LIGHTWEIGHT');
      const br = oimg(({ 7: 'bridge_wafer', 9: 'bridge_crystal', 10: 'bridge_cloud' })[th.world] || 'bridge_glass');
      if (br) { const sag = wobble ? rh * 0.04 * (1 + Math.sin(fx * 0.02)) : 0; drawStretch(g, br, s, gy - rh * 0.1 + sag, e, gy + rh * 0.1 + sag); }
      break;
    }
    case 'WIND_CHASM': {
      drawPit(g, S, s, e, gy, th);
      for (let k = 0; k < 6; k++) {
        const q = (fx * 0.0009 + k / 6) % 1; const y = gy - rh * (0.3 + 0.35 * k);
        line(g, s + (e - s) * q, y, s + (e - s) * Math.min(1, q + 0.25), y - rh * 0.05, `rgba(255,255,255,${0.7 * (1 - q)})`, rh * 0.04, 'round');
      }
      break;
    }
    case 'CONVEYOR': {
      const top = gy - rh * 0.16;
      const belt = oimg('conveyor');
      if (belt) drawStretch(g, belt, s, top - rh * 0.04, e, gy + rh * 0.06);
      const step = rh * 0.45; const off = (fx * 0.06) % step;
      clipped(g, s, top, e, top + rh * 0.2, () => {
        let x = e + off;
        while (x > s - step) {
          g.beginPath(); g.moveTo(x, top + rh * 0.04); g.lineTo(x - rh * 0.12, top + rh * 0.1); g.lineTo(x, top + rh * 0.16);
          g.strokeStyle = '#FFC83D'; g.lineWidth = rh * 0.035; g.lineCap = 'butt'; g.stroke();
          x -= step;
        }
      });
      break;
    }
    case 'STICKY_GUM': { const gum = oimg('sticky_gum'); if (gum) drawStretch(g, gum, s, gy - rh * 0.35, e, gy + rh * 0.05); break; }
    case 'KEY': {
      if (p < 1) {
        const cx = (s + e) / 2; const cy = gy - rh * (0.5 + 0.05 * Math.sin(fx * 0.004));
        rrect(g, cx - rh * 0.12, gy - rh * 0.22, rh * 0.24, rh * 0.22, rh * 0.04, C.Steel);
        const k = oimg('key');
        if (k) drawFit(g, k, cx - rh * 0.25, cy - rh * 0.18, cx + rh * 0.25, cy + rh * 0.18, 'CENTER'); else drawKey(g, cx, cy, rh * 0.22);
      }
      break;
    }
    case 'DOUBLE_PLATE': case 'WINDMILL': {
      const postX = v.sx(m.startOf(o) - 0.055);
      if (o.type === 'DOUBLE_PLATE') {
        for (let k = 0; k < 2; k++) {
          const pressed = p >= (k + 1) * 0.5 - 0.01;
          const x = postX - k * 0.07 * v.unit;
          const plate = oimg(pressed ? 'plate_down' : 'plate_up');
          if (plate) drawFit(g, plate, x - rh * 0.4, gy - rh * 0.22, x + rh * 0.4, gy + rh * 0.03);
        }
      } else {
        const cx = postX + rh * 0.5; const cy = gy - rh * 1.25;
        const tower = oimg('windmill_tower');
        if (tower) {
          const thh = (gy - cy) / (1 - 0.424); const tw = thh * tower.naturalWidth / tower.naturalHeight;
          drawStretch(g, tower, cx - tw * 0.497, gy - thh, cx - tw * 0.497 + tw, gy + rh * 0.02);
        }
        const rot = fx * 0.4 * p;
        const blades = oimg('windmill_blades');
        if (blades) rotated(g, rot, cx, cy, () => drawFit(g, blades, cx - rh * 0.8, cy - rh * 0.8, cx + rh * 0.8, cy + rh * 0.8, 'CENTER'));
      }
      g.fillStyle = C.Steel; g.fillRect(s - rh * 0.05, gy - rh * 1.55, e - s + rh * 0.1, rh * 0.1);
      break;
    }
    case 'CRYSTAL_SPIKES': { const c = oimg('crystal_spikes'); if (c) drawStretch(g, c, s, gy - rh * 0.75, e, gy + rh * 0.03); break; }
    default: break;
  }
}

function drawObstacleBackImage(g, S, m, o, p, v, s, e, links) {
  const gy = v.gy; const rh = v.robotH;
  switch (o.type) {
    case 'STEEP_SLOPE': case 'LEDGE': case 'ICE_SLOPE': case 'METAL_TOWER': case 'TRAMPOLINE_CLIFF': case 'MAGNET_LIFT': {
      const name = { STEEP_SLOPE: 'hill', LEDGE: 'ledge', ICE_SLOPE: 'ice_hill', TRAMPOLINE_CLIFF: 'cliff' }[o.type] || 'metal_tower';
      const i = (o.type === 'LEDGE' ? oimg(`ledge_world_${m.world + 1}`) : null) || oimg(name);
      if (!i) return false;
      const peak = peakHeight(o.type) * rh;
      drawStretch(g, i, s, gy - peak, e, gy + rh * 0.03);
      if (o.type === 'MAGNET_LIFT') { g.fillStyle = C.Steel; g.fillRect(s - rh * 0.14, gy - peak, rh * 0.06, peak); }
      return true;
    }
    case 'HIGH_SWITCH': {
      const i = oimg(gateOpen(p) > 0 ? 'switch_on' : 'switch_off'); if (!i) return false;
      const poleX = s - rh * 0.4;
      drawFit(g, i, poleX - rh * 0.3, gy - rh * 2.0, poleX + rh * 0.3, gy + rh * 0.02);
      return true;
    }
    case 'DARK': { const i = oimg('cave'); if (!i) return false; drawStretch(g, i, s, gy - rh * 2.2, e, gy + rh * 0.03); return true; }
    case 'ROCK_WALL': {
      const name = p <= 0 ? 'rock_wall' : p < 0.5 ? 'rock_wall_cracked' : 'rock_wall_tunnel';
      const i = oimg(name) || oimg('rock_wall'); if (!i) return false;
      drawStretch(g, i, s - rh * 0.15, gy - rh * 1.75, e + rh * 0.15, gy + rh * 0.03);
      return true;
    }
    case 'PLATE_DOOR': case 'LEVER_GATE': {
      const postX = v.sx(m.startOf(o) - 0.055);
      if (o.type === 'PLATE_DOOR') {
        const i = oimg(p > 0 ? 'plate_down' : 'plate_up'); if (!i) return false;
        drawFit(g, i, postX - rh * 0.5, gy - rh * 0.25, postX + rh * 0.5, gy + rh * 0.03);
      } else if (!oimg(p >= 0.5 ? 'lever_down' : 'lever_up')) return false;
      g.fillStyle = C.Steel; g.fillRect(s - rh * 0.05, gy - rh * 1.55, e - s + rh * 0.1, rh * 0.1);
      return true;
    }
    case 'BUTTON': {
      const c = links[o.id] || C.Steel; const pressed = p >= 1; const cx = (s + e) / 2;
      if (o.required.size > 0) {
        const i = oimg(pressed ? 'switch_on' : 'switch_off'); if (!i) return false;
        drawFit(g, i, cx - rh * 0.3, gy - rh * 2.0, cx + rh * 0.3, gy + rh * 0.02);
        circle(g, cx, gy - rh * 2.12, rh * 0.09, c);
      } else {
        const i = oimg(pressed ? 'button_down' : 'button_up'); if (!i) return false;
        drawFit(g, i, s - rh * 0.12, gy - rh * 0.3, e + rh * 0.12, gy + rh * 0.03, 'BOTTOM', mix(c, '#FFFFFF', 0.35));
      }
      return true;
    }
    default: return false;
  }
}

// ---- Elülső réteg --------------------------------------------------------------------------

const CR = {
  IMG_W: 333, PULLEY_X: 288, PULLEY_Y: 80, PULLEY_L: 242, PULLEY_T: 37, PULLEY_R: 333, PULLEY_B: 127,
  HOOK_W: 56, HOOK_H: 114, HOOK_ROPE_X: 0.518, HOOK_GRIP_X: 0.49, HOOK_GRIP_Y: 0.92, HOOK_HOME_Y: 232, RAISED_DEG: 45, LOWER_END: 0.75,
};

function drawBraidedRope(g, ax, ay, bx, by, w) {
  const dx = bx - ax; const dy = by - ay; const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len; const uy = dy / len; const nx = -uy; const ny = ux;
  line(g, ax, ay, bx, by, '#46405A', w + 3, 'round');
  line(g, ax, ay, bx, by, '#DEC496', w, 'round');
  let d = w * 0.5;
  while (d < len - w * 0.3) {
    const x = ax + ux * d; const y = ay + uy * d;
    line(g, x + nx * w / 2 - ux * w * 0.4, y + ny * w / 2 - uy * w * 0.4, x - nx * w / 2 + ux * w * 0.4, y - ny * w / 2 + uy * w * 0.4, '#AA875A', Math.max(1.5, w * 0.18));
    d += w * 0.9;
  }
}

function drawObstacleFront(g, S, m, o, f, v, team, th, fx) {
  const s = v.sx(m.startOf(o)); const e = v.sx(m.endOf(o));
  if (e < -S.w * 0.3 || s > S.w * 1.3) return;
  const gy = v.gy; const rh = v.robotH;
  const p = f.obstacleProgress[o.id] || 0;
  const here = f.robots.filter((r) => r.obstacleId === o.id);
  switch (o.type) {
    case 'WATER': case 'RAFT_RIVER': {
      if (o.type === 'RAFT_RIVER' && p > 0) {
        const y = gy - rh * 0.04 + (1 - p) * rh * 0.4;
        const raft = oimg('raft');
        if (raft) drawStretch(g, raft, s - rh * 0.05, y - rh * 0.06, e + rh * 0.05, y + rh * 0.16);
      }
      if (here.some((r) => r.capability === 'SWIM' || (r.phase === 'HELPING' && o.type === 'RAFT_RIVER'))) drawWater(g, S, s, e, gy, fx, 0.55, o.type === 'RAFT_RIVER', img(Paths.WATER_TILE), v);
      break;
    }
    case 'HEAVY_BOX': case 'BOULDER': {
      const half = o.width / 2; const mid = v.sx(m.startOf(o) + half); const side = mid - s;
      if (o.type === 'BOULDER' && f.clearedWith[o.id] === 'DIG') {
        const crack = clamp(p / 0.5, 0, 1); const fill = clamp((p - 0.2) / 0.4, 0, 1);
        if (crack < 1) {
          const k = 1 - 0.45 * crack;
          const r = [s + side * (1 - k) / 2, gy - side * k, s + side * (1 + k) / 2, gy];
          const stone = oimg(crack > 0.15 ? 'boulder_cracked' : 'boulder');
          if (stone) drawFit(g, stone, ...r, 'BOTTOM', null, 1 - 0.6 * crack);
          for (let j = 0; j < 6; j++) {
            const q = (crack * 2 + j / 6) % 1;
            circle(g, s + side * (0.5 + 0.9 * q), gy - side * (0.6 - 0.9 * q * q), side * (0.05 + 0.02 * (j % 3)), '#9C8B7C');
          }
        }
        if (fill > 0) clipped(g, mid, gy - side, mid + side, gy + side, () => {
          const top = gy - side * 0.08 + (1 - fill) * side * 0.85;
          const rubble = oimg('rubble');
          if (rubble) drawStretch(g, rubble, mid, top, mid + side, top + side * 0.6);
        });
        break;
      }
      const clearance = PARAMS.robotHalfWidth + PARAMS.edgeMargin;
      const approach = m.startOf(o) - clearance; const exit = m.endOf(o) + clearance;
      const pushed = p >= 1 ? half + 1 : p * (exit - approach);
      const dx = clamp(pushed, 0, half);
      const drop = clamp((pushed - half) / 0.03, 0, 1);
      const left = v.sx(m.startOf(o) + dx);
      const top = gy - side + drop * side;
      const im = oimg(o.type === 'HEAVY_BOX' ? 'box' : 'boulder');
      if (im) { if (o.type === 'HEAVY_BOX') drawStretch(g, im, left, top, left + side, top + side); else drawFit(g, im, left, top, left + side, top + side); }
      break;
    }
    case 'HIGH_SWITCH': case 'PLATE_DOOR': case 'LEVER_GATE': case 'LINKED_GATE': {
      const open = o.type === 'HIGH_SWITCH' ? gateOpen(p) : p;
      const gateH = rh * 1.35; const lift = gateH * open;
      if (o.type === 'LEVER_GATE') {
        const postX = v.sx(m.startOf(o) - 0.055);
        const lv = oimg(p >= 0.5 ? 'lever_down' : 'lever_up');
        if (lv) drawFit(g, lv, postX + rh * 0.08, gy - rh * 0.55, postX + rh * 0.5, gy + rh * 0.03);
      }
      const gate = oimg(o.type === 'PLATE_DOOR' ? 'door' : 'gate') || oimg('gate');
      if (gate) drawStretch(g, gate, s - rh * 0.04, gy - gateH - rh * 0.1 - lift, e + rh * 0.04, gy - lift);
      break;
    }
    case 'DARK': {
      const inCave = (r, i) => r.x >= m.startOf(o) - 0.02 && r.x <= m.endOf(o) + 0.02 && r.lane === o.lane && team[i]?.arm === P.LAMP_ARM;
      const lit = f.robots.some(inCave);
      const mask = oimg('cave_dark');
      if (mask) drawStretch(g, mask, s, gy - rh * 2.2, e, gy + rh * 0.03, null, lit ? 0.35 : 0.75);
      if (lit) f.robots.forEach((rr, i) => {
        if (!inCave(rr, i)) return;
        const cx = v.sx(rr.x) + rh * 0.3; const cy = gy - rr.lift * rh - rh * 0.45;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rh * 1.3);
        gr.addColorStop(0, rgba(C.Sunny, 0.55)); gr.addColorStop(1, 'rgba(255,200,61,0)');
        circle(g, cx, cy, rh * 1.3, gr);
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + rh * 1.6, cy - rh * 0.5); g.lineTo(cx + rh * 1.6, cy + rh * 0.5); g.closePath();
        g.fillStyle = rgba(C.Sunny, 0.22); g.fill();
      });
      break;
    }
    case 'ICE_BLOCK': {
      const melt = clamp(p / 0.5, 0, 1); const hgt = rh * 1.5 * (1 - melt);
      const block = oimg(melt > 0 ? 'ice_block_melting' : 'ice_block') || oimg('ice_block');
      if (block && hgt > 1) drawStretch(g, block, s - rh * 0.03, gy - hgt, e + rh * 0.03, gy + rh * 0.02);
      if (melt > 0) { const pd = oimg('ice_puddle'); if (pd) drawFit(g, pd, s - rh * 0.35, gy - rh * 0.14, e + rh * 0.35, gy + rh * 0.05, 'BOTTOM', null, melt); }
      break;
    }
    case 'THORNS': {
      const cut = clamp(p / 0.45, 0, 1);
      const bush = oimg(cut >= 1 ? 'thorns_cut' : cut > 0 ? 'thorns_half' : 'thorns');
      if (bush) {
        drawFit(g, bush, s - rh * 0.12, gy - rh * (cut >= 1 ? 0.35 : 0.95), e + rh * 0.12, gy + rh * 0.04);
        if (cut > 0 && cut < 1) for (let k = 0; k < 4; k++) circle(g, (s + e) / 2 + rh * (0.3 * k - 0.4), gy - rh * 0.6 - rh * 0.2 * k * cut, rh * 0.04, '#6BAA42');
      }
      break;
    }
    case 'CRANE_BRIDGE': {
      const post = oimg('crane_post'); const hook = oimg('crane_hook'); const pulley = oimg('crane_pulley');
      const rigged = post && hook && pulley;
      const lower = rigged ? clamp(p / CR.LOWER_END, 0, 1) : p;
      const angle = -(rigged ? CR.RAISED_DEG : 80) * (1 - lower);
      const plank = oimg('bridge_plank');
      rotated(g, angle, s, gy, () => { if (plank) drawStretch(g, plank, s, gy - rh * 0.14, e, gy + rh * 0.02); });
      const ta = angle * Math.PI / 180;
      if (rigged) {
        const [cx, cy, cr] = fitRect(post, s - rh * 0.72, gy - rh * 1.9, s + rh * 0.43, gy + rh * 0.02, 'BOTTOM');
        const k = (cr - cx) / CR.IMG_W;
        const pcx = cx + CR.PULLEY_X * k; const pcy = cy + CR.PULLEY_Y * k;
        const hw = CR.HOOK_W * k; const hh = CR.HOOK_H * k;
        const ex = (e - s) - rh * 0.08; const ey = -rh * 0.12;
        const ca = Math.cos(ta); const sa = Math.sin(ta);
        const heldX = s + ex * ca - ey * sa + (CR.HOOK_ROPE_X - CR.HOOK_GRIP_X) * hw;
        const heldY = gy + ex * sa + ey * ca - CR.HOOK_GRIP_Y * hh;
        const homeX = pcx; const homeY = cy + CR.HOOK_HOME_Y * k;
        const release = p <= CR.LOWER_END ? 0 : clamp((p - CR.LOWER_END) / (1 - CR.LOWER_END), 0, 1);
        const q = release * release * (3 - 2 * release);
        const tx = heldX + (homeX - heldX) * q; const ty = heldY + (homeY - heldY) * q;
        drawBraidedRope(g, pcx, pcy, tx, ty, rh * 0.06);
        drawStretch(g, hook, tx - CR.HOOK_ROPE_X * hw, ty, tx + (1 - CR.HOOK_ROPE_X) * hw, ty + hh);
        drawStretch(g, pulley, cx + CR.PULLEY_L * k, cy + CR.PULLEY_T * k, cx + CR.PULLEY_R * k, cy + CR.PULLEY_B * k);
      }
      break;
    }
    case 'MAGNET_LIFT': {
      const rider = here.find((r) => r.phase === 'CROSSING');
      const lift = rider && rider.x <= m.startOf(o) ? rider.lift : 0;
      const px = v.sx(m.startOf(o) - 0.055);
      const plat = oimg('lift_platform');
      if (plat) drawStretch(g, plat, px - rh * 0.45, gy - lift * rh - rh * 0.07, px + rh * 0.45, gy - lift * rh + rh * 0.06);
      break;
    }
    case 'DEEP_WATER': {
      if (here.some((r) => r.capability === 'DIVE')) {
        const top = gy + S.h * 0.03;
        g.fillStyle = 'rgba(47,111,214,0.45)'; g.fillRect(s, top, e - s, S.h - top);
        for (let k = 0; k < 6; k++) {
          const q = (fx * 0.0012 + k / 6) % 1;
          ring(g, s + (e - s) * ((k * 0.37) % 1), S.h - (S.h - top) * q, rh * 0.03, `rgba(255,255,255,${0.7 * (1 - q)})`, rh * 0.01);
        }
      }
      break;
    }
    case 'SEAWEED': case 'CHOCOLATE_WALL': case 'PUDDING': case 'GEAR_GATE': case 'CRYSTAL_WALL': case 'CLOUD_WALL':
    case 'CLAM': case 'TRAFFIC_GATE': case 'LOCKED_DOOR':
      drawClearable(g, o, p, s, e, gy, rh);
      break;
    case 'DOUBLE_PLATE': case 'WINDMILL': {
      const open = o.type === 'DOUBLE_PLATE' ? clamp((p - 0.5) * 2, 0, 1) : p;
      const gateH = rh * 1.35; const lift = gateH * open;
      const gate = oimg('gate');
      if (gate) drawStretch(g, gate, s - rh * 0.04, gy - gateH - rh * 0.1 - lift, e + rh * 0.04, gy - lift);
      break;
    }
    default: break;
  }
}

const TRAFFIC = { POST_X: 0.78, POST_Y: 0.326, ARM_X: 0.074, ARM_Y: 0.48 };

function drawClearable(g, o, p, s, e, gy, rh) {
  const k = clamp(p / 0.5, 0, 1);
  const name = o.type.toLowerCase();
  if (o.type === 'GEAR_GATE') {
    const gear = oimg('gear_gate');
    if (gear) {
      const lift = rh * 1.5 * k; const cx = (s + e) / 2; const cy = gy - rh * 0.72 - lift; const half = rh * 0.74;
      rotated(g, k * 360, cx, cy, () => drawFit(g, gear, cx - half, cy - half, cx + half, cy + half, 'CENTER'));
      return;
    }
  }
  if (o.type === 'TRAFFIC_GATE') {
    const post = oimg('traffic_gate_post'); const armI = oimg('traffic_gate_arm');
    if (post && armI) {
      const ph = rh * 1.15; const pw = ph * post.naturalWidth / post.naturalHeight;
      const left = s - pw * 0.85; const top = gy - ph;
      drawStretch(g, post, left, top, left + pw, gy + rh * 0.02);
      const px = left + pw * TRAFFIC.POST_X; const py = top + ph * TRAFFIC.POST_Y;
      const len = (e - px) + rh * 0.35;
      const aw = len / (1 - TRAFFIC.ARM_X); const ah = aw * armI.naturalHeight / armI.naturalWidth;
      rotated(g, -82 * k, px, py, () => drawStretch(g, armI, px - aw * TRAFFIC.ARM_X, py - ah * TRAFFIC.ARM_Y, px - aw * TRAFFIC.ARM_X + aw, py - ah * TRAFFIC.ARM_Y + ah));
      return;
    }
  }
  const before = oimg(name);
  if (!before) return;
  const after = oimg(name + '_after');
  const r = [s - rh * 0.1, gy - rh * (Math.max(peakHeight(o.type), 0.6) + 0.05), e + rh * 0.1, gy + rh * 0.02];
  const footed = (im, path) => {
    const scale = Math.min((r[2] - r[0]) / im.naturalWidth, (r[3] - r[1]) / im.naturalHeight);
    const dy = o.type === 'LOCKED_DOOR' ? footGap(path) * im.naturalHeight * scale : 0;
    return [r[0], r[1] + dy, r[2], r[3] + dy];
  };
  if (k < 1) drawFit(g, before, ...footed(before, Paths.obstacle(name)), 'BOTTOM', null, 1 - 0.5 * k);
  if (k > 0 && after) drawFit(g, after, ...footed(after, Paths.obstacle(name + '_after')), 'BOTTOM', null, k);
}

function drawKey(g, cx, cy, size) {
  const gold = '#FFC83D'; const dark = '#B7791F';
  ring(g, cx - size * 0.3, cy, size * 0.28, gold, size * 0.13);
  line(g, cx - size * 0.05, cy, cx + size * 0.5, cy, gold, size * 0.13, 'round');
  line(g, cx + size * 0.3, cy, cx + size * 0.3, cy + size * 0.2, gold, size * 0.12);
  line(g, cx + size * 0.45, cy, cx + size * 0.45, cy + size * 0.15, gold, size * 0.12);
  ring(g, cx - size * 0.3, cy, size * 0.28, dark, size * 0.03);
}

function drawRope(g, m, r, v, rx, ry, robotH) {
  const o = m.obstacles.find((x) => x.id === r.obstacleId);
  if (!o) return;
  line(g, v.sx(m.centerOf(o)), v.gy - v.robotH * 2.3, rx + robotH * 0.25, ry - robotH * 0.75, '#8A6A3A', robotH * 0.04, 'round');
}

// ---- Testtartás ----------------------------------------------------------------------------

const TOOL_CAPS = ['DIG', 'HEAT', 'COOL', 'CUT', 'BUBBLE', 'SCOOP', 'TURN', 'RESONATE', 'BLOW', 'REMOTE', 'GRAB_LIGHT'];

function poseFor(robot, r, m, f, fx, success) {
  const p = r.p;
  const cap = r.phase === 'CROSSING' ? r.capability : null;
  const moving = r.phase === 'MOVING' || (r.phase === 'CROSSING' && r.assisted);
  const helping = r.phase === 'HELPING';
  const post = helping ? m.obstacles.find((o) => o.id === r.obstacleId)?.type : null;
  const happy = success && (r.phase === 'DONE' || f.robots.length === 1 || r.phase === 'HELPING');
  let spring = 0;
  if (robot.mobility === P.SPRING) {
    if (cap === 'JUMP') {
      if (p < 0.15) spring = -(p / 0.15);
      else if (p < 0.3) spring = -1 + 2 * ((p - 0.15) / 0.15);
      else if (p < 0.85) spring = 1 - 0.8 * ((p - 0.3) / 0.55);
      else spring = -0.8 * Math.sin(((p - 0.85) / 0.15) * Math.PI);
    } else if (post === 'TRAMPOLINE_CLIFF') spring = -0.6 + 0.6 * Math.sin(fx * 0.01);
    else if (moving) spring = 0.15 * Math.sin(r.x * 90);
    else if (happy) spring = 0.3 * Math.sin(fx * 0.012);
  }
  let tilt = 0;
  if (r.phase === 'PAUSE') tilt = 6 * p;
  else if (r.phase === 'WAITING') tilt = 3 + 2 * Math.sin(fx * 0.004);
  else if (r.phase === 'BLOCKED') tilt = 6 + 8 * Math.sin(p * Math.PI * 3);
  else if (r.phase === 'STUCK') tilt = success ? 0 : 10;
  let armUp = 0;
  if (cap === 'REACH') armUp = p < 0.25 ? p / 0.25 : p < 0.5 ? 1 : p < 0.7 ? 1 - (p - 0.5) / 0.2 : 0;
  else if (post === 'CRANE_BRIDGE' || post === 'MAGNET_LIFT') armUp = Math.min(1, p * 2);
  else if (cap === 'SWING') armUp = 1;
  else if (cap === 'MAGNET') armUp = 0.6;
  const acting = TOOL_CAPS.includes(cap) && p < 0.55;
  const armReach = (cap === 'PUSH' || post === 'LEVER_GATE') ? 0.75 : acting ? 0.7 : 0;
  const flying = cap === 'FLY';
  const jet = robot.mobility === P.ROCKET && (cap === 'JET' || r.lift > 0.05);
  const t = success ? fx : f.elapsedMs;
  return mkPose({
    wheelAngleDeg: r.x * 2400, springStretch: spring, propellerPhase: t * (flying ? 0.045 : 0.025), headTiltDeg: tilt,
    hover: robot.mobility === P.PROPELLER && !flying ? 5 + 2 * Math.sin(t * 0.006) : 0,
    happy, armsUp: happy, armReach, armUp, lampOn: robot.arm === P.LAMP_ARM,
    toolOn: acting || cap === 'MAGNET' || post === 'MAGNET_LIFT', toolPhase: t * 0.002, flame: jet,
  });
}
