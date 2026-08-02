// ===== Group Standings View =====
import { t } from '../i18n.js';
import { getStandings } from '../store.js';
import { L, flagSVG } from '../utils.js';

export default async function standingsView() {
  const standingsData = await getStandings();
  const lang = window.__lang || 'zh';

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  let html = `<div class="standings-page">`;
  html += `<h1 class="page-title">${t('nav.groups')}</h1>`;
  html += `<p class="page-subtitle">${t('groups.subtitle')}</p>`;

  html += `<div class="group-grid">`;

  for (const g of groups) {
    const groupData = standingsData[g];
    if (!groupData || !groupData.length) continue;

    html += `<div class="group-card">`;
    html += `<h3>${t('common.group')} ${g}</h3>`;
    html += `<div class="table-wrap"><table class="standings-table">`;
    html += `<thead><tr>
      <th>#</th>
      <th>${t('standings.team')}</th>
      <th>${t('standings.played')}</th>
      <th>${t('standings.win')}</th>
      <th>${t('standings.draw')}</th>
      <th>${t('standings.loss')}</th>
      <th>${t('standings.gf')}</th>
      <th>${t('standings.ga')}</th>
      <th>${t('standings.gd')}</th>
      <th>${t('standings.pts')}</th>
    </tr></thead><tbody>`;

    groupData.forEach((row) => {
      const pos = row.position ?? '';
      const qualClass = (row.position === 1 || row.position === 2) ? 'qual-line' : 'elim-line';
      const gdVal = row.goalDifference ?? 0;
      const gd = gdVal > 0 ? `+${gdVal}` : gdVal;
      html += `<tr class="${qualClass}" onclick="location.hash='#/team/${row.code}'" style="cursor:pointer">
        <td>${pos}</td>
        <td><div class="team-cell">${flagSVG(row.code, 'sm')} ${L(row.name)}</div></td>
        <td>${row.played ?? 0}</td>
        <td>${row.won ?? 0}</td>
        <td>${row.drawn ?? 0}</td>
        <td>${row.lost ?? 0}</td>
        <td>${row.goalsFor ?? 0}</td>
        <td>${row.goalsAgainst ?? 0}</td>
        <td>${gd}</td>
        <td class="pts">${row.points ?? 0}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    html += `</div>`;
  }

  html += `</div>`;
  html += `</div>`;
  return html;
}
