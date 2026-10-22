// ===== Global Search =====
import { getTeams, getMatches, getPlayerNames } from '../../store.js';
import { L, flagSVG, stageLabel } from '../../utils.js';
import { t } from '../../i18n.js';

let data = null;
let els = {};
let flat = [];   // flat list of hrefs in render order (for keyboard nav)
let active = -1; // highlighted index within flat

export async function initSearch() {
  els.container = document.getElementById('searchContainer');
  els.input = document.getElementById('searchInput');
  els.results = document.getElementById('searchResults');
  if (!els.container || !els.input || !els.results) return;

  try {
    const [teams, matches, playerNames] = await Promise.all([
      getTeams(), getMatches(), getPlayerNames()
    ]);
    data = buildIndex(teams, matches, playerNames);
  } catch (e) {
    console.warn('Search index build failed:', e);
    data = { teams: [], matches: [], players: [] };
  }

  bindEvents();
  updatePlaceholder();
}

// Refresh placeholder + re-render open panel on language switch
export function refreshSearch() {
  if (!els.input) return;
  updatePlaceholder();
  if (els.results.classList.contains('open') && els.input.value.trim()) {
    render(els.input.value);
  }
}

function buildIndex(teams, matches, playerNames) {
  const teamArr = Object.values(teams).map(tm => ({
    code: tm.code,
    name: tm.name,
    group: tm.group,
    confederation: tm.confederation,
    search: [tm.code, tm.name.en, tm.name.zh, tm.confederation]
      .filter(Boolean).join(' ').toLowerCase()
  }));

  const matchArr = matches.map(m => ({
    id: m.id,
    home: m.home,
    away: m.away,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    stage: m.stage,
    round: m.round,
    search: [m.home.code, m.away.code, m.home.name, m.away.name,
      m.home.nameZh, m.away.nameZh, String(m.id)]
      .filter(Boolean).join(' ').toLowerCase()
  }));

  // Aggregate players from goals + cards across all matches
  const pmap = {};
  matches.forEach(m => {
    const add = (p, team) => {
      if (!p || !p.player) return;
      if (!pmap[p.player]) {
        pmap[p.player] = { name: p.player, zh: playerNames[p.player], team, count: 0 };
      }
      pmap[p.player].count++;
    };
    (m.goals || []).forEach(g => add(g, g.team));
    (m.cards || []).forEach(c => add(c, c.team));
  });
  const playerArr = Object.values(pmap).map(p => ({
    name: p.name,
    zh: p.zh,
    team: p.team,
    count: p.count,
    search: [p.name, p.zh, p.team].filter(Boolean).join(' ').toLowerCase()
  }));

  return { teams: teamArr, matches: matchArr, players: playerArr };
}

function query(q) {
  q = q.trim().toLowerCase();
  if (!q) return null;
  return {
    teams: data.teams.filter(t => t.search.includes(q)).slice(0, 6),
    matches: data.matches.filter(m => m.search.includes(q)).slice(0, 6),
    players: data.players.filter(p => p.search.includes(q)).slice(0, 6),
  };
}

function render(q) {
  const res = query(q);
  if (!res) { close(); return; }

  const has = res.teams.length || res.matches.length || res.players.length;
  if (!has) {
    els.results.innerHTML = `<div class="search-empty">${t('search.noResults')}</div>`;
    open(); flat = []; active = -1;
    return;
  }

  const lang = window.__lang || 'zh';
  const items = [];

  if (res.teams.length) {
    items.push({ label: t('search.teams') });
    res.teams.forEach(tm => {
      const grp = tm.group
        ? (lang === 'zh' ? `第${tm.group}组` : `Group ${tm.group}`)
        : '';
      items.push({
        href: `#/team/${tm.code}`,
        html: `${flagSVG(tm.code, 'sm')}` +
          `<span class="search-name">${L(tm.name)}</span>` +
          `<span class="search-sub">${tm.code}${grp ? ' · ' + grp : ''}</span>`
      });
    });
  }

  if (res.matches.length) {
    items.push({ label: t('search.matches') });
    res.matches.forEach(m => {
      const homeName = (m.home.nameZh && lang === 'zh') ? m.home.nameZh : m.home.name;
      const awayName = (m.away.nameZh && lang === 'zh') ? m.away.nameZh : m.away.name;
      const score = (m.homeScore != null && m.awayScore != null)
        ? `${m.homeScore}-${m.awayScore}`
        : (lang === 'zh' ? '未赛' : '–');
      items.push({
        href: `#/match/${m.id}`,
        html: `${flagSVG(m.home.code, 'sm')}${flagSVG(m.away.code, 'sm')}` +
          `<span class="search-name">${homeName} <b>${score}</b> ${awayName}</span>` +
          `<span class="search-sub">#${m.id} · ${stageLabel(m)}</span>`
      });
    });
  }

  if (res.players.length) {
    items.push({ label: t('search.players') });
    res.players.forEach(p => {
      const pname = (p.zh && lang === 'zh') ? p.zh : p.name;
      const sub = lang === 'zh' ? `${p.team} · 出场 ${p.count} 次` : `${p.team} · ${p.count} apps`;
      items.push({
        href: `#/team/${p.team}`,
        html: `${flagSVG(p.team, 'sm')}` +
          `<span class="search-name">${pname}</span>` +
          `<span class="search-sub">${sub}</span>`
      });
    });
  }

  let html = '';
  flat = [];
  items.forEach(it => {
    if (it.label !== undefined) {
      html += `<div class="search-group">${it.label}</div>`;
    } else {
      const idx = flat.length;
      html += `<a class="search-item" href="${it.href}" data-idx="${idx}">${it.html}</a>`;
      flat.push(it.href);
    }
  });

  els.results.innerHTML = html;
  active = -1;
  open();
}

function open() { els.results.classList.add('open'); }
function close() { els.results.classList.remove('open'); active = -1; }

function onKey(e) {
  if (e.key === 'Escape') { close(); els.input.blur(); return; }
  if (!flat.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
  else if (e.key === 'Enter') {
    if (active >= 0 && flat[active]) {
      e.preventDefault();
      location.hash = flat[active];
      close();
    }
  }
}

function move(dir) {
  const nodes = els.results.querySelectorAll('.search-item');
  if (!nodes.length) return;
  if (active >= 0 && nodes[active]) nodes[active].classList.remove('active');
  active = (active + dir + nodes.length) % nodes.length;
  nodes[active].classList.add('active');
  nodes[active].scrollIntoView({ block: 'nearest' });
}

function updatePlaceholder() {
  els.input.placeholder = t('search.placeholder');
}

function bindEvents() {
  els.input.addEventListener('input', () => render(els.input.value));
  els.input.addEventListener('focus', () => {
    if (els.input.value.trim()) render(els.input.value);
  });
  els.input.addEventListener('keydown', onKey);

  // Close when clicking outside the search container
  document.addEventListener('click', (e) => {
    if (!els.container.contains(e.target)) close();
  });

  // Close after navigating
  window.addEventListener('hashchange', () => close());

  // Global "/" shortcut to focus the search box
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    if (e.key === '/' && !typing && document.activeElement !== els.input) {
      e.preventDefault();
      els.input.focus();
    }
  });
}
