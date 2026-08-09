import { test, expect } from '@playwright/test';

test('routes, language switch and schedule filters are available', async ({ page }) => {
  await page.goto('/#/schedule');
  await expect(page.locator('.schedule-page')).toBeVisible();
  await page.getByRole('button', { name: /三十二强|Round of 32/ }).click();
  await expect(page.locator('.match-section:visible')).not.toHaveCount(0);
  await page.locator('#langToggle').click();
  await expect(page.locator('#navLinks')).toContainText(/Home|首页/);
});

test('mock chat loads lazily and accepts a question', async ({ page }) => {
  await page.goto('/?mock#/');
  await page.locator('#chatToggle').click();
  await expect(page.locator('#chatPanel')).toHaveClass(/open/);
  await page.locator('#chatInput').fill('冠军是谁？');
  await page.locator('#chatSend').click();
  await expect(page.locator('.chat-bubble.user')).toContainText('冠军是谁？');
  await expect(page.locator('.chat-bubble.ai').last()).toContainText(/金靴|Golden Boot/, { timeout: 15_000 });
});
