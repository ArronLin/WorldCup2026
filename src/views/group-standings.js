// ===== Group Standings View =====
import { t } from '../i18n.js';
import { getStandings } from '../store.js';
import { L, flagSVG } from '../utils.js';
import { SORT_METRICS, nextSortState, sortStandings } from '../standings-sort.js';

function sortHeader(metric, label) {
  return `<th><button type="button" class="standings-sort-button" data-sort-metric="${metric}">${t(label)}<span aria-hidden="true" class="standings-sort-arrow"></span></button></th>`;
}

function statCell(metric, value, className = '') {
  const valid = Number.isFinite(value);
  const formatted = valid && metric === 'goalDifference' && value > 0 ? `+${value}` : value;
  return `<td class="${className}" data-stat="${metric}" ${valid ? `data-value="${value}"` : `title="${t('common.noData')}"`}>${valid ? formatted : '—'}</td>`;
}

class StandingsGroup extends HTMLElement {
  #initialRows;
  #state = null;

  connectedCallback() {
    this.addEventListener('click', this.#sort);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#sort);
  }

  #sort = (event) => {
    const button = event.target.closest('button[data-sort-metric]');
    if (!button || !this.contains(button)) return;
    const metric = button.dataset.sortMetric;
    const next = nextSortState(this.#state, metric);
    if (!next) return;
    this.#state = next;
    const tbody = this.querySelector('tbody');
    this.#initialRows ??= Array.from(tbody.rows, node => {
      const record = { node };
      for (const key of SORT_METRICS) {
        const cell = node.querySelector(`[data-stat="${key}"]`);
        record[key] = cell.hasAttribute('data-value') ? Number(cell.dataset.value) : undefined;
      }
      return record;
    });
    for (const { node } of sortStandings(this.#initialRows, this.#state)) tbody.append(node);
    for (const control of this.querySelectorAll('button[data-sort-metric]')) {
      const header = control.closest('th');
      const arrow = control.querySelector('.standings-sort-arrow');
      if (control === button) {
        header.setAttribute('aria-sort', this.#state.direction);
        arrow.textContent = this.#state.direction === 'ascending' ? '↑' : '↓';
      } else {
        header.removeAttribute('aria-sort');
        arrow.textContent = '';
      }
    }
  };
}

if (!customElements.get('standings-group')) customElements.define('standings-group', StandingsGroup);

export default async function standingsView() {
  const standingsData = await getStandings();

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  let html = `<div class="standings-page">`;
  html += `<h1 class="page-title">${t('nav.groups')}</h1>`;
  html += `<p class="page-subtitle">${t('groups.subtitle')}</p>`;

  html += `<div class="group-grid">`;

  for (const g of groups) {
    const groupData = standingsData[g];
    if (!groupData || !groupData.length) continue;

    html += `<standings-group class="group-card">`;
    html += `<h3>${t('common.group')} ${g}</h3>`;
    html += `<div class="table-wrap"><table class="standings-table">`;
    html += `<thead><tr>
      <th>#</th>
      <th>${t('standings.team')}</th>
      <th>${t('standings.played')}</th>
      <th>${t('standings.win')}</th>
      <th>${t('standings.draw')}</th>
      <th>${t('standings.loss')}</th>
      ${sortHeader('goalsFor', 'standings.gf')}
      ${sortHeader('goalsAgainst', 'standings.ga')}
      ${sortHeader('goalDifference', 'standings.gd')}
      ${sortHeader('points', 'standings.pts')}
    </tr></thead><tbody>`;

    groupData.forEach((row) => {
      const pos = row.position ?? '';
      const qualClass = (row.position === 1 || row.position === 2) ? 'qual-line' : 'elim-line';
      html += `<tr class="${qualClass}" data-route="/team/${row.code}" style="cursor:pointer">
        <td>${pos}</td>
        <td><div class="team-cell">${flagSVG(row.code, 'sm')} ${L(row.name)}</div></td>
        <td>${row.played ?? 0}</td>
        <td>${row.won ?? 0}</td>
        <td>${row.drawn ?? 0}</td>
        <td>${row.lost ?? 0}</td>
        ${statCell('goalsFor', row.goalsFor)}
        ${statCell('goalsAgainst', row.goalsAgainst)}
        ${statCell('goalDifference', row.goalDifference)}
        ${statCell('points', row.points, 'pts')}
      </tr>`;
    });

    html += `</tbody></table></div>`;
    html += `</standings-group>`;
  }

  html += `</div>`;
  html += `</div>`;
  return html;
}
