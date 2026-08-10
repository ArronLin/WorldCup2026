// netlify/functions/_tools.mjs
// 20 个 AI 工具实现 + TOOL_SCHEMAS（OpenAI 兼容 tools 数组）。
// ⚠️ 与 src/features/chat/tools.js 是同一套 20 工具的并行实现（本地 BYOK 模式在浏览器内运行），新增/删除工具须同步两处。
// 统一返回契约：{ ok:true, data } 或 { ok:false, error, suggestions? }。
// 工具层永不抛异常（try/catch 包裹），抛异常会中断 SSE 流。
import {
  MATCHES, TEAMS, STANDINGS, BRACKET, AWARDS, GROUPS, VENUES, PNAMES,
  ROUNDS, normalizeRound, parseMinute, parseAttendance, teamGoalsOf, creditedTeam,
  matchBrief, isStaff, resolveTeam, resolvePlayer, playerZhOf,
  BY_ID, BY_TEAM, BY_GROUP, BY_ROUND, ALL_TEAM_CODES,
} from "./_data.mjs";

// ============ 通用 ============
const ok = (data) => ({ ok: true, data });
const fail = (error, suggestions) => ({ ok: false, error, suggestions });

function filterByScope(matches, args) {
  let out = matches;
  if (args.scope === "group") out = out.filter((m) => m.stage === "group");
  else if (args.scope === "knockout") out = out.filter((m) => m.stage === "knockout");
  if (args.group) out = out.filter((m) => m.group === args.group);
  if (args.round) {
    const r = normalizeRound(args.round);
    if (r) out = out.filter((m) => m.round === r);
  }
  return out;
}

const TRUNCATE = 6000;
function wrap(data, extra = {}) {
  let json;
  try { json = JSON.stringify(data); } catch { json = '{"error":"unserializable"}'; }
  const truncated = json.length > TRUNCATE;
  if (truncated) json = json.slice(0, TRUNCATE) + ',"_truncated":true';
  return ok(Object.assign(JSON.parse(json), extra));
}

// ============ A. 基础查询 (7) ============

// 1. get_match —— 单场完整信息
function tGetMatch(args) {
  if (args.match_id) {
    const m = BY_ID.get(Number(args.match_id));
    if (!m) return fail(`match ${args.match_id} not found`, { hint: "match ids are 1-104" });
    return wrap({
      ...matchBrief(m),
      time: m.time, referee: m.referee, attendance: m.attendance,
      goals: (m.goals || []).map((g) => ({ ...g, minuteNum: parseMinute(g.minute) })),
      cards: (m.cards || []).map((c) => ({ ...c, minuteNum: parseMinute(c.minute), isStaff: isStaff(c.player) })),
    });
  }
  if (args.team_a && args.team_b) {
    const a = resolveTeam(args.team_a); const b = resolveTeam(args.team_b);
    if (!a.ok) return fail(a.error, a.suggestions);
    if (!b.ok) return fail(b.error, b.suggestions);
    const ms = MATCHES.filter((m) =>
      (m.home.code === a.code && m.away.code === b.code) || (m.home.code === b.code && m.away.code === a.code));
    if (ms.length === 0) return fail(`no match between ${args.team_a} and ${args.team_b}`);
    const m = args.date ? ms.find((x) => x.date === args.date) || ms[0] : ms[0];
    return wrap({
      ...matchBrief(m),
      time: m.time, referee: m.referee, attendance: m.attendance,
      goals: (m.goals || []).map((g) => ({ ...g, minuteNum: parseMinute(g.minute) })),
      cards: (m.cards || []).map((c) => ({ ...c, minuteNum: parseMinute(c.minute), isStaff: isStaff(c.player) })),
    });
  }
  return fail("need match_id, or team_a+team_b", { hint: 'e.g. {"match_id":104}' });
}

// 2. list_matches —— 筛选列表（精简投影）
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
    if (!r) return fail(`unknown round ${args.round}`, { hint: ROUNDS.join(", ") });
    out = out.filter((m) => m.round === r);
  }
  if (args.date_from) out = out.filter((m) => m.date >= args.date_from);
  if (args.date_to) out = out.filter((m) => m.date <= args.date_to);
  out.sort((x, y) => x.id - y.id);
  const limit = Math.min(Number(args.limit || 20), 104);
  const truncated = out.length > limit;
  return ok({ count: out.length, returned: truncated ? limit : out.length, truncated, matches: out.slice(0, limit).map(matchBrief) });
}

