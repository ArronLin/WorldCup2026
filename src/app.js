// ===== App Entry Point =====
import { initI18n, toggleLang, t } from './i18n.js';
import { initRouter, addRoute, navigate, handleRoute } from './router.js';
import { getPlayerNames } from './store.js';
import { initSearch, refreshSearch } from './features/search/index.js';

// Theme management
function detectTheme() {
  const saved = localStorage.getItem('wc2026-theme');
  if (saved) return saved;
  return 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wc2026-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Register routes
addRoute(/^\/?$/, async () => {
  const { default: view } = await import('./views/home.js');
  return view();
});
addRoute(/^\/schedule\/?$/, async () => {
  const { default: view } = await import('./views/schedule.js');
  return view();
});
addRoute(/^\/groups\/?$/, async () => {
  const { default: view } = await import('./views/group-standings.js');
  return view();
});
addRoute(/^\/bracket\/?$/, async () => {
  const { default: view } = await import('./views/bracket.js');
  return view();
});
addRoute(/^\/teams\/?$/, async () => {
  const { default: view } = await import('./views/teams.js');
  return view();
});
addRoute(/^\/awards\/?$/, async () => {
  const { default: view } = await import('./views/awards.js');
  return view();
});
addRoute(/^\/match\/(\d+)\/?$/, async (id) => {
  const { default: view } = await import('./views/match-detail.js');
  return view(id);
});
addRoute(/^\/team\/([A-Z]{3})\/?$/, async (code) => {
  const { default: view } = await import('./views/team-detail.js');
  return view(code);
});

// Build navigation
function buildNav() {
  const items = [
    { href: '#/', label: t('nav.home') },
    { href: '#/schedule', label: t('nav.schedule') },
    { href: '#/groups', label: t('nav.groups') },
    { href: '#/bracket', label: t('nav.bracket') },
    { href: '#/teams', label: t('nav.teams') },
    { href: '#/awards', label: t('nav.awards') },
  ];
  const nav = document.getElementById('navLinks');
  nav.innerHTML = items.map(i => `<a href="${i.href}" class="nav-link">${i.label}</a>`).join('');
}

// Update language toggle button
function updateLangToggle() {
  const lang = document.documentElement.lang;
  const btn = document.querySelector('.lang-current');
  if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中文';
}

// Update footer
function updateFooter() {
  const ft = document.getElementById('footerText');
  if (ft) ft.textContent = t('footer.text');
}

// Handle language change — re-render everything
document.addEventListener('langchange', () => {
  buildNav();
  updateLangToggle();
  updateFooter();
  refreshSearch();
  window.__refreshChat?.();
  // Re-render current view directly
  handleRoute();
});

// Initialize
async function init() {
  // Apply saved theme early
  applyTheme(detectTheme());

  await initI18n();

  // Pre-load player name translations for Chinese display
  try {
    window.__playerNames = await getPlayerNames();
  } catch (e) {
    window.__playerNames = {};
  }

  buildNav();
  updateLangToggle();
  updateFooter();

  // Language toggle
  document.getElementById('langToggle').addEventListener('click', () => {
    toggleLang();
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    toggleTheme();
  });

  // Start router
  initRouter();

  // These features must not delay first contentful render.
  void initSearch();
  import('./features/chat/index.js')
    .then(({ initChat, refreshChat }) => {
      window.__refreshChat = refreshChat;
      return initChat();
    })
    .catch((error) => console.warn('Chat failed to initialize:', error));
}

init();
