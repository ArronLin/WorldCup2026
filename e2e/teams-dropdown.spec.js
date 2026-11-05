import { test, expect } from '@playwright/test';

test('team dropdown filters, restores all, supports keyboard and translated mobile UI', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wc2026-lang', 'zh'));
  await page.goto('/#/teams');
  const dropdown = page.locator('.teams-filter');
  const summary = dropdown.locator('summary');
  await expect(dropdown.getByRole('checkbox', { includeHidden: true })).toHaveCount(13);
  await expect(page.locator('.team-search-result:visible')).toHaveCount(48);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(dropdown).toHaveAttribute('open', '');
  await dropdown.getByRole('checkbox', { name: '小组 A', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.team-search-result:visible')).toHaveCount(4);
  await dropdown.getByRole('checkbox', { name: '小组 B', exact: true }).check();
  await expect(page.locator('.team-search-result:visible')).toHaveCount(8);
  await expect(page.locator('.group-card:visible')).toHaveCount(2);
  await expect(dropdown).toHaveAttribute('open', '');
  await expect(dropdown.getByRole('checkbox', { name: '小组 A', exact: true })).toBeChecked();
  await page.locator('h1').click();
  await expect(dropdown).not.toHaveAttribute('open');
  await expect(page.locator('.team-search-result:visible')).toHaveCount(8);
  await summary.click();
  await dropdown.getByRole('checkbox', { name: '小组 B', exact: true }).uncheck();
  await expect(page.locator('.group-card:visible')).toHaveAttribute('data-team-group', 'A');
  await expect(page.locator('.group-card:visible')).toHaveCount(1);
  await dropdown.getByRole('checkbox', { name: '小组 A', exact: true }).uncheck();
  await expect(page.locator('.team-search-result:visible')).toHaveCount(48);
  await dropdown.getByRole('checkbox', { name: '小组 A', exact: true }).check();
  await dropdown.getByRole('checkbox', { name: '全部小组', exact: true }).check();
  await page.locator('#footerText').click();
  await expect(dropdown).not.toHaveAttribute('open');
  await expect(page.locator('.team-search-result:visible')).toHaveCount(48);
  await page.locator('#langToggle').click();
  await expect(summary).toHaveText('Filter groups');
  await page.setViewportSize({ width: 375, height: 812 });
  await summary.click();
  await dropdown.getByRole('checkbox', { name: 'Group A', exact: true }).check();
  await dropdown.getByRole('checkbox', { name: 'Group B', exact: true }).check();
  await expect(page.locator('.team-search-result:visible')).toHaveCount(8);
  const bounds = await dropdown.locator('.teams-filter-options').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(dropdown).not.toHaveAttribute('open');
  await page.locator('.team-search-result:visible').first().click();
  await expect(page).toHaveURL(/#\/team\/[A-Z]{3}$/);
});

test('clear filters works by keyboard in both languages on a narrow screen', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wc2026-lang', 'zh'));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/teams');
  const summary = page.locator('.teams-filter summary');
  const teams = page.locator('.team-search-result:visible');
  for (const [label, entry, group] of [['清除筛选', '筛选小组', '小组'], ['Clear filters', 'Filter groups', 'Group']]) {
    await expect(summary).toHaveText(entry);
    for (const key of ['Enter', 'Space']) {
      const clear = page.getByRole('button', { name: label, exact: true });
      await expect(clear).toHaveCount(0);
      await summary.click();
      for (const letter of ['A', 'B']) {
        await page.getByRole('checkbox', { name: group + ' ' + letter, exact: true }).check();
      }
      await expect(teams).toHaveCount(8);
      await summary.click();
      await expect(clear).toBeVisible();
      const box = await clear.boundingBox();
      const entryBox = await summary.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x >= entryBox.x + entryBox.width || box.y >= entryBox.y + entryBox.height).toBe(true);
      await summary.focus();
      await page.keyboard.press('Tab');
      await expect(clear).toBeFocused();
      await page.keyboard.press(key);
      await expect(clear).toHaveCount(0);
      await expect(summary).toBeFocused();
      await expect(summary).toHaveCSS('outline-style', 'solid');
      await expect(teams).toHaveCount(48);
      await summary.click();
      await expect(page.locator('[data-group-choice]:checked')).toHaveCount(1);
      await expect(page.locator('[data-group-choice][value=""]')).toBeChecked();
      await summary.click();
    }
    if (group === '小组') {
      await page.locator('#langToggle').click();
      await page.locator('html').evaluate(el => el.setAttribute('data-theme', 'light'));
    }
  }
});
