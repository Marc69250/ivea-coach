import * as store from '../store.js';
import { CONTACT_STATUSES, contactStatusInfo } from '../config.js';
import { escapeHTML, relativeDayLabel, isOverdue, initials, timeAgo, formatDateHuman, todayISO } from '../utils.js';
import { openSheet, closeSheet, showToast, confirmAction } from '../ui.js';
import { openFollowUpEditor } from './followup-editor.js';

let filterStatus = 'all';
let searchTerm = '';
let rootEl = null;

export function mount(root) {
  rootEl = root;
  renderList();
}

function itemRowHTML(c) {
  const status = contactStatusInfo(c.status);
  return `
    <div class="item-row" data-id="${c.id}">
      <div class="item-avatar">${initials(c.name)}</div>
      <div class="item-main">
        <p class="item-title">${escapeHTML(c.name || '(sans nom)')}</p>
        <p class="item-sub">${escapeHTML([c.role, c.org].filter(Boolean).join(' · '))}</p>
        <div class="item-meta">
          <span class="badge" style="background:${status.color}">${status.label}</span>
          ${c.nextFollowUp ? `<span class="badge ${isOverdue(c.nextFollowUp) ? 'badge-overdue' : 'badge-outline'}">⏰ ${relativeDayLabel(c.nextFollowUp)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderList() {
  const all = store.listContacts();
  const filtered = all.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchTerm && !(`${c.name} ${c.org} ${c.role}`.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    return true;
  });
  const counts = {};
  all.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });

  const chips = [`<button class="chip ${filterStatus === 'all' ? 'active' : ''}" data-status="all">Tous (${all.length})</button>`]
    .concat(CONTACT_STATUSES.map((s) => `<button class="chip ${filterStatus === s.key ? 'active' : ''}" data-status="${s.key}">${s.label} (${counts[s.key] || 0})</button>`))
    .join('');

  rootEl.innerHTML = `
    <div class="form-row">
      <input type="text" id="contact-search" placeholder="Rechercher un contact..." value="${escapeHTML(searchTerm)}" />
    </div>
    <div class="chip-row" id="status-chips">${chips}</div>
    <div id="contact-list">
      ${filtered.length === 0 ? emptyState() : filtered.map(itemRowHTML).join('')}
    </div>
  `;

  rootEl.querySelector('#status-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    filterStatus = btn.dataset.status;
    renderList();
  });
  rootEl.querySelector('#contact-search').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    const list = rootEl.querySelector('#contact-list');
    const filtered2 = store.listContacts().filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (searchTerm && !(`${c.name} ${c.org} ${c.role}`.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
      return true;
    });
    list.innerHTML = filtered2.length === 0 ? emptyState() : filtered2.map(itemRowHTML).join('');
    list.querySelectorAll('.item-row').forEach((row) => row.addEventListener('click', () => openContactDetail(row.dataset.id)));
  });
  rootEl.querySelectorAll('#contact-list .item-row').forEach((row) => {
    row.addEventListener('click', () => openContactDetail(row.dataset.id));
  });
}

