// Little Robot Factory – játéklogika (a Kotlin model/data/engine csomag átirata).
// Idő ms-ban, távolság képernyő-egységben (1.0 = egy képernyő), emelés robotmagasságban.

// ---- Modell ---------------------------------------------------------------------------------

export const CAPS = ['ROLL', 'JUMP', 'FLY', 'SWIM', 'CLIMB', 'GRAB_LIGHT', 'PUSH', 'REACH', 'LIGHT',
  'HOVER', 'DIG', 'GRIP', 'HEAT', 'SWING', 'CUT', 'COOL', 'JET', 'MAGNET',
  'DIVE', 'BUBBLE', 'SCOOP', 'TURN', 'WALL_WALK', 'RESONATE', 'GLIDE', 'BLOW', 'REMOTE',
  'LIGHTWEIGHT'];

export const OBSTACLE_WIDTH = {
  GAP: 0.14, WATER: 0.24, STEEP_SLOPE: 0.30, LEDGE: 0.12, HEAVY_BOX: 0.24, HIGH_SWITCH: 0.08, DARK: 0.32,
  QUICKSAND: 0.24, ROCK_WALL: 0.10, ICE_SLOPE: 0.30, ICE_BLOCK: 0.10, VINE_CHASM: 0.34, THORNS: 0.14,
  LAVA: 0.24, BOULDER: 0.24, SPACE_GAP: 0.30, METAL_TOWER: 0.16,
  PLATE_DOOR: 0.08, LEVER_GATE: 0.08, CRANE_BRIDGE: 0.30, RAFT_RIVER: 0.30, TRAMPOLINE_CLIFF: 0.12, MAGNET_LIFT: 0.14,
  BUTTON: 0.06, LINKED_GATE: 0.08,
  DEEP_WATER: 0.26, SEAWEED: 0.16, CLAM: 0.14, KEY: 0.06, LOCKED_DOOR: 0.08,
  STICKY_GUM: 0.22, CHOCOLATE_WALL: 0.10, PUDDING: 0.20, FRAGILE_BRIDGE: 0.28,
  CONVEYOR: 0.26, GEAR_GATE: 0.10, DOUBLE_PLATE: 0.08,
  CRYSTAL_WALL: 0.12, CRYSTAL_SPIKES: 0.24, WIND_CHASM: 0.30, CLOUD_WALL: 0.12, WINDMILL: 0.10,
  TRAFFIC_GATE: 0.08,
};

export const HEADS = ['ROUND', 'SQUARE', 'POINTED'];
export const COLORS = ['BLUE', 'ORANGE', 'GREEN', 'PURPLE', 'RED'];

export const P = {
  WHEELS: 'wheels', SPRING: 'spring', PROPELLER: 'propeller', FLOAT: 'float', TRACKS: 'tracks',
  BASIC_ARM: 'basic_arm', STRONG_ARM: 'strong_arm', EXTEND_ARM: 'extend_arm', LAMP_ARM: 'lamp_arm',
  HOVER: 'hover', DRILL: 'drill', SPIKES: 'spikes', HEATER: 'heater', GRAPPLE: 'grapple', SAW: 'saw',
  WATER_CANNON: 'water_cannon', ROCKET: 'rocket', MAGNET: 'magnet',
  SUBMARINE: 'submarine', AIR_PUMP: 'air_pump', SCOOP: 'scoop', WRENCH: 'wrench', SPIDER: 'spider',
  TUNING_FORK: 'tuning_fork', GLIDER: 'glider', FAN: 'fan', REMOTE: 'remote',
};

const part = (id, slot, caps, heavy = false) => ({ id, slot, caps: new Set(caps), nameKey: 'part_' + id, heavy });
export const ALL_PARTS = [
  part(P.WHEELS, 'MOBILITY', ['ROLL']),
  part(P.SPRING, 'MOBILITY', ['JUMP']),
  part(P.PROPELLER, 'MOBILITY', ['FLY']),
  part(P.FLOAT, 'MOBILITY', ['SWIM']),
  part(P.TRACKS, 'MOBILITY', ['CLIMB'], true),
  part(P.BASIC_ARM, 'ARM', ['GRAB_LIGHT']),
  part(P.STRONG_ARM, 'ARM', ['PUSH'], true),
  part(P.EXTEND_ARM, 'ARM', ['REACH']),
  part(P.LAMP_ARM, 'ARM', ['LIGHT']),
  part(P.HOVER, 'MOBILITY', ['HOVER']),
  part(P.DRILL, 'ARM', ['DIG'], true),
  part(P.SPIKES, 'MOBILITY', ['GRIP']),
  part(P.HEATER, 'ARM', ['HEAT']),
  part(P.GRAPPLE, 'ARM', ['SWING']),
  part(P.SAW, 'ARM', ['CUT']),
  part(P.WATER_CANNON, 'ARM', ['COOL']),
  part(P.ROCKET, 'MOBILITY', ['JET'], true),
  part(P.MAGNET, 'ARM', ['MAGNET']),
  part(P.SUBMARINE, 'MOBILITY', ['DIVE'], true),
  part(P.AIR_PUMP, 'ARM', ['BUBBLE']),
  part(P.SCOOP, 'ARM', ['SCOOP']),
  part(P.WRENCH, 'ARM', ['TURN']),
  part(P.SPIDER, 'MOBILITY', ['WALL_WALK']),
  part(P.TUNING_FORK, 'ARM', ['RESONATE']),
  part(P.GLIDER, 'MOBILITY', ['GLIDE']),
  part(P.FAN, 'ARM', ['BLOW']),
  part(P.REMOTE, 'ARM', ['REMOTE']),
];
const PART_BY_ID = new Map(ALL_PARTS.map((p) => [p.id, p]));
export const MOBILITY_IDS = ALL_PARTS.filter((p) => p.slot === 'MOBILITY').map((p) => p.id);
export const ARM_IDS = ALL_PARTS.filter((p) => p.slot === 'ARM').map((p) => p.id);
export const STARTING_PARTS = new Set([P.WHEELS, P.SPRING, P.PROPELLER, P.BASIC_ARM]);
export const DEFAULT_MOBILITY = P.WHEELS;
export const DEFAULT_ARM = P.BASIC_ARM;

