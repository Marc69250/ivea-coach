// Petits utilitaires : dates, initiales, export .ics (rappel calendrier natif).

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isoPlusDays(days, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateHuman(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function relativeDayLabel(iso) {
  const today = todayISO();
  const diff = Math.round((new Date(iso) - new Date(today)) / 86400000);
  if (diff < 0) return `En retard (${formatDateShort(iso)})`;
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff <= 7) return `Dans ${diff} j`;
  return formatDateShort(iso);
}

export function isOverdue(iso) {
  return !!iso && iso < todayISO();
}

export function isToday(iso) {
  return iso === todayISO();
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || '').join('').toUpperCase();
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

export function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Export .ics : ajoute un vrai rappel natif dans Calendrier/Rappels iOS ----------
// C'est le seul mécanisme fiable de notification "poussée" sans backend :
// Safari/iOS ne permet pas de programmer une notification locale future pour
// une PWA sans serveur de push. Le fichier .ics déclenche une alerte native
// à l'heure choisie une fois ajouté au calendrier.

function icsEscape(str) {
  return String(str || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
}

function icsDate(isoDate, hour = 9) {
  // yyyymmddThhmmss (heure locale, sans Z pour rester en heure "flottante")
  const d = new Date(isoDate + 'T00:00:00');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}T${String(hour).padStart(2, '0')}0000`;
}

export function buildICS({ title, description, dateISO, hour = 9 }) {
  const dtStart = icsDate(dateISO, hour);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uidVal = `ivea-${Date.now()}@ivea-coach`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ivea Coach//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uidVal}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description || '')}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT0M',
    `DESCRIPTION:${icsEscape(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+
}

export function icsDataUri(opts) {
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(buildICS(opts));
}

// Sur iOS, un lien construit et cliqué par du JS (blob: + attribut `download`,
// ou window.location.href assigné par script) ne déclenche fiablement ni
// téléchargement ni ouverture native de Calendrier — Safari mobile (et
// encore plus une app ajoutée à l'écran d'accueil) n'a pas d'UI de
// téléchargement, et bloque par ailleurs certaines navigations de scripts
// vers des data: URI. La seule méthode qui fonctionne de façon fiable est
// un VRAI lien <a href="data:text/calendar,..."> présent dans la page,
// tapé directement par l'utilisateur (pas de .click() programmatique) :
// WebKit reconnaît alors le type "text/calendar" et propose nativement
// d'ajouter l'événement. Voir configureICSLink() dans followup-editor.js.
export function downloadICS(opts) {
  const blob = new Blob([buildICS(opts)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(opts.title || 'rappel').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadJSON(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
