// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
vi.mock('../src/features/export-logs/exporter.js', async importOriginal => ({...await importOriginal(), exportLogs:vi.fn()}));
vi.mock('../src/i18n.js', () => ({t:key=>key}));
import { exportLogs } from '../src/features/export-logs/exporter.js';
import { initExportButton } from '../src/features/export-logs/controller.js';
import { renderExportSection } from '../src/features/export-logs/export-ui.js';
afterEach(()=>{ vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('60 秒超时真正取消请求并允许重试', async ()=>{
 vi.useFakeTimers(); exportLogs.mockImplementation(()=>new Promise(()=>{}));
 const button=document.createElement('button'), status=document.createElement('span');
 const dispose=initExportButton(button,status); button.click();
 expect(button.disabled).toBe(true);
 await vi.advanceTimersByTimeAsync(60000);
 expect(exportLogs.mock.calls.at(-1)[1]?.signal?.aborted).toBe(true);
 expect(status.textContent).toBe('exportLogs.timeout'); expect(button.disabled).toBe(false); dispose();
});
it('dispose 取消运行并阻止迟到结果更新', async()=>{
 vi.useFakeTimers(); let finish; exportLogs.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 const button=document.createElement('button'), status=document.createElement('span');
 const dispose=initExportButton(button,status); button.click(); dispose(); const before=status.textContent;
 finish({ok:true}); await Promise.resolve();
 expect(status.textContent).toBe(before); expect(vi.getTimerCount()).toBe(0);
});
it.each([{ok:true},{ok:false,reason:'maskError'},{ok:false,reason:'zipError',message:'exportLogs.zipError'}])('完成或失败及时恢复按钮 %j', async result=>{
 exportLogs.mockResolvedValue(result); const button=document.createElement('button'), status=document.createElement('span');
 const dispose=initExportButton(button,status); button.click(); await Promise.resolve(); await Promise.resolve();
 expect(button.disabled).toBe(false); expect(status.textContent).toContain(result.ok?'exportLogs.done':result.reason==='maskError'?'exportLogs.maskError':'exportLogs.zipError'); dispose();
});
it('不支持 Blob 时禁止导出',()=>{ vi.stubGlobal('Blob',undefined); const section=renderExportSection(); expect(section.querySelector('button').disabled).toBe(true); expect(section.textContent).toContain('exportLogs.unsupported'); });
it('支持时呈现可用的按钮和无障碍状态',()=>{ const section=renderExportSection(); expect(section.querySelector('button').disabled).toBe(false); expect(section.querySelector('[role=status]')).not.toBeNull(); section.dispose?.(); });
it('超时重试后旧结果不得覆盖新任务',async()=>{
 vi.useFakeTimers(); let oldFinish,newFinish;
 exportLogs.mockImplementationOnce(()=>new Promise(resolve=>oldFinish=resolve)).mockImplementationOnce(()=>new Promise(resolve=>newFinish=resolve));
 const button=document.createElement('button'),status=document.createElement('span'); const dispose=initExportButton(button,status);
 button.click(); await vi.advanceTimersByTimeAsync(60000); button.click(); oldFinish({ok:true}); await Promise.resolve();
 expect(button.disabled).toBe(true); expect(status.textContent).toBe('exportLogs.exporting');
 newFinish({ok:true}); await Promise.resolve(); expect(button.disabled).toBe(false); dispose();
});
it('重复绑定仅执行一次导出',async()=>{
 exportLogs.mockClear().mockResolvedValue({ok:true}); const button=document.createElement('button'),status=document.createElement('span');
 initExportButton(button,status); const dispose=initExportButton(button,status); button.click(); await Promise.resolve();
 expect(exportLogs).toHaveBeenCalledOnce(); dispose();
});
