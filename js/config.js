// Configuration centrale : étapes de pipeline, statuts contacts, sources.
// Toutes les données réelles vivent dans localStorage (voir store.js) ;
// ce fichier ne contient que des libellés/couleurs.

export const OPP_TYPES = {
  candidature: { label: 'Candidature', short: 'Poste', icon: '💼' },
  prospection: { label: 'Prospection', short: 'Prospect', icon: '🎯' },
};

export const STAGES = {
  candidature: [
    { key: 'a_postuler', label: 'À postuler', color: '#94a3b8' },
    { key: 'postule', label: 'Envoyée', color: '#60a5fa' },
    { key: 'relance', label: 'Relancée', color: '#38bdf8' },
    { key: 'entretien_rh', label: 'Entretien RH', color: '#fbbf24' },
    { key: 'entretien_tech', label: 'Entretien technique', color: '#f97316' },
    { key: 'cas_pratique', label: 'Test / Cas pratique', color: '#fb923c' },
    { key: 'offre', label: 'Offre reçue', color: '#34d399' },
    { key: 'accepte', label: 'Acceptée', color: '#10b981' },
    { key: 'refuse', label: 'Refusée', color: '#f87171' },
    { key: 'abandonne', label: 'Sans réponse', color: '#cbd5e1' },
  ],
  prospection: [
    { key: 'a_contacter', label: 'À contacter', color: '#94a3b8' },
    { key: 'premier_contact', label: 'Premier contact', color: '#60a5fa' },
    { key: 'rdv', label: 'RDV / Appel', color: '#38bdf8' },
    { key: 'proposition', label: 'Proposition envoyée', color: '#fbbf24' },
    { key: 'negociation', label: 'Négociation', color: '#f97316' },
    { key: 'gagne', label: 'Gagné', color: '#10b981' },
    { key: 'perdu', label: 'Perdu', color: '#f87171' },
  ],
};

// Étapes qui comptent comme "closes" (sorties du pipeline actif)
export const CLOSED_STAGES = ['accepte', 'refuse', 'abandonne', 'gagne', 'perdu'];
// Étapes qui comptent comme "une réponse a été obtenue" (au-delà du simple envoi)
export const RESPONSE_STAGES = {
  candidature: ['entretien_rh', 'entretien_tech', 'cas_pratique', 'offre', 'accepte', 'refuse'],
  prospection: ['rdv', 'proposition', 'negociation', 'gagne', 'perdu'],
};
export const INTERVIEW_STAGES = ['entretien_rh', 'entretien_tech', 'cas_pratique'];
export const WIN_STAGES = ['accepte', 'gagne'];
export const LOSE_STAGES = ['refuse', 'perdu', 'abandonne'];

export const CONTACT_STATUSES = [
  { key: 'a_contacter', label: 'À contacter', color: '#94a3b8' },
  { key: 'contacte', label: 'Contacté', color: '#60a5fa' },
  { key: 'en_echange', label: 'En échange', color: '#fbbf24' },
  { key: 'a_relancer', label: 'À relancer', color: '#f97316' },
  { key: 'actif', label: 'Relation active', color: '#34d399' },
  { key: 'inactif', label: 'Inactif', color: '#cbd5e1' },
];

export const SOURCES = [
  'LinkedIn', 'Site carrière', 'Cooptation', 'Salon / Événement', 'Cabinet de recrutement',
  'Candidature spontanée', 'Recommandation', 'Réseau perso', 'Autre',
];

export function stageInfo(type, key) {
  const list = STAGES[type] || [];
  return list.find((s) => s.key === key) || list[0];
}

export function contactStatusInfo(key) {
  return CONTACT_STATUSES.find((s) => s.key === key) || CONTACT_STATUSES[0];
}
