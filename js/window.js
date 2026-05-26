// Shoji window button (PRD section 12) + day preview overlay (section 13).

import { state } from "./state.js";
import { timeOfDay, isNight } from "./util.js";
import { getCurrentBaseline } from "./baseline.js";
import { calculateEODCoins } from "./coins.js";
import { normalOrbCount } from "./orbs.js";
import { confirmModal, showOverlay, hideOverlay, el } from "./ui.js";
import { runManualEOD } from "./eod.js";

const WINDOW_SRC = {
  morning: "ImageUpload/Window_Morning.png",
  noon: "ImageUpload/Window_Noon.png",
  evening: "ImageUpload/Window_Evening.png",
  night: "ImageUpload/Window_Night.png",
};

let clockTimer = null;

const _alphaCache = new Map();

async function _getCanvas(img) {
  if (_alphaCache.has(img.src)) return _alphaCache.get(img.src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  _alphaCache.set(img.src, canvas);
  return canvas;
}

async function isTappablePixel(img, clientX, clientY) {
  const rect = img.getBoundingClientRect();
  const px = Math.round(((clientX - rect.left) / rect.width) * img.naturalWidth);
  const py = Math.round(((clientY - rect.top) / rect.height) * img.naturalHeight);
  try {
    const canvas = await _getCanvas(img);
    const [, , , a] = canvas.getContext("2d").getImageData(px, py, 1, 1).data;
    return a > 10;
  } catch {
    return true;
  }
}

export function updateWindowImage() {
  const img = document.getElementById("window-img");
  const newSrc = WINDOW_SRC[timeOfDay()];
  if (img.src !== newSrc) {
    _alphaCache.delete(img.src);
    img.src = newSrc;
  }
}

export function startWindowClock() {
  updateWindowImage();
  clearInterval(clockTimer);
  clockTimer = setInterval(updateWindowImage, 60 * 1000);
}

export function initWindowButton() {
  const btn = document.getElementById("window-btn");
  const img = document.getElementById("window-img");
  btn.addEventListener("click", async (e) => {
    if (!(await isTappablePixel(img, e.clientX, e.clientY))) return;
    onWindowTap();
  });
}

async function onWindowTap() {
  if (isNight()) {
    const ok = await confirmModal({
      text: "End your day?",
      yes: "Yes",
      no: "No",
    });
    if (ok) await runManualEOD();
  } else {
    showDayPreview();
  }
}

// Day preview overlay: count + coins always; delta only post-baseline.
export function showDayPreview() {
  const remaining = normalOrbCount();
  const coinsToday = calculateEODCoins(remaining);

  const preview = el("div", "preview");
  preview.appendChild(el("div", "preview-label", "TODAY"));
  preview.appendChild(el("div", "preview-count", String(state.count)));
  preview.appendChild(el("div", "preview-label", "COINS IF YOU END NOW"));
  preview.appendChild(el("div", "preview-coins", String(coinsToday)));

  if (state.userData.baselinePhaseComplete) {
    const baseline = getCurrentBaseline();
    const delta = el("div", "preview-delta");
    // up arrow = above baseline (worse), down = below (better)
    if (state.count > baseline * 1.09) {
      delta.classList.add("up");
      delta.textContent = "▲";
    } else if (state.count < baseline * 0.91) {
      delta.classList.add("down");
      delta.textContent = "▼";
    } else {
      delta.classList.add("flat");
      delta.textContent = "—";
    }
    // magnitude -> size
    const mag = baseline > 0 ? Math.abs(state.count - baseline) / baseline : 0;
    delta.style.fontSize = `${40 + Math.min(40, mag * 80)}px`;
    preview.appendChild(delta);
  }

  preview.addEventListener("click", hideOverlay);
  showOverlay(preview);
}
