import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { COVERAGE, normalizeHistoryRound } from '../src/shared/tournament-query/history.js';

const data = async (name) => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url)));
const [matches, teams, venues, standings, bracket, awards, history, zh, en] = await Promise.all([
  data('matches'), data('teams'), data('venues'), data('standings'), data('bracket'), data('awards'),
  data('wc-history'),
  JSON.parse(await readFile(new URL('../public/i18n/zh.json', import.meta.url))),
  JSON.parse(await readFile(new URL('../public/i18n/en.json', import.meta.url))),
]);

const ajv = new Ajv({ allErrors: true });
const validMatches = ajv.compile({
  type: 'array', minItems: 104, maxItems: 104,
  items: {
    type: 'object', required: ['id', 'stage', 'date', 'home', 'away', 'homeScore', 'awayScore'],
    properties: {
      id: { type: 'integer', minimum: 1 }, stage: { type: 'string' }, date: { type: 'string' },
      homeScore: { type: 'number' }, awayScore: { type: 'number' },
      home: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
      away: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
    },
  },
});

// 历届世界杯战绩快照。字段形状与不变量见 specs/001-semifinal-history/contracts/wc-history-snapshot.md
const historySide = {
  type: 'object', required: ['code', 'name'], additionalProperties: false,
  properties: {
    code: { type: 'string', pattern: '^[A-Z]{3}$' },
    name: {
      type: 'object', required: ['en', 'zh'], additionalProperties: false,
      properties: { en: { type: 'string', minLength: 1 }, zh: { type: 'string', minLength: 1 } },
    },
  },
};
const validHistory = ajv.compile({
  type: 'object', required: ['meta', 'coverage', 'matches'], additionalProperties: false,
  properties: {
    meta: {
      type: 'object', required: ['editions', 'teams'], additionalProperties: false,
      properties: {
        editions: { type: 'array', minItems: 1, items: { type: 'integer' } },
        teams: { type: 'array', minItems: 1, items: { type: 'string', pattern: '^[A-Z]{3}$' } },
      },
    },
    coverage: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: { type: 'string', enum: Object.values(COVERAGE) },
      },
    },
    matches: {
      type: 'array',
      items: {
        type: 'object', required: ['id', 'edition', 'round', 'date', 'home', 'away', 'homeScore', 'awayScore'],
        properties: {
          // 轮次段含数字：round_of_16 / round_of_32 是 normalizeRound() 的合法输出
          id: { type: 'string', pattern: '^\\d{4}-[a-z0-9_]+-[A-Z]{3}-[A-Z]{3}$' },
          edition: { type: 'integer' },
          round: { type: 'string' },
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          home: historySide, away: historySide,
          homeScore: { type: 'integer', minimum: 0 },
          awayScore: { type: 'integer', minimum: 0 },
          shootout: {
            type: 'object', required: ['home', 'away'], additionalProperties: false,
            properties: { home: { type: 'integer', minimum: 0 }, away: { type: 'integer', minimum: 0 } },
          },
          note: { type: 'string' },
        },
      },
    },
  },
});

const failures = [];
if (!validMatches(matches)) failures.push(`matches schema: ${ajv.errorsText(validMatches.errors)}`);
const ids = new Set(matches.map((match) => match.id));
if (ids.size !== matches.length) failures.push('match IDs must be unique');
const venueNames = new Set(Object.values(venues).map((venue) => {
  const name = venue.name?.en || venue.name || '';
  const city = venue.city?.en || venue.city || '';
  return city ? `${name}, ${city}` : name;
}));
const venueBaseNames = new Set(Object.values(venues).map((venue) => venue.name?.en || venue.name || ''));
for (const match of matches) {
  for (const code of [match.home.code, match.away.code]) {
    if (!teams[code]) failures.push(`match ${match.id} references missing team ${code}`);
  }
  const venueBase = String(match.stadium || '').split(',')[0];
  if (match.stadium && !venueNames.has(match.stadium) && !venueBaseNames.has(venueBase)) {
    failures.push(`match ${match.id} references missing venue ${match.stadium}`);
  }
}
for (const [group, rows] of Object.entries(standings)) {
  for (const row of rows) if (!teams[row.code]) failures.push(`standings ${group} references missing team ${row.code}`);
}
for (const key of Object.keys(zh)) if (!(key in en)) failures.push(`missing English translation for ${key}`);
for (const key of Object.keys(en)) if (!(key in zh)) failures.push(`missing Chinese translation for ${key}`);
if (!bracket || !awards) failures.push('bracket and awards must be present');

