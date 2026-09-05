// Synchronisation optionnelle via OneDrive (Microsoft Graph), pour partager
// les données entre plusieurs appareils (ex. iPhone + PC). Le fichier vit
// réellement dans le OneDrive de l'utilisateur (dossier "IveaCoach" à la
// racine), donc visible/synchronisé normalement sur PC.
//
// Tout est facultatif : sans "Client ID" configuré (voir Réglages), ce
// module ne fait rien et l'app continue de fonctionner en local uniquement.
//
// Stratégie de synchro (simple, adaptée à un usage personnel mono-utilisateur) :
// - meta.updatedAt (store.js) est comparé à la dernière valeur connue comme
//   synchronisée (localStorage) pour savoir si LOCAL a changé depuis le
//   dernier sync, et comparé au meta.updatedAt du fichier distant pour
//   savoir si DISTANT a changé.
// - Un seul côté a changé -> on prend l'autre (pull) ou on envoie (push).
// - Aucun côté n'a changé -> rien à faire.
// - Les deux ont changé depuis le dernier sync -> conflit, on laisse
//   l'utilisateur choisir (voir resolveConflict).

import * as store from './store.js';

const AUTHORITY = 'https://login.microsoftonline.com/consumers';
const SCOPES = ['Files.ReadWrite', 'offline_access'];
const GRAPH_FILE_URL = 'https://graph.microsoft.com/v1.0/me/drive/root:/IveaCoach/ivea-coach-data.json:/content';
const LS_CLIENT_ID = 'ivea_onedrive_client_id';
const LS_LAST_SYNCED_AT = 'ivea_onedrive_last_synced_at';

let msalInstance = null;
let msalReady = null;
let pushTimer = null;

export function getClientId() {
  return localStorage.getItem(LS_CLIENT_ID) || '';
}

export function setClientId(id) {
  localStorage.setItem(LS_CLIENT_ID, id.trim());
  msalInstance = null;
  msalReady = null;
}

export function clearClientId() {
  localStorage.removeItem(LS_CLIENT_ID);
  localStorage.removeItem(LS_LAST_SYNCED_AT);
  msalInstance = null;
  msalReady = null;
}

export function isConfigured() {
  return !!getClientId() && typeof window.msal !== 'undefined';
}

export function msalLibMissing() {
  return !!getClientId() && typeof window.msal === 'undefined';
}

function redirectUri() {
  // Normalisé sans "index.html" final : l'app ouverte depuis l'écran
  // d'accueil (start_url du manifest) charge .../index.html alors que
  // Safari affiche .../ivea-coach/ sans suffixe. Sans cette normalisation,
  // l'URI de redirection ne correspondrait pas selon la façon dont l'app a
  // été ouverte, et Azure AD refuserait la connexion dans l'un des deux cas.
  return (window.location.origin + window.location.pathname).replace(/index\.html$/, '');
}

async function getMsal() {
  if (!msalInstance) {
    msalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId: getClientId(),
        authority: AUTHORITY,
        redirectUri: redirectUri(),
      },
      cache: { cacheLocation: 'localStorage' },
    });
    msalReady = msalInstance.initialize();
  }
  await msalReady;
  return msalInstance;
}

// À appeler une fois au démarrage de l'app, avant tout autre appel MSAL :
// termine la redirection de connexion si l'utilisateur en revient tout juste.
export async function handleRedirectResult() {
  if (!isConfigured()) return;
  try {
    const msal = await getMsal();
    await msal.handleRedirectPromise();
  } catch (e) {
    console.error('OneDrive: échec du retour de connexion', e);
  }
}

export function getAccount() {
  if (!isConfigured() || !msalInstance) return null;
  const accounts = msalInstance.getAllAccounts();
  return accounts[0] || null;
}

export function isSignedIn() {
  return !!getAccount();
}

export async function signIn() {
  const msal = await getMsal();
  await msal.loginRedirect({ scopes: SCOPES });
}

export async function signOut() {
  const msal = await getMsal();
  const account = getAccount();
  await msal.logoutRedirect({ account, postLogoutRedirectUri: redirectUri() });
}

async function getToken() {
  const msal = await getMsal();
  const account = getAccount();
  if (!account) throw new Error('Non connecté à OneDrive');
  try {
    const result = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return result.accessToken;
  } catch (e) {
    // Le rafraîchissement silencieux a échoué (session expirée) : on relance
    // une connexion interactive plutôt que de rester bloqué silencieusement.
    await msal.acquireTokenRedirect({ scopes: SCOPES });
    throw e;
  }
}

async function fetchRemote() {
  const token = await getToken();
  const res = await fetch(GRAPH_FILE_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OneDrive: lecture impossible (${res.status})`);
  return res.json();
}

async function pushRemote(dataString) {
  const token = await getToken();
  const res = await fetch(GRAPH_FILE_URL, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: dataString,
  });
  if (!res.ok) throw new Error(`OneDrive: écriture impossible (${res.status})`);
}

function lastSyncedAt() {
  return localStorage.getItem(LS_LAST_SYNCED_AT) || '';
}
function setLastSyncedAt(iso) {
  localStorage.setItem(LS_LAST_SYNCED_AT, iso);
}
export function getLastSyncedAt() {
  return lastSyncedAt() || null;
}

// Résultat possible : { status: 'noop' | 'pushed' | 'pulled' | 'conflict' | 'error', error? }
export async function syncNow() {
  if (!isConfigured() || !isSignedIn()) return { status: 'noop' };
  try {
    const remote = await fetchRemote();
    const localMeta = store.getMeta();
    const synced = lastSyncedAt();

    if (!remote) {
      await pushRemote(store.exportData());
      setLastSyncedAt(store.getMeta().updatedAt);
      return { status: 'pushed' };
    }

    const remoteUpdatedAt = remote.meta?.updatedAt || '';
    const localChanged = localMeta.updatedAt !== synced;
    const remoteChanged = remoteUpdatedAt !== synced;

    if (!localChanged && !remoteChanged) return { status: 'noop' };

    if (localChanged && !remoteChanged) {
      await pushRemote(store.exportData());
      setLastSyncedAt(store.getMeta().updatedAt);
      return { status: 'pushed' };
    }

    if (!localChanged && remoteChanged) {
      store.replaceAllData(JSON.stringify(remote));
      setLastSyncedAt(remoteUpdatedAt);
      return { status: 'pulled' };
    }

    // Les deux ont changé depuis le dernier sync réussi : on ne choisit pas
    // à la place de l'utilisateur.
    return {
      status: 'conflict',
      localUpdatedAt: localMeta.updatedAt,
      remoteUpdatedAt,
      remote,
    };
  } catch (e) {
    console.error('Synchronisation OneDrive impossible', e);
    return { status: 'error', error: e.message };
  }
}

export async function resolveConflict(direction, remote) {
  if (direction === 'local') {
    await pushRemote(store.exportData());
    setLastSyncedAt(store.getMeta().updatedAt);
  } else {
    store.replaceAllData(JSON.stringify(remote));
    setLastSyncedAt(remote.meta?.updatedAt || '');
  }
}

// Envoi différé : après chaque modification locale, on attend un peu (au
// cas où d'autres modifications suivent) avant d'envoyer vers OneDrive, pour
// éviter une requête réseau à chaque frappe.
document.addEventListener('ivea:data-changed', () => {
  if (!isConfigured() || !isSignedIn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { syncNow(); }, 4000);
});

// Tente d'envoyer immédiatement les changements en attente avant que l'app
// ne passe en arrière-plan ou ne se ferme.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    syncNow();
  }
});
