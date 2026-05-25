// Single in-memory source of truth for the running session. Modules import
// `state` and read/mutate it directly. `userData` mirrors the Firestore user
// doc (PRD section 20); the rest is transient per-day UI state.

export const state = {
  uid: null,
  userData: null, // mirror of users/{uid}

  // Transient day state (not persisted until EOD):
  count: 0, // habit instances logged today
  debtOrbs: 0, // red orbs currently visible
  orbsRemaining: 10, // normal orbs still drifting in the room

  isOnline: true,
  offlineSim: false, // test-mode forced offline
};

// Default user doc written at onboarding / test seed.
export function defaultUserData(overrides = {}) {
  return {
    displayName: "",
    habitName: "",
    costPerInstance: 24,
    onboardingEstimate: 0,
    dailyMax: 1,
    baselineLocked: false,
    baselineValue: 0, // estimate until locked, true avg after
    baselinePhaseComplete: false,
    nonMissedDaysCompleted: 0,
    lifetimeCoins: 0,
    bagTier: 1,
    currentState: 0, // -4..+4
    currentDay: 1, // internal day counter
    currentDate: null, // ISO date of the in-progress day
    currentCount: 0, // instances logged so far on the in-progress day
    currentDebtOrbs: 0, // debt orbs on the in-progress day
    lastEODDate: null, // ISO date of the last completed (or caught-up) day
    onboardingComplete: false,
    ...overrides,
  };
}

// daily_max / 10, used for coin + delta math (PRD section 10). Min max is 1.
export function threshold(userData = state.userData) {
  const max = Math.max(1, userData ? userData.dailyMax : 1);
  return max / 10;
}

export function effectivelyOffline() {
  return state.offlineSim || !state.isOnline;
}
