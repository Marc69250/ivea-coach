import { initRouter, onNavigate, navigateTo, getCurrentView } from './router.js';
import * as store from './store.js';
import * as sync from './sync.js';
import * as syncUI from './sync-ui.js';
import * as dashboardView from './views/dashboard.js';
import * as pipelineView from './views/pipeline.js';
import * as contactsView from './views/contacts.js';
import * as followupsView from './views/followups.js';
import * as settingsView from './views/settings.js';

const headerTitle = document.getElementById('header-title');
const viewRoot = document.getElementById('view-root');
const tabBar = document.getElementById('tab-bar');
const fab = document.getElementById('fab');

const VIEW_TITLES = {
  dashboard: 'Tableau de bord',
  pipeline: 'Pipeline',
  contacts: 'Contacts',
  followups: 'Relances',
  settings: 'Réglages',
};

const FAB_VIEWS = new Set(['pipeline', 'contacts']);

function renderView(view) {
  headerTitle.textContent = VIEW_TITLES[view] || '';
  viewRoot.innerHTML = '';

  if (view === 'dashboard') {
    viewRoot.innerHTML = dashboardView.render();
    dashboardView.afterRender(viewRoot);
  } else if (view === 'pipeline') {
    pipelineView.mount(viewRoot);
  } else if (view === 'contacts') {
    contactsView.mount(viewRoot);
  } else if (view === 'followups') {
    followupsView.mount(viewRoot);
  } else if (view === 'settings') {
    settingsView.mount(viewRoot);
  }

  tabBar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  fab.hidden = !FAB_VIEWS.has(view);

  updateBadges();
  viewRoot.scrollTop = 0;
}

function updateBadges() {
  const due = store.countDueFollowUps();
  const badge = tabBar.querySelector('[data-badge="followups"]');
  if (due > 0) {
    badge.textContent = due > 99 ? '99+' : String(due);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

tabBar.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

fab.addEventListener('click', () => {
  const view = getCurrentView();
  if (view === 'pipeline') pipelineView.openCreateForm();
  if (view === 'contacts') contactsView.openCreateForm();
});

onNavigate(renderView);
renderView(initRouter());

// PWA offline : service worker (best-effort, ne bloque jamais le rendu de l'app)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Synchronisation OneDrive (facultative, voir Réglages) : termine une
// éventuelle connexion en cours, puis tente une synchro silencieuse au
// démarrage pour récupérer les changements faits sur un autre appareil.
syncUI.setOnDataChanged(() => renderView(getCurrentView()));
sync.handleRedirectResult().then(() => syncUI.runSync({ silent: true }));
