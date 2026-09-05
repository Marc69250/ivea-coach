// Partie UI de la synchronisation OneDrive (voir sync.js pour la logique) :
// déclenchement + résolution de conflit, partagée entre main.js (sync
// automatique au démarrage) et settings.js (bouton manuel).
import * as sync from './sync.js';
import { openSheet, closeSheet, showToast } from './ui.js';
import { timeAgo, escapeHTML } from './utils.js';

let onDataChanged = null;
export function setOnDataChanged(cb) {
  onDataChanged = cb;
}

export async function runSync({ silent = false } = {}) {
  const result = await sync.syncNow();
  if (result.status === 'pulled') {
    if (onDataChanged) onDataChanged();
    showToast('Données mises à jour depuis OneDrive');
  } else if (result.status === 'conflict') {
    showConflictSheet(result);
  } else if (result.status === 'error' && !silent) {
    showToast('Synchronisation OneDrive impossible');
  } else if (result.status === 'pushed' && !silent) {
    showToast('Envoyé vers OneDrive');
  } else if (result.status === 'noop' && !silent) {
    showToast('Déjà à jour');
  }
  return result;
}

function showConflictSheet(result) {
  const html = `
    <div class="sheet-title">Conflit de synchronisation</div>
    <p style="font-size:14px;color:var(--text-secondary);line-height:1.5;margin-top:0;">
      Des modifications ont été faites à la fois sur cet appareil et sur OneDrive
      depuis la dernière synchronisation. Laquelle veux-tu garder ? L'autre sera écrasée.
    </p>
    <div class="card" style="margin:14px 0;">
      <div class="detail-list-row"><span>Cet appareil</span><span>${escapeHTML(timeAgo(result.localUpdatedAt))}</span></div>
      <div class="detail-list-row"><span>OneDrive</span><span>${escapeHTML(timeAgo(result.remoteUpdatedAt))}</span></div>
    </div>
    <button class="btn btn-primary" id="conflict-local">Garder cet appareil</button>
    <button class="btn btn-secondary" id="conflict-remote">Garder OneDrive</button>
  `;
  openSheet(html);
  document.getElementById('conflict-local').addEventListener('click', async () => {
    await sync.resolveConflict('local', result.remote);
    closeSheet();
    showToast('Cet appareil a été conservé, OneDrive mis à jour');
  });
  document.getElementById('conflict-remote').addEventListener('click', async () => {
    await sync.resolveConflict('remote', result.remote);
    closeSheet();
    if (onDataChanged) onDataChanged();
    showToast('Version OneDrive restaurée');
  });
}