// 3. get_standings —— 积分榜
function tGetStandings(args) {
  if (args.group) {
    const rows = STANDINGS[args.group];
    if (!rows) return fail(`group ${args.group} not found`, { hint: "A-L" });
    return ok({ group: args.group, standings: rows });
  }
  return ok({ groups: Object.keys(STANDINGS).map((g) => ({ group: g, standings: STANDINGS[g] })) });
}

// 4. get_bracket —— 淘汰赛对阵
function tGetBracket(args) {
  const order = ["round_of_32", "round_of_16", "quarterfinal", "semifinal", "third_place", "final"];
  const bracketKey = { round_of_32: "round_of_32", round_of_16: "round_of_16", quarterfinal: "quarterfinals", semifinal: "semifinals", third_place: "third_place", final: "final" };
  const project = (n) => ({
    id: n.id, home: n.home, away: n.away, homeName: n.homeName, awayName: n.awayName,
    score: n.score, homeScore: n.homeScore, awayScore: n.awayScore,
    date: n.date, stadium: n.stadium, winner: n.winner,
  });
  if (args.round) {
    const r = normalizeRound(args.round);
    if (!r) return fail(`unknown round ${args.round}`, { hint: "r32,r16,qf,sf,third_place,final" });
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

// 5. get_awards —— 奖项
function tGetAwards() {
  const pick = (o) => o ? { code: o.code, name: o.name, title: o.title } : null;
  return ok({
    champion: pick(AWARDS.champion), runner_up: pick(AWARDS.runner_up),
    third_place: pick(AWARDS.third_place), fourth_place: pick(AWARDS.fourth_place),
    golden_ball: AWARDS.golden_ball, golden_boot: AWARDS.golden_boot,
    golden_glove: AWARDS.golden_glove, young_player: AWARDS.young_player,
    fair_play: AWARDS.fair_play, tournament_stats: AWARDS.tournament_stats,
  });
}

// 6. get_team_info —— 球队档案
function tGetTeamInfo(args) {
  const r = resolveTeam(args.team);
  if (!r.ok) return fail(r.error, r.suggestions);
  const code = r.code;
  const team = TEAMS[code];
  const groupStanding = (STANDINGS[team.group] || []).find((s) => s.code === code) || null;
  const all = (BY_TEAM.get(code) || []).slice().sort((a, b) => a.id - b.id);
  return wrap({
    code, name: team.name, group: team.group, confederation: team.confederation,
    ranking: team.ranking, groupStage: team.stats,
    groupStanding,
    matches: all.map(matchBrief),
  });
}

// 7. get_venue_info —— 球场信息
function tGetVenueInfo(args) {
  if (args.name) {
    const q = String(args.name).trim().toLowerCase();
    const hit = Object.entries(VENUES).find(([slug, v]) =>
      slug.toLowerCase().includes(q) || (v.name.en || "").toLowerCase().includes(q) || (v.name.zh || "").includes(q) ||
      (v.city.en || "").toLowerCase().includes(q) || (v.city.zh || "").includes(q));
    if (!hit) return fail(`venue ${args.name} not found`);
    const [slug, v] = hit;
    return ok({ slug, name: v.name, city: v.city, country: v.country, capacity: v.capacity });
  }
  return ok({ venues: Object.entries(VENUES).map(([slug, v]) => ({ slug, name: v.name, city: v.city, capacity: v.capacity })) });
}

// ============ B. 射手/助攻 (2) ============

// 8. get_top_scorers —— 射手榜（排除乌龙）
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

// 9. get_top_assists —— 助攻榜（仅官方 top10）
function tGetTopAssists(args) {
  const limit = Math.min(Number(args.limit || 10), 10);
  return ok({ note: "only the official top 10 assists are available in this dataset", top: (AWARDS.top_assists || []).slice(0, limit) });
}

// ============ C. 进球与结果统计 (4) ============

// 10. tournament_goal_stats —— 进球统计
function tTournamentGoalStats(args) {
  const pool = filterByScope(MATCHES, args);
  if (pool.length === 0) return fail("no matches for this scope");
  let totalGoals = 0, penalties = 0, ownGoals = 0, cleanSheets = 0, draws = 0;
  let biggest = { margin: -1 };
  const goalsByPeriod = { "1-15": 0, "16-30": 0, "31-45": 0, "46-60": 0, "61-75": 0, "76-90": 0, "90+": 0 };
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
      if (t <= 15) goalsByPeriod["1-15"]++;
      else if (t <= 30) goalsByPeriod["16-30"]++;
      else if (t <= 45) goalsByPeriod["31-45"]++;
      else if (t <= 60) goalsByPeriod["46-60"]++;
      else if (t <= 75) goalsByPeriod["61-75"]++;
      else if (t <= 90) goalsByPeriod["76-90"]++;
      else goalsByPeriod["90+"]++;
    }
  }
  const avg = Math.round((totalGoals / pool.length) * 100) / 100;
  return ok({
    scope: { stage: args.scope || "all", group: args.group || null, round: args.round ? normalizeRound(args.round) : null },
    matches: pool.length, totalGoals, avgGoals: avg, penalties, ownGoals,
    cleanSheets, draws, biggestMargin: biggest,
    goalsByPeriod,
    note: "own goals count in the scoreline but are excluded from player tallies",
  });
}

