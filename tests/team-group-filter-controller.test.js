// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { mountTeams, visibleCodes, checkbox } from './fixtures/team-group-filter.js';
let mounted;
afterEach(() => { mounted?.dispose(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('updates union synchronously without replacing controls or losing focus; clears the last group', async () => {
  mounted = await mountTeams(); const { root } = mounted;
  const a = checkbox(root, 'A'); expect(a).not.toBeNull();
  a.focus(); a.click();
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB']);
  expect(document.activeElement).toBe(a); expect(checkbox(root, 'A')).toBe(a);
  expect(root.querySelector('[data-team-group-summary]').textContent).toBe('当前显示 2 / 4 支球队');
  checkbox(root, 'C').click(); expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'CCC']);
  a.click(); expect(visibleCodes(root)).toEqual(['CCC']);
  checkbox(root, 'C').click(); expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'BBB', 'CCC']);
  expect(root.querySelector('[data-team-group-summary]').textContent).toBe('当前显示 4 / 4 支球队');
});
it('selects all, handles rapid changes and repeated show-all actions', async () => {
  mounted = await mountTeams(); const { root, state } = mounted;
  expect(checkbox(root, 'A')).not.toBeNull();
  for (const g of ['A', 'B', 'C']) checkbox(root, g).click();
  expect(state.getSnapshot().selectedGroups).toEqual(['A', 'B', 'C']);
  for (let i = 0; i < 9; i++) checkbox(root, 'A').click();
  expect(visibleCodes(root)).toEqual(['BBB', 'CCC']);
  const all = root.querySelector('[data-team-group-action="all"]'); all.focus(); all.click(); all.click();
  expect(root.querySelectorAll('input:checked').length).toBe(0); expect(document.activeElement).toBe(all);
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'BBB', 'CCC']);
});
it('delegates once, ignores unrelated actions and supports disposal and reinitialization', async () => {
  mounted = await mountTeams(); const { root, state, dispose, initTeamGroupFilter } = mounted;
  expect(initTeamGroupFilter({ root, state })).toBe(dispose);
  const set = vi.spyOn(state, 'setSelected');
  const a = checkbox(root, 'A'); expect(a).not.toBeNull(); a.click(); expect(set).toHaveBeenCalledTimes(1);
  const card = root.querySelector('[data-route]'); const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  card.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
  root.insertAdjacentHTML('beforeend', '<input type="checkbox" data-team-group-action="select" data-team-group="B"><button data-team-group-action="all">outside</button>');
  root.lastElementChild.click(); root.querySelector(':scope > input').click();
  expect(set).toHaveBeenCalledTimes(1);
  dispose(); a.click(); expect(set).toHaveBeenCalledTimes(1);
  mounted.dispose = initTeamGroupFilter({ root, state }); a.click(); expect(set).toHaveBeenCalledTimes(2);
  expect(typeof initTeamGroupFilter({ root: null })).toBe('function');
});
it('uses the active English dictionary for updates after language re-render', async () => {
  mounted = await mountTeams(); const { root, view, i18n } = mounted;
  checkbox(root, 'A').click(); await i18n.setLang('en'); root.innerHTML = await view();
  checkbox(root, 'C').click();
  expect(root.querySelector('[data-team-group-summary]').textContent).toBe('Showing 3 / 4 teams');
  expect(visibleCodes(root)).toEqual(['AAA', 'AAB', 'CCC']);
  root.querySelector('[data-team-group-action="all"]').click();
  expect(root.querySelector('[data-team-group-summary]').textContent).toBe('Showing 4 / 4 teams');
});
