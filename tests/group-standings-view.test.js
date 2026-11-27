// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import zh from '../public/i18n/zh.json';
import en from '../public/i18n/en.json';
import { setLang, t } from '../src/i18n.js';
import { getStandings } from '../src/store.js';
import standingsView from '../src/views/group-standings.js';

vi.mock('../src/store.js', async (importOriginal) => ({
  ...await importOriginal(),
  getStandings: vi.fn(),
}));

const columns = [
  { key: 'points', index: 9, label: 'standings.pts', direction: 'descending', first: ['BRA', 'JPN', 'CAN', 'ARG'], second: ['ARG', 'JPN', 'CAN', 'BRA'] },
  { key: 'goalsFor', index: 6, label: 'standings.gf', direction: 'descending', first: ['JPN', 'BRA', 'CAN', 'ARG'], second: ['ARG', 'BRA', 'CAN', 'JPN'] },
  { key: 'goalsAgainst', index: 7, label: 'standings.ga', direction: 'ascending', first: ['BRA', 'JPN', 'CAN', 'ARG'], second: ['ARG', 'JPN', 'CAN', 'BRA'] },
  { key: 'goalDifference', index: 8, label: 'standings.gd', direction: 'descending', first: ['BRA', 'CAN', 'ARG', 'JPN'], second: ['JPN', 'ARG', 'CAN', 'BRA'] },
];

function team(code, position, points, goalsFor, goalsAgainst, goalDifference) {
  return Object.freeze({ code, name: code, position, played: 3, won: 1, drawn: 1, lost: 1, points, goalsFor, goalsAgainst, goalDifference });
}

const records = Object.freeze([
  team('ARG', 1, 2, 2, 10, -1),
  team('BRA', 2, 10, 9, 2, 2),
  team('JPN', 3, 9, 10, 9, -3),
  team('CAN', 4, 9, 9, 9, 0),
]);

