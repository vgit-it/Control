// Core in-day interaction (PRD section 9): the action button tap, long-press
// release, over-limit debt orbs, and the intra-day warning blink.

import { state, effectivelyOffline } from "./state.js";
import * as orbs from "./orbs.js";
import { flashAvatar } from "./avatar.js";
import { saveUserData } from "./db.js";
import { showToast } from "./ui.js";
import { lastNonMissedCount } from "./eod.js";

const LONG_PRESS_MS = 500;

let longPressTimer = null;
let warnedToday = false;
let saveTimer = null;

export function resetDailyWarning() {
  warnedToday = false;
}

// Debounced persistence of the in-progress count (so a same-day reopen restores).
function persistProgress() {
  state.userData.currentCount = state.count;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveUserData(state.uid, {
      currentCount: state.userData.currentCount,
    }).catch((e) => console.error("persist progress failed", e));
  }, 800);
}

function intraDayWarning() {
  if (warnedToday) return;
  const u = state.userData;
  let limit;
  if (u.baselinePhaseComplete) {
    const prev = lastNonMissedCount();
    limit = prev == null ? Infinity : prev;
  } else {
    limit = u.onboardingEstimate || Infinity;
  }
  if (state.count > limit) {
    flashAvatar();
    warnedToday = true;
  }
}

function onTap() {
  if (effectivelyOffline()) {
    showToast("You're offline");
    return;
  }
  state.count += 1;
  if (orbs.ringOrbCount() > 0) orbs.consumeOneOrb();
  intraDayWarning();
  persistProgress();
}

async function onRelease() {
  hideReleaseButton();
  if (state.count <= 0) return;
  orbs.releaseOneConsumedOrb();
  state.count -= 1;
  persistProgress();
}

function showReleaseButton() {
  if (state.count <= 0) return; // hidden if count = 0
  document.getElementById("release-btn").classList.add("show");
}
function hideReleaseButton() {
  document.getElementById("release-btn").classList.remove("show");
}

function pressVisual(down) {
  const img = document.getElementById("action-img");
  const btn = document.getElementById("action-btn");
  img.src = down ? "ImageUpload/Button_Pressed.png" : "ImageUpload/Button_Idle.png";
  btn.classList.toggle("idle", !down);
}

export function initActionButton() {
  const btn = document.getElementById("action-btn");
  const releaseBtn = document.getElementById("release-btn");
  btn.classList.add("idle");

  let didLongPress = false;

  const start = (e) => {
    e.preventDefault();
    if (effectivelyOffline()) return;
    didLongPress = false;
    pressVisual(true);
    longPressTimer = setTimeout(() => {
      didLongPress = true;
      showReleaseButton();
    }, LONG_PRESS_MS);
  };

  const end = (e) => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    pressVisual(false);
    if (!didLongPress) onTap();
  };

  const cancel = () => {
    clearTimeout(longPressTimer);
    pressVisual(false);
  };

  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointerleave", cancel);
  btn.addEventListener("pointercancel", cancel);

  releaseBtn.addEventListener("click", onRelease);

  // tapping elsewhere dismisses the release button
  document.getElementById("screen-main").addEventListener("pointerdown", (e) => {
    if (e.target !== releaseBtn && e.target !== btn && !btn.contains(e.target)) {
      hideReleaseButton();
    }
  });
}

// Reflect offline state on the button.
export function refreshActionButtonState() {
  const btn = document.getElementById("action-btn");
  const img = document.getElementById("action-img");
  if (effectivelyOffline()) {
    btn.classList.add("disabled");
    btn.classList.remove("idle");
    img.src = "ImageUpload/Button_Disabled.png";
  } else {
    btn.classList.remove("disabled");
    btn.classList.add("idle");
    img.src = "ImageUpload/Button_Idle.png";
  }
}
