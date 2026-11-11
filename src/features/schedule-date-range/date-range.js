// Calendar dates are values, not instants. Never normalize through Date/timezones.
export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function validateDateRange({ start, end }) {
  const errors = {
    start: start === '' || isValidISODate(start) ? null : 'invalid-date',
    end: end === '' || isValidISODate(end) ? null : 'invalid-date',
  };
  if (!errors.start && !errors.end && start && end && start > end) errors.end = 'reversed-range';
  if (errors.start || errors.end) return { ok: false, errors, firstInvalid: errors.start ? 'start' : 'end' };
  return { ok: true, range: { start, end } };
}

export function filterMatchesByDate(matches, { start, end }) {
  return matches.filter(match => (!start || match.date >= start) && (!end || match.date <= end));
}
