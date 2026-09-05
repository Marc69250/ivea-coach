import * as store from '../store.js';
import * as sync from '../sync.js';
import * as syncUI from '../sync-ui.js';
import { showToast, confirmAction } from '../ui.js';
import { downloadJSON, formatDateHuman, timeAgo, escapeHTML } from '../utils.js';

let rootEl = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function mount(root) {
  rootEl = root;
  render();
}

function render() {
  const stats = store.dataStats();
  rootEl.innerHTML = `
    <div class="section-title">Mes données</div>
    <div class="card">
      <div class="detail-list-row"><span>Candidatures & prospection</span><span>${stats.opportunities}</span></div>
      <div class="detail-list-row"><span>Contacts</span><span>${stats.contacts}</span></div>
      <div class="detail-list-row"><span>Suivi depuis</span><span>${formatDateHuman(stats.createdAt.slice(0, 10))}</span></div>
    </div>
    <p style="font-size:12.5px;color:var(--text-tertiary);padding:0 4px;">
      Toutes tes données restent uniquement sur cet iPhone (stockage local du navigateur). Rien n'est envoyé sur un serveur.
      Pense à exporter une sauvegarde régulièrement, surtout avant de vider le cache Safari.
    </p>

    <div class="section-title">Sauvegarde</div>
    <button class="btn btn-secondary" id="btn-export">⬇️ Exporter une sauvegarde (JSON)</button>
    <input type="file" id="import-file" accept="application/json" hidden />
    <button class="btn btn-secondary" id="btn-import">⬆️ Importer une sauvegarde</button>

    <div class="section-title">Synchronisation OneDrive</div>
    ${renderSyncSection()}

    <div class="section-title">Rappels & notifications</div>
    <div class="card">
      <p style="font-size:13.5px;line-height:1.5;margin:0 0 8px;">
        Safari sur iPhone ne permet pas d'envoyer des notifications programmées sans serveur distant.
        Pour un rappel fiable, utilise le bouton <strong>« Ajouter au calendrier »</strong> disponible sur chaque
        relance : il crée un vrai événement avec alerte native dans l'app Calendrier / Rappels.
      </p>
      ${isStandalone() ? '' : `<p style="font-size:13.5px;line-height:1.5;margin:0;color:var(--warning);">💡 Ajoute cette page à ton écran d'accueil (icône Partager → « Sur l'écran d'accueil ») pour l'utiliser comme une vraie app, en plein écran et hors-ligne.</p>`}
    </div>

    <div class="section-title">Zone de danger</div>
    <button class="btn btn-danger" id="btn-wipe">🗑️ Effacer toutes les données</button>
  `;

  document.getElementById('btn-export').addEventListener('click', () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJSON(`ivea-coach-sauvegarde-${date}.json`, store.exportData());
    showToast('Sauvegarde téléchargée');
  });

  const fileInput = document.getElementById('import-file');
  document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!confirmAction('Importer remplacera toutes les données actuelles. Continuer ?')) return;
        store.importData(reader.result);
        showToast('Données importées');
        render();
      } catch (e) {
        showToast('Fichier invalide');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  document.getElementById('btn-wipe').addEventListener('click', () => {
    if (confirmAction('Cette action supprime définitivement toutes tes candidatures, prospects et contacts. Continuer ?')) {
      store.wipeAllData();
      render();
      showToast('Toutes les données ont été effacées');
    }
  });

  wireSyncSection();
}

function renderSyncSection() {
  if (sync.msalLibMissing()) {
    return `<div class="card"><p style="font-size:13.5px;color:var(--text-secondary);margin:0;">
      La bibliothèque de connexion OneDrive n'a pas pu se charger (pas de connexion internet ?). Réessaie plus tard.
    </p></div>`;
  }

  if (!sync.getClientId()) {
    return `
      <div class="card">
        <p style="font-size:13.5px;line-height:1.5;color:var(--text-secondary);margin:0 0 10px;">
          Partage tes candidatures, prospects et contacts entre ton iPhone et ton PC via ton OneDrive.
          Il faut d'abord créer une inscription d'app gratuite sur <strong>portal.azure.com</strong>
          (Personal Microsoft accounts only, permissions Files.ReadWrite.AppFolder + offline_access,
          redirect URI = l'adresse de cette app) puis coller ici l'« Application (client) ID ».
          L'app n'aura accès qu'à son propre dossier dans ton OneDrive, pas au reste.
        </p>
        <div class="form-row">
          <label>Client ID</label>
          <input type="text" id="onedrive-client-id" placeholder="ex : a1b2c3d4-e5f6-..." />
        </div>
        <button class="btn btn-primary" id="onedrive-save-id">Enregistrer</button>
      </div>
    `;
  }

  const account = sync.getAccount();
  if (!account) {
    return `
      <div class="card">
        <p style="font-size:13.5px;color:var(--text-secondary);margin:0 0 10px;">Configuré, mais non connecté.</p>
        <button class="btn btn-primary" id="onedrive-signin">Se connecter à OneDrive</button>
        <button class="btn btn-secondary" id="onedrive-forget" style="margin-top:8px;">Changer la configuration</button>
      </div>
    `;
  }

  const lastSync = sync.getLastSyncedAt();
  return `
    <div class="card">
      <div class="detail-list-row"><span>Connecté</span><span>${escapeHTML(account.username || '')}</span></div>
      <div class="detail-list-row"><span>Dernière synchro</span><span>${lastSync ? escapeHTML(timeAgo(lastSync)) : 'Jamais'}</span></div>
    </div>
    <button class="btn btn-primary" id="onedrive-sync-now">🔄 Synchroniser maintenant</button>
    <button class="btn btn-secondary" id="onedrive-signout" style="margin-top:8px;">Se déconnecter</button>
  `;
}

function wireSyncSection() {
  const idInput = document.getElementById('onedrive-client-id');
  if (idInput) {
    document.getElementById('onedrive-save-id').addEventListener('click', () => {
      const id = idInput.value.trim();
      if (!id) { showToast('Colle le Client ID d\'abord'); return; }
      sync.setClientId(id);
      render();
    });
  }

  const signinBtn = document.getElementById('onedrive-signin');
  if (signinBtn) signinBtn.addEventListener('click', async () => {
    signinBtn.disabled = true;
    try {
      await sync.signIn();
    } catch (e) {
      showToast('Connexion impossible');
      signinBtn.disabled = false;
    }
  });

  const forgetBtn = document.getElementById('onedrive-forget');
  if (forgetBtn) forgetBtn.addEventListener('click', () => {
    if (confirmAction('Retirer la configuration OneDrive ? La synchronisation s\'arrêtera (tes données restent en local).')) {
      sync.clearClientId();
      render();
    }
  });

  const syncNowBtn = document.getElementById('onedrive-sync-now');
  if (syncNowBtn) syncNowBtn.addEventListener('click', async () => {
    syncNowBtn.disabled = true;
    syncNowBtn.textContent = 'Synchronisation...';
    await syncUI.runSync();
    render();
  });

  const signoutBtn = document.getElementById('onedrive-signout');
  if (signoutBtn) signoutBtn.addEventListener('click', async () => {
    signoutBtn.disabled = true;
    try {
      await sync.signOut();
      showToast('Déconnecté');
    } catch (e) {
      showToast('Déconnexion impossible');
    }
    render();
  });
}
