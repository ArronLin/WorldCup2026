// ===== Chat Tools (browser) =====
// 19 个 AI 工具的前端实现：与 netlify/functions/_tools.mjs 逻辑一致，
// 数据源改为 store.js（浏览器 fetch data/*.json）。
// 由 initChatTools() 预加载全部数据到内存（~205KB），随后工具同步执行。
import {
  getMatches, getTeams, getStandings, getBracket, getAwards,
  getGroups, getVenues, getPlayerNames,
} from './store.js';

// ============ 数据（initChatTools 后填充） ============
let MATCHES = [];
let TEAMS = {};
let STANDINGS = {};
let BRACKET = {};
let AWARDS = {};
let GROUPS = {};
let VENUES = {};
let PNAMES = {};

export async function initChatTools() {
  try {
    const [m, t, s, b, a, g, v, p] = await Promise.all([
      getMatches(), getTeams(), getStandings(), getBracket(),
      getAwards(), getGroups(), getVenues(), getPlayerNames(),
    ]);
    MATCHES = Array.isArray(m) ? m : [];
    TEAMS = t || {}; STANDINGS = s || {}; BRACKET = b || {}; AWARDS = a || {};
    GROUPS = g || {}; VENUES = v || {}; PNAMES = p || {};
    buildIndexes();
    return true;
  } catch (e) {
    console.warn('initChatTools failed:', e);
    return false;
  }
}

// ============ 轮次归一化（matches 单数 vs bracket 复数） ============
const ROUND_ALIAS = {
  r32: 'round_of_32', r16: 'round_of_16', qf: 'quarterfinal', sf: 'semifinal',
  third: 'third_place', third_place: 'third_place', final: 'final',
  quarterfinals: 'quarterfinal', semifinals: 'semifinal',
};
function normalizeRound(input) {
  if (!input) return null;
  const key = String(input).toLowerCase().trim();
  if (ROUND_ALIAS[key]) return ROUND_ALIAS[key];
  if (key.includes('round_of_32')) return 'round_of_32';
  if (key.includes('round_of_16')) return 'round_of_16';
  if (key.includes('quarter')) return 'quarterfinal';
  if (key.includes('semi')) return 'semifinal';
  return null;
}

