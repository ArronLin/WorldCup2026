import { it, expect } from 'vitest';
import { countTeamGroups, setGroups, getCounts } from '../src/features/team-group-filter/count.js';
const groups = [{ key: 'A', teams: [{}, {}] }, { key: 'B', teams: [{}] }, { key: 'C', teams: [{}, {}, {}] }];
it('count-all', () => { expect(countTeamGroups(groups, [])).toEqual({ visible: 6, total: 6 }); });
it('count-unequal-union', () => {
  const before = JSON.stringify(groups);
  expect(countTeamGroups(groups, ['A', 'C', 'A'])).toEqual({ visible: 5, total: 6 });
  expect(countTeamGroups(groups, ['B'])).toEqual({ visible: 1, total: 6 });
  expect(JSON.stringify(groups)).toBe(before);
});
it('count-unknown', () => {
  const data = [...groups, { key: '', teams: [{}] }];
  expect(countTeamGroups(data, [])).toEqual({ visible: 7, total: 7 });
  expect(countTeamGroups(data, ['A'])).toEqual({ visible: 2, total: 7 });
});
it('count-data-replacement', () => {
  setGroups(groups); expect(getCounts(['C'])).toEqual({ visible: 3, total: 6 });
  setGroups([{ key: 'C', teams: [{}] }]); expect(getCounts(['C'])).toEqual({ visible: 1, total: 1 });
  setGroups([]); expect(getCounts([])).toEqual({ visible: 0, total: 0 });
  expect(countTeamGroups([], [])).toEqual({ visible: 0, total: 0 });
});
