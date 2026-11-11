// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prepareDom } from './fixtures/follow-dom.js';
let state, dispose, root, refresh;
beforeEach(async () => {
  vi.resetModules(); await prepareDom(); location.hash = '#/schedule';
  state = (await import('../src/features/schedule-date-range/state.js')).scheduleDateState;
  const view = await import('../src/features/schedule-date-range/view.js');
  root = document.querySelector('#app');
  root.innerHTML = view.renderDateControls(state.getSnapshot(), '2026-06-11');
  refresh = vi.fn();
  dispose = (await import('../src/features/schedule-date-range/controller.js')).initScheduleDateRange({ root, state, refresh });
});
afterEach(() => { dispose?.(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const open = (field = 'start') => { root.querySelector(`[data-calendar-open="${field}"]`).click(); };
const key = value => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
const change = (selector, value) => { const el = root.querySelector(selector); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); };
it('opens a calendar and selects a date into only the draft until Apply', () => {
  const trigger = root.querySelector('[data-calendar-open="start"]');
  expect(trigger).not.toBeNull(); trigger.click();
  expect(root.querySelector('[role="dialog"]')).not.toBeNull();
  root.querySelector('[data-calendar-day="2026-06-12"]').click();
  expect(state.getSnapshot()).toMatchObject({ draft: { start: '2026-06-12', end: '' }, applied: { start: '', end: '' } });
  expect(refresh).not.toHaveBeenCalled();
  expect(root.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect(state.getSnapshot().applied.start).toBe('2026-06-12');
});

it('preserves raw drafts on cancel and prioritizes draft, applied, then snapshot', () => {
  state.setDraft('start', '2024-02-29'); state.apply(); state.setDraft('start', 'bad');
  open(); expect(document.activeElement.dataset.calendarDay).toBe('2024-02-29'); key('Escape');
  expect(state.getSnapshot().draft.start).toBe('bad');
  state.setDraft('start', '0001-01-01'); open();
  expect(root.querySelector('[data-calendar-move="-1"]').disabled).toBe(true);
  key('ArrowLeft'); expect(document.activeElement.dataset.calendarDay).toBe('0001-01-01');
  root.querySelector('[data-calendar-close]').click();
  state.setDraft('start', '9999-12-31'); open();
  expect(root.querySelector('[data-calendar-move="1"]').disabled).toBe(true);
  key('ArrowRight'); expect(document.activeElement.dataset.calendarDay).toBe('9999-12-31');
});

it('navigates leap days, month/year boundaries and quick navigation without applying', () => {
  state.setDraft('start', '2024-02-28'); open(); key('ArrowRight');
  expect(document.activeElement.dataset.calendarDay).toBe('2024-02-29'); key('ArrowRight');
  expect(document.activeElement.dataset.calendarDay).toBe('2024-03-01'); key('ArrowUp');
  expect(document.activeElement.dataset.calendarDay).toBe('2024-02-23'); key('ArrowDown');
  key('Home'); expect(document.activeElement.dataset.calendarDay).toBe('2024-02-26');
  key('End'); expect(document.activeElement.dataset.calendarDay).toBe('2024-03-03');
  change('[data-calendar-year]', '1900'); change('[data-calendar-month]', '2');
  expect(root.querySelectorAll('[data-calendar-day]')).toHaveLength(28);
  change('[data-calendar-year]', '2000'); expect(root.querySelectorAll('[data-calendar-day]')).toHaveLength(29);
  change('[data-calendar-month]', '12'); root.querySelector('[data-calendar-move="1"]').click();
  expect(document.activeElement.dataset.calendarDay).toBe('2001-01-01');
  root.querySelector('[data-calendar-move="-1"]').click(); expect(document.activeElement.dataset.calendarDay).toBe('2000-12-01');
  change('[data-calendar-year]', '0'); expect(root.querySelector('[data-calendar-year]').getAttribute('aria-invalid')).toBe('true');
  const year = root.querySelector('[data-calendar-year]'); year.value = '2030'; year.focus(); key('Enter');
  expect(document.activeElement.dataset.calendarDay).toBe('2030-12-01'); expect(refresh).not.toHaveBeenCalled();
});

it('clears one endpoint, cancels outside, switches endpoints and removes listeners', () => {
  state.setDraft('start', '2026-06-11'); state.setDraft('end', '2026-06-12'); state.apply();
  open('end'); root.querySelector('[data-calendar-clear]').click();
  expect(state.getSnapshot()).toMatchObject({ draft: { start: '2026-06-11', end: '' }, applied: { end: '2026-06-12' } });
  open(); open('end'); expect(root.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); expect(root.querySelector('[role="dialog"]')).toBeNull();
  open(); open(); expect(root.querySelector('[role="dialog"]')).toBeNull();
  open(); dispose(); open(); expect(root.querySelector('[role="dialog"]')).toBeNull();
});

it('closes on rerender, restores stable opener and preserves drafts', async () => {
  const router = await import('../src/router.js');
  const view = await import('../src/features/schedule-date-range/view.js');
  const { withScheduleDateFocus } = await import('../src/features/schedule-date-range/controller.js');
  router.addRoute(/^\/schedule$/, () => view.renderDateControls(state.getSnapshot(), '2026-06-11'));
  state.setDraft('end', 'unfinished'); open('end');
  await router.handleRoute(withScheduleDateFocus({ preserveScroll: true }));
  expect(root.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement.dataset.calendarOpen).toBe('end');
  expect(state.getSnapshot().draft.end).toBe('unfinished');
  open(); router.addRoute(/^\/teams$/, () => '<p>Teams</p>'); location.hash = '#/teams'; await router.handleRoute();
  expect(root.querySelector('[role="dialog"]')).toBeNull(); expect(state.getSnapshot().draft.end).toBe('');
});

it('uses no wall-clock fallback and keeps empty snapshot navigation valid', async () => {
  root.querySelector('[data-date-form]').dataset.firstDate = ''; open();
  expect(document.activeElement.dataset.calendarDay).toBe('0001-01-01');
  const { monthDays, weekday, shiftDay } = await import('../src/features/schedule-date-range/calendar.js');
  expect(monthDays(2026, 4)).toBe(30); expect(weekday(2026, 6, 11)).toBe(3);
  expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  expect(shiftDay('2025-12-31', 1)).toBe('2026-01-01');
});
