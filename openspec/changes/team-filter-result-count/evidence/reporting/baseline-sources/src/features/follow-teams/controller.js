import { handleRoute } from '../../router.js';
import { followState } from './state.js';
const roots = new WeakMap();
let retryPath = null;
export function consumeRetry() {
  const retry = retryPath === location.hash;
  retryPath = null;
  return retry;
}
// Delegate once to the persistent root; update state before rendering.
export function initFollowTeams({ root = document.getElementById('app'), state = followState, refresh = handleRoute } = {}) {
  if (!root) return () => {};
  if (roots.has(root)) return roots.get(root);
  let retrying = false;
  const click = async event => {
    const button = event.target.closest('[data-follow-action]');
    if (!button || !root.contains(button)) return;
    const action = button.dataset.followAction;
    if (action === 'toggle') {
      const code = button.dataset.team;
      state.setFollowed(code, !state.getSnapshot().teamCodes.includes(code));
      await refresh({ preserveScroll: true, focusKey: button.dataset.followFocus });
    } else if (action === 'stage') {
      state.setScheduleFilters({ stage: button.dataset.filter });
      await refresh({ preserveScroll: true, focusKey: button.dataset.followFocus });
    } else if (action === 'retry' && !retrying) {
      retrying = true;
      button.disabled = true;
      retryPath = location.hash;
      try {
        await refresh({ preserveScroll: true, focusKey: button.dataset.followFocus });
      } finally {
        retrying = false;
        button.disabled = false;
        retryPath = null;
      }
    }
  };
  const change = async event => {
    const input = event.target;
    if (input.matches('input[type="checkbox"][data-follow-action="filter"]')) {
      state.setScheduleFilters({ followOnly: input.checked });
      await refresh({ preserveScroll: true, focusKey: input.dataset.followFocus });
    }
  };
  root.addEventListener('change', change);
  root.addEventListener('click', click);
  const dispose = () => { root.removeEventListener('change', change); root.removeEventListener('click', click); roots.delete(root); };
  roots.set(root, dispose);
  return dispose;
}
