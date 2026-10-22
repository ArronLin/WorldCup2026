export function buildTeamGroups(teams) {
  const groups = new Map();
  for (const team of Object.values(teams)) {
    const key = typeof team.group === 'string' ? team.group.trim() : '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(team);
  }
  return [...groups.keys()].filter(Boolean).sort().concat(groups.has('') ? [''] : [])
    .map(key => ({ key, teams: groups.get(key) }));
}
export function isGroupVisible(group, selected) {
  return selected.length === 0 || selected.includes(group);
}
export function createGroupFilterState() {
  let available = new Set();
  const selected = new Set();
  return {
    syncGroups(groups) {
      available = new Set(groups.filter(Boolean));
      for (const group of selected) if (!available.has(group)) selected.delete(group);
    },
    setSelected(group, checked) {
      if (!available.has(group)) return;
      if (checked) selected.add(group);
      else selected.delete(group);
    },
    clear() { selected.clear(); },
    getSnapshot() { return { availableGroups: [...available].sort(), selectedGroups: [...selected].sort() }; },
  };
}
export const groupFilterState = createGroupFilterState();
