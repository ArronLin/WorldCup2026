import {test,expect,follow} from './follow-fixtures.js';
test('follows combine with stages and survive same-tab return, refresh resets only filters',async({page})=>{
 await follow(page,'ARG');await follow(page,'BRA');await page.goto('/#/schedule');await page.getByRole('checkbox',{name:'只看已关注球队'}).check();
 await page.getByRole('button',{name:'小组赛',exact:true}).click();
 const ids=await page.locator('#app .match-card').evaluateAll(es=>es.map(e=>e.dataset.route));expect(new Set(ids).size).toBe(ids.length);expect(ids.length).toBeGreaterThan(0);
 await page.locator('#app .match-card').first().click();await expect(page.locator('.match-detail-page')).toBeVisible();await page.goto('/#/schedule');
 await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.locator('[data-filter=group]')).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.getByRole('checkbox')).not.toBeChecked();await expect(page.locator('[data-filter=all]')).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wc2026-followed-teams')).teamCodes)).toEqual(['ARG','BRA']);
});
test('fixture has exact union, stable grouped order and deduplicated IDs',async({page})=>{
 const teams={ARG:{code:'ARG',name:{zh:'阿根廷',en:'Argentina'}},BRA:{code:'BRA',name:{zh:'巴西',en:'Brazil'}},ESP:{code:'ESP',name:{zh:'西班牙',en:'Spain'}}};
 const m=(id,home,away,stage='group')=>({id,home:{code:home},away:{code:away},stage,round:stage==='knockout'?'final':undefined,group:'A',date:'2026-06-11',homeScore:0,awayScore:0});
 await page.route('**/data/teams.json',r=>r.fulfill({json:teams}));await page.route('**/data/matches.json',r=>r.fulfill({json:[m(2,'ESP','ARG'),m(1,'ARG','BRA'),m(1,'ARG','BRA'),m(3,'BRA','ESP','knockout')]}));
 await follow(page,'ARG');await page.goto('/#/schedule');await page.getByRole('checkbox').check();
 await expect(page.locator('[data-follow-count]')).toHaveText('共 2 场比赛');expect(await page.locator('#app .match-card').evaluateAll(es=>es.map(e=>e.dataset.route))).toEqual(['/match/2','/match/1']);
 await page.getByRole('button',{name:'决赛',exact:true}).click();await expect(page.getByText('当前筛选条件下没有比赛。')).toBeVisible();await page.getByRole('checkbox').uncheck();await expect(page.locator('[data-follow-count]')).toHaveText('共 1 场比赛');expect(await page.locator('#app .match-card').evaluateAll(es=>es.map(e=>e.dataset.route))).toEqual(['/match/3']);
});

