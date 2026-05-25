// Avatar states (PRD section 14). 9 states mapped from rolling-average vs
// baseline. Cross-fade between two stacked <img> layers.

import { clamp } from "./util.js";

const STATE_SRC = {
  4: "ImageUpload/Avater_Thriving_4.png",
  3: "ImageUpload/Avater_Thriving_3.png",
  2: "ImageUpload/Avater_Thriving_2.png",
  1: "ImageUpload/Avater_Thriving_1.png",
  0: "ImageUpload/Avater_Baseline.png",
  "-1": "ImageUpload/Avatar_Struggling_1.png",
  "-2": "ImageUpload/Avatar_Struggling_2.png",
  "-3": "ImageUpload/Avatar_Struggling_3.png",
  "-4": "ImageUpload/Avatar_Struggling_4.png",
};

let frontIsA = true;

// Given rolling 3-day average and baseline, return target state -4..+4.
// Negative percent = below baseline (good, thriving). Positive = above (bad).
export function evaluateState(rollingAvg, baseline) {
  if (!baseline || baseline <= 0) return 0;
  const pct = ((rollingAvg - baseline) / baseline) * 100;
  if (pct <= -40) return 4;
  if (pct <= -25) return 3;
  if (pct <= -15) return 2;
  if (pct <= -10) return 1;
  if (pct < 10) return 0; // within +/-9%
  if (pct < 15) return -1;
  if (pct < 25) return -2;
  if (pct < 40) return -3;
  return -4;
}

// Limit movement to maxStep levels from the current state.
export function applyMovementCap(current, target, maxStep) {
  const delta = clamp(target - current, -maxStep, maxStep);
  return clamp(current + delta, -4, 4);
}

// Cross-fade the avatar to the given state (no-op if already showing it).
export function setAvatarState(stateNum, animate = true) {
  const src = STATE_SRC[String(stateNum)] || STATE_SRC[0];
  const a = document.getElementById("avatar-a");
  const b = document.getElementById("avatar-b");
  const front = frontIsA ? a : b;
  const back = frontIsA ? b : a;

  if (front.getAttribute("src") === src) return;

  back.src = src;
  if (!animate) {
    back.style.transition = "none";
    requestAnimationFrame(() => (back.style.transition = ""));
  }
  back.classList.add("active");
  front.classList.remove("active");
  frontIsA = !frontIsA;
}

// Single white/red blink, no state change (over-limit + intra-day warning).
export function flashAvatar() {
  const f = document.getElementById("avatar-flash");
  f.classList.remove("flash");
  void f.offsetWidth;
  f.classList.add("flash");
}
