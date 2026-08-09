// ===== Hash Router =====

const routes = [];
let currentView = null;
let navigationId = 0;

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

export async function handleRoute() {
  const requestId = ++navigationId;
  const path = getHash();
  const matched = matchRoute(path);

  const app = document.getElementById('app');
  if (!app) return;

  // Show loading
  app.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p id="loadingText">Loading...</p></div>';

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
  if (requestId !== navigationId) return;

  app.innerHTML = currentView;
  app.classList.add('app-container');

  // Re-trigger animation
  app.style.animation = 'none';
  void app.offsetWidth;
  app.style.animation = '';

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
  window.scrollTo(0, 0);
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
