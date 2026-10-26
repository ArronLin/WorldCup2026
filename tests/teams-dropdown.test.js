// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prepareDom } from './fixtures/follow-dom.js';
import { readFileSync } from 'node:fs';
let view, init, dispose;
beforeEach(async () => {
  vi.resetModules(); await prepareDom();
  const fallback = fetch.getMockImplementation();
  fetch.mockImplementation(url => String(url).includes('/data/teams.json')
    ? Promise.resolve({ ok: true, json: async () => JSON.parse(readFileSync('public/data/teams.json', 'utf8')) })
    : fallback(url));
  const module = await import('../src/views/teams.js');
  view = module.default; init = (await import('../src/teams-filter.js')).initTeamsFilter;
  document.querySelector('#app').innerHTML = await view();
});
afterEach(() => { dispose?.(); dispose = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const visible = selector => [...document.querySelectorAll(selector)].filter(el => !el.hidden && !el.closest('[data-team-group][hidden]'));
function toggle(code) {
  const input = document.querySelector(`[data-group-choice][value="${code}"]`);
  expect(input).not.toBeNull(); input.click();
}
it('AC1 offers a closed checkbox dropdown, visible labels and all teams by default', () => {
  expect(document.querySelector('details.teams-filter').open).toBe(false);
  expect(document.querySelector('.teams-filter summary').textContent).toBe('筛选小组');
  expect(document.querySelector('[data-group-choice][value=""]').checked).toBe(true);
  expect(document.querySelectorAll('[data-group-choice]')).toHaveLength(13);
  expect(document.querySelector('input[value="A"]').labels[0].textContent).toContain('小组 A');
});
it('AC1 shows multiple selected teams across groups and retains checkbox focus', () => {
  dispose = init(document.querySelector('#app'));
  toggle('A'); const input = document.querySelector('input[value="B"]'); input.focus(); toggle('B');
  expect(visible('.group-card').map(el => el.dataset.teamGroup).sort()).toEqual(['A','B']);
  expect(visible('.group-card')).toHaveLength(2);
  expect(visible('.team-search-result')).toHaveLength(8);
  expect(document.activeElement).toBe(input);
  expect(document.querySelector('input[value=""]').checked).toBe(false);
});
it('AC4 closes on clicks inside app and outside app, preserves selection and external actions', () => {
  dispose = init(document.querySelector('#app'));
  const panel = document.querySelector('.teams-filter'); panel.open = true;
  toggle('A'); expect(panel.open).toBe(true);
  document.querySelector('.teams-filter-options').click(); expect(panel.open).toBe(true);
  document.querySelector('h1').click(); expect(panel.open).toBe(false);
  panel.open = true;
  const outside = document.createElement('button'); document.body.append(outside);
  const handler = vi.fn(event => event.stopPropagation()); outside.addEventListener('click', handler);
  outside.click(); expect(panel.open).toBe(false); expect(handler).toHaveBeenCalledOnce();
  expect(document.querySelector('input[value="A"]').checked).toBe(true);
});
it('AC5 releases document clicks, reinitializes once and handles replacement markup', async () => {
  const root = document.querySelector('#app'); dispose = init(root);
  const panel = root.querySelector('.teams-filter'); panel.open = true;
  dispose(); document.body.click(); expect(panel.open).toBe(true);
  dispose = init(root); expect(init(root)).toBe(dispose);
  document.body.click(); expect(panel.open).toBe(false);
  root.innerHTML = await view(); const fresh = root.querySelector('.teams-filter'); fresh.open = true;
  document.body.click(); expect(fresh.open).toBe(false);
  root.innerHTML = ''; expect(() => document.body.click()).not.toThrow();
});
it('AC2 removes one selection, resets on empty selection and supports all teams', () => {
  dispose = init(document.querySelector('#app'));
  toggle('A'); toggle('B'); toggle('A');
  expect(visible('.group-card').map(el => el.dataset.teamGroup)).toEqual(['B']);
  toggle('B'); expect(visible('.team-search-result')).toHaveLength(48);
  expect(document.querySelector('input[value=""]').checked).toBe(true);
  toggle('A'); toggle('');
  expect(visible('.team-search-result')).toHaveLength(48);
  expect(document.querySelectorAll('[data-group-choice]:checked')).toHaveLength(1);
  toggle(''); expect(document.querySelector('input[value=""]').checked).toBe(true);
});
it('AC3 initializes once, disposes, reinitializes and handles replacement markup', async () => {
  const root = document.querySelector('#app');
  dispose = init(root); expect(init(root)).toBe(dispose);
  const old = document.querySelector('input[value="A"]');
  const spy = vi.spyOn(root, 'querySelectorAll');
  toggle('A'); expect(spy.mock.calls.filter(([s]) => s === '[data-team-group]').length).toBe(1);
  dispose(); toggle(''); expect(visible('.team-search-result')).toHaveLength(4);
  dispose = init(root); root.innerHTML = await view(); toggle('A');
  expect(visible('.team-search-result')).toHaveLength(4);
  old.dispatchEvent(new Event('change', { bubbles: true }));
  const before = spy.mock.calls.length;
  root.dispatchEvent(new Event('change', { bubbles: true }));
  expect(spy.mock.calls.length).toBe(before);
});
it('AC3 translates the label, all option and team names into English', async () => {
  const { toggleLang } = await import('../src/i18n.js'); await toggleLang();
  document.querySelector('#app').innerHTML = await view();
  expect(document.querySelector('.teams-filter summary').textContent).toBe('Filter groups');
  expect(document.querySelector('input[value=""]').labels[0].textContent).toContain('All groups');
  expect(document.querySelector('input[value="A"]').labels[0].textContent).toContain('Group A');
});
