// Orb system — three-level progression.
// Level 1 (golden): outer orbit ring, dynamic radius 75–100% of base.
// Level 2 (silver): middle orbit ring, fixed 50% of base radius.
// Level 3 (platinum): inner orbit ring, fixed 25% of base radius.
// Consumed orbs (purple): free-float in front of the avatar in #consumed-orb-layer.
// Spent orbs (dark): over-limit penalty visual, drift like consumed.

import { lerp, randRange, randInt } from "./util.js";

const ORB_SRC = "ImageUpload/Orb.png";
const DRIFT = 0.012;
const RING_SPEED = 0.25;       // radians/second (~25 s per full orbit)
const OFFSET_LERP = 4.0;       // rad/s angular lerp for smooth equidistant recalculation
const RING_BASE_SCALE = 0.385;
const NEAR_SCALE = 1.35;

let ringLayer;
let consumedLayer;
let level1RingOrbs = [];
let level2RingOrbs = [];
let level3RingOrbs = [];
let consumedOrbs = [];  // each has .level field for release routing
let spentOrbs = [];     // over-limit penalty visual
let level1OrbsTotal = 0; // total L1 orbs this day, for radius formula
let ringAngle = 0;
let ringPaused = false;
let rafId = null;
let lastTime = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand2D() {
  return { x: randRange(0.12, 0.88), y: randRange(0.08, 0.62), z: randRange(0, 1) };
}

function rectOf(container) {
  return container.getBoundingClientRect();
}

// Returns the shared orbit center and baseRadius from the avatar element.
function getOrbCenter() {
  const layerRect = rectOf(ringLayer);
  const av = document.getElementById("avatar-container").getBoundingClientRect();
  const baseRadius = av.width * 0.35;
  return {
    cx: av.left + av.width / 2 - layerRect.left,
    cy: av.top + av.height * (1 / 3) - layerRect.top,
    baseRadius,
  };
}

// Returns { cx, cy, radius } for a given orb level.
// countOverride: treat as if this many level-1 ring orbs exist (for release pre-computation).
function getCircleParams(level, countOverride) {
  const { cx, cy, baseRadius } = getOrbCenter();
  let radius;
  if (level === 1) {
    const n = countOverride !== undefined ? countOverride : level1RingOrbs.length;
    const ratio = level1OrbsTotal > 0 ? n / level1OrbsTotal : 0;
    radius = baseRadius * (0.75 + 0.25 * ratio);
  } else if (level === 2) {
    radius = baseRadius * 0.5;
  } else {
    radius = baseRadius * 0.25;
  }
  return { cx, cy, radius };
}

function makeOrbEl(extraClass) {
  const orb = document.createElement("div");
  orb.className = extraClass ? `orb ${extraClass}` : "orb";
  const img = document.createElement("img");
  img.src = ORB_SRC;
  img.alt = "";
  orb.appendChild(img);
  const motes = [];
  const n = randInt(3, 5);
  for (let i = 0; i < n; i++) {
    const m = document.createElement("div");
    m.className = "mote";
    orb.appendChild(m);
    motes.push({ el: m, phase: Math.random(), speed: randRange(0.4, 0.9) });
  }
  return { orb, motes };
}

function applyTransformConsumed(orbObj, rect) {
  const px = orbObj.pos.x * rect.width;
  const py = orbObj.pos.y * rect.height;
  const scale = 0.6 + orbObj.pos.z * 0.75;
  orbObj.el.style.transform = `translate(${px}px, ${py}px) scale(${scale})`;
  orbObj.el.style.zIndex = String(Math.round(orbObj.pos.z * 100));
  orbObj.el.style.opacity = String(0.55 + orbObj.pos.z * 0.45);
}

