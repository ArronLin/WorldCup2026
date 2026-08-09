// ===== Awards View =====
import { t } from '../i18n.js';
import { getAwards, getTeams } from '../store.js';
import { L, flagSVG } from '../utils.js';

export default async function awardsView() {
  const [awards, teams] = await Promise.all([getAwards(), getTeams()]);
  const lang = window.__lang || 'zh';

  let html = `<div class="awards-page">`;
  html += `<h1 class="page-title">${t('nav.awards')}</h1>`;
  html += `<p class="page-subtitle">${t('awards.subtitle')}</p>`;

  // Champion banner
  if (awards.champion) {
    const champ = awards.champion;
    html += `<div class="champion-banner">
      <div class="champion-trophy">🏆</div>
      <div class="champion-title">${t('awards.champion')}</div>
      <div class="champion-name">${flagSVG(champ.code, 'lg')} ${L(champ.name)}</div>
      ${champ.title ? `<div class="champion-score">${L(champ.title)}</div>` : ''}
    </div>`;
  }

  // Runner-up, third place, fourth place
  const podium = [];
  if (awards.runner_up) podium.push({ data: awards.runner_up, label: t('awards.runnerUp'), medal: 'silver', emoji: '🥈' });
  if (awards.third_place) podium.push({ data: awards.third_place, label: t('awards.thirdPlace'), medal: 'bronze', emoji: '🥉' });
  if (awards.fourth_place) podium.push({ data: awards.fourth_place, label: t('awards.fourthPlace'), medal: 'silver', emoji: '4th' });

  if (podium.length) {
    html += `<div class="award-grid" style="margin-bottom:1.5rem">`;
    for (const p of podium) {
      html += `<div class="award-card" data-route="/team/${p.data.code}" role="link" tabindex="0" style="cursor:pointer">
        <div class="award-icon ${p.medal}">${p.emoji}</div>
        <div class="award-info">
          <div class="award-title">${p.label}</div>
          <div class="award-name">${flagSVG(p.data.code, 'sm')} ${L(p.data.name)}</div>
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  // Individual awards
  const individualAwards = [
    { key: 'golden_ball', label: t('awards.goldenBall'), emoji: '⚽', medal: 'gold' },
    { key: 'golden_boot', label: t('awards.goldenBoot'), emoji: '🥇', medal: 'gold' },
    { key: 'golden_glove', label: t('awards.goldenGlove'), emoji: '🧤', medal: 'gold' },
    { key: 'young_player', label: t('awards.bestYoungPlayer'), emoji: '🌟', medal: 'gold' },
    { key: 'fair_play', label: t('awards.fairPlay'), emoji: '🤝', medal: 'silver' },
  ];

  const hasIndividual = individualAwards.some(a => awards[a.key]);
  if (hasIndividual) {
    html += `<h2 class="section-title">${t('awards.individual')}</h2>`;
    html += `<div class="award-grid">`;
    for (const a of individualAwards) {
      const data = awards[a.key];
      if (!data) continue;
      // fair_play uses code/name; the others use player/team/teamName.
      const isFairPlay = a.key === 'fair_play';
      const teamCode = isFairPlay ? data.code : data.team;
      const teamName = isFairPlay ? data.name : data.teamName;
      const name = isFairPlay ? L(teamName) : (lang === 'zh' ? (data.playerZh || data.player) : data.player);
      const extra = data.goals != null ? ` · ${data.goals} ${t('common.goals')}` : '';

      html += `<div class="award-card" ${teamCode ? `data-route="/team/${teamCode}" role="link" tabindex="0" style="cursor:pointer"` : ''}>
        <div class="award-icon ${a.medal}">${a.emoji}</div>
        <div class="award-info">
          <div class="award-title">${a.label}</div>
          <div class="award-name">${name}${extra}</div>
          ${teamCode ? `<div class="award-team">${flagSVG(teamCode, 'sm')} ${L(teamName)}</div>` : ''}
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  // Tournament stats
  if (awards.tournament_stats) {
    const ts = awards.tournament_stats;
    html += `<h2 class="section-title" style="margin-top:2rem">${t('awards.tournamentStats')}</h2>`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--space-md);margin-bottom:var(--space-xl)">`;
    html += `<div class="stat-card"><div class="stat-value">${ts.matchesPlayed ?? 0}</div><div class="stat-label">${t('awards.matchesStat')}</div></div>`;
    html += `<div class="stat-card"><div class="stat-value">${ts.goalsScored ?? 0}</div><div class="stat-label">${t('awards.totalGoals')}</div></div>`;
    html += `<div class="stat-card"><div class="stat-value">${ts.goalsPerMatch ?? 0}</div><div class="stat-label">${t('awards.goalsPerMatch')}</div></div>`;
    html += `<div class="stat-card"><div class="stat-value">${(ts.attendance ?? 0).toLocaleString()}</div><div class="stat-label">${t('awards.totalAttendance')}</div></div>`;
    html += `<div class="stat-card"><div class="stat-value">${(ts.avgAttendance ?? 0).toLocaleString()}</div><div class="stat-label">${t('awards.avgAttendance')}</div></div>`;
    html += `</div>`;
  }

  // Top scorers table
  const topScorers = awards.top_scorers || [];
  if (topScorers.length) {
    html += `<h2 class="section-title">${t('awards.topScorers')}</h2>`;
    html += `<div class="table-wrap"><table class="standings-table"><thead><tr>
      <th>#</th>
      <th>${t('common.player')}</th>
      <th>${t('common.team')}</th>
      <th>${t('common.goals')}</th>
      <th>${t('common.pen')}</th>
    </tr></thead><tbody>`;
    topScorers.forEach((s, i) => {
      const team = teams[s.team];
      const teamLabel = team ? L(team.name) : s.team;
      html += `<tr data-route="/team/${s.team}" style="cursor:pointer">
        <td>${i + 1}</td>
        <td><div class="team-cell">${lang === 'zh' ? (s.playerZh || s.player) : s.player}</div></td>
        <td><div class="team-cell">${flagSVG(s.team, 'sm')} ${teamLabel}</div></td>
        <td class="pts">${s.goals}</td>
        <td>${s.penalties || 0}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Top assists table
  const topAssists = awards.top_assists || [];
  if (topAssists.length) {
    html += `<h2 class="section-title">${t('awards.topAssists')}</h2>`;
    html += `<div class="table-wrap"><table class="standings-table"><thead><tr>
      <th>#</th>
      <th>${t('common.player')}</th>
      <th>${t('common.team')}</th>
      <th>${t('common.assists')}</th>
    </tr></thead><tbody>`;
    topAssists.forEach((s, i) => {
      const team = teams[s.team];
      const teamLabel = team ? L(team.name) : s.team;
      html += `<tr data-route="/team/${s.team}" style="cursor:pointer">
        <td>${i + 1}</td>
        <td><div class="team-cell">${lang === 'zh' ? (s.playerZh || s.player) : s.player}</div></td>
        <td><div class="team-cell">${flagSVG(s.team, 'sm')} ${teamLabel}</div></td>
        <td class="pts">${s.assists}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  html += `</div>`;
  return html;
}