function emptyState() {
  return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" width="40" height="40"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" fill="currentColor"/></svg>
      <p><strong>Aucun contact</strong></p>
      <p>Appuie sur + pour ajouter ton réseau</p>
    </div>
  `;
}

export function openCreateForm() {
  openContactForm(null);
}

function statusPicker(selected) {
  return CONTACT_STATUSES.map((s) => `
    <button type="button" class="stage-pill ${selected === s.key ? 'selected' : ''}" data-status="${s.key}"
      style="${selected === s.key ? `background:${s.color};border-color:${s.color};` : ''}">${s.label}</button>
  `).join('');
}

function openContactForm(existing) {
  const isEdit = !!existing;
  const html = `
    <div class="sheet-title">${isEdit ? 'Modifier le contact' : 'Nouveau contact'}</div>
    <form id="contact-form">
      <div class="form-row">
        <label>Nom</label>
        <input type="text" id="f-name" value="${escapeHTML(existing?.name || '')}" placeholder="Ex : Marie Dupont" required />
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label>Rôle / poste</label>
          <input type="text" id="f-role" value="${escapeHTML(existing?.role || '')}" placeholder="Ex : Talent Manager" />
        </div>
        <div class="form-row">
          <label>Entreprise</label>
          <input type="text" id="f-org" value="${escapeHTML(existing?.org || '')}" placeholder="Ex : Acme SAS" />
        </div>
      </div>
      <div class="form-row">
        <label>Date de prise de contact</label>
        <input type="date" id="f-contact-date" value="${existing?.contactDate || todayISO()}" />
      </div>
      <div class="form-row">
        <label>Statut</label>
        <div class="stage-picker" id="f-status-picker">${statusPicker(existing?.status || 'a_contacter')}</div>
        <input type="hidden" id="f-status" value="${existing?.status || 'a_contacter'}" />
      </div>
      <div class="form-row-2">
        <div class="form-row">
          <label>Email</label>
          <input type="email" id="f-email" value="${escapeHTML(existing?.email || '')}" />
        </div>
        <div class="form-row">
          <label>Téléphone</label>
          <input type="tel" id="f-phone" value="${escapeHTML(existing?.phone || '')}" />
        </div>
      </div>
      <div class="form-row">
        <label>LinkedIn</label>
        <input type="url" id="f-linkedin" value="${escapeHTML(existing?.linkedin || '')}" placeholder="https://linkedin.com/in/..." />
      </div>
      <div class="form-row">
        <label>Comment rencontré</label>
        <input type="text" id="f-origin" value="${escapeHTML(existing?.origin || '')}" placeholder="Ex : Salon Viva Tech, ancien collègue..." />
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="f-notes" placeholder="Contexte, sujets abordés...">${escapeHTML(existing?.notes || '')}</textarea>
      </div>
      <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
      ${isEdit ? `<button type="button" class="btn btn-danger" id="f-delete">Supprimer</button>` : ''}
    </form>
  `;
  openSheet(html);

  document.getElementById('f-status-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    document.getElementById('f-status').value = btn.dataset.status;
    const picker = document.getElementById('f-status-picker');
    picker.querySelectorAll('.stage-pill').forEach((p) => {
      const sel = p.dataset.status === btn.dataset.status;
      p.classList.toggle('selected', sel);
      const info = contactStatusInfo(p.dataset.status);
      p.style.background = sel ? info.color : '';
      p.style.borderColor = sel ? info.color : '';
    });
  });

  document.getElementById('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    if (!name) { showToast('Le nom est obligatoire'); return; }
    const payload = {
      name,
      role: document.getElementById('f-role').value.trim(),
      org: document.getElementById('f-org').value.trim(),
      contactDate: document.getElementById('f-contact-date').value || todayISO(),
      status: document.getElementById('f-status').value,
      email: document.getElementById('f-email').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      linkedin: document.getElementById('f-linkedin').value.trim(),
      origin: document.getElementById('f-origin').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
    };
    if (isEdit) {
      store.updateContact(existing.id, payload);
      showToast('Modifié');
    } else {
      store.createContact(payload);
      showToast('Contact ajouté');
    }
    closeSheet();
    renderList();
  });

  const delBtn = document.getElementById('f-delete');
  if (delBtn) delBtn.addEventListener('click', () => {
    if (confirmAction('Supprimer définitivement ce contact ?')) {
      store.deleteContact(existing.id);
      closeSheet();
      renderList();
      showToast('Supprimé');
    }
  });
}

export function openContactDetail(id) {
  const c = store.getContact(id);
  if (!c) return;
  const status = contactStatusInfo(c.status);
  const linkedOpps = c.opportunityIds.map((oid) => store.getOpportunity(oid)).filter(Boolean);
  const html = `
    <div class="detail-header">
      <div class="detail-avatar">${initials(c.name)}</div>
      <div>
        <p class="detail-name">${escapeHTML(c.name)}</p>
        <p class="detail-sub">${escapeHTML([c.role, c.org].filter(Boolean).join(' · '))}</p>
      </div>
    </div>
    <div class="stage-picker" id="d-status-picker" style="margin-top:14px;">${statusPicker(c.status)}</div>

    <div class="detail-list">
      <div class="detail-list-row"><span>Date de prise de contact</span><span>${formatDateHuman(c.contactDate || c.createdAt.slice(0, 10))}</span></div>
      ${c.email ? `<div class="detail-list-row"><span>Email</span><span><a href="mailto:${escapeHTML(c.email)}">${escapeHTML(c.email)}</a></span></div>` : ''}
      ${c.phone ? `<div class="detail-list-row"><span>Téléphone</span><span><a href="tel:${escapeHTML(c.phone)}">${escapeHTML(c.phone)}</a></span></div>` : ''}
      ${c.linkedin ? `<div class="detail-list-row"><span>LinkedIn</span><span><a href="${escapeHTML(c.linkedin)}" target="_blank" rel="noopener">Ouvrir ↗</a></span></div>` : ''}
      ${c.origin ? `<div class="detail-list-row"><span>Rencontré via</span><span>${escapeHTML(c.origin)}</span></div>` : ''}
      <div class="detail-list-row"><span>Mis à jour</span><span>${timeAgo(c.updatedAt)}</span></div>
    </div>

    <div class="section-title" style="margin-top:0;">Relance</div>
    <div class="card">
      ${c.nextFollowUp ? `
        <div class="item-meta" style="margin-bottom:8px;">
          <span class="badge ${isOverdue(c.nextFollowUp) ? 'badge-overdue' : 'badge-outline'}">⏰ ${relativeDayLabel(c.nextFollowUp)}</span>
        </div>
        ${c.followUpNote ? `<p style="font-size:13.5px;color:var(--text-secondary);margin:0 0 8px;">${escapeHTML(c.followUpNote)}</p>` : ''}
      ` : `<p style="font-size:13.5px;color:var(--text-tertiary);margin:0 0 8px;">Aucune relance programmée</p>`}
      <button class="btn btn-secondary" id="d-set-followup">${c.nextFollowUp ? 'Modifier la relance' : 'Programmer une relance'}</button>
    </div>

    ${linkedOpps.length > 0 ? `
      <div class="section-title">Opportunités liées</div>
      <div class="card">
        ${linkedOpps.map((o) => `<div class="detail-list-row"><span>${o.type === 'candidature' ? '💼' : '🎯'} ${escapeHTML(o.title)}</span><span>${escapeHTML(o.org || '')}</span></div>`).join('')}
      </div>
    ` : ''}

    ${c.notes ? `<div class="section-title">Notes</div><div class="notes-box">${escapeHTML(c.notes)}</div>` : ''}

    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn-secondary" id="d-edit">Modifier</button>
      <button class="btn btn-danger" id="d-delete">Supprimer</button>
    </div>
  `;
  openSheet(html);

  document.getElementById('d-status-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn || btn.dataset.status === c.status) return;
    store.updateContact(c.id, { status: btn.dataset.status, lastContactDate: new Date().toISOString().slice(0, 10) });
    closeSheet();
    renderList();
    showToast('Statut mis à jour : ' + contactStatusInfo(btn.dataset.status).label);
  });

  document.getElementById('d-set-followup').addEventListener('click', () => {
    openFollowUpEditor('contact', c.id, {
      date: c.nextFollowUp, note: c.followUpNote, title: c.name,
      onSaved: () => { renderList(); },
    });
  });

  document.getElementById('d-edit').addEventListener('click', () => {
    closeSheet();
    openContactForm(c);
  });
  document.getElementById('d-delete').addEventListener('click', () => {
    if (confirmAction('Supprimer définitivement ce contact ?')) {
      store.deleteContact(c.id);
      closeSheet();
      renderList();
      showToast('Supprimé');
    }
  });
}
