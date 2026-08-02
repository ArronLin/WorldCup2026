// ===== Utilities =====

// Get localized value from {en, zh} object
export function L(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const lang = window.__lang || 'zh';
  return obj[lang] || obj.en || obj.zh || '';
}

// Translate a player name to the current language.
// Uses the player-names.json dictionary cached in window.__playerNames.
export function translatePlayer(name) {
  if (!name) return '';
  const lang = window.__lang || 'zh';
  if (lang !== 'zh') return name;
  const dict = window.__playerNames;
  if (dict && dict[name]) return dict[name];
  return name;
}

// Stadium name translations (English string → Chinese)
const STADIUM_ZH = {
  'AT&T Stadium, Arlington': 'AT&T体育场，阿灵顿',
  'Arrowhead Stadium, Kansas City': '箭头体育场，堪萨斯城',
  'BC Place, Vancouver': 'BC广场体育场，温哥华',
  'BMO Field, Toronto': 'BMO球场，多伦多',
  'Estadio Akron, Zapopan': '阿克龙体育场，萨波潘',
  'Estadio Azteca, Mexico City': '阿兹特克体育场，墨西哥城',
  'Estadio BBVA, Guadalupe': 'BBVA体育场，瓜达卢佩',
  "Gillette Stadium, Foxborough": '吉列体育场，福克斯堡',
  'Hard Rock Stadium, Miami Gardens': '硬石体育场，迈阿密花园',
  "Levi's Stadium, Santa Clara": '李维斯体育场，圣克拉拉',
  'Lincoln Financial Field, Philadelphia': '林肯金融球场，费城',
  'Lumen Field, Seattle': '流明球场，西雅图',
  'Mercedes-Benz Stadium, Atlanta': '梅赛德斯奔驰体育场，亚特兰大',
  'MetLife Stadium, East Rutherford': '大都会球场，东拉瑟福德',
  'NRG Stadium, Houston': 'NRG体育场，休斯顿',
  'SoFi Stadium, Inglewood': 'SoFi体育场，英格尔伍德',
};

// Translate a stadium name to the current language.
export function translateStadium(name) {
  if (!name) return '';
  const lang = window.__lang || 'zh';
  if (lang !== 'zh') return name;
  return STADIUM_ZH[name] || name;
}

