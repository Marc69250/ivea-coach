import * as store from '../store.js';
import { STAGES, CLOSED_STAGES, RESPONSE_STAGES, INTERVIEW_STAGES, WIN_STAGES, LOSE_STAGES, stageInfo } from '../config.js';
import { relativeDayLabel, isOverdue, escapeHTML, timeAgo } from '../utils.js';
import { navigateTo } from '../router.js';

function pct(n, d) {
  if (!d) return '—';
  return Math.round((n / d) * 100) + '%';
}

function kpiCard(value, label, sub = '') {
  return `<div class="kpi-card">
    <div class="kpi-value">${value}</div>
    <div class="kpi-label">${label}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;
}

function funnelSection(type, opps) {
  const stages = STAGES[type];
  const counts = stages.map((s) => opps.filter((o) => o.stage === s.key).length);
  const max = Math.max(1, ...counts);
  return `<div class="card">
    ${stages.map((s, i) => `
      <div class="funnel-row">
        <div class="funnel-label">${s.label}</div>
        <div class="funnel-track"><div class="funnel-fill" style="width:${(counts[i] / max) * 100}%;background:${s.color}"></div></div>
        <div class="funnel-count">${counts[i]}</div>
      </div>
    `).join('')}
  </div>`;
}

export function render() {
  const allOpps = store.listOpportunities();
  const candidatures = allOpps.filter((o) => o.type === 'candidature');
  const prospection = allOpps.filter((o) => o.type === 'prospection');
  const contacts = store.listContacts();
  const followUps = store.listFollowUps();
  const overdueOrToday = followUps.filter((f) => f.date <= new Date().toISOString().slice(0, 10));

  const candActives = candidatures.filter((o) => !CLOSED_STAGES.includes(o.stage));
  const candResponded = candidatures.filter((o) => RESPONSE_STAGES.candidature.includes(o.stage)).length;
  const candSent = candidatures.filter((o) => o.stage !== 'a_postuler').length;
  const candInterviews = candidatures.filter((o) => INTERVIEW_STAGES.includes(o.stage) || ['offre', 'accepte'].includes(o.stage)).length;

  const prospActive = prospection.filter((o) => !CLOSED_STAGES.includes(o.stage));
  const prospWon = prospection.filter((o) => WIN_STAGES.includes(o.stage)).length;
  const prospLost = prospection.filter((o) => LOSE_STAGES.includes(o.stage)).length;

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString();
  const recentActivity = [
    ...allOpps.filter((o) => o.updatedAt >= weekAgoISO).map((o) => ({
      date: o.updatedAt, label: `${o.type === 'candidature' ? '💼' : '🎯'} ${escapeHTML(o.title)} — ${escapeHTML(stageInfo(o.type, o.stage).label)}`,
    })),
    ...contacts.filter((c) => c.createdAt >= weekAgoISO).map((c) => ({
      date: c.createdAt, label: `🤝 Contact ajouté — ${escapeHTML(c.name)}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const html = `
    <div class="section-title">Vue d'ensemble</div>
    <div class="kpi-grid">
      ${kpiCard(candActives.length, 'Candidatures actives', `${candidatures.length} au total`)}
      ${kpiCard(pct(candResponded, candSent), 'Taux de réponse', `${candResponded}/${candSent} envoyées`)}
      ${kpiCard(candInterviews, 'Entretiens obtenus', '')}
      ${kpiCard(prospActive.length, 'Prospects actifs', `${prospection.length} au total`)}
      ${kpiCard(pct(prospWon, prospWon + prospLost), 'Taux de conversion', `${prospWon} gagnés / ${prospLost} perdus`)}
      ${kpiCard(contacts.length, 'Contacts réseau', '')}
    </div>

    <div class="section-title">À relancer</div>
    ${overdueOrToday.length === 0 ? `
      <div class="card" style="text-align:center;color:var(--text-tertiary);padding:20px;">Rien à relancer aujourd'hui 🎉</div>
    ` : overdueOrToday.slice(0, 5).map((f) => `
      <div class="item-row" data-open-followup="${f.kind}:${f.id}">
        <div class="item-avatar">${f.kind === 'contact' ? '🤝' : (f.entity.type === 'candidature' ? '💼' : '🎯')}</div>
        <div class="item-main">
          <p class="item-title">${escapeHTML(f.title)}</p>
          <p class="item-sub">${escapeHTML(f.sub || '')}${f.note ? ' · ' + escapeHTML(f.note) : ''}</p>
          <div class="item-meta"><span class="badge ${isOverdue(f.date) ? 'badge-overdue' : 'badge-outline'}">${relativeDayLabel(f.date)}</span></div>
        </div>
      </div>
    `).join('')}
    ${followUps.length > 0 ? `<button class="btn btn-secondary" id="see-all-followups">Voir toutes les relances (${followUps.length})</button>` : ''}

    <div class="section-title">Pipeline candidatures</div>
    ${funnelSection('candidature', candidatures)}

    <div class="section-title">Pipeline prospection</div>
    ${funnelSection('prospection', prospection)}

    <div class="section-title">Activité récente</div>
    <div class="card">
      ${recentActivity.length === 0 ? `<p style="color:var(--text-tertiary);font-size:13.5px;margin:4px 0;">Aucune activité cette semaine</p>` : recentActivity.map((a) => `
        <div class="history-item">
          <div class="history-dot"></div>
          <div><div>${a.label}</div><div class="history-date">${timeAgo(a.date)}</div></div>
        </div>
      `).join('')}
    </div>
  `;

  return html;
}

export function afterRender(root) {
  root.querySelectorAll('[data-open-followup]').forEach((el) => {
    el.addEventListener('click', () => navigateTo('followups'));
  });
  const seeAll = root.querySelector('#see-all-followups');
  if (seeAll) seeAll.addEventListener('click', () => navigateTo('followups'));
}