export const findPart = (id) => (id == null ? null : PART_BY_ID.get(id) || null);
export function resolveForSlot(id, slot) {
  const p = findPart(id);
  if (p && p.slot === slot) return p;
  return slot === 'MOBILITY' ? PART_BY_ID.get(DEFAULT_MOBILITY) : slot === 'ARM' ? PART_BY_ID.get(DEFAULT_ARM) : null;
}

export const robot = (o = {}) => ({ head: 'ROUND', color: 'BLUE', mobility: DEFAULT_MOBILITY, arm: DEFAULT_ARM, ...o });

// ---- Képességek ----------------------------------------------------------------------------

export function resolveCaps(cfg) {
  const m = resolveForSlot(cfg.mobility, 'MOBILITY');
  const a = resolveForSlot(cfg.arm, 'ARM');
  const s = new Set();
  if (m) m.caps.forEach((c) => s.add(c));
  if (a) a.caps.forEach((c) => s.add(c));
  if (!(m && m.heavy) && !(a && a.heavy)) s.add('LIGHTWEIGHT');
  return s;
}

export function sanitizeRobot(cfg) {
  return {
    ...cfg,
    mobility: resolveForSlot(cfg.mobility, 'MOBILITY').id,
    arm: resolveForSlot(cfg.arm, 'ARM').id,
  };
}

export function canPass(o, caps) {
  if (o.type === 'KEY') return true;
  if (o.type === 'LOCKED_DOOR') return caps.has('GRAB_LIGHT');
  return [...o.required].some((c) => caps.has(c));
}

export function crossingCapability(o, caps) {
  for (const c of CAPS) if (o.required.has(c) && caps.has(c)) return c;
  return null;
}

// ---- Küldetés ------------------------------------------------------------------------------

export class Mission {
  constructor(d) { Object.assign(this, d); }
  centerOf(o) { return o.positionFraction * this.length; }
  startOf(o) { return this.centerOf(o) - o.width / 2; }
  endOf(o) { return this.centerOf(o) + o.width / 2; }
  get isTeam() { return this.team > 1; }
  get isLanes() { return this.lanes > 1; }
  get everyoneMustArrive() { return this.isLanes; }
  laneObstacles(lane) { return this.obstacles.filter((o) => o.lane === lane).sort((a, b) => a.positionFraction - b.positionFraction); }
  get needsTeamEngine() { return this.obstacles.some((o) => o.type === 'KEY' || o.type === 'LOCKED_DOOR'); }
}
export const isHelperPost = (o) => o.helperAnyOf != null;

const ID_RE = /^[a-z0-9_]+$/;
const PARSE = { MIN_START: 0.15, END_CLEAR: 0.17, MIN_W: 0.04, MAX_W: 0.45, MIN_SPACING: 0.12, TEAM_GAP: 0.10, EPS: 1e-4 };

/** Pálya-JSON → Mission (a Kotlin MissionParser szabályaival). Hibánál null + hibák a konzolon. */
export function parseMission(root) {
  const errors = [];
  if (!root || typeof root !== 'object' || Array.isArray(root)) return { errors: ['root'] };
  const id = root.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) errors.push('id');
  const titleKey = root.titleKey;
  if (!titleKey) errors.push('titleKey');
  const length = typeof root.length === 'number' ? root.length : 1;
  if (length < 1 || length > 3) errors.push('length');
  const world = root.world | 0;
  const team = root.team == null ? 1 : root.team | 0;
  const lanes = root.lanes == null ? 1 : root.lanes | 0;
  if (world < 0 || world >= 12) errors.push('world');
  if (team < 1 || team > 4) errors.push('team');
  if (lanes !== 1 && lanes !== team) errors.push('lanes');
  const hard = root.hard === true;
  let reward = typeof root.rewardPartId === 'string' ? root.rewardPartId : null;
  if (reward && !findPart(reward)) reward = null;
  const obstacles = [];
  if (!Array.isArray(root.obstacles)) errors.push('obstacles');
  else root.obstacles.forEach((raw, i) => {
    const before = errors.length;
    const type = raw.type;
    if (!(type in OBSTACLE_WIDTH)) errors.push(`o${i} type`);
    const pos = raw.positionFraction;
    if (typeof pos !== 'number' || pos <= 0 || pos >= 1) errors.push(`o${i} pos`);
    const width = typeof raw.width === 'number' ? raw.width
      : typeof raw.widthFraction === 'number' ? raw.widthFraction * length : (OBSTACLE_WIDTH[type] ?? 0.14);
    if (width < PARSE.MIN_W || width > PARSE.MAX_W) errors.push(`o${i} width`);
    const caps = (k) => (Array.isArray(raw[k]) ? new Set(raw[k].filter((c) => CAPS.includes(c))) : null);
    const helperAnyOf = caps('helperAnyOf');
    const required = caps('requiredAnyOf') || new Set();
    const mayBeEmpty = helperAnyOf != null || ['BUTTON', 'LINKED_GATE', 'KEY', 'LOCKED_DOOR'].includes(type);
    if (required.size === 0 && !mayBeEmpty) errors.push(`o${i} required`);
    if (errors.length !== before) return;
    obstacles.push({
      id: raw.id, type, required, positionFraction: pos, width, lane: raw.lane | 0,
      helperAnyOf, opensBy: raw.opensBy ?? null, helpersNeeded: raw.helpersNeeded ?? 1,
    });
  });
  obstacles.sort((a, b) => a.positionFraction - b.positionFraction);
  const solution = [];
  (root.solution || []).forEach((pair) => {
    const m = findPart(pair[0]); const a = findPart(pair[1]);
    if (m && a && m.slot === 'MOBILITY' && a.slot === 'ARM') solution.push(robot({ mobility: m.id, arm: a.id }));
    else errors.push('solution');
  });
  if (errors.length) return { errors };
  return { mission: new Mission({ id, titleKey, obstacles, hintKey: root.hintKey ?? null, rewardPartId: reward, length, world, team, lanes, hard, solution }) };
}

