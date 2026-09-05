// Helpers UI partagés : sheet (modale), toast, confirmation.

const overlay = document.getElementById('sheet-overlay');
const sheetContent = document.getElementById('sheet-content');
const toastEl = document.getElementById('toast');

let closeCallback = null;

export function openSheet(html, { onClose } = {}) {
  sheetContent.innerHTML = html;
  overlay.hidden = false;
  closeCallback = onClose || null;
  requestAnimationFrame(() => document.body.style.overflow = 'hidden');
}

export function closeSheet() {
  overlay.hidden = true;
  sheetContent.innerHTML = '';
  document.body.style.overflow = '';
  if (closeCallback) { const cb = closeCallback; closeCallback = null; cb(); }
}

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeSheet();
});

// Fermer explicitement (annule la saisie en cours sans sauvegarder, puisque
// rien n'est enregistré tant que le formulaire n'a pas été soumis).
document.getElementById('sheet-close').addEventListener('click', () => closeSheet());
document.querySelector('.sheet-handle').addEventListener('click', () => closeSheet());

let toastTimer = null;
export function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

export function confirmAction(message) {
  return window.confirm(message);
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
