// ===== Match Detail View =====
import { t } from '../i18n.js';
import { getMatch, getTeams } from '../store.js';
import { L, formatDateFull, flagSVG, stageLabel, sortEvents, icon, translatePlayer, translateStadium } from '../utils.js';

export default async function matchDetailView(matchId) {
  const match = await getMatch(matchId);
  if (!match) {
    const lang = window.__lang || 'zh';
    return `<div class="loading"><p>${lang === 'zh' ? '比赛未找到' : 'Match not found'}</p><a href="#/schedule" class="back-link">${t('common.back')}</a></div>`;
  }

  const teams = await getTeams();
  const homeCode = match.home.code;
  const awayCode = match.away.code;
  const ht = teams[homeCode] || { name: { en: match.home.name, zh: match.home.nameZh }, code: homeCode };
  const at = teams[awayCode] || { name: { en: match.away.name, zh: match.away.nameZh }, code: awayCode };
  const lang = window.__lang || 'zh';

  let html = `<div class="match-detail-page">`;

  // Back link
  html += `<a href="#/schedule" class="back-link">${icon('back')} ${t('common.back')}</a>`;

  // Hero section
  const badges = [];
  if (match.extraTime) badges.push(`<span class="badge badge-aet">${t('match.extraTime')}</span>`);
  if (match.penaltyShootout) badges.push(`<span class="badge badge-pen">${t('match.penalties')}</span>`);

  const penScore = match.penaltyShootout
    ? `<span style="font-size:1.2rem;color:var(--text-muted)">(${match.penaltyShootout.home ?? '-'}-${match.penaltyShootout.away ?? '-'})</span>`
    : '';

  html += `
    <div class="match-detail-hero">
      <div class="match-detail-stage">
        <span class="badge badge-stage">${stageLabel(match)}</span>
        ${badges.join('')}
      </div>
      <div class="match-detail-teams">
        <div class="match-detail-team">
          ${flagSVG(homeCode, 'lg')}
          <span class="team-code">${homeCode}</span>
          <span class="team-full">${L(ht.name)}</span>
        </div>
        <div class="match-detail-score">
          <span class="score-num">${match.homeScore ?? '-'}</span>
          <span class="sep">-</span>
          <span class="score-num">${match.awayScore ?? '-'}</span>
          ${penScore}
        </div>
        <div class="match-detail-team">
          ${flagSVG(awayCode, 'lg')}
          <span class="team-code">${awayCode}</span>
          <span class="team-full">${L(at.name)}</span>
        </div>
      </div>
      <div class="match-detail-meta">
        <span>${icon('calendar')} ${formatDateFull(match.date)}</span>
        ${match.time ? `<span>${icon('clock')} ${match.time}</span>` : ''}
        ${match.stadium ? `<span>${icon('location')} ${translateStadium(match.stadium)}</span>` : ''}
        ${match.attendance ? `<span>${t('match.attendance')}: ${match.attendance}</span>` : ''}
        ${match.referee ? `<span>${icon('whistle')} ${match.referee}</span>` : ''}
      </div>
    </div>`;

  // Timeline
  const events = [];
  if (match.goals) {
    match.goals.forEach(g => {
      events.push({
        minute: g.minute,
        type: 'goal',
        team: g.team,
        player: g.player,
        isPenalty: g.isPenalty,
        isOwnGoal: g.isOwnGoal,
      });
    });
  }
  if (match.cards) {
    match.cards.forEach(c => {
      events.push({
        minute: c.minute,
        type: c.type,
        player: c.player,
        team: c.team,
      });
    });
  }

  if (events.length) {
    const sorted = sortEvents(events);
    html += `<h2 class="section-title">${t('match.timeline')}</h2>`;
    html += `<div class="timeline">`;

    for (const ev of sorted) {
      let iconHtml = '';
      let iconClass = '';
      let desc = '';
      let sideHtml = '';

      if (ev.type === 'goal') {
        iconHtml = icon('goal');
        iconClass = 'goal';
        let goalType = '';
        if (ev.isPenalty) goalType = ` (${t('goal.penalty')})`;
        if (ev.isOwnGoal) goalType = ` (${t('goal.ownGoal')})`;
        const team = teams[ev.team];
        const teamName = team ? L(team.name) : ev.team;
        const isHome = ev.team === homeCode;
        desc = `<span class="player">${translatePlayer(ev.player)}</span>${goalType} <span class="team-tag">${teamName}</span>`;
        sideHtml = `<span class="timeline-side">${isHome ? (lang === 'zh' ? '主' : 'HOME') : (lang === 'zh' ? '客' : 'AWAY')}</span>`;
      } else if (ev.type === 'yellow') {
        iconHtml = icon('yellowCard');
        iconClass = 'yellow-card';
        const playerName = ev.player ? translatePlayer(ev.player) : (lang === 'zh' ? '未知球员' : 'Unknown Player');
        const team = ev.team ? (teams[ev.team] || { name: { en: ev.team, zh: ev.team } }) : null;
        const teamName = team ? L(team.name) : '';
        const isHome = ev.team === homeCode;
        desc = `<span class="player">${playerName}</span> <span class="team-tag">${t('card.yellow')}${teamName ? ' · ' + teamName : ''}</span>`;
        if (ev.team) sideHtml = `<span class="timeline-side">${isHome ? (lang === 'zh' ? '主' : 'HOME') : (lang === 'zh' ? '客' : 'AWAY')}</span>`;
      } else if (ev.type === 'second_yellow') {
        iconHtml = icon('yellowCard') + icon('redCard');
        iconClass = 'yellow-card';
        const playerName = ev.player ? translatePlayer(ev.player) : (lang === 'zh' ? '未知球员' : 'Unknown Player');
        const team = ev.team ? (teams[ev.team] || { name: { en: ev.team, zh: ev.team } }) : null;
        const teamName = team ? L(team.name) : '';
        const isHome = ev.team === homeCode;
        desc = `<span class="player">${playerName}</span> <span class="team-tag">${t('card.secondYellow')}${teamName ? ' · ' + teamName : ''}</span>`;
        if (ev.team) sideHtml = `<span class="timeline-side">${isHome ? (lang === 'zh' ? '主' : 'HOME') : (lang === 'zh' ? '客' : 'AWAY')}</span>`;
      } else if (ev.type === 'red') {
        iconHtml = icon('redCard');
        iconClass = 'red-card';
        const playerName = ev.player ? translatePlayer(ev.player) : (lang === 'zh' ? '未知球员' : 'Unknown Player');
        const team = ev.team ? (teams[ev.team] || { name: { en: ev.team, zh: ev.team } }) : null;
        const teamName = team ? L(team.name) : '';
        const isHome = ev.team === homeCode;
        desc = `<span class="player">${playerName}</span> <span class="team-tag">${t('card.red')}${teamName ? ' · ' + teamName : ''}</span>`;
        if (ev.team) sideHtml = `<span class="timeline-side">${isHome ? (lang === 'zh' ? '主' : 'HOME') : (lang === 'zh' ? '客' : 'AWAY')}</span>`;
      }

      html += `
        <div class="timeline-event">
          <span class="timeline-minute">${ev.minute}'</span>
          <span class="timeline-icon ${iconClass}">${iconHtml}</span>
          <span class="timeline-desc">${desc}</span>
          ${sideHtml}
        </div>`;
    }

    html += `</div>`;
  } else {
    html += `<div class="timeline" style="text-align:center;padding:2rem;color:var(--text-muted)">${t('match.noData')}</div>`;
  }

  html += `</div>`;
  return html;
}
