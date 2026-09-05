import * as store from '../store.js';
import { OPP_TYPES } from '../config.js';
import { escapeHTML, todayISO, isoPlusDays, initials, formatDateHuman } from '../utils.js';

let rootEl = null;

export function mount(root) {
  rootEl = root;
  render();
}

function groupLabel(date) {
  const today = todayISO();
  const in7 = isoPlusDays(7);
  if (date < today) return 'En retard';
  if (date === today) return "Aujourd'hui";
  if (date <= in7) return 'Cette semaine';
  return 'Plus tard';
}

function icon(f) {
  if (f.kind === 'contact') return initials(f.title);
  return OPP_TYPES[f.entity.type]?.icon || '💼';
}

function rowHTML(f) {
  return `
    <div class="item-row" data-kind="${f.kind}" data-id="${f.id}">
      <div class="item-avatar">${icon(f)}</div>
      <div class="item-main">
        <p class="item-title">${escapeHTML(f.title)}</p>
        <p class="item-sub">${escapeHTML(f.sub || '')}${f.note ? ' · ' + escapeHTML(f.note) : ''}</p>
        <div class="item-meta">
          <span class="badge badge-outline">${formatDateHuman(f.date)}</span>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const items = store.listFollowUps();
  if (items.length === 0) {
    rootEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="40" height="40"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 10.6l4.2 2.5-.8 1.3-5-3V6h1.6v6.6z" fill="currentColor"/></svg>
        <p><strong>Aucune relance programmée</strong></p>
        <p>Ouvre une candidature ou un contact pour en planifier une</p>
      </div>
    `;
    return;
  }

  const groups = {};
  items.forEach((f) => {
    const g = groupLabel(f.date);
    (groups[g] = groups[g] || []).push(f);
  });
  const order = ['En retard', "Aujourd'hui", 'Cette semaine', 'Plus tard'];

  rootEl.innerHTML = order.filter((g) => groups[g]).map((g) => `
    <div class="section-title" style="${g === 'En retard' ? 'color:var(--danger);' : ''}">${g} (${groups[g].length})</div>
    ${groups[g].map(rowHTML).join('')}
  `).join('');

  rootEl.querySelectorAll('.item-row').forEach((row) => {
    row.addEventListener('click', () => openActions(row.dataset.kind, row.dataset.id));
  });
}

function openActions(kind, id) {
  const f = store.listFollowUps().find((x) => x.kind === kind && x.id === id);
  if (!f) return;
  if (kind === 'opportunity') {
    import('./pipeline.js').then((mod) => mod.openOpportunityDetail(id));
  } else {
    import('./contacts.js').then((mod) => mod.openContactDetail(id));
  }
}

export { render as refresh };
