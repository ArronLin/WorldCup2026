import {test,expect,team,follow,followButton} from './follow-fixtures.js';
test('real UI follows two teams, removes one, refreshes and restores in a new page',async({page,context})=>{
 await follow(page,'ARG');await follow(page,'BRA');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wc2026-followed-teams')).teamCodes)).toEqual(['ARG','BRA']);
 await page.reload();await expect(followButton(page)).toHaveAttribute('aria-pressed','true');
 await team(page,'ARG');await expect(followButton(page)).toHaveAttribute('aria-pressed','true');await followButton(page).click();await expect(followButton(page)).toHaveAttribute('aria-pressed','false');
 const reopened=await context.newPage();await team(reopened,'BRA');await expect(followButton(reopened)).toHaveAttribute('aria-pressed','true');
 expect(await reopened.evaluate(()=>JSON.parse(localStorage.getItem('wc2026-followed-teams')))).toEqual({version:1,teamCodes:['BRA']});
});
test('invalid team entries have no follow action',async({page})=>{for(const code of ['XXX','arg','']){await page.goto('/#/team/'+code);await expect(page.getByText('找不到球队')).toBeVisible();await expect(followButton(page)).toHaveCount(0);await expect(page.locator('#app a[href="#/teams"]')).toBeVisible();}});
