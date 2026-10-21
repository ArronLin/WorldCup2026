// ===== Data Store =====
import { matchCategory } from './features/follow-teams/matches.js';

const cache = new Map();

async function loadJSONResult(name) {
  if (!cache.has(name)) {
    const request = (async () => {
      let resp;
      try { resp = await fetch(`/data/${name}.json`); }
      catch { return { status: 'error', dataset: name, kind: 'network' }; }
      if (!resp.ok) return { status: 'error', dataset: name, kind: 'http' };
      try { return { status: 'ready', data: await resp.json() }; }
      catch { return { status: 'error', dataset: name, kind: 'parse' }; }
    })();
    cache.set(name, request);
  }
  return cache.get(name);
}

async function loadJSON(name) {
  const result = await loadJSONResult(name);
  return result.status === 'ready' ? result.data : name === 'matches' ? [] : {};
}

export async function getTournamentSnapshot({ retry = false } = {}) {
  if (retry) { cache.delete('teams'); cache.delete('matches'); }
  const [teamResult, matchResult] = await Promise.all([loadJSONResult('teams'), loadJSONResult('matches')]);
  if (teamResult.status === 'error') return teamResult;
  if (matchResult.status === 'error') return matchResult;
  const teams = teamResult.data;
  const matches = matchResult.data;
  if (!teams || typeof teams !== 'object' || Array.isArray(teams)
    || Object.entries(teams).some(([code, team]) => !/^[A-Z]{3}$/.test(code) || !team || team.code !== code)) {
    return { status: 'error', dataset: 'teams', kind: 'invalid-data' };
  }
  if (!Array.isArray(matches) || matches.some(m => !m || !Number.isInteger(m.id)
    || !Object.hasOwn(teams, m.home?.code) || !Object.hasOwn(teams, m.away?.code)
    || !matchCategory(m))) {
    return { status: 'error', dataset: 'matches', kind: 'invalid-data' };
  }
  return { status: 'ready', teams, matches };
}

export function clearDataCache() {
  cache.clear();
}

export async function getTeams() {
  return loadJSON('teams');
}

export async function getTeam(code) {
  const teams = await getTeams();
  return teams[code];
}

export async function getVenues() {
  return loadJSON('venues');
}

export async function getVenue(id) {
  const venues = await getVenues();
  return venues[id];
}

export async function getMatches() {
  return loadJSON('matches');
}

export async function getMatch(id) {
  const matches = await getMatches();
  return matches.find(m => m.id === Number(id));
}

export async function getMatchesByStage(stage) {
  const matches = await getMatches();
  return matches.filter(m => m.stage === stage || m.round === stage);
}

export async function getMatchesByGroup(group) {
  const matches = await getMatches();
  return matches.filter(m => m.group === group);
}

export async function getMatchesByTeam(teamCode) {
  const matches = await getMatches();
  return matches.filter(m => m.home.code === teamCode || m.away.code === teamCode);
}

export async function getStandings() {
  return loadJSON('standings');
}

export async function getGroupStandings(group) {
  const standings = await getStandings();
  return standings[group] || [];
}

export async function getBracket() {
  return loadJSON('bracket');
}

export async function getAwards() {
  return loadJSON('awards');
}

export async function getGroups() {
  return loadJSON('groups');
}

// 历届世界杯战绩快照（四强 × 1998–2022 共 7 届）。
// 视图不得绕过 store 直接 fetch（章程原则 VI）。失败时 loadJSON 降级为 {}，
// 因此消费方必须容忍缺少 matches/coverage 字段。
export async function getWorldCupHistory() {
  return loadJSON('wc-history');
}

// Get player name translations (en -> zh)
export async function getPlayerNames() {
  return loadJSON('player-names');
}

// Get team's top scorers from all matches
export async function getTeamTopScorers(teamCode) {
  const matches = await getMatches();
  const scorerMap = {};
  matches.forEach(m => {
    if (m.goals) {
      m.goals.forEach(g => {
        if (g.team === teamCode && !g.isOwnGoal) {
          const key = g.player;
          if (!scorerMap[key]) {
            scorerMap[key] = { player: g.player, team: g.team, goals: 0, penalties: 0 };
          }
          scorerMap[key].goals++;
          if (g.isPenalty) scorerMap[key].penalties++;
        }
      });
    }
  });
  return Object.values(scorerMap).sort((a, b) => b.goals - a.goals);
}

// Get tournament top scorers
export async function getTopScorers(limit) {
  const matches = await getMatches();
  const scorerMap = {};
  matches.forEach(m => {
    if (m.goals) {
      m.goals.forEach(g => {
        if (!g.isOwnGoal) {
          const key = g.player;
          if (!scorerMap[key]) {
            scorerMap[key] = { player: g.player, team: g.team, goals: 0, penalties: 0 };
          }
          scorerMap[key].goals++;
          if (g.isPenalty) scorerMap[key].penalties++;
        }
      });
    }
  });
  const arr = Object.values(scorerMap).sort((a, b) => b.goals - a.goals || a.penalties - b.penalties);
  return limit ? arr.slice(0, limit) : arr;
}

// Get tournament top assists
export async function getTopAssists(limit) {
  const awards = await getAwards();
  const arr = awards.top_assists || [];
  return limit ? arr.slice(0, limit) : arr;
}
