// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { exportLogs, maskCredentials, serializeEntries, buildFilename } from '../src/features/export-logs/exporter.js';
let blob;
function downloadSetup() {
  vi.stubGlobal('Blob', class { constructor(parts) { this.bytes = parts[0]; } });
  vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:test'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('遮盖嵌套请求元数据并生成真实 ZIP', async () => {
  const click = downloadSetup();
  const result = await exportLogs([{message:'hello', metadata:{headers:{Authorization:'Bearer secret'}, key:'sk-private'}}]);
  expect(result.ok).toBe(true);
  const files = unzipSync(blob.bytes);
  expect(Object.keys(files)).toEqual(['system-logs.jsonl']);
  expect(JSON.parse(strFromU8(files['system-logs.jsonl'])).metadata).toEqual({headers:{Authorization:'[REDACTED]'}, key:'[REDACTED]'});
  expect(click).toHaveBeenCalledOnce();
});
it('已取消的导出不得下载', async () => {
  const click = downloadSetup(); const controller = new AbortController(); controller.abort();
  expect((await exportLogs([], {signal:controller.signal})).ok).toBe(false);
  expect(click).not.toHaveBeenCalled();
});
it('空日志与文件名及资源释放', async () => {
  downloadSetup(); expect(await exportLogs([])).toEqual({ok:true});
  expect(unzipSync(blob.bytes)['system-logs.jsonl']).toHaveLength(0);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  expect(buildFilename(new Date(2026,5,11,1,2,3))).toBe('wc2026-logs-20260611-010203.zip');
  expect(serializeEntries([])).toBe(''); expect(maskCredentials(null)).toBe(null);
});
it('遮盖异常中止且不下载', async () => {
  const click=downloadSetup(); const entry={get message(){throw Error('bad');}};
  expect(await exportLogs([entry])).toEqual({ok:false,reason:'maskError'}); expect(click).not.toHaveBeenCalled();
});
import fc from 'fast-check';
import { createLogCollector } from '../src/features/export-logs/collector.js';
const token = fc.array(fc.constantFrom(...'abcdef0123456789'), {minLength:1,maxLength:200}).map(xs=>xs.join(''));
// Feature: export-logs, Property 3: credential masking invariant at collection
it('属性 3：收集前遮盖且保留上下文',()=>fc.assert(fc.property(token,key=>{
 const c=createLogCollector(); c.log('info','app',`before sk-${key} after`);
 expect(c.getEntries()[0].message).toBe('before [REDACTED] after');
}),{numRuns:100}));
// Feature: export-logs, Property 4: JSONL serialization round-trip
it('属性 4：JSONL 往返',()=>fc.assert(fc.property(fc.array(fc.record({timestamp:fc.constant('2026-06-11T00:00:00.000Z'),level:fc.constantFrom('debug','info','warn','error'),module:fc.string(),message:fc.string()})),entries=>{
 const text=serializeEntries(entries); expect(text?text.split('\n').map(JSON.parse):[]).toEqual(entries);
}),{numRuns:100}));
// Feature: export-logs, Property 5: credential masking invariant at export
it('属性 5：真实 ZIP 的凭据遮盖',async()=>{
 downloadSetup(); await fc.assert(fc.asyncProperty(token,async key=>{
 expect((await exportLogs([{message:`Bearer ${key}`,metadata:{token:`sk-${key}`}}])).ok).toBe(true);
 const row=JSON.parse(strFromU8(unzipSync(blob.bytes)['system-logs.jsonl']));
 expect(row).toEqual({message:'[REDACTED]',metadata:{token:'[REDACTED]'}});
 }),{numRuns:100});
});
// Feature: export-logs, Property 6: sensitive localStorage keys excluded from ZIP
it('属性 6：不读取或导出存储凭据',async()=>{
 downloadSetup(); await fc.assert(fc.asyncProperty(token,async key=>{
 for(const name of ['model_any','apiKey','secretKey','accessToken']) localStorage.setItem(name,`private-${key}`);
 await exportLogs([{message:'safe'}]);
 expect(strFromU8(unzipSync(blob.bytes)['system-logs.jsonl'])).toBe('{"message":"safe"}');
 localStorage.clear();
 }),{numRuns:100});
});
it('序列化失败保留输入且不触发下载',async()=>{
 const click=downloadSetup(); const entries=[{message:'safe',extra:1n}];
 expect((await exportLogs(entries)).reason).toBe('zipError'); expect(click).not.toHaveBeenCalled(); expect(entries[0].extra).toBe(1n);
});
it('下载异常仍释放对象 URL 和临时节点',async()=>{
 const click=downloadSetup(); click.mockImplementation(()=>{throw Error('download');});
 expect((await exportLogs([])).ok).toBe(false); expect(URL.revokeObjectURL).toHaveBeenCalled(); expect(document.querySelector('a')).toBeNull();
});
it('循环元数据安全中止',async()=>{
 const click=downloadSetup(); const entry={message:'safe'}; entry.metadata=entry;
 expect((await exportLogs([entry])).reason).toBe('maskError'); expect(click).not.toHaveBeenCalled();
});
it('打包进行中取消，不产生迟到下载',async()=>{
 const click=downloadSetup(); const controller=new AbortController();
 const promise=exportLogs([{message:'x'.repeat(400000)}],{signal:controller.signal}); controller.abort();
 expect((await promise).reason).toBe('aborted'); expect(click).not.toHaveBeenCalled();
});
it('长凭据完整遮盖且不残留尾部',()=>{
 expect(maskCredentials('before sk-'+ 'a'.repeat(201)+' after')).toBe('before [REDACTED] after');
 expect(maskCredentials('Bearer '+ 'b'.repeat(501))).toBe('[REDACTED]');
});
