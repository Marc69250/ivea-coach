import * as store from '../store.js';
import { STAGES, SOURCES, OPP_TYPES, stageInfo, CLOSED_STAGES } from '../config.js';
import { escapeHTML, relativeDayLabel, isOverdue, formatDateHuman, timeAgo, todayISO } from '../utils.js';
import { openSheet, closeSheet, showToast, confirmAction } from '../ui.js';
import { openFollowUpEditor } from './followup-editor.js';

let filterType = 'candidature';
let filterStage = 'all';
let searchTerm = '';
let rootEl = null;

function stagePicker(type, selected, opts = {}) {
  const { includeAll = false } = opts;
  const stages = STAGES[type];
  const pills = stages.map((s) => `
    <button type="button" class="stage-pill ${selected === s.key ? 'selected' : ''}" data-stage="${s.key}"
      style="${selected === s.key ? `background:${s.color};border-color:${s.color};` : ''}">${s.label}</button>
  `).join('');
  const allPill = includeAll ? `<button type="button" class="chip ${selected === 'all' ? 'active' : ''}" data-stage="all">Tous</button>` : '';
  return allPill + pills;
}

function itemRowHTML(o) {
  const stage = stageInfo(o.type, o.stage);
  const icon = OPP_TYPES[o.type].icon;
  return `
    <div class="item-row" data-id="${o.id}">
      <div class="item-avatar">${icon}</div>
      <div class="item-main">
        <p class="item-title">${escapeHTML(o.title || '(sans titre)')}</p>
        <p class="item-sub">${escapeHTML(o.org || '')}</p>
        <div class="item-meta">
          <span class="badge" style="background:${stage.color}">${stage.label}</span>
          ${o.nextFollowUp ? `<span class="badge ${isOverdue(o.nextFollowUp) ? 'badge-overdue' : 'badge-outline'}">⏰ ${relativeDayLabel(o.nextFollowUp)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

export function mount(root) {
  rootEl = root;
  renderList();
}

function renderList() {
  const all = store.listOpportunities({ type: filterType });
  const filtered = all.filter((o) => {
    if (filterStage !== 'all' && o.stage !== filterStage) return false;
    if (searchTerm && !(`${o.title} ${o.org}`.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    return true;
  });

  const stageCounts = {};
  all.forEach((o) => { stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1; });

  const chips = [`<button class="chip ${filterStage === 'all' ? 'active' : ''}" data-stage="all">Tous (${all.length})</button>`]
    .concat(STAGES[filterType].map((s) => `<button class="chip ${filterStage === s.key ? 'active' : ''}" data-stage="${s.key}">${s.label} (${stageCounts[s.key] || 0})</button>`))
    .join('');

  rootEl.innerHTML = `
    <div class="segmented" id="type-segmented">
      <button class="${filterType === 'candidature' ? 'active' : ''}" data-type="candidature">💼 Candidatures</button>
      <button class="${filterType === 'prospection' ? 'active' : ''}" data-type="prospection">🎯 Prospection</button>
    </div>
    <div class="chip-row" id="stage-chips">${chips}</div>
    <div id="opp-list">
      ${filtered.length === 0 ? emptyState() : filtered.map(itemRowHTML).join('')}
    </div>
  `;

  rootEl.querySelector('#type-segmented').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    filterType = btn.dataset.type;
    filterStage = 'all';
    renderList();
  });
  rootEl.querySelector('#stage-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stage]');
    if (!btn) return;
    filterStage = btn.dataset.stage;
    renderList();
  });
  rootEl.querySelectorAll('#opp-list .item-row').forEach((row) => {
    row.addEventListener('click', () => openDetail(row.dataset.id));
  });
}

function emptyState() {
  const label = filterType === 'candidature' ? 'candidature' : 'prospect';
  return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" width="40" height="40"><path d="M3 4h18l-7 9v6l-4 2v-8L3 4z" fill="currentColor"/></svg>
      <p><strong>Aucune ${label}</strong></p>
      <p>Appuie sur + pour en ajouter une</p>
    </div>
  `;
}

export function openCreateForm() {
  openOpportunityForm(null, filterType);
}

function contactOptions(selectedId) {
  const contacts = store.listContacts();
  return `<option value="">— Aucun —</option>` + contacts.map((c) =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHTML(c.name)}${c.org ? ' · ' + escapeHTML(c.org) : ''}</option>`
  ).join('');
}

