import { it, expect } from 'vitest';
import { buildTeamGroups, isGroupVisible, createGroupFilterState } from '../src/features/team-group-filter/state.js';

it('groups in letter order while keeping team order, including all missing-group forms', () => {
  const teams = { CCC: { code: 'CCC', group: 'C' }, AAB: { code: 'AAB', group: 'A' }, AAA: { code: 'AAA', group: 'A' },
    XXX: { code: 'XXX' }, XXY: { code: 'XXY', group: null }, XXZ: { code: 'XXZ', group: '' }, ZZZ: { code: 'ZZZ', group: '  ' } };
  const groups = buildTeamGroups(teams);
  expect(groups.map(g => g.key)).toEqual(['A', 'C', '']);
  expect(groups[0].teams.map(t => t.code)).toEqual(['AAB', 'AAA']);
  expect(groups[2].teams.map(t => t.code)).toEqual(['XXX', 'XXY', 'XXZ', 'ZZZ']);
  expect(buildTeamGroups({})).toEqual([]);
});
it('empty selection shows all; selection is a union and excludes unknown groups', () => {
  expect(['A', 'B', 'C', ''].filter(g => isGroupVisible(g, []))).toEqual(['A', 'B', 'C', '']);
  expect(['A', 'B', 'C', ''].filter(g => isGroupVisible(g, ['A', 'C']))).toEqual(['A', 'C']);
});
it('selects, adds, cancels and clears without duplicate selections', () => {
  const state = createGroupFilterState(); state.syncGroups(['A', 'B', 'C']);
  state.setSelected('A', true); state.setSelected('A', true); state.setSelected('C', true);
  expect(state.getSnapshot().selectedGroups).toEqual(['A', 'C']);
  state.setSelected('A', false); expect(state.getSnapshot().selectedGroups).toEqual(['C']);
  state.setSelected('C', false); expect(state.getSnapshot().selectedGroups).toEqual([]);
  state.setSelected('B', true); state.clear(); state.clear(); expect(state.getSnapshot().selectedGroups).toEqual([]);
});
it('rejects unavailable groups and keeps only valid selections on synchronization', () => {
  const state = createGroupFilterState(); state.syncGroups(['C', '', 'A', 'A']);
  state.setSelected('Z', true); state.setSelected('', true); state.setSelected('A', true); state.setSelected('C', true);
  expect(state.getSnapshot()).toEqual({ availableGroups: ['A', 'C'], selectedGroups: ['A', 'C'] });
  state.syncGroups(['C', 'B']); expect(state.getSnapshot().selectedGroups).toEqual(['C']);
  state.syncGroups([]); expect(state.getSnapshot().selectedGroups).toEqual([]);
});
it('snapshots are copies and new document instances start empty', () => {
  const state = createGroupFilterState(); state.syncGroups(['A']); state.setSelected('A', true);
  const snapshot = state.getSnapshot(); snapshot.availableGroups.push('Z'); snapshot.selectedGroups.length = 0;
  expect(state.getSnapshot()).toEqual({ availableGroups: ['A'], selectedGroups: ['A'] });
  expect(createGroupFilterState().getSnapshot().selectedGroups).toEqual([]);
});
it('handles all selections and rapid changes according to the last checked value', () => {
  const state = createGroupFilterState(); state.syncGroups(['A', 'B', 'C']);
  for (const key of ['A', 'B', 'C']) state.setSelected(key, true);
  expect(['A', 'B', 'C'].filter(g => isGroupVisible(g, state.getSnapshot().selectedGroups))).toEqual(['A', 'B', 'C']);
  for (let i = 0; i < 10; i++) state.setSelected('A', i % 2 === 0);
  expect(state.getSnapshot().selectedGroups).toEqual(['B', 'C']);
});
