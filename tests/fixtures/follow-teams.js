export const teams = Object.fromEntries(['ARG', 'BRA', 'ESP'].map(code => [code, {
  code, name: { zh: code, en: code }, group: 'A', stats: {},
}]));
export const matches = [
  { id: 1, stage: 'group', group: 'A', date: '2026-06-11', home: { code: 'ARG' }, away: { code: 'BRA' }, homeScore: 1, awayScore: 0 },
  { id: 2, stage: 'group', group: 'A', date: '2026-06-12', home: { code: 'ESP' }, away: { code: 'ARG' }, homeScore: 0, awayScore: 0 },
  { id: 3, stage: 'knockout', round: 'final', date: '2026-07-19', home: { code: 'BRA' }, away: { code: 'ESP' }, homeScore: 0, awayScore: 1 },
];
export function memoryStorage(initial = null) {
  let value = initial;
  return {
    read: () => ({ ok: true, value }),
    write: (_key, next) => { value = next; return { ok: true }; },
    value: () => value,
  };
}