// 11. biggest_wins —— 最大分差
function tBiggestWins(args) {
  const pool = filterByScope(MATCHES, args);
  const list = pool
    .filter((m) => m.homeScore !== m.awayScore)
    .map((m) => ({ ...matchBrief(m), margin: Math.abs(m.homeScore - m.awayScore) }))
    .sort((a, b) => (b.margin - a.margin) || ((b.homeScore + b.awayScore) - (a.homeScore + a.awayScore)));
  const limit = Math.min(Number(args.limit || 5), 20);
  return ok({ count: list.length, top: list.slice(0, limit) });
}

// 12. highest_scoring_matches —— 总进球最多
function tHighestScoringMatches(args) {
  const pool = filterByScope(MATCHES, args);
  const list = pool
    .map((m) => ({ ...matchBrief(m), totalGoals: m.homeScore + m.awayScore }))
    .sort((a, b) => (b.totalGoals - a.totalGoals) || (b.id - a.id));
  const limit = Math.min(Number(args.limit || 5), 20);
  return ok({ count: list.length, top: list.slice(0, limit) });
}

// 13. compare_scorers —— 球员对比（2-5 人）
function tCompareScorers(args) {
  const players = (args.players || []).slice(0, 5);
  if (players.length < 2) return fail("compare at least 2 players", { hint: '{"players":["Mbappé","Messi"]}' });
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

// 14. card_rankings_by_player —— 球员牌榜
function tCardRankingsByPlayer(args) {
  const pool = filterByScope(MATCHES, args);
  const tally = new Map();
  for (const m of pool) {
    for (const c of m.cards || []) {
      if (!c.player) continue;
      if (!tally.has(c.player)) tally.set(c.player, { player: c.player, playerZh: playerZhOf(c.player) || c.player, team: c.team, yellow: 0, red: 0, total: 0, isStaff: isStaff(c.player), matchIds: [] });
      const e = tally.get(c.player);
      if (c.type === "red") e.red++; else e.yellow++;
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
  if (args.type === "yellow") list = list.filter((e) => e.yellow > 0).sort((a, b) => b.yellow - a.yellow || b.red - a.red);
  else if (args.type === "red") list = list.filter((e) => e.red > 0).sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  else list.sort((a, b) => b.total - a.total || b.red - a.red);
  const limit = Math.min(Number(args.limit || 10), 50);
  return ok({ note: "only yellow and red card types exist; entries flagged isStaff are coaching staff", count: list.length, top: list.slice(0, limit) });
}

// 15. card_rankings_by_team —— 球队牌榜
function tCardRankingsByTeam(args) {
  const pool = filterByScope(MATCHES, args);
  const tally = new Map();
  for (const m of pool) {
    for (const c of m.cards || []) {
      if (!c.team) continue;
      if (!tally.has(c.team)) tally.set(c.team, { team: c.team, yellow: 0, red: 0, total: 0, matches: 0 });
      const e = tally.get(c.team);
      if (c.type === "red") e.red++; else e.yellow++;
      e.total++;
    }
  }
  // 出场次数统一用 BY_TEAM（全赛事出场）
  const rows = [...tally.values()].map((e) => {
    const played = (BY_TEAM.get(e.team) || []).length;
    return { ...e, matches: played, cardsPerMatch: played ? Math.round((e.total / played) * 100) / 100 : 0 };
  });
  if (args.type === "yellow") rows.sort((a, b) => b.yellow - a.yellow || b.red - a.red);
  else if (args.type === "red") rows.sort((a, b) => b.red - a.red || b.yellow - a.yellow);
  else rows.sort((a, b) => b.total - a.total || b.red - a.red);
  const limit = Math.min(Number(args.limit || 10), 48);
  return ok({ count: rows.length, top: rows.slice(0, limit) });
}

// 16. cards_in_match —— 单场牌
function tCardsInMatch(args) {
  let m = null;
  if (args.match_id) m = BY_ID.get(Number(args.match_id));
  else if (args.team_a && args.team_b) {
    const a = resolveTeam(args.team_a); const b = resolveTeam(args.team_b);
    if (!a.ok) return fail(a.error, a.suggestions);
    if (!b.ok) return fail(b.error, b.suggestions);
    m = MATCHES.find((x) =>
      (x.home.code === a.code && x.away.code === b.code) || (x.home.code === b.code && x.away.code === a.code)) || null;
  }
  if (!m) return fail("match not found", { hint: 'e.g. {"match_id":75}' });
  const cards = (m.cards || []).map((c) => ({ ...c, minuteNum: parseMinute(c.minute), isStaff: isStaff(c.player) }))
    .sort((a, b) => a.minuteNum - b.minuteNum || a.minute.localeCompare(b.minute, undefined, { numeric: true }));
  return ok({ match: matchBrief(m), count: cards.length, cards });
}

// ============ E. 交锋与战绩 (3) ============

function matchWinner(m) {
  if (m.homeScore > m.awayScore) return m.home.code;
  if (m.awayScore > m.homeScore) return m.away.code;
  if (m.penaltyShootout) return m.penaltyShootout.home > m.penaltyShootout.away ? m.home.code : m.away.code;
  return null; // draw
}

// 17. head_to_head —— 两队交锋
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
      id: m.id, date: m.date, round: m.round || "group", stage: m.stage,
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
    note: det.length === 0 ? "these two teams did not meet in this tournament" : "only this tournament's matches are included",
  });
}