// ---- Domborzat, szabályok, mozgás -----------------------------------------------------------

export function peakHeight(type) {
  switch (type) {
    case 'STEEP_SLOPE': return 1.5;
    case 'LEDGE': return 0.75;
    case 'ICE_SLOPE': return 1.3;
    case 'METAL_TOWER': return 1.7;
    case 'TRAMPOLINE_CLIFF': return 1.6;
    case 'MAGNET_LIFT': return 1.8;
    case 'ROCK_WALL': case 'ICE_BLOCK': return 1.6;
    case 'LINKED_GATE': case 'PLATE_DOOR': case 'LEVER_GATE': return 1.4;
    case 'THORNS': return 0.8;
    case 'CHOCOLATE_WALL': case 'CRYSTAL_WALL': case 'CLOUD_WALL': return 1.6;
    case 'GEAR_GATE': case 'TRAFFIC_GATE': case 'LOCKED_DOOR': return 1.4;
    case 'PUDDING': return 0.9;
    case 'CLAM': return 1.0;
    case 'SEAWEED': return 1.2;
    default: return 0;
  }
}
export const hasProfile = (t) => ['STEEP_SLOPE', 'LEDGE', 'ICE_SLOPE', 'METAL_TOWER', 'TRAMPOLINE_CLIFF', 'MAGNET_LIFT'].includes(t);
export function profile(type, q) {
  const ramp = (type === 'LEDGE' || type === 'TRAMPOLINE_CLIFF') ? 0.12
    : (type === 'METAL_TOWER' || type === 'MAGNET_LIFT') ? 0.18 : type === 'ICE_SLOPE' ? 0.4 : 0.35;
  if (q <= 0 || q >= 1) return 0;
  if (q < ramp) return q / ramp;
  if (q > 1 - ramp) return (1 - q) / ramp;
  return 1;
}

const CLEARED_BY = {
  HEAVY_BOX: ['PUSH'], BOULDER: ['PUSH', 'DIG'], ROCK_WALL: ['DIG'], ICE_BLOCK: ['HEAT'], THORNS: ['CUT'],
  LAVA: ['COOL'], HIGH_SWITCH: ['REACH'], SEAWEED: ['CUT'], CLAM: ['BUBBLE'], CHOCOLATE_WALL: ['HEAT'],
  PUDDING: ['SCOOP'], GEAR_GATE: ['TURN'], CRYSTAL_WALL: ['RESONATE'], CLOUD_WALL: ['BLOW'], TRAFFIC_GATE: ['REMOTE'],
};
export const clearedBy = (type) => CLEARED_BY[type] || [];
export const HELPER_SETUP_MS = 1100;
export const GATE_OPEN_MS = 800;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function easeInOut(t) { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); }

function actFraction(cap) {
  switch (cap) {
    case 'REACH': return 0.55;
    case 'DIG': case 'HEAT': case 'COOL': return 0.5;
    case 'CUT': return 0.45;
    case 'BUBBLE': case 'SCOOP': case 'TURN': case 'RESONATE': case 'BLOW': case 'REMOTE': return 0.5;
    case 'GRAB_LIGHT': return 0.4;
    default: return null;
  }
}

