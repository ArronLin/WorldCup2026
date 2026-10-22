import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const data = JSON.parse(readFileSync('public/data/teams.json', 'utf8'));
const total = Object.keys(data).length;
const group = (page, g) => page.locator(`input[data-team-group="${g}"]`);
const summary = page => page.locator('[data-team-group-summary]');
async function check(page, count, all=total, lang='zh') {
  await expect(summary(page)).toHaveText(lang==='zh'?`当前显示 ${count} / ${all} 支球队`:`Showing ${count} / ${all} teams`);
  await expect(page.locator('.group-card:not([hidden]) [data-route]')).toHaveCount(count);
}
test.use({locale:'zh-CN'});
test.beforeEach(async ({context})=>{await context.addInitScript(()=>{if(!sessionStorage.getItem('count-locale')){localStorage.setItem('wc2026-lang','zh');sessionStorage.setItem('count-locale','1');}});});
test('count-journey',async({page})=>{
  await page.goto('/#/teams');await check(page,total);
  await group(page,'A').focus();await page.keyboard.press('Space');await check(page,4);await expect(group(page,'A')).toBeFocused();
  await group(page,'C').check();await check(page,8);await group(page,'A').uncheck();await check(page,4);
  await group(page,'C').uncheck();await check(page,total);
  for(const g of ['A','B','C']) {await group(page,g).check();await group(page,g).uncheck();}await check(page,total);
  await group(page,'B').check();const all=page.getByRole('button',{name:'显示全部',exact:true});await all.focus();await page.keyboard.press('Enter');await all.click();await check(page,total);
  await group(page,'A').check();await group(page,'C').check();
  mkdirSync('openspec/changes/team-filter-result-count/evidence/screenshots',{recursive:true});
  for(const [width,height] of [[1280,800],[375,812]]) {
    await page.setViewportSize({width,height});await check(page,8);
    expect(await summary(page).evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
    await page.screenshot({path:`openspec/changes/team-filter-result-count/evidence/screenshots/${width}.png`});
  }
});
test('count-language-navigation',async({page,context})=>{
  await page.goto('/#/teams');await group(page,'A').check();await group(page,'C').check();await check(page,8);
  await page.locator('#langToggle').click();await expect(page.locator('html')).toHaveAttribute('lang','en');await check(page,8,total,'en');
  await page.locator('#langToggle').click();await expect(page.locator('html')).toHaveAttribute('lang','zh');await check(page,8);
  const team=page.locator('.group-card:not([hidden]) [data-route]').first();const route=await team.getAttribute('data-route');await team.click();await expect(page).toHaveURL(new RegExp(route+'$'));
  await page.goBack();await check(page,8);await page.reload();await check(page,total);
  await group(page,'A').check();const other=await context.newPage();await other.goto('/#/teams');await check(other,total);await other.close();
});
test('count-data-boundaries',async({page})=>{
  const make=(code,g)=>({code,group:g,name:{zh:code,en:code}});
  const fixture={AAA:make('AAA','A'),AAB:make('AAB','A'),BBB:make('BBB','B'),CCC:make('CCC','C'),CCD:make('CCD','C'),CCE:make('CCE','C'),XXX:make('XXX',undefined)};
  await page.route('**/data/teams.json',route=>route.fulfill({json:fixture}));await page.goto('/#/teams');await check(page,7,7);
  await group(page,'A').check();await group(page,'C').check();await check(page,5,7);await expect(page.locator('[data-route="/team/XXX"]')).toBeHidden();
  await page.getByRole('button',{name:'显示全部',exact:true}).click();await check(page,7,7);await expect(page.locator('[data-route="/team/XXX"]')).toBeVisible();
});
for(const failure of [false,true])test(`count-no-data-${failure?'offline':'empty'}`,async({page})=>{
  await page.route('**/data/teams.json',route=>failure?route.abort():route.fulfill({json:{}}));await page.goto('/#/teams');
  await expect(page.locator('.teams-page')).toContainText('暂无可显示的球队');await expect(summary(page)).toHaveCount(0);
  await page.locator('#langToggle').click();await expect(page.locator('.teams-page')).toContainText('No teams available');await expect(summary(page)).toHaveCount(0);
});
