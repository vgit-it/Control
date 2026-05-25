// End-of-day orchestration (PRD section 7). Handles the animated manual EOD,
// silent missed-day catch-up, and "begin new day". A module-level cache of all
// day records is kept so baseline/recalibration math stays consistent across a
// multi-day catch-up without repeated reads.

import { state, threshold } from "./state.js";
import * as db from "./db.js";
import * as orbs from "./orbs.js";
import * as coins from "./coins.js";
import {
  evaluateState,
  applyMovementCap,
  setAvatarState,
} from "./avatar.js";
import { checkBaselineLock, checkDrift, rollingAverage, getCurrentBaseline } from "./baseline.js";
import { checkRecalibration } from "./recalibration.js";
import { isoDate, addDays } from "./util.js";

let daysCache = []; // all day records, oldest -> newest

export async function loadDaysCache() {
  daysCache = await db.getAllDays(state.uid);
}

// Count of the most recent non-missed day (for the post-baseline intra-day
// warning). Returns null if there are no non-missed days yet.
export function lastNonMissedCount() {
  for (let i = daysCache.length - 1; i >= 0; i--) {
    if (!daysCache[i].isMissed) return daysCache[i].count;
  }
  return null;
}

// Core: finalize the current in-progress day, advance the counters. Mutates
// state.userData but does NOT touch the DOM beyond the avatar/bag updates that
// the manual path explicitly re-applies. Returns a summary for the caller.
async function finalizeDay({ isMissed, remainingOrbs }) {
  const u = state.userData;
  const date = u.currentDate;
  const count = state.count;
  const baselineAtTime = getCurrentBaseline();
  const dailyMaxAtTime = u.dailyMax; // snapshot before recalibration mutates it
  const earned = isMissed ? 0 : coins.calculateEODCoins(remainingOrbs);

  // Provisional record for baseline/recalibration math.
  const provisional = { date, count, isMissed };
  daysCache.push(provisional);

  // Non-missed completion counter (used to detect baseline lock window).
  if (!isMissed) u.nonMissedDaysCompleted = (u.nonMissedDaysCompleted || 0) + 1;

  // Coins (manual day only).
  if (!isMissed && earned > 0) {
    u.lifetimeCoins = (u.lifetimeCoins || 0) + earned;
  }

  // Bag tier re-evaluation.
  const newTier = coins.evaluateBagTier(u.lifetimeCoins);
  const tierChanged = newTier !== u.bagTier;
  u.bagTier = newTier;

  // Baseline lock check (PRD 7.2 step 7) — locked value used immediately below.
  const lockResult = checkBaselineLock(daysCache);

  // State re-evaluation (PRD 7.2 step 8).
  const baselineForEval = getCurrentBaseline();
  const avg = rollingAverage(daysCache, 3);
  let newState = u.currentState;
  if (!isMissed && avg != null) {
    const target = evaluateState(avg, baselineForEval);
    const maxStep = u.baselinePhaseComplete ? 2 : 1;
    newState = applyMovementCap(u.currentState, target, maxStep);
  }
  u.currentState = newState;

  // Drift + recalibration (post-baseline / 3-day windows).
  checkDrift(daysCache);
  checkRecalibration(daysCache);

  // Write the full day record.
  const record = {
    date,
    count,
    coinsEarned: earned,
    isMissed,
    dailyMaxAtTime,
    baselineAtTime,
    stateAtEOD: newState,
  };
  // replace provisional with full record in cache
  daysCache[daysCache.length - 1] = record;
  await db.saveDayRecord(state.uid, date, record);

  // Advance counters.
  u.lastEODDate = date;
  u.currentDate = addDays(date, 1);
  u.currentDay = (u.currentDay || 1) + 1;
  u.currentCount = 0;
  u.currentDebtOrbs = 0;
  state.count = 0;
  state.debtOrbs = 0;

  return { earned, tierChanged, newTier, newState, lockResult };
}

// Reset transient day state and repopulate the room with 10 fresh orbs.
export function beginNewDay() {
  state.count = 0;
  state.debtOrbs = 0;
  state.userData.currentCount = 0;
  state.userData.currentDebtOrbs = 0;
  orbs.spawnOrbs(10);
  setAvatarState(state.userData.currentState, false);
  coins.updateBagDisplay();
}

// Animated manual EOD (night window -> confirm, or test Force EOD).
export async function runManualEOD() {
  const remaining = orbs.normalOrbCount();
  await orbs.absorbAllToAvatar();

  const summary = await finalizeDay({ isMissed: false, remainingOrbs: remaining });

  if (summary.earned > 0) {
    coins.animateCoinArc(summary.earned);
    coins.floatCoinLabel(summary.earned);
  }
  coins.updateBagDisplay();
  if (summary.tierChanged) coins.setBagTier(summary.newTier, true);
  setAvatarState(summary.newState, true);

  await db.saveUserData(state.uid, state.userData);

  // small beat so coin/state animations are visible before the room refills
  await new Promise((r) => setTimeout(r, 900));
  beginNewDay();
  return summary;
}

// Silent catch-up for every calendar day that elapsed without a manual EOD.
// Returns the number of missed days processed.
export async function checkMissedEODs() {
  const u = state.userData;
  const today = isoDate();
  let processed = 0;

  // Guard against runaway loops on bad data.
  let safety = 0;
  while (u.currentDate && u.currentDate < today && safety < 3650) {
    await finalizeDay({ isMissed: true, remainingOrbs: 0 });
    processed += 1;
    safety += 1;
  }

  if (processed > 0) {
    await db.saveUserData(state.uid, state.userData);
  }
  return processed;
}

// Test helper: end the current day as missed, then begin a fresh one.
export async function simulateMissedDay() {
  await finalizeDay({ isMissed: true, remainingOrbs: 0 });
  await db.saveUserData(state.uid, state.userData);
  beginNewDay();
}

// Test helper: advance the internal date by one day via a silent EOD.
export async function advanceOneDay() {
  await finalizeDay({ isMissed: true, remainingOrbs: orbs.normalOrbCount() });
  await db.saveUserData(state.uid, state.userData);
  beginNewDay();
}
