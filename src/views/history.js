// ===== World Cup History View =====
// 页面状态完全由 URL 查询串承载，因此语言切换触发的全量重渲染不会丢失已选球队
// （FR-007 / SC-004），无需任何额外的状态持久化。
import { t } from '../i18n.js';
import { getTeams, getWorldCupHistory } from '../store.js';
import { L, flagSVG, stageLabel } from '../utils.js';
import {
  COVERAGE, groupByEdition, listCoverage, normalizeHistoryRound, resolveSelection,
} from '../shared/tournament-query/history.js';

// 单条记录。球队视角：所选球队可能在快照里是主队也可能是客队。
function renderMatch(match, teamCode) {
  const isHome = match.home.code === teamCode;
  const opponent = isHome ? match.away : match.home;
  const mine = isHome ? match.homeScore : match.awayScore;
  const theirs = isHome ? match.awayScore : match.homeScore;

  const outcome = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';

  let html = `<div class="history-match" data-edition="${match.edition}">`;
  html += `<span class="history-round">${stageLabel(normalizeHistoryRound(match.round))}</span>`;
  html += `<span class="history-opponent">${flagSVG(opponent.code)}<span class="history-opponent-name">${L(opponent.name)}</span></span>`;
  html += `<span class="history-score history-score--${outcome}">${mine} - ${theirs}</span>`;
  html += `<span class="history-result">${t(`history.${outcome}`)}</span>`;
  // 点球大战单独展示，且不计入胜负判定（见 data-model.md §5）
  if (match.shootout) {
    const soMine = isHome ? match.shootout.home : match.shootout.away;
    const soTheirs = isHome ? match.shootout.away : match.shootout.home;
    html += `<span class="history-shootout">${t('history.shootout')} ${soMine}-${soTheirs}</span>`;
  }
  html += `</div>`;
  return html;
}

// 某一届的区块。届次列表来自 coverage（快照保证恰好等于 meta.editions），
// 因此即使某届无记录也会渲染出该区块并显式标注 —— 不存在无标注的缺届（SC-006）。
function renderEdition(edition, status, matches, teamCode) {
  let html = `<section class="history-edition" data-edition="${edition}">`;
  html += `<h3 class="history-edition-title"><span class="history-edition-label">${t('history.edition')}</span>${edition}</h3>`;

  if (!matches.length) {
    // 「未参赛」与「数据缺失」都是零记录，但语义不同，文案必须可区分（FR-006）
    const label = status === COVERAGE.NOT_QUALIFIED ? t('history.notQualified') : t('history.noData');
    html += `<p class="history-status history-status--${status}">${label}</p>`;
    html += `</section>`;
    return html;
  }

  if (status === COVERAGE.PARTIAL) {
    html += `<p class="history-status history-status--partial">${t('history.partialCoverage')}</p>`;
  }

  html += `<div class="history-head">
    <span>${t('history.round')}</span>
    <span>${t('history.opponent')}</span>
    <span>${t('history.score')}</span>
    <span>${t('history.result')}</span>
  </div>`;
  html += `<div class="history-matches">`;
  for (const match of matches) html += renderMatch(match, teamCode);
  html += `</div>`;

  html += `</section>`;
  return html;
}

export default async function historyView(query) {
  const [snapshot, allTeams] = await Promise.all([getWorldCupHistory(), getTeams()]);

  const meta = snapshot.meta || { editions: [], teams: [] };
  const coverage = snapshot.coverage || {};
  const matches = Array.isArray(snapshot.matches) ? snapshot.matches : [];
  const teamName = (code) => allTeams[code]?.name || { en: code, zh: code };

  // 非法参数一律回落 null，视图可无条件信任返回值（FR-009）
  const { team } = resolveSelection(query, meta.teams);

  let html = `<div class="history-page">`;
  html += `<h2 class="section-title">${t('history.title')}</h2>`;

  if (!meta.teams.length) {
    html += `<p class="history-prompt">${t('history.noData')}</p></div>`;
    return html;
  }

  // 球队选择器用 data-route 链接而非 <select>：状态留在 URL 里，
  // 且复用 router.js 的全局事件委托，不新增事件监听（章程原则 IV）。
  html += `<div class="history-team-picker">`;
  for (const code of meta.teams) {
    const active = code === team;
    html += `<a class="history-team-chip${active ? ' is-active' : ''}"`
      + ` href="#/history?team=${code}" data-route="/history?team=${code}" data-team="${code}"`
      + `${active ? ' aria-current="true"' : ''}>`
      + `${flagSVG(code)}<span class="history-team-name">${L(teamName(code))}</span></a>`;
  }
  html += `</div>`;

  if (!team) {
    html += `<p class="history-prompt">${t('history.selectTeam')}</p>`;
    html += `</div>`;
    return html;
  }

  const rows = listCoverage(coverage, team);
  if (!rows.length) {
    html += `<p class="history-prompt">${t('history.noData')}</p>`;
    html += `</div>`;
    return html;
  }

  // 同届内可能多次交手，不去重（spec 的 Edge Cases）
  const byEdition = new Map(groupByEdition(matches, team).map((group) => [group.edition, group.matches]));

  html += `<div class="history-editions">`;
  for (const { edition, status } of rows) {
    html += renderEdition(edition, status, byEdition.get(edition) || [], team);
  }
  html += `</div>`;

  html += `</div>`;
  return html;
}
