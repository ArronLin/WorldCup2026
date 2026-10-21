import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend({ locale: 'zh-CN', context: async ({ context }, use) => {
  await context.addInitScript(() => { if(!sessionStorage.getItem('follow-test-locale')) {localStorage.setItem('wc2026-lang','zh'); sessionStorage.setItem('follow-test-locale','1');} });
  await use(context);
} });
export const followButton = page => page.locator('[data-follow-action="toggle"]');
export async function team(page, code) { await page.goto('/#/team/'+code); await expect(page.locator('html')).toHaveAttribute('lang','zh'); await expect(followButton(page)).toBeVisible(); }
export async function follow(page,code) {await team(page,code);await followButton(page).click();await expect(followButton(page)).toHaveAttribute('aria-pressed','true');}

