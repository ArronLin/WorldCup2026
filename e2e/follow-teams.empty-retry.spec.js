import {test,expect,follow,team,followButton} from './follow-fixtures.js';
test('no follows and no matches are separate, and removing the last follow updates returning schedule',async({page})=>{
 await page.goto('/#/schedule');await page.getByRole('checkbox').check();await expect(page.getByText('还没有关注球队，先选择你支持的球队吧。')).toBeVisible();await expect(page.locator('#app a[href="#/teams"]')).toBeVisible();
 await follow(page,'ARG');await page.goto('/#/schedule');await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.locator('#app .match-card').first()).toBeVisible();
 await team(page,'ARG');await followButton(page).click();await expect(followButton(page)).toHaveAttribute('aria-pressed','false');await page.goto('/#/schedule');await expect(page.getByText('还没有关注球队，先选择你支持的球队吧。')).toBeVisible();
});
test('schedule 503 retries without losing saved follows',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('wc2026-followed-teams'))localStorage.setItem('wc2026-followed-teams',JSON.stringify({version:1,teamCodes:['ARG']}))});
 let calls=0;await page.route('**/data/matches.json',r=>++calls===1?r.fulfill({status:503,body:''}):r.continue());await page.goto('/#/schedule');await expect(page.getByText('赛事数据加载失败')).toBeVisible();await page.getByRole('button',{name:'重试',exact:true}).click();await page.getByRole('checkbox').check();await expect(page.locator('#app .match-card').first()).toBeVisible();expect(calls).toBe(2);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wc2026-followed-teams')).teamCodes)).toEqual(['ARG']);
});
