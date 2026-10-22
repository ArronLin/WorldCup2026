import { STAGES } from '../../utils.js';

export const stageOrder = Object.freeze(Object.keys(STAGES).sort((a,b) => STAGES[a].order - STAGES[b].order));
export function matchCategory(match) {
  const category = match?.stage === 'knockout' ? match.round : match?.stage;
  return stageOrder.includes(category) ? category : null;
}
export const isFilterStage = stage => stage === 'all' || stageOrder.includes(stage);

export function selectMatches(matches, { teamCodes, followOnly, stage }) {
  const followed = new Set(teamCodes);
  const seen = new Set();
  return matches.filter(m => {
    const teamMatches = !followOnly || (followed.has(m.home.code) || followed.has(m.away.code));
    const stageMatches = stage === 'all' || matchCategory(m) === stage;
    if (!(teamMatches && stageMatches) || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}
