// ===== 历届世界杯战绩查询：跨环境共享纯函数层 =====
// 无 DOM、无 window、无环境依赖 —— 浏览器视图与 Node 构建期校验共用同一套判定，
// 避免「页面能显示、门禁却判定不同」的漂移（章程原则 VI）。
import { normalizeRound } from './dataset.js';

// 届次收录状态。校验脚本（scripts/validate-data.mjs）与视图共用此枚举。
export const COVERAGE = Object.freeze({
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  MISSING: 'missing',
  NOT_QUALIFIED: 'not_qualified',
});

// 'group' 是历史快照里合法的轮次，但 normalizeRound() 有意只覆盖淘汰赛：
// ROUND_ALIASES 被既有 AI 工具链共用，扩充它的爆炸半径不属于本功能。
// 因此这里先特判 group，其余一律委托给既有边界。
export function normalizeHistoryRound(round) {
  if (String(round ?? '').toLowerCase().trim() === 'group') return 'group';
  return normalizeRound(round);
}

// 解析路由捕获的原始查询串，得到选择状态。
// search  : string | undefined —— 如 'team=ESP&vs=ARG'
// allowed : string[]          —— meta.teams，唯一合法取值集合
// 返回     : { team: string|null, opponent: string|null }
// 硬性要求：永不抛异常；返回的两个值要么是 allowed 的成员，要么是 null。
export function resolveSelection(search, allowed) {
  const none = { team: null, opponent: null };
  if (search === undefined || search === null || search === '') return none;

  const valid = Array.isArray(allowed) ? allowed : [];
  let params;
  try {
    params = new URLSearchParams(String(search));
  } catch {
    return none;
  }

  // 重复参数取最后一个「有效」值（不在 allowed 的取值跳过）。
  // 注：URLSearchParams.get() 只返回第一个，而契约 history-page-url.md
  // 的输出栏要求取最后一个有效值 —— 以输出栏为准。
  const pickLastValid = (key) => {
    let found = null;
    for (const raw of params.getAll(key)) {
      const code = String(raw).trim().toUpperCase();
      if (valid.includes(code)) found = code;
    }
    return found;
  };

  const team = pickLastValid('team');
  // 无主队时对手无意义，整体回落未选择态（FR-009）
  if (!team) return none;

  const opponent = pickLastValid('vs');
  // 同队不构成交锋，丢弃 vs
  if (!opponent || opponent === team) return { team, opponent: null };

  return { team, opponent };
}

// 按届次归拢某支球队的比赛，届次倒序（FR-003）。
// 组内顺序沿用入参顺序 —— 快照本身已按日期升序排列，视图可直接消费。
export function groupByEdition(matches, code) {
  const list = Array.isArray(matches) ? matches : [];
  const byEdition = new Map();

  for (const match of list) {
    if (!match || match.edition == null) continue;
    if (match.home?.code !== code && match.away?.code !== code) continue;
    const edition = Number(match.edition);
    if (!Number.isFinite(edition)) continue;
    if (!byEdition.has(edition)) byEdition.set(edition, []);
    byEdition.get(edition).push(match);
  }

  return [...byEdition.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([edition, group]) => ({ edition, matches: group }));
}

// 展开某支球队的届次收录状态，届次倒序，与 groupByEdition 同序便于视图配对。
// 返回固定为该队 coverage 的全部届次（快照保证恰好等于 meta.editions）。
export function listCoverage(coverage, code) {
  const rows = coverage?.[code];
  if (!rows || typeof rows !== 'object') return [];

  return Object.keys(rows)
    .map((key) => Number(key))
    .filter((edition) => Number.isFinite(edition))
    .sort((a, b) => b - a)
    .map((edition) => ({ edition, status: rows[String(edition)] }));
}
