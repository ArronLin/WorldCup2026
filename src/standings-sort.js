export const SORT_METRICS = Object.freeze(['points', 'goalsFor', 'goalsAgainst', 'goalDifference']);

export function nextSortState(current, metric) {
  if (!SORT_METRICS.includes(metric)) return null;
  const direction = current?.metric === metric
    ? (current.direction === 'ascending' ? 'descending' : 'ascending')
    : (metric === 'goalsAgainst' ? 'ascending' : 'descending');
  return { metric, direction };
}

// Always derive the display order from the original group sequence.
export function sortStandings(initialRows, state) {
  if (!state || !SORT_METRICS.includes(state.metric)) return [...initialRows];
  const { metric, direction } = state;
  const sign = direction === 'ascending' ? 1 : -1;
  return initialRows.map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = a.row[metric];
      const bv = b.row[metric];
      const aValid = Number.isFinite(av);
      const bValid = Number.isFinite(bv);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && av !== bv) return sign * (av - bv);
      return a.index - b.index;
    })
    .map(({ row }) => row);
}