// ---- wc-history：结构 + 语义（发布前阻断版本，与 tests/wc-history.test.js 同规则）----
if (!validHistory(history)) failures.push(`wc-history schema: ${ajv.errorsText(validHistory.errors)}`);

const historyEditions = history.meta?.editions || [];
const historyTeams = history.meta?.teams || [];
const sortedTeams = [...historyTeams].sort();
const editionKeySet = historyEditions.map(String).sort();

// meta.teams 必须等于 bracket.json 半决赛「参赛队」（home + away），而不是 winner。
// 取 winner 只会得到决赛双方，会漏掉一半四强。
const participants = new Set();
for (const semifinal of bracket?.semifinals || []) {
  if (semifinal.home) participants.add(semifinal.home);
  if (semifinal.away) participants.add(semifinal.away);
}
if (sortedTeams.join(',') !== [...participants].sort().join(',')) {
  failures.push(`wc-history meta.teams (${sortedTeams.join(',')}) must equal bracket.json semifinal participants (${[...participants].sort().join(',')})`);
}

// coverage 键集合恰好等于 meta.teams；每队届次键集合恰好等于 meta.editions
if (Object.keys(history.coverage || {}).sort().join(',') !== sortedTeams.join(',')) {
  failures.push('wc-history coverage keys must equal meta.teams');
}
for (const team of historyTeams) {
  if (Object.keys(history.coverage?.[team] || {}).sort().join(',') !== editionKeySet.join(',')) {
    failures.push(`wc-history coverage[${team}] edition keys must equal meta.editions`);
  }
}

const historyIds = new Set();
const historyCounts = new Map();
for (const match of history.matches || []) {
  if (historyIds.has(match.id)) failures.push(`wc-history duplicate id ${match.id}`);
  historyIds.add(match.id);

  if (!historyEditions.includes(match.edition)) {
    failures.push(`wc-history ${match.id} edition ${match.edition} is not in meta.editions`);
  }
  if (Number(match.date.slice(0, 4)) !== match.edition) {
    failures.push(`wc-history ${match.id} date year must equal edition`);
  }
  // 复用共享归一化边界，不硬编码轮次枚举（'group' 由 normalizeHistoryRound 特判）
  if (!normalizeHistoryRound(match.round)) {
    failures.push(`wc-history ${match.id} round "${match.round}" is not normalizable`);
  }
  if (!historyTeams.includes(match.home.code) && !historyTeams.includes(match.away.code)) {
    failures.push(`wc-history ${match.id} must involve at least one semifinalist`);
  }
  for (const side of [match.home, match.away]) {
    // 引用完整性边界：只有四强代码必须在 teams.json 中，历史对手不校验
    if (historyTeams.includes(side.code) && !teams[side.code]) {
      failures.push(`wc-history ${match.id} references missing semifinalist ${side.code}`);
    }
  }
  if (match.shootout) {
    if (match.round === 'group') failures.push(`wc-history ${match.id} group match must not have a shootout`);
    if (match.shootout.home === match.shootout.away) failures.push(`wc-history ${match.id} shootout must have a winner`);
  }

  for (const code of [match.home.code, match.away.code]) {
    const key = `${code}|${match.edition}`;
    historyCounts.set(key, (historyCounts.get(key) || 0) + 1);
  }
}

// coverage 与 matches 双向一致：零记录 ⟺ missing/not_qualified
const ZERO_RECORD = [COVERAGE.MISSING, COVERAGE.NOT_QUALIFIED];
for (const team of historyTeams) {
  for (const edition of historyEditions) {
    const status = history.coverage?.[team]?.[String(edition)];
    const count = historyCounts.get(`${team}|${edition}`) || 0;
    if (ZERO_RECORD.includes(status) && count > 0) {
      failures.push(`wc-history coverage ${team}/${edition} is "${status}" but ${count} match(es) exist`);
    }
    if (!ZERO_RECORD.includes(status) && count === 0) {
      failures.push(`wc-history coverage ${team}/${edition} is "${status}" but no match exists`);
    }
  }
}

if (failures.length) {
  console.error(`Data validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Validated ${matches.length} matches, ${Object.keys(teams).length} teams, ${history.matches.length} history records, and bilingual dictionaries.`);
