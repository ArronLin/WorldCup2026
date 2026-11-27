import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ locale: 'zh-CN' });

const data = JSON.parse(readFileSync(new URL('../public/data/standings.json', import.meta.url), 'utf8'));
const dictionaries = Object.fromEntries(['zh', 'en'].map(lang => [lang, JSON.parse(readFileSync(new URL(`../public/i18n/${lang}.json`, import.meta.url), 'utf8'))]));
const metrics = { points: 'pts', goalsFor: 'gf', goalsAgainst: 'ga', goalDifference: 'gd' };
// Fixed input snapshot, with deliberately non-ranked initial sequence.
const fixture = Object.fromEntries(Object.entries(data).map(([g, rows]) => [g, [...rows].reverse()]));
const group = (page, g) => page.locator('standings-group').filter({ has: page.locator('h3').filter({ hasText: new RegExp(` ${g}$`) }) });
const button = (card, metric) => card.locator(`button[data-sort-metric="${metric}"]`);
async function open(page) {
  await page.route('**/data/standings.json', route => route.fulfill({ json: fixture }));
  await page.goto('/#/');
  await expect(page.locator('#navLinks a[href="#/groups"]')).toBeVisible();
}
async function enter(page) {
  await page.locator('#navLinks a[href="#/groups"]').click();
  await expect(page.locator('.standings-page')).toBeVisible();
  await expect(page.locator('standings-group')).toHaveCount(Object.values(fixture).filter(rows => rows.length).length);
}
function order(g, metric, direction) {
  return [...fixture[g]].sort((a, b) => (a[metric] - b[metric]) * (direction === 'ascending' ? 1 : -1));
}
async function rows(card, expected, lang) {
  const actual = await card.locator('tbody tr').evaluateAll(es => es.map(e => ({ route: e.dataset.route, qualification: e.className, cells: [...e.cells].map(c => c.textContent.trim()) })));
  expect(actual).toEqual(expected.map(r => ({ route: `/team/${r.code}`, qualification: r.position <= 2 ? 'qual-line' : 'elim-line', cells: [r.position, `${r.code} ${r.name[lang]}`, r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst, r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference, r.points].map(String) })));
}
async function check(card, g, metric, direction, lang = 'zh') {
  await expect(card.locator('th[aria-sort]')).toHaveCount(1);
  await expect(button(card, metric).locator('..')).toHaveAttribute('aria-sort', direction);
  await expect(button(card, metric).locator('.standings-sort-arrow')).toHaveText(direction === 'ascending' ? '↑' : '↓');
  await expect(card.locator('.standings-sort-arrow').filter({ hasText: /[↑↓]/ })).toHaveCount(1);
  await rows(card, order(g, metric, direction), lang);
}
for (const key of ['Enter', 'Space']) {
  test(`keyboard ${key}: two independent activations`, async ({ page }) => {
    await open(page); await enter(page);
    const card = group(page, 'A'), points = button(card, 'points');
    await expect(card.locator('th[aria-sort]')).toHaveCount(0);
    await rows(card, fixture.A, 'zh');
    for (let i = 0; i < 100 && !(await points.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(points).toBeFocused();
    await points.evaluate(el => {
      window.sortWrites = [];
      new MutationObserver(records => window.sortWrites.push(...records.map(r => r.target.getAttribute('aria-sort')))).observe(el.closest('th'), { attributes: true, attributeFilter: ['aria-sort'] });
    });
    for (const [i, direction] of ['descending', 'ascending'].entries()) {
      await test.step(`${key} ${i + 1}: ${direction}`, async () => {
        await page.keyboard.press(key);
        await check(card, 'A', 'points', direction);
        await expect(points).toBeFocused();
        expect(await page.evaluate(() => window.sortWrites)).toEqual(['descending', 'ascending'].slice(0, i + 1));
      });
    }
  });
}
async function allMetrics(page, lang) {
  for (const g of Object.keys(fixture).filter(g => fixture[g].length)) await rows(group(page, g), fixture[g], lang);
  const card = group(page, 'A');
  for (const [metric, label] of Object.entries(metrics)) {
    const control = button(card, metric);
    await expect(control).toHaveAccessibleName(dictionaries[lang][`standings.${label}`]);
    const first = metric === 'goalsAgainst' ? 'ascending' : 'descending';
    await control.click(); await check(card, 'A', metric, first, lang);
    await control.click(); await check(card, 'A', metric, first === 'ascending' ? 'descending' : 'ascending', lang);
  }
  await expect(page.locator('#footerText')).toHaveText(dictionaries[lang]['footer.text']);
  await expect(page.locator('.standings-page .page-subtitle')).toHaveText(dictionaries[lang]['groups.subtitle']);
}
test('AC9: independent groups, bilingual pointer controls, source and team detail', async ({ page }) => {
  await open(page); await enter(page);
  const a = group(page, 'A'), b = group(page, 'B');
  await button(a, 'points').click(); await check(a, 'A', 'points', 'descending');
  await button(b, 'goalsAgainst').click(); await check(b, 'B', 'goalsAgainst', 'ascending');
  const unchanged = await b.innerHTML();
  for (const direction of ['descending', 'ascending']) {
    await button(a, 'goalDifference').click(); await check(a, 'A', 'goalDifference', direction);
    await check(b, 'B', 'goalsAgainst', 'ascending'); expect(await b.innerHTML()).toBe(unchanged);
  }
  await page.locator('#navLinks a[href="#/"]').click(); await enter(page);
  await allMetrics(page, 'zh');
  await page.locator('#langToggle').click(); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(button(a, 'points')).toHaveAccessibleName('Pts');
  await allMetrics(page, 'en');
  const target = order('A', 'goalDifference', 'ascending')[0];
  await a.locator('tbody tr').first().click();
  await expect(page).toHaveURL(new RegExp(`#/team/${target.code}$`));
  await expect(page.locator('.team-header-info h2')).toHaveText(target.name.en);
  await expect(page.locator('.follow-demo')).toHaveText(dictionaries.en['follow.demo']);
});
for (const unavailable of ['unconfigured', 'service error']) {
  test(`AI ${unavailable}: four sorting metrics remain independent`, async ({ page }) => {
    let calls = 0;
    await page.route(/\/chat\/completions$|\/\.netlify\/functions\/chat$/, route => {
      calls++;
      return route.fulfill({ status: 503, json: { error: 'controlled service unavailable' } });
    });
    if (unavailable === 'service error') await page.addInitScript(() => localStorage.setItem('wc2026-chat-config', JSON.stringify({ provider: 'deepseek', apiKey: 'synthetic-test-only', model: 'deepseek-v4-flash' })));
    await open(page);
    if (unavailable === 'service error') {
      await page.locator('#chatToggle').click();
      await page.locator('#chatInput').fill('Test question about standings');
      const response = page.waitForResponse(r => r.url().endsWith('/chat/completions') && r.status() === 503);
      await page.locator('#chatSend').click(); await response;
      await expect(page.locator('.chat-bubble.is-error')).toBeVisible();
      expect(calls).toBeGreaterThan(0);
      await page.locator('#chatClose').click();
    } else {
      expect(await page.evaluate(() => localStorage.getItem('wc2026-chat-config'))).toBeNull();
    }
    const before = calls;
    await enter(page); await allMetrics(page, 'zh');
    expect(calls - before).toBe(0);
  });
}