export function crossDuration(cap, assisted, o, distance) {
  const L = (v) => Math.trunc(v);
  if (assisted || cap == null) {
    if (o.type === 'TRAMPOLINE_CLIFF') return 1300;
    if (o.type === 'MAGNET_LIFT') return 2100;
    return 300 + L(distance / 0.26 * 1000);
  }
  switch (cap) {
    case 'JUMP': return 1000;
    case 'FLY': case 'JET': return 1200 + L(2500 * o.width);
    case 'SWIM': return 600 + L(distance / 0.12 * 1000);
    case 'CLIMB': case 'GRIP': case 'MAGNET': return 700 + L(distance / 0.13 * 1000);
    case 'PUSH': return 1700;
    case 'REACH': return 1800;
    case 'LIGHT': return 400 + L(distance / 0.16 * 1000);
    case 'HOVER': return 500 + L(distance / 0.16 * 1000);
    case 'SWING': return 1600;
    case 'DIG': case 'HEAT': case 'COOL': return 1900;
    case 'CUT': return 1600;
    case 'DIVE': return 700 + L(distance / 0.12 * 1000);
    case 'GLIDE': return 1100 + L(2400 * o.width);
    case 'WALL_WALK': return 900 + L(distance / 0.13 * 1000);
    case 'LIGHTWEIGHT': return 300 + L(distance / 0.17 * 1000);
    case 'BUBBLE': case 'SCOOP': case 'TURN': case 'RESONATE': case 'BLOW': case 'REMOTE': return 1800;
    case 'GRAB_LIGHT': return 1500;
    default: return 1500;
  }
}

/** [x, lift] az átkelés p (0..1) pontjában. */
export function crossingAt(cap, assisted, mission, o, fromX, toX, p) {
  const type = o.type;
  if (assisted || cap == null) {
    if (type === 'TRAMPOLINE_CLIFF') {
      const q = clamp((p - 0.1) / 0.85, 0, 1); const h = peakHeight(type) + 0.7;
      return [lerp(fromX, toX, q), 4 * h * q * (1 - q)];
    }
    if (type === 'MAGNET_LIFT') {
      const top = peakHeight(type) + 0.05;
      if (p < 0.35) return [fromX, top * easeInOut(p / 0.35)];
      if (p < 0.75) return [lerp(fromX, toX, easeInOut((p - 0.35) / 0.4)), top];
      return [toX, top * (1 - easeInOut((p - 0.75) / 0.25))];
    }
    return [lerp(fromX, toX, p), 0];
  }
  const act = actFraction(cap);
  if (act != null) return [p < act ? fromX : lerp(fromX, toX, (p - act) / (1 - act)), 0];
  switch (cap) {
    case 'JUMP': {
      const q = clamp((p - 0.15) / 0.70, 0, 1); const h = Math.max(1.1, peakHeight(type) + 0.6);
      return [lerp(fromX, toX, q), 4 * h * q * (1 - q)];
    }
    case 'FLY': case 'JET': {
      const h = Math.max(1.4, peakHeight(type) + 0.8);
      if (p < 0.2) return [fromX, h * easeInOut(p / 0.2)];
      if (p < 0.8) return [lerp(fromX, toX, easeInOut((p - 0.2) / 0.6)), h];
      return [toX, h * (1 - easeInOut((p - 0.8) / 0.2))];
    }
    case 'CLIMB': case 'GRIP': case 'MAGNET': {
      const x = lerp(fromX, toX, p); const q = (x - mission.startOf(o)) / o.width;
      return [x, peakHeight(type) * profile(type, q)];
    }
    case 'SWIM': { const dip = Math.min(1, p / 0.15, (1 - p) / 0.15); return [lerp(fromX, toX, p), -0.28 * dip]; }
    case 'HOVER': { const up = Math.min(1, p / 0.15, (1 - p) / 0.15); return [lerp(fromX, toX, p), 0.22 * up]; }
    case 'DIVE': { const dip = Math.min(1, p / 0.2, (1 - p) / 0.2); return [lerp(fromX, toX, p), -0.85 * easeInOut(dip)]; }
    case 'GLIDE': {
      const h = 1.1;
      const lift = p < 0.25 ? h * easeInOut(p / 0.25) : h * (1 - easeInOut((p - 0.25) / 0.75)) * 0.9 + h * 0.1 * (1 - p);
      return [lerp(fromX, toX, easeInOut(p)), lift];
    }
    case 'WALL_WALK': { const up = Math.min(1, p / 0.2, (1 - p) / 0.2); return [lerp(fromX, toX, p), 1.0 * easeInOut(up)]; }
    case 'SWING': {
      const q = easeInOut(p);
      return [lerp(fromX, toX, q), -0.55 * Math.sin(Math.PI * q) + 0.25 * Math.sin(Math.PI * q) * (1 - q)];
    }
    default: return [lerp(fromX, toX, p), 0];
  }
}

// ---- Idővonalak ----------------------------------------------------------------------------

export const PARAMS = {
  startX: 0.08, goalMargin: 0.11, baseSpeed: 0.22, obstaclePauseMs: 380, blockedMs: 1400,
  robotHalfWidth: 0.04, edgeMargin: 0.015,
  speedFor(length) { return this.baseSpeed * Math.max(1, 0.8 * length); },
};
export const TEAM_GAP = 0.10;
const TICK_MS = 20;
const MAX_MS = 90000;

