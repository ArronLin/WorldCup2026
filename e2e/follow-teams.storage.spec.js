import {test,expect,team,followButton} from './follow-fixtures.js';
test('corrupt and denied read records are reported without blocking browsing',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('wc2026-followed-teams','{bad'));
 await team(page,'ARG');await expect(page.locator('[role=status]')).toContainText('关注记录已损坏');await expect(page.locator('#app .match-card').first()).toBeVisible();
});
test('follow-key read denial allows a temporary follow; later save recovers',async({page})=>{
 await page.addInitScript(()=>{const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k==='wc2026-followed-teams')throw Error('read denied');return get.call(this,k)}});
 await team(page,'ARG');await expect(page.locator('[role=status]')).toContainText('无法读取');await followButton(page).click();await expect(followButton(page)).toHaveAttribute('aria-pressed','true');await expect(page.locator('[role=status]')).toHaveCount(0);
});
test('write failure preserves state across routes; a later save persists the full set',async({page})=>{
 await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='wc2026-followed-teams'&&!window.allowFollowSave)throw Error('quota');return set.call(this,k,v)}});
 await team(page,'ARG');await followButton(page).click();await expect(followButton(page)).toHaveAttribute('aria-pressed','true');await expect(page.locator('[role=status]')).toContainText('无法保存');
 await team(page,'BRA');await expect(page.locator('[role=status]')).toContainText('无法保存');await page.evaluate(()=>window.allowFollowSave=true);await followButton(page).click();await expect(page.locator('[role=status]')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wc2026-followed-teams')).teamCodes)).toEqual(['ARG','BRA']);
});
test('all storage denied still starts and allows temporary follows',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied')}}));await team(page,'ARG');await followButton(page).click();await expect(followButton(page)).toHaveAttribute('aria-pressed','true');await expect(page.locator('[role=status]')).toContainText('无法保存');
});
test('503 is an error and a user retry really fetches the data again',async({page})=>{
 let calls=0;await page.route('**/data/matches.json',route=>++calls===1?route.fulfill({status:503,body:''}):route.continue());
 await page.goto('/#/team/ARG');await expect(page.getByText('赛事数据加载失败')).toBeVisible();await page.getByRole('button',{name:'重试',exact:true}).click();await expect(followButton(page)).toBeVisible();expect(calls).toBe(2);
});
