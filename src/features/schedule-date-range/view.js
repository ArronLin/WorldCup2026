import { validCalendarBounds } from './calendar.js';
import { t } from '../../i18n.js';

function dateText(value) {
  const [year, month, day] = value.split('-');
  return t('schedule.date.value', { year: Number(year), month: t(`schedule.date.month.${month}`), day: Number(day) });
}

function summary({ start, end }) {
  if (start && end) return t('schedule.date.range', { start: dateText(start), end: dateText(end) });
  if (start) return t('schedule.date.from', { date: dateText(start) });
  if (end) return t('schedule.date.until', { date: dateText(end) });
  return t('schedule.date.all');
}

export function renderDateControls(snapshot, bounds = null) {
  const available = validCalendarBounds(bounds);
  return `<form class="schedule-dates" data-date-form data-first-date="${available ? bounds.min : ''}" data-last-date="${available ? bounds.max : ''}" novalidate>
    <div class="schedule-date-fields">
      ${['start', 'end'].map(field => `<div class="schedule-date-field">
        <label for="schedule-date-${field}">${t(`schedule.date.${field}`)}</label>
        <input id="schedule-date-${field}" type="text" data-date-field="${field}" data-date-focus="schedule-date-${field}" aria-describedby="schedule-date-format schedule-date-${field}-error" aria-invalid="false" autocomplete="off" spellcheck="false">
        <button class="filter-btn schedule-calendar-open" type="button" data-calendar-open="${field}" data-date-focus="schedule-calendar-${field}" ${available ? '' : 'disabled aria-describedby="schedule-calendar-unavailable"'} aria-haspopup="dialog" aria-expanded="false" aria-controls="schedule-calendar">${t(`schedule.calendar.${field}`)}</button>
        <p class="schedule-date-error" id="schedule-date-${field}-error" hidden></p>
      </div>`).join('')}
      <div class="schedule-date-actions">
        <button class="filter-btn" type="submit" data-date-action="apply" data-date-focus="schedule-date-apply">${t('schedule.date.apply')}</button>
        <button class="filter-btn" type="button" data-date-action="clear" data-date-focus="schedule-date-clear">${t('schedule.date.clear')}</button>
      </div>
    </div>
    <p class="schedule-date-help" id="schedule-calendar-unavailable" data-calendar-unavailable ${available ? 'hidden' : ''}>${t('schedule.calendar.unavailable')}</p>
    <p class="schedule-date-help" id="schedule-date-format">${t('schedule.date.format')}</p>
    <p class="schedule-date-help">${t('schedule.date.basis')}</p>
    <p class="schedule-date-summary" data-date-summary>${summary(snapshot.applied)}</p>
    <p class="schedule-date-pending" data-date-pending hidden>${t('schedule.date.pending')}</p>
  </form>`;
}

export function syncDateControls(root, snapshot) {
  for (const field of ['start', 'end']) {
    const input = root.querySelector(`[data-date-field="${field}"]`);
    if (!input) continue;
    if (input.value !== snapshot.draft[field]) input.value = snapshot.draft[field];
    const code = snapshot.errors?.[field];
    input.setAttribute('aria-invalid', String(Boolean(code)));
    const error = root.querySelector(`#schedule-date-${field}-error`);
    error.textContent = code ? t(`schedule.date.${code === 'reversed-range' ? 'reversed' : 'invalid'}`) : '';
    error.hidden = !code;
  }
  const applied = root.querySelector('[data-date-summary]');
  if (applied) applied.textContent = summary(snapshot.applied);
  const pending = root.querySelector('[data-date-pending]');
  if (pending) {
    pending.textContent = t('schedule.date.pending');
    pending.hidden = !snapshot.dirty;
  }
}
