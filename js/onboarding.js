// One-time onboarding (PRD section 5). Date confirmed once here; automatic
// thereafter.

import { state, defaultUserData } from "./state.js";
import { saveUserData } from "./db.js";
import { showScreen } from "./ui.js";
import { isoDate } from "./util.js";

let onComplete = null;

export function initOnboarding(completeCb) {
  onComplete = completeCb;
  document.getElementById("ob-date").value = isoDate();
  document.getElementById("ob-submit").addEventListener("click", submit);
}

export function showOnboarding() {
  document.getElementById("ob-date").value = isoDate();
  showScreen("onboarding");
}

async function submit() {
  const habit = document.getElementById("ob-habit").value.trim();
  const cost = parseInt(document.getElementById("ob-cost").value, 10);
  const estimate = parseInt(document.getElementById("ob-estimate").value, 10);
  const name = document.getElementById("ob-name").value.trim();
  const date = document.getElementById("ob-date").value || isoDate();
  const errEl = document.getElementById("ob-error");

  if (!habit) return (errEl.textContent = "Enter a habit name.");
  if (!Number.isFinite(cost) || cost < 0) return (errEl.textContent = "Invalid cost.");
  if (!Number.isFinite(estimate) || estimate < 0)
    return (errEl.textContent = "Enter a daily estimate.");
  if (!name) return (errEl.textContent = "Enter your name.");
  errEl.textContent = "";

  const data = defaultUserData({
    displayName: name,
    habitName: habit,
    costPerInstance: cost,
    onboardingEstimate: estimate,
    dailyMax: Math.max(1, estimate),
    baselineValue: estimate,
    currentDate: date,
    currentDay: 1,
    onboardingComplete: true,
  });

  state.userData = data;
  await saveUserData(state.uid, data);
  if (onComplete) onComplete();
}
