// Daily-max auto-recalibration. After 7 consecutive non-missed days,
// new_daily_max = floor((current + 7_day_average) / 2). Min result = 1.
// Can go up or down. Takes effect next day.

import { state } from "./state.js";

export function checkRecalibration(allDays) {
  const u = state.userData;
  if (allDays.length < 7) return null;

  const last7 = allDays.slice(-7);
  if (last7.some((d) => d.isMissed)) return null;

  const avg = last7.reduce((s, d) => s + d.count, 0) / 7;
  const max = u.dailyMax;
  const newMax = Math.max(1, Math.floor((max + avg) / 2));

  if (newMax !== max) {
    u.dailyMax = newMax;
    console.info(`[recalibration] dailyMax ${max} -> ${newMax}`);
    return { from: max, to: newMax };
  }
  return null;
}