/** Egy robot: szakaszokból álló idővonal. */
class SingleTimeline {
  constructor(mission, caps) {
    this.mission = mission;
    const params = PARAMS;
    const segs = [];
    const speed = params.speedFor(mission.length);
    const goalX = mission.length - params.goalMargin;
    this.goalX = goalX;
    let x = params.startX;
    const clearance = params.robotHalfWidth + params.edgeMargin;
    const moveTo = (target) => {
      const to = Math.max(target, x);
      if (to > x) { segs.push({ k: 'move', fromX: x, toX: to, d: Math.max(1, Math.trunc((to - x) / speed * 1000)) }); x = to; }
    };
    let outcome = { win: true };
    for (const o of [...mission.obstacles].sort((a, b) => a.positionFraction - b.positionFraction)) {
      moveTo(mission.startOf(o) - clearance);
      segs.push({ k: 'pause', id: o.id, x, d: params.obstaclePauseMs });
      const cap = crossingCapability(o, caps);
      if (cap == null) {
        segs.push({ k: 'block', id: o.id, x, d: params.blockedMs });
        outcome = { win: false, id: o.id, x };
        break;
      }
      const exitX = Math.min(mission.endOf(o) + clearance, goalX);
      segs.push({ k: 'cross', o, cap, fromX: x, toX: exitX, d: crossDuration(cap, false, o, exitX - x) });
      x = exitX;
    }
    if (outcome.win) moveTo(goalX);
    this.segs = segs;
    this.outcome = outcome;
    this.total = segs.reduce((s, g) => s + g.d, 0);
  }
  progress(x) { return clamp((x - PARAMS.startX) / (this.goalX - PARAMS.startX), 0, 1); }
  frameAt(tms) {
    const t = Math.max(0, tms);
    let s0 = 0;
    for (const g of this.segs) {
      const e = s0 + g.d;
      if (t < e) {
        const p = clamp(g.d === 0 ? 1 : (t - s0) / g.d, 0, 1);
        switch (g.k) {
          case 'move': { const x = lerp(g.fromX, g.toX, p); return { state: { k: 'Moving', progress: this.progress(x) }, x, lift: 0, cap: null, p, t }; }
          case 'pause': return { state: { k: 'AtObstacle', id: g.id }, x: g.x, lift: 0, cap: null, p, t };
          case 'block': return { state: { k: 'Blocked', id: g.id }, x: g.x, lift: 0, cap: null, p, t };
          default: {
            const [x, lift] = crossingAt(g.cap, false, this.mission, g.o, g.fromX, g.toX, p);
            return { state: { k: 'Crossing', id: g.o.id, progress: p }, x, lift, cap: g.cap, p, t };
          }
        }
      }
      s0 = e;
    }
    if (this.outcome.win) return { state: { k: 'Success' }, x: this.goalX, lift: 0, cap: null, p: 0, t };
    return { state: { k: 'Failure', id: this.outcome.id }, x: this.outcome.x, lift: 0, cap: null, p: 0, t };
  }
}

export const isTerminal = (state) => state.k === 'Success' || state.k === 'Failure';

class SingleRun {
  constructor(mission, caps) {
    this.mission = mission;
    this.caps = caps;
    this.tl = new SingleTimeline(mission, caps);
    this.totalDurationMs = this.tl.total;
    this.isSuccessful = this.tl.outcome.win;
    this.failureObstacleId = this.tl.outcome.win ? null : this.tl.outcome.id;
  }
  frameAt(t) {
    const f = this.tl.frameAt(t);
    const s = f.state;
    const mission = this.mission;
    const map = { Moving: 'MOVING', AtObstacle: 'PAUSE', Crossing: 'CROSSING', Blocked: 'BLOCKED', Failure: 'STUCK', Success: 'DONE', Ready: 'READY' };
    const phase = map[s.k];
    const progress = {};
    for (const o of mission.obstacles) {
      let v = 0;
      if (s.k === 'Crossing' && s.id === o.id) v = f.p;
      else if (f.x >= mission.endOf(o) - 1e-4) v = 1;
      if (v > 0) progress[o.id] = v;
    }
    const clearedWith = {};
    for (const o of mission.obstacles) {
      if (!(o.id in progress)) continue;
      const cap = crossingCapability(o, this.caps);
      if (cap && clearedBy(o.type).includes(cap)) clearedWith[o.id] = cap;
    }
    const r = { x: f.x, lift: f.lift, lane: 0, phase, obstacleId: s.id ?? null, capability: phase === 'CROSSING' ? f.cap : null, assisted: false, p: f.p, carriesKey: false };
    return { state: s, robots: [r], obstacleProgress: progress, elapsedMs: f.t, clearedWith };
  }
}

