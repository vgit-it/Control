// Shared helpers and constants.

// ISO date (YYYY-MM-DD) in the device's local timezone. en-CA locale yields
// the ISO format. Local time matters because the day boundary is local.
export function isoDate(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

// Returns a new ISO date string offset by `days` from the given ISO date.
export function addDays(isoStr, days) {
  const d = new Date(`${isoStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

// Number of whole days between two ISO date strings (b - a).
export function daysBetween(aIso, bIso) {
  const a = new Date(`${aIso}T00:00:00`);
  const b = new Date(`${bIso}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

// Time-of-day phase for the shoji window (PRD section 12).
export function timeOfDay(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return "morning";
  if (h >= 10 && h < 16) return "noon";
  if (h >= 16 && h < 19) return "evening";
  return "night"; // 19:00 - 04:59
}

export function isNight(date = new Date()) {
  return timeOfDay(date) === "night";
}
