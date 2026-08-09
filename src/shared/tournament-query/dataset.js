/** Shared, environment-neutral dataset boundary for browser BYOK and Functions. */
export const ROUND_ALIASES = Object.freeze({
  r32: 'round_of_32', r16: 'round_of_16', qf: 'quarterfinal', sf: 'semifinal',
  third: 'third_place', third_place: 'third_place', final: 'final',
  quarterfinals: 'quarterfinal', semifinals: 'semifinal',
});

export function normalizeRound(input) {
  if (!input) return null;
  const key = String(input).toLowerCase().trim();
  if (ROUND_ALIASES[key]) return ROUND_ALIASES[key];
  if (key.includes('round_of_32')) return 'round_of_32';
  if (key.includes('round_of_16')) return 'round_of_16';
  if (key.includes('quarter')) return 'quarterfinal';
  if (key.includes('semi')) return 'semifinal';
  return null;
}

export function normalizeTournamentDataset(raw = {}) {
  return {
    matches: Array.isArray(raw.matches) ? raw.matches : [],
    teams: raw.teams && typeof raw.teams === 'object' ? raw.teams : {},
    standings: raw.standings && typeof raw.standings === 'object' ? raw.standings : {},
    bracket: raw.bracket && typeof raw.bracket === 'object' ? raw.bracket : {},
    awards: raw.awards && typeof raw.awards === 'object' ? raw.awards : {},
    groups: raw.groups && typeof raw.groups === 'object' ? raw.groups : {},
    venues: raw.venues && typeof raw.venues === 'object' ? raw.venues : {},
    playerNames: raw.playerNames && typeof raw.playerNames === 'object' ? raw.playerNames : {},
  };
}
