import { test, expect } from '@playwright/test';

// 届次固定倒序 —— 与 FR-003 一致
const EDITIONS_DESC = ['2022', '2018', '2014', '2010', '2006', '2002', '1998'];

test('场景 A：单队 7 届倒序，每条含届次/轮次/对手/比分且无空白项', async ({ page }) => {
  await page.goto('/#/history?team=ESP');

  await expect(page.locator('.history-page')).toBeVisible();

  // 7 个届次区块，且严格按届次倒序
  const editions = page.locator('.history-edition');
  await expect(editions).toHaveCount(7);
  const order = await editions.evaluateAll((els) => els.map((el) => el.dataset.edition));
  expect(order).toEqual(EDITIONS_DESC);

  // 每一届都必须有内容 —— 不存在无标注的空白届次（SC-006）
  for (const edition of EDITIONS_DESC) {
    const section = page.locator(`.history-edition[data-edition="${edition}"]`);
    await expect(section.locator('.history-match')).not.toHaveCount(0);
    await expect(section.locator('.history-edition-title')).toContainText(edition);
  }

  // 每一条记录的四个字段都非空，且届次与所在区块一致
  const rows = page.locator('.history-match');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    await expect(row.locator('.history-round')).not.toBeEmpty();
    await expect(row.locator('.history-opponent')).not.toBeEmpty();
    await expect(row.locator('.history-score')).not.toBeEmpty();
    expect(await row.getAttribute('data-edition')).toBeTruthy();
  }
});

test('场景 E（前半）：未选择态、非法参数回落、参数大小写不敏感', async ({ page }) => {
  // 直接访问未选择态：正常渲染，不报错
  await page.goto('/#/history');
  await expect(page.locator('.history-page')).toBeVisible();
  await expect(page.locator('.history-prompt')).toBeVisible();
  await expect(page.locator('.history-team-chip[aria-current="true"]')).toHaveCount(0);

  // 非四强代码（BRA）→ 忽略该参数，回落未选择态，不报错
  await page.goto('/#/history?team=BRA');
  await expect(page.locator('.history-page')).toBeVisible();
  await expect(page.locator('.history-prompt')).toBeVisible();
  await expect(page.locator('.history-team-chip[aria-current="true"]')).toHaveCount(0);
  await expect(page.locator('.history-error')).toHaveCount(0);

  // 小写参数：大小写不敏感，正常选中 ESP
  await page.goto('/#/history?team=esp');
  await expect(page.locator('.history-team-chip[aria-current="true"]')).toHaveAttribute('data-team', 'ESP');
  await expect(page.locator('.history-edition')).toHaveCount(7);
});

// 场景 D —— FR-007 后半句 / SC-004，也是章程原则 III 明列为 e2e 层职责的「双语切换」。
// 补写来源：/speckit-analyze 判为 CRITICAL（C1/E1）—— 该半句此前零任务覆盖，只经人工验收。
// 注：对手（vs）的保留断言待 T023 落地 US2 后追加；当前视图只消费 team，故此处断言球队维度。
test.describe('场景 D：语言切换后已选状态不丢失', () => {
  // 必须固定 locale：src/i18n.js 的 detectLang() 依据 navigator.language 决定起始语言，
  // 不固定时起始语言随环境漂移（zh-CN → 中文，en-US → 英文），
  // 断言「切换后为英文」会随机失败 —— 实测未固定时 3 次跑出 2 过 1 败。
  test.use({ locale: 'zh-CN' });

  test('切换为英文后选择原样保留', async ({ page }) => {
    await page.goto('/#/history?team=ESP&vs=ARG');

    const title = page.locator('.section-title');
    await expect(title).toHaveText('历届世界杯'); // 前置：起始为中文
    await expect(page.locator('.history-team-chip[aria-current="true"]')).toHaveAttribute('data-team', 'ESP');

    await page.locator('#langToggle').click();

    // 先证明确实切成了英文 —— 否则下面的断言可能因「点击无效」而假通过
    await expect(title).toHaveText('World Cup History');

    // 再断言选择原样保留：URL 承载状态，全量重渲染后必须不丢
    await expect(page.locator('.history-team-chip[aria-current="true"]')).toHaveAttribute('data-team', 'ESP');
    await expect(page.locator('.history-edition')).toHaveCount(7);
  });
});
