// Coin system (PRD section 11). EOD earnings, lifetime total, bag tiers.

import { state } from "./state.js";

const BAG_SRC = (tier) => `ImageUpload/Bag_Tier${tier}.png`;

// EOD coins: sum of each surviving orb's level-based value.
// Level 1 = 1.0×, Level 2 = 1.25×, Level 3 = 1.5× costPerInstance.
export function calculateEODCoins(survivingOrbLevels) {
  const base = state.userData.costPerInstance;
  const mult = [0, 1.0, 1.25, 1.5];
  return Math.round(survivingOrbLevels.reduce((s, l) => s + base * (mult[l] ?? 1.0), 0));
}

// Lifetime coins -> bag tier 1..5 (PRD section 11).
export function evaluateBagTier(lifetimeCoins) {
  if (lifetimeCoins >= 20000) return 5;
  if (lifetimeCoins >= 15000) return 4;
  if (lifetimeCoins >= 10000) return 3;
  if (lifetimeCoins >= 5000) return 2;
  return 1;
}

export function updateBagDisplay() {
  document.getElementById("bag-total").textContent = String(
    Math.round(state.userData.lifetimeCoins)
  );
  setBagTier(state.userData.bagTier, false);
}

// Cross-fade bag image when tier changes.
export function setBagTier(tier, animate = true) {
  const img = document.getElementById("bag-img");
  const next = BAG_SRC(tier);
  if (img.getAttribute("src")?.endsWith(`Bag_Tier${tier}.png`)) return;
  if (animate) {
    img.style.transition = "opacity 0.6s ease-in-out";
    img.style.opacity = "0";
    setTimeout(() => {
      img.src = next;
      img.style.opacity = "1";
    }, 300);
  } else {
    img.src = next;
  }
}

// Floating +N label above the bag (manual EOD).
export function floatCoinLabel(amount) {
  const f = document.getElementById("coin-float");
  f.textContent = `+${amount}`;
  f.classList.remove("show");
  void f.offsetWidth;
  f.classList.add("show");
}

// Arc a few coin sprites from a source point into the bag (manual EOD).
export function animateCoinArc(amount) {
  const main = document.getElementById("screen-main");
  const mainRect = main.getBoundingClientRect();
  const bag = document.getElementById("bag-btn").getBoundingClientRect();
  const actionBtn = document.getElementById("action-btn").getBoundingClientRect();
  const startX = actionBtn.left + actionBtn.width / 2 - mainRect.left;
  const startY = actionBtn.top + actionBtn.height / 2 - mainRect.top;
  const endX = bag.left + bag.width / 2 - mainRect.left;
  const endY = bag.top + bag.height / 2 - mainRect.top;

  const n = Math.min(8, Math.max(3, Math.round(amount / 50)));
  for (let i = 0; i < n; i++) {
    const coin = document.createElement("div");
    coin.className = "fly-coin";
    main.appendChild(coin);
    const startAt = performance.now() + i * 70;
    const dur = 650;
    const arc = -60 - Math.random() * 40;
    function step(now) {
      if (now < startAt) {
        requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, (now - startAt) / dur);
      const x = startX + (endX - startX) * t;
      const y =
        startY + (endY - startY) * t + arc * Math.sin(Math.PI * t);
      coin.style.transform = `translate(${x}px, ${y}px)`;
      coin.style.opacity = String(t < 0.85 ? 1 : (1 - t) / 0.15);
      if (t < 1) requestAnimationFrame(step);
      else coin.remove();
    }
    requestAnimationFrame(step);
  }
}