// 18. team_knockout_record —— 淘汰赛之路
function tTeamKnockoutRecord(args) {
  const r = resolveTeam(args.team);
  if (!r.ok) return fail(r.error, r.suggestions);
  const code = r.code;
  const kos = MATCHES
    .filter((m) => m.stage === "knockout" && (m.home.code === code || m.away.code === code))
    .sort((a, b) => a.id - b.id);
  const roundOrder = { round_of_32: 1, round_of_16: 2, quarterfinal: 3, semifinal: 4, third_place: 5, final: 6 };
  kos.sort((a, b) => (roundOrder[a.round] || 9) - (roundOrder[b.round] || 9));
  const path = kos.map((m) => {
    const opp = m.home.code === code ? m.away.code : m.home.code;
    const winner = matchWinner(m);
    return {
      round: m.round, opponent: opp, score: m.score,
      homeScore: m.homeScore, awayScore: m.awayScore,
      result: winner === code ? "W" : (winner === null ? "D" : "L"),
      viaPenalties: !!m.penaltyShootout, viaExtraTime: !!m.extraTime,
    };
  });
  const w = path.filter((p) => p.result === "W").length;
  const d = path.filter((p) => p.result === "D").length;
  const l = path.filter((p) => p.result === "L").length;
  const last = kos[kos.length - 1];
  const reached = last ? (last.round === "final" && matchWinner(last) === code ? "champion" : last.round) : null;
  const eliminatedBy = (last && matchWinner(last) !== code) ? (last.home.code === code ? last.away.code : last.home.code) : null;
  return ok({ team: code, reached, eliminatedBy, played: kos.length, w, d, l, path });
}

