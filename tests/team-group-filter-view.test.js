// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { mountTeams, teams, visibleCodes } from './fixtures/team-group-filter.js';
let mounted;
afterEach(() => { mounted?.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('renders all group options, clear action, names and original team order', async () => {
  mounted = await mountTeams(); const { root } = mounted;
  expect([...root.querySelectorAll('input[type="checkbox"]')].map(el => el.dataset.teamGroup)).toEqual(['A', 'B', 'C']);
  expect(root.querySelector('legend')?.textContent).toBe('小组筛选');
  expect(root.querySelector('[data-team-group-action="all"]')?.textContent).toBe('显示全部');
  expect(root.querySelector('[data-team-group-summary]')?.textContent).toBe('当前显示 4 / 4 支球队');
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'BBB', 'CCC']);
  expect(root.textContent).toContain('甲队'); expect(root.textContent).toContain('UEFA · #1');
});
it('reads the latest selection when re-rendering, retains all options and resets with a new document instance', async () => {
  mounted = await mountTeams(); const { root, state, view } = mounted;
  state.setSelected('A', true); state.setSelected('C', true);
  root.innerHTML = await view();
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'CCC']);
  expect(root.querySelectorAll('input[type="checkbox"]').length).toBe(3);
  expect(root.querySelectorAll('input:checked').length).toBe(2);
  mounted.dispose(); mounted = await mountTeams();
  expect(visibleCodes(mounted.root)).toEqual(['AAA', 'AAB', 'BBB', 'CCC']);
});
it.each([{}, new Error('offline')])('uses a neutral unavailable message for empty or failed data [%#]', async data => {
  mounted = await mountTeams(data);
  expect(mounted.root.textContent).toContain('暂无可显示的球队，可刷新重试');
  expect(mounted.root.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  expect(visibleCodes(mounted.root)).toEqual([]);
});
it('keeps unknown-group teams only in all mode and excludes them from options', async () => {
  mounted = await mountTeams({ ...teams, XXX: { code: 'XXX', name: { zh: '未知队', en: 'Unknown' } } });
  const { root, state, view } = mounted;
  expect(root.textContent).toContain('分组未知');
  expect(visibleCodes(root)).toContain('XXX');
  expect(root.querySelectorAll('input').length).toBe(3);
  state.setSelected('A', true); root.innerHTML = await view();
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB']);
});
it('switches real dictionaries zh → en → zh while retaining selected groups and team identities', async () => {
  mounted = await mountTeams(); const { root, state, view, i18n } = mounted;
  state.setSelected('A', true); state.setSelected('C', true);
  root.innerHTML = await view(); expect(root.querySelector('legend').textContent).toBe('小组筛选');
  await i18n.setLang('en'); root.innerHTML = await view();
  expect(document.documentElement.lang).toBe('en');
  expect(root.querySelector('legend').textContent).toBe('Filter by group');
  expect(root.querySelector('[data-team-group-summary]').textContent).toBe('Showing 3 / 4 teams');
  expect(root.textContent).toContain('Alpha');
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'CCC']);
  expect([...root.querySelectorAll('input:checked')].map(el => el.dataset.teamGroup)).toEqual(['A', 'C']);
  await i18n.setLang('zh'); root.innerHTML = await view();
  expect(root.querySelector('legend').textContent).toBe('小组筛选');
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'CCC']);
});
it('translates all-mode and unknown-group labels using the English dictionary', async () => {
  mounted = await mountTeams({ ...teams, XXX: { code: 'XXX', name: { en: 'Unknown' } } }, 'en');
  expect(mounted.root.textContent).toContain('Unknown group');
  expect(mounted.root.querySelector('[data-team-group-summary]').textContent).toBe('Showing 5 / 5 teams');
  expect(mounted.root.querySelector('[data-team-group-action="all"]').textContent).toBe('Show all');
});
it('translates unavailable-data guidance using the English dictionary', async () => {
  mounted = await mountTeams({}, 'en');
  expect(mounted.root.textContent).toContain('No teams available. Refresh to try again.');
});
