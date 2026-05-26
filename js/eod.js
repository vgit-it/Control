// End-of-day orchestration. Handles the animated manual EOD,
// silent missed-day catch-up, and "begin new day". A module-level cache of all
// day records is kept so baseline/recalibration math stays consistent across a
// multi-day catch-up without repeated reads.

import { state } from "./state.js";
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

const TOTAL_ORBS = 10;

let daysCache = []; // all day records, oldest -> newest

export async function loadDaysCache() {
  daysCache = await db.getAllDays(state.uid);
}

// Count of the most recent non-missed day (for the post-baseline intra-day warning).
export function lastNonMissedCount() {
  for (let i = daysCache.length - 1; i >= 0; i--) {
    if (!daysCache[i].isMissed) return daysCache[i].count;
  }
  return null;
}

// Compute the orb level array for the next day based on surviving orb levels.
function computeNextOrbLevels(survivingOrbLevels, count, dailyMax) {
  const overLimit = Math.max(0, count - dailyMax);
  const nextTotal = overLimit > 0 ? Math.max(5, TOTAL_ORBS - overLimit) : TOTAL_ORBS;

  if (survivingOrbLevels.length === 0) {
    return Array(nextTotal).fill(1);
  }
  // Promote each surviving orb by 1 level (cap at 3).
  const promoted = survivingOrbLevels.map((l) => Math.min(l + 1, 3));
  const fill = Math.max(0, nextTotal - promoted.length);
  return [...Array(fill).fill(1), ...promoted].sort((a, b) => a - b);
}

// Core: finalize the current in-progress day, advance the counters.
// survivingOrbLevels: array of levels for ring orbs still alive at EOD.
async function finalizeDay({ isMissed, survivingOrbLevels }) {
  const u = state.userData;
  const date = u.currentDate;
  const count = state.count;
  const baselineAtTime = getCurrentBaseline();
  const dailyMaxAtTime = u.dailyMax;
  const earned = isMissed ? 0 : coins.calculateEODCoins(survivingOrbLevels);

  // Provisional record for baseline/recalibration math.
  const provisional = { date, count, isMissed };
  daysCache.push(provisional);

  if (!isMissed) u.nonMissedDaysCompleted = (u.nonMissedDaysCompleted || 0) + 1;

  if (!isMissed && earned > 0) {
    u.lifetimeCoins = (u.lifetimeCoins || 0) + earned;
  }

  const newTier = coins.evaluateBagTier(u.lifetimeCoins);
  const tierChanged = newTier !== u.bagTier;
  u.bagTier = newTier;

  const lockResult = checkBaselineLock(daysCache);

  const baselineForEval = getCurrentBaseline();
  const avg = rollingAverage(daysCache, 3);
  let newState = u.currentState;
  if (!isMissed && avg != null) {
    const target = evaluateState(avg, baselineForEval);
    const maxStep = u.baselinePhaseComplete ? 2 : 1;
    newState = applyMovementCap(u.currentState, target, maxStep);
  }
  u.currentState = newState;

  checkDrift(daysCache);
  checkRecalibration(daysCache);

  // Compute next day's orb levels and store in userData before beginNewDay runs.
  u.orbLevels = computeNextOrbLevels(
    isMissed ? [] : survivingOrbLevels,
    count,
    u.dailyMax
  );

  const record = {
    date,
    count,
    coinsEarned: earned,
    isMissed,
    dailyMaxAtTime,
    baselineAtTime,
    stateAtEOD: newState,
    survivingOrbLevels: isMissed ? [] : survivingOrbLevels,
  };
  daysCache[daysCache.length - 1] = record;
  await db.saveDayRecord(state.uid, date, record);

  u.lastEODDate = date;
  u.currentDate = addDays(date, 1);
  u.currentDay = (u.currentDay || 1) + 1;
  u.currentCount = 0;
  state.count = 0;

  return { earned, tierChanged, newTier, newState, lockResult };
}

// Reset transient day state and repopulate the room with the next day's orbs.
export function beginNewDay() {
  state.count = 0;
  state.userData.currentCount = 0;

  const orbLevels = state.userData.orbLevels;
  const level1Total = orbLevels.filter((l) => l === 1).length;
  const spentCount = TOTAL_ORBS - orbLevels.length;

  orbs.spawnRingOrbs(orbLevels, level1Total);
  if (spentCount > 0) orbs.spawnSpentOrbs(spentCount);

  setAvatarState(state.userData.currentState, false);
  coins.updateBagDisplay();
}

// Animated manual EOD (night window -> confirm, or test Force EOD).
export async function runManualEOD() {
  // Capture surviving orb levels BEFORE absorption clears the ring arrays.
  const survivingOrbLevels = orbs.getRingOrbLevels();
  await orbs.absorbAllToAvatar();

  const summary = await finalizeDay({ isMissed: false, survivingOrbLevels });

  if (summary.earned > 0) {
    coins.animateCoinArc(summary.earned);
    coins.floatCoinLabel(summary.earned);
  }
  coins.updateBagDisplay();
  if (summary.tierChanged) coins.setBagTier(summary.newTier, true);
  setAvatarState(summary.newState, true);

  await db.saveUserData(state.uid, state.userData);

  await new Promise((r) => setTimeout(r, 900));
  beginNewDay();
  return summary;
}

// Silent catch-up for every calendar day that elapsed without a manual EOD.
export async function checkMissedEODs() {
  const u = state.userData;
  const today = isoDate();
  let processed = 0;

  let safety = 0;
  while (u.currentDate && u.currentDate < today && safety < 3650) {
    await finalizeDay({ isMissed: true, survivingOrbLevels: [] });
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
  await finalizeDay({ isMissed: true, survivingOrbLevels: [] });
  await db.saveUserData(state.uid, state.userData);
  beginNewDay();
}

// Test helper: advance the internal date by one day via a silent EOD.
export async function advanceOneDay() {
  await finalizeDay({ isMissed: true, survivingOrbLevels: [] });
  await db.saveUserData(state.uid, state.userData);
  beginNewDay();
}
