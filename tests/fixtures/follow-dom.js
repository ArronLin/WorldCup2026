import { readFileSync } from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { teams, matches } from './follow-teams.js';
export const dictionaries = Object.fromEntries(['zh','en'].map(lang=>[lang,JSON.parse(readFileSync(path.resolve(process.cwd(),'public/i18n',`${lang}.json`),'utf8'))]));
export function installFetch() {
  const fixture = { teams, matches, 'player-names':{}, venues:{} };
  const mock=vi.fn(async url=>{
    const lang=String(url).match(/i18n\/(zh|en)\.json/)?.[1];
    const key=String(url).match(/\/data\/([^/]+)\.json/)?.[1];
    return {ok:true,json:async()=>lang?dictionaries[lang]:fixture[key]??{}};
  });
  vi.stubGlobal('fetch',mock);return mock;
}
export async function prepareDom() {
  localStorage.clear();localStorage.setItem('wc2026-lang','zh');
  document.body.innerHTML='<div id="navLinks"></div><div id="footerText"></div><button id="langToggle"><span class="lang-current"></span></button><button id="themeToggle"></button><div id="app"></div>';
  window.scrollTo=vi.fn();installFetch();
  const i18n=await import('../../src/i18n.js');
  await i18n.initI18n();
  return i18n;
}

