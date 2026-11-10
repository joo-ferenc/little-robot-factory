// Robot kirajzolása (RobotRenderer átirata). Robot-egység (u): origó a robot ALJÁNAK közepe, y lefelé nő.
import { img, accent, armAnchor, socketX, Paths, C, ROBOT_COLORS, mix, rgba, drawStretch, drawFit, circle, ring, line, arc, oval, rotated, scaled, clipped } from './art.js';
import { resolveForSlot, P } from './engine.js';

export const G = {
  HEIGHT_UNITS: 140, WIDTH_UNITS: 92, ASPECT: 92 / 140, MOBILITY_HEIGHT: 30, BODY_HALF_WIDTH: 30, BODY_HEIGHT: 50,
  PNG_MOBILITY_MAX_W: 80, PNG_MOBILITY_MAX_H: 34, PNG_SPRING_W: 34, PNG_SPRING_H: 36, PNG_SOCKET_DEPTH: 0.12,
  PNG_BODY_W: 60, PNG_SHOULDER_X: 27, PNG_SHOULDER_Y: 17, PNG_ARM_H: 38, PNG_HEAD_W: 62, PNG_HEAD_SINK: 3,
  PNG_FACE_CENTER: 0.68, PNG_FACE_SCALE: 0.85,
};

export const pose = (o = {}) => ({
  wheelAngleDeg: 0, springStretch: 0, propellerPhase: 0, headTiltDeg: 0, hover: 0, happy: false, armsUp: false,
  armReach: 0, armUp: 0, lampOn: false, facing: 1, toolOn: false, toolPhase: 0, flame: false, ...o,
});

class Space {
  constructor(ox, oy, u) { this.ox = ox; this.oy = oy; this.u = u; }
  px(x) { return this.ox + x * this.u; }
  py(y) { return this.oy + y * this.u; }
  len(v) { return v * this.u; }
}

/** A robot: [gx, gy] a talpa közepe, [heightPx] a teljes magasság. */
export function drawRobot(g, cfg, ps, gx, gy, heightPx, liftPx = 0, drawShadow = true) {
  const u = heightPx / G.HEIGHT_UNITS;
  if (drawShadow && liftPx <= 0.5 && ps.hover <= 0.5) {
    const shrink = 1 / (1 + liftPx / heightPx);
    const w = 72 * u * shrink;
    oval(g, gx - w / 2, gy - 5 * u, w, 10 * u, `rgba(0,0,0,${0.16 * shrink})`);
  }
  scaled(g, ps.facing < 0 ? -1 : 1, 1, gx, gy, () => facingRight(g, cfg, ps, gx, gy - liftPx, u));
}

function facingRight(g, cfg, ps, bx, by, u) {
  const sp = new Space(bx, by - ps.hover * u, u);
  const mobility = resolveForSlot(cfg.mobility, 'MOBILITY').id;
  const arm = resolveForSlot(cfg.arm, 'ARM').id;
  const mH = mobility === P.SPRING ? G.MOBILITY_HEIGHT * (1 + 0.4 * Math.max(-1, Math.min(1, ps.springStretch))) : G.MOBILITY_HEIGHT;
  const bodyColor = ROBOT_COLORS[cfg.color] || ROBOT_COLORS.BLUE;

  const mobilityTop = drawMobility(g, sp, mobility, mH, ps);
  const bodyBottom = img(Paths.mobility(mobility)) ? mobilityTop * (1 - G.PNG_SOCKET_DEPTH) : -mH + 2;
  const bodyTop = bodyBottom - G.BODY_HEIGHT;
  const armTop = bodyTop + 6;

  const leftArm = () => scaled(g, -1, 1, sp.ox, sp.oy, () => drawArm(g, sp, arm, armTop, { ...ps, armReach: 0, armUp: 0, lampOn: false }, bodyColor, bodyTop));

  const bodyImg = img(Paths.BODY);
  if (bodyImg) {
    const half = G.PNG_BODY_W / 2;
    const r = [sp.px(-half), sp.py(bodyTop - 10), sp.px(half), sp.py(bodyBottom)];
    drawFit(g, bodyImg, ...r, 'BOTTOM', bodyColor);
    const acc = accent(Paths.BODY);
    if (acc) drawFit(g, acc, ...r, 'BOTTOM');
  }
  leftArm();
  drawArm(g, sp, arm, armTop, ps, bodyColor, bodyTop);

  const headBottom = bodyTop + G.PNG_HEAD_SINK;
  rotated(g, ps.headTiltDeg, sp.px(0), sp.py(headBottom), () => drawHead(g, sp, cfg.head, headBottom, ps, bodyColor));
}

