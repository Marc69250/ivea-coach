// Sheet réutilisable pour poser / modifier une date de relance, avec export .ics.
import * as store from '../store.js';
import { openSheet, closeSheet, showToast } from '../ui.js';
import { todayISO, isoPlusDays, downloadICS, icsDataUri, isIOS, escapeHTML } from '../utils.js';

export function openFollowUpEditor(kind, id, { date = '', note = '', title = '', onSaved } = {}) {
  const iosCalendar = isIOS();
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
    ${iosCalendar
      ? `<a id="fu-ics" class="btn btn-secondary" href="#">📅 Ajouter un rappel dans Calendrier</a>`
      : `<button class="btn btn-secondary" id="fu-ics">📅 Ajouter un rappel dans Calendrier</button>`}
    ${date ? `<button class="btn btn-danger" id="fu-clear">Retirer la relance</button>` : ''}
  `;
  openSheet(html);
  const dateInput = document.getElementById('fu-date');
  const noteInput = document.getElementById('fu-note');
  const icsEl = document.getElementById('fu-ics');

  function currentIcsOpts() {
    return {
      title: `Relancer : ${title}`,
      description: noteInput.value.trim(),
      dateISO: dateInput.value || todayISO(),
    };
  }

  // Déclarée avant tout listener qui pourrait l'appeler (portée de fonction,
  // pas de bloc) : sur iOS elle tient le href du lien .ics à jour ; sinon
  // c'est un no-op.
  let refreshIcsHref = () => {};

  document.getElementById('quick-dates').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-days]');
    if (!btn) return;
    dateInput.value = isoPlusDays(Number(btn.dataset.days));
    refreshIcsHref();
  });
  document.getElementById('fu-save').addEventListener('click', () => {
    const d = dateInput.value;
    if (!d) { showToast('Choisis une date'); return; }
    const note2 = noteInput.value.trim();
    store.rescheduleFollowUp(kind, id, d, note2);
    closeSheet();
    showToast('Relance programmée');
    if (onSaved) onSaved();
  });

  if (iosCalendar) {
    // Sur iOS, seul un vrai lien <a href="data:..."> tapé directement par
    // l'utilisateur déclenche l'ajout natif au calendrier (voir utils.js) :
    // on tient donc son href à jour à chaque modification du formulaire,
    // sans jamais appeler .click() par script.
    refreshIcsHref = () => { icsEl.href = icsDataUri(currentIcsOpts()); };
    refreshIcsHref();
    dateInput.addEventListener('input', refreshIcsHref);
    noteInput.addEventListener('input', refreshIcsHref);
    icsEl.addEventListener('click', () => showToast('Ajoute l\'événement dans l\'écran qui s\'ouvre'));
  } else {
    icsEl.addEventListener('click', () => {
      downloadICS(currentIcsOpts());
      showToast('Fichier .ics téléchargé — ouvre-le pour l\'ajouter à ton calendrier');
    });
  }

  const clearBtn = document.getElementById('fu-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    store.clearFollowUp(kind, id);
    closeSheet();
    showToast('Relance retirée');
    if (onSaved) onSaved();
  });
}
