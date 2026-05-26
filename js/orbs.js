// Orb system (PRD section 10 + 19). Normal orbs drift dreamily through the
// room with z-depth scaling and emit particle motes. Debt orbs are red-tinted
// and drift in a constrained zone near the avatar. DOM-based (few elements).

import { lerp, randRange, randInt } from "./util.js";

const ORB_SRC = "ImageUpload/Orb.png";
const DRIFT = 0.012; // lerp factor per frame for idle drift
const ARRIVE = 0.6; // fraction of orb size considered "arrived"

let layer; // normal orb container
let debtZone; // debt orb container
let normalOrbs = [];
let debtOrbs = [];
let rafId = null;
let lastTime = 0;

function rand2D() {
  // positions as fraction of layer (0..1) with margin so orbs stay visible
  return { x: randRange(0.12, 0.88), y: randRange(0.08, 0.62), z: randRange(0, 1) };
}

function makeOrbEl(isDebt) {
  const orb = document.createElement("div");
  orb.className = isDebt ? "orb debt" : "orb";
  const img = document.createElement("img");
  img.src = ORB_SRC;
  img.alt = "";
  orb.appendChild(img);
  // motes
  const moteCount = randInt(3, 5);
  const motes = [];
  for (let i = 0; i < moteCount; i++) {
    const m = document.createElement("div");
    m.className = "mote";
    orb.appendChild(m);
    motes.push({ el: m, phase: Math.random(), speed: randRange(0.4, 0.9) });
  }
  return { orb, motes };
}

function rectOf(container) {
  return container.getBoundingClientRect();
}

function applyTransform(orbObj, rect) {
  const px = orbObj.pos.x * rect.width;
  const py = orbObj.pos.y * rect.height;
  // z 0 (far) -> 0.6 scale, z 1 (near) -> 1.35 scale
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
    // drift up + slight outward, fade out toward the top
    const up = -t * 36;
    const out = Math.sin(t * Math.PI * 2) * 10;
    m.el.style.transform = `translate(${out}px, ${up}px) scale(${1 - t * 0.5})`;
    m.el.style.opacity = String(Math.sin(t * Math.PI) * 0.9);
  });
}

function tick(now) {
  if (!lastTime) lastTime = now;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const layerRect = rectOf(layer);
  const debtRect = rectOf(debtZone);

  normalOrbs.forEach((o) => {
    if (o.frozen) return;
    o.pos.x = lerp(o.pos.x, o.target.x, DRIFT);
    o.pos.y = lerp(o.pos.y, o.target.y, DRIFT);
    o.pos.z = lerp(o.pos.z, o.target.z, DRIFT);
    const dx = Math.abs(o.pos.x - o.target.x);
    const dy = Math.abs(o.pos.y - o.target.y);
    if (dx < 0.01 && dy < 0.01) o.target = rand2D();
    applyTransform(o, layerRect);
    updateMotes(o, dt);
  });

  debtOrbs.forEach((o) => {
    if (o.frozen) return;
    o.pos.x = lerp(o.pos.x, o.target.x, DRIFT * 1.4);
    o.pos.y = lerp(o.pos.y, o.target.y, DRIFT * 1.4);
    const dx = Math.abs(o.pos.x - o.target.x);
    const dy = Math.abs(o.pos.y - o.target.y);
    if (dx < 0.02 && dy < 0.02) {
      o.target = { x: randRange(0.2, 0.8), y: randRange(0.2, 0.8), z: 0.6 };
    }
    applyTransform(o, debtRect);
    updateMotes(o, dt);
  });

  rafId = requestAnimationFrame(tick);
}

export function startLoop() {
  layer = document.getElementById("orb-layer");
  debtZone = document.getElementById("debt-orb-zone");
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
  normalOrbs.forEach((o) => o.el.remove());
  debtOrbs.forEach((o) => o.el.remove());
  normalOrbs = [];
  debtOrbs = [];
}

