// ===== Teams List View =====
import { t } from '../i18n.js';
import { getTeams, getTournamentSnapshot } from '../store.js';
import { L, flagSVG } from '../utils.js';
import { followState } from '../features/follow-teams/state.js';

export default async function teamsView() {
  // Initialize follow state so we can show current follow status.
  const result = await getTournamentSnapshot();
  const teams = result.status === 'ready' ? result.teams : await getTeams();
  if (result.status === 'ready') followState.initialize(result.teams);
  const snapshot = followState.getSnapshot();
  const followed = new Set(snapshot.teamCodes);

  const teamList = Object.values(teams);

  // Group by group letter
  const byGroup = {};
  teamList.forEach(team => {
    const g = team.group || '?';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(team);
  });
  const groupKeys = Object.keys(byGroup).sort();

  let html = `<div class="teams-page">`;
  html += `<h1 class="page-title">${t('nav.teams')}</h1>`;
  html += `<p class="page-subtitle">${t('teams.subtitle')}</p>`;

  // Filter + batch-select toolbar
  html += `<div class="teams-filter-row">`;
  html += `<details class="teams-filter"><summary>${t('teams.filter')}</summary>
    <div class="teams-filter-options" role="group" aria-label="${t('teams.filter')}">
    <label><input type="checkbox" data-group-choice value="" checked> ${t('teams.all')}</label>
    ${groupKeys.map(g => `<label><input type="checkbox" data-group-choice value="${g}"> ${t('common.group')} ${g}</label>`).join('')}
    </div></details>`;
  html += `<button type="button" data-clear-team-groups hidden>${t('teams.clearFilters')}</button>`;
  html += `<button type="button" class="filter-btn teams-batch-toggle" data-follow-action="batch-mode-toggle" aria-pressed="false" data-follow-focus="teams-batch-toggle">${t('teams.batchSelect')}</button>`;
  html += `</div>`;

  // Batch action bar (hidden by default, shown when ≥1 checkbox checked)
  html += `<div class="teams-batch-bar" data-batch-bar hidden>
    <span class="teams-batch-info">${t('teams.selected')} <strong data-batch-count>0</strong></span>
    <button type="button" class="filter-btn" data-follow-action="batch-follow" data-follow-focus="teams-batch-toggle">${t('follow.follow')}</button>
    <button type="button" class="filter-btn" data-follow-action="batch-unfollow" data-follow-focus="teams-batch-toggle">${t('follow.unfollow')}</button>
    <button type="button" class="filter-btn" data-follow-action="batch-clear" data-follow-focus="teams-batch-toggle">${t('teams.clearSelection')}</button>
  </div>`;

  html += `<div class="group-grid">`;
  for (const g of groupKeys) {
    html += `<div class="group-card" data-team-group="${g}">`;
    html += `<h3>${t('common.group')} ${g}</h3>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px">`;
    for (const team of byGroup[g]) {
      const conf = team.confederation || '';
      const rank = team.ranking != null ? `#${team.ranking}` : '';
      const sub = [conf, rank].filter(Boolean).join(' · ');
      const isFollowed = followed.has(team.code);
      html += `<div class="team-search-result teams-batch-item" data-team-code="${team.code}" data-route="/team/${team.code}" role="link" tabindex="0" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;background:var(--bg-elevated);transition:all 0.25s" aria-label="${L(team.name)}">
        <input type="checkbox" class="teams-batch-cb" data-team-select value="${team.code}" aria-label="${L(team.name)}" style="display:none;width:18px;height:18px;flex-shrink:0;accent-color:var(--accent)" ${isFollowed ? 'data-followed' : ''}>
        ${flagSVG(team.code, 'sm')}
        <span style="font-weight:600;font-size:0.88rem">${L(team.name)}</span>
        ${sub ? `<span style="margin-left:auto;font-size:0.72rem;color:var(--text-muted)">${sub}</span>` : ''}
        ${isFollowed ? `<span class="teams-follow-dot" title="${t('follow.following')}" aria-label="${t('follow.following')}">★</span>` : ''}
      </div>`;
    }
    html += `</div></div>`;
  }
  html += `</div></div>`;
  return html;
}
