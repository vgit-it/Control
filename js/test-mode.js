// Test toolbar (PRD section 17). Rendered only for the Test account.

import { state, defaultUserData } from "./state.js";
import { saveUserData, resetAllData } from "./db.js";
import * as eod from "./eod.js";
import * as orbs from "./orbs.js";
import { setAvatarState } from "./avatar.js";
import { updateBagDisplay, evaluateBagTier, setBagTier } from "./coins.js";
import { refreshActionButtonState } from "./game.js";
import { showToast, el } from "./ui.js";
import { clamp } from "./util.js";

export const TEST_SEED = {
  habitName: "TestHabit",
  costPerInstance: 24,
  onboardingEstimate: 20,
  dailyMax: 20,
  displayName: "Test",
};

async function persist() {
  await saveUserData(state.uid, state.userData);
}

function btn(label, handler) {
  const b = el("button", "test-btn", label);
  b.onclick = handler;
  return b;
}

export function renderTestToolbar() {
  const root = document.getElementById("test-toolbar");
  root.classList.add("visible");
  root.innerHTML = "";

  const head = el("div", "test-head", "TEST TOOLBAR ▾");
  const body = el("div", "test-body");
  head.onclick = () => {
    body.classList.toggle("open");
    head.textContent = body.classList.contains("open")
      ? "TEST TOOLBAR ▴"
      : "TEST TOOLBAR ▾";
  };

  body.appendChild(btn("+1 Day", async () => { await eod.advanceOneDay(); showToast("Advanced 1 day"); }));
  body.appendChild(btn("Force EOD", async () => { await eod.runManualEOD(); }));

  body.appendChild(btn("Add 10 coins", async () => {
    state.userData.lifetimeCoins += 10;
    state.userData.bagTier = evaluateBagTier(state.userData.lifetimeCoins);
    updateBagDisplay();
    await persist();
  }));
  body.appendChild(btn("Remove 10 coins", async () => {
    state.userData.lifetimeCoins -= 10;
    state.userData.bagTier = evaluateBagTier(state.userData.lifetimeCoins);
    updateBagDisplay();
    await persist();
  }));

  body.appendChild(btn("Bag upgrade", async () => {
    state.userData.bagTier = clamp(state.userData.bagTier + 1, 1, 5);
    setBagTier(state.userData.bagTier, true);
    await persist();
  }));
  body.appendChild(btn("Bag downgrade", async () => {
    state.userData.bagTier = clamp(state.userData.bagTier - 1, 1, 5);
    setBagTier(state.userData.bagTier, true);
    await persist();
  }));

  body.appendChild(btn("Spawn debt orb", () => {
    orbs.spawnDebtOrb();
    state.debtOrbs += 1;
  }));
  body.appendChild(btn("Simulate missed day", async () => {
    await eod.simulateMissedDay();
    showToast("Missed day simulated");
  }));

  body.appendChild(btn("Skip baseline", async () => {
    const u = state.userData;
    u.baselineLocked = true;
    u.baselinePhaseComplete = true;
    u.baselineValue = Math.max(1, u.onboardingEstimate);
    await persist();
    showToast("Baseline skipped");
  }));

  body.appendChild(btn("Toggle offline", () => {
    state.offlineSim = !state.offlineSim;
    refreshActionButtonState();
    showToast(state.offlineSim ? "Offline (sim)" : "Online");
  }));

  // Set daily max
  const maxField = el("div", "test-field full");
  const maxInput = document.createElement("input");
  maxInput.type = "number";
  maxInput.placeholder = "daily max";
  maxInput.value = state.userData.dailyMax;
  const maxBtn = btn("Set max", async () => {
    const v = Math.max(1, parseInt(maxInput.value, 10) || 1);
    state.userData.dailyMax = v;
    await persist();
    showToast(`Daily max = ${v}`);
  });
  maxField.appendChild(maxInput);
  maxField.appendChild(maxBtn);
  body.appendChild(maxField);

  // Set state -4..+4
  const stateRow = el("div", "test-state-row");
  for (let s = -4; s <= 4; s++) {
    const label = s > 0 ? `+${s}` : `${s}`;
    stateRow.appendChild(
      btn(label, async () => {
        state.userData.currentState = s;
        setAvatarState(s, true);
        await persist();
      })
    );
  }
  body.appendChild(stateRow);

  // Reset test data
  const resetField = el("div", "test-field full");
  resetField.appendChild(
    btn("Reset test data (re-seed)", async () => {
      await resetAllData(state.uid);
      window.location.reload();
    })
  );
  body.appendChild(resetField);

  root.appendChild(head);
  root.appendChild(body);
}
