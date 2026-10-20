import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const load = async (name) => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url)));

// 纯函数层用动态 import：让本文件的「数据契约」断言可以在模块尚未存在时独立运行，
// 否则顶层的静态 import 会让整个文件在收集阶段就崩掉，无法区分两类失败。
const loadShared = () => import('../src/shared/tournament-query/history.js');

// 轮次段必须含数字：round_of_16 / round_of_32 是 normalizeRound() 的合法输出。
// 原契约写作 [a-z_]+ 会让全部十六强记录的 id 必然违规，属契约缺陷，已修正为 [a-z0-9_]+。
const ID_PATTERN = /^\d{4}-[a-z0-9_]+-[A-Z]{3}-[A-Z]{3}$/;
const COVERAGE_VALUES = ['complete', 'partial', 'missing', 'not_qualified'];
// 契约 wc-history-snapshot.md §3 的一致性不变量：零记录 ⟺ missing/not_qualified
const ZERO_RECORD_STATUSES = ['missing', 'not_qualified'];
const HAS_RECORD_STATUSES = ['complete', 'partial'];

describe('wc-history 快照：数据契约', () => {
  it('meta.teams 与 bracket.json 半决赛参赛队一致（取 home/away，不是 winner）', async () => {
    const [history, bracket] = await Promise.all([load('wc-history'), load('bracket')]);

    const participants = new Set();
    for (const semifinal of bracket.semifinals) {
      participants.add(semifinal.home);
      participants.add(semifinal.away);
    }

    expect([...history.meta.teams].sort()).toEqual([...participants].sort());
    // 反面锚点：winner 只是决赛双方，取错会漏掉一半四强
    const winners = new Set(bracket.semifinals.map((s) => s.winner));
    expect([...history.meta.teams].sort()).not.toEqual([...winners].sort());
  });

  it('meta.editions 为锁定的 7 届且严格升序', async () => {
    const history = await load('wc-history');
    expect(history.meta.editions).toEqual([1998, 2002, 2006, 2010, 2014, 2018, 2022]);
  });

  it('coverage 键集合恰好等于 meta.teams，每队届次键集合恰好等于 meta.editions', async () => {
    const history = await load('wc-history');
    const { editions, teams } = history.meta;
    const editionKeys = editions.map(String).sort();

    expect(Object.keys(history.coverage).sort()).toEqual([...teams].sort());
    for (const team of teams) {
      expect(Object.keys(history.coverage[team]).sort()).toEqual(editionKeys);
      for (const status of Object.values(history.coverage[team])) {
        expect(COVERAGE_VALUES).toContain(status);
      }
    }
  });

  it('coverage 与 matches 双向一致：零记录 ⟺ missing/not_qualified', async () => {
    const history = await load('wc-history');
    const { editions, teams } = history.meta;

    // 统计每个 (球队, 届次) 的记录条数
    const counts = new Map();
    for (const team of teams) {
      for (const edition of editions) counts.set(`${team}|${edition}`, 0);
    }
    for (const match of history.matches) {
      for (const code of [match.home.code, match.away.code]) {
        const key = `${code}|${match.edition}`;
        if (counts.has(key)) counts.set(key, counts.get(key) + 1);
      }
    }

    for (const team of teams) {
      for (const edition of editions) {
        const status = history.coverage[team][String(edition)];
        const count = counts.get(`${team}|${edition}`);
        if (ZERO_RECORD_STATUSES.includes(status)) {
          expect(count, `${team} ${edition} 标为 ${status} 却存在记录`).toBe(0);
        } else {
          expect(HAS_RECORD_STATUSES).toContain(status);
          expect(count, `${team} ${edition} 标为 ${status} 却无记录`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('每条记录：id 唯一且合法、edition 合法、date 年份等于 edition', async () => {
    const history = await load('wc-history');
    const { editions, teams } = history.meta;

    expect(new Set(history.matches.map((m) => m.id)).size).toBe(history.matches.length);

    for (const match of history.matches) {
      expect(match.id, `id 格式违规: ${match.id}`).toMatch(ID_PATTERN);
      expect(editions).toContain(match.edition);
      expect(match.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number(match.date.slice(0, 4)), `${match.id} 的 date 年份与 edition 不符`).toBe(match.edition);
      expect(Number.isInteger(match.homeScore)).toBe(true);
      expect(Number.isInteger(match.awayScore)).toBe(true);
      expect(match.homeScore).toBeGreaterThanOrEqual(0);
      expect(match.awayScore).toBeGreaterThanOrEqual(0);
      // 每条记录至少一侧是四强之一，否则它不该出现在本快照里
      expect(teams.includes(match.home.code) || teams.includes(match.away.code)).toBe(true);
    }
  });

  it('引用完整性边界：四强代码必须在 teams.json 中，历史对手不做该校验', async () => {
    const [history, teams] = await Promise.all([load('wc-history'), load('teams')]);
    const semifinalists = history.meta.teams;

    for (const match of history.matches) {
      for (const side of [match.home, match.away]) {
        expect(side.code).toMatch(/^[A-Z]{3}$/);
        // 双语名称两侧都必须非空 —— 历史对手不在 teams.json 里，只能内嵌
        expect(side.name.en).toBeTruthy();
        expect(side.name.zh).toBeTruthy();
        if (semifinalists.includes(side.code)) {
          expect(teams[side.code], `四强 ${side.code} 不在 teams.json 中`).toBeTruthy();
        }
      }
    }
  });

  it('shootout 只以 { home, away } 形态出现，且仅淘汰赛', async () => {
    const history = await load('wc-history');
    for (const match of history.matches) {
      if (match.shootout === undefined) continue;
      expect(Number.isInteger(match.shootout.home)).toBe(true);
      expect(Number.isInteger(match.shootout.away)).toBe(true);
      expect(match.shootout.home).not.toBe(match.shootout.away);
      expect(match.round).not.toBe('group');
    }
  });
});

describe('wc-history 纯函数层', () => {
  it('COVERAGE 常量含全部 4 个取值', async () => {
    const { COVERAGE } = await loadShared();
    expect(Object.values(COVERAGE).sort()).toEqual([...COVERAGE_VALUES].sort());
  });

  it('normalizeHistoryRound 特判 group，其余委托 normalizeRound', async () => {
    const { normalizeHistoryRound } = await loadShared();
    // 这是坑：normalizeRound('group') 返回 null，历届数据必然含小组赛
    expect(normalizeHistoryRound('group')).toBe('group');
    expect(normalizeHistoryRound('GROUP')).toBe('group');
    expect(normalizeHistoryRound(' group ')).toBe('group');
    expect(normalizeHistoryRound('qf')).toBe('quarterfinal');
    expect(normalizeHistoryRound('r16')).toBe('round_of_16');
    expect(normalizeHistoryRound('final')).toBe('final');
    expect(normalizeHistoryRound(null)).toBeNull();
    expect(normalizeHistoryRound('nonsense')).toBeNull();
  });

  it('resolveSelection 逐条覆盖契约规则表，且永不抛异常', async () => {
    const { resolveSelection } = await loadShared();
    const allowed = ['ARG', 'ENG', 'ESP', 'FRA'];
    const none = { team: null, opponent: null };

    // ① 未提供查询串
    expect(resolveSelection(undefined, allowed)).toEqual(none);
    expect(resolveSelection('', allowed)).toEqual(none);
    // ② 仅主队
    expect(resolveSelection('team=ESP', allowed)).toEqual({ team: 'ESP', opponent: null });
    // ③ 主队 + 对手
    expect(resolveSelection('team=ESP&vs=ARG', allowed)).toEqual({ team: 'ESP', opponent: 'ARG' });
    // ④ 不在 allowed → 整体回落（FR-009）
    expect(resolveSelection('team=BRA', allowed)).toEqual(none);
    // ⑤ 大小写不敏感
    expect(resolveSelection('team=esp', allowed)).toEqual({ team: 'ESP', opponent: null });
    expect(resolveSelection('team=esp&vs=arg', allowed)).toEqual({ team: 'ESP', opponent: 'ARG' });
    // ⑥ 无主队时对手无意义，整体回落
    expect(resolveSelection('vs=ARG', allowed)).toEqual(none);
    // ⑦ 同队不构成交锋，丢弃 vs
    expect(resolveSelection('team=ESP&vs=ESP', allowed)).toEqual({ team: 'ESP', opponent: null });
    expect(resolveSelection('team=ESP&vs=esp', allowed)).toEqual({ team: 'ESP', opponent: null });
    // ⑧ 重复参数取最后一个「有效」值
    //    注：契约依据栏写的是 URLSearchParams.get() 语义，但 get() 返回第一个，
    //    与输出栏「取最后一个有效值」矛盾。此处以输出栏为准（依据栏为笔误）。
    expect(resolveSelection('team=ESP&team=ARG', allowed)).toEqual({ team: 'ARG', opponent: null });
    expect(resolveSelection('team=BRA&team=ESP', allowed)).toEqual({ team: 'ESP', opponent: null });
    // ⑨ 畸形串不抛异常
    expect(() => resolveSelection('%%%', allowed)).not.toThrow();
    expect(resolveSelection('%%%', allowed)).toEqual(none);
    expect(resolveSelection('team=%E4%B8%AD%E6%96%87', allowed)).toEqual(none);
    // 未知参数被忽略
    expect(resolveSelection('team=ESP&foo=bar', allowed)).toEqual({ team: 'ESP', opponent: null });
    // allowed 为空时一律回落
    expect(resolveSelection('team=ESP', [])).toEqual(none);
  });

  it('groupByEdition 只保留有记录的届次并按届次倒序', async () => {
    const { groupByEdition } = await loadShared();
    const matches = [
      { id: 'a', edition: 1998, home: { code: 'ESP' }, away: { code: 'NGA' } },
      { id: 'b', edition: 2022, home: { code: 'CRC' }, away: { code: 'ESP' } },
      { id: 'c', edition: 2022, home: { code: 'ESP' }, away: { code: 'GER' } },
      { id: 'd', edition: 2010, home: { code: 'ARG' }, away: { code: 'MEX' } },
    ];

    const grouped = groupByEdition(matches, 'ESP');
    expect(grouped.map((g) => g.edition)).toEqual([2022, 1998]);
    expect(grouped[0].matches.map((m) => m.id)).toEqual(['b', 'c']);
    expect(grouped[1].matches.map((m) => m.id)).toEqual(['a']);
    // 只按「本方是所选球队」筛选，且不修改入参
    expect(matches).toHaveLength(4);
  });

  it('listCoverage 返回全部 7 届，按届次倒序，取值合法', async () => {
    const { listCoverage } = await loadShared();
    const coverage = {
      ESP: { 1998: 'complete', 2002: 'partial', 2006: 'complete', 2010: 'complete',
             2014: 'complete', 2018: 'complete', 2022: 'complete' },
    };

    const rows = listCoverage(coverage, 'ESP');
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.edition)).toEqual([2022, 2018, 2014, 2010, 2006, 2002, 1998]);
    for (const row of rows) expect(COVERAGE_VALUES).toContain(row.status);
    expect(rows.find((r) => r.edition === 2002).status).toBe('partial');
  });
});
