// netlify/functions/_data.mjs
// 共享数据层：一次性加载 data/*.json，集中处理所有已知数据陷阱，预构建索引。
// 以 "_" 开头的文件不会被 Netlify 注册为独立函数。
import matchesData   from "../../public/data/matches.json"   with { type: "json" };
import teamsData     from "../../public/data/teams.json"     with { type: "json" };
import standingsData from "../../public/data/standings.json" with { type: "json" };
import bracketData   from "../../public/data/bracket.json"   with { type: "json" };
import awardsData    from "../../public/data/awards.json"    with { type: "json" };
import groupsData    from "../../public/data/groups.json"    with { type: "json" };
import venuesData    from "../../public/data/venues.json"    with { type: "json" };
import pnamesData    from "../../public/data/player-names.json" with { type: "json" };
import { normalizeRound as normalizeSharedRound, normalizeTournamentDataset } from "../../src/shared/tournament-query/dataset.js";

// ============ 基础数据导出 ============
const dataset = normalizeTournamentDataset({ matches: matchesData, teams: teamsData, standings: standingsData, bracket: bracketData, awards: awardsData, groups: groupsData, venues: venuesData, playerNames: pnamesData });
export const MATCHES = dataset.matches;
export const TEAMS = dataset.teams;
export const STANDINGS = dataset.standings;
export const BRACKET = dataset.bracket;
export const AWARDS = dataset.awards;
export const GROUPS = dataset.groups;
export const VENUES = dataset.venues;
export const PNAMES = dataset.playerNames;

// ============ 轮次归一化 ============
// matches.json 的 round 用单数 (quarterfinal/semifinal)，bracket.json 的键用复数 (quarterfinals/semifinals)。
// 对外统一暴露 ROUNDS 短名。
export const ROUNDS = ["round_of_32", "round_of_16", "quarterfinal", "semifinal", "third_place", "final"];

const ROUND_ALIAS = {
  r32: "round_of_32",
  r16: "round_of_16",
  qf: "quarterfinal",
  sf: "semifinal",
  third: "third_place",
  third_place: "third_place",
  final: "final",
  quarterfinals: "quarterfinal",   // bracket 复数键 → matches 单数
  semifinals: "semifinal",
};

export const normalizeRound = normalizeSharedRound;

// bracket.json 轮次键 → matches 轮次名（处理单复数）
const BRACKET_KEY_TO_ROUND = {
  round_of_32: "round_of_32",
  round_of_16: "round_of_16",
  quarterfinals: "quarterfinal",
  semifinals: "semifinal",
  third_place: "third_place",
  final: "final",
};

// ============ 归一化工具 ============

// "90+12" -> 102, "105+1" -> 106, "9" -> 9
export function parseMinute(s) {
  if (s === null || s === undefined) return 0;
  const str = String(s);
  const [a, b] = str.split("+");
  const base = parseInt(a, 10) || 0;
  const extra = b !== undefined ? (parseInt(b, 10) || 0) : 0;
  return base + extra;
}

