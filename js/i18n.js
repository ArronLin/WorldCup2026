// ===== i18n Engine =====

let dict = {};
let currentLang = 'zh';

function detectLang() {
  const saved = localStorage.getItem('wc2026-lang');
  if (saved) return saved;
  const nav = navigator.language || 'zh';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export async function initI18n() {
  currentLang = detectLang();
  await loadDict(currentLang);
  document.documentElement.lang = currentLang;
  window.__lang = currentLang;
}

async function loadDict(lang) {
  try {
    const resp = await fetch(`i18n/${lang}.json`);
    dict = await resp.json();
  } catch (e) {
    console.warn('Failed to load i18n dict:', e);
    dict = {};
  }
}

export function t(key, vars) {
  let s = dict[key];
  if (s === undefined) s = key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return s;
}

export async function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('wc2026-lang', lang);
  document.documentElement.lang = lang;
  window.__lang = lang;
  await loadDict(lang);
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export function getLang() { return currentLang; }

export function toggleLang() {
  return setLang(currentLang === 'zh' ? 'en' : 'zh');
}
