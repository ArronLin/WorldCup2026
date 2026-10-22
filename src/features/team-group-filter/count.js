import { isGroupVisible } from './state.js';

export function countTeamGroups(groups, selectedGroups) {
  let visible = 0;
  let total = 0;
  for (const group of groups) {
    total += group.teams.length;
    if (isGroupVisible(group.key, selectedGroups)) visible += group.teams.length;
  }
  return { visible, total };
}

let currentGroups = [];
export function setGroups(groups) { currentGroups = groups; }
export function getCounts(selectedGroups) { return countTeamGroups(currentGroups, selectedGroups); }
