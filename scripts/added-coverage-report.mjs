// System fonts and embedded assets keep the report usable as a single offline file.
export const styles = `
:root{color-scheme:light;--bg:#f5f7fb;--surface:#fff;--ink:#17243b;--muted:#52617a;--border:#dce3ee;--primary:#2454bd;--good:#14623a;--good-bg:#e7f5ec;--bad:#a92232;--bad-bg:#fff0f1;--radius:14px}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}main{max-width:1380px;margin:auto;padding:36px 32px 60px}h1,h2,h3,p{margin:0}h1{font-size:34px;letter-spacing:-1px}h2{font-size:18px}h3{font-size:16px;overflow-wrap:anywhere}button,input,select{font:inherit;color:inherit}button,select,input[type=checkbox]{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--primary);outline-offset:3px}[hidden]{display:none!important}.eyebrow{color:var(--primary);font-size:12px;letter-spacing:1.4px;font-weight:750}.subtitle{color:var(--muted);display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:8px}.badge{display:inline-block;font-size:13px;font-weight:650;border-radius:7px;padding:3px 10px;white-space:nowrap}.good{color:var(--good);background:var(--good-bg)}.bad{color:var(--bad);background:var(--bad-bg)}.neutral{background:#edf0f6;color:var(--muted)}
.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:26px 0 18px}.metrics article{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px}.metrics h2{color:var(--muted);font-size:14px;font-weight:550}.metrics strong{display:block;font-size:40px;letter-spacing:-1.4px;line-height:1.4;margin:7px 0}.metrics p{font-size:13px;color:var(--muted)}.explanation{border-left:3px solid var(--primary);background:#eaf0fc;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:28px}.explanation p{margin-top:10px}summary{cursor:pointer;font-weight:600;min-height:28px}.section-heading{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px}.section-heading p{color:var(--muted);font-size:13px}.files{margin-bottom:30px}.toolbar{display:flex;gap:22px;align-items:end;flex-wrap:wrap;margin-bottom:14px}.search-label{display:flex;flex-direction:column;gap:5px;font-size:13px;flex:1;min-width:min(300px,100%)}input[type=search]{border:1px solid #b8c5d9;border-radius:8px;background:#fff;padding:10px 13px;width:100%;min-height:44px}.check{display:flex;align-items:center;gap:9px;min-height:44px;font-size:14px}input[type=checkbox]{width:18px;height:18px;accent-color:var(--primary)}
.table-scroll{overflow-x:auto;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)}table{border-collapse:collapse;width:100%}.file-table th{background:#edf1f8;color:var(--muted);text-align:left;font-size:13px;font-weight:600;padding:13px 16px;white-space:nowrap}.file-table td{border-top:1px solid var(--border);padding:6px 16px;font-variant-numeric:tabular-nums}.file-table button{background:transparent;border:0;text-align:left;min-height:44px;padding:4px 0;color:var(--primary);font:13px/1.5 ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.file-table button:hover{text-decoration:underline}.file-table tr:has([aria-current=true]){background:#f0f5ff}.file-table [aria-current=true]{font-weight:750}.file-table td:first-child{width:58%}#file-empty,.line-empty,#source-placeholder{padding:20px;color:var(--muted);background:var(--surface);border-radius:8px}
select{border:1px solid #b8c5d9;border-radius:7px;background:#fff;padding:8px;min-height:44px}.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-bottom:14px}.legend span{padding:3px 8px;border-radius:4px}.source{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}.source-heading{padding:18px 20px;border-bottom:1px solid var(--border)}.source-heading p{font-size:13px;color:var(--muted);margin-top:4px}.code-scroll{overflow-x:auto;max-height:650px;overflow-y:auto}.code{width:max-content;min-width:100%;font:12px/1.8 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}.code td{vertical-align:top;padding:0 10px}.code pre{margin:0;font:inherit;white-space:pre;tab-size:2;padding-right:20px}.line-number{min-width:50px;text-align:right;border-right:1px solid var(--border);color:var(--muted);user-select:none}.line-number a{color:inherit;text-decoration:none}.line-status{min-width:90px;white-space:nowrap;user-select:none;font-family:system-ui,sans-serif;font-size:11px}.code-line.covered{background:var(--good-bg)}.covered .line-status{color:var(--good)}.code-line.uncovered{background:var(--bad-bg)}.uncovered .line-status{color:var(--bad);font-weight:700}.context .line-status{color:#68778e}.code-line:target{outline:2px solid var(--primary);outline-offset:-2px}.file-meta{padding:12px 20px;background:#fafbfd;color:var(--muted);font-size:12px}code{overflow-wrap:anywhere}footer{margin-top:28px;padding-top:18px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}footer p+ p{margin-top:8px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.skip{position:absolute;left:12px;top:-60px;background:#fff;padding:12px;z-index:2}.skip:focus{top:12px}noscript{display:block;padding:16px}
@media(max-width:700px){main{padding:24px 16px 40px}h1{font-size:28px}.metrics{grid-template-columns:1fr;gap:10px}.metrics article{padding:15px 18px}.metrics strong{font-size:30px}.file-table th,.file-table td{padding-left:10px;padding-right:10px}.toolbar{gap:8px}.code-scroll{max-height:520px}.file-table td:first-child{min-width:180px}}
@media print{body{background:#fff}main{max-width:none;padding:0}.toolbar,.skip{display:none}.code-scroll{max-height:none;overflow:visible}footer{break-inside:avoid}}
`;

