# PRD: Habit Reduction Tracker — "The Orb" (v1.1)

---

## 1. Product Overview

A personal, mobile-first web app for habit reduction. A samurai sits in a traditional Japanese room. Energy orbs drift through the space. Every instance of your habit costs an orb — and coins. The world around your samurai reflects how you're doing over time.

**Art direction:** Slightly pixelated 2D. Pixel-art UI. Japanese aesthetic throughout.
**Target users:** Personal use + small friend group. Not a public product.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Hosting | GitHub Pages |
| Auth + DB | Firebase Auth + Firestore |
| Frontend | Mobile-first HTML/CSS/JS |
| Art style | Pixel art PNGs, pixel-font UI |
| Backend logic | Firebase Cloud Functions (missed EOD catch-up) |
| Encryption | Firestore security rules + client-side encryption for habit fields |

---

## 3. Art Direction

### Style
- Slightly pixelated 2D — visible pixel texture, not hardcore 8-bit
- UI chrome: chunky pixel borders, pixel fonts, no smooth gradients, dithered overlays
- All assets: PNGs at consistent pixel density
- Placeholders used during development for all assets

### Theme
- **Character:** Samurai, seated/meditating — 9 state PNGs
- **Room:** Traditional Japanese interior — shoji panels, tatami, wooden beams — **single static background PNG**
- **Orbs:** Spirit energy — kodama / will-o-wisp aesthetic, soft glowing sphere with wispy tail and floating particle motes
- **Debt orb:** Red-tinted orb PNG variant, same particle behavior
- **Coin bag:** Japanese kinchaku — 5 upgrade tiers
- **Window button:** Shoji panel — 4 PNGs by time of day

### State Color Language
- **Thriving:** warm amber, soft gold, gentle bloom — expressed through avatar only
- **Neutral:** muted earth tones — expressed through avatar only
- **Struggling:** desaturated, cool, heavy — expressed through avatar only

---

## 4. Auth & Accounts

- Username + password (Firebase Auth)
- Account creation on first visit
- Session persists across sessions
- No password recovery
- All data scoped to Firebase UID
- Firestore rules block all cross-user reads
- Data model supports multiple habits per user from day one — UI exposes one habit only for now

---

## 5. Onboarding

One-time setup. Pixel art form panels. **Date confirmed once here — automatic thereafter.**

| Field | Default | Notes |
|---|---|---|
| Habit name | — | "What are you tracking?" |
| Cost per instance | 24 coins | Editable |
| Estimated daily count | — | Scoring seed + temporary baseline |
| Display name | — | Stored internally |
| Today's date | Pre-filled | Confirmed once here only |

→ Straight into Day 1. Avatar starts at level 0.

---

## 6. Baseline Definition

**Baseline phase lasts until 2 consecutive non-missed days are completed** — however many calendar days that takes.

- Onboarding estimate = temporary baseline throughout baseline phase
- If user never completes 2 non-missed days, onboarding estimate remains permanent baseline
- **True baseline locks** at end of 2nd non-missed day = average of those 2 days' counts
- True baseline used **immediately** in the EOD state evaluation on the night it locks
- After lock: rolling 3-day average (non-missed days only) vs drifting baseline
- Max state movement during baseline phase: 1 level per EOD
- No delta shown in day preview during baseline phase
- First delta shown: day after baseline locks

---

## 7. Daily Flow

```
App open (auto-logged in)
  → Missed EOD check (§7.1)
  → Current day loads — 10 orbs spawn
      → Day 1 pre-EOD: avatar at level 0
      → All other days: avatar holds previous EOD state
      → Track instances via button
      → Orbs absorbed as count climbs
      → Debt orbs appear if over daily max
  → End day via shoji window only:
      night tap → modal → Yes → EOD runs
      non-night tap → day preview only
  → EOD sequence (§7.2)
  → Next day begins — 10 fresh orbs
```

### 7.1 Missed EOD Handling

On every app open, check: *has EOD run for all prior days?*

