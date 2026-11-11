// ===== Hash Router =====

const routes = [];
let navigationId = 0;
let requestedPath = '';
const lifecycleListeners = new Set();

export function subscribeRouteLifecycle(listener) {
  lifecycleListeners.add(listener);
  return () => lifecycleListeners.delete(listener);
}

function notifyLifecycle(event) {
  for (const listener of [...lifecycleListeners]) listener(event);
}

const followFocusKeys = new Set(['follow-team', 'follow-only', 'follow-retry', 'follow-stage-all', 'follow-stage-group',
  'follow-stage-round_of_32', 'follow-stage-round_of_16', 'follow-stage-quarterfinal',
  'follow-stage-semifinal', 'follow-stage-third_place', 'follow-stage-final']);
const dateFocusKeys = new Set(['schedule-date-start', 'schedule-date-end', 'schedule-date-apply', 'schedule-date-clear']);
const shellFocusKeys = new Set(['/', '/schedule', '/groups', '/bracket', '/teams', '/history', '/awards'].map(path => 'shell-nav:' + path));

function resolveFocusElement(description, app) {
  if (description?.kind === 'element') {
    const element = description.element;
    return element?.ownerDocument === document && !app.contains(element) ? element : null;
  }
  if (description?.kind !== 'key') return null;
  const key = description.key;
  let attribute, root = app;
  if (followFocusKeys.has(key)) attribute = 'data-follow-focus';
  else if (dateFocusKeys.has(key)) attribute = 'data-date-focus';
  else if (typeof key === 'string' && (/^schedule-match:\d+$/.test(key) || key === 'schedule-choose-teams')) attribute = 'data-route-focus';
  else if (shellFocusKeys.has(key)) { attribute = 'data-route-focus'; root = document; }
  else return null;
  return [...root.querySelectorAll('[' + attribute + ']')].find(element => element.getAttribute(attribute) === key) || null;
}

function focusAvailable(element) {
  if (!element?.isConnected || element.matches(':disabled')) return false;
  for (let node = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node.hidden || node.hasAttribute('inert') || style.display === 'none' ||
        style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
  }
  element.focus?.({ preventScroll: true });
  return document.activeElement === element;
}

function captureSelection(element) {
  if (element !== document.activeElement || typeof element?.selectionStart !== 'number') return null;
  return { value: element.value, start: element.selectionStart, end: element.selectionEnd, direction: element.selectionDirection };
}

export function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

function getHash() {
  return location.hash.slice(1) || '/';
}

function matchRoute(path) {
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      return { handler: route.handler, params: match.slice(1) };
    }
  }
  return null;
}

export async function handleRoute(options = {}) {
  const requestId = ++navigationId;
  const path = getHash();
  const matched = matchRoute(path);

  const app = document.getElementById('app');
  if (!app) return { committed: false, path };
  if (path !== requestedPath) {
    const from = requestedPath;
    requestedPath = path;
    notifyLifecycle({ type: 'navigation', from, to: path, navigationId: requestId });
  }
  let currentView;

  // Show loading
  if (!options.preserveScroll) {
    app.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p id="loadingText">Loading...</p></div>';
  }

  // Update loading text
  const loadingText = document.getElementById('loadingText');
  if (loadingText) {
    const lang = window.__lang || 'zh';
    loadingText.textContent = lang === 'zh' ? '加载中...' : 'Loading...';
  }

  try {
    if (matched) {
      currentView = await matched.handler(...matched.params);
    } else {
      // 404
      const { default: notFound } = await import('./views/not-found.js');
      currentView = notFound();
    }
  } catch (e) {
    console.error('Route error:', e);
    currentView = `<div class="loading"><p>Error: ${e.message}</p></div>`;
  }

  // A slower, older route must never replace the currently requested page.
  if (requestId !== navigationId) return { committed: false, path };

  const focus = typeof options.resolveFocusTarget === 'function'
    ? options.resolveFocusTarget()
    : { target: { kind: 'key', key: options.focusKey } };
  const selection = captureSelection(resolveFocusElement(focus?.target, app));
  if (requestId !== navigationId) return { committed: false, path };
  app.innerHTML = currentView;
  app.classList.add('app-container');
  notifyLifecycle({ type: 'rendered', path, navigationId: requestId });
  if (requestId !== navigationId) return { committed: false, path };

  // Keep control refreshes visible; a new fade starts at opacity zero and
  // would make otherwise available controls fail synchronous focus recovery.
  app.style.animation = 'none';
  if (!options.preserveScroll) {
    void app.offsetWidth;
    app.style.animation = '';
  }

  // Update nav active state
  updateNavActive(path);

  // Add mouse tracking to match cards for radial glow effect
  document.querySelectorAll('.match-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', x + '%');
      card.style.setProperty('--my', y + '%');
    });
  });

  // Scroll to top
  if (!options.preserveScroll) window.scrollTo(0, 0);
  const target = resolveFocusElement(focus?.target, app);
  if (focusAvailable(target)) {
    if (selection && target.value === selection.value) {
      target.setSelectionRange(selection.start, selection.end, selection.direction);
    }
  } else {
    focusAvailable(resolveFocusElement(focus?.fallback, app));
  }
  return { committed: true, path };
}

function updateNavActive(path) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href').slice(1);
    const isActive = path === href || (href !== '/' && path.startsWith(href));
    link.classList.toggle('active', isActive || (path === '/' && href === '/'));
  });
}

export function navigate(path) {
  location.hash = path;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  document.addEventListener('click', (event) => {
    const routeTarget = event.target.closest('[data-route]');
    if (!routeTarget) return;
    const path = routeTarget.dataset.route;
    if (!path) return;
    event.preventDefault();
    navigate(path);
  });
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (!image.matches?.('img.flag')) return;
    image.style.display = 'none';
    const fallback = image.nextElementSibling;
    if (fallback?.classList.contains('flag-fallback')) fallback.style.display = 'flex';
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const routeTarget = event.target.closest?.('[data-route][role="link"]');
    if (!routeTarget) return;
    event.preventDefault();
    navigate(routeTarget.dataset.route);
  });
  handleRoute();
}