export function initReport() {
  const rows = [...document.querySelectorAll('[data-file-row]')];
  const sources = [...document.querySelectorAll('[data-source]')];
  const search = document.querySelector('#file-search');
  const all = document.querySelector('#show-all');
  const mode = document.querySelector('#line-mode');
  function filterFiles() {
    const query = search.value.trim().toLowerCase();
    for (const row of rows) row.hidden = (!all.checked && Number(row.dataset.added) === 0) || !row.dataset.fileRow.toLowerCase().includes(query);
    const visible = rows.filter(row => !row.hidden).length;
    document.querySelector('#file-count').textContent = `显示 ${visible} / ${rows.length} 个文件`;
    document.querySelector('#file-empty').hidden = visible !== 0;
  }
  function filterLines() {
    for (const source of sources) {
      const lines = [...source.querySelectorAll('[data-line]')];
      for (const line of lines) line.hidden = mode.value === 'added' ? line.classList.contains('context') : mode.value === 'uncovered' ? !line.classList.contains('uncovered') : false;
      source.querySelector('.line-empty').hidden = lines.some(line => !line.hidden);
    }
  }
  document.querySelector('.file-table').addEventListener('click', event => {
    const button = event.target.closest('button[data-select]');
    if (!button) return;
    for (const row of rows) row.querySelector('button').removeAttribute('aria-current');
    button.setAttribute('aria-current', 'true');
    for (const source of sources) source.hidden = source.id !== `source-${button.dataset.select}`;
    const active = sources.find(source => !source.hidden);
    document.querySelector('#source-placeholder').hidden = true;
    filterLines();
    active.querySelector('h3').focus({ preventScroll: true });
    document.querySelector('#source-view').scrollIntoView?.({ block: 'start' });
  });
  search.addEventListener('input', filterFiles);
  all.addEventListener('change', filterFiles);
  mode.addEventListener('change', filterLines);
  // A copied line link also restores its file and filter context.
  function revealHash() {
    const target = document.getElementById(location.hash.slice(1));
    const source = target?.closest('[data-source]');
    if (!source) return;
    all.checked = true; search.value = ''; filterFiles(); mode.value = 'all';
    document.querySelector(`[data-select="${source.id.slice(7)}"]`)?.click();
    target.scrollIntoView?.({ block: 'center' });
  }
  window.addEventListener('hashchange', revealHash);
  revealHash();
}