- If no → run silent EOD for each missed day chronologically, before loading current day
- **Missed day:** EOD not manually triggered — auto-caught-up on next open
- Missed day coins: **0**
- Missed days **excluded** from: rolling average, baseline drift, baseline lock, recalibration
- Multiple missed days processed sequentially and silently

**Manually ended day with 0 instances — not a missed day:**
- User logs nothing, ends day via night window
- Coins earned = `10 × threshold × cost_per_instance`
- Counts normally in all calculations

### 7.2 EOD Sequence

When EOD runs (animated if app open, silent if missed):

1. Normal remaining orbs → staggered LERP into avatar
2. Debt orbs → staggered LERP into avatar
3. Coins calculated
4. If manual day: coin arc animation + floating *+N* label
5. If missed day: silent, no animation, 0 coins
6. Bag tier re-evaluated → silent cross-fade if changed
7. **Baseline lock check:**
   - If this is the 2nd non-missed day: lock true baseline = avg of days 1 and 2 actuals
   - Use locked baseline immediately in step 8
8. State re-evaluated using current baseline → cross-fade to new state
9. Recalibration check runs
10. New day begins

---

## 8. Screen Layout (Mobile Portrait)

```
┌─────────────────────────┐
│                      ⋮  │ ← three-dot, top right
│                         │
│  orb    orb    orb      │
│     orb    orb    orb   │ ← 10 orbs, free drift
│  orb    orb    orb      │
│           orb           │
│                         │
│  [👝]  [samurai]  [🪟]  │ ← bag | avatar | shoji window
│                         │
│     [debt orbs zone]    │ ← red orbs near avatar, if any
│                         │
│        [ ● ]            │ ← action button, bottom center
└─────────────────────────┘
```

- Full-screen portrait background PNG
- Safe area padding (notch + home bar)
- All tap targets ≥ 44×44px

---

## 9. Action Button

**Visual:** Chunky pixel art. Idle: slow pulse glow. Pressed: depression + burst.

**Offline:** Greyed out. Tap → pixel toast *"You're offline"* — 3s, auto-dismiss. No count recorded.

**Single tap:**
- Count +1
- Random available orb LERPs to button
- Absorption burst animation
- Orb removed from room

**Long press (≥500ms):**
- Release Orb button appears above main button
- **Hidden if count = 0**
- **Debt orbs present:** removes one debt orb first
  - Debt orb LERPs from avatar zone → dissolves
  - `cost_per_instance` coins silently restored to bag
  - Count −1
- **No debt orbs:** spawns a normal orb back into room
  - Count −1
- Disappears after single use; long press to re-invoke

**Over daily max:**
- New red debt orb spawns near avatar
- `cost_per_instance` coins deducted from bag immediately
- Avatar flashes white/red once — single blink, no state change

---

## 10. Orb System

**Spawn:** 10 orbs at day start, random `(x, y, z)` positions

**Movement:**
- LERP toward random targets continuously
- New target assigned on arrival
- Z axis → scale (near = larger, far = smaller)
- Slow, ambient, dreamlike

**Particle system:**
- Each orb emits 3–5 small particle motes continuously
- Motes drift upward and outward from the orb, fading to transparent
- Mote color matches orb: warm gold for normal orbs, deep red for debt orbs
- Mote size is small relative to orb — subtle ambient effect, not distracting
- Motes use same LERP movement, independent of orb position updates
- On orb absorption: motes burst outward briefly before fading (absorption burst)
- On orb release: motes spawn with orb and begin drifting immediately

**Threshold:**
`threshold = daily_max_count ÷ 10`
Minimum daily max = **1**

**Debt orbs:**
- Spawned per over-limit instance
- Red-tinted PNG, constrained drift near avatar
- Visual count = number of red orbs visible
- Released first on Release Orb action (coins silently restored)
- All absorbed into avatar at EOD after normal orbs
- Resets each day

---

## 11. Coin System

**EOD coins earned (manual days only):**
```
coins_earned = remaining_orbs × threshold × cost_per_instance
```

**Missed day coins: 0.** Silent.

**Over-limit deduction (immediate):**
```
coins_deducted = cost_per_instance per instance
```
Silently reversed if debt orb released before EOD.

