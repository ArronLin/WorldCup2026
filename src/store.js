// ===== Data Store =====

const cache = new Map();

async function loadJSON(name) {
  if (!cache.has(name)) {
    const request = fetch(`/data/${name}.json`)
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      })
      .catch((error) => {
        console.warn(`Failed to load data/${name}.json:`, error);
        return name === 'matches' ? [] : {};
      });
    cache.set(name, request);
  }
  return cache.get(name);
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