class TeamRun {
  constructor(mission, team) {
    this.mission = mission;
    const params = PARAMS;
    const n = Math.max(1, team.length);
    const lanesMode = mission.isLanes;
    const goalX = mission.length - params.goalMargin;
    this.goalX = goalX;
    const clearance = params.robotHalfWidth + params.edgeMargin;
    const speedPerTick = params.speedFor(mission.length) * TICK_MS / 1000;
    const bots = team.map((cfg, i) => {
      const lane = lanesMode ? Math.min(i, mission.lanes - 1) : 0;
      const x0 = lanesMode ? params.startX : params.startX + (n - 1 - i) * TEAM_GAP;
      return {
        index: i, lane, caps: resolveCaps(cfg), obstacles: mission.laneObstacles(lane), x: x0,
        lift: 0, phase: 'MOVING', next: 0, start: 0, end: 0, obstacle: null, cap: null, assisted: false,
        fromX: 0, toX: 0, helpLift: 0, moved: false, keys: new Set(), keyUsedAt: new Map(),
      };
    });
    const occupied = new Map();
    const cleared = new Map(); // id -> [start, dur]
    const clearedCap = new Map();
    const posts = new Map(); // id -> [t...]
    const keyTaken = new Map();
    const pressed = new Map();
    const stuckAt = new Map();
    const ticks = [];

    const frame = (b, t) => {
      const p = ['PAUSE', 'CROSSING', 'BLOCKED', 'HELPING'].includes(b.phase)
        ? (b.end > b.start ? clamp((t - b.start) / (b.end - b.start), 0, 1) : 1) : 0;
      const shown = (b.phase === 'MOVING' || b.phase === 'DONE') ? null : (b.obstacle ? b.obstacle.id : null);
      let carries = false;
      for (const k of b.keys) { const u = b.keyUsedAt.get(k); if (u == null || t < u) carries = true; }
      return { x: b.x, lift: b.lift, lane: b.lane, phase: b.phase, obstacleId: shown, capability: b.phase === 'CROSSING' ? b.cap : null,
        assisted: b.assisted && b.phase === 'CROSSING', p, carriesKey: carries };
    };
    const leaderLimit = (b) => {
      let leader = null;
      for (const it of bots) {
        if (it.index < b.index && it.lane === b.lane && !['HELPING', 'BLOCKED', 'STUCK'].includes(it.phase)) leader = it;
      }
      return leader ? leader.x - TEAM_GAP : Number.MAX_VALUE;
    };
    const cross = (b, o, cap, assisted, t) => {
      b.phase = 'CROSSING'; b.cap = cap; b.assisted = assisted; b.fromX = b.x;
      b.toX = Math.min(mission.endOf(o) + clearance, goalX);
      b.start = t; b.end = t + crossDuration(cap, assisted, o, b.toX - b.fromX);
      occupied.set(o.id, b.index);
    };
    const stuck = (b, o, t) => { b.phase = 'BLOCKED'; b.start = t; b.end = t + params.blockedMs; stuckAt.set(b.index, o); };
    const decide = (b, t) => {
      const o = b.obstacle; if (!o) return;
      const occ = occupied.get(o.id);
      if (occ != null && occ !== b.index) { b.phase = 'WAITING'; return; }
      const exitX = Math.min(mission.endOf(o) + clearance, goalX);
      const postOpen = isHelperPost(o) && (posts.get(o.id)?.length ?? 0) < o.helpersNeeded;
      if (leaderLimit(b) < exitX - 1e-4 && !postOpen) { b.phase = 'WAITING'; return; }
      const own = crossingCapability(o, b.caps);
      const clear = cleared.get(o.id);
      if (o.type === 'KEY') {
        cross(b, o, null, true, t);
        if (b.caps.has('GRAB_LIGHT') && !keyTaken.has(o.id)) {
          keyTaken.set(o.id, [b.index, b.start + Math.trunc((b.end - b.start) / 2)]);
          b.keys.add(o.id);
        }
      } else if (o.type === 'LOCKED_DOOR' && clear == null) {
        if (o.opensBy != null && b.keys.has(o.opensBy)) {
          cross(b, o, 'GRAB_LIGHT', false, t);
          b.keyUsedAt.set(o.opensBy, b.start + Math.trunc((b.end - b.start) / 2));
          cleared.set(o.id, [b.start, b.end - b.start]);
          clearedCap.set(o.id, 'GRAB_LIGHT');
        } else b.phase = 'WAITING';
      } else if (o.type === 'BUTTON') {
        if (o.required.size === 0 || own != null) {
          cross(b, o, own, own == null, t);
          if (!pressed.has(o.id)) pressed.set(o.id, b.start + Math.trunc((b.end - b.start) / 2));
        } else stuck(b, o, t);
      } else if (o.type === 'LINKED_GATE') {
        const pt = pressed.get(o.opensBy);
        if (pt != null && t >= pt + GATE_OPEN_MS) cross(b, o, null, true, t);
        else b.phase = 'WAITING';
      } else if (clear != null) {
        if (t >= clear[0] + clear[1]) cross(b, o, null, true, t); else b.phase = 'WAITING';
      } else if (own != null) {
        cross(b, o, own, false, t);
        if (clearedBy(o.type).includes(own)) { cleared.set(o.id, [b.start, b.end - b.start]); clearedCap.set(o.id, own); }
      } else if (isHelperPost(o)) {
        const post = posts.get(o.id);
        const helpers = o.helperAnyOf || new Set();
        const full = post != null && post.length >= o.helpersNeeded;
        if (full) {
          if (t >= Math.max(...post) + HELPER_SETUP_MS) cross(b, o, null, true, t); else b.phase = 'WAITING';
        } else if (helpers.size === 0 || [...helpers].some((c) => b.caps.has(c))) {
          let list = posts.get(o.id); if (!list) { list = []; posts.set(o.id, list); }
          const slot = list.length;
          list.push(t);
          b.phase = 'HELPING'; b.start = t; b.end = t + HELPER_SETUP_MS; b.fromX = b.x;
          if (o.type === 'RAFT_RIVER') { b.toX = mission.centerOf(o); b.helpLift = -0.3; } else { b.toX = b.x - slot * 0.07; b.helpLift = 0; }
        } else if (post != null) b.phase = 'WAITING';
        else stuck(b, o, t);
      } else stuck(b, o, t);
    };
    const stepPhase = (b, t) => {
      switch (b.phase) {
        case 'MOVING': {
          const o = b.obstacles[b.next];
          const doneHere = bots.filter((it) => it.lane === b.lane && it.phase === 'DONE').length;
          const target = o ? mission.startOf(o) - clearance : goalX - TEAM_GAP * doneHere;
          const nx = Math.max(Math.min(b.x + speedPerTick, target, leaderLimit(b)), b.x);
          if (nx > b.x + 1e-6) b.moved = true;
          b.x = nx;
          if (b.x >= target - 1e-5) {
            if (o) { b.obstacle = o; b.phase = 'PAUSE'; b.start = t; b.end = t + params.obstaclePauseMs; } else { b.phase = 'DONE'; b.obstacle = null; }
          }
          break;
        }
        case 'PAUSE': if (t >= b.end) decide(b, t); break;
        case 'WAITING': decide(b, t); break;
        case 'CROSSING': {
          const o = b.obstacle;
          if (t >= b.end) { b.x = b.toX; b.lift = 0; occupied.delete(o.id); b.next++; b.phase = 'MOVING'; } else {
            const p = (t - b.start) / (b.end - b.start);
            const [x, lift] = crossingAt(b.cap, b.assisted, mission, o, b.fromX, b.toX, p);
            b.x = x; b.lift = lift;
          }
          break;
        }
        case 'HELPING': {
          const p = clamp((t - b.start) / (b.end - b.start), 0, 1);
          b.x = lerp(b.fromX, b.toX, easeInOut(p)); b.lift = b.helpLift * easeInOut(p);
          break;
        }
        case 'BLOCKED': if (t >= b.end) b.phase = 'STUCK'; break;
        default: break;
      }
    };
    const step = (b, t) => { b.moved = false; const before = b.phase; stepPhase(b, t); if (b.phase !== before) b.moved = true; };
    const pending = (t) => {
      for (const l of posts.values()) if (l.some((v) => t < v + HELPER_SETUP_MS)) return true;
      for (const v of pressed.values()) if (t < v + GATE_OPEN_MS) return true;
      for (const v of cleared.values()) if (t < v[0] + v[1]) return true;
      return false;
    };
    const settled = (b, t) => b.phase === 'DONE' || b.phase === 'STUCK' || (b.phase === 'HELPING' && t >= b.end);

    let t = 0;
    ticks.push(bots.map((b) => frame(b, t)));
    while (t < MAX_MS) {
      t += TICK_MS;
      for (const b of bots) step(b, t);
      const busy = bots.some((it) => it.phase === 'PAUSE' || it.phase === 'CROSSING' || it.phase === 'BLOCKED' || it.moved || (it.phase === 'HELPING' && t < it.end));
      if (!busy && !pending(t)) {
        const byLane = new Map();
        for (const b of bots) if (b.phase === 'WAITING') { const cur = byLane.get(b.lane); if (!cur || b.x > cur.x) byLane.set(b.lane, b); }
        for (const b of byLane.values()) stuck(b, b.obstacle, t);
      }
      ticks.push(bots.map((b) => frame(b, t)));
      if (bots.every((b) => settled(b, t))) break;
    }
    if (t >= MAX_MS) for (const b of bots) if (!settled(b, t)) { if (b.obstacle) stuckAt.set(b.index, b.obstacle); b.phase = 'STUCK'; }

    const doneCount = bots.filter((b) => b.phase === 'DONE').length;
    const success = mission.everyoneMustArrive ? doneCount === bots.length : doneCount >= 1;
    let failure = null;
    if (!success) {
      let best = null;
      for (const [idx, o] of stuckAt) if (!best || bots[idx].x > bots[best[0]].x) best = [idx, o];
      if (best) failure = best[1].id;
      else {
        const h = bots.filter((b) => b.phase === 'HELPING').sort((a, b) => b.x - a.x)[0];
        failure = h?.obstacle?.id ?? (mission.obstacles.length ? mission.obstacles[mission.obstacles.length - 1].id : null);
      }
    }
    this.ticks = ticks;
    this.cleared = cleared; this.clearedCap = clearedCap; this.posts = posts; this.keyTaken = keyTaken; this.pressed = pressed;
    this.totalDurationMs = t + (success ? 250 : 0);
    this.isSuccessful = success;
    this.failureObstacleId = failure;
    this.bots = bots;
  }

