// ===== Schedule View =====
import { t } from '../i18n.js';
import { getTournamentSnapshot } from '../store.js';
import { L, formatDate, flagSVG, stageLabel, translateStadium } from '../utils.js';
import { followState } from '../features/follow-teams/state.js';
import { matchCategory, stageOrder, selectMatches } from '../features/follow-teams/matches.js';
import { consumeRetry } from '../features/follow-teams/controller.js';
import { renderFollowNotice, renderDataError } from '../features/follow-teams/view.js';

export default async function scheduleView() {
  const result = await getTournamentSnapshot({ retry: consumeRetry() });
  if (result.status !== 'ready') return renderDataError(followState.getSnapshot());
  followState.initialize(result.teams);
  const snapshot = followState.getSnapshot();
  const matches = selectMatches(result.matches, snapshot);
  const teams = result.teams;
  const present = new Set(result.matches.map(matchCategory));
  const tabs = stageOrder.filter(c => present.has(c));
  let html = '<div class="schedule-page"><h1 class="page-title">' + t('nav.schedule') + '</h1>';
  html += '<p class="page-subtitle" data-follow-count role="status">' + t('follow.count', { count: matches.length }) + '</p>';
  html += '<div class="follow-controls"><label class="follow-switch"><input type="checkbox" data-follow-action="filter" data-follow-focus="follow-only" ' + (snapshot.followOnly ? 'checked' : '') + '> ' + t('follow.only') + '</label></div>';
  html += renderFollowNotice(snapshot);
  html += '<p class="follow-demo">' + t('follow.demo') + '</p>';
  html += '<div class="filter-tabs" id="scheduleFilter">';
  for (const cat of ['all', ...tabs]) {
    const active = snapshot.stage === cat;
    html += '<button type="button" class="filter-tab ' + (active ? 'active' : '') + '" aria-pressed="' + active + '" data-follow-action="stage" data-filter="' + cat + '" data-follow-focus="follow-stage-' + cat + '">' + (cat === 'all' ? t('schedule.all') : stageLabel(cat)) + '</button>';
  }
  html += '</div>';
  if (!matches.length) {
    html += '<div class="follow-empty"><p>' + t(snapshot.followOnly && !snapshot.teamCodes.length ? 'follow.noTeams' : 'follow.noMatches') + '</p><a href="#/teams" class="back-link">' + t('follow.chooseTeams') + '</a></div>';
  }
  for (const cat of tabs) {
    const catMatches = matches.filter(m => matchCategory(m) === cat);
    if (cat === 'group') {
      const groups = [...new Set(catMatches.map(m => m.group || '?'))].sort();
      for (const group of groups) {
        html += '<div class="match-section" data-stage="group" data-group="' + group + '"><h2 class="section-title">' + t('common.group') + ' ' + group + '</h2><div class="match-grid">';
        for (const m of catMatches.filter(m => (m.group || '?') === group)) html += renderMatchCard(m, teams);
        html += '</div></div>';
      }
    } else if (catMatches.length) {
      html += '<div class="match-section" data-stage="' + cat + '"><h2 class="section-title">' + stageLabel(cat) + '</h2><div class="match-grid">';
      for (const m of catMatches) html += renderMatchCard(m, teams);
      html += '</div></div>';
    }
  }
  return html + '</div>';
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
    <div class="match-card" data-route="/match/${m.id}" role="link" tabindex="0">
      <div class="match-card-header">
        <span class="match-card-date">${formatDate(m.date)} ${m.time || ''}</span>
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
