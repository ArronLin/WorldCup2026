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
    } else if (action === 'batch-mode-toggle') {
      const active = button.getAttribute('aria-pressed') === 'true';
      _setBatchMode(root, !active);
    } else if (action === 'stage') {
      state.setScheduleFilters({ stage: button.dataset.filter });
      await refresh({ preserveScroll: true, focusKey: button.dataset.followFocus });
    } else if (action === 'batch-follow' || action === 'batch-unfollow') {
      const desired = action === 'batch-follow';
      const codes = [...root.querySelectorAll('[data-team-select]:checked')].map(cb => cb.value);
      if (codes.length === 0) return;
      state.setFollowedBatch(codes, desired);
      await refresh({ preserveScroll: true, focusKey: button.dataset.followFocus });
    } else if (action === 'batch-clear') {
      root.querySelectorAll('[data-team-select]').forEach(cb => { cb.checked = false; });
      _syncBatchBar(root);
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
    } else if (input.matches('[data-team-select]')) {
      _syncBatchBar(root);
    }
  };
  root.addEventListener('change', change);
  root.addEventListener('click', click);
  const dispose = () => { root.removeEventListener('change', change); root.removeEventListener('click', click); roots.delete(root); };
  roots.set(root, dispose);
  return dispose;
}

function _syncBatchBar(root) {
  const bar = root.querySelector('[data-batch-bar]');
  if (!bar) return;
  const checked = [...root.querySelectorAll('[data-team-select]:checked')];
  const count = checked.length;
  const countEl = bar.querySelector('[data-batch-count]');
  if (countEl) countEl.textContent = count;
  bar.hidden = count === 0;
}

function _setBatchMode(root, active) {
  const toggle = root.querySelector('[data-follow-action="batch-mode-toggle"]');
  if (toggle) toggle.setAttribute('aria-pressed', String(active));
  // Show/hide checkboxes on each team row
  root.querySelectorAll('.teams-batch-cb').forEach(cb => {
    cb.style.display = active ? 'inline-block' : 'none';
    if (!active) cb.checked = false;
  });
  // When leaving batch mode, hide the bar and clear selection
  if (!active) {
    const bar = root.querySelector('[data-batch-bar]');
    if (bar) bar.hidden = true;
  }
  // Prevent card click-navigation while in batch mode
  root.querySelectorAll('.teams-batch-item').forEach(item => {
    if (active) {
      item.dataset.routeDisabled = '1';
    } else {
      delete item.dataset.routeDisabled;
    }
  });
}
