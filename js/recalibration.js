// Daily-max auto-recalibration (PRD section 15). Silent. Min result = 1.
//
// After 3 consecutive non-missed days, if the user is consistently saving far
// more orbs than the daily max implies (count well under max) the max drops;
// if consistently exceeding the max it rises. New max = rolling 3-day average,
// rounded, min 1. Takes effect next day.

import { state } from "./state.js";
import { nonMissedCounts } from "./baseline.js";

export function checkRecalibration(allDays) {
  const u = state.userData;
  const counts = nonMissedCounts(allDays);
  if (counts.length < 3) return null;

  const recent = counts.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const max = u.dailyMax;

  const consistentlyUnder = recent.every((c) => c < max * 0.8);
  const consistentlyOver = recent.every((c) => c > max);

  if (consistentlyUnder || consistentlyOver) {
    const newMax = Math.max(1, Math.round(avg));
    if (newMax !== max) {
      u.dailyMax = newMax;
      console.info(`[recalibration] dailyMax ${max} -> ${newMax}`);
      return { from: max, to: newMax };
    }
  }
  return null;
}
