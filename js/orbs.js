// Orb system redesign.
// Ring orbs (golden): orbit a circular path behind the avatar in #orb-layer (z-index 8).
// Consumed orbs (purple): free-float in front of the avatar in #consumed-orb-layer (z-index 22).
// Tap: one ring orb → consumed. Long-press release: one random consumed orb → ring.

import { lerp, randRange, randInt } from "./util.js";

const ORB_SRC = "ImageUpload/Orb.png";
const DRIFT = 0.012;           // lerp factor for consumed orb idle drift
const RING_SPEED = 0.25;       // radians/second (~25 s per full orbit)
const RING_BASE_SCALE = 0.55;  // ring orbs appear smaller (at background depth)
const NEAR_SCALE = 1.35;       // zoom-toward-screen peak scale

let ringLayer;       // #orb-layer, z-index 8  — ring orbs live here
let consumedLayer;   // #consumed-orb-layer, z-index 22 — consumed orbs live here
let ringOrbs = [];
let consumedOrbs = [];
let ringAngle = 0;
let ringPaused = false; // suspend orbit during consume/release transitions
let rafId = null;
let lastTime = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand2D() {
  return { x: randRange(0.12, 0.88), y: randRange(0.08, 0.62), z: randRange(0, 1) };
}

function rectOf(container) {
  return container.getBoundingClientRect();
}

// Circle center at 2/3 height of avatar, radius = half avatar width.
function getCircleParams() {
  const layerRect = rectOf(ringLayer);
  const av = document.getElementById("avatar-container").getBoundingClientRect();
  return {
    cx: av.left + av.width / 2 - layerRect.left,
    cy: av.top + av.height * (2 / 3) - layerRect.top,
    radius: av.width / 2,
  };
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

function tick(now) {
  if (!lastTime) lastTime = now;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (ringOrbs.length > 0) {
    if (!ringPaused) ringAngle += RING_SPEED * dt;
    const { cx, cy, radius } = getCircleParams();
    const n = ringOrbs.length;
    ringOrbs.forEach((o, i) => {
      if (o.frozen) return;
      const angle = ringAngle + i * ((2 * Math.PI) / n);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      o.currentX = x;
      o.currentY = y;
      o.el.style.transform = `translate(${x}px, ${y}px) scale(${RING_BASE_SCALE})`;
      o.el.style.opacity = "0.85";
      updateMotes(o, dt);
    });
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
  ringOrbs.forEach((o) => o.el.remove());
  consumedOrbs.forEach((o) => o.el.remove());
  ringOrbs = [];
  consumedOrbs = [];
}

export function ringOrbCount()     { return ringOrbs.length; }
export function consumedOrbCount() { return consumedOrbs.length; }

// ─── Spawning ─────────────────────────────────────────────────────────────────

function addRingOrb() {
  const { orb, motes } = makeOrbEl(); // plain .orb — golden filter
  ringLayer.appendChild(orb);
  const o = { el: orb, motes, currentX: 0, currentY: 0, frozen: false };
  ringOrbs.push(o);
  return o;
}

function addConsumedOrb(pos) {
  const { orb, motes } = makeOrbEl("consumed"); // .orb.consumed — purple filter
  consumedLayer.appendChild(orb);
  const o = { el: orb, motes, pos, target: rand2D(), frozen: false };
  applyTransformConsumed(o, rectOf(consumedLayer));
  consumedOrbs.push(o);
  return o;
}

// Clears everything, spawns count golden ring orbs.
export function spawnRingOrbs(count) {
  clearAll();
  for (let i = 0; i < count; i++) addRingOrb();
}

// Spawns count consumed (purple) orbs at random positions (session restore).
export function spawnConsumedOrbs(count) {
  for (let i = 0; i < count; i++) addConsumedOrb(rand2D());
}

// ─── Consume (tap) ────────────────────────────────────────────────────────────
// Ring orb → consumed: zoom toward screen, fly to random free-float spot, turn purple.

export async function consumeOneOrb() {
  if (ringOrbs.length === 0) return;
  ringPaused = true;
  const o = ringOrbs.pop();
  o.frozen = true;

  const sx = o.currentX;
  const sy = o.currentY;

  // Phase 1: zoom toward screen, 750ms ease-out
  await new Promise((resolve) => {
    const t0 = performance.now();
    function p1(now) {
      const t = Math.min(1, (now - t0) / 750);
      const e = easeOut(t);
      const sc = lerp(RING_BASE_SCALE, NEAR_SCALE, e);
      o.el.style.transform = `translate(${sx}px, ${sy}px) scale(${sc})`;
      o.el.style.opacity = "1";
      if (t < 1) requestAnimationFrame(p1);
      else resolve();
    }
    requestAnimationFrame(p1);
  });

  // Phase 2: fly to random free-float destination, 350ms ease-in + golden trail
  const dest = rand2D();
  const layerRect = rectOf(ringLayer); // same coord space as consumedLayer
  const ex = dest.x * layerRect.width;
  const ey = dest.y * layerRect.height;
  const destScale = 0.6 + dest.z * 0.75;

  await new Promise((resolve) => {
    const t0 = performance.now();
    let lastTrail = 0;
    function p2(now) {
      const t = Math.min(1, (now - t0) / 350);
      const e = easeIn(t);
      const x = lerp(sx, ex, e);
      const y = lerp(sy, ey, e);
      const sc = lerp(NEAR_SCALE, destScale, e);
      o.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      o.el.style.opacity = "1";
      if (now - lastTrail > 25) { spawnTrailMote(ringLayer, x, y, sc); lastTrail = now; }
      if (t < 1) requestAnimationFrame(p2);
      else resolve();
    }
    requestAnimationFrame(p2);
  });

  // Transition: switch to consumed layer and class (same coord system — no offset needed)
  o.el.classList.add("consumed");
  consumedLayer.appendChild(o.el);
  o.pos = { ...dest };
  o.target = rand2D();
  o.frozen = false;
  consumedOrbs.push(o);
  ringPaused = false;
}

// ─── Release (long-press) ─────────────────────────────────────────────────────
// Random consumed orb → ring: zoom toward screen, fly to ring position, turn golden.

export async function releaseOneConsumedOrb() {
  if (consumedOrbs.length === 0) return;
  ringPaused = true;
  const idx = randInt(0, consumedOrbs.length - 1);
  const o = consumedOrbs.splice(idx, 1)[0];
  o.frozen = true;

  const consumedRect = rectOf(consumedLayer);
  const sx = o.pos.x * consumedRect.width;
  const sy = o.pos.y * consumedRect.height;
  const baseScale = 0.6 + o.pos.z * 0.75;

  // Compute the ring position this orb will occupy when it joins
  const { cx, cy, radius } = getCircleParams();
  const newCount = ringOrbs.length + 1;
  const targetAngle = ringAngle + ringOrbs.length * ((2 * Math.PI) / newCount);
  const targetX = cx + radius * Math.cos(targetAngle);
  const targetY = cy + radius * Math.sin(targetAngle);

  // Phase 1: zoom toward screen, 750ms ease-out
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

  // Phase 2: fly to ring position, 350ms ease-in + purple trail
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

  // Transition: switch to ring layer and remove consumed class
  o.el.classList.remove("consumed");
  ringLayer.appendChild(o.el);
  o.currentX = targetX;
  o.currentY = targetY;
  o.frozen = false;
  ringOrbs.push(o);
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

  const rings = ringOrbs.slice();
  ringOrbs = [];
  for (const o of rings) {
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

  await delay(750);
}
