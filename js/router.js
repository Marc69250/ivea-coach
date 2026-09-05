// Routeur minimal basé sur le hash (#/dashboard, #/pipeline, ...).

const VALID_VIEWS = ['dashboard', 'pipeline', 'contacts', 'followups', 'settings'];
const listeners = [];
let current = 'dashboard';

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  return VALID_VIEWS.includes(raw) ? raw : 'dashboard';
}

export function getCurrentView() {
  return current;
}

export function navigateTo(view) {
  if (!VALID_VIEWS.includes(view)) view = 'dashboard';
  current = view;
  if (location.hash !== `#/${view}`) {
    history.pushState(null, '', `#/${view}`);
  }
  listeners.forEach((cb) => cb(current));
}

export function onNavigate(cb) {
  listeners.push(cb);
}

export function initRouter() {
  current = parseHash();
  window.addEventListener('popstate', () => {
    current = parseHash();
    listeners.forEach((cb) => cb(current));
  });
  return current;
}
