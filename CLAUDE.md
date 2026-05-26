# The Orb — Claude Code Guide

Pixel-art mobile habit-reduction tracker. Vanilla ES modules + Firebase v10 (Auth + Firestore). **No bundler, no build step** — `index.html` is the entry point, all imports are relative paths. PRD: `the-orb-prd-v1.1.md`.

---

## Module map

| File | Role | Key exports |
|---|---|---|
| `js/app.js` | Entry; wires auth/onboarding/subsystems | — (side-effect init) |
| `js/state.js` | Session truth + Firestore schema | `state`, `defaultUserData()`, `threshold()`, `effectivelyOffline()` |
| `js/auth.js` | Firebase email/password auth | `login()`, `signup()`, `logout()`, `isTestAccount()`, `onAuth()` |
| `js/db.js` | Firestore CRUD | `getUserData()`, `saveUserData()`, `saveDayRecord()`, `getAllDays()`, `resetAllData()` |
| `js/orbs.js` | rAF orb animation system | `startLoop()`, `spawnRingOrbs()`, `spawnConsumedOrbs()`, `consumeOneOrb()`, `releaseOneConsumedOrb()`, `absorbAllToAvatar()` |
| `js/game.js` | Tap/long-press action button | `initActionButton()`, `refreshActionButtonState()`, `resetDailyWarning()` |
| `js/coins.js` | EOD coins + bag tiers 1–5 | `calculateEODCoins()`, `evaluateBagTier()`, `updateBagDisplay()`, `animateCoinArc()` |
| `js/avatar.js` | Avatar state −4..+4 | `setAvatarState()`, `evaluateState()`, `applyMovementCap()`, `flashAvatar()` |
| `js/window.js` | ToD window image + day preview | `startWindowClock()`, `initWindowButton()`, `showDayPreview()` |
| `js/eod.js` | End-of-day orchestration | `runManualEOD()`, `checkMissedEODs()`, `beginNewDay()`, `loadDaysCache()` |
| `js/baseline.js` | Baseline lock + drift | `getCurrentBaseline()`, `checkBaselineLock()`, `checkDrift()`, `rollingAverage()` |
| `js/recalibration.js` | dailyMax auto-adjustment | `checkRecalibration()` |
| `js/ui.js` | DOM helpers | `showScreen()`, `showOverlay()`, `hideOverlay()`, `showToast()`, `el()`, `confirmModal()` |
| `js/menu.js` | 3-dot menu (reset, sign out) | `initMenu()` |
| `js/onboarding.js` | First-run setup form | `initOnboarding()`, `showOnboarding()` |
| `js/test-mode.js` | Debug toolbar (test account only) | `renderTestToolbar()`, `TEST_SEED` |
| `js/util.js` | Shared helpers | `isoDate()`, `addDays()`, `clamp()`, `lerp()`, `randRange()`, `randInt()`, `timeOfDay()`, `isNight()` |
| `js/firebase.js` | Firebase SDK init | `app`, `auth`, `db` |
| `js/firebase-config.js` | Project credentials | `firebaseConfig`, `TEST_EMAIL` |

---

## State and persistence

- `state.userData` mirrors the `users/{uid}` Firestore doc. **Adding or removing a field requires updating `defaultUserData()` in `state.js` AND `TEST_SEED` in `test-mode.js`.**
- `state.count` = consumed orbs today — transient, written to Firestore only at EOD by `eod.js:finalizeDay()`.
- Day records: `users/{uid}/days/{date}` — schema defined in `eod.js:finalizeDay()`.
- `eod.js` holds an in-memory `daysCache` (loaded once at startup); baseline and recalibration math reads this cache, not Firestore directly.

---

## Layer / z-index ordering

Both orb layers are `position: absolute; inset: 0` inside `#screen-main` → **identical pixel coordinate system**. Elements can be reparented between them without coordinate conversion.

| Layer | ID | z-index | Contents |
|---|---|---|---|
| Background | `#bg` | 1 | Tatami room image |
| Ring orbs | `#orb-layer` | 8 | Golden orbiting orbs — **behind** avatar |
| Avatar | `#avatar-container` | 20 | Character cross-fade |
| Consumed orbs | `#consumed-orb-layer` | 22 | Purple free-floating orbs — **in front** |
| Overlays | `#overlay-root` | 50+ | Modals, toast |

**Do not change these z-indexes without updating both CSS (`css/main.css`) and HTML together.**

---

## Orb animation invariants

- Single `requestAnimationFrame` loop in `orbs.js:tick()` — do not add a second.
- `orb.frozen = true` → tick skips that orb (set during transition animations).
- `ringPaused = true` → freezes `ringAngle` advance — used during **release transitions only**, not consume.
- Each ring orb carries `orbitOffset` which lerps toward `i * 2π/n` each tick via `lerpAngle()` (shortest-arc, rate-capped).
- `ringOrbsTotal` = dailyMax; set by `spawnRingOrbs(count, total)` and used for dynamic radius formula (`0.5×` to `1.0×`). **Always pass `total` when `count ≠ dailyMax`** (e.g., mid-day session restore in `app.js:restoreRoom()`).

---

## Key DOM IDs (referenced across multiple files)

`screen-main`, `avatar-container`, `avatar-a`, `avatar-b`, `avatar-flash`,
`orb-layer`, `consumed-orb-layer`, `action-btn`, `action-img`, `release-btn`,
`bag-btn`, `bag-img`, `bag-total`, `coin-float`, `overlay-root`, `toast`, `test-toolbar`

---

## Conventions

- **No circular imports** — dependency flow: `app` → subsystems → `state`/`util`.
- DOM factory: `ui.js:el(tag, className, text)` — prefer over raw `document.createElement`.
- Coin arc: origin = `#action-btn` center, destination = `#bag-btn` center — both converted to `#screen-main`-relative coords (subtract `mainRect.left/top`), not raw viewport coords.
- Avatar images: `assets/avatars/` selected by integer state −4..+4 in `avatar.js:setAvatarState()`.
- Toast: `showToast(msg)` from `ui.js`.

---

## Silent breakage hazards

- **No bundler** — never add `package.json`, `vite.config`, `node_modules`, or non-relative `import` paths.
- **`defaultUserData()` drift** — any new persistent `userData` field must be added to `defaultUserData()` in `state.js` and to `TEST_SEED` in `test-mode.js`.
- **`ringOrbsTotal` unset** — `spawnRingOrbs(count)` without `total` leaves `ringOrbsTotal = count`, causing wrong radius when restoring mid-day. Pass `u.dailyMax` as `total`.
- **Coordinate mismatch** — `coins.js` arc uses `#screen-main`-relative coords; mixing viewport coords causes arcs that fly off-screen.

---

## Testing

No automated test suite. Use the test account (username `test`, credentials in `firebase-config.js:TEST_EMAIL`).

**Test toolbar buttons** (visible on test account):
`+1 Day` · `Force EOD` · `Add/Remove 10 coins` · `Bag upgrade/downgrade` · `Simulate missed day` · `Skip baseline` · `Toggle offline` · `Set daily max` · `Set state −4..+4` · **`Reset test data`** (reloads with fresh seed)

**Key flows to verify after changes:**
1. Tap button → one golden orb breaks off radially, turns purple, remaining orbs lerp to new positions
2. Long-press → one purple orb flies back to ring, turns golden
3. Night window tap → confirm → all orbs absorb into avatar → new day spawns fresh ring
4. Reload mid-day → correct ring/consumed split restored at correct radius