// 19. compare_groups —— 小组对比
function tCompareGroups(args) {
  let groups = args.groups && args.groups.length ? args.groups : Object.keys(GROUPS);
  const out = [];
  for (const g of groups) {
    const pool = (BY_GROUP.get(g) || []).filter((m) => m.stage === "group");
    let totalGoals = 0, yellow = 0, red = 0, draws = 0;
    for (const m of pool) {
      totalGoals += m.homeScore + m.awayScore;
      if (m.homeScore === m.awayScore) draws++;
      for (const c of m.cards || []) { if (c.type === "red") red++; else yellow++; }
    }
    const standing = STANDINGS[g] || [];
    const topTeam = standing.length ? standing[0].code : null;
    // 组内最佳射手
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

// 20. team_goal_ranking —— 球队进球/失球榜（全赛事或按阶段）
function tTeamGoalRanking(args) {
  const scope = args.scope; // all | group | knockout
  const pool = scope === "group" ? MATCHES.filter((m) => m.stage === "group")
            : scope === "knockout" ? MATCHES.filter((m) => m.stage === "knockout")
            : MATCHES;
  const gf = new Map(), ga = new Map(), played = new Map(), zh = new Map();
  for (const m of pool) {
    const h = m.home.code, a = m.away.code;
    gf.set(h, (gf.get(h) || 0) + m.homeScore);
    ga.set(h, (ga.get(h) || 0) + m.awayScore);
    gf.set(a, (gf.get(a) || 0) + m.awayScore);
    ga.set(a, (ga.get(a) || 0) + m.homeScore);
    played.set(h, (played.get(h) || 0) + 1);
    played.set(a, (played.get(a) || 0) + 1);
    if (m.home.nameZh) zh.set(h, m.home.nameZh);
    if (m.away.nameZh) zh.set(a, m.away.nameZh);
  }
  const rows = Object.keys(TEAMS).map((code) => {
    const t = TEAMS[code];
    const enName = (t.name && t.name.en) ? t.name.en : t.name;
    const zhName = (t.name && t.name.zh) ? t.name.zh : (zh.get(code) || enName);
    return {
      code,
      name: enName,
      nameZh: zhName,
      gf: gf.get(code) || 0,
      ga: ga.get(code) || 0,
      played: played.get(code) || 0,
    };
  });
  const limit = Math.min(Number(args.limit || 10), 48);
  const byFor = rows.slice().sort((x, y) => (y.gf - x.gf) || (x.ga - y.ga) || x.code.localeCompare(y.code));
  const byAgainst = rows.slice().sort((x, y) => (y.ga - x.ga) || (x.gf - y.gf) || x.code.localeCompare(y.code));
  return ok({
    scope: scope || "all",
    topFor: byFor.slice(0, limit),
    topAgainst: byAgainst.slice(0, limit),
    mostFor: byFor[0] ? { code: byFor[0].code, name: byFor[0].name, nameZh: byFor[0].nameZh, gf: byFor[0].gf } : null,
    mostAgainst: byAgainst[0] ? { code: byAgainst[0].code, name: byAgainst[0].name, nameZh: byAgainst[0].nameZh, ga: byAgainst[0].ga } : null,
  });
}

// ============ 注册表 ============
const TOOLS = {
  get_match: tGetMatch,
  list_matches: tListMatches,
  get_standings: tGetStandings,
  get_bracket: tGetBracket,
  get_awards: tGetAwards,
  get_team_info: tGetTeamInfo,
  get_venue_info: tGetVenueInfo,
  get_top_scorers: tGetTopScorers,
  get_top_assists: tGetTopAssists,
  tournament_goal_stats: tTournamentGoalStats,
  biggest_wins: tBiggestWins,
  highest_scoring_matches: tHighestScoringMatches,
  compare_scorers: tCompareScorers,
  card_rankings_by_player: tCardRankingsByPlayer,
  card_rankings_by_team: tCardRankingsByTeam,
  cards_in_match: tCardsInMatch,
  head_to_head: tHeadToHead,
  team_knockout_record: tTeamKnockoutRecord,
  compare_groups: tCompareGroups,
  team_goal_ranking: tTeamGoalRanking,
};

// 统一入口：永不抛异常
export function runTool(name, args) {
  try {
    const fn = TOOLS[name];
    if (!fn) return fail(`unknown tool: ${name}`);
    return fn(args || {});
  } catch (e) {
    return fail(`tool ${name} failed: ${e && e.message ? e.message : e}`);
  }
}

export const TOOL_NAMES = Object.keys(TOOLS);
export { TRUNCATE };

// ============ TOOL_SCHEMAS（OpenAI 兼容，供 DeepSeek tools 参数） ============
const teamProp = (desc, required = false) => ({ type: "string", description: desc, ...(required ? {} : {}) });

export const TOOL_SCHEMAS = [
  { type: "function", function: {
    name: "get_match", description: "Get one match with full detail: score, all goals (scorer, minute, penalty/own-goal flags), all cards, stadium, referee, attendance, extra time and penalty shootout. Use when the user asks about a specific game.",
    parameters: { type: "object", properties: {
      match_id: { type: "integer", description: "Match id 1-104" },
      team_a: teamProp("Team name or 3-letter code, e.g. 'Spain', '西班牙', 'ESP'"),
      team_b: teamProp("Second team name or 3-letter code"),
      date: { type: "string", description: "YYYY-MM-DD, disambiguates when two teams met twice" },
    }, required: [] } } },

  { type: "function", function: {
    name: "list_matches", description: "List matches filtered by team, group, stage or knockout round. Returns compact summaries (no goal/card detail). Use get_match for detail.",
    parameters: { type: "object", properties: {
      team: teamProp("Team name or 3-letter code"),
      group: { type: "string", enum: ["A","B","C","D","E","F","G","H","I","J","K","L"], description: "Group letter (group stage only)" },
      stage: { type: "string", enum: ["group","knockout"], description: "Stage filter" },
      round: { type: "string", enum: ["r32","r16","qf","sf","third_place","final"], description: "Knockout round" },
      date_from: { type: "string", description: "YYYY-MM-DD" },
      date_to: { type: "string", description: "YYYY-MM-DD" },
      limit: { type: "integer", default: 20, maximum: 104 },
    }, required: [] } } },

  { type: "function", function: {
    name: "get_standings", description: "Group stage standings table (P W D L GF GA GD Pts, position) for one group or all 12 groups A-L.",
    parameters: { type: "object", properties: {
      group: { type: "string", enum: ["A","B","C","D","E","F","G","H","I","J","K","L"], description: "Group letter; omit for all 12" },
    }, required: [] } } },

  { type: "function", function: {
    name: "get_bracket", description: "Knockout bracket. Returns the pairings, scores and winners for one round or the whole bracket.",
    parameters: { type: "object", properties: {
      round: { type: "string", enum: ["r32","r16","qf","sf","third_place","final"], description: "Round; omit for the full bracket" },
    }, required: [] } } },

  { type: "function", function: {
    name: "get_awards", description: "Final standings (champion, runner-up, third, fourth) and individual awards: Golden Ball, Golden Boot, Golden Glove, Best Young Player, Fair Play, plus overall tournament stats.",
    parameters: { type: "object", properties: {}, required: [] } } },

  { type: "function", function: {
    name: "get_team_info", description: "Profile of one team: FIFA ranking, confederation, group, group-stage record, and its full path through the tournament.",
    parameters: { type: "object", properties: {
      team: teamProp("Team name or 3-letter code, e.g. 'Spain', '西班牙', 'ESP'", true),
    }, required: ["team"] } } },

  { type: "function", function: {
    name: "get_venue_info", description: "Stadium information (name, city, country, capacity). Omit name to list all 16 venues.",
    parameters: { type: "object", properties: {
      name: teamProp("Venue or city name, e.g. 'Azteca' or 'Estadio Azteca'"),
    }, required: [] } } },

  { type: "function", function: {
    name: "get_top_scorers", description: "Top goalscorers ranking computed from every match. Own goals are excluded. Optionally restrict to one team.",
    parameters: { type: "object", properties: {
      limit: { type: "integer", default: 10, maximum: 50 },
      team: teamProp("Optional team filter"),
    }, required: [] } } },

  { type: "function", function: {
    name: "get_top_assists", description: "Top assists ranking. Only the official top 10 is available in the dataset.",
    parameters: { type: "object", properties: {
      limit: { type: "integer", default: 10, maximum: 10 },
    }, required: [] } } },

  { type: "function", function: {
    name: "tournament_goal_stats", description: "Aggregate scoring stats: total goals, goals per match, penalties, own goals, clean sheets, draws, biggest margin, and goals bucketed by 15-minute periods. Scope can be the whole tournament, the group stage, the knockout stage, one group or one round.",
    parameters: { type: "object", properties: {
      scope: { type: "string", enum: ["all","group","knockout"], default: "all" },
      group: { type: "string", enum: ["A","B","C","D","E","F","G","H","I","J","K","L"], description: "Restrict to a group" },
      round: { type: "string", enum: ["r32","r16","qf","sf","third_place","final"], description: "Restrict to a knockout round" },
    }, required: [] } } },

  { type: "function", function: {
    name: "biggest_wins", description: "Matches ranked by winning margin (largest first). Draws excluded.",
    parameters: { type: "object", properties: {
      limit: { type: "integer", default: 5, maximum: 20 },
      scope: { type: "string", enum: ["all","group","knockout"], default: "all" },
    }, required: [] } } },

  { type: "function", function: {
    name: "highest_scoring_matches", description: "Matches ranked by total goals in the game (highest first).",
    parameters: { type: "object", properties: {
      limit: { type: "integer", default: 5, maximum: 20 },
      scope: { type: "string", enum: ["all","group","knockout"], default: "all" },
    }, required: [] } } },

  { type: "function", function: {
    name: "compare_scorers", description: "Side-by-side comparison of 2 to 5 players' goal records: goals, penalties, open-play goals, the matches they scored in and the minutes.",
    parameters: { type: "object", properties: {
      players: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5, description: "Player names in English or Chinese, e.g. [\"Mbappé\",\"梅西\"]" },
    }, required: ["players"] } } },

  { type: "function", function: {
    name: "card_rankings_by_player", description: "Discipline ranking by individual. Only 'yellow' and 'red' card types exist in this dataset. Some entries are coaches, flagged with isStaff.",
    parameters: { type: "object", properties: {
      type: { type: "string", enum: ["all","yellow","red"], default: "all" },
      limit: { type: "integer", default: 10, maximum: 50 },
      team: teamProp("Optional team filter"),
      scope: { type: "string", enum: ["all","group","knockout"], default: "all" },
    }, required: [] } } },

  { type: "function", function: {
    name: "card_rankings_by_team", description: "Discipline ranking by team, including cards per match since knockout teams played more games.",
    parameters: { type: "object", properties: {
      type: { type: "string", enum: ["all","yellow","red"], default: "all" },
      limit: { type: "integer", default: 10, maximum: 48 },
      scope: { type: "string", enum: ["all","group","knockout"], default: "all" },
    }, required: [] } } },

  { type: "function", function: {
    name: "cards_in_match", description: "All yellow and red cards shown in one match, sorted chronologically.",
    parameters: { type: "object", properties: {
      match_id: { type: "integer", description: "Match id 1-104" },
      team_a: teamProp("Optional: team A"),
      team_b: teamProp("Optional: team B"),
    }, required: [] } } },

  { type: "function", function: {
    name: "head_to_head", description: "Every meeting between two teams in this tournament, with an aggregated win/draw/loss and goals summary. Returns played=0 if they never met.",
    parameters: { type: "object", properties: {
      team_a: teamProp("Team name or 3-letter code, e.g. 'Spain', '西班牙', 'ESP'", true),
      team_b: teamProp("Second team name or 3-letter code", true),
    }, required: ["team_a","team_b"] } } },

  { type: "function", function: {
    name: "team_knockout_record", description: "A team's knockout-stage run: how far it went, who eliminated it, round-by-round results including extra time and penalty shootouts.",
    parameters: { type: "object", properties: {
      team: teamProp("Team name or 3-letter code", true),
    }, required: ["team"] } } },

  { type: "function", function: {
    name: "compare_groups", description: "Compare group-stage groups on goals, goals per match, draws, cards and the strongest team. Omit groups to compare all 12.",
    parameters: { type: "object", properties: {
      groups: { type: "array", items: { type: "string", enum: ["A","B","C","D","E","F","G","H","I","J","K","L"] }, description: "Optional list of groups" },
    }, required: [] } } },

  { type: "function", function: {
    name: "team_goal_ranking", description: "Ranking of all 48 teams by total goals SCORED (for) or CONCEDED (against) across the WHOLE tournament (group stage + knockout). Use this for 'which team scored the most / fewest goals' or 'which team conceded the most / fewest goals' questions. Returns the top N by goals-for and by goals-against, plus the single leading team for each. Scope can be the whole tournament, group stage only, or knockout only.",
    parameters: { type: "object", properties: {
      limit: { type: "integer", default: 10, maximum: 48, description: "How many teams to return in each ranking" },
      scope: { type: "string", enum: ["all","group","knockout"], default: "all", description: "all = whole tournament, group = group stage only, knockout = knockout stage only" },
    }, required: [] } } },
];