// ---- Mozgási modul -------------------------------------------------------------------------

function drawMobility(g, sp, m, mH, ps) {
  const anim = drawAnimatedMobility(g, sp, m, ps);
  if (anim != null) return anim;
  const im = img(Paths.mobility(m));
  if (!im) return -mH;
  let w; let h;
  if (m === P.SPRING) { w = G.PNG_SPRING_W; h = G.PNG_SPRING_H * (mH / G.MOBILITY_HEIGHT); } else {
    const ar = im.naturalWidth / im.naturalHeight;
    w = G.PNG_MOBILITY_MAX_W; h = w / ar;
    if (h > G.PNG_MOBILITY_MAX_H) { h = G.PNG_MOBILITY_MAX_H; w = h * ar; }
  }
  if (m === P.ROCKET && ps.flame) drawRocketFlame(g, sp, ps.propellerPhase);
  const left = -socketX(Paths.mobility(m)) * w;
  drawStretch(g, im, sp.px(left), sp.py(-h), sp.px(left + w), sp.py(0));
  return -h;
}

function drawRocketFlame(g, sp, phase) {
  const f = 1 + 0.25 * Math.sin(phase * 6);
  const tri = (hw, len, col) => {
    g.beginPath(); g.moveTo(sp.px(-hw), sp.py(-6)); g.lineTo(sp.px(0), sp.py(-6 + len * f)); g.lineTo(sp.px(hw), sp.py(-6)); g.closePath();
    g.fillStyle = col; g.fill();
  };
  tri(12, 26, '#FF9A2E'); tri(6, 15, '#FFE38A');
}

const RIG = {
  WHEEL_HUBS: [[0.1804, 0.3903], [0.8077, 0.389]], WHEEL_R: 0.138, SPIKE_DISC: 0.84,
  ROLLERS_X: [0.1936, 0.4947, 0.7956], ROLLER_Y: 0.413, ROLLER_R: 0.088,
  BELT_CY: 0.42, BELT_X1: 0.173, BELT_X2: 0.827, BELT_R: 0.146, LUG_LEN: 0.075, LUG_THICK: 0.04, LUG_COUNT: 24, BELT_CLIP_Y: 0.335,
  BOLTS: [[0.0707, 0.3016, true, -1], [0.9203, 0.3005, true, 1], [0.2225, 0.3729, false, -1], [0.769, 0.3734, false, 1]],
  LEG_W: 0.288, HIP_X: 0.214, HIP_Y: 0.146, BACK_SCALE: 1.05, LEG_LIFT_DEG: 18, MAX_W: 80, MAX_H: 34, SPIDER_MAX_H: 40,
};

function fitRig(sp, bodyPath, minX, maxX, maxY, maxH) {
  const s = Math.min(RIG.MAX_W / (maxX - minX), maxH / maxY);
  const left = -socketX(bodyPath) * s;
  const top = -maxY * s;
  return {
    top, s,
    x: (x) => sp.px(left + x * s),
    y: (y) => sp.py(top + y * s),
  };
}