// ============ 归一化工具（与 _data.mjs 一致） ============
function parseMinute(s) {
  if (s === null || s === undefined) return 0;
  const str = String(s);
  const [a, b] = str.split('+');
  return (parseInt(a, 10) || 0) + (b !== undefined ? (parseInt(b, 10) || 0) : 0);
}
function parseAttendance(s) {
  if (s === null || s === undefined) return null;
  const n = parseInt(String(s).replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
function teamGoalsOf(match, code) {
  if (match.home.code === code) return match.homeScore;
  if (match.away.code === code) return match.awayScore;
  return null;
}
function matchBrief(m) {
  return {
    id: m.id, date: m.date, stage: m.stage, round: m.round || null, group: m.group || null,
    home: { code: m.home.code, name: m.home.name, nameZh: m.home.nameZh },
    away: { code: m.away.code, name: m.away.name, nameZh: m.away.nameZh },
    score: m.score, homeScore: m.homeScore, awayScore: m.awayScore,
    stadium: m.stadium, extraTime: !!m.extraTime, penaltyShootout: m.penaltyShootout || null,
  };
}

// 教练白名单（cards 数据混入教练）
const KNOWN_STAFF = new Set([
  'Julian Nagelsmann', 'Gustavo Alfaro', 'Vincenzo Montella', 'Rudi Garcia',
  'Sergej Barbarez', 'Lionel Scaloni', 'Luis Amaranto Perea', 'Hossam Hassan',
]);
function isStaff(name) { return KNOWN_STAFF.has(name); }
function playerZhOf(name) { return (name && PNAMES[name]) || null; }

// ============ 索引 ============
let BY_ID = new Map();
let BY_TEAM = new Map();
let BY_GROUP = new Map();
let BY_ROUND = new Map();
const playerIndex = new Map();

function buildIndexes() {
  BY_ID = new Map(); BY_TEAM = new Map(); BY_GROUP = new Map(); BY_ROUND = new Map();
  playerIndex.clear();
  for (const m of MATCHES) {
    BY_ID.set(m.id, m);
    if (m.group) { if (!BY_GROUP.has(m.group)) BY_GROUP.set(m.group, []); BY_GROUP.get(m.group).push(m); }
    if (m.round) { if (!BY_ROUND.has(m.round)) BY_ROUND.set(m.round, []); BY_ROUND.get(m.round).push(m); }
    for (const code of [m.home.code, m.away.code]) {
      if (!BY_TEAM.has(code)) BY_TEAM.set(code, []);
      BY_TEAM.get(code).push(m);
    }
    for (const g of m.goals || []) {
      if (!g.player) continue;
      playerIndex.set(g.player.toLowerCase(), { name: g.player, zh: PNAMES[g.player] || null, team: g.team });
    }
    for (const c of m.cards || []) {
      if (!c.player) continue;
      const key = c.player.toLowerCase();
      if (!playerIndex.has(key)) playerIndex.set(key, { name: c.player, zh: PNAMES[c.player] || null, team: c.team });
    }
  }
}

// ============ 解析器 ============
function resolveTeam(input) {
  if (!input) return { ok: false, error: 'empty team input', suggestions: [] };
  const q = String(input).trim().toLowerCase();
  if (!q) return { ok: false, error: 'empty team input', suggestions: [] };
  const codeHit = Object.keys(TEAMS).find((c) => c.toLowerCase() === q);
  if (codeHit) return { ok: true, code: codeHit };
  for (const code of Object.keys(TEAMS)) {
    const t = TEAMS[code];
    if (((t.name && t.name.en) || '').toLowerCase() === q || ((t.name && t.name.zh) || '').toLowerCase() === q) {
      return { ok: true, code };
    }
  }
  const suggestions = [];
  for (const code of Object.keys(TEAMS)) {
    const t = TEAMS[code];
    const en = ((t.name && t.name.en) || '').toLowerCase();
    const zh = ((t.name && t.name.zh) || '').toLowerCase();
    if (en.includes(q) || zh.includes(q)) {
      suggestions.push({ code, en: t.name.en, zh: t.name.zh });
      if (suggestions.length >= 5) break;
    }
  }
  return { ok: false, error: `unknown team: ${input}`, suggestions };
}

function resolvePlayer(input) {
  if (!input) return { ok: false, error: 'empty player input', suggestions: [] };
  const q = String(input).trim().toLowerCase();
  if (!q) return { ok: false, error: 'empty player input', suggestions: [] };
  if (playerIndex.has(q)) {
    const p = playerIndex.get(q);
    return { ok: true, players: [{ name: p.name, zh: p.zh, team: p.team }] };
  }
  const zhHits = [];
  for (const [en, zh] of Object.entries(PNAMES)) {
    if (zh === input.trim()) zhHits.push(en);
  }
  if (zhHits.length === 1) {
    const en = zhHits[0];
    const p = playerIndex.get(en.toLowerCase()) || { name: en, zh: input.trim(), team: null };
    return { ok: true, players: [{ name: p.name, zh: p.zh || input.trim(), team: p.team }] };
  }
  const hits = [];
  for (const [key, p] of playerIndex) {
    if (key.includes(q) || (p.zh && p.zh.includes(input.trim()))) {
      hits.push({ name: p.name, zh: p.zh, team: p.team });
      if (hits.length >= 5) break;
    }
  }
  if (hits.length === 1) return { ok: true, players: hits };
  if (hits.length > 1) return { ok: false, error: `ambiguous player: ${input}`, suggestions: hits.map((h) => h.name) };
  return { ok: false, error: `unknown player: ${input}`, suggestions: [] };
}

// ============ 通用 ============
const ok = (data) => ({ ok: true, data });
const fail = (error, suggestions) => ({ ok: false, error, suggestions });

function filterByScope(matches, args) {
  let out = matches;
  if (args.scope === 'group') out = out.filter((m) => m.stage === 'group');
  else if (args.scope === 'knockout') out = out.filter((m) => m.stage === 'knockout');
  if (args.group) out = out.filter((m) => m.group === args.group);
  if (args.round) {
    const r = normalizeRound(args.round);
    if (r) out = out.filter((m) => m.round === r);
  }
  return out;
}

// ============ A. 基础查询 (7) ============
function tGetMatch(args) {
  let m = null;
  if (args.match_id) m = BY_ID.get(Number(args.match_id)) || null;
  else if (args.team_a && args.team_b) {
    const a = resolveTeam(args.team_a); const b = resolveTeam(args.team_b);
    if (!a.ok) return fail(a.error, a.suggestions);
    if (!b.ok) return fail(b.error, b.suggestions);
    const ms = MATCHES.filter((x) =>
      (x.home.code === a.code && x.away.code === b.code) || (x.home.code === b.code && x.away.code === a.code));
    if (ms.length === 0) return fail(`no match between ${args.team_a} and ${args.team_b}`);
    m = args.date ? ms.find((x) => x.date === args.date) || ms[0] : ms[0];
  }
  if (!m) return fail('match not found', { hint: 'e.g. {"match_id":104}' });
  return ok({
    ...matchBrief(m),
    time: m.time, referee: m.referee, attendance: m.attendance,
    goals: (m.goals || []).map((g) => ({ ...g, minuteNum: parseMinute(g.minute) })),
    cards: (m.cards || []).map((c) => ({ ...c, minuteNum: parseMinute(c.minute), isStaff: isStaff(c.player) })),
  });
}

function tListMatches(args) {
  let out = MATCHES.slice();
  if (args.team) {
    const r = resolveTeam(args.team);
    if (!r.ok) return fail(r.error, r.suggestions);
    out = out.filter((m) => m.home.code === r.code || m.away.code === r.code);
  }
  if (args.group) out = out.filter((m) => m.group === args.group);
  if (args.stage) out = out.filter((m) => m.stage === args.stage);
  if (args.round) {
    const r = normalizeRound(args.round);
    if (!r) return fail(`unknown round ${args.round}`);
    out = out.filter((m) => m.round === r);
  }
  if (args.date_from) out = out.filter((m) => m.date >= args.date_from);
  if (args.date_to) out = out.filter((m) => m.date <= args.date_to);
  out.sort((x, y) => x.id - y.id);
  const limit = Math.min(Number(args.limit || 20), 104);
  return ok({ count: out.length, returned: Math.min(limit, out.length), truncated: out.length > limit, matches: out.slice(0, limit).map(matchBrief) });
}

function tGetStandings(args) {
  if (args.group) {
    const rows = STANDINGS[args.group];
    if (!rows) return fail(`group ${args.group} not found`, { hint: 'A-L' });
    return ok({ group: args.group, standings: rows });
  }
  return ok({ groups: Object.keys(STANDINGS).map((g) => ({ group: g, standings: STANDINGS[g] })) });
}

function tGetBracket(args) {
  const order = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];
  const bracketKey = { round_of_32: 'round_of_32', round_of_16: 'round_of_16', quarterfinal: 'quarterfinals', semifinal: 'semifinals', third_place: 'third_place', final: 'final' };
  const project = (n) => ({
    id: n.id, home: n.home, away: n.away, homeName: n.homeName, awayName: n.awayName,
    score: n.score, homeScore: n.homeScore, awayScore: n.awayScore,
    date: n.date, stadium: n.stadium, winner: n.winner,
  });
  if (args.round) {
    const r = normalizeRound(args.round);
    if (!r) return fail(`unknown round ${args.round}`);
    const v = BRACKET[bracketKey[r]];
    if (!v) return fail(`bracket round ${r} not found`);
    const arr = Array.isArray(v) ? v : [v];
    return ok({ round: r, matches: arr.map(project) });
  }
  const all = [];
  for (const r of order) {
    const v = BRACKET[bracketKey[r]];
    const arr = Array.isArray(v) ? v : (v ? [v] : []);
    all.push({ round: r, matches: arr.map(project) });
  }
  return ok({ bracket: all });
}

function tGetAwards() {
  const pick = (o) => (o ? { code: o.code, name: o.name, title: o.title } : null);
  return ok({
    champion: pick(AWARDS.champion), runner_up: pick(AWARDS.runner_up),
    third_place: pick(AWARDS.third_place), fourth_place: pick(AWARDS.fourth_place),
    golden_ball: AWARDS.golden_ball, golden_boot: AWARDS.golden_boot,
    golden_glove: AWARDS.golden_glove, young_player: AWARDS.young_player,
    fair_play: AWARDS.fair_play, tournament_stats: AWARDS.tournament_stats,
  });
}

function tGetTeamInfo(args) {
  const r = resolveTeam(args.team);
  if (!r.ok) return fail(r.error, r.suggestions);
  const code = r.code;
  const team = TEAMS[code];
  const groupStanding = (STANDINGS[team.group] || []).find((s) => s.code === code) || null;
  const all = (BY_TEAM.get(code) || []).slice().sort((a, b) => a.id - b.id);
  return ok({
    code, name: team.name, group: team.group, confederation: team.confederation,
    ranking: team.ranking, groupStage: team.stats, groupStanding,
    matches: all.map(matchBrief),
  });
}

function tGetVenueInfo(args) {
  if (args.name) {
    const q = String(args.name).trim().toLowerCase();
    const hit = Object.entries(VENUES).find(([slug, v]) =>
      slug.toLowerCase().includes(q) || (v.name.en || '').toLowerCase().includes(q) || (v.name.zh || '').includes(q) ||
      (v.city.en || '').toLowerCase().includes(q) || (v.city.zh || '').includes(q));
    if (!hit) return fail(`venue ${args.name} not found`);
    const [slug, v] = hit;
    return ok({ slug, name: v.name, city: v.city, country: v.country, capacity: v.capacity });
  }
  return ok({ venues: Object.entries(VENUES).map(([slug, v]) => ({ slug, name: v.name, city: v.city, capacity: v.capacity })) });
}

// ============ B. 射手/助攻 (2) ============
function tGetTopScorers(args) {
  const tally = new Map();
  const byTeam = new Map();
  for (const m of MATCHES) {
    for (const g of m.goals || []) {
      if (g.isOwnGoal || !g.player) continue;
      if (!tally.has(g.player)) tally.set(g.player, { player: g.player, playerZh: playerZhOf(g.player) || g.player, team: g.team, goals: 0, penalties: 0, openPlay: 0 });
      const e = tally.get(g.player);
      e.goals++; if (g.isPenalty) e.penalties++; else e.openPlay++;
      if (!byTeam.has(g.player)) byTeam.set(g.player, g.team);
    }
  }
  let list = [...tally.values()].sort((a, b) => (b.goals - a.goals) || (a.penalties - b.penalties));
  if (args.team) {
    const r = resolveTeam(args.team);
    if (!r.ok) return fail(r.error, r.suggestions);
    list = list.filter((e) => byTeam.get(e.player) === r.code);
  }
  const limit = Math.min(Number(args.limit || 10), 50);
  return ok({ count: list.length, top: list.slice(0, limit) });
}

function tGetTopAssists(args) {
  const limit = Math.min(Number(args.limit || 10), 10);
  return ok({ note: 'only the official top 10 assists are available in this dataset', top: (AWARDS.top_assists || []).slice(0, limit) });
}

// ============ C. 进球与结果统计 (4) ============
function tTournamentGoalStats(args) {
  const pool = filterByScope(MATCHES, args);
  if (pool.length === 0) return fail('no matches for this scope');
  let totalGoals = 0, penalties = 0, ownGoals = 0, cleanSheets = 0, draws = 0;
  let biggest = { margin: -1 };
  const goalsByPeriod = { '1-15': 0, '16-30': 0, '31-45': 0, '46-60': 0, '61-75': 0, '76-90': 0, '90+': 0 };
  for (const m of pool) {
    totalGoals += m.homeScore + m.awayScore;
    if (m.homeScore === 0 || m.awayScore === 0) cleanSheets++;
    if (m.homeScore === m.awayScore) draws++;
    const margin = Math.abs(m.homeScore - m.awayScore);
    if (margin > biggest.margin) biggest = { margin, match: matchBrief(m) };
    for (const g of m.goals || []) {
      if (g.isPenalty) penalties++;
      if (g.isOwnGoal) ownGoals++;
      const t = parseMinute(g.minute);
      if (t <= 15) goalsByPeriod['1-15']++;
      else if (t <= 30) goalsByPeriod['16-30']++;
      else if (t <= 45) goalsByPeriod['31-45']++;
      else if (t <= 60) goalsByPeriod['46-60']++;
      else if (t <= 75) goalsByPeriod['61-75']++;
      else if (t <= 90) goalsByPeriod['76-90']++;
      else goalsByPeriod['90+']++;
    }
  }
  return ok({
    scope: { stage: args.scope || 'all', group: args.group || null, round: args.round ? normalizeRound(args.round) : null },
    matches: pool.length, totalGoals, avgGoals: Math.round((totalGoals / pool.length) * 100) / 100,
    penalties, ownGoals, cleanSheets, draws, biggestMargin: biggest, goalsByPeriod,
  });
}

function tBiggestWins(args) {
  const pool = filterByScope(MATCHES, args);
  const list = pool
    .filter((m) => m.homeScore !== m.awayScore)
    .map((m) => ({ ...matchBrief(m), margin: Math.abs(m.homeScore - m.awayScore) }))
    .sort((a, b) => (b.margin - a.margin) || ((b.homeScore + b.awayScore) - (a.homeScore + a.awayScore)));
  const limit = Math.min(Number(args.limit || 5), 20);
  return ok({ count: list.length, top: list.slice(0, limit) });
}

function tHighestScoringMatches(args) {
  const pool = filterByScope(MATCHES, args);
  const list = pool
    .map((m) => ({ ...matchBrief(m), totalGoals: m.homeScore + m.awayScore }))
    .sort((a, b) => (b.totalGoals - a.totalGoals) || (b.id - a.id));
  const limit = Math.min(Number(args.limit || 5), 20);
  return ok({ count: list.length, top: list.slice(0, limit) });
}

function tCompareScorers(args) {
  const players = (args.players || []).slice(0, 5);
  if (players.length < 2) return fail('compare at least 2 players', { hint: '{"players":["Mbappé","Messi"]}' });
  const out = [];
  const seen = new Set();
  for (const raw of players) {
    const r = resolvePlayer(raw);
    if (!r.ok) return fail(r.error, r.suggestions);
    const p = r.players[0];
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    const games = [];
    for (const m of MATCHES) {
      for (const g of m.goals || []) {
        if (g.isOwnGoal) continue;
        if (g.player.toLowerCase() === p.name.toLowerCase()) {
          games.push({ matchId: m.id, date: m.date, opponent: g.team === m.home.code ? m.away.code : m.home.code, minute: g.minute, minuteNum: parseMinute(g.minute), isPenalty: g.isPenalty });
        }
      }
    }
    games.sort((a, b) => a.minuteNum - b.minuteNum);
    const goals = games.length;
    const penalties = games.filter((g) => g.isPenalty).length;
    out.push({
      player: p.name, playerZh: p.zh || p.name, team: p.team, goals, penalties, openPlay: goals - penalties,
      matchIds: games.map((g) => g.matchId), minutes: games.map((g) => g.minute),
      firstGoalDate: games.length ? games[0].date : null,
    });
  }
  out.sort((a, b) => b.goals - a.goals || a.penalties - b.penalties);
  return ok({ compared: out });
}

// ============ D. 红黄牌纪律 (3) ============
function tCardRankingsByPlayer(args) {
  const pool = filterByScope(MATCHES, args);
  const tally = new Map();
  for (const m of pool) {
    for (const c of m.cards || []) {
      if (!c.player) continue;
      if (!tally.has(c.player)) tally.set(c.player, { player: c.player, playerZh: playerZhOf(c.player) || c.player, team: c.team, yellow: 0, red: 0, total: 0, isStaff: isStaff(c.player), matchIds: [] });
      const e = tally.get(c.player);
      if (c.type === 'red') e.red++; else e.yellow++;
      e.total++;
      if (!e.matchIds.includes(m.id)) e.matchIds.push(m.id);
    }
  }
  let list = [...tally.values()];
  if (args.team) {
    const r = resolveTeam(args.team);
    if (!r.ok) return fail(r.error, r.suggestions);
    list = list.filter((e) => e.team === r.code);
  }
  if (args.type === 'yellow') list = list.filter((e) => e.yellow > 0).sort((a, b) => b.yellow - a.yellow || b.red - a.red);
  else if (args.type === 'red') list = list.filter((e) => e.red > 0).sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  else list.sort((a, b) => b.total - a.total || b.red - a.red);
  const limit = Math.min(Number(args.limit || 10), 50);
  return ok({ note: 'only yellow and red card types exist; entries flagged isStaff are coaching staff', count: list.length, top: list.slice(0, limit) });
}

function tCardRankingsByTeam(args) {
  const pool = filterByScope(MATCHES, args);
  const tally = new Map();
  for (const m of pool) {
    for (const c of m.cards || []) {
      if (!c.team) continue;
      if (!tally.has(c.team)) tally.set(c.team, { team: c.team, yellow: 0, red: 0, total: 0 });
      const e = tally.get(c.team);
      if (c.type === 'red') e.red++; else e.yellow++;
      e.total++;
    }
  }
  const rows = [...tally.values()].map((e) => {
    const played = (BY_TEAM.get(e.team) || []).length;
    return { ...e, matches: played, cardsPerMatch: played ? Math.round((e.total / played) * 100) / 100 : 0 };
  });
  if (args.type === 'yellow') rows.sort((a, b) => b.yellow - a.yellow || b.red - a.red);
  else if (args.type === 'red') rows.sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  else rows.sort((a, b) => b.total - a.total || b.red - a.red);
  const limit = Math.min(Number(args.limit || 10), 48);
  return ok({ count: rows.length, top: rows.slice(0, limit) });
}

function tCardsInMatch(args) {
  let m = null;
  if (args.match_id) m = BY_ID.get(Number(args.match_id)) || null;
  else if (args.team_a && args.team_b) {
    const a = resolveTeam(args.team_a); const b = resolveTeam(args.team_b);
    if (!a.ok) return fail(a.error, a.suggestions);
    if (!b.ok) return fail(b.error, b.suggestions);
    m = MATCHES.find((x) =>
      (x.home.code === a.code && x.away.code === b.code) || (x.home.code === b.code && x.away.code === a.code)) || null;
  }
  if (!m) return fail('match not found', { hint: 'e.g. {"match_id":75}' });
  const cards = (m.cards || []).map((c) => ({ ...c, minuteNum: parseMinute(c.minute), isStaff: isStaff(c.player) }))
    .sort((a, b) => a.minuteNum - b.minuteNum || a.minute.localeCompare(b.minute, undefined, { numeric: true }));
  return ok({ match: matchBrief(m), count: cards.length, cards });
}

// ============ E. 交锋与战绩 (3) ============
function matchWinner(m) {
  if (m.homeScore > m.awayScore) return m.home.code;
  if (m.awayScore > m.homeScore) return m.away.code;
  if (m.penaltyShootout) return m.penaltyShootout.home > m.penaltyShootout.away ? m.home.code : m.away.code;
  return null;
}

function tHeadToHead(args) {
  const a = resolveTeam(args.team_a); const b = resolveTeam(args.team_b);
  if (!a.ok) return fail(a.error, a.suggestions);
  if (!b.ok) return fail(b.error, b.suggestions);
  const meetings = MATCHES.filter((m) =>
    (m.home.code === a.code && m.away.code === b.code) || (m.home.code === b.code && m.away.code === a.code));
  const det = meetings.map((m) => {
    const homeIsA = m.home.code === a.code;
    const winner = matchWinner(m);
    return {
      id: m.id, date: m.date, round: m.round || 'group', stage: m.stage,
      home: m.home.code, away: m.away.code, score: m.score,
      homeScore: m.homeScore, awayScore: m.awayScore,
      winner, viaPenalties: !!m.penaltyShootout,
      aWon: winner === a.code, bWon: winner === b.code, drawn: winner === null,
    };
  });
  let aWins = 0, bWins = 0, draws = 0, aGoals = 0, bGoals = 0;
  for (const d of det) {
    if (d.aWon) aWins++; else if (d.bWon) bWins++; else draws++;
    if (d.home === a.code) { aGoals += d.homeScore; bGoals += d.awayScore; }
    else { aGoals += d.awayScore; bGoals += d.homeScore; }
  }
  return ok({
    teamA: a.code, teamB: b.code,
    played: det.length, aWins, draws, bWins, aGoals, bGoals,
    meetings: det,
    note: det.length === 0 ? 'these two teams did not meet in this tournament' : 'only this tournament\'s matches are included',
  });
}

function tTeamKnockoutRecord(args) {
  const r = resolveTeam(args.team);
  if (!r.ok) return fail(r.error, r.suggestions);
  const code = r.code;
  const kos = MATCHES
    .filter((m) => m.stage === 'knockout' && (m.home.code === code || m.away.code === code));
  const roundOrder = { round_of_32: 1, round_of_16: 2, quarterfinal: 3, semifinal: 4, third_place: 5, final: 6 };
  kos.sort((a, b) => (roundOrder[a.round] || 9) - (roundOrder[b.round] || 9));
  const path = kos.map((m) => {
    const opp = m.home.code === code ? m.away.code : m.home.code;
    const winner = matchWinner(m);
    return {
      round: m.round, opponent: opp, score: m.score,
      homeScore: m.homeScore, awayScore: m.awayScore,
      result: winner === code ? 'W' : (winner === null ? 'D' : 'L'),
      viaPenalties: !!m.penaltyShootout, viaExtraTime: !!m.extraTime,
    };
  });
  const w = path.filter((p) => p.result === 'W').length;
  const d = path.filter((p) => p.result === 'D').length;
  const l = path.filter((p) => p.result === 'L').length;
  const last = kos[kos.length - 1];
  const reached = last ? (last.round === 'final' && matchWinner(last) === code ? 'champion' : last.round) : null;
  const eliminatedBy = (last && matchWinner(last) !== code) ? (last.home.code === code ? last.away.code : last.home.code) : null;
  return ok({ team: code, reached, eliminatedBy, played: kos.length, w, d, l, path });
}

function tCompareGroups(args) {
  let groups = args.groups && args.groups.length ? args.groups : Object.keys(GROUPS);
  const out = [];
  for (const g of groups) {
    const pool = (BY_GROUP.get(g) || []).filter((m) => m.stage === 'group');
    let totalGoals = 0, yellow = 0, red = 0, draws = 0;
    for (const m of pool) {
      totalGoals += m.homeScore + m.awayScore;
      if (m.homeScore === m.awayScore) draws++;
      for (const c of m.cards || []) { if (c.type === 'red') red++; else yellow++; }
    }
    const standing = STANDINGS[g] || [];
    const topTeam = standing.length ? standing[0].code : null;
    const tally = new Map();
    for (const m of pool) {
      for (const goal of m.goals || []) {
        if (goal.isOwnGoal) continue;
        if (!tally.has(goal.player)) tally.set(goal.player, { player: goal.player, playerZh: playerZhOf(goal.player) || goal.player, team: goal.team, goals: 0 });
        tally.get(goal.player).goals++;
      }
    }
    const topScorerInGroup = [...tally.values()].sort((a, b) => b.goals - a.goals)[0] || null;
    out.push({
      group: g, matches: pool.length, totalGoals,
      avgGoals: pool.length ? Math.round((totalGoals / pool.length) * 100) / 100 : 0,
      draws, yellow, red, topTeam, topScorerInGroup,
    });
  }
  return ok({ groups: out });
}

// ============ 注册表 ============
const TOOLS = {
  get_match: tGetMatch, list_matches: tListMatches, get_standings: tGetStandings,
  get_bracket: tGetBracket, get_awards: tGetAwards, get_team_info: tGetTeamInfo,
  get_venue_info: tGetVenueInfo, get_top_scorers: tGetTopScorers, get_top_assists: tGetTopAssists,
  tournament_goal_stats: tTournamentGoalStats, biggest_wins: tBiggestWins,
  highest_scoring_matches: tHighestScoringMatches, compare_scorers: tCompareScorers,
  card_rankings_by_player: tCardRankingsByPlayer, card_rankings_by_team: tCardRankingsByTeam,
  cards_in_match: tCardsInMatch, head_to_head: tHeadToHead,
  team_knockout_record: tTeamKnockoutRecord, compare_groups: tCompareGroups,
};

export function runTool(name, args) {
  try {
    const fn = TOOLS[name];
    if (!fn) return fail(`unknown tool: ${name}`);
    return fn(args || {});
  } catch (e) {
    return fail(`tool ${name} failed: ${e && e.message ? e.message : e}`);
  }
}

// ============ TOOL_SCHEMAS（OpenAI 兼容，与 _tools.mjs 一致） ============
export const TOOL_SCHEMAS = [
  { type: 'function', function: { name: 'get_match', description: 'Get one match with full detail: score, all goals (scorer, minute, penalty/own-goal flags), all cards, stadium, referee, attendance, extra time and penalty shootout. Use when the user asks about a specific game.', parameters: { type: 'object', properties: { match_id: { type: 'integer', description: 'Match id 1-104' }, team_a: { type: 'string' }, team_b: { type: 'string' }, date: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'list_matches', description: 'List matches filtered by team, group, stage or knockout round. Returns compact summaries (no goal/card detail). Use get_match for detail.', parameters: { type: 'object', properties: { team: { type: 'string' }, group: { type: 'string', enum: ['A','B','C','D','E','F','G','H','I','J','K','L'] }, stage: { type: 'string', enum: ['group','knockout'] }, round: { type: 'string', enum: ['r32','r16','qf','sf','third_place','final'] }, date_from: { type: 'string' }, date_to: { type: 'string' }, limit: { type: 'integer', default: 20, maximum: 104 } }, required: [] } } },
  { type: 'function', function: { name: 'get_standings', description: 'Group stage standings table (P W D L GF GA GD Pts, position) for one group or all 12 groups A-L.', parameters: { type: 'object', properties: { group: { type: 'string', enum: ['A','B','C','D','E','F','G','H','I','J','K','L'] } }, required: [] } } },
  { type: 'function', function: { name: 'get_bracket', description: 'Knockout bracket. Returns the pairings, scores and winners for one round or the whole bracket.', parameters: { type: 'object', properties: { round: { type: 'string', enum: ['r32','r16','qf','sf','third_place','final'] } }, required: [] } } },
  { type: 'function', function: { name: 'get_awards', description: 'Final standings (champion, runner-up, third, fourth) and individual awards: Golden Ball, Golden Boot, Golden Glove, Best Young Player, Fair Play, plus overall tournament stats.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'get_team_info', description: 'Profile of one team: FIFA ranking, confederation, group, group-stage record, and its full path through the tournament.', parameters: { type: 'object', properties: { team: { type: 'string' } }, required: ['team'] } } },
  { type: 'function', function: { name: 'get_venue_info', description: 'Stadium information (name, city, country, capacity). Omit name to list all 16 venues.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'get_top_scorers', description: 'Top goalscorers ranking computed from every match. Own goals are excluded. Optionally restrict to one team.', parameters: { type: 'object', properties: { limit: { type: 'integer', default: 10, maximum: 50 }, team: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'get_top_assists', description: 'Top assists ranking. Only the official top 10 is available in the dataset.', parameters: { type: 'object', properties: { limit: { type: 'integer', default: 10, maximum: 10 } }, required: [] } } },
  { type: 'function', function: { name: 'tournament_goal_stats', description: 'Aggregate scoring stats: total goals, goals per match, penalties, own goals, clean sheets, draws, biggest margin, and goals bucketed by 15-minute periods. Scope can be the whole tournament, the group stage, the knockout stage, one group or one round.', parameters: { type: 'object', properties: { scope: { type: 'string', enum: ['all','group','knockout'], default: 'all' }, group: { type: 'string', enum: ['A','B','C','D','E','F','G','H','I','J','K','L'] }, round: { type: 'string', enum: ['r32','r16','qf','sf','third_place','final'] } }, required: [] } } },
  { type: 'function', function: { name: 'biggest_wins', description: 'Matches ranked by winning margin (largest first). Draws excluded.', parameters: { type: 'object', properties: { limit: { type: 'integer', default: 5, maximum: 20 }, scope: { type: 'string', enum: ['all','group','knockout'], default: 'all' } }, required: [] } } },
  { type: 'function', function: { name: 'highest_scoring_matches', description: 'Matches ranked by total goals in the game (highest first).', parameters: { type: 'object', properties: { limit: { type: 'integer', default: 5, maximum: 20 }, scope: { type: 'string', enum: ['all','group','knockout'], default: 'all' } }, required: [] } } },
  { type: 'function', function: { name: 'compare_scorers', description: "Side-by-side comparison of 2 to 5 players' goal records: goals, penalties, open-play goals, the matches they scored in and the minutes.", parameters: { type: 'object', properties: { players: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 } }, required: ['players'] } } },
  { type: 'function', function: { name: 'card_rankings_by_player', description: "Discipline ranking by individual. Only 'yellow' and 'red' card types exist in this dataset. Some entries are coaches, flagged with isStaff.", parameters: { type: 'object', properties: { type: { type: 'string', enum: ['all','yellow','red'], default: 'all' }, limit: { type: 'integer', default: 10, maximum: 50 }, team: { type: 'string' }, scope: { type: 'string', enum: ['all','group','knockout'], default: 'all' } }, required: [] } } },
  { type: 'function', function: { name: 'card_rankings_by_team', description: 'Discipline ranking by team, including cards per match since knockout teams played more games.', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['all','yellow','red'], default: 'all' }, limit: { type: 'integer', default: 10, maximum: 48 }, scope: { type: 'string', enum: ['all','group','knockout'], default: 'all' } }, required: [] } } },
  { type: 'function', function: { name: 'cards_in_match', description: 'All yellow and red cards shown in one match, sorted chronologically.', parameters: { type: 'object', properties: { match_id: { type: 'integer' }, team_a: { type: 'string' }, team_b: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'head_to_head', description: 'Every meeting between two teams in this tournament, with an aggregated win/draw/loss and goals summary. Returns played=0 if they never met.', parameters: { type: 'object', properties: { team_a: { type: 'string' }, team_b: { type: 'string' } }, required: ['team_a', 'team_b'] } } },
  { type: 'function', function: { name: 'team_knockout_record', description: "A team's knockout-stage run: how far it went, who eliminated it, round-by-round results including extra time and penalty shootouts.", parameters: { type: 'object', properties: { team: { type: 'string' } }, required: ['team'] } } },
  { type: 'function', function: { name: 'compare_groups', description: 'Compare group-stage groups on goals, goals per match, draws, cards and the strongest team. Omit groups to compare all 12.', parameters: { type: 'object', properties: { groups: { type: 'array', items: { type: 'string', enum: ['A','B','C','D','E','F','G','H','I','J','K','L'] } } }, required: [] } } },
];

// ============ 系统提示词（与 _prompt.mjs 一致） ============
export function buildSystemPrompt(lang) {
  const zh = lang === 'zh';
  return `You are the in-site match analyst for a 2026 FIFA World Cup statistics website.

## Ground rules
1. EVERY factual claim about matches, scores, players, cards, standings, brackets or awards MUST come from a tool call. You have no reliable memory of this tournament - do not answer from prior knowledge, and never guess a score, a minute, a scorer or a number.
2. If the tools return no data, or the data cannot answer the question, say so plainly and state what IS available. Never invent, never extrapolate.
3. If a tool returns { "ok": false } with suggestions, ask the user a short clarifying question using those suggestions.
4. Never mention tool names, JSON, "the dataset", function calling, or your own internals. Speak as a person who knows the tournament.
5. Only 2026 World Cup data exists here. For anything about other tournaments, transfers, live/future matches or player biographies, say it is outside what you can look up.

## Dataset boundaries - state these limits instead of improvising
- 104 matches: 72 group-stage + 32 knockout. 48 teams in 12 groups (A-L).
- Knockout rounds: Round of 32, Round of 16, quarter-finals, semi-finals, third-place play-off, final.
- Available per match: score, goalscorers with minute, penalty and own-goal flags, yellow/red cards with minute, stadium, referee, attendance, extra time and penalty shootout.
- NOT available: lineups, formations, substitutions, possession, shots, xG, player ages/positions, and any match outside this tournament.
- Cards are only "yellow" or "red" - there is no separate second-yellow record. Some card entries belong to coaching staff; they are flagged as staff - mention it only when it matters.
- Assists data only exists for the official top 10.
- Own goals are credited to the opposing team in the scoreline but are excluded from a player's goal tally.

## Style
- Write like a well-briefed sports broadcaster: confident, concrete, warm. Lead with the answer, then the evidence.
- Keep it under about 180 words unless the user explicitly asks for a full list.
- Use a short markdown table for any ranking or comparison of 3+ rows; plain prose otherwise. No headings, no bullet-point walls.
- Always attach the concrete numbers (score, minute, match id when useful) that back the claim.
- Give exactly one natural follow-up suggestion at the end, only when it is genuinely useful.

## Language
Answer ONLY in ${zh ? 'Simplified Chinese (简体中文)' : 'English'}, regardless of the language the user typed in.
${zh
  ? 'Use the Chinese team names and Chinese player names provided by the tools (fields nameZh / playerZh). If a Chinese name is unavailable, keep the original Latin spelling rather than transliterating it yourself.'
  : 'Use the English team and player names.'}`;
}