  progressAt(t) {
    const m = {};
    for (const [id, se] of this.cleared) m[id] = clamp((t - se[0]) / se[1], 0, 1);
    for (const [id, starts] of this.posts) {
      const need = this.mission.obstacles.find((o) => o.id === id)?.helpersNeeded ?? 1;
      const ready = starts.reduce((s, v) => s + clamp((t - v) / HELPER_SETUP_MS, 0, 1), 0);
      m[id] = clamp(ready / need, 0, 1);
    }
    for (const [id, taken] of this.keyTaken) if (t >= taken[1]) m[id] = 1;
    for (const o of this.mission.obstacles) {
      if (o.type === 'BUTTON') { const v = this.pressed.get(o.id); if (v != null && t >= v) m[o.id] = 1; }
      if (o.type === 'LINKED_GATE') { const v = this.pressed.get(o.opensBy); if (v != null) m[o.id] = clamp((t - v) / GATE_OPEN_MS, 0, 1); }
    }
    return m;
  }

  clearedWithAt(t) {
    const m = {};
    for (const [id, cap] of this.clearedCap) { const c = this.cleared.get(id); if (c && t >= c[0]) m[id] = cap; }
    return m;
  }

  frameAt(tms) {
    const t = Math.max(0, tms);
    if (t >= this.totalDurationMs) {
      const robots = this.ticks[this.ticks.length - 1].map((r) => (r.phase === 'BLOCKED' ? { ...r, phase: 'STUCK' } : r));
      const state = this.isSuccessful ? { k: 'Success' } : { k: 'Failure', id: this.failureObstacleId ?? '' };
      return { state, robots, obstacleProgress: this.progressAt(t), elapsedMs: t, clearedWith: this.clearedWithAt(t) };
    }
    const i = clamp(Math.floor(t / TICK_MS), 0, this.ticks.length - 1);
    const j = Math.min(i + 1, this.ticks.length - 1);
    const frac = (t - i * TICK_MS) / TICK_MS;
    const robots = this.ticks[i].map((a, k) => {
      const b = this.ticks[j][k];
      if (a.phase === b.phase && a.obstacleId === b.obstacleId) {
        return { ...a, x: a.x + (b.x - a.x) * frac, lift: a.lift + (b.lift - a.lift) * frac, p: a.p + (b.p - a.p) * frac };
      }
      return a;
    });
    let lead = null;
    for (const r of robots) if (r.phase !== 'STUCK' && r.phase !== 'BLOCKED') lead = lead == null ? r.x : Math.max(lead, r.x);
    if (lead == null) lead = PARAMS.startX;
    const progress = clamp((lead - PARAMS.startX) / (this.goalX - PARAMS.startX), 0, 1);
    return { state: { k: 'Moving', progress }, robots, obstacleProgress: this.progressAt(t), elapsedMs: t, clearedWith: this.clearedWithAt(t) };
  }
}

