// ===== Bracket View =====
import { t } from '../i18n.js';
import { getBracket, getTeams } from '../store.js';
import { L, flagSVG, stageLabel } from '../utils.js';

// Reorder match arrays so adjacent pairs feed into the next round.
// This mapping was derived by tracing which R32 winners appear in each R16 match,
// and so on through QF, SF, and Final.
const R32_ORDER = [73, 76, 75, 78, 84, 83, 82, 81, 74, 77, 79, 80, 87, 86, 85, 88];
const R16_ORDER = [89, 90, 93, 94, 91, 92, 95, 96];

function reorder(matches, order) {
  if (!Array.isArray(matches)) return [];
  return order.map(id => matches.find(m => m.id === id)).filter(Boolean);
}

// Build the set of match IDs on the champion's path through the bracket.
function championPath(bracket) {
  const path = new Set();
  if (!bracket.final || !bracket.final.winner) return path;
  const champ = bracket.final.winner;
  path.add(bracket.final.id);
  const rounds = [bracket.semifinals, bracket.quarterfinals, bracket.round_of_16, bracket.round_of_32];
  for (const r of rounds) {
    if (Array.isArray(r)) {
      for (const m of r) {
        if (m.winner === champ) path.add(m.id);
      }
    }
  }
  return path;
}

function renderMatch(bm, teams, isChampion, champPath) {
  const homeWon = bm.winner === bm.home;
  const awayWon = bm.winner === bm.away;
  const homeTeam = teams[bm.home];
  const awayTeam = teams[bm.away];
  const homeName = homeTeam ? L(homeTeam.name) : (bm.homeName || bm.home || 'TBD');
  const awayName = awayTeam ? L(awayTeam.name) : (bm.awayName || bm.away || 'TBD');
  const onPath = champPath.has(bm.id);
  const hasPen = !!bm.penaltyShootout;

  let html = `<div class="bracket-match ${isChampion ? 'winner-glow' : ''} ${onPath ? 'champion-path' : ''}" onclick="location.hash='#/match/${bm.id}'">`;
  html += `<div class="bracket-team ${homeWon ? 'won' : (awayWon ? 'lost' : '')}">
    <span class="team-info">${flagSVG(bm.home, 'sm')}<span class="bracket-team-name">${homeName}</span></span>
    <span class="score">${bm.homeScore ?? '-'}</span>
  </div>`;
  html += `<div class="bracket-team ${awayWon ? 'won' : (homeWon ? 'lost' : '')}">
    <span class="team-info">${flagSVG(bm.away, 'sm')}<span class="bracket-team-name">${awayName}</span></span>
    <span class="score">${bm.awayScore ?? '-'}</span>
  </div>`;

  if (hasPen) {
    const lang = window.__lang || 'zh';
    const penLabel = lang === 'zh' ? '点球' : 'Pens';
    html += `<div class="bracket-pen-info"><span class="pen-label">${penLabel}</span> <span class="pen-val">${bm.penaltyShootout.home}-${bm.penaltyShootout.away}</span></div>`;
  }

  if (isChampion) {
    const lang = window.__lang || 'zh';
    const champName = bm.winner === bm.home ? homeName : awayName;
    html += `<div class="bracket-champion">
      <div class="trophy">🏆</div>
      <div class="champ-team">${flagSVG(bm.winner, 'sm')}<span class="champ-name">${champName || bm.winner}</span></div>
      <div class="champ-label">${lang === 'zh' ? '冠军' : 'Champion'}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

export default async function bracketView() {
  const bracket = await getBracket();
  const teams = await getTeams();
  const lang = window.__lang || 'zh';

  let html = `<div class="bracket-page">`;
  html += `<h1 class="page-title">${t('nav.bracket')}</h1>`;
  html += `<p class="page-subtitle">${t('bracket.subtitle')}</p>`;

  if (!bracket || !Object.keys(bracket).length) {
    html += `<div class="loading"><p>${t('common.noData')}</p></div>`;
    html += `</div>`;
    return html;
  }

  const champPath = championPath(bracket);

  // Reorder matches for proper bracket tree structure.
  const r32 = reorder(bracket.round_of_32, R32_ORDER);
  const r16 = reorder(bracket.round_of_16, R16_ORDER);
  const qf = Array.isArray(bracket.quarterfinals) ? bracket.quarterfinals : [];
  const sf = Array.isArray(bracket.semifinals) ? bracket.semifinals : [];
  const final = bracket.final;
  const thirdPlace = bracket.third_place;

  // Round definitions (left to right).
  // Final round includes third-place match above the final for better visibility.
  const finalRoundData = [];
  if (thirdPlace) finalRoundData.push({ ...thirdPlace, isThirdPlace: true });
  if (final) finalRoundData.push({ ...final, isThirdPlace: false });

  const rounds = [
    { key: 'r32', label: stageLabel('round_of_32'), data: r32 },
    { key: 'r16', label: stageLabel('round_of_16'), data: r16 },
    { key: 'qf', label: stageLabel('quarterfinal'), data: qf },
    { key: 'sf', label: stageLabel('semifinal'), data: sf },
    { key: 'final', label: stageLabel('final'), data: finalRoundData },
  ];

  html += `<div class="bracket-scroll"><div class="bracket">`;

  for (let ri = 0; ri < rounds.length; ri++) {
    const r = rounds[ri];
    if (!r.data.length) continue;
    const isLast = ri === rounds.length - 1;
    const isFirst = ri === 0;

    html += `<div class="bracket-round" data-round="${r.key}" data-first="${isFirst}" data-last="${isLast}">`;
    html += `<div class="bracket-round-title">${r.label}</div>`;
    html += `<div class="bracket-matches">`;

    for (let mi = 0; mi < r.data.length; mi++) {
      const bm = r.data[mi];
      const isChampion = isLast && bm.winner && !bm.isThirdPlace;
      const isThird = bm.isThirdPlace;
      const position = mi % 2 === 0 ? 'top' : 'bottom';
      const onPath = champPath.has(bm.id);
      html += `<div class="bracket-slot slot-${position} ${onPath ? 'champion-path' : ''} ${isThird ? 'third-place-slot' : ''}">`;
      if (isThird) {
        html += `<div class="third-place-label">${stageLabel('third_place')}</div>`;
      }
      html += renderMatch(bm, teams, isChampion, champPath);
      html += `</div>`;
    }

    html += `</div>`; // .bracket-matches
    html += `</div>`; // .bracket-round
  }

  html += `</div></div>`; // .bracket .bracket-scroll

  html += `</div>`;
  return html;
}
