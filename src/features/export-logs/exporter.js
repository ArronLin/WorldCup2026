import { zip, strToU8 } from 'fflate';

/** 在进入内存和导出前使用同一规则遮盖凭据。 */
export function maskCredentials(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/Bearer \S+/gi, '[REDACTED]').replace(/sk-\S+/g, '[REDACTED]');
}

export function serializeEntries(entries) {
  return (entries ?? []).map(entry => JSON.stringify(entry)).join('\n');
}

export function buildFilename(now) {
  const pad = n => String(n).padStart(2, '0');
  return `wc2026-logs-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
}

// 复制所有可序列化字段，包括嵌套请求元数据；不调用不可信的 toJSON。
function maskValue(value, ancestors = new Set()) {
  if (typeof value === 'string') return maskCredentials(value);
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) throw new Error('cyclic metadata');
  ancestors.add(value);
  try {
    const result = Array.isArray(value) ? [] : Object.create(null);
    for (const key of Object.keys(value)) result[key] = maskValue(value[key], ancestors);
    return result;
  } finally { ancestors.delete(value); }
}

function compress(files, signal) {
  return new Promise((resolve, reject) => {
    let terminate;
    const abort = () => { terminate?.(); reject(new Error('aborted')); };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, {once:true});
    try {
      terminate = zip(files, (error, bytes) => {
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(bytes);
      });
    } catch (error) { signal?.removeEventListener('abort', abort); reject(error); }
  });
}

/** 仅导出传入的日志快照，不读取 localStorage 或发送网络请求。 */
export async function exportLogs(entries, options = {}) {
  const {signal} = options;
  if (signal?.aborted) return {ok:false, reason:'aborted'};
  const now = options.now?.() ?? new Date();
  let masked;
  try { masked = entries.map(entry => maskValue(entry)); }
  catch { return {ok:false, reason:'maskError'}; }
  let url, anchor;
  try {
    const bytes = await compress({'system-logs.jsonl':strToU8(serializeEntries(masked))}, signal);
    if (signal?.aborted) return {ok:false, reason:'aborted'};
    url = URL.createObjectURL(new Blob([bytes], {type:'application/zip'}));
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.addEventListener('click', event => event.stopPropagation());
    anchor.download = buildFilename(now);
    document.body.appendChild(anchor);
    anchor.click();
    return {ok:true};
  } catch {
    return {ok:false, reason:signal?.aborted ? 'aborted' : 'zipError'};
  } finally {
    anchor?.remove();
    if (url) { try { URL.revokeObjectURL(url); } catch { /* 下载已触发 */ } }
  }
}
