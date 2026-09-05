// Couche de persistance : tout est stocké en local (localStorage) sur l'iPhone.
// Aucune donnée ne quitte l'appareil.

const KEY = 'ivea_coach_v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowISO() {
  return new Date().toISOString();
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyState() {
  return { opportunities: [], contacts: [], meta: { createdAt: nowISO() } };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      meta: parsed.meta || { createdAt: nowISO() },
    };
  } catch (e) {
    console.error('Lecture des données impossible, réinitialisation', e);
    return emptyState();
  }
}

let state = load();

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// ---------- Opportunities (candidatures + prospection) ----------

export function listOpportunities({ type, includeArchived = false } = {}) {
  return state.opportunities
    .filter((o) => (type ? o.type === type : true))
    .filter((o) => includeArchived || !o.archived)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getOpportunity(id) {
  return state.opportunities.find((o) => o.id === id) || null;
}

export function createOpportunity(data) {
  const now = nowISO();
  const opp = {
    id: uid(),
    type: data.type || 'candidature',
    title: data.title || '',
    org: data.org || '',
    entryDate: data.entryDate || todayISODate(),
    stage: data.stage,
    source: data.source || '',
    url: data.url || '',
    amount: data.amount || null,
    contactId: data.contactId || null,
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
    nextFollowUp: data.nextFollowUp || null,
    followUpNote: data.followUpNote || '',
    archived: false,
    history: [{ date: now, stage: data.stage, note: 'Créé' }],
  };
  state.opportunities.push(opp);
  persist();
  return opp;
}

export function updateOpportunity(id, patch) {
  const opp = getOpportunity(id);
  if (!opp) return null;
  const stageChanged = patch.stage && patch.stage !== opp.stage;
  Object.assign(opp, patch, { updatedAt: nowISO() });
  if (stageChanged) {
    opp.history.push({ date: nowISO(), stage: patch.stage, note: patch.historyNote || 'Changement de statut' });
  }
  persist();
  return opp;
}

export function addOpportunityNote(id, note) {
  const opp = getOpportunity(id);
  if (!opp) return null;
  opp.history.push({ date: nowISO(), stage: opp.stage, note });
  opp.updatedAt = nowISO();
  persist();
  return opp;
}

export function deleteOpportunity(id) {
  state.opportunities = state.opportunities.filter((o) => o.id !== id);
  persist();
}

// ---------- Contacts ----------

export function listContacts({ includeArchived = false } = {}) {
  return state.contacts
    .filter((c) => includeArchived || !c.archived)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getContact(id) {
  return state.contacts.find((c) => c.id === id) || null;
}

export function createContact(data) {
  const now = nowISO();
  const contact = {
    id: uid(),
    name: data.name || '',
    org: data.org || '',
    role: data.role || '',
    email: data.email || '',
    phone: data.phone || '',
    linkedin: data.linkedin || '',
    origin: data.origin || '',
    status: data.status || 'a_contacter',
    notes: data.notes || '',
    contactDate: data.contactDate || todayISODate(),
    createdAt: now,
    updatedAt: now,
    lastContactDate: data.lastContactDate || null,
    nextFollowUp: data.nextFollowUp || null,
    followUpNote: data.followUpNote || '',
    opportunityIds: [],
    archived: false,
  };
  state.contacts.push(contact);
  persist();
  return contact;
}

export function updateContact(id, patch) {
  const c = getContact(id);
  if (!c) return null;
  Object.assign(c, patch, { updatedAt: nowISO() });
  persist();
  return c;
}

export function deleteContact(id) {
  state.contacts = state.contacts.filter((c) => c.id !== id);
  state.opportunities.forEach((o) => {
    if (o.contactId === id) o.contactId = null;
  });
  persist();
}

export function linkContactToOpportunity(contactId, opportunityId) {
  const c = getContact(contactId);
  if (c && !c.opportunityIds.includes(opportunityId)) {
    c.opportunityIds.push(opportunityId);
    persist();
  }
}

// ---------- Relances (agrégation) ----------

export function listFollowUps({ includeDone = false } = {}) {
  const items = [];
  state.opportunities
    .filter((o) => !o.archived && o.nextFollowUp)
    .forEach((o) => items.push({
      kind: 'opportunity', id: o.id, date: o.nextFollowUp, note: o.followUpNote,
      title: o.title, sub: o.org, entity: o,
    }));
  state.contacts
    .filter((c) => !c.archived && c.nextFollowUp)
    .forEach((c) => items.push({
      kind: 'contact', id: c.id, date: c.nextFollowUp, note: c.followUpNote,
      title: c.name, sub: c.org, entity: c,
    }));
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function countDueFollowUps() {
  const today = todayISODate();
  return listFollowUps().filter((f) => f.date <= today).length;
}

export function clearFollowUp(kind, id) {
  if (kind === 'opportunity') updateOpportunity(id, { nextFollowUp: null, followUpNote: '' });
  else updateContact(id, { nextFollowUp: null, followUpNote: '' });
}

export function rescheduleFollowUp(kind, id, isoDate, note) {
  const patch = { nextFollowUp: isoDate };
  if (note !== undefined) patch.followUpNote = note;
  if (kind === 'opportunity') updateOpportunity(id, patch);
  else updateContact(id, patch);
}

// ---------- Import / export ----------

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  state = {
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
    meta: parsed.meta || { createdAt: nowISO() },
  };
  persist();
}

export function wipeAllData() {
  state = emptyState();
  persist();
}

export function dataStats() {
  return {
    opportunities: state.opportunities.length,
    contacts: state.contacts.length,
    createdAt: state.meta.createdAt,
  };
}

export { uid, nowISO, todayISODate };
