import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const teams = JSON.parse(readFileSync('public/data/teams.json', 'utf8'));
const expected = groups => Object.values(teams).filter(t => !groups.length || groups.includes(t.group))
  .sort((a, b) => a.group.localeCompare(b.group)).map(t => t.code);
const visible = page => page.locator('.group-card:not([hidden]) [data-route]').evaluateAll(es => es.map(e => e.dataset.route.split('/').pop()));
const choice = (page, group) => page.locator(`input[data-team-group="${group}"]`);
test.use({ locale: 'zh-CN' });
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { if (!sessionStorage.getItem('group-test-locale')) { localStorage.setItem('wc2026-lang', 'zh'); sessionStorage.setItem('group-test-locale', '1'); } });
});
async function open(page) { await page.goto('/#/teams'); await expect(page.locator('.teams-page')).toBeVisible(); }

test('single and multiple groups, last cancellation and visible response within one second', async ({ page }) => {
  await open(page); await expect(page.locator('legend')).toHaveText('小组筛选');
  expect(await visible(page)).toEqual(expected([]));
  await page.evaluate(() => {
    window.groupTimings = [];
    document.addEventListener('change', event => {
      if (!event.target.matches('input[data-team-group]')) return;
      const start = performance.now();
      requestAnimationFrame(() => window.groupTimings.push({ ms: performance.now() - start,
        codes: [...document.querySelectorAll('.group-card:not([hidden]) [data-route]')].map(el => el.dataset.route.split('/').pop()) }));
    }, true);
  });
  const steps = [['A', true, ['A']], ['C', true, ['A', 'C']], ['A', false, ['C']], ['C', false, []]];
  for (let i = 0; i < steps.length; i++) {
    const [group, checked, groups] = steps[i]; await choice(page, group).setChecked(checked);
    await expect.poll(() => page.evaluate(() => window.groupTimings.length)).toBe(i + 1);
    const timing = await page.evaluate(i => window.groupTimings[i], i);
    expect(timing.codes).toEqual(expected(groups)); expect(timing.ms).toBeLessThanOrEqual(1000);
    expect(await visible(page)).toEqual(expected(groups));
  }
  mkdirSync('specs/002-team-group-filter/evidence/T013', { recursive: true });
  writeFileSync('specs/002-team-group-filter/evidence/T013/timings.json', JSON.stringify(await page.evaluate(() => window.groupTimings), null, 2));
});
test('all groups, rapid changes and repeated show-all keep exact order without duplicates', async ({ page }) => {
  await open(page);
  for (const g of [...new Set(Object.values(teams).map(t => t.group))].sort()) await choice(page, g).check();
  expect(await visible(page)).toEqual(expected([]));
  await page.evaluate(() => { for (let i = 0; i < 9; i++) document.querySelector('input[data-team-group="A"]').click(); });
  expect(await visible(page)).toEqual(expected([...new Set(Object.values(teams).map(t => t.group))].filter(g => g !== 'A')));
  await page.getByRole('button', { name: '显示全部', exact: true }).click();
  await page.getByRole('button', { name: '显示全部', exact: true }).click();
  await expect(page.locator('input:checked')).toHaveCount(0); expect(await visible(page)).toEqual(expected([]));
});
test('correct detail, return retains groups, refresh and a new page reset them', async ({ page, context }) => {
  await open(page); await choice(page, 'A').check(); await choice(page, 'C').check();
  const code = expected(['A'])[0]; await page.locator(`[data-route="/team/${code}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/team/${code}$`)); await expect(page.locator('.team-header')).toBeVisible();
  await page.goBack(); await expect(choice(page, 'A')).toBeChecked(); await expect(choice(page, 'C')).toBeChecked();
  expect(await visible(page)).toEqual(expected(['A', 'C']));
  await page.reload(); await expect(page.locator('legend')).toBeVisible(); await expect(page.locator('input:checked')).toHaveCount(0);
  expect(await visible(page)).toEqual(expected([]));
  await choice(page, 'B').check(); const other = await context.newPage(); await open(other);
  await expect(other.locator('input:checked')).toHaveCount(0); expect(await visible(other)).toEqual(expected([])); await other.close();
});
test('real Chinese-English-Chinese changes preserve selected identities and all mode', async ({ page }) => {
  await open(page); await choice(page, 'A').check(); await choice(page, 'C').check();
  for (const [lang, label] of [['en', 'Filter by group'], ['zh', '小组筛选']]) {
    await page.locator('#langToggle').click(); await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('legend')).toHaveText(label);
    await expect(choice(page, 'A')).toBeChecked(); await expect(choice(page, 'C')).toBeChecked();
    expect(await visible(page)).toEqual(expected(['A', 'C']));
  }
  await page.getByRole('button', { name: '显示全部', exact: true }).click();
  await page.locator('#langToggle').click(); await expect(page.locator('legend')).toHaveText('Filter by group');
  await expect(page.getByRole('button', { name: 'Show all', exact: true })).toBeVisible();
  expect(await visible(page)).toEqual(expected([]));
});
test('keyboard selection retains focus and hidden team cards leave the tab sequence', async ({ page }) => {
  await open(page); const a = choice(page, 'A'); await a.focus(); await page.keyboard.press('Space');
  await expect(a).toBeFocused(); await expect(a).toBeChecked();
  await page.keyboard.press('Tab'); await expect(choice(page, 'B')).toBeFocused();
  const all = page.getByRole('button', { name: '显示全部', exact: true }); await all.focus();
  for (const code of expected(['A'])) { await page.keyboard.press('Tab'); await expect(page.locator(`[data-route="/team/${code}"]`)).toBeFocused(); }
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('.group-card[hidden]')))).toBe(false);
  await all.focus(); await page.keyboard.press('Enter'); await expect(all).toBeFocused(); expect(await visible(page)).toEqual(expected([]));
});
for (const failure of [false, true]) test(failure ? 'unavailable data is not described as an empty filter result' : 'empty data has a neutral bilingual message and no fabricated groups', async ({ page }) => {
  await page.route('**/data/teams.json', route => failure ? route.abort() : route.fulfill({ json: {} }));
  await open(page); await expect(page.locator('.teams-page')).toContainText('暂无可显示的球队，可刷新重试');
  await expect(page.locator('.teams-page input')).toHaveCount(0);
  await page.locator('#langToggle').click(); await expect(page.locator('.teams-page')).toContainText('No teams available. Refresh to try again.');
});
test('unknown groups remain in all mode but never become options or selected results', async ({ page }) => {
  const fixture = structuredClone(teams), code = Object.keys(fixture)[0]; delete fixture[code].group;
  await page.route('**/data/teams.json', route => route.fulfill({ json: fixture }));
  await open(page); await expect(page.getByRole('heading', { name: '分组未知', exact: true })).toBeVisible();
  expect(await visible(page)).toContain(code); await expect(page.locator('input[data-team-group=""]')).toHaveCount(0);
  await choice(page, 'C').check(); expect(await visible(page)).not.toContain(code);
  await page.getByRole('button', { name: '显示全部', exact: true }).click(); expect(await visible(page)).toContain(code);
  await page.locator('#langToggle').click(); await expect(page.getByRole('heading', { name: 'Unknown group', exact: true })).toBeVisible();
});
test('narrow and desktop controls wrap without overflow and have visible focus in both themes', async ({ page }) => {
  await open(page); await choice(page, 'A').check(); await choice(page, 'C').check();
  mkdirSync('specs/002-team-group-filter/evidence/T014', { recursive: true });
  for (const [width, height, theme] of [[1280, 800, 'dark'], [375, 812, 'dark'], [375, 812, 'light']]) {
    if (theme === 'light') {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.locator('#themeToggle').click();
    }
    await page.setViewportSize({ width, height }); await choice(page, 'A').focus(); await page.keyboard.press('Tab');
    await expect(choice(page, 'B')).toBeFocused();
    expect(await page.locator('.team-group-filter').evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await choice(page, 'B').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.screenshot({ animations: 'disabled', path: `specs/002-team-group-filter/evidence/T014/${width}-${theme}.png` });
  }
});