function openOpportunityForm(existing, defaultType = 'candidature') {
  const type = existing ? existing.type : defaultType;
  const isEdit = !!existing;
  const html = `
    <div class="sheet-title">${isEdit ? 'Modifier' : 'Nouvelle'} ${type === 'candidature' ? 'candidature' : 'prospection'}</div>
    <div class="segmented" id="form-type-segmented" ${isEdit ? 'style="display:none"' : ''}>
      <button type="button" class="${type === 'candidature' ? 'active' : ''}" data-type="candidature">💼 Candidature</button>
      <button type="button" class="${type === 'prospection' ? 'active' : ''}" data-type="prospection">🎯 Prospection</button>
    </div>
    <form id="opp-form">
      <div class="form-row">
        <label id="title-label">${type === 'candidature' ? 'Intitulé du poste' : 'Projet / besoin'}</label>
        <input type="text" id="f-title" value="${escapeHTML(existing?.title || '')}" placeholder="${type === 'candidature' ? 'Ex : Product Manager' : 'Ex : Refonte site web'}" required />
      </div>
      <div class="form-row">
        <label id="org-label">${type === 'candidature' ? 'Entreprise' : 'Client / entreprise'}</label>
        <input type="text" id="f-org" value="${escapeHTML(existing?.org || '')}" placeholder="Ex : Acme SAS" />
      </div>
      <div class="form-row">
        <label id="entry-date-label">${type === 'candidature' ? 'Date de candidature' : 'Date de saisie'}</label>
        <input type="date" id="f-entry-date" value="${existing?.entryDate || todayISO()}" />
      </div>
      <div class="form-row">
        <label>Statut</label>
        <div class="stage-picker" id="f-stage-picker">${stagePicker(type, existing?.stage || STAGES[type][0].key)}</div>
        <input type="hidden" id="f-stage" value="${existing?.stage || STAGES[type][0].key}" />
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label>Source</label>
          <select id="f-source">
            <option value="">—</option>
            ${SOURCES.map((s) => `<option value="${s}" ${existing?.source === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>${type === 'candidature' ? 'Salaire visé (k€)' : 'Budget estimé (€)'}</label>
          <input type="number" id="f-amount" value="${existing?.amount ?? ''}" placeholder="Optionnel" />
        </div>
      </div>
      <div class="form-row">
        <label>Lien (annonce / dossier)</label>
        <input type="url" id="f-url" value="${escapeHTML(existing?.url || '')}" placeholder="https://" />
      </div>
      <div class="form-row">
        <label>Contact lié</label>
        <select id="f-contact">${contactOptions(existing?.contactId)}</select>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="f-notes" placeholder="Détails, points clés...">${escapeHTML(existing?.notes || '')}</textarea>
      </div>
      <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      ${isEdit ? `<button type="button" class="btn btn-danger" id="f-delete">Supprimer</button>` : ''}
    </form>
  `;
  openSheet(html);

  let currentType = type;
  const segmented = document.getElementById('form-type-segmented');
  if (segmented) {
    segmented.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      currentType = btn.dataset.type;
      segmented.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.type === currentType));
      document.getElementById('title-label').textContent = currentType === 'candidature' ? 'Intitulé du poste' : 'Projet / besoin';
      document.getElementById('org-label').textContent = currentType === 'candidature' ? 'Entreprise' : 'Client / entreprise';
      document.getElementById('entry-date-label').textContent = currentType === 'candidature' ? 'Date de candidature' : 'Date de saisie';
      const picker = document.getElementById('f-stage-picker');
      const defaultStage = STAGES[currentType][0].key;
      picker.innerHTML = stagePicker(currentType, defaultStage);
      document.getElementById('f-stage').value = defaultStage;
    });
  }

  document.getElementById('f-stage-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stage]');
    if (!btn) return;
    document.getElementById('f-stage').value = btn.dataset.stage;
    const picker = document.getElementById('f-stage-picker');
    picker.querySelectorAll('.stage-pill').forEach((p) => {
      const sel = p.dataset.stage === btn.dataset.stage;
      p.classList.toggle('selected', sel);
      const info = stageInfo(currentType, p.dataset.stage);
      p.style.background = sel ? info.color : '';
      p.style.borderColor = sel ? info.color : '';
    });
  });

  document.getElementById('opp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    if (!title) { showToast('Le titre est obligatoire'); return; }
    const payload = {
      type: currentType,
      title,
      org: document.getElementById('f-org').value.trim(),
      entryDate: document.getElementById('f-entry-date').value || todayISO(),
      stage: document.getElementById('f-stage').value,
      source: document.getElementById('f-source').value,
      amount: document.getElementById('f-amount').value ? Number(document.getElementById('f-amount').value) : null,
      url: document.getElementById('f-url').value.trim(),
      contactId: document.getElementById('f-contact').value || null,
      notes: document.getElementById('f-notes').value.trim(),
    };
    if (isEdit) {
      store.updateOpportunity(existing.id, payload);
      showToast('Modifié');
    } else {
      const created = store.createOpportunity(payload);
      if (payload.contactId) store.linkContactToOpportunity(payload.contactId, created.id);
      showToast('Ajouté au pipeline');
    }
    closeSheet();
    renderList();
  });

  const delBtn = document.getElementById('f-delete');
  if (delBtn) delBtn.addEventListener('click', () => {
    if (confirmAction('Supprimer définitivement cette entrée ?')) {
      store.deleteOpportunity(existing.id);
      closeSheet();
      renderList();
      showToast('Supprimé');
    }
  });
}

function openDetail(id) {
  const o = store.getOpportunity(id);
  if (!o) return;
  const stage = stageInfo(o.type, o.stage);
  const contact = o.contactId ? store.getContact(o.contactId) : null;
  const html = `
    <div class="detail-header">
      <div class="detail-avatar">${OPP_TYPES[o.type].icon}</div>
      <div>
        <p class="detail-name">${escapeHTML(o.title)}</p>
        <p class="detail-sub">${escapeHTML(o.org || '')}</p>
      </div>
    </div>
    <div class="stage-picker" id="d-stage-picker" style="margin-top:14px;">${stagePicker(o.type, o.stage)}</div>

    <div class="detail-list">
      <div class="detail-list-row"><span>${o.type === 'candidature' ? 'Date de candidature' : 'Date de saisie'}</span><span>${formatDateHuman(o.entryDate || o.createdAt.slice(0, 10))}</span></div>
      ${o.source ? `<div class="detail-list-row"><span>Source</span><span>${escapeHTML(o.source)}</span></div>` : ''}
      ${o.amount ? `<div class="detail-list-row"><span>${o.type === 'candidature' ? 'Salaire visé' : 'Budget'}</span><span>${o.amount} ${o.type === 'candidature' ? 'k€' : '€'}</span></div>` : ''}
      ${o.url ? `<div class="detail-list-row"><span>Lien</span><span><a href="${escapeHTML(o.url)}" target="_blank" rel="noopener">Ouvrir ↗</a></span></div>` : ''}
      ${contact ? `<div class="detail-list-row"><span>Contact lié</span><span><a href="#" id="open-linked-contact">${escapeHTML(contact.name)}</a></span></div>` : ''}
      <div class="detail-list-row"><span>Créé le</span><span>${formatDateHuman(o.createdAt.slice(0, 10))}</span></div>
      <div class="detail-list-row"><span>Mis à jour</span><span>${timeAgo(o.updatedAt)}</span></div>
    </div>

    <div class="section-title" style="margin-top:0;">Relance</div>
    <div class="card">
      ${o.nextFollowUp ? `
        <div class="item-meta" style="margin-bottom:8px;">
          <span class="badge ${isOverdue(o.nextFollowUp) ? 'badge-overdue' : 'badge-outline'}">⏰ ${relativeDayLabel(o.nextFollowUp)}</span>
        </div>
        ${o.followUpNote ? `<p style="font-size:13.5px;color:var(--text-secondary);margin:0 0 8px;">${escapeHTML(o.followUpNote)}</p>` : ''}
      ` : `<p style="font-size:13.5px;color:var(--text-tertiary);margin:0 0 8px;">Aucune relance programmée</p>`}
      <button class="btn btn-secondary" id="d-set-followup">${o.nextFollowUp ? 'Modifier la relance' : 'Programmer une relance'}</button>
    </div>

    ${o.notes ? `<div class="section-title">Notes</div><div class="notes-box">${escapeHTML(o.notes)}</div>` : ''}

    <div class="section-title">Historique</div>
    <div class="card">
      ${o.history.slice().reverse().map((h) => `
        <div class="history-item">
          <div class="history-dot" style="background:${stageInfo(o.type, h.stage).color}"></div>
          <div><div>${escapeHTML(h.note || stageInfo(o.type, h.stage).label)}</div><div class="history-date">${timeAgo(h.date)}</div></div>
        </div>
      `).join('')}
    </div>

    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-secondary" id="d-edit">Modifier</button>
      <button class="btn btn-danger" id="d-delete">Supprimer</button>
    </div>
  `;
  openSheet(html);

  document.getElementById('d-stage-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stage]');
    if (!btn || btn.dataset.stage === o.stage) return;
    store.updateOpportunity(o.id, { stage: btn.dataset.stage });
    closeSheet();
    renderList();
    showToast('Statut mis à jour : ' + stageInfo(o.type, btn.dataset.stage).label);
  });

  const linkedContactBtn = document.getElementById('open-linked-contact');
  if (linkedContactBtn) linkedContactBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeSheet();
    import('./contacts.js').then((mod) => mod.openContactDetail(contact.id));
  });

  document.getElementById('d-set-followup').addEventListener('click', () => {
    openFollowUpEditor('opportunity', o.id, {
      date: o.nextFollowUp, note: o.followUpNote, title: o.title,
      onSaved: () => { renderList(); },
    });
  });

  document.getElementById('d-edit').addEventListener('click', () => {
    closeSheet();
    openOpportunityForm(o, o.type);
  });
  document.getElementById('d-delete').addEventListener('click', () => {
    if (confirmAction('Supprimer définitivement cette entrée ?')) {
      store.deleteOpportunity(o.id);
      closeSheet();
      renderList();
      showToast('Supprimé');
    }
  });
}

export { openDetail as openOpportunityDetail };
