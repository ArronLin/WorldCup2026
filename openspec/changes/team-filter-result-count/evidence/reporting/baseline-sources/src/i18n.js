import { browserStorage } from './browser-storage.js';
// ===== i18n Engine =====

let dict = {};
let currentLang = 'zh';
let intendedLang = 'zh';
let requestId = 0;

function detectLang() {
  const saved = browserStorage.read('wc2026-lang').value;
  if (saved === 'zh' || saved === 'en') return saved;
  const nav = navigator.language || 'zh';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export async function initI18n() {
  await requestLanguage(detectLang(), false);
}

async function loadDict(lang) {
  try {
    const resp = await fetch(`i18n/${lang}.json`);
    if (!resp.ok) throw new Error('Dictionary request failed');
    return await resp.json();
  } catch (e) {
    console.warn('Failed to load i18n dict:', e);
    return {};
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

async function requestLanguage(lang, notify) {
  if (lang !== 'zh' && lang !== 'en') return;
  intendedLang = lang;
  const id = ++requestId;
  const nextDict = await loadDict(lang);
  if (id !== requestId) return;
  dict = nextDict;
  currentLang = lang;
  browserStorage.write('wc2026-lang', lang);
  document.documentElement.lang = lang;
  window.__lang = lang;
  if (notify) document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export async function setLang(lang) {
  await requestLanguage(lang, true);
}

export function getLang() { return currentLang; }

export function toggleLang() {
  return setLang(intendedLang === 'zh' ? 'en' : 'zh');
}
