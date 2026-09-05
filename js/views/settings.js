import * as store from '../store.js';
import { showToast, confirmAction } from '../ui.js';
import { downloadJSON, formatDateHuman } from '../utils.js';

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
}
