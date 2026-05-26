// Entry point. Boots Firebase auth, routes to auth / onboarding / main, and
// wires all subsystems together.

import { state, defaultUserData } from "./state.js";
import { onAuth, login, signup, isTestAccount } from "./auth.js";
import * as db from "./db.js";
import * as eod from "./eod.js";
import * as orbs from "./orbs.js";
import * as coins from "./coins.js";
import { setAvatarState } from "./avatar.js";
import { showScreen, showToast } from "./ui.js";
import { initOnboarding, showOnboarding } from "./onboarding.js";
import { initMenu } from "./menu.js";
import { initActionButton, refreshActionButtonState, resetDailyWarning } from "./game.js";
import { initWindowButton, startWindowClock } from "./window.js";
import { renderTestToolbar, TEST_SEED } from "./test-mode.js";
import { isoDate } from "./util.js";

// ---------------- Auth screen ----------------
let authMode = "login"; // or "signup"

function initAuthScreen() {
  const title = document.getElementById("auth-title");
  const submit = document.getElementById("auth-submit");
  const toggleText = document.getElementById("auth-toggle-text");
  const toggleBtn = document.getElementById("auth-toggle-btn");
  const errEl = document.getElementById("auth-error");

  function applyMode() {
    if (authMode === "login") {
      title.textContent = "ENTER";
      submit.textContent = "SIGN IN";
      toggleText.textContent = "No account?";
      toggleBtn.textContent = "Create one";
    } else {
      title.textContent = "NEW";
      submit.textContent = "CREATE";
      toggleText.textContent = "Have an account?";
      toggleBtn.textContent = "Sign in";
    }
    errEl.textContent = "";
  }

  toggleBtn.addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    applyMode();
  });

  submit.addEventListener("click", async () => {
    const username = document.getElementById("auth-username").value;
    const password = document.getElementById("auth-password").value;
    if (!username.trim() || !password) {
      errEl.textContent = "Enter username and password.";
      return;
    }
    errEl.textContent = "";
    submit.disabled = true;
    try {
      if (authMode === "login") await login(username, password);
      else await signup(username, password);
      // onAuth handles the rest
    } catch (e) {
      errEl.textContent = friendlyAuthError(e);
    } finally {
      submit.disabled = false;
    }
  });

  applyMode();
}

function friendlyAuthError(e) {
  const code = e && e.code ? e.code : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return "Wrong username or password.";
  if (code.includes("user-not-found")) return "No such account.";
  if (code.includes("email-already-in-use")) return "Username taken.";
  if (code.includes("weak-password")) return "Password too short (min 6).";
  if (code.includes("network")) return "Network error. Try again.";
  return "Something went wrong.";
}

// ---------------- Offline detection ----------------
function initConnectivity() {
  const apply = () => {
    state.isOnline = navigator.onLine;
    refreshActionButtonState();
  };
  window.addEventListener("online", apply);
  window.addEventListener("offline", apply);
  state.isOnline = navigator.onLine;
}

// ---------------- Boot ----------------
async function boot(user) {
  state.uid = user.uid;
  showScreen("boot");

  let userData = await db.getUserData(user.uid);

  if (!userData) {
    if (isTestAccount()) {
      // Test account bypasses onboarding with seeded defaults (PRD 17).
      userData = defaultUserData({
        ...TEST_SEED,
        baselineValue: TEST_SEED.onboardingEstimate,
        currentDate: isoDate(),
        onboardingComplete: true,
      });
      await db.saveUserData(user.uid, userData);
    } else {
      showOnboarding();
      return;
    }
  }

  state.userData = userData;
  await startApp();
}

async function startApp() {
  const u = state.userData;

  // Safety: ensure an in-progress date exists.
  if (!u.currentDate) u.currentDate = isoDate();

  // Restore in-progress counts.
  state.count = u.currentCount || 0;

  await eod.loadDaysCache();

  // Silent catch-up for any missed days (PRD 7.1). May reset currentCount.
  const missed = await eod.checkMissedEODs();
  if (missed > 0) {
    state.count = state.userData.currentCount || 0;
  }

  showScreen("main");
  resetDailyWarning();
  startWindowClock();
  refreshActionButtonState();

  orbs.startLoop();
  restoreRoom();

  if (isTestAccount()) renderTestToolbar();
}

// Rebuild the room to reflect the current in-progress day's progress.
function restoreRoom() {
  const u = state.userData;
  const ringCount = Math.max(0, u.dailyMax - state.count);
  const consumedCount = Math.min(state.count, u.dailyMax);
  orbs.spawnRingOrbs(ringCount, u.dailyMax);
  orbs.spawnConsumedOrbs(consumedCount);
  setAvatarState(u.currentState, false);
  coins.updateBagDisplay();
}

// ---------------- Wire up ----------------
function init() {
  initAuthScreen();
  initOnboarding(() => startApp());
  initMenu();
  initActionButton();
  initWindowButton();
  initConnectivity();

  onAuth((user) => {
    if (user) {
      boot(user).catch((e) => {
        console.error("boot failed", e);
        showToast("Failed to load. Check Firebase config.");
      });
    } else {
      showScreen("auth");
    }
  });
}

init();
