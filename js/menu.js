// Three-dot menu (PRD section 16). Currently: Reset All Data (double-confirm).

import { state } from "./state.js";
import { resetAllData } from "./db.js";
import { logout } from "./auth.js";
import { showOverlay, hideOverlay, confirmModal, el } from "./ui.js";

export function initMenu() {
  document.getElementById("btn-menu").addEventListener("click", openMenu);
}

function openMenu() {
  const sheet = el("div", "menu-sheet");

  const reset = el("button", "menu-item danger", "Reset All Data");
  reset.onclick = async () => {
    hideOverlay();
    await doReset();
  };

  const signout = el("button", "menu-item", "Sign Out");
  signout.onclick = async () => {
    hideOverlay();
    await logout();
  };

  const cancel = el("button", "menu-item", "Close");
  cancel.onclick = hideOverlay;

  sheet.appendChild(reset);
  sheet.appendChild(signout);
  sheet.appendChild(cancel);
  showOverlay(sheet);
}

async function doReset() {
  const first = await confirmModal({
    text: "Reset all data?",
    sub: "This erases every day, your coins, and your baseline. It cannot be undone.",
    yes: "Continue",
    no: "Cancel",
    danger: true,
  });
  if (!first) return;

  const second = await confirmModal({
    text: "Are you absolutely sure?",
    sub: "There is no recovery. Your account stays, but all progress is gone.",
    yes: "Erase Everything",
    no: "Cancel",
    danger: true,
  });
  if (!second) return;

  await resetAllData(state.uid);
  // Reload boots fresh: no user doc -> onboarding (or test re-seed).
  window.location.reload();
}