// Format date based on language
export function formatDate(dateStr, lang) {
  lang = lang || window.__lang || 'zh';
  const d = new Date(dateStr + 'T00:00:00');
  if (lang === 'zh') {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateFull(dateStr, lang) {
  lang = lang || window.__lang || 'zh';
  const d = new Date(dateStr + 'T00:00:00');
  if (lang === 'zh') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Format score string
export function formatScore(home, away) {
  if (home == null || away == null) return 'vs';
  return `${home} - ${away}`;
}

// FIFA country code → ISO 3166-1 alpha-2 code for flagcdn.com
const FIFA_TO_ISO = {
  ARG: 'ar', BRA: 'br', ESP: 'es', FRA: 'fr', ENG: 'gb-eng', GER: 'de',
  ITA: 'it', POR: 'pt', NED: 'nl', BEL: 'be', MEX: 'mx', USA: 'us',
  CAN: 'ca', JPN: 'jp', KOR: 'kr', AUS: 'au', SUI: 'ch', DEN: 'dk',
  SWE: 'se', NOR: 'no', CRO: 'hr', SRB: 'rs', POL: 'pl', AUT: 'at',
  URU: 'uy', COL: 'co', CHI: 'cl', ECU: 'ec', PER: 'pe', PAR: 'py',
  MAR: 'ma', SEN: 'sn', NGA: 'ng', GHA: 'gh', CMR: 'cm', TUN: 'tn',
  ALG: 'dz', EGY: 'eg', RSA: 'za', IRN: 'ir', KSA: 'sa', JOR: 'jo',
  UZB: 'uz', IRQ: 'iq', UAE: 'ae', CRC: 'cr', PAN: 'pa', HON: 'hn',
  CIV: 'ci', CUW: 'cw', COD: 'cd', CPV: 'cv', CZE: 'cz', HAI: 'ht',
  QAT: 'qa', SCO: 'gb-sct', TUR: 'tr', BIH: 'ba', NZL: 'nz',
};

// Flag image generator using locally downloaded flag images
export function flagSVG(code, size) {
  size = size || 'md';
  if (!code) {
    return `<div class="flag flag-${size}" style="background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:var(--text-secondary);border:1px solid var(--border-strong);border-radius:3px;">?</div>`;
  }
  // Use locally downloaded flag images from assets/flags/
  return `<img class="flag flag-${size}" src="assets/flags/${code}.png" alt="${code}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="flag flag-${size} flag-fallback" style="display:none;background:var(--bg-elevated);align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:var(--text-secondary);border:1px solid var(--border-strong);border-radius:3px;">${code}</div>`;
}

// Stage info
export const STAGES = {
  'group': { en: 'Group Stage', zh: '小组赛', order: 0 },
  'round_of_32': { en: 'Round of 32', zh: '三十二强', order: 1 },
  'round_of_16': { en: 'Round of 16', zh: '十六强', order: 2 },
  'quarterfinal': { en: 'Quarter-finals', zh: '四分之一决赛', order: 3 },
  'semifinal': { en: 'Semi-finals', zh: '半决赛', order: 4 },
  'third_place': { en: 'Third Place', zh: '季军战', order: 5 },
  'final': { en: 'Final', zh: '决赛', order: 6 },
};

// Resolve a stage label from either a match object (with `stage` and optional
// `round` fields) or a plain stage/round string key.
// - When passed a match whose `stage` is 'knockout', the `round` field
//   (e.g. 'round_of_32') is used to look up the label.
// - When passed a string (e.g. 'group', 'round_of_32'), it is looked up directly.
export function stageLabel(match) {
  if (match && typeof match === 'object') {
    const key = match.stage === 'knockout'
      ? (match.round || match.stage)
      : (match.stage || match.round);
    const s = STAGES[key];
    return s ? L(s) : (key != null ? String(key) : '');
  }
  const s = STAGES[match];
  return s ? L(s) : match;
}

// Parse a match minute value into a number for sorting.
// Accepts numbers ("9") and stoppage-time strings like "90+2" (-> 92) or
// "45+3" (-> 48). Unknown values fall back to 0.
function parseMinute(min) {
  if (min == null) return 0;
  if (typeof min === 'number') return min;
  const m = String(min).trim().match(/^(\d+)(?:\s*\+\s*(\d+))?/);
  if (!m) return 0;
  return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) : 0);
}

// Sort events by minute
export function sortEvents(events) {
  return events.slice().sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
}

// Calculate standings from matches (fallback if standings.json missing)
export function calcStandings(matches, group) {
  const groupMatches = matches.filter(m => m.stage === 'group' && m.group === group && m.status === 'finished');
  const teams = {};
  groupMatches.forEach(m => {
    [m.home, m.away].forEach(side => {
      if (!teams[side.teamId]) {
        teams[side.teamId] = { teamId: side.teamId, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 };
      }
    });
    const h = teams[m.home.teamId], a = teams[m.away.teamId];
    h.played++; a.played++;
    h.gf += m.home.score; h.ga += m.away.score;
    a.gf += m.away.score; a.ga += m.home.score;
    if (m.home.score > m.away.score) { h.win++; h.pts += 3; a.loss++; }
    else if (m.home.score < m.away.score) { a.win++; a.pts += 3; h.loss++; }
    else { h.draw++; a.draw++; h.pts++; a.pts++; }
  });
  const arr = Object.values(teams);
  arr.forEach(t => { t.gd = t.gf - t.ga; });
  arr.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  arr.forEach((t, i) => { t.rank = i + 1; });
  return arr;
}

// SVG icons
export const ICONS = {
  goal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 2 L14.5 9 L22 9 L16 13.5 L18 21 L12 16.5 L6 21 L8 13.5 L2 9 L9.5 9 Z" fill="currentColor"/></svg>',
  yellowCard: '<svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor"><rect x="2" y="2" width="12" height="16" rx="2" fill="currentColor"/></svg>',
  redCard: '<svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor"><rect x="2" y="2" width="12" height="16" rx="2" fill="currentColor"/></svg>',
  trophy: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4h12v3a6 6 0 01-12 0V4z" fill="currentColor" fill-opacity="0.15"/><path d="M6 4H4v2a4 4 0 004 4M18 4h2v2a4 4 0 01-4 4M9 14h6M10 14v4M14 14v4M8 18h8v2H8z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  location: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  whistle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="14" r="6"/><path d="M15 8h6M21 8v3l-4.5 1.5"/></svg>',
};

export function icon(name) { return ICONS[name] || ''; }
