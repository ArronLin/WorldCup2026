import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
export const teams = {
  AAA: { code: 'AAA', group: 'A', name: { zh: '甲队', en: 'Alpha' }, confederation: 'UEFA', ranking: 1 },
  AAB: { code: 'AAB', group: 'A', name: { zh: '乙队', en: 'Beta' } },
  BBB: { code: 'BBB', group: 'B', name: { zh: '丙队', en: 'Gamma' } },
  CCC: { code: 'CCC', group: 'C', name: { zh: '丁队', en: 'Delta' } },
};
export async function mountTeams(data = teams, language = 'zh') {
  vi.resetModules();
  localStorage.clear(); localStorage.setItem('wc2026-lang', language);
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (String(url).includes('i18n/')) return { ok: true, json: async () => JSON.parse(readFileSync(`public/i18n/${String(url).includes('en.json') ? 'en' : 'zh'}.json`, 'utf8')) };
    if (data instanceof Error) throw data;
    return { ok: true, json: async () => data };
  }));
  const i18n = await import('../../src/i18n.js'); await i18n.initI18n();
  const { default: view } = await import('../../src/views/teams.js');
  const { groupFilterState: state } = await import('../../src/features/team-group-filter/state.js');
  const { initTeamGroupFilter } = await import('../../src/features/team-group-filter/controller.js');
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app'); root.innerHTML = await view();
  const dispose = initTeamGroupFilter({ root, state });
  return { root, state, view, i18n, dispose, initTeamGroupFilter };
}
export const visibleCodes = root => [...root.querySelectorAll('.group-card:not([hidden]) [data-route]')].map(el => el.dataset.route.split('/').pop());
export const checkbox = (root, group) => root.querySelector(`input[data-team-group="${group}"]`);
