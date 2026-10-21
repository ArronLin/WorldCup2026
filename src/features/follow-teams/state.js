import { isFilterStage } from './matches.js';
import { browserStorage } from '../../browser-storage.js';

export const FOLLOW_KEY = 'wc2026-followed-teams';
export function createFollowState({ storage = browserStorage } = {}) {
  let initialized = false;
  let allowed = new Set();
  const followed = new Set();
  let restoreIssue = null;
  let saveIssue = null;
  let followOnly = false;
  let stage = 'all';

  const getSnapshot = () => ({ initialized, teamCodes: [...followed].sort(), followOnly, stage, restoreIssue, saveIssue });

  function initialize(teams) {
    if (initialized || !teams || typeof teams !== 'object' || Array.isArray(teams)) return getSnapshot();
    allowed = new Set(Object.keys(teams));
    initialized = true;
    const saved = storage.read(FOLLOW_KEY);
    if (!saved.ok) restoreIssue = 'unavailable';
    else if (saved.value !== null) {
      try {
        const value = JSON.parse(saved.value);
        if (!value || value.version !== 1 || !Array.isArray(value.teamCodes)) throw new Error('invalid record');
        for (const code of value.teamCodes) if (typeof code === 'string' && allowed.has(code)) followed.add(code);
      } catch { restoreIssue = 'corrupt'; }
    }
    return getSnapshot();
  }

  function setFollowed(code, desired) {
    if (!initialized || !allowed.has(code) || typeof desired !== 'boolean') return getSnapshot();
    if (followed.has(code) === desired) return getSnapshot();
    if (desired) followed.add(code); else followed.delete(code);
    const result = storage.write(FOLLOW_KEY, JSON.stringify({ version: 1, teamCodes: [...followed].sort() }));
    if (result.ok) { saveIssue = null; restoreIssue = null; }
    else saveIssue = 'failed';
    return getSnapshot();
  }

  function setScheduleFilters(patch = {}) {
    if (typeof patch.followOnly === 'boolean') followOnly = patch.followOnly;
    if (isFilterStage(patch.stage)) stage = patch.stage;
    return getSnapshot();
  }
  return { getSnapshot, initialize, setFollowed, setScheduleFilters };
}
export const followState = createFollowState();