function addNormalOrb(pos) {
  const { orb, motes } = makeOrbEl(false);
  layer.appendChild(orb);
  const o = { el: orb, motes, pos, target: rand2D(), frozen: false };
  applyTransform(o, rectOf(layer));
  normalOrbs.push(o);
  return o;
}

function addDebtOrb() {
  const { orb, motes } = makeOrbEl(true);
  debtZone.appendChild(orb);
  const pos = { x: randRange(0.25, 0.75), y: randRange(0.3, 0.7), z: 0.6 };
  const o = {
    el: orb,
    motes,
    pos,
    target: { x: randRange(0.2, 0.8), y: randRange(0.2, 0.8), z: 0.6 },
    frozen: false,
  };
  applyTransform(o, rectOf(debtZone));
  debtOrbs.push(o);
  return o;
}

// Spawn `count` fresh normal orbs (clears existing first).
export function spawnOrbs(count) {
  clearAll();
  for (let i = 0; i < count; i++) addNormalOrb(rand2D());
}

export function normalOrbCount() {
  return normalOrbs.length;
}
export function debtOrbCount() {
  return debtOrbs.length;
}

const NEAR_SCALE = 1.35; // z=1 scale (closest to screen)

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeIn(t)  { return t * t * t; }

function spawnTrailMote(container, x, y, scale) {
  const m = document.createElement("div");
  m.className = "trail-mote";
  m.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
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

function centerOf(elId) {
  const r = document.getElementById(elId).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Helper: animate an orb element flying to a target client point (plain fly, no zoom-in).
function flyTo(orbObj, container, clientX, clientY, { shrink = true, ms = 600 }) {
  return new Promise((resolve) => {
    orbObj.frozen = true;
    const rect = rectOf(container);
    const startX = orbObj.pos.x * rect.width;
    const startY = orbObj.pos.y * rect.height;
    const endX = clientX - rect.left;
    const endY = clientY - rect.top;
    const start = performance.now();
    const baseScale = 0.6 + orbObj.pos.z * 0.75;

    function step(now) {
      const t = Math.min(1, (now - start) / ms);
      const e = easeOut(t);
      const x = lerp(startX, endX, e);
      const y = lerp(startY, endY, e);
      const sc = shrink ? baseScale * (1 - 0.8 * e) : baseScale;
      orbObj.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      orbObj.el.style.opacity = String(1 - 0.6 * e);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

// Single tap: absorb — phase 1: come closer (0.75s ease-out), phase 2: fly to button (0.35s ease-in).
export async function absorbOneToButton() {
  if (normalOrbs.length === 0) return;
  const idx = randInt(0, normalOrbs.length - 1);
  const o = normalOrbs.splice(idx, 1)[0];
  o.frozen = true;

  const rect = rectOf(layer);
  const sx = o.pos.x * rect.width;
  const sy = o.pos.y * rect.height;
  const baseScale = 0.6 + o.pos.z * 0.75;

  // Phase 1: zoom toward screen (scale baseScale → NEAR_SCALE), 750ms ease-out
  await new Promise((resolve) => {
    const t0 = performance.now();
    function p1(now) {
      const t = Math.min(1, (now - t0) / 750);
      const e = easeOut(t);
      const sc = lerp(baseScale, NEAR_SCALE, e);
      o.el.style.transform = `translate(${sx}px, ${sy}px) scale(${sc})`;
      o.el.style.opacity = "1";
      if (t < 1) requestAnimationFrame(p1); else resolve();
    }
    requestAnimationFrame(p1);
  });

  // Phase 2: fly to button and vanish, 350ms ease-in
  const c = centerOf("action-btn");
  const ex = c.x - rect.left;
  const ey = c.y - rect.top;
  await new Promise((resolve) => {
    const t0 = performance.now();
    let lastTrail = 0;
    function p2(now) {
      const t = Math.min(1, (now - t0) / 350);
      const e = easeIn(t);
      const x = lerp(sx, ex, e);
      const y = lerp(sy, ey, e);
      const sc = lerp(NEAR_SCALE, 0, e);
      o.el.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
      o.el.style.opacity = String(1 - e);
      if (now - lastTrail > 25) {
        spawnTrailMote(layer, x, y, Math.max(0.05, sc));
        lastTrail = now;
      }
      if (t < 1) requestAnimationFrame(p2); else resolve();
    }
    requestAnimationFrame(p2);
  });
  o.el.remove();
}

// Long-press release — phase 1: appear at button and come closer (0.75s ease-out),
// phase 2: fly to a random room position (0.35s ease-in), then drift freely.
export function releaseNormalOrb() {
  const btn = centerOf("action-btn");
  const rect = rectOf(layer);
  const sx = btn.x - rect.left;
  const sy = btn.y - rect.top;
  const startPos = { x: sx / rect.width, y: sy / rect.height, z: 0.1 };
  const o = addNormalOrb(startPos);
  o.frozen = true;
  o.el.style.opacity = "0";

  const startScale = 0.6 + 0.1 * 0.75; // z=0.1 → 0.675

  // Phase 1: zoom toward screen, 750ms ease-out
  const t0 = performance.now();
  function p1(now) {
    const t = Math.min(1, (now - t0) / 750);
    const e = easeOut(t);
    const sc = lerp(startScale, NEAR_SCALE, e);
    o.el.style.transform = `translate(${sx}px, ${sy}px) scale(${sc})`;
    o.el.style.opacity = String(e);
    if (t < 1) {
      requestAnimationFrame(p1);
    } else {
      // Phase 2: fly to random destination, 350ms ease-in
      const dest = rand2D();
      const ex = dest.x * rect.width;
      const ey = dest.y * rect.height;
      const destScale = 0.6 + dest.z * 0.75;
      const t1 = performance.now();
      let lastTrail = 0;
      function p2(now2) {
        const t2 = Math.min(1, (now2 - t1) / 350);
        const e2 = easeIn(t2);
        const x = lerp(sx, ex, e2);
        const y = lerp(sy, ey, e2);
        const sc2 = lerp(NEAR_SCALE, destScale, e2);
        o.el.style.transform = `translate(${x}px, ${y}px) scale(${sc2})`;
        o.el.style.opacity = "1";
        if (now2 - lastTrail > 25) {
          spawnTrailMote(layer, x, y, sc2);
          lastTrail = now2;
        }
        if (t2 < 1) {
          requestAnimationFrame(p2);
        } else {
          o.pos = dest;
          o.frozen = false;
        }
      }
      requestAnimationFrame(p2);
    }
  }
  requestAnimationFrame(p1);
}

// Long-press release with debt present: dissolve one debt orb.
export async function releaseDebtOrb() {
  if (debtOrbs.length === 0) return false;
  const o = debtOrbs.pop();
  o.frozen = true;
  const start = performance.now();
  await new Promise((resolve) => {
    function step(now) {
      const t = Math.min(1, (now - start) / 500);
      o.el.style.opacity = String(1 - t);
      o.el.style.transform += "";
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
  o.el.remove();
  return true;
}

// Over-limit: spawn a new debt orb near the avatar (fade-in).
export function spawnDebtOrb() {
  const o = addDebtOrb();
  o.el.style.opacity = "0";
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / 400);
    o.el.style.opacity = String(t);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// EOD: staggered absorb of all remaining normal then debt orbs into avatar.
export async function absorbAllToAvatar(stagger = 90) {
  const avatar = centerOf("avatar-container");
  // normal orbs first
  const normals = normalOrbs.slice();
  normalOrbs = [];
  for (const o of normals) {
    flyTo(o, layer, avatar.x, avatar.y, { shrink: true, ms: 700 }).then(() =>
      o.el.remove()
    );
    await delay(stagger);
  }
  // then debt orbs
  const debts = debtOrbs.slice();
  debtOrbs = [];
  for (const o of debts) {
    flyTo(o, debtZone, avatar.x, avatar.y, { shrink: true, ms: 700 }).then(() =>
      o.el.remove()
    );
    await delay(stagger);
  }
  await delay(750);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
