import { t } from '../../i18n.js';
import { isValidISODate } from './date-range.js';

const pad = (n, width = 2) => String(n).padStart(width, '0');
export const validCalendarBounds = bounds => Boolean(bounds && isValidISODate(bounds.min) && isValidISODate(bounds.max) && bounds.min <= bounds.max);
export function getCalendarBounds(matches) {
  if (!matches.length) return null;
  const dates = matches.map(match => match.date).sort();
  return { min: dates[0], max: dates[dates.length - 1] };
}
export const isoDate = (year, month, day) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
export function monthDays(year, month) {
  return month === 2 ? (year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}
export function weekday(year, month, day = 1) {
  const y = year - 1;
  let days = y * 365 + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
  for (let m = 1; m < month; m++) days += monthDays(year, m);
  return (days + day - 1) % 7; // Monday = 0, proleptic Gregorian calendar.
}
export function shiftDay(value, offset) {
  let [y, m, d] = value.split('-').map(Number);
  d += offset;
  while (d < 1) { if (--m < 1) { m = 12; y--; } if (y < 1) return '0001-01-01'; d += monthDays(y, m); }
  while (d > monthDays(y, m)) { d -= monthDays(y, m); if (++m > 12) { m = 1; y++; } if (y > 9999) return '9999-12-31'; }
  return isoDate(y, m, d);
}

// Transient popup state belongs to the current DOM, never to the date filter.
export function createCalendar(root, state, sync) {
  let popup = null, field = null, selected = '', cursor = '';
  let bounds = null;
  const clamp = date => date < bounds.min ? bounds.min : date > bounds.max ? bounds.max : date;
  const allowedMonth = (year, month) => isoDate(year, month, monthDays(year, month)) >= bounds.min && isoDate(year, month, 1) <= bounds.max;
  const trigger = () => root.querySelector(`[data-calendar-open="${field}"]`);
  const close = (restore = false) => {
    if (!popup) return;
    popup.remove(); popup = null;
    trigger()?.setAttribute('aria-expanded', 'false');
    if (restore) trigger()?.focus({ preventScroll: true });
  };
  const focusDay = () => popup?.querySelector(`[data-calendar-day="${cursor}"]`)?.focus({ preventScroll: true });
  const render = () => {
    const [year, month] = cursor.split('-').map(Number);
    const title = t('schedule.calendar.heading', { year, month: t(`schedule.date.month.${pad(month)}`) });
    popup.innerHTML = `<h2 id="schedule-calendar-title">${t(`schedule.calendar.${field}`)}</h2>
      <div class="schedule-calendar-nav">
        <button type="button" data-calendar-move="-1" aria-label="${t('schedule.calendar.previous')}" ${cursor.slice(0,7) === bounds.min.slice(0,7) ? 'disabled' : ''}>‹</button>
        <label>${t('schedule.calendar.year')}<input data-calendar-year aria-describedby="schedule-calendar-error" aria-invalid="false" type="number" min="${Number(bounds.min.slice(0,4))}" max="${Number(bounds.max.slice(0,4))}" step="1" value="${year}"></label>
        <label>${t('schedule.calendar.month')}<select data-calendar-month>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${allowedMonth(year, i + 1) ? '' : 'disabled'} ${month === i + 1 ? 'selected' : ''}>${t(`schedule.date.month.${pad(i + 1)}`)}</option>`).join('')}</select></label>
        <button type="button" data-calendar-move="1" aria-label="${t('schedule.calendar.next')}" ${cursor.slice(0,7) === bounds.max.slice(0,7) ? 'disabled' : ''}>›</button>
      </div>
      <p id="schedule-calendar-error" data-calendar-error role="alert" hidden>${t('schedule.calendar.outside')}</p>
      <p class="schedule-calendar-month" aria-live="polite">${t('schedule.calendar.heading', { year, month: t(`schedule.date.month.${pad(month)}`) })}</p>
      <div class="schedule-calendar-grid" role="group" aria-label="${title}">
        ${Array.from({ length: 7 }, (_, i) => `<span aria-hidden="true">${t(`schedule.calendar.week.${i}`)}</span>`).join('')}
        ${'<span aria-hidden="true"></span>'.repeat(weekday(year, month))}
        ${Array.from({ length: monthDays(year, month) }, (_, i) => {
          const date = isoDate(year, month, i + 1);
          return `<button type="button" data-calendar-day="${date}" ${date < bounds.min || date > bounds.max ? 'disabled' : ''} tabindex="${date === cursor ? 0 : -1}" aria-pressed="${date === selected}" aria-label="${t('schedule.date.value', { year, month: t(`schedule.date.month.${pad(month)}`), day: i + 1 })}">${i + 1}</button>`;
        }).join('')}
      </div>
      <div class="schedule-calendar-actions"><button type="button" data-calendar-clear>${t('schedule.calendar.clear')}</button><button type="button" data-calendar-close>${t('schedule.calendar.close')}</button></div>`;
  };
  const open = target => {
    close(); field = target.dataset.calendarOpen;
    const form = root.querySelector('[data-date-form]');
    bounds = { min: form?.dataset.firstDate, max: form?.dataset.lastDate };
    if (target.disabled || !validCalendarBounds(bounds)) return;
    const snapshot = state.getSnapshot();
    selected = snapshot.draft[field];
    cursor = clamp([selected, snapshot.applied[field], bounds.min].find(isValidISODate));
    popup = document.createElement('section');
    popup.className = 'schedule-calendar'; popup.id = 'schedule-calendar';
    popup.setAttribute('popover', 'manual');
    popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-labelledby', 'schedule-calendar-title');
    // Map every popup focus target to the stable opener on route/language refresh.
    popup.dataset.calendarField = field;
    target.closest('.schedule-date-field').append(popup);
    popup.showPopover?.();
    target.setAttribute('aria-expanded', 'true'); render(); focusDay();
  };
  const click = event => {
    const opener = event.target.closest('[data-calendar-open]');
    if (opener) { if (popup && field === opener.dataset.calendarOpen) close(true); else open(opener); return; }
    if (!popup?.contains(event.target)) return;
    const day = event.target.closest('[data-calendar-day]');
    if (day && (!isValidISODate(day.dataset.calendarDay) || day.dataset.calendarDay < bounds.min || day.dataset.calendarDay > bounds.max)) return;
    if (day || event.target.closest('[data-calendar-clear]')) {
      state.setDraft(field, day?.dataset.calendarDay || ''); sync(); close(true); return;
    }
    if (event.target.closest('[data-calendar-close]')) { close(true); return; }
    const move = event.target.closest('[data-calendar-move]');
    if (move && !move.disabled) {
      let [y, m] = cursor.split('-').map(Number); m += Number(move.dataset.calendarMove);
      if (m < 1) { y--; m = 12; } if (m > 12) { y++; m = 1; }
      if (!allowedMonth(y, m)) return;
      cursor = clamp(isoDate(y, m, 1)); render(); focusDay();
    }
  };
  const change = event => {
    if (!popup?.contains(event.target) || !event.target.matches('[data-calendar-year], [data-calendar-month]')) return;
    const yearInput = popup.querySelector('[data-calendar-year]');
    const year = Number(yearInput.value), month = Number(popup.querySelector('[data-calendar-month]').value);
    if (!Number.isInteger(year) || year < 1 || year > 9999 || !allowedMonth(year, month)) {
      yearInput.setAttribute('aria-invalid', 'true'); popup.querySelector('[data-calendar-error]').hidden = false; return;
    }
    cursor = clamp(isoDate(year, month, 1)); render(); focusDay();
  };
  const keydown = event => {
    if (!popup) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (!popup.contains(event.target)) return;
    // Year entry must not submit the enclosing filter form.
    if (event.key === 'Enter' && event.target.matches('[data-calendar-year]')) { event.preventDefault(); change(event); return; }
    if (!event.target.dataset.calendarDay) return;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let offset = offsets[event.key];
    const [y, m, d] = cursor.split('-').map(Number);
    if (event.key === 'Home') offset = -weekday(y, m, d);
    if (event.key === 'End') offset = 6 - weekday(y, m, d);
    if (offset === undefined) return;
    event.preventDefault(); cursor = clamp(shiftDay(cursor, offset)); render(); focusDay();
  };
  const outside = event => { if (popup && !popup.contains(event.target) && !event.target.closest('[data-calendar-open]')) close(true); };
  root.addEventListener('click', click); root.addEventListener('change', change); root.addEventListener('keydown', keydown);
  document.addEventListener('pointerdown', outside);
  return { close, dispose() { close(); root.removeEventListener('click', click); root.removeEventListener('change', change); root.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', outside); } };
}
