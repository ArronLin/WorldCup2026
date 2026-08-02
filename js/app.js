// ===== App Entry Point =====
import { initI18n, toggleLang, getLang, t } from './i18n.js';
import { initRouter, addRoute, navigate, handleRoute } from './router.js';
import { getPlayerNames } from './store.js';

// Cache-busting version for dynamic imports
const V = '?v=5';

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
  const { default: view } = await import('./views/home.js' + V);
  return view();
});
addRoute(/^\/schedule\/?$/, async () => {
  const { default: view } = await import('./views/schedule.js' + V);
  return view();
});
addRoute(/^\/groups\/?$/, async () => {
  const { default: view } = await import('./views/group-standings.js' + V);
  return view();
});
addRoute(/^\/bracket\/?$/, async () => {
  const { default: view } = await import('./views/bracket.js' + V);
  return view();
});
addRoute(/^\/teams\/?$/, async () => {
  const { default: view } = await import('./views/teams.js' + V);
  return view();
});
addRoute(/^\/awards\/?$/, async () => {
  const { default: view } = await import('./views/awards.js' + V);
  return view();
});
addRoute(/^\/match\/(\d+)\/?$/, async (id) => {
  const { default: view } = await import('./views/match-detail.js' + V);
  return view(id);
});
addRoute(/^\/team\/([A-Z]{3})\/?$/, async (code) => {
  const { default: view } = await import('./views/team-detail.js' + V);
  return view(code);
});

// Build navigation
function buildNav() {
  const lang = getLang();
  const items = [
    { href: '#/', label: lang === 'zh' ? '首页' : 'Home' },
    { href: '#/schedule', label: lang === 'zh' ? '赛程' : 'Schedule' },
    { href: '#/groups', label: lang === 'zh' ? '积分榜' : 'Standings' },
    { href: '#/bracket', label: lang === 'zh' ? '淘汰赛' : 'Bracket' },
    { href: '#/teams', label: lang === 'zh' ? '球队' : 'Teams' },
    { href: '#/awards', label: lang === 'zh' ? '奖项' : 'Awards' },
  ];
  const nav = document.getElementById('navLinks');
  nav.innerHTML = items.map(i => `<a href="${i.href}" class="nav-link">${i.label}</a>`).join('');
}

// Update language toggle button
function updateLangToggle() {
  const lang = getLang();
  const btn = document.querySelector('.lang-current');
  if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中文';
}

// Update footer
function updateFooter() {
  const lang = getLang();
  const ft = document.getElementById('footerText');
  if (ft) {
    ft.innerHTML = lang === 'zh'
      ? '2026 FIFA 世界杯 · 数据来源：Wikipedia / football-data.org · 仅供学习参考'
      : '2026 FIFA World Cup · Data: Wikipedia / football-data.org · For educational reference only';
  }
}

// Handle language change — re-render everything
document.addEventListener('langchange', () => {
  buildNav();
  updateLangToggle();
  updateFooter();
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
}

init();
