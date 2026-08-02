// ===== Schedule View =====
import { t } from '../i18n.js';
import { getMatches, getTeams, getVenues } from '../store.js';
import { L, formatDate, flagSVG, stageLabel, STAGES, translateStadium } from '../utils.js';

export default async function scheduleView() {
  const [matches, teams, venues] = await Promise.all([getMatches(), getTeams(), getVenues()]);
  const lang = window.__lang || 'zh';

  // Determine the effective category for each match:
  // group stage -> 'group', knockout -> the `round` field (e.g. 'round_of_32')
  function matchCategory(m) {
    if (m.stage === 'knockout') return m.round || 'knockout';
    return m.stage || 'group';
  }

  // Ordered categories used for filter tabs
  const categoryOrder = ['group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];

  // Collect categories that actually have matches, preserving the defined order
  const present = new Set(matches.map(matchCategory));
  const tabs = categoryOrder.filter(c => present.has(c));

  // Group matches by category
  const byCategory = {};
  matches.forEach(m => {
    const cat = matchCategory(m);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(m);
  });

  let html = `<div class="schedule-page">`;
  html += `<h1 class="page-title">${t('nav.schedule')}</h1>`;
  html += `<p class="page-subtitle">${t('schedule.matchCount', { count: matches.length })}</p>`;

  // Filter tabs
  html += `<div class="filter-tabs" id="scheduleFilter">`;
  html += `<button class="filter-tab active" data-filter="all">${t('schedule.all')}</button>`;
  for (const cat of tabs) {
    html += `<button class="filter-tab" data-filter="${cat}">${stageLabel(cat)}</button>`;
  }
  html += `</div>`;

  // Match sections
  for (const cat of tabs) {
    const catMatches = byCategory[cat];
    if (cat === 'group') {
      // Sub-group by group letter
      const byGroup = {};
      catMatches.forEach(m => {
        const g = m.group || '?';
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(m);
      });
      const groupKeys = Object.keys(byGroup).sort();
      for (const gk of groupKeys) {
        html += `<div class="match-section" data-stage="group" data-group="${gk}">`;
        html += `<h2 class="section-title">${t('common.group')} ${gk}</h2>`;
        html += `<div class="match-grid">`;
        for (const m of byGroup[gk]) {
          html += renderMatchCard(m, teams);
        }
        html += `</div></div>`;
      }
    } else {
      html += `<div class="match-section" data-stage="${cat}">`;
      html += `<h2 class="section-title">${stageLabel(cat)}</h2>`;
      html += `<div class="match-grid">`;
      for (const m of catMatches) {
        html += renderMatchCard(m, teams);
      }
      html += `</div></div>`;
    }
  }

  html += `</div>`;

  // Add filter logic (will be attached after render)
  setTimeout(() => {
    const filterContainer = document.getElementById('scheduleFilter');
    if (!filterContainer) return;
    filterContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;
      const filter = tab.dataset.filter;

      // Update active
      filterContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show/hide sections
      document.querySelectorAll('.match-section').forEach(sec => {
        if (filter === 'all') {
          sec.style.display = '';
        } else {
          sec.style.display = sec.dataset.stage === filter ? '' : 'none';
        }
      });
    });
  }, 50);

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