beforeEach(async () => {
  // Supply the real dictionaries at the network boundary; do not mock translation or rendering.
  vi.stubGlobal('fetch', async (url) => {
    const dict = { 'i18n/zh.json': zh, 'i18n/en.json': en }[String(url)];
    return { ok: Boolean(dict), json: async () => dict };
  });
  await setLang('zh');
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function mount(groups = { A: records }) {
  vi.mocked(getStandings).mockResolvedValue(groups);
  document.body.innerHTML = await standingsView();
  return document.querySelector('.standings-table');
}

const rows = (table) => [...table.querySelectorAll('tbody tr')];
const codes = (table) => rows(table).map(row => row.dataset.route.split('/').at(-1));
const header = (table, column) => table.tHead.rows[0].cells[column.index];
const activeHeaders = (table) => [...table.querySelectorAll('th[aria-sort="ascending"], th[aria-sort="descending"]')];

function button(table, column) {
  const element = header(table, column).querySelector('button[type="button"]');
  expect(element, `${column.key} 表头应提供原生排序按钮`).not.toBeNull();
  return element;
}

function activate(table, column, direction, expected, originalRows) {
  const control = button(table, column);
  control.focus();
  control.click();
  expect(codes(table)).toEqual(expected);
  expect(activeHeaders(table)).toEqual([header(table, column)]);
  expect(table.querySelectorAll('th[aria-sort]')).toHaveLength(1);
  expect(header(table, column).getAttribute('aria-sort')).toBe(direction);
  const arrow = direction === 'ascending' ? '↑' : '↓';
  expect(header(table, column).textContent).toContain(arrow);
  expect(header(table, column).textContent).not.toContain(arrow === '↑' ? '↓' : '↑');
  expect(document.activeElement).toBe(control);
  expect(button(table, column)).toBe(control);
  for (const [index, row] of rows(table).entries()) {
    const original = originalRows.get(expected[index]);
    expect(row).toBe(original.node);
    expect(row.outerHTML).toBe(original.html);
  }
}

function captureRows(table) {
  return new Map(rows(table).map(row => [row.dataset.route.split('/').at(-1), { node: row, html: row.outerHTML }]));
}

describe('单组积分榜排序', () => {
  it.each(['zh', 'en'])('%s：初始顺序、四个本地化按钮及未选择状态', async (lang) => {
    await setLang(lang);
    const table = await mount();
    expect(codes(table)).toEqual(['ARG', 'BRA', 'JPN', 'CAN']);
    expect(rows(table)[1].cells[8].textContent.trim()).toBe('+2');
    expect(activeHeaders(table)).toEqual([]);
    expect(table.querySelectorAll('thead button')).toHaveLength(4);
    for (const column of columns) {
      expect(button(table, column).textContent.trim()).toContain(t(column.label));
      expect(header(table, column).textContent).not.toMatch(/[↑↓]/);
    }
  });

  it.each(columns)('$key：首次选择、翻转、切换与切回保留完整行和焦点', async (column) => {
    const table = await mount();
    const original = captureRows(table);
    const other = columns.find(item => item !== column);
    const reverse = column.direction === 'ascending' ? 'descending' : 'ascending';
    activate(table, column, column.direction, column.first, original);
    activate(table, column, reverse, column.second, original);
    activate(table, other, other.direction, other.first, original);
    activate(table, column, column.direction, column.first, original);
    expect(records.map(row => row.code)).toEqual(['ARG', 'BRA', 'JPN', 'CAN']);
  });

  it.each(['zh', 'en'])('%s：无效统计显示缺失说明而非零', async (lang) => {
    await setLang(lang);
    const table = await mount({ A: [
      team('ARG', 1, null, undefined, '2', Infinity),
      team('BRA', 2, NaN, -Infinity, null, undefined),
      team('CAN', 3, 0, 0, 0, 0),
    ] });
    for (const column of columns) {
      for (const row of rows(table).slice(0, 2)) {
        const cell = row.cells[column.index];
        expect(cell.textContent.trim()).toBe('—');
        const explanation = [cell, ...cell.querySelectorAll('*')].flatMap(node => [node.title, node.getAttribute('aria-label')]).filter(Boolean).join(' ');
        expect(explanation).toMatch(lang === 'zh' ? /缺失|暂无|未知|无效|无数据|不可用/ : /missing|unavailable|unknown|invalid|no data/i);
      }
      expect(rows(table)[2].cells[column.index].textContent.trim()).toBe('0');
    }
  });

  it.each(columns)('$key：两个无效值始终置后且零为有效值', async (column) => {
    const table = await mount({ A: [
      team('ARG', 1, null, undefined, '2', Infinity),
      team('CAN', 2, 0, 0, 0, 0),
      team('BRA', 3, NaN, -Infinity, null, undefined),
      team('JPN', 4, 10, 10, 10, 10),
    ] });
    const original = captureRows(table);
    const descending = ['JPN', 'CAN', 'ARG', 'BRA'];
    const ascending = ['CAN', 'JPN', 'ARG', 'BRA'];
    const asc = column.direction === 'ascending';
    activate(table, column, column.direction, asc ? ascending : descending, original);
    activate(table, column, asc ? 'descending' : 'ascending', asc ? descending : ascending, original);
  });

  it('空组省略，单队仍可选中和翻转四个指标', async () => {
    const table = await mount({ A: [], B: [records[0]] });
    expect(document.querySelectorAll('.group-card')).toHaveLength(1);
    expect(codes(table)).toEqual(['ARG']);
    const original = captureRows(table);
    for (const column of columns) {
      activate(table, column, column.direction, ['ARG'], original);
      activate(table, column, column.direction === 'ascending' ? 'descending' : 'ascending', ['ARG'], original);
    }
  });

  it('全同值保留初始顺序，但仍更新所选方向', async () => {
    const table = await mount({ A: [team('JPN', 1, 0, 0, 0, 0), team('ARG', 2, 0, 0, 0, 0), team('BRA', 3, 0, 0, 0, 0)] });
    const original = captureRows(table);
    for (const column of columns) {
      activate(table, column, column.direction, ['JPN', 'ARG', 'BRA'], original);
      activate(table, column, column.direction === 'ascending' ? 'descending' : 'ascending', ['JPN', 'ARG', 'BRA'], original);
    }
  });
});
describe('双组隔离与重挂载', () => {
  const groupB = Object.freeze([
    team('USA', 1, 2, 3, 9, -6),
    team('MEX', 2, 9, 8, 1, 7),
    team('KOR', 3, 5, 6, 4, 2),
  ]);

  function snapshot(table) {
    return {
      rows: rows(table).map(node => ({ node, html: node.outerHTML })),
      headers: columns.map(column => ({
        sort: header(table, column).getAttribute('aria-sort'),
        arrow: button(table, column).querySelector('.standings-sort-arrow').textContent,
      })),
    };
  }

  function expectUnchanged(table, saved) {
    expect(snapshot(table)).toEqual(saved);
    rows(table).forEach((node, index) => {
      expect(node).toBe(saved.rows[index].node);
      expect(node.closest('table')).toBe(table);
    });
  }

  it('两组仅改变自己的行序和排序提示，保留各自球队及统计', async () => {
    const a = await mount({ A: records, B: groupB });
    const b = document.querySelectorAll('.standings-table')[1];
    const originalA = captureRows(a);
    const originalB = captureRows(b);
    const untouchedB = snapshot(b);
    expect(codes(b)).toEqual(['USA', 'MEX', 'KOR']);
    activate(a, columns[0], 'descending', columns[0].first, originalA);
    expectUnchanged(b, untouchedB);
    const sortedA = snapshot(a);
    activate(b, columns[2], 'ascending', ['MEX', 'KOR', 'USA'], originalB);
    expectUnchanged(a, sortedA);
    const sortedB = snapshot(b);
    activate(a, columns[3], 'descending', columns[3].first, originalA);
    expectUnchanged(b, sortedB);
    activate(a, columns[3], 'ascending', columns[3].second, originalA);
    expectUnchanged(b, sortedB);
    for (const { node } of originalA.values()) expect(node.closest('table')).toBe(a);
    for (const { node } of originalB.values()) expect(node.closest('table')).toBe(b);
  });

  it('重复断开与连接时保留本卡片状态，断开时无监听，连接后每次激活只排序一次', async () => {
    const table = await mount();
    const card = table.closest('standings-group');
    const parent = card.parentNode;
    const original = captureRows(table);
    const points = columns[0];
    activate(table, points, 'descending', points.first, original);
    for (let cycle = 0; cycle < 2; cycle++) {
      const saved = snapshot(table);
      card.remove();
      button(table, points).click();
      expectUnchanged(table, saved);
      parent.append(card);
      expectUnchanged(table, saved);
      const observer = new MutationObserver(() => {});
      observer.observe(table.tHead, { attributes: true, subtree: true, attributeFilter: ['aria-sort'] });
      try {
        const descending = cycle === 1;
        activate(table, points, descending ? 'descending' : 'ascending', descending ? points.first : points.second, original);
        expect(observer.takeRecords().filter(record => record.target === header(table, points))).toHaveLength(1);
      } finally {
        observer.disconnect();
      }
    }
  });

  it('重新进入页面创建新卡片，恢复两组输入顺序及未选择状态', async () => {
    const a = await mount({ A: records, B: groupB });
    const b = document.querySelectorAll('.standings-table')[1];
    const registered = customElements.get('standings-group');
    expect(registered).toBeDefined();
    activate(a, columns[0], 'descending', columns[0].first, captureRows(a));
    activate(b, columns[2], 'ascending', ['MEX', 'KOR', 'USA'], captureRows(b));
    const freshA = await mount({ A: records, B: groupB });
    const freshB = document.querySelectorAll('.standings-table')[1];
    expect(customElements.get('standings-group')).toBe(registered);
    expect(freshA.closest('standings-group')).not.toBe(a.closest('standings-group'));
    expect(freshB.closest('standings-group')).not.toBe(b.closest('standings-group'));
    expect(codes(freshA)).toEqual(['ARG', 'BRA', 'JPN', 'CAN']);
    expect(codes(freshB)).toEqual(['USA', 'MEX', 'KOR']);
    for (const table of [freshA, freshB]) {
      expect(table.querySelectorAll('th[aria-sort]')).toHaveLength(0);
      for (const column of columns) expect(header(table, column).textContent).not.toMatch(/[↑↓]/);
    }
  });
});