**Coin bag display:**
- Lifetime total always visible on bag
- Manual EOD: floating *+N* above bag → fades after absorption
- Missed EOD: silent, no change

**Bag tiers:**

| Tier | Lifetime coins | Asset |
|---|---|---|
| 1 | 0 – 4,999 | Small worn kinchaku |
| 2 | 5,000 – 9,999 | Fuller kinchaku |
| 3 | 10,000 – 14,999 | Decorated kinchaku |
| 4 | 15,000 – 19,999 | Ornate kinchaku |
| 5 | 20,000+ | Grand kinchaku |

- Evaluated at every EOD — upgrades and downgrades both possible
- Tier change: silent cross-fade
- Architecture supports more tiers later

---

## 12. Shoji Window Button (End Day)

Right of avatar. Four PNGs:

| Phase | Time |
|---|---|
| Morning | 5AM – 10AM |
| Noon | 10AM – 4PM |
| Evening | 4PM – 7PM |
| Night | 7PM – 5AM |

**Night tap:** Modal → *"End your day?"* → Yes / No → EOD on Yes

**Non-night tap:** Day preview overlay only (§13). No EOD option.

**During baseline phase:** Fully tappable. Non-night shows count + coins (no delta). Night shows EOD modal as normal.

---

## 13. Day Preview Overlay

Minimal. Tap anywhere to dismiss.

| Element | Shown when |
|---|---|
| Today's count — large pixel numeral | Always |
| Coins earned today — icon + number | Always |
| Visual delta vs baseline | Post-baseline phase only |

**Visual delta:** Pixel arrow (up/down/flat) + orb comparison visual. No text. Arrow size and color reflect magnitude.

---

## 14. Avatar States

### 9 States

| Level | Label | Rolling 3-day avg vs baseline |
|---|---|---|
| Thrive +4 | Radiant | ≥40% below |
| Thrive +3 | Glowing | 25–39% below |
| Thrive +2 | Hopeful | 15–24% below |
| Thrive +1 | Improving | 10–14% below |
| 0 | Baseline | Within ±9% |
| Struggle −1 | Slipping | 10–14% above |
| Struggle −2 | Strained | 15–24% above |
| Struggle −3 | Worn | 25–39% above |
| Struggle −4 | Depleted | ≥40% above |

- 9 samurai PNGs
- **Background is a single static PNG — does not change with state**

### Initial State

- Level 0 on Day 1, before any EOD
- First evaluation at end of Day 1

### Transition Rules

| Phase | Max movement/EOD | Delta shown | Baseline used |
|---|---|---|---|
| Baseline phase | 1 level | No | Onboarding estimate (or locked true baseline from lock night onward) |
| Post-baseline | 2 levels | Yes | Locked true baseline (drifting) |

### Baseline Drift (Post-baseline)

- Shifts after 2–3 consecutive non-missed days of meaningfully different performance
- New baseline = rolling average of those days
- Minimum baseline = 1
- Missed days excluded

### Intra-Day Warning

- Baseline phase: fires if running count exceeds onboarding estimate
- Post-baseline: fires if running count exceeds previous day's full-day count
- Single avatar blink (white/red). No state change.

### Transitions
- Avatar PNG cross-fade ~1.5s
- Background is static — no transition needed

---

## 15. Daily Max Auto-Recalibration

Silent. No user prompt. Minimum result = 1.

**Triggers after 3 consecutive non-missed days of:**
- Saving significantly more orbs than daily max implies → max adjusts **downward**
- Consistently exceeding daily max → max adjusts **upward**

**New max:** Rolling 3-day average, rounded to nearest integer, minimum 1.

**Takes effect:** Next day. Logged internally.

---

## 16. Three-Dot Menu

| Item | Action |
|---|---|
| Reset All Data | Double-confirmation modal. Full Firestore wipe for user. |

*Future: edit habit, manual daily max override, history, manage avatars*

---

## 17. Test Mode

**Access:** Username `Test` / password `TestPassword` — pre-seeded in Firebase. Bypasses onboarding.

**Seed defaults:**

