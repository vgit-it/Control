// Baseline definition + drift (PRD sections 6 + 14).
//
// Baseline phase lasts until 2 consecutive non-missed days complete. The
// onboarding estimate is the temporary baseline until then. On the 2nd
// non-missed day the true baseline locks = average of those 2 days' counts.
// Post-lock the baseline drifts toward sustained, meaningfully-different
// performance.

import { state } from "./state.js";

// Counts from non-missed days only, oldest -> newest.
export function nonMissedCounts(days) {
  return days.filter((d) => !d.isMissed).map((d) => d.count);
}

// Rolling average of the last `n` non-missed counts (PRD: 3-day).
export function rollingAverage(days, n = 3) {
  const counts = nonMissedCounts(days);
  if (counts.length === 0) return null;
  const slice = counts.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function getCurrentBaseline() {
  const u = state.userData;
  return u.baselineLocked ? u.baselineValue : u.onboardingEstimate;
}

// Called at EOD with all day records INCLUDING the day just finished.
// Returns { locked: boolean, baselineValue } if a lock occurred this EOD.
export function checkBaselineLock(allDays) {
  const u = state.userData;
  if (u.baselineLocked) return null;

  const nonMissed = allDays.filter((d) => !d.isMissed);
  if (nonMissed.length >= 2) {
    const lastTwo = nonMissed.slice(-2);
    const avg = (lastTwo[0].count + lastTwo[1].count) / 2;
    const value = Math.max(1, Math.round(avg));
    u.baselineLocked = true;
    u.baselinePhaseComplete = true;
    u.baselineValue = value;
    u.nonMissedDaysCompleted = 0; // resets after lock (data model note)
    return { locked: true, baselineValue: value };
  }
  return null;
}

// Post-baseline drift: if the last 2-3 consecutive non-missed days differ
// meaningfully (>=10%) from the current baseline, shift baseline toward their
// rolling average. Minimum baseline = 1.
export function checkDrift(allDays) {
  const u = state.userData;
  if (!u.baselineLocked) return null;

  const counts = nonMissedCounts(allDays);
  if (counts.length < 2) return null;

  const recent = counts.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const diffPct = Math.abs(avg - u.baselineValue) / u.baselineValue;

  // require all recent days on the same side of the baseline (consistent)
  const allBelow = recent.every((c) => c < u.baselineValue);
  const allAbove = recent.every((c) => c > u.baselineValue);

  if (diffPct >= 0.1 && (allBelow || allAbove) && recent.length >= 2) {
    const value = Math.max(1, Math.round(avg));
    if (value !== u.baselineValue) {
      u.baselineValue = value;
      return { drifted: true, baselineValue: value };
    }
  }
  return null;
}