function drawAnimatedMobility(g, sp, m, ps) {
  const bodyPath = (m === P.WHEELS || m === P.SPIKES) ? 'robots/mobility_wheels_body' : m === P.TRACKS ? 'robots/mobility_tracks_body' : m === P.SPIDER ? 'robots/mobility_spider_body' : null;
  if (!bodyPath) return null;
  const body = img(bodyPath);
  if (!body) return null;
  const bodyH = body.naturalHeight / body.naturalWidth;
  const angle = ps.wheelAngleDeg;
  if (m === P.WHEELS || m === P.SPIKES) {
    const wheel = img(m === P.SPIKES ? 'robots/wheel_spikes' : 'robots/wheel');
    if (!wheel) return null;
    const f = fitRig(sp, bodyPath, 0, 1, bodyH, RIG.MAX_H);
    drawStretch(g, body, f.x(0), f.y(0), f.x(1), f.y(bodyH));
    const r = RIG.WHEEL_R / (m === P.SPIKES ? RIG.SPIKE_DISC : 1);
    for (const [hx, hy] of RIG.WHEEL_HUBS) {
      rotated(g, angle, f.x(hx), f.y(hy), () => drawStretch(g, wheel, f.x(hx - r), f.y(hy - r), f.x(hx + r), f.y(hy + r)));
    }
    return f.top;
  }
  if (m === P.TRACKS) {
    const roller = img('robots/track_roller'); const lug = img('robots/track_lug');
    if (!roller || !lug) return null;
    const f = fitRig(sp, bodyPath, 0, 1, bodyH, RIG.MAX_H);
    drawStretch(g, body, f.x(0), f.y(0), f.x(1), f.y(bodyH));
    const rr = RIG.ROLLER_R;
    for (const x of RIG.ROLLERS_X) {
      rotated(g, angle, f.x(x), f.y(RIG.ROLLER_Y), () => drawStretch(g, roller, f.x(x - rr), f.y(RIG.ROLLER_Y - rr), f.x(x + rr), f.y(RIG.ROLLER_Y + rr)));
    }
    const x1 = RIG.BELT_X1; const x2 = RIG.BELT_X2; const br = RIG.BELT_R; const cy = RIG.BELT_CY;
    const straight = x2 - x1; const arcL = Math.PI * br; const per = 2 * straight + 2 * arcL;
    const shift = angle * Math.PI / 180 * rr;
    const hl = RIG.LUG_LEN / 2; const ht = RIG.LUG_THICK / 2;
    g.save(); g.beginPath(); g.rect(-1e5, f.y(RIG.BELT_CLIP_Y), 2e5, 2e5); g.clip();
    for (let k = 0; k < RIG.LUG_COUNT; k++) {
      const s = (((k * per / RIG.LUG_COUNT + shift) % per) + per) % per;
      let x; let y; let t;
      if (s < straight) { x = x1 + s; y = cy - br; t = 0; } else if (s < straight + arcL) { const a = (s - straight) / br; x = x2 + br * Math.sin(a); y = cy - br * Math.cos(a); t = a * 180 / Math.PI; } else if (s < 2 * straight + arcL) { x = x2 - (s - straight - arcL); y = cy + br; t = 180; } else { const a = (s - 2 * straight - arcL) / br; x = x1 - br * Math.sin(a); y = cy + br * Math.cos(a); t = 180 + a * 180 / Math.PI; }
      rotated(g, t, f.x(x), f.y(y), () => drawStretch(g, lug, f.x(x - hl), f.y(y - ht), f.x(x + hl), f.y(y + ht)));
    }
    g.restore();
    return f.top;
  }
  // pók
  const leg = img('robots/spider_leg');
  if (!leg) return null;
  const lw = RIG.LEG_W; const lh = lw * leg.naturalHeight / leg.naturalWidth;
  const hx = RIG.HIP_X; const hy = RIG.HIP_Y;
  let minX = 0; let maxX = 1; let maxY = bodyH;
  for (const [bx, by, back, side] of RIG.BOLTS) {
    const sc = back ? RIG.BACK_SCALE : 1;
    const reach = (1 - hx) * lw * sc;
    if (side > 0) maxX = Math.max(maxX, bx + reach); else minX = Math.min(minX, bx - reach);
    if (!back) maxY = Math.max(maxY, by + (1 - hy) * lh);
  }
  const f = fitRig(sp, bodyPath, minX, maxX, maxY, RIG.SPIDER_MAX_H);
  const phase = angle * Math.PI / 180 * 0.5;
  const drawLeg = ([bx, by, back, side]) => {
    const sc = back ? RIG.BACK_SCALE : 1;
    const offset = (side > 0) === !back ? 0 : Math.PI;
    const lift = -RIG.LEG_LIFT_DEG * Math.max(0, Math.sin(phase + offset));
    const hipX = f.x(bx); const hipY = f.y(by);
    const w = lw * sc; const h = lh * sc;
    scaled(g, side, 1, hipX, hipY, () => rotated(g, lift, hipX, hipY, () => drawStretch(g, leg, f.x(bx - hx * w), f.y(by - hy * h), f.x(bx + (1 - hx) * w), f.y(by + (1 - hy) * h))));
  };
  RIG.BOLTS.filter((b) => b[2]).forEach(drawLeg);
  drawStretch(g, body, f.x(0), f.y(0), f.x(1), f.y(bodyH));
  RIG.BOLTS.filter((b) => !b[2]).forEach(drawLeg);
  return f.top;
}