// "80,824" -> 80824；非法返回 null
export function parseAttendance(s) {
  if (s === null || s === undefined) return null;
  const n = parseInt(String(s).replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// 球队在该场的进球数：直接取比分（绕开乌龙球归属陷阱，实测与 goals[] 逐场一致）
export function teamGoalsOf(match, code) {
  if (match.home.code === code) return match.homeScore;
  if (match.away.code === code) return match.awayScore;
  return null;
}

// 一个进球"记在谁头上"：乌龙球记给对手
export function creditedTeam(match, goal) {
  if (goal.isOwnGoal) return goal.team === match.home.code ? match.away.code : match.home.code;
  return goal.team;
}

// 精简投影，控 token
export function matchBrief(m) {
  return {
    id: m.id,
    date: m.date,
    stage: m.stage,
    round: m.round || null,
    group: m.group || null,
    home: { code: m.home.code, name: m.home.name, nameZh: m.home.nameZh },
    away: { code: m.away.code, name: m.away.name, nameZh: m.away.nameZh },
    score: m.score,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    stadium: m.stadium,
    extraTime: !!m.extraTime,
    penaltyShootout: m.penaltyShootout || null,
  };
}

// ============ 教练白名单 ============
// cards[] 数据里混入教练。player-names.json 连教练中文名都收录了，无法用"无中文名"推断，
// 因此用白名单（本次实测数据中确切的 8 名教练）。
export const KNOWN_STAFF = new Set([
  "Julian Nagelsmann",      // 德国
  "Gustavo Alfaro",         // 巴拉圭
  "Vincenzo Montella",      // 土耳其
  "Rudi Garcia",            // 比利时
  "Sergej Barbarez",        // 波黑
  "Lionel Scaloni",         // 阿根廷
  "Luis Amaranto Perea",    // 哥伦比亚
  "Hossam Hassan",          // 埃及
]);

export function isStaff(name) {
  return KNOWN_STAFF.has(name);
}

// ============ 球队解析 ============
export function teamZhName(code) {
  const t = TEAMS[code];
  return t && t.name ? (t.name.zh || t.name.en) : code;
}
export function teamEnName(code) {
  const t = TEAMS[code];
  return t && t.name ? (t.name.en || code) : code;
}

// "西班牙" / "Spain" / "esp" / "ESP" -> { ok:true, code:"ESP" }
// 失败 -> { ok:false, error, suggestions: [...] }
export function resolveTeam(input) {
  if (!input) return { ok: false, error: "empty team input", suggestions: [] };
  const q = String(input).trim().toLowerCase();
  if (!q) return { ok: false, error: "empty team input", suggestions: [] };

  // 1) 精确匹配代码
  const codeHit = Object.keys(TEAMS).find((c) => c.toLowerCase() === q);
  if (codeHit) return { ok: true, code: codeHit };

  // 2) 精确匹配英文名 / 中文名
  for (const code of Object.keys(TEAMS)) {
    const t = TEAMS[code];
    const en = (t.name && t.name.en || "").toLowerCase();
    const zh = (t.name && t.name.zh || "").toLowerCase();
    if (en === q || zh === q) return { ok: true, code };
  }

  // 3) 子串匹配，收集建议
  const suggestions = [];
  for (const code of Object.keys(TEAMS)) {
    const t = TEAMS[code];
    const en = (t.name && t.name.en || "").toLowerCase();
    const zh = (t.name && t.name.zh || "").toLowerCase();
    if (en.includes(q) || zh.includes(q)) {
      suggestions.push({ code, en: t.name.en, zh: t.name.zh });
      if (suggestions.length >= 5) break;
    }
  }
  return { ok: false, error: `unknown team: ${input}`, suggestions };
}

// ============ 球员解析 ============
// 预构建：小写英文名 -> {name, zh, team}（team 取最后出现场次）
const playerIndex = new Map();
function buildPlayerIndex() {
  for (const m of MATCHES) {
    for (const g of m.goals || []) {
      if (!g.player) continue;
      const key = g.player.toLowerCase();
      playerIndex.set(key, { name: g.player, zh: PNAMES[g.player] || null, team: g.team });
    }
    for (const c of m.cards || []) {
      if (!c.player) continue;
      const key = c.player.toLowerCase();
      if (!playerIndex.has(key)) {
        playerIndex.set(key, { name: c.player, zh: PNAMES[c.player] || null, team: c.team });
      }
    }
  }
}
buildPlayerIndex();

export function playerZhOf(name) {
  if (!name) return null;
  return PNAMES[name] || null;
}

// 输入英文或中文名，返回 { ok:true, players:[{name, zh, team}] } 或 { ok:false, suggestions }
export function resolvePlayer(input) {
  if (!input) return { ok: false, error: "empty player input", suggestions: [] };
  const q = String(input).trim().toLowerCase();
  if (!q) return { ok: false, error: "empty player input", suggestions: [] };

  // 精确命中（英文名）
  if (playerIndex.has(q)) {
    const p = playerIndex.get(q);
    return { ok: true, players: [{ name: p.name, zh: p.zh, team: p.team }] };
  }

  // 中文名反查
  const zhHits = [];
  for (const [en, zh] of Object.entries(PNAMES)) {
    if (zh === input.trim()) { zhHits.push(en); }
  }
  if (zhHits.length === 1) {
    const en = zhHits[0];
    const p = playerIndex.get(en.toLowerCase()) || { name: en, zh: input.trim(), team: null };
    return { ok: true, players: [{ name: p.name, zh: p.zh || input.trim(), team: p.team }] };
  }

  // 子串匹配（英文）
  const hits = [];
  for (const [key, p] of playerIndex) {
    if (key.includes(q) || (p.zh && p.zh.includes(input.trim()))) {
      hits.push({ name: p.name, zh: p.zh, team: p.team });
      if (hits.length >= 5) break;
    }
  }
  if (hits.length === 1) return { ok: true, players: hits };
  if (hits.length > 1) {
    return { ok: false, error: `ambiguous player: ${input}`, suggestions: hits.map((h) => h.name) };
  }
  return { ok: false, error: `unknown player: ${input}`, suggestions: [] };
}

// ============ 预构建索引 ============
export const BY_ID = new Map();
export const BY_TEAM = new Map();   // code -> matches[]
export const BY_GROUP = new Map();  // group -> matches[]
export const BY_ROUND = new Map();  // round -> matches[]
export const ALL_TEAM_CODES = Object.keys(TEAMS);

(function buildIndexes() {
  for (const m of MATCHES) {
    BY_ID.set(m.id, m);
    if (m.group) {
      if (!BY_GROUP.has(m.group)) BY_GROUP.set(m.group, []);
      BY_GROUP.get(m.group).push(m);
    }
    if (m.round) {
      if (!BY_ROUND.has(m.round)) BY_ROUND.set(m.round, []);
      BY_ROUND.get(m.round).push(m);
    }
    for (const code of [m.home.code, m.away.code]) {
      if (!BY_TEAM.has(code)) BY_TEAM.set(code, []);
      BY_TEAM.get(code).push(m);
    }
  }
})();

export { BRACKET_KEY_TO_ROUND };
