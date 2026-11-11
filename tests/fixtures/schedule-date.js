// Controlled test data only; never replace the published tournament snapshot.
export const dateTeams = Object.fromEntries(['ARG', 'BRA', 'ESP', 'FRA'].map(code => [code, {
  code, name: { zh: code, en: code }, group: 'A', stats: {},
}]));

function match(id, date, home, away, stage = 'group') {
  return { id, date, stage, group: stage === 'group' ? 'A' : undefined,
    ...(stage === 'knockout' ? { round: 'final' } : {}),
    home: { code: home }, away: { code: away }, homeScore: 1, awayScore: 0 };
}

export const dateMatches = [
  match(101, '2026-06-11', 'ARG', 'BRA'),
  match(102, '2026-06-12', 'ESP', 'ARG'),
  match(103, '2026-06-13', 'BRA', 'ESP', 'knockout'),
];

export const combinationMatches = [
  match(201, '2026-06-12', 'ARG', 'BRA'), // both teams may be followed
  match(202, '2026-06-13', 'ARG', 'ESP'), // outside June 12
  match(203, '2026-06-12', 'ARG', 'BRA', 'knockout'), // wrong stage
  match(204, '2026-06-12', 'ESP', 'FRA'), // neither team followed
];
export const invalidDateMatches = [{ ...dateMatches[0], date: '2026-02-30' }];
export const emptyRange = { start: '2026-06-14', end: '2026-06-15' };

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
