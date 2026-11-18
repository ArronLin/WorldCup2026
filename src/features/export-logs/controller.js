import { t } from '../../i18n.js';
import { exportLogs } from './exporter.js';
import { logCollector } from './collector.js';

const bindings = new WeakMap();
export function initExportButton(buttonEl, statusEl, options = {}) {
  bindings.get(buttonEl)?.();
  const collector = options.collector ?? logCollector;
  let active = null;
  let disposed = false;
  function clear(run) { clearInterval(run.progress); clearTimeout(run.timeout); }
  async function handleClick() {
    if (disposed || active || buttonEl.disabled) return;
    const run = {abort:new AbortController()};
    active = run;
    buttonEl.disabled = true;
    statusEl.textContent = t('exportLogs.exporting');
    run.progress = setInterval(() => { statusEl.textContent = t('exportLogs.exporting'); }, Math.min(options.progressInterval ?? 1500,2000));
    run.timeout = setTimeout(() => {
      clear(run); active = null; run.abort.abort();
      statusEl.textContent = t('exportLogs.timeout'); buttonEl.disabled = false;
    }, options.timeout ?? 60000);
    let result;
    try { result = await exportLogs(collector.getEntries(), {signal:run.abort.signal}); }
    catch { result = {ok:false,reason:'zipError'}; }
    if (disposed || active !== run) return;
    clear(run); active = null;
    statusEl.textContent = result.ok ? t('exportLogs.done')
      : result.reason === 'maskError' ? t('exportLogs.maskError')
      : t('exportLogs.errorPrefix') + t('exportLogs.zipError');
    buttonEl.disabled = false;
  }
  function dispose() {
    disposed = true;
    buttonEl.removeEventListener('click', handleClick);
    if (active) { clear(active); active.abort.abort(); active = null; }
    bindings.delete(buttonEl);
  }
  buttonEl.addEventListener('click', handleClick);
  bindings.set(buttonEl, dispose);
  return dispose;
}
