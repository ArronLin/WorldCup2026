import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../scripts/capture-coverage-baseline.mjs';
import { renderAddedCoverage } from '../scripts/render-added-coverage.mjs';

test.use({ locale:'zh-CN' });
let url;
test.beforeAll(() => {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-report-ui-'));
  mkdirSync(path.join(root,'src'));
  const source = 'export const covered = 1;\nexport const missed = 2;\n// ' + 'long-source-'.repeat(80);
  const untouched = 'export const untouched = 0;';
  writeFileSync(path.join(root,'src/a.js'), source); writeFileSync(path.join(root,'src/z.js'), untouched);
  const report = { schemaVersion:1, baseCommit:'a'.repeat(40), C:1, D:2, ratio:0.5, passed:false, notApplicable:false, files:[
    {path:'src/a.js',sourceHash:sha256(source),changedLines:[1,2,3],addedExecutableLines:[1,2],hitLines:[1],C:1,D:2},
    {path:'src/z.js',sourceHash:sha256(untouched),changedLines:[],addedExecutableLines:[],hitLines:[],C:0,D:0},
  ] };
  const output = path.join(root,'report.html'); writeFileSync(output, renderAddedCoverage({ root, report, title:'覆盖率交互验收夹具' }));
  url = pathToFileURL(output).href;
});

test('offline report shows true aggregates, both source statuses and optional D=0 files', async ({ page }) => {
  const external = []; page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  await page.goto(url); await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
  await expect(page.locator('[data-summary=ratio]')).toHaveText('50%');
  await expect(page.locator('[data-file-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-line="1"]:visible .line-status')).toHaveText('✓ 已覆盖');
  await expect(page.locator('[data-line="2"]:visible .line-status')).toHaveText('✕ 未覆盖');
  await page.getByLabel('包括无新增可执行行的文件').check();
  await expect(page.locator('[data-file-row]:visible')).toHaveCount(2);
  await expect(page.locator('[data-file-row="src/z.js"]')).toContainText('不适用');
  await page.getByRole('button',{name:'src/z.js',exact:true}).click();
  await expect(page.locator('[data-source="src/z.js"]')).toBeVisible();
  await expect(page.locator('[data-source="src/z.js"] h3')).toBeInViewport();
  await expect(page.locator('[data-source="src/z.js"]')).toContainText('不参与本功能覆盖率计算');
  expect(external).toEqual([]);
});

test('keyboard, file search, line filters and copied line links work', async ({ page }) => {
  await page.goto(url);
  const all = page.getByLabel('包括无新增可执行行的文件'); await all.focus(); await page.keyboard.press('Space'); await expect(all).toBeChecked();
  await page.getByLabel('搜索文件').fill('src/z'); await expect(page.locator('[data-file-row]:visible')).toHaveCount(1);
  const button = page.getByRole('button',{name:'src/z.js',exact:true}); await button.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-source="src/z.js"] h3')).toBeFocused();
  await page.getByLabel('搜索文件').fill('src/a'); await page.getByRole('button',{name:'src/a.js',exact:true}).click();
  await page.getByLabel('显示范围').selectOption('uncovered');
  await expect(page.locator('[data-source="src/a.js"] [data-line]:visible')).toHaveCount(1);
  await expect(page.locator('[data-source="src/a.js"] [data-line="2"]')).toBeVisible();
  await page.goto(url+'#source-0-L1');
  await expect(page.locator('[data-source="src/a.js"] [data-line="1"]')).toBeVisible();
  await expect(page.getByLabel('显示范围')).toHaveValue('all');
});

test('375px layout keeps page within the viewport and scrolls long code inside its panel', async ({ page }) => {
  await page.setViewportSize({width:375,height:812}); await page.goto(url);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const code = page.locator('[data-source="src/a.js"] .code-scroll');
  expect(await code.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(page.getByLabel('搜索文件')).toBeVisible();
});
