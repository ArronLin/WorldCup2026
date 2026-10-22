import { t } from '../../i18n.js';
import { groupFilterState, isGroupVisible } from './state.js';

const roots = new WeakMap();
export function initTeamGroupFilter({ root = document.getElementById('app'), state = groupFilterState } = {}) {
  if (!root) return () => {};
  if (roots.has(root)) return roots.get(root);
  const update = page => {
    const { selectedGroups } = state.getSnapshot();
    for (const input of page.querySelectorAll('input[data-team-group]')) input.checked = selectedGroups.includes(input.dataset.teamGroup);
    for (const section of page.querySelectorAll('.group-card[data-team-group]')) section.hidden = !isGroupVisible(section.dataset.teamGroup, selectedGroups);
    page.querySelector('[data-team-group-summary]').textContent = t(selectedGroups.length ? 'teams.filter.showingSelected' : 'teams.filter.showingAll');
  };
  const change = event => {
    const input = event.target;
    const page = input.closest?.('.teams-page');
    if (!page || !root.contains(page) || !input.matches('input[type="checkbox"][data-team-group-action="select"]')) return;
    state.setSelected(input.dataset.teamGroup, input.checked);
    update(page);
  };
  const click = event => {
    const button = event.target.closest?.('button[data-team-group-action="all"]');
    const page = button?.closest('.teams-page');
    if (!page || !root.contains(page)) return;
    state.clear();
    update(page);
  };
  root.addEventListener('change', change);
  root.addEventListener('click', click);
  const dispose = () => {
    root.removeEventListener('change', change);
    root.removeEventListener('click', click);
    roots.delete(root);
  };
  roots.set(root, dispose);
  return dispose;
}
