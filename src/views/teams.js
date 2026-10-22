// ===== Teams List View =====
import { t } from '../i18n.js';
import { getTeams } from '../store.js';
import { L, flagSVG } from '../utils.js';
import { buildTeamGroups, groupFilterState, isGroupVisible } from '../features/team-group-filter/state.js';

export default async function teamsView() {
  const teams = await getTeams();
  const groups = buildTeamGroups(teams);
  groupFilterState.syncGroups(groups.map(group => group.key));
  const { availableGroups, selectedGroups } = groupFilterState.getSnapshot();

  let html = `<div class="teams-page">`;
  html += `<h1 class="page-title">${t('nav.teams')}</h1>`;
  html += `<p class="page-subtitle">${t('teams.subtitle')}</p>`;
  if (!groups.length) return html + `<p role="status">${t('teams.filter.unavailable')}</p></div>`;

  html += `<fieldset class="team-group-filter"><legend>${t('teams.filter.legend')}</legend><div class="team-group-options">`;
  for (const group of availableGroups) {
    html += `<label class="team-group-option"><input type="checkbox" data-team-group-action="select" data-team-group="${group}"${selectedGroups.includes(group) ? ' checked' : ''}> ${t('common.group')} ${group}</label>`;
  }
  html += `<button type="button" class="filter-btn" data-team-group-action="all">${t('teams.filter.all')}</button></div></fieldset>`;
  html += `<p class="team-group-summary" data-team-group-summary role="status">${t(selectedGroups.length ? 'teams.filter.showingSelected' : 'teams.filter.showingAll')}</p>`;

  html += `<div class="group-grid">`;
  for (const group of groups) {
    html += `<div class="group-card" data-team-group="${group.key}"${isGroupVisible(group.key, selectedGroups) ? '' : ' hidden'}>`;
    html += `<h3>${group.key ? t('common.group') + ' ' + group.key : t('teams.filter.unknownGroup')}</h3>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px">`;
    for (const team of group.teams) {
      const conf = team.confederation || '';
      const rank = team.ranking != null ? `#${team.ranking}` : '';
      const sub = [conf, rank].filter(Boolean).join(' · ');
      html += `<div class="team-search-result" data-route="/team/${team.code}" role="link" tabindex="0" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;background:var(--bg-elevated);transition:all 0.25s">
        ${flagSVG(team.code, 'sm')}
        <span style="font-weight:600;font-size:0.88rem">${L(team.name)}</span>
        ${sub ? `<span style="margin-left:auto;font-size:0.72rem;color:var(--text-muted)">${sub}</span>` : ''}
      </div>`;
    }
    html += `</div></div>`;
  }
  html += `</div></div>`;
  return html;
}