function updateMotes(orbObj, dt) {
  orbObj.motes.forEach((m) => {
    m.phase += m.speed * dt;
    if (m.phase >= 1) m.phase -= 1;
    const t = m.phase;
    const up = -t * 36;
    const out = Math.sin(t * Math.PI * 2) * 10;
    m.el.style.transform = `translate(${out}px, ${up}px) scale(${1 - t * 0.5})`;
    m.el.style.opacity = String(Math.sin(t * Math.PI) * 0.9);
  });
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn(t)  { return t * t * t; }

function lerpAngle(current, target, rate, dt) {
  const diff = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return current + Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
}

function spawnTrailMote(container, x, y, scale, consumed = false) {
  const m = document.createElement("div");
  m.className = consumed ? "trail-mote consumed" : "trail-mote";
  m.style.transform = `translate(${x}px, ${y}px) scale(${Math.max(0.05, scale)})`;
  m.style.opacity = "0.7";
  container.appendChild(m);
  const start = performance.now();
  function fade(now) {
    const t = Math.min(1, (now - start) / 480);
    m.style.opacity = String(0.7 * (1 - t));
    if (t < 1) requestAnimationFrame(fade);
    else m.remove();
  }
  requestAnimationFrame(fade);
}

function centerOfEl(elId) {
  const r = document.getElementById(elId).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Animation loop ───────────────────────────────────────────────────────────

function updateLevelOrbs(orbsArr, radius, cx, cy, dt) {
  const n = orbsArr.length;
  orbsArr.forEach((o, i) => {
    if (o.frozen) return;
    const targetOffset = i * ((2 * Math.PI) / n);
    o.orbitOffset = lerpAngle(o.orbitOffset, targetOffset, OFFSET_LERP, dt);
    const angle = ringAngle + o.orbitOffset;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    o.currentX = x;
    o.currentY = y;
    o.el.style.transform = `translate(${x}px, ${y}px) scale(${RING_BASE_SCALE})`;
    o.el.style.opacity = "0.85";
    updateMotes(o, dt);
  });
}

function tick(now) {
  if (!lastTime) lastTime = now;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const totalRing = level1RingOrbs.length + level2RingOrbs.length + level3RingOrbs.length;
  if (totalRing > 0) {
    if (!ringPaused) ringAngle += RING_SPEED * dt;
    const { cx, cy, baseRadius } = getOrbCenter();

    const l1Ratio = level1OrbsTotal > 0 ? level1RingOrbs.length / level1OrbsTotal : 0;
    const r1 = baseRadius * (0.75 + 0.25 * l1Ratio);
    const r2 = baseRadius * 0.5;
    const r3 = baseRadius * 0.25;

    updateLevelOrbs(level1RingOrbs, r1, cx, cy, dt);
    updateLevelOrbs(level2RingOrbs, r2, cx, cy, dt);
    updateLevelOrbs(level3RingOrbs, r3, cx, cy, dt);
  }

  if (consumedOrbs.length > 0) {
    const rect = rectOf(consumedLayer);
    consumedOrbs.forEach((o) => {
      if (o.frozen) return;
      o.pos.x = lerp(o.pos.x, o.target.x, DRIFT);
      o.pos.y = lerp(o.pos.y, o.target.y, DRIFT);
      o.pos.z = lerp(o.pos.z, o.target.z, DRIFT);
      if (Math.abs(o.pos.x - o.target.x) < 0.01 && Math.abs(o.pos.y - o.target.y) < 0.01) {
        o.target = rand2D();
      }
      applyTransformConsumed(o, rect);
      updateMotes(o, dt);
    });
  }

  if (spentOrbs.length > 0) {
    const rect = rectOf(consumedLayer);
    spentOrbs.forEach((o) => {
      if (o.frozen) return;
      o.pos.x = lerp(o.pos.x, o.target.x, DRIFT);
      o.pos.y = lerp(o.pos.y, o.target.y, DRIFT);
      o.pos.z = lerp(o.pos.z, o.target.z, DRIFT);
      if (Math.abs(o.pos.x - o.target.x) < 0.01 && Math.abs(o.pos.y - o.target.y) < 0.01) {
        o.target = rand2D();
      }
      applyTransformConsumed(o, rect);
      updateMotes(o, dt);
    });
  }

  rafId = requestAnimationFrame(tick);
}

// ─── Public lifecycle ─────────────────────────────────────────────────────────

export function startLoop() {
  ringLayer = document.getElementById("orb-layer");
  consumedLayer = document.getElementById("consumed-orb-layer");
  if (rafId == null) {
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  }
}

export function stopLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function clearAll() {
  [...level1RingOrbs, ...level2RingOrbs, ...level3RingOrbs].forEach((o) => o.el.remove());
  consumedOrbs.forEach((o) => o.el.remove());
  spentOrbs.forEach((o) => o.el.remove());
  level1RingOrbs = [];
  level2RingOrbs = [];
  level3RingOrbs = [];
  consumedOrbs = [];
  spentOrbs = [];
}

export function ringOrbCount() {
  return level1RingOrbs.length + level2RingOrbs.length + level3RingOrbs.length;
}
export function consumedOrbCount() { return consumedOrbs.length; }

// Returns levels of all current ring orbs (for EOD carry-forward capture).
export function getRingOrbLevels() {
  return [
    ...level1RingOrbs.map(() => 1),
    ...level2RingOrbs.map(() => 2),
    ...level3RingOrbs.map(() => 3),
  ];
}

// ─── Spawning ─────────────────────────────────────────────────────────────────

function addRingOrb(level, orbitOffset = 0) {
  const { orb, motes } = makeOrbEl(`level-${level}`);
  // L1 behind avatar, L2+L3 in front (consumed-orb-layer has higher z-index).
  (level === 1 ? ringLayer : consumedLayer).appendChild(orb);
  const levelOrbs = level === 1 ? level1RingOrbs : level === 2 ? level2RingOrbs : level3RingOrbs;
  const o = { el: orb, motes, currentX: 0, currentY: 0, frozen: false, orbitOffset, level };
  levelOrbs.push(o);
  return o;
}

function addConsumedOrb(level, pos) {
  const { orb, motes } = makeOrbEl("consumed"); // level class not needed; level stored in .level field
  consumedLayer.appendChild(orb);
  const o = { el: orb, motes, pos, target: rand2D(), frozen: false, level };
  applyTransformConsumed(o, rectOf(consumedLayer));
  consumedOrbs.push(o);
  return o;
}

// ringOrbLevels: array of levels for ring orbs (e.g. [1,1,1,2,2,3]).
// level1TotalForDay: total L1 orbs allocated today (for radius formula).
export function spawnRingOrbs(ringOrbLevels, level1TotalForDay) {
  clearAll();
  const l1 = ringOrbLevels.filter((l) => l === 1);
  const l2 = ringOrbLevels.filter((l) => l === 2);
  const l3 = ringOrbLevels.filter((l) => l === 3);
  level1OrbsTotal = level1TotalForDay !== undefined ? level1TotalForDay : l1.length;
  const step = (n) => (n > 0 ? (2 * Math.PI) / n : 0);
  l1.forEach((_, i) => addRingOrb(1, i * step(l1.length)));
  l2.forEach((_, i) => addRingOrb(2, i * step(l2.length)));
  l3.forEach((_, i) => addRingOrb(3, i * step(l3.length)));
}

// consumedOrbLevels: array of levels for session-restore consumed orbs.
export function spawnConsumedOrbs(consumedOrbLevels) {
  consumedOrbLevels.forEach((level) => addConsumedOrb(level, rand2D()));
}

// Spawn dark spent orbs in consumed layer (over-limit penalty visual).
export function spawnSpentOrbs(count) {
  for (let i = 0; i < count; i++) {
    const { orb, motes } = makeOrbEl("spent");
    consumedLayer.appendChild(orb);
    const pos = rand2D();
    const o = { el: orb, motes, pos, target: rand2D(), frozen: false };
    applyTransformConsumed(o, rectOf(consumedLayer));
    spentOrbs.push(o);
  }
}

// ─── Consume (tap) ────────────────────────────────────────────────────────────
// Lowest-level ring orb → consumed: zoom outward, fly to free-float spot, turn purple.

export async function consumeOneOrb() {
  let levelOrbs, orbLevel;
  if (level1RingOrbs.length > 0)      { levelOrbs = level1RingOrbs; orbLevel = 1; }
  else if (level2RingOrbs.length > 0) { levelOrbs = level2RingOrbs; orbLevel = 2; }
  else if (level3RingOrbs.length > 0) { levelOrbs = level3RingOrbs; orbLevel = 3; }
  else return;

  const { cx, cy, radius } = getCircleParams(orbLevel);
  const o = levelOrbs.pop();
  o.frozen = true;

  const sx = o.currentX;
  const sy = o.currentY;

  const dx = sx - cx;
  const dy = sy - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const p1x = cx + (dx / dist) * radius * 1.8;
  const p1y = cy + (dy / dist) * radius * 1.8;

  // Phase 1: move radially outward + zoom toward screen, 750ms ease-out.
  await new Promise((resolve) => {
    const t0 = performance.now();
    let lastTrail = 0;
    function p1(now) {
      const t = Math.min(1, (now - t0) / 750);
      const e = easeOut(t);
      const x = lerp(sx, p1x, e);
      const y = lerp(sy, p1y, e);
      const sc = lerp(RING_BASE_SCALE, NEAR_SCALE, e);
      o.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      o.el.style.opacity = "1";
      if (now - lastTrail > 25) { spawnTrailMote(ringLayer, x, y, sc); lastTrail = now; }
      if (t < 1) requestAnimationFrame(p1);
      else resolve();
    }
    requestAnimationFrame(p1);
  });

  // Phase 2: fly to random free-float destination, 350ms ease-in.
  const dest = rand2D();
  const layerRect = rectOf(ringLayer);
  const ex = dest.x * layerRect.width;
  const ey = dest.y * layerRect.height;
  const destScale = 0.6 + dest.z * 0.75;

  await new Promise((resolve) => {
    const t0 = performance.now();
    let lastTrail = 0;
    function p2(now) {
      const t = Math.min(1, (now - t0) / 350);
      const e = easeIn(t);
      const x = lerp(p1x, ex, e);
      const y = lerp(p1y, ey, e);
      const sc = lerp(NEAR_SCALE, destScale, e);
      o.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      o.el.style.opacity = "1";
      if (now - lastTrail > 25) { spawnTrailMote(ringLayer, x, y, sc); lastTrail = now; }
      if (t < 1) requestAnimationFrame(p2);
      else resolve();
    }
    requestAnimationFrame(p2);
  });

  // Transition: switch to consumed layer; drop level class (consumed orbs are always purple).
  o.el.classList.remove(`level-${orbLevel}`);
  o.el.classList.add("consumed");
  consumedLayer.appendChild(o.el);
  o.pos = { ...dest };
  o.target = rand2D();
  o.level = orbLevel;
  o.frozen = false;
  consumedOrbs.push(o);
}

// ─── Release (long-press) ─────────────────────────────────────────────────────
// Random consumed orb → ring: zoom toward screen, fly to correct orbit, turn golden.

export async function releaseOneConsumedOrb() {
  if (consumedOrbs.length === 0) return;
  ringPaused = true;
  const idx = randInt(0, consumedOrbs.length - 1);
  const o = consumedOrbs.splice(idx, 1)[0];
  o.frozen = true;

  const orbLevel = o.level || 1;
  const targetLevelOrbs = orbLevel === 1 ? level1RingOrbs
                        : orbLevel === 2 ? level2RingOrbs
                        : level3RingOrbs;

  const consumedRect = rectOf(consumedLayer);
  const sx = o.pos.x * consumedRect.width;
  const sy = o.pos.y * consumedRect.height;
  const baseScale = 0.6 + o.pos.z * 0.75;

  // Compute ring position this orb will occupy after joining.
  const newCount = targetLevelOrbs.length + 1;
  const { cx, cy, radius } = getCircleParams(orbLevel, orbLevel === 1 ? newCount : undefined);
  const newOrbIndex = targetLevelOrbs.length;
  const targetRelOffset = newOrbIndex * ((2 * Math.PI) / newCount);
  const targetAngle = ringAngle + targetRelOffset;
  const targetX = cx + radius * Math.cos(targetAngle);
  const targetY = cy + radius * Math.sin(targetAngle);

  // Phase 1: zoom toward screen, 750ms ease-out.
  await new Promise((resolve) => {
    const t0 = performance.now();
    function p1(now) {
      const t = Math.min(1, (now - t0) / 750);
      const e = easeOut(t);
      const sc = lerp(baseScale, NEAR_SCALE, e);
      o.el.style.transform = `translate(${sx}px, ${sy}px) scale(${sc})`;
      o.el.style.opacity = "1";
      if (t < 1) requestAnimationFrame(p1);
      else resolve();
    }
    requestAnimationFrame(p1);
  });

  // Phase 2: fly to ring position, 350ms ease-in + purple trail.
  await new Promise((resolve) => {
    const t0 = performance.now();
    let lastTrail = 0;
    function p2(now) {
      const t = Math.min(1, (now - t0) / 350);
      const e = easeIn(t);
      const x = lerp(sx, targetX, e);
      const y = lerp(sy, targetY, e);
      const sc = lerp(NEAR_SCALE, RING_BASE_SCALE, e);
      o.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      o.el.style.opacity = "1";
      if (now - lastTrail > 25) { spawnTrailMote(consumedLayer, x, y, sc, true); lastTrail = now; }
      if (t < 1) requestAnimationFrame(p2);
      else resolve();
    }
    requestAnimationFrame(p2);
  });

  // Transition: restore level class; L1 goes behind avatar, L2/L3 stay in front.
  o.el.classList.remove("consumed");
  o.el.classList.add(`level-${orbLevel}`);
  (orbLevel === 1 ? ringLayer : consumedLayer).appendChild(o.el);
  o.currentX = targetX;
  o.currentY = targetY;
  o.orbitOffset = targetRelOffset;
  o.frozen = false;
  targetLevelOrbs.push(o);
  ringPaused = false;
}

// ─── EOD absorption ───────────────────────────────────────────────────────────

function flyToFromPixel(orbObj, container, fromX, fromY, clientX, clientY, ms, baseScale) {
  return new Promise((resolve) => {
    orbObj.frozen = true;
    const rect = rectOf(container);
    const endX = clientX - rect.left;
    const endY = clientY - rect.top;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / ms);
      const e = easeOut(t);
      const x = lerp(fromX, endX, e);
      const y = lerp(fromY, endY, e);
      const sc = baseScale * (1 - 0.8 * e);
      orbObj.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      orbObj.el.style.opacity = String(1 - 0.6 * e);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

export async function absorbAllToAvatar(stagger = 90) {
  const ac = centerOfEl("avatar-container");

  const allRing = [...level1RingOrbs, ...level2RingOrbs, ...level3RingOrbs];
  level1RingOrbs = [];
  level2RingOrbs = [];
  level3RingOrbs = [];
  for (const o of allRing) {
    flyToFromPixel(o, ringLayer, o.currentX, o.currentY, ac.x, ac.y, 700, RING_BASE_SCALE)
      .then(() => o.el.remove());
    await delay(stagger);
  }

  const consumed = consumedOrbs.slice();
  consumedOrbs = [];
  const cRect = rectOf(consumedLayer);
  for (const o of consumed) {
    const fx = o.pos.x * cRect.width;
    const fy = o.pos.y * cRect.height;
    flyToFromPixel(o, consumedLayer, fx, fy, ac.x, ac.y, 700, 0.6 + o.pos.z * 0.75)
      .then(() => o.el.remove());
    await delay(stagger);
  }

  // Spent orbs disappear without animation.
  spentOrbs.forEach((o) => o.el.remove());
  spentOrbs = [];

  await delay(750);
}