/** A küldetéshez illő futás: 1 robot → egyszerű idővonal, csapat → csapatmotor. */
export function buildRun(mission, team) {
  const robots = team.map(sanitizeRobot);
  if (!mission.isTeam && robots.length <= 1 && !mission.needsTeamEngine) {
    return new SingleRun(mission, resolveCaps(robots[0] || robot()));
  }
  return new TeamRun(mission, robots);
}

export function readyFrame(mission, teamSize) {
  const n = Math.max(1, teamSize);
  const lanes = !!(mission && mission.isLanes);
  const robots = Array.from({ length: n }, (_, i) => ({
    x: lanes ? PARAMS.startX : PARAMS.startX + (n - 1 - i) * TEAM_GAP, lift: 0, lane: lanes ? i : 0, phase: 'READY',
    obstacleId: null, capability: null, assisted: false, p: 0, carriesKey: false,
  }));
  return { state: { k: 'Ready' }, robots, obstacleProgress: {}, elapsedMs: 0, clearedWith: {} };
}

// ---- Haladás, tippek -----------------------------------------------------------------------

export const MISSIONS_PER_WORLD = 20;
export const MAX_TEAM = 4;

export const isMissionUnlocked = (missions, i, completed) => i === 0 || (i >= 0 && i < missions.length && completed.has(missions[i - 1].id));
export function availableParts(missions, completed) {
  const s = new Set(STARTING_PARTS);
  for (const m of missions) if (completed.has(m.id) && m.rewardPartId) s.add(m.rewardPartId);
  return s;
}
export function sanitizeAvailable(cfg, available) {
  const safe = sanitizeRobot(cfg);
  return { ...safe, mobility: available.has(safe.mobility) ? safe.mobility : DEFAULT_MOBILITY, arm: available.has(safe.arm) ? safe.arm : DEFAULT_ARM };
}

export const Hints = {
  keyObstacle(m) {
    let best = null; let bestScore = Infinity;
    m.obstacles.forEach((o, i) => {
      let options;
      if (isHelperPost(o) || o.type === 'LINKED_GATE' || o.type === 'LOCKED_DOOR') options = 0;
      else if (o.type === 'BUTTON' || o.type === 'KEY') options = 9;
      else options = o.required.size;
      const s = options * 100 + i;
      if (s < bestScore) { bestScore = s; best = o; }
    });
    return best;
  },
  partsWith(caps) { return ALL_PARTS.filter((p) => [...p.caps].some((c) => caps.has(c))).map((p) => p.id); },
  partsFor(o) {
    if (o.type === 'LOCKED_DOOR' || o.type === 'KEY') return [P.BASIC_ARM];
    const caps = new Set(o.required); caps.delete('LIGHTWEIGHT');
    return this.partsWith(caps);
  },
  helperPartsFor(o) { return this.partsWith(o.helperAnyOf || new Set()); },
  anyoneCanHelp(o) { return o.helperAnyOf != null && o.helperAnyOf.size === 0; },
};

// ---- Robot ↔ szöveg ------------------------------------------------------------------------
export const GARAGE_SLOTS = 3;
export const encodeRobot = (r) => [r.head, r.color, r.mobility, r.arm].join('|');
export function decodeRobot(s) {
  if (!s) return null;
  const p = s.split('|');
  if (p.length !== 4 || !HEADS.includes(p[0]) || !COLORS.includes(p[1]) || !MOBILITY_IDS.includes(p[2]) || !ARM_IDS.includes(p[3])) return null;
  return { head: p[0], color: p[1], mobility: p[2], arm: p[3] };
}
