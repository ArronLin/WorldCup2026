import { it, expect } from 'vitest';
import { stageOrder, matchCategory, isFilterStage } from '../src/features/follow-teams/matches.js';
it('defines the existing ordered stages once and classifies every supported match', () => {
  expect(stageOrder).toEqual(['group','round_of_32','round_of_16','quarterfinal','semifinal','third_place','final']);
  expect(matchCategory({stage:'group'})).toBe('group');
  for(const round of stageOrder.slice(1)) expect(matchCategory({stage:'knockout',round})).toBe(round);
  expect(isFilterStage('all')).toBe(true);
  for(const stage of stageOrder) expect(isFilterStage(stage)).toBe(true);
});
it('rejects unsupported or missing stages and filter values', () => {
  for(const match of [null,{}, {stage:'knockout'}, {stage:'unknown'}, {stage:'knockout',round:'unknown'}]) expect(matchCategory(match)).toBeNull();
  for(const value of [null,{},'ALL','', 'unknown']) expect(isFilterStage(value)).toBe(false);
});