// ---- Kar -----------------------------------------------------------------------------------

function drawArm(g, sp, arm, armTop, ps, bodyColor, bodyTop) {
  const path = Paths.arm(arm);
  const im = img(path);
  if (!im) return;
  const shX = sp.px(G.PNG_SHOULDER_X); const shY = sp.py(bodyTop + G.PNG_SHOULDER_Y);
  const angle = ps.armsUp ? -150 : ps.armUp > 0 ? -165 * ps.armUp : ps.armReach > 0 ? -80 * ps.armReach : 0;
  rotated(g, angle, shX, shY, () => {
    const anchor = armAnchor(path) || { x: 0.5, y: 0.1 };
    const stretch = arm === P.EXTEND_ARM ? 1 + 0.8 * Math.max(ps.armReach, ps.armUp) : 1;
    const h = G.PNG_ARM_H * stretch;
    const w = G.PNG_ARM_H * im.naturalWidth / im.naturalHeight;
    const left = shX - anchor.x * sp.len(w);
    const top = shY - anchor.y * sp.len(G.PNG_ARM_H);
    drawStretch(g, im, left, top, left + sp.len(w), top + sp.len(h));
    drawToolEffects(g, arm, shX, top + sp.len(h) - sp.len(4), sp.u, ps);
  });
}

function drawToolEffects(g, arm, cx, cy, u, ps) {
  const l = (v) => v * u;
  switch (arm) {
    case P.LAMP_ARM: if (ps.lampOn) circle(g, cx, cy, l(16), rgba(C.Sunny, 0.35)); break;
    case P.HEATER: if (ps.toolOn) for (let k = 0; k < 3; k++) {
      const r = l(10 + ((ps.toolPhase * 2 + k / 3) % 1) * 16);
      arc(g, cx - r, cy - r + l(6), r * 2, r * 2, 30, 120, false, 'rgba(255,122,61,0.6)', l(2.5), 'round');
    } break;
    case P.WATER_CANNON: if (ps.toolOn) for (let k = 0; k < 6; k++) {
      const q = (ps.toolPhase * 3 + k / 6) % 1;
      circle(g, cx + l(Math.sin(k * 1.7) * 3), cy + l(10 + q * 40), l(3 + q * 3), `rgba(124,196,255,${0.85 - q * 0.5})`);
    } break;
    case P.MAGNET: if (ps.toolOn) for (let k = 0; k < 2; k++) {
      arc(g, cx - l(16 + k * 4), cy - l(14 + k * 4), l(32 + k * 8), l(32 + k * 8), 200 + k * 40, 60, false, 'rgba(255,200,61,0.7)', l(2));
    } break;
    case P.AIR_PUMP: if (ps.toolOn) for (let k = 0; k < 6; k++) {
      const q = (ps.toolPhase * 2 + k / 6) % 1;
      ring(g, cx + l(Math.sin(k * 2.1) * 6), cy + l(14 + q * 36), l(2.5 + q * 3), `rgba(255,255,255,${0.85 - q * 0.6})`, l(1.2));
    } break;
    case P.TUNING_FORK: case P.REMOTE: if (ps.toolOn) for (let k = 0; k < 3; k++) {
      const r = l(10 + ((ps.toolPhase * 2 + k / 3) % 1) * 22);
      arc(g, cx - r, cy - r + l(14), r * 2, r * 2, 50, 80, false, arm === P.REMOTE ? 'rgba(76,195,138,0.7)' : 'rgba(185,140,255,0.7)', l(2), 'round');
    } break;
    case P.FAN: if (ps.toolOn) for (let k = 0; k < 4; k++) {
      const q = (ps.toolPhase * 3 + k / 4) % 1;
      const x = cx + l((k - 1.5) * 5);
      line(g, x, cy + l(18 + q * 30), x, cy + l(26 + q * 30), `rgba(255,255,255,${0.8 - q * 0.6})`, l(1.6), 'round');
    } break;
    case P.DRILL: case P.SAW: if (ps.toolOn) for (let k = 0; k < 4; k++) {
      const q = (ps.toolPhase * 4 + k / 4) % 1;
      circle(g, cx + l((k - 1.5) * 6 * q), cy + l(8 + q * 10), l(2 + q * 2), `rgba(217,203,184,${1 - q})`);
    } break;
    default: break;
  }
}

