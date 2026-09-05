// Sheet réutilisable pour poser / modifier une date de relance, avec export .ics.
import * as store from '../store.js';
import { openSheet, closeSheet, showToast } from '../ui.js';
import { todayISO, isoPlusDays, downloadICS, escapeHTML } from '../utils.js';

export function openFollowUpEditor(kind, id, { date = '', note = '', title = '', onSaved } = {}) {
  const html = `
    <div class="sheet-title">Programmer une relance</div>
    <div class="chip-row" id="quick-dates">
      <button class="chip" data-days="1">Demain</button>
      <button class="chip" data-days="3">Dans 3 j</button>
      <button class="chip" data-days="7">Dans 1 sem.</button>
      <button class="chip" data-days="14">Dans 2 sem.</button>
    </div>
    <div class="form-row">
      <label>Date</label>
      <input type="date" id="fu-date" value="${date || todayISO()}" />
    </div>
    <div class="form-row">
      <label>Note (optionnel)</label>
      <textarea id="fu-note" placeholder="Ex : relancer par email suite entretien">${escapeHTML(note)}</textarea>
    </div>
    <button class="btn btn-primary" id="fu-save">Enregistrer la relance</button>
    <button class="btn btn-secondary" id="fu-ics">📅 Ajouter un rappel dans Calendrier</button>
    ${date ? `<button class="btn btn-danger" id="fu-clear">Retirer la relance</button>` : ''}
  `;
  openSheet(html);
  const dateInput = document.getElementById('fu-date');
  document.getElementById('quick-dates').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-days]');
    if (!btn) return;
    dateInput.value = isoPlusDays(Number(btn.dataset.days));
  });
  document.getElementById('fu-save').addEventListener('click', () => {
    const d = dateInput.value;
    if (!d) { showToast('Choisis une date'); return; }
    const note2 = document.getElementById('fu-note').value.trim();
    store.rescheduleFollowUp(kind, id, d, note2);
    closeSheet();
    showToast('Relance programmée');
    if (onSaved) onSaved();
  });
  document.getElementById('fu-ics').addEventListener('click', () => {
    const d = dateInput.value || todayISO();
    const note2 = document.getElementById('fu-note').value.trim();
    downloadICS({ title: `Relancer : ${title}`, description: note2, dateISO: d });
    showToast('Fichier .ics téléchargé — ouvre-le pour l\'ajouter à Calendrier');
  });
  const clearBtn = document.getElementById('fu-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    store.clearFollowUp(kind, id);
    closeSheet();
    showToast('Relance retirée');
    if (onSaved) onSaved();
  });
}
