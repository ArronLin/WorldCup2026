// ===== Teams List View =====
import { t } from '../i18n.js';
import { getTeams } from '../store.js';
import { L, flagSVG } from '../utils.js';

export default async function teamsView() {
  const teams = await getTeams();
  const lang = window.__lang || 'zh';
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

  html += `<div class="group-grid">`;
  for (const g of groupKeys) {
    html += `<div class="group-card">`;
    html += `<h3>${t('common.group')} ${g}</h3>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px">`;
    for (const team of byGroup[g]) {
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