// ---- Fej -----------------------------------------------------------------------------------

function drawHead(g, sp, style, headBottom, ps, bodyColor) {
  const path = Paths.head(style);
  const im = img(path);
  if (!im) return;
  const w = G.PNG_HEAD_W; const h = w * im.naturalHeight / im.naturalWidth;
  const r = [sp.px(-w / 2), sp.py(headBottom - h), sp.px(w / 2), sp.py(headBottom)];
  drawStretch(g, im, ...r, mix(bodyColor, '#FFFFFF', 0.18));
  const acc = accent(path);
  if (acc) drawStretch(g, acc, ...r);
  const cy = headBottom - h * (1 - G.PNG_FACE_CENTER);
  const s = G.PNG_FACE_SCALE;
  scaled(g, s, s, sp.px(1), sp.py(cy), () => drawFace(g, sp, cy - 24, ps));
}

function drawFace(g, sp, faceTop, ps) {
  const eyeY = faceTop + 20;
  for (const ex of [-10, 12]) {
    const cx = sp.px(ex); const cy = sp.py(eyeY);
    if (ps.happy) arc(g, cx - sp.len(7), cy - sp.len(5), sp.len(14), sp.len(12), 180, 180, false, C.Ink, sp.len(3.5), 'round');
    else {
      circle(g, cx, cy, sp.len(9.5), '#fff');
      circle(g, cx + sp.len(2), cy + sp.len(0.5), sp.len(4.8), C.Ink);
      circle(g, cx + sp.len(3.5), cy - sp.len(1.5), sp.len(1.6), '#fff');
    }
  }
  circle(g, sp.px(-19), sp.py(faceTop + 32), sp.len(4), 'rgba(255,143,163,0.45)');
  circle(g, sp.px(19), sp.py(faceTop + 32), sp.len(4), 'rgba(255,143,163,0.45)');
  const mw = ps.happy ? 22 : 16;
  const x = sp.px(-mw / 2 + 1); const y = sp.py(faceTop + 27);
  if (ps.happy) arc(g, x, y, sp.len(mw), sp.len(14), 0, 180, true, C.Ink);
  else arc(g, x, y, sp.len(mw), sp.len(10), 0, 180, false, C.Ink, sp.len(3), 'round');
}

// ---- Bélyegképek (műhely) ------------------------------------------------------------------

/** Csak a mozgási modul a [w]×[h] vászon közepén. */
export function drawMobilityThumb(g, m, w, h) {
  const u = Math.min(w / 84, h / 40);
  const sp = new Space(w / 2, h / 2 + 17 * u, u);
  drawMobility(g, sp, m, G.MOBILITY_HEIGHT, pose({ propellerPhase: 0.6 }));
}

/** Csak a kar, jobbra fektetve. */
export function drawArmThumb(g, arm, w, h) {
  const im = img(Paths.arm(arm));
  if (!im) return;
  const l = 0; const t = -w * 0.06; const r = w * 0.9; const b = h + w * 0.06;
  const cx = (l + r) / 2; const cy = (t + b) / 2; const rw = r - l; const rh = b - t;
  rotated(g, -90, cx, cy, () => drawFit(g, im, cx - rh / 2, cy - rw / 2, cx + rh / 2, cy + rw / 2, 'CENTER'));
}
