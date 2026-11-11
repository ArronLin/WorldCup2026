import { test, expect } from '@playwright/test';
import { installDateData } from './fixtures/schedule-date.js';

for (const lang of ['zh', 'en']) for (const theme of ['dark', 'light']) for (const width of [390, 1440]) {
  test(`calendar interaction and layout ${lang} ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(({ lang, theme }) => { localStorage.setItem('wc2026-lang', lang); localStorage.setItem('wc2026-theme', theme); }, { lang, theme });
    await installDateData(page); await page.goto('/#/schedule');
    const trigger = page.locator('[data-calendar-open="start"]');
    await trigger.click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await dialog.locator('button:not(:disabled),input,select').evaluateAll(nodes => nodes.every(node => {
      const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }))).toBe(true);
    await page.screenshot({ path: info.outputPath('calendar.png'), animations: 'disabled' });
    await page.locator('[data-calendar-day="2026-06-12"]').click();
    await expect(trigger).toBeFocused(); await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-date-field="start"]')).toHaveValue('2026-06-12');
    await expect(page.locator('.schedule-page .match-card')).toHaveCount(3);
    await expect(page.locator('[data-date-pending]')).toBeVisible();
    await page.locator('[data-calendar-open="end"]').click(); await page.locator('[data-calendar-day="2026-06-12"]').click();
    await page.locator('[data-date-action="apply"]').click();
    await expect(page.locator('.schedule-page .match-card')).toHaveCount(1);
    await expect(page.locator('.schedule-page .match-card')).toHaveAttribute('data-route', '/match/102');
    await trigger.click(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused(); await expect(page.locator('[data-date-field="start"]')).toHaveValue('2026-06-12');
    await trigger.click(); await page.locator('#langToggle').click();
    await expect(dialog).toHaveCount(0); await expect(page.locator('[data-date-field="start"]')).toHaveValue('2026-06-12');
    await trigger.click(); await page.locator('#themeToggle').focus(); await page.keyboard.press('Enter'); await expect(dialog).toBeVisible(); await trigger.focus(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  });
}

for (const timezoneId of ['UTC', 'Asia/Shanghai', 'Pacific/Apia']) {
  test(`calendar preserves ISO dates in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId }); const page = await context.newPage();
    await installDateData(page); await page.goto('http://127.0.0.1:4173/#/schedule');
    await page.locator('[data-date-field="start"]').fill('2024-02-28');
    await page.locator('[data-calendar-open="start"]').click(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    await expect(page.locator('[data-date-field="start"]')).toHaveValue('2024-02-29');
    await context.close();
  });
}
