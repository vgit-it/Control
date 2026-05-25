// Screen switching, overlays, modals, toast, and the three-dot menu.

const screens = ["boot", "auth", "onboarding", "main"];

export function showScreen(name) {
  screens.forEach((s) => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle("active", s === name);
  });
}

const overlayRoot = () => document.getElementById("overlay-root");

export function showOverlay(node) {
  const root = overlayRoot();
  root.innerHTML = "";
  root.appendChild(node);
  root.classList.add("active");
}

export function hideOverlay() {
  const root = overlayRoot();
  root.classList.remove("active");
  root.innerHTML = "";
}

let toastTimer = null;
export function showToast(message, ms = 3000) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("show");
  void el.offsetWidth; // restart animation
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

// Builds an element with class + optional text/children.
export function el(tag, className, content) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (typeof content === "string") n.textContent = content;
  else if (Array.isArray(content)) content.forEach((c) => n.appendChild(c));
  else if (content instanceof Node) n.appendChild(content);
  return n;
}

// Generic Yes/No (or labelled) confirm modal. Returns a Promise<boolean>.
export function confirmModal({ text, sub, yes = "Yes", no = "No", danger = false }) {
  return new Promise((resolve) => {
    const modal = el("div", "modal");
    modal.appendChild(el("div", "modal-text", text));
    if (sub) modal.appendChild(el("div", "modal-sub", sub));

    const row = el("div", "modal-row");
    const noBtn = el("button", "pixel-btn ghost", no);
    const yesBtn = el("button", `pixel-btn${danger ? " danger" : ""}`, yes);
    noBtn.onclick = () => {
      hideOverlay();
      resolve(false);
    };
    yesBtn.onclick = () => {
      hideOverlay();
      resolve(true);
    };
    row.appendChild(noBtn);
    row.appendChild(yesBtn);
    modal.appendChild(row);
    showOverlay(modal);
  });
}
