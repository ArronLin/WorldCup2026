import { createCalendar } from './calendar.js';
import { handleRoute, subscribeRouteLifecycle } from '../../router.js';
import { scheduleDateState } from './state.js';
import { syncDateControls } from './view.js';

const roots = new WeakMap();
const isSchedule = path => /^\/schedule\/?$/.test(path);

function identity(element, root) {
  if (!element || element === document.body || element === document.documentElement) return null;
  const calendarField = element.closest?.('[data-calendar-field]')?.dataset.calendarField;
  if (calendarField) return { kind: 'key', key: `schedule-calendar-${calendarField}` };
  const key = element.dataset?.dateFocus || element.dataset?.followFocus || element.dataset?.routeFocus;
  if (key) return { kind: 'key', key };
  return root.contains(element) ? null : { kind: 'element', element };
}

export function initScheduleDateRange({ root = document.getElementById('app'), state = scheduleDateState, refresh = handleRoute, subscribe = subscribeRouteLifecycle } = {}) {
  if (!root) return () => {};
  if (roots.has(root)) return roots.get(root).dispose;
  let version = 0, epoch = 0, latest = null, restoring = false, disposed = false;
  const record = target => {
    if (target) { latest = target; version++; }
  };
  const quietCommit = () => {
    restoring = true;
    queueMicrotask(() => { restoring = false; });
  };
  const wrap = (options, defaultTarget) => {
    if (!isSchedule(location.hash.slice(1))) return options;
    const capturedVersion = version, capturedEpoch = epoch;
    const fallback = defaultTarget || (options.focusKey ? { kind: 'key', key: options.focusKey } : identity(document.activeElement, root));
    return { ...options, resolveFocusTarget: () => {
      if (epoch !== capturedEpoch || !isSchedule(location.hash.slice(1))) return { target: null, fallback: null };
      quietCommit();
      return { target: version > capturedVersion ? latest : fallback, fallback };
    } };
  };
  const focusin = event => {
    if (!restoring && isSchedule(location.hash.slice(1))) record(identity(event.target, root));
  };
  const sync = () => syncDateControls(root, state.getSnapshot());
  const calendar = createCalendar(root, state, sync);
  const input = event => {
    const field = event.target.dataset.dateField;
    if (field !== 'start' && field !== 'end') return;
    state.setDraft(field, event.target.value);
    record(identity(event.target, root));
    sync();
  };
  const submit = event => {
    if (!event.target.matches('[data-date-form]')) return;
    event.preventDefault();
    calendar.close();
    for (const field of ['start', 'end']) state.setDraft(field, event.target.querySelector(`[data-date-field="${field}"]`).value);
    const result = state.apply();
    sync();
    const target = { kind: 'key', key: `schedule-date-${result.ok ? 'apply' : result.firstInvalid}` };
    record(target);
    void refresh(wrap({ preserveScroll: true }, target));
  };
  const unsubscribe = subscribe(event => {
    const status = document.getElementById('scheduleDateStatus');
    if (event.type === 'rendered' || (event.type === 'navigation' && !isSchedule(event.to))) calendar.close();
    if (event.type === 'navigation' && isSchedule(event.from) && !isSchedule(event.to)) {
      state.discardDraft(); epoch++; latest = null;
      if (status) status.textContent = '';
    }
    if (event.type === 'rendered') {
      quietCommit();
      if (isSchedule(event.path)) sync();
      if (status) status.textContent = isSchedule(event.path) ? root.querySelector('[data-follow-count]')?.textContent || '' : '';
    }
  });
  const click = event => {
    if (!event.target.closest('[data-date-action="clear"]')) return;
    calendar.close();
    state.clear();
    sync();
    const target = { kind: 'key', key: 'schedule-date-clear' };
    record(target);
    void refresh(wrap({ preserveScroll: true }, target));
  };
  root.addEventListener('input', input);
  root.addEventListener('submit', submit);
  root.addEventListener('click', click);
  document.addEventListener('focusin', focusin);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    calendar.dispose();
    root.removeEventListener('input', input);
    root.removeEventListener('submit', submit);
    root.removeEventListener('click', click);
    document.removeEventListener('focusin', focusin);
    epoch++;
    unsubscribe();
    if (roots.get(root)?.dispose === dispose) roots.delete(root);
  };
  roots.set(root, { dispose, wrap });
  return dispose;
}
export function withScheduleDateFocus(options = {}, defaultTarget) {
  return roots.get(document.getElementById('app'))?.wrap(options, defaultTarget) || options;
}