| Field | Value |
|---|---|
| Habit name | TestHabit |
| Cost per instance | 24 |
| Estimated daily count | 20 |
| Daily max | 20 |

Test toolbar: pixel art panel, collapsed by default, anchored above action button. Visible only to `Test` account.

### Test Toolbar

| Control | Action |
|---|---|
| +1 Day | Advances internal date by 1, runs silent EOD |
| Force EOD | Triggers full animated EOD immediately |
| Add 10 coins | Adds 10 to lifetime total |
| Remove 10 coins | Removes 10 from lifetime total |
| Force bag upgrade | Jumps bag to next tier |
| Force bag downgrade | Drops bag to previous tier |
| Set state [−4 to +4] | Forces avatar to selected state immediately |
| Spawn debt orb | Adds one debt orb manually |
| Set daily max | Input field — overrides current daily max |
| Simulate missed day | Runs silent EOD for current day as missed (0 coins) |
| Skip baseline | Locks baseline using onboarding estimate, advances to post-baseline immediately |
| Reset test data | Wipes Test account, re-seeds defaults |
| Toggle offline sim | Simulates offline state without real disconnect |

---

## 18. Offline Handling

- Connectivity via Firebase presence
- Action button greyed out when offline
- Tap: pixel toast *"You're offline"* — 3s, auto-dismiss
- No counts recorded offline
- Button restores on reconnect
- All other UI visible but passive

---

## 19. Animation Master List

| Element | Behavior | Easing |
|---|---|---|
| Avatar | Slow vertical levitation loop | LERP |
| Orbs (idle) | 3D drift, z affects scale, particle motes drifting upward | LERP |
| Debt orb (idle) | Slow drift, constrained near avatar, red particle motes | LERP |
| Orb absorption | Flies to button, shrinks + burst | LERP + ease-in |
| Orb release (normal) | Spawns at button, drifts outward | LERP + ease-out |
| Debt orb release | LERPs from avatar zone → dissolves | LERP + ease-out |
| Debt orb spawn | Fade-in near avatar | Ease-in |
| Over-limit coin pull | Coin exits bag | LERP |
| Avatar flash (over-limit) | Single white/red blink | Instant on, fast fade |
| Avatar flash (intra-day warning) | Single white/red blink | Instant on, fast fade |
| EOD — normal orbs | Staggered LERP into avatar | LERP |
| EOD — debt orbs | Staggered LERP into avatar (after normal) | LERP |
| EOD — coins (manual day) | Arc into bag, staggered | LERP |
| EOD — +N label (manual day) | Floats above bag, fades after absorption | Ease-out |
| EOD — missed day | Silent, no animation | — |
| Avatar state change | PNG cross-fade ~1.5s | Ease in-out |
| Background | Static PNG, no animation | — |
| Bag tier change | Silent cross-fade | Ease in-out |
| Day preview | Slide up / tap-to-dismiss | Ease-out |
| Offline toast | Fade in, hold 3s, fade out | Ease in-out |

---

## 20. Data Model (Firestore)

### `users/{uid}`

```
displayName:               string
habitName:                 string
costPerInstance:           number
onboardingEstimate:        number
dailyMax:                  number
baselineLocked:            boolean
baselineValue:             number    ← estimate until locked; true avg after
baselinePhaseComplete:     boolean
nonMissedDaysCompleted:    number    ← resets to 0 after baseline locks
lifetimeCoins:             number
bagTier:                   number    ← 1–5
currentState:              number    ← −4 to +4
currentDay:                number    ← internal day counter
lastEODDate:               string    ← ISO date
```

### `users/{uid}/days/{dayId}`

```
date:                      string    ← ISO date (used as dayId)
count:                     number
coinsEarned:               number
isMissed:                  boolean
dailyMaxAtTime:            number    ← snapshot
baselineAtTime:            number    ← snapshot
stateAtEOD:                number    ← −4 to +4
```

- Multiple habits supported later: `users/{uid}/habits/{habitId}/days/{dayId}`

---

*v1.1 — avatar reduced to 9 states, background made static, orb particle system added.*
