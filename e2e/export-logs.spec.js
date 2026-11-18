import { test, expect } from '@playwright/test';

/**
 * 端到端测试：导出日志功能
 * 需求：2.1（按钮存在）、2.4（下载后按钮恢复）、3.2（文件名格式）
 *
 * 测试前提：已运行 `npm run build`，Playwright 通过 `npm run preview` 启动预览服务。
 * 使用 /?mock 避免真实 API 请求。
 */

test.describe('导出日志 E2E', () => {
  /**
   * 打开聊天面板并进入设置面板的辅助函数。
   * 复用 smoke.spec.js 的 #chatToggle → #chatPanel 模式，
   * 再点击 #chatSettingsBtn 进入 .chat-settings 视图。
   */
  async function openChatSettings(page) {
    // 打开聊天面板
    await page.locator('#chatToggle').click();
    await expect(page.locator('#chatPanel')).toHaveClass(/open/);

    // 点击设置按钮，等待设置区域出现
    await page.locator('#chatSettingsBtn').click();
    await expect(page.locator('#chatSettings')).not.toHaveAttribute('hidden');
  }

  test('需求 2.1：设置面板中"导出日志"按钮存在且可用', async ({ page }) => {
    await page.goto('/?mock#/');
    await openChatSettings(page);

    // 按钮文本在中文下为"导出日志"，英文下为"Export Logs"
    const exportBtn = page.locator('.export-logs-section button');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
    await expect(exportBtn).toHaveText(/导出日志|Export Logs/);
  });

  test('需求 3.2 + 2.4：点击按钮触发下载，文件名匹配格式，之后按钮恢复可用', async ({ page }) => {
    await page.goto('/?mock#/');
    await openChatSettings(page);

    const exportBtn = page.locator('.export-logs-section button');
    await expect(exportBtn).toBeEnabled();

    // 同时等待下载事件和按钮点击
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportBtn.click(),
    ]);

    // 需求 3.2：验证文件名格式 wc2026-logs-YYYYMMDD-HHmmss.zip
    expect(download.suggestedFilename()).toMatch(/^wc2026-logs-\d{8}-\d{6}\.zip$/);

    // 需求 2.4：下载触发后按钮应在 500 ms 内恢复可用（给予额外余量）
    // 注意：waitForEvent('download') 在 a.click() 触发时立即 resolve，
    // 此时 exportLogs 的 async 续体（恢复按钮）尚未在微任务队列中执行完毕，
    // 因此使用较宽裕的超时确保控制器有时间更新 DOM。
    await expect(exportBtn).toBeEnabled({ timeout: 5000 });
  });
});
import fs from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
for (const lang of ['zh', 'en']) {
 test(`真实 ZIP 内容、凭据遮盖及重复导出 ${lang}`, async ({page})=>{
  await page.addInitScript(lang=>localStorage.setItem('wc2026-lang',lang),lang);
  await page.goto('/?mock#/');
  await page.locator('#chatToggle').click(); await page.locator('#chatSettingsBtn').click();
  await page.evaluate(()=>{
   localStorage.setItem('apiKey','never-export-storage');
   window.dispatchEvent(new ErrorEvent('error',{message:'export-check sk-private after',filename:'example.js',lineno:12}));
  });
  const button=page.locator('.export-logs-section button');
  await expect(button).toHaveText(lang === 'zh' ? '导出日志' : 'Export Logs');
  for(let i=0;i<2;i++) {
   const pending=page.waitForEvent('download'); await button.click(); const download=await pending;
   const files=unzipSync(await fs.readFile(await download.path()));
   expect(Object.keys(files)).toEqual(['system-logs.jsonl']);
   const text=strFromU8(files['system-logs.jsonl']);
   expect(text).toContain('export-check [REDACTED] after'); expect(text).not.toContain('sk-private'); expect(text).not.toContain('never-export-storage');
   expect(text.endsWith('\n')).toBe(false);
   await expect(button).toBeEnabled({timeout:500});
  }
 });
}
