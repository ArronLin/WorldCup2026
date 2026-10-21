import {test,expect,team,followButton} from './follow-fixtures.js';
test('keyboard can follow, filter, select a stage and open a match with visible focus',async({page})=>{
 await team(page,'ARG');await followButton(page).focus();await expect(followButton(page)).toBeFocused();await page.keyboard.press('Space');await expect(followButton(page)).toHaveAttribute('aria-pressed','true');await expect(followButton(page)).toBeFocused();
 expect(await followButton(page).evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
 await page.goto('/#/schedule');const beforeFilter = await page.locator('[data-follow-count]').textContent();await page.getByRole('checkbox').focus();await page.keyboard.press('Space');await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.locator('[data-follow-count]')).not.toHaveText(beforeFilter);await expect(page.getByRole('checkbox')).toBeFocused();
 await page.keyboard.press('Tab');await expect(page.locator('[data-filter=all]')).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('[data-filter=group]')).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('[data-filter=group]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#app .match-card').first().focus();await page.keyboard.press('Enter');await expect(page.locator('.match-detail-page')).toBeVisible();
});
test('rapid filter changes and reversed language responses leave the latest intent visible',async({page})=>{
 await team(page,'ARG');await followButton(page).click();await expect(followButton(page)).toHaveAttribute('aria-pressed','true');await page.goto('/#/schedule');
 await page.getByRole('checkbox').check();await page.locator('[data-filter=group]').click();await page.locator('[data-filter=final]').click();await page.locator('[data-filter=group]').click();await expect(page.locator('[data-filter=group]')).toHaveAttribute('aria-pressed','true');
 let release;const gate=new Promise(r=>release=r);await page.route('**/i18n/en.json',async route=>{await gate;await route.continue()});
 await page.locator('#langToggle').click();await page.locator('#langToggle').click();await expect(page.locator('html')).toHaveAttribute('lang','zh');release();await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.locator('[data-filter=group]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.follow-switch')).toContainText('只看已关注球队');
});
