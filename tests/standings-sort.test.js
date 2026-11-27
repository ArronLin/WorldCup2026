import { describe, expect, it } from 'vitest';
import { SORT_METRICS, nextSortState, sortStandings } from '../src/standings-sort.js';

const freezeRows = rows => Object.freeze(rows.map(row => Object.freeze(row)));
const order = rows => rows.map(row => row.code);

describe('积分榜排序状态', () => {
  it('仅支持四项指标', () => {
    expect(SORT_METRICS).toEqual(['points', 'goalsFor', 'goalsAgainst', 'goalDifference']);
    expect(nextSortState(null, 'position')).toBeNull();
  });

  it.each(['points', 'goalsFor', 'goalsAgainst', 'goalDifference'])('%s 首选、翻转和切回', metric => {
    const direction = metric === 'goalsAgainst' ? 'ascending' : 'descending';
    const first = nextSortState(null, metric);
    expect(first).toEqual({ metric, direction });
    const flipped = nextSortState(first, metric);
    expect(flipped).toEqual({ metric, direction: direction === 'ascending' ? 'descending' : 'ascending' });
    expect(nextSortState(flipped, metric)).toEqual(first);
    const other = nextSortState(flipped, metric === 'points' ? 'goalsFor' : 'points');
    expect(nextSortState(other, metric)).toEqual(first);
  });
});

describe('稳定数值排序', () => {
  it.each(['points', 'goalsFor', 'goalsAgainst'])('%s 按数值而非文字排序', metric => {
    const rows = freezeRows([{ code: 'A', [metric]: 9 }, { code: 'B', [metric]: 2 }, { code: 'C', [metric]: 10 }]);
    expect(order(sortStandings(rows, { metric, direction: 'ascending' }))).toEqual(['B', 'A', 'C']);
    expect(order(sortStandings(rows, { metric, direction: 'descending' }))).toEqual(['C', 'A', 'B']);
  });

  it('净胜球正确处理负数、零和正数', () => {
    const rows = freezeRows([0, -3, 2, -1].map((goalDifference, i) => ({ code: i, goalDifference })));
    expect(sortStandings(rows, { metric: 'goalDifference', direction: 'descending' }).map(r => r.goalDifference)).toEqual([2, 0, -1, -3]);
    expect(sortStandings(rows, { metric: 'goalDifference', direction: 'ascending' }).map(r => r.goalDifference)).toEqual([-3, -1, 0, 2]);
  });

  it('切换指标后仍按初始顺序消解并列和无效值，并保留完整记录', () => {
    const rows = freezeRows([
      { code: 'A', points: 2, goalsFor: 1 }, { code: 'B', points: null, goalsFor: 8 },
      { code: 'C', points: 2, goalsFor: 9 }, { code: 'D', goalsFor: 7 },
      { code: 'E', points: '9', goalsFor: 6 }, { code: 'F', points: NaN, goalsFor: 5 },
      { code: 'G', points: Infinity, goalsFor: 4 }, { code: 'H', points: -Infinity, goalsFor: 3 },
      { code: 'I', points: 0, goalsFor: 2 },
    ].map((row, i) => ({ position: i + 1, goalsAgainst: i, goalDifference: 1 - i, ...row })));
    const snapshot = rows.map(row => ({ ...row }));
    const other = nextSortState(null, 'goalsFor');
    expect(order(sortStandings(rows, other))).toEqual(['C', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'A']);
    const descending = nextSortState(other, 'points');
    for (const [state, expected] of [[descending, ['A','C','I','B','D','E','F','G','H']], [nextSortState(descending, 'points'), ['I','A','C','B','D','E','F','G','H']]]) {
      const result = sortStandings(rows, state);
      expect(order(result)).toEqual(expected);
      expect(result).toHaveLength(rows.length);
      result.forEach(row => {
        expect(row).toBe(rows.find(original => original.code === row.code));
        expect(row).toEqual(snapshot.find(original => original.code === row.code));
      });
      expect(rows).toEqual(snapshot);
    }
  });

  it('空组、单队、全同值和未排序状态', () => {
    const rows = freezeRows([{ code: 'A', points: 0 }, { code: 'B', points: 0 }]);
    for (const direction of ['ascending', 'descending']) {
      const state = { metric: 'points', direction };
      expect(sortStandings(Object.freeze([]), state)).toEqual([]);
      expect(sortStandings(Object.freeze([rows[0]]), state)).toEqual([rows[0]]);
      expect(sortStandings(rows, state)).toEqual(rows);
    }
    expect(sortStandings(rows, null)).toEqual(rows);
    expect(sortStandings(rows, { metric: 'position', direction: 'ascending' })).toEqual(rows);
  });
});
