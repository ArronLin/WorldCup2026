// ===== Team Detail View =====
import { t } from '../i18n.js';
import { getTournamentSnapshot, getTeamTopScorers } from '../store.js';
import { followState } from '../features/follow-teams/state.js';
import { consumeRetry } from '../features/follow-teams/controller.js';
import { renderFollowNotice, renderDataError } from '../features/follow-teams/view.js';
import { L, formatDate, flagSVG, stageLabel, icon, translatePlayer, translateStadium } from '../utils.js';

export default async function teamDetailView(teamCode) {
  const result = await getTournamentSnapshot({ retry: consumeRetry() });
  if (result.status !== 'ready') return renderDataError(followState.getSnapshot());
  followState.initialize(result.teams);
  const team = /^[A-Z]{3}$/.test(teamCode) ? result.teams[teamCode] : null;

  if (!team) {
    return `<div class="loading"><p>${t('follow.teamNotFound')}</p><a href="#/teams" class="back-link">${t('common.back')}</a></div>`;
  }

  const allTeams = result.teams;
  const matches = result.matches.filter(m => m.home.code === team.code || m.away.code === team.code);
  const topScorers = await getTeamTopScorers(team.code);
  const snapshot = followState.getSnapshot();
  const followed = snapshot.teamCodes.includes(team.code);
  const lang = window.__lang || 'zh';

  // Sort matches by date
  matches.sort((a, b) => a.date.localeCompare(b.date));

  const stats = team.stats || {};

  let html = `<div class="team-detail-page">`;
  html += `<a href="#/teams" class="back-link">${icon('back')} ${t('common.back')}</a>`;

  // Header
  html += `<div class="team-header">
    ${flagSVG(team.code, 'lg')}
    <div class="team-header-info">
      <h2>${L(team.name)}</h2>
      <p>${team.confederation || ''} · ${t('common.group')} ${team.group || ''}${team.ranking != null ? ' · ' + (lang === 'zh' ? '排名' : 'Ranking') + ' #' + team.ranking : ''}</p>
    </div>
  </div>`;

  html += '<div class="follow-controls"><button type="button" class="filter-btn" data-follow-action="toggle" data-team="' + team.code + '" data-follow-focus="follow-team" aria-pressed="' + followed + '">' + t(followed ? 'follow.unfollow' : 'follow.follow') + '</button></div>';
  html += renderFollowNotice(snapshot);
  html += '<p class="follow-demo">' + t('follow.demo') + '</p>';

  // Stats table
  html += `<h2 class="section-title">${t('team.stats')}</h2>`;
  const gdVal = stats.goalDifference ?? 0;
  html += `<div class="table-wrap"><table class="standings-table"><thead><tr>
    <th>${t('standings.played')}</th>
    <th>${t('standings.win')}</th>
    <th>${t('standings.draw')}</th>
    <th>${t('standings.loss')}</th>
    <th>${t('standings.gf')}</th>
    <th>${t('standings.ga')}</th>
    <th>${t('standings.gd')}</th>
    <th>${t('standings.pts')}</th>
  </tr></thead><tbody><tr>
    <td>${stats.played ?? 0}</td>
    <td style="color:var(--win)">${stats.won ?? 0}</td>
    <td style="color:var(--draw)">${stats.drawn ?? 0}</td>
    <td style="color:var(--loss)">${stats.lost ?? 0}</td>
    <td>${stats.goalsFor ?? 0}</td>
    <td>${stats.goalsAgainst ?? 0}</td>
    <td>${gdVal > 0 ? '+' : ''}${gdVal}</td>
    <td class="pts">${stats.points ?? 0}</td>
  </tr></tbody></table></div>`;

  // Top scorers
  if (topScorers.length) {
    html += `<h2 class="section-title">${t('team.topScorers')}</h2>`;
    html += `<div class="top-scorers">`;
    topScorers.forEach((s, i) => {
      html += `<div class="scorer-row">
        <span><strong>${i + 1}.</strong> ${translatePlayer(s.player)} ${s.penalties > 0 ? `<span style="color:var(--text-muted);font-size:0.78rem">(${s.penalties} ${t('team.pen')})</span>` : ''}</span>
        <span class="pts" style="color:var(--accent);font-weight:800">${s.goals}</span>
      </div>`;
    });
    html += `</div>`;
  }

  // Matches
  html += `<h2 class="section-title">${t('team.matches')}</h2>`;
  html += `<div class="match-grid">`;
  for (const m of matches) {
    const isHome = m.home.code === team.code;
    const oppCode = isHome ? m.away.code : m.home.code;
    const oppData = isHome ? m.away : m.home;
    // Prefer the {en,zh} name from teams.json; fall back to the match's name/nameZh.
    const opp = allTeams[oppCode] || { name: { en: oppData.name, zh: oppData.nameZh || oppData.name }, code: oppCode };
    const myScore = isHome ? m.homeScore : m.awayScore;
    const oppScore = isHome ? m.awayScore : m.homeScore;
    // Score display: left score = left team, right score = right team
    const leftScore = isHome ? myScore : oppScore;
    const rightScore = isHome ? oppScore : myScore;
    const score = leftScore != null && rightScore != null
      ? `<span class="score-num">${leftScore}</span><span class="sep">-</span><span class="score-num">${rightScore}</span>`
      : `<span class="vs">${t('common.vs')}</span>`;
    const resultColor = (myScore != null && oppScore != null)
      ? (myScore > oppScore ? 'var(--win)' : myScore < oppScore ? 'var(--loss)' : 'var(--draw)')
      : '';

    html += `<div class="match-card" data-route="/match/${m.id}" role="link" tabindex="0">
      <div class="match-card-header">
        <span class="match-card-date">${formatDate(m.date)}</span>
        <span class="match-card-stage">${stageLabel(m)}</span>
      </div>
      <div class="match-card-body">
        <div class="match-team home">
          <span class="match-team-name">${isHome ? L(team.name) : L(opp.name)}</span>
          ${flagSVG(isHome ? team.code : oppCode)}
        </div>
        <div class="match-score" style="${resultColor ? `color:${resultColor}` : ''}">${score}</div>
        <div class="match-team away">
          ${flagSVG(isHome ? oppCode : team.code)}
          <span class="match-team-name">${isHome ? L(opp.name) : L(team.name)}</span>
        </div>
      </div>
      <div class="match-card-footer">
        <span class="venue">${translateStadium(m.stadium) || ''}</span>
        <span>${isHome ? t('team.home') : t('team.away')}</span>
      </div>
    </div>`;
  }
  html += `</div>`;

  html += `</div>`;
  return html;
}
