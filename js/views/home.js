// ===== Home View =====
import { t } from '../i18n.js';
import { getMatches, getTeams, getVenues, getAwards, getTopAssists } from '../store.js';
import { L, formatDate, flagSVG, stageLabel, STAGES, translateStadium } from '../utils.js';

export default async function homeView() {
  const [matches, teams, venues, awards, topAssists] = await Promise.all([
    getMatches(), getTeams(), getVenues(), getAwards(), getTopAssists(5)
  ]);
  const topScorers = (awards.top_scorers || []).slice(0, 5);

  const teamCount = Object.keys(teams).length;
  const venueCount = Object.keys(venues).length;
  const matchCount = matches.length;
  const champion = awards.champion;
  const championTeam = champion ? teams[champion.code] : null;

  const lang = window.__lang || 'zh';

  let html = `<div class="home-page">`;

  // Hero
  html += `
    <div class="hero-section">
      <h1 class="hero-title">${t('home.title')}</h1>
      <p class="hero-subtitle">${t('home.subtitle')}</p>
      <div class="hero-stats">
        <div class="hero-stat"><div class="num">${matchCount}</div><div class="label">${t('home.matches')}</div></div>
        <div class="hero-stat"><div class="num">${teamCount}</div><div class="label">${t('home.teams')}</div></div>
        <div class="hero-stat"><div class="num">${venueCount}</div><div class="label">${t('home.venues')}</div></div>
        ${championTeam ? `<div class="hero-stat"><div class="num" style="color:var(--gold)">${L(championTeam.name)}</div><div class="label">${t('home.champion')}</div></div>` : ''}
      </div>
    </div>`;

  // Champion banner
  if (championTeam) {
    const runnerUpTeam = awards.runner_up ? teams[awards.runner_up.code] : null;
    html += `
    <div class="champion-banner">
      <div class="champion-trophy">${flagSVG(championTeam.code, 'lg')}</div>
      <div class="champion-title">${t('awards.champion')}</div>
      <div class="champion-name">${L(championTeam.name)}</div>
      ${champion.title ? `<div class="champion-subtitle">${L(champion.title)}</div>` : ''}
      ${runnerUpTeam ? `<div class="champion-runnerup">${t('awards.runnerUp')}：${flagSVG(runnerUpTeam.code, 'sm')} ${L(runnerUpTeam.name)}</div>` : ''}
    </div>`;
  }

  // Quick navigation
  html += `
    <div class="quick-nav">
      <a href="#/schedule" class="quick-nav-card">
        <div class="icon">📅</div>
        <div class="title">${t('home.schedule')}</div>
        <div class="desc">${t('home.scheduleDesc')}</div>
      </a>
      <a href="#/groups" class="quick-nav-card">
        <div class="icon">📊</div>
        <div class="title">${t('home.standings')}</div>
        <div class="desc">${t('home.standingsDesc')}</div>
      </a>
      <a href="#/bracket" class="quick-nav-card">
        <div class="icon">🏆</div>
        <div class="title">${t('home.bracket')}</div>
        <div class="desc">${t('home.bracketDesc')}</div>
      </a>
      <a href="#/awards" class="quick-nav-card">
        <div class="icon">🥇</div>
        <div class="title">${t('home.awards')}</div>
        <div class="desc">${t('home.awardsDesc')}</div>
      </a>
    </div>`;

  // Recent results (last 6 matches) — all matches are finished
  const finished = matches.slice(-6).reverse();
  if (finished.length) {
    html += `<h2 class="section-title">${t('home.recentResults')}</h2>`;
    html += `<div class="match-grid">`;
    for (const m of finished) {
      html += renderMatchCard(m, teams);
    }
    html += `</div>`;
  }

  // Top scorers
  if (topScorers.length) {
    html += `<h2 class="section-title" style="margin-top:2rem">${t('awards.topScorers')}</h2>`;
    html += `<div class="table-wrap"><table class="standings-table"><thead><tr>
      <th>#</th><th>${t('common.player')}</th><th>${t('common.team')}</th><th>${t('common.goals')}</th>
    </tr></thead><tbody>`;
    topScorers.forEach((s, i) => {
      const team = teams[s.team];
      html += `<tr>
        <td>${i + 1}</td>
        <td><div class="team-cell">${lang === 'zh' ? (s.playerZh || s.player) : s.player}</div></td>
        <td><div class="team-cell">${flagSVG(s.team, 'sm')} ${team ? L(team.name) : s.team}</div></td>
        <td class="pts">${s.goals}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Top assists
  if (topAssists.length) {
    html += `<h2 class="section-title">${t('awards.topAssists')}</h2>`;
    html += `<div class="table-wrap"><table class="standings-table"><thead><tr>
      <th>#</th><th>${t('common.player')}</th><th>${t('common.team')}</th><th>${t('common.assists')}</th>
    </tr></thead><tbody>`;
    topAssists.forEach((s, i) => {
      const team = teams[s.team];
      html += `<tr>
        <td>${i + 1}</td>
        <td><div class="team-cell">${lang === 'zh' ? (s.playerZh || s.player) : s.player}</div></td>
        <td><div class="team-cell">${flagSVG(s.team, 'sm')} ${team ? L(team.name) : s.team}</div></td>
        <td class="pts">${s.assists}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  html += `</div>`;
  return html;
}

function renderMatchCard(m, teams) {
  const ht = teams[m.home.code] || { name: m.home.code, code: m.home.code };
  const at = teams[m.away.code] || { name: m.away.code, code: m.away.code };
  const penScore = m.penaltyShootout
    ? `<div class="match-pen-score"><span class="pen-label">${t('match.penalties')}</span> <span class="pen-val">${m.penaltyShootout.home}-${m.penaltyShootout.away}</span></div>`
    : '';
  const score = `<span class="score-num">${m.homeScore}</span><span class="sep">-</span><span class="score-num">${m.awayScore}</span>`;
  const badges = [];
  if (m.extraTime) badges.push(`<span class="badge badge-aet">${t('match.extraTime')}</span>`);
  if (m.penaltyShootout) badges.push(`<span class="badge badge-pen">${t('match.penalties')}</span>`);

  return `
    <div class="match-card" onclick="location.hash='#/match/${m.id}'">
      <div class="match-card-header">
        <span class="match-card-date">${formatDate(m.date)}</span>
        <span class="match-card-stage">${stageLabel(m)}</span>
      </div>
      <div class="match-card-body">
        <div class="match-team home">
          <span class="match-team-name">${L(ht.name)}</span>
          ${flagSVG(ht.code || m.home.code)}
        </div>
        <div class="match-score">${score}${penScore}</div>
        <div class="match-team away">
          ${flagSVG(at.code || m.away.code)}
          <span class="match-team-name">${L(at.name)}</span>
        </div>
      </div>
      ${badges.length ? `<div style="margin-top:8px;text-align:center">${badges.join('')}</div>` : ''}
      <div class="match-card-footer">
        <span class="venue">${translateStadium(m.stadium) || ''}</span>
        <span>${m.id}</span>
      </div>
    </div>`;
}
