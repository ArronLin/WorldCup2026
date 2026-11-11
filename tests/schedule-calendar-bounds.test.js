// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prepareDom } from './fixtures/follow-dom.js';
let root, state, view, dispose;
const bounds = { min: '2026-06-11', max: '2026-07-19' };
const mount = value => { root.innerHTML = view.renderDateControls(state.getSnapshot(), value); view.syncDateControls(root, state.getSnapshot()); };
const open = () => root.querySelector('[data-calendar-open="start"]').click();
const key = name => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
const day = value => root.querySelector(`[data-calendar-day="${value}"]`);
beforeEach(async () => {
  vi.resetModules(); await prepareDom(); location.hash = '#/schedule';
  root = document.querySelector('#app');
  state = (await import('../src/features/schedule-date-range/state.js')).scheduleDateState;
  view = await import('../src/features/schedule-date-range/view.js'); mount(bounds);
  dispose = (await import('../src/features/schedule-date-range/controller.js')).initScheduleDateRange({root, state, refresh: vi.fn()});
});
afterEach(() => { dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('disables outside dates and clamps keyboard without modifying handwritten drafts', () => {
  state.setDraft('start', '0001-01-01'); open();
  expect(document.activeElement.dataset.calendarDay).toBe(bounds.min);
  expect(day('2026-06-10').disabled).toBe(true); expect(day(bounds.min).disabled).toBe(false);
  key('Home'); key('ArrowLeft'); key('ArrowUp'); expect(document.activeElement.dataset.calendarDay).toBe(bounds.min);
  day('2026-06-10').dispatchEvent(new MouseEvent('click', {bubbles:true}));
  expect(state.getSnapshot().draft.start).toBe('0001-01-01');
  key('Escape'); state.setDraft('start', '9999-12-31'); open();
  expect(document.activeElement.dataset.calendarDay).toBe(bounds.max);
  expect(day('2026-07-20').disabled).toBe(true); key('End'); key('ArrowRight'); key('ArrowDown');
  expect(document.activeElement.dataset.calendarDay).toBe(bounds.max);
  key('Escape'); expect(state.getSnapshot().draft.start).toBe('9999-12-31'); expect(state.apply().ok).toBe(true);
});
it('limits month navigation and rejects out-of-range year without applying', () => {
  open(); expect(root.querySelector('[data-calendar-move="-1"]').disabled).toBe(true);
  root.querySelector('[data-calendar-move="1"]').click();
  expect(document.activeElement.dataset.calendarDay).toBe('2026-07-01');
  expect(root.querySelector('[data-calendar-move="1"]').disabled).toBe(true);
  const year = root.querySelector('[data-calendar-year]'); year.value = '2025'; year.dispatchEvent(new Event('change',{bubbles:true}));
  expect(year.getAttribute('aria-invalid')).toBe('true'); expect(root.querySelector('[data-calendar-error]').hidden).toBe(false);
  expect(state.getSnapshot().draft.start).toBe(''); year.value = '2026'; year.dispatchEvent(new Event('change',{bubbles:true}));
  expect(root.querySelector('[data-calendar-error]').hidden).toBe(true);
  root.querySelector('[data-calendar-move="-1"]').click(); expect(document.activeElement.dataset.calendarDay).toBe(bounds.min);
  expect([...root.querySelector('[data-calendar-month]').options].filter(x=>!x.disabled).map(x=>x.value)).toEqual(['6','7']);
});
it.each([null, {min:'bad',max:'2026-07-19'}, {min:'2026-07-19',max:'2026-06-11'}])('disables empty or invalid bounds: %j', value => {
  mount(value); expect(root.querySelector('[data-calendar-open="start"]').disabled).toBe(true);
  expect(root.querySelector('[data-calendar-open="end"]').disabled).toBe(true);
  expect(root.querySelector('[data-calendar-unavailable]').hidden).toBe(false);
  open(); expect(root.querySelector('.schedule-calendar')).toBeNull();
  state.setDraft('start','2024-02-29'); expect(state.apply().ok).toBe(true);
});
it('supports a single-day snapshot and in-range days without matches', () => {
  mount({min:bounds.min,max:bounds.min}); open();
  expect(root.querySelectorAll('[data-calendar-day]:not(:disabled)')).toHaveLength(1);
  key('End'); expect(document.activeElement.dataset.calendarDay).toBe(bounds.min); day(bounds.min).click();
  expect(state.getSnapshot().draft.start).toBe(bounds.min);
  mount(bounds); open(); day('2026-06-15').click(); expect(state.getSnapshot().draft.start).toBe('2026-06-15');
});
it('derives bounds from unsorted complete data without changing it', async () => {
  const { getCalendarBounds } = await import('../src/features/schedule-date-range/calendar.js');
  const matches = [{date:bounds.max},{date:bounds.min},{date:'2026-07-01'}];
  expect(getCalendarBounds(matches)).toEqual(bounds); expect(matches[0].date).toBe(bounds.max);
  expect(getCalendarBounds([])).toBeNull();
});
it('reopening after a new snapshot uses fresh bounds without overwriting applied dates', () => {
  state.setDraft('start',bounds.min); state.apply();
  open(); key('Escape'); mount({min:'2026-07-01',max:'2026-07-02'}); open();
  expect(document.activeElement.dataset.calendarDay).toBe('2026-07-01'); key('Escape');
  expect(state.getSnapshot()).toMatchObject({draft:{start:bounds.min},applied:{start:bounds.min}});
});
