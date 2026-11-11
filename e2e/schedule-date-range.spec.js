import { test, expect } from '@playwright/test';
import { installDateData, dateMatches, combinationMatches, invalidDateMatches, deferred } from './fixtures/schedule-date.js';
test.describe.configure({ mode: 'parallel' });

const start = page => page.locator('[data-date-field="start"]');
const end = page => page.locator('[data-date-field="end"]');
const apply = page => page.locator('[data-date-action="apply"]');
const clear = page => page.locator('[data-date-action="clear"]');
const summary = page => page.locator('[data-date-summary]');
const pending = page => page.locator('[data-date-pending]');
const cards = page => page.locator('.schedule-page .match-card');
const ids = page => cards(page).evaluateAll(nodes => nodes.map(node => Number(node.dataset.route.split('/').pop())));

async function language(page, lang = 'zh') {
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('date-test-initialized')) {
      localStorage.setItem('wc2026-lang', value);sessionStorage.setItem('date-test-initialized','1');
    }
  },lang);
}
async function ready(page) {
  await expect(page.locator('[data-follow-count]')).toBeVisible();
  // The real schedule has already committed: absence here is a feature failure.
  expect(await page.locator('[data-date-form]').count()).toBe(1);
}
async function setDates(page, from, through) {
  await start(page).fill(from);await end(page).fill(through);await apply(page).click();
  await expect(pending(page)).toBeHidden();
}

async function dateOcclusion(page) {
  return page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const form = document.querySelector('[data-date-form]');
    const top = document.querySelector('.topbar').getBoundingClientRect().bottom;
    const blocked = [];
    let checked = 0;
    const check = (element, rect, text) => {
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      if (!rect.width || !rect.height || y <= top || y >= innerHeight || x <= 0 || x >= innerWidth) return;
      checked++;
      const covering = document.elementFromPoint(x, y);
      if (!element.contains(covering)) blocked.push(`${text}: ${covering?.className}`);
    };
    for (const element of form.querySelectorAll('label,button,p')) {
      if (element.hidden) continue;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        for (let i = 0; i < text.length; i++) {
          if (!text.data[i].trim()) continue;
          const range = document.createRange();
          range.setStart(text, i);range.setEnd(text, i + 1);
          check(element, range.getBoundingClientRect(), text.data[i]);
        }
      }
    }
    for (const input of form.querySelectorAll('input')) check(input, input.getBoundingClientRect(), input.id);
    return { checked, blocked };
  });
}

for (const lang of ['zh','en']) for (const theme of ['dark','light']) {
  test(`US3 unobscured long date summary ${lang} ${theme}`,async({page},testInfo)=>{
    await page.setViewportSize({width:390,height:844});await language(page,lang);
    await page.addInitScript(value=>localStorage.setItem('wc2026-theme',value),theme);
    await installDateData(page);await page.goto('/#/schedule');await ready(page);
    await setDates(page,'9999-12-31','9999-12-31');await expect(cards(page)).toHaveCount(0);await expect(apply(page)).toBeFocused();
    await start(page).fill('2026-02-30');await end(page).fill('bad');await apply(page).click();
    await expect(start(page)).toBeFocused();await expect(page.locator('[aria-invalid="true"]')).toHaveCount(2);
    await expect(summary(page)).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    for (const offset of [0,120,240,360]) {
      await page.evaluate(value=>scrollTo({top:value,behavior:'instant'}),offset);
      const result=await dateOcclusion(page);
      expect(result.checked).toBeGreaterThan(0);expect(result.blocked).toEqual([]);
      await expect(page.locator('#chatFab')).toBeVisible();await expect(page.locator('#chatFab')).toBeEnabled();
    }
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({animations:'disabled',fullPage:true,path:testInfo.outputPath('long-summary-error.png')});
    await page.locator('#chatFab').click();await expect(page.locator('#chatPanel')).toHaveClass(/open/);
    await page.locator('#chatClose').click();await expect(page.locator('#chatPanel')).not.toHaveClass(/open/);
    await clear(page).click();await expect(cards(page)).toHaveCount(3);await expect(clear(page)).toBeFocused();
  });
}

test('US3 keyboard applies, repairs and clears while reporting one count',async({page})=>{
  await language(page);await installDateData(page);await page.goto('/#/schedule');await ready(page);
  await start(page).focus();await page.keyboard.type('2026-06-12');await page.keyboard.press('Tab');await expect(end(page)).toBeFocused();await page.keyboard.type('2026-06-12');await page.keyboard.press('Tab');await expect(apply(page)).toBeFocused();await page.keyboard.press('Enter');await expect(apply(page)).toBeFocused();await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('#scheduleDateStatus')).toHaveText('共 1 场比赛');await expect(page.locator('.schedule-page [role="status"]')).toHaveCount(0);
  await start(page).focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('bad');await page.keyboard.press('Enter');await expect(start(page)).toBeFocused();await expect(cards(page)).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('2026-06-11');await page.keyboard.press('Enter');await expect(apply(page)).toBeFocused();await expect(cards(page)).toHaveCount(2);await page.keyboard.press('Tab');await expect(clear(page)).toBeFocused();await page.keyboard.press('Space');await expect(clear(page)).toBeFocused();await expect(cards(page)).toHaveCount(3);
});

test('US3 page navigation discards drafts; refresh and new tab reset dates only',async({page,context})=>{
  await language(page);await installDateData(page);await page.addInitScript(()=>{if(!localStorage.getItem('wc2026-followed-teams'))localStorage.setItem('wc2026-followed-teams',JSON.stringify({version:1,teamCodes:['ARG']}));});
  await page.goto('/#/schedule');await ready(page);await setDates(page,'2026-06-12','2026-06-12');await start(page).fill('bad');await apply(page).click();
  await cards(page).first().click();await expect(page.locator('.match-detail-page')).toBeVisible();await page.locator('.match-detail-page .back-link').click();await ready(page);
  await expect(start(page)).toHaveValue('2026-06-12');await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);await expect(pending(page)).toBeHidden();await expect(cards(page)).toHaveCount(1);
  await page.locator('#navLinks a[href="#/teams"]').click();await expect(page.locator('.teams-page')).toBeVisible();await page.locator('#navLinks a[href="#/schedule"]').click();await ready(page);await expect(start(page)).toHaveValue('2026-06-12');
  const saved=await page.evaluate(()=>localStorage.getItem('wc2026-followed-teams'));const second=await context.newPage();await installDateData(second);await second.goto('/#/schedule');await ready(second);await expect(start(second)).toHaveValue('');expect(await second.evaluate(()=>localStorage.getItem('wc2026-followed-teams'))).toBe(saved);await second.close();
  await page.reload();await ready(page);await expect(start(page)).toHaveValue('');expect(await page.evaluate(()=>localStorage.getItem('wc2026-followed-teams'))).toBe(saved);
});

for (const state of ['applied','draft','error']) {
  test(`US3 actual language and theme transitions preserve ${state}`,async({page})=>{
    await language(page);await page.addInitScript(()=>localStorage.setItem('wc2026-theme','dark'));
    await installDateData(page);await page.goto('/#/schedule');await ready(page);
    await setDates(page,'2026-06-12','2026-06-12');await expect(apply(page)).toBeFocused();
    if(state==='draft')await start(page).fill('2026-06-11');
    if(state==='error'){await start(page).fill('2026-02-30');await end(page).fill('bad');await apply(page).click();await expect(start(page)).toBeFocused();}
    const expectedStart=state==='error'?'2026-02-30':state==='draft'?'2026-06-11':'2026-06-12';
    const expectedEnd=state==='error'?'bad':'2026-06-12';
    const assertState=async lang=>{
      await expect(start(page)).toHaveValue(expectedStart);await expect(end(page)).toHaveValue(expectedEnd);
      await expect(start(page)).toHaveAttribute('aria-invalid',String(state==='error'));
      await expect(end(page)).toHaveAttribute('aria-invalid',String(state==='error'));
      if(state==='applied')await expect(pending(page)).toBeHidden();else await expect(pending(page)).toBeVisible();
      await expect(summary(page)).toHaveText(lang==='zh'?'2026年6月12日 至 2026年6月12日':'June 12, 2026 through June 12, 2026');
      expect(await ids(page)).toEqual([102]);await expect(page.locator('[data-follow-count]')).toHaveText(lang==='zh'?'共 1 场比赛':'1 matches');
      for(const text of lang==='zh'?['开始日期','结束日期','应用日期','清除日期','格式：YYYY-MM-DD','按赛事数据中的比赛日期筛选']:['Start date','End date','Apply dates','Clear dates','Format: YYYY-MM-DD','Filter by the match dates in the tournament data']){
        await expect(page.locator('[data-date-form]')).toContainText(text);
      }
      if(state!=='applied')await expect(pending(page)).toHaveText(lang==='zh'?'日期尚未应用':'Date changes have not been applied');
      if(state==='error')for(const field of ['start','end'])await expect(page.locator(`#schedule-date-${field}-error`)).toHaveText(lang==='zh'?'请输入有效日期':'Enter a valid date');
      await expect(page.locator('[data-date-form]')).not.toContainText(lang==='zh'?'Apply dates':'应用日期');
    };
    for(const lang of ['en','zh']){
      await page.locator('#langToggle').click();await expect(apply(page)).toHaveText(lang==='zh'?'应用日期':'Apply dates');
      await expect(page.locator('#langToggle')).toBeFocused();await assertState(lang);
      for(const theme of ['light','dark']){
        await page.locator('#themeToggle').click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
        await expect(page.locator('#themeToggle')).toBeFocused();await assertState(lang);
      }
    }
  });
}

test('US3 returning after changed follows recomputes the applied date intersection',async({page})=>{
  await language(page);await installDateData(page,combinationMatches);
  await page.addInitScript(()=>localStorage.setItem('wc2026-followed-teams',JSON.stringify({version:1,teamCodes:['ARG']})));
  await page.goto('/#/schedule');await ready(page);await page.getByRole('checkbox').check();await page.locator('[data-filter="group"]').click();
  await setDates(page,'2026-06-12','2026-06-12');expect(await ids(page)).toEqual([201]);
  await start(page).fill('bad');await apply(page).click();await expect(start(page)).toHaveAttribute('aria-invalid','true');
  await page.locator('#navLinks a[href="#/teams"]').click();
  await page.locator('.teams-page [data-route="/team/ARG"]').click();
  const follow=page.locator('[data-follow-action="toggle"]');
  await expect(follow).toHaveAttribute('aria-pressed','true');await follow.click();await expect(follow).toHaveAttribute('aria-pressed','false');
  await page.locator('.team-detail-page .back-link').click();await page.locator('.teams-page [data-route="/team/FRA"]').click();
  await expect(follow).toHaveAttribute('aria-pressed','false');await follow.click();await expect(follow).toHaveAttribute('aria-pressed','true');
  await page.locator('#navLinks a[href="#/schedule"]').click();await ready(page);
  await expect(start(page)).toHaveValue('2026-06-12');await expect(end(page)).toHaveValue('2026-06-12');
  await expect(pending(page)).toBeHidden();await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await expect(summary(page)).toHaveText('2026年6月12日 至 2026年6月12日');
  await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.locator('[data-filter="group"]')).toHaveAttribute('aria-pressed','true');
  expect(await ids(page)).toEqual([204]);await expect(page.locator('[data-follow-count]')).toHaveText('共 1 场比赛');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wc2026-followed-teams')))).toEqual({version:1,teamCodes:['FRA']});
});

for(const target of ['date','card','navigation','theme','disabled']){
  test(`US3 delayed dictionary respects latest ${target} focus`,async({page})=>{
    await language(page);await installDateData(page);await page.goto('/#/schedule');await ready(page);await setDates(page,'2026-06-11','2026-06-13');
    const gate=deferred();await page.route('**/i18n/en.json',async route=>{const response=await route.fetch();await gate.promise;await route.fulfill({response});});
    await page.locator('#langToggle').click();
    try{
      if(target==='date'){await start(page).fill('2026-06-');await start(page).evaluate(input=>input.setSelectionRange(2,5));}
      if(target==='card')await cards(page).first().focus();
      if(target==='navigation')await page.locator('#navLinks a[href="#/teams"]').focus();
      if(target==='theme'||target==='disabled'){await page.locator('#themeToggle').focus();if(target==='disabled')await page.locator('#themeToggle').evaluate(button=>button.disabled=true);}
    }finally{gate.resolve();}
    await expect(apply(page)).toHaveText('Apply dates');await expect(cards(page)).toHaveCount(3);
    const expected=target==='date'?start(page):target==='card'?cards(page).first():target==='navigation'?page.locator('#navLinks a[href="#/teams"]'):page.locator(target==='disabled'?'#langToggle':'#themeToggle');
    await expect(expected).toBeFocused();
    if(target==='date'){await expect(start(page)).toHaveValue('2026-06-');await expect(pending(page)).toBeVisible();expect(await start(page).evaluate(input=>[input.selectionStart,input.selectionEnd])).toEqual([2,5]);}
  });
}

test('US3 rapid valid then invalid submissions retain the last valid results',async({page})=>{
  await language(page);await installDateData(page);await page.goto('/#/schedule');await ready(page);
  await page.evaluate(()=>{
    const form=document.querySelector('[data-date-form]'),start=form.querySelector('[data-date-field="start"]'),end=form.querySelector('[data-date-field="end"]');
    start.value='2026-06-11';end.value='2026-06-11';form.requestSubmit();start.value='2026-06-12';end.value='2026-06-12';form.requestSubmit();end.value='bad';form.requestSubmit();
  });
  await expect(cards(page)).toHaveCount(1);expect(await ids(page)).toEqual([102]);await expect(end(page)).toHaveValue('bad');await expect(end(page)).toBeFocused();await expect(end(page)).toHaveAttribute('aria-invalid','true');
  await page.evaluate(()=>{document.querySelector('[data-date-action="clear"]').click();const input=document.querySelector('[data-date-field="start"]');input.focus();input.value='later draft';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(cards(page)).toHaveCount(3);await expect(start(page)).toHaveValue('later draft');await expect(start(page)).toBeFocused();await expect(pending(page)).toBeVisible();
});

for(const width of [1440,390])for(const lang of ['zh','en'])for(const theme of ['dark','light']){
  test(`US3 layout ${width} ${lang} ${theme}: five states`,async({page,browser},testInfo)=>{
    await page.setViewportSize({width,height:width===1440?900:844});await language(page,lang);await page.addInitScript(value=>localStorage.setItem('wc2026-theme',value),theme);await installDateData(page);await page.goto('/#/schedule');await ready(page);
    testInfo.annotations.push({type:'environment',description:`Chromium ${browser.version()}, ${width}x${width===1440?900:844}, ${lang}, ${theme}, scale 1`});
    for(const state of ['default','applied','draft','error','empty']){
      if(state==='applied')await setDates(page,'2026-06-12','2026-06-12');
      if(state==='draft')await start(page).fill('2026-06-');
      if(state==='error'){await start(page).fill('2026-02-30');await end(page).fill('bad');await apply(page).click();await expect(start(page)).toHaveAttribute('aria-invalid','true');}
      if(state==='empty')await setDates(page,'9999-12-31','9999-12-31');
      await start(page).focus();await page.keyboard.press('Tab');await expect(end(page)).toBeFocused();
      const check=await page.locator('[data-date-form]').evaluate(form=>{
        const elements=[...form.querySelectorAll('label,input,button,p')].filter(e=>!e.hidden),rects=elements.map(e=>e.getBoundingClientRect());
        const overlap=rects.some((a,i)=>rects.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
        return{overflow:document.documentElement.scrollWidth>innerWidth,inside:rects.every(r=>r.left>=0&&r.right<=innerWidth+1),overlap,controls:[...form.querySelectorAll('input,button')].map(e=>e.dataset.dateField||e.dataset.dateAction),focus:getComputedStyle(document.activeElement).outlineStyle};
      });
      expect(check).toEqual({overflow:false,inside:true,overlap:false,controls:['start','end','apply','clear'],focus:'solid'});
      for(const control of [start(page),end(page),apply(page),clear(page)])await expect(control).toBeEnabled();
      await page.screenshot({animations:'disabled',fullPage:true,path:testInfo.outputPath(`${state}.png`)});
    }
    await clear(page).click();await expect(cards(page)).toHaveCount(3);await expect(clear(page)).toBeFocused();
  });
}

test('US2 intersects conditions and clears only dates, including repeated clear',async({page})=>{
  await language(page);await installDateData(page,combinationMatches);
  await page.addInitScript(()=>localStorage.setItem('wc2026-followed-teams',JSON.stringify({version:1,teamCodes:['ARG','BRA']})));
  await page.goto('/#/schedule');await ready(page);await page.getByRole('checkbox').check();await page.locator('[data-filter="group"]').click();
  await setDates(page,'2026-06-12','2026-06-12');expect(await ids(page)).toEqual([201]);await expect(page.locator('[data-follow-count]')).toHaveText('共 1 场比赛');
  const saved=await page.evaluate(()=>localStorage.getItem('wc2026-followed-teams'));
  await start(page).fill('bad');await apply(page).click();await expect(start(page)).toHaveAttribute('aria-invalid','true');
  expect(await clear(page).count()).toBe(1);
  for(let i=0;i<2;i++){
    await clear(page).click();await expect(clear(page)).toBeFocused();await expect(start(page)).toHaveValue('');await expect(end(page)).toHaveValue('');await expect(summary(page)).toHaveText('不限日期');
    expect(await ids(page)).toEqual([201,202]);await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.locator('[data-filter="group"]')).toHaveAttribute('aria-pressed','true');await expect(pending(page)).toBeHidden();await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  }
  expect(await page.evaluate(()=>localStorage.getItem('wc2026-followed-teams'))).toBe(saved);
});

test('US2 zero results have no empty groups and clearing need not produce matches',async({page})=>{
  await language(page);await installDateData(page);await page.goto('/#/schedule');await ready(page);
  await setDates(page,'2026-06-14','2026-06-15');await expect(cards(page)).toHaveCount(0);await expect(page.locator('.match-section')).toHaveCount(0);await expect(page.locator('.follow-empty')).toContainText('当前筛选条件下没有比赛');
  await page.getByRole('checkbox').check();await expect(page.locator('.follow-empty')).toContainText('还没有关注球队');await expect(page.locator('.follow-empty a')).toHaveAttribute('href','#/teams');
  expect(await clear(page).count()).toBe(1);await clear(page).click();await expect(cards(page)).toHaveCount(0);await expect(page.locator('.match-section')).toHaveCount(0);await expect(summary(page)).toHaveText('不限日期');await expect(clear(page)).toBeEnabled();
});

for(const timezoneId of ['UTC','Asia/Shanghai','Pacific/Apia']) {
  test.describe(`US1 ${timezoneId}`,()=>{
    test.use({timezoneId});
    for(const lang of ['zh','en']) {
      test(`${lang} inclusive results and literal calendar summaries`,async({page})=>{
        await language(page,lang);await installDateData(page);await page.goto('/#/schedule');await ready(page);
        await expect(start(page)).toHaveValue('');await expect(end(page)).toHaveValue('');
        await expect(summary(page)).toHaveText(lang==='zh'?'不限日期':'All dates');
        for(const [from,through,expected] of [
          ['','',[101,102,103]],['2026-06-12','',[102,103]],['','2026-06-12',[101,102]],
          ['2026-06-12','2026-06-12',[102]],['2026-06-11','2026-06-12',[101,102]],['2026-06-14','2026-06-15',[]],
        ]) {
          await setDates(page,from,through);await expect.poll(()=>ids(page)).toEqual(expected);
          await expect(page.locator('[data-follow-count]')).toContainText(String(expected.length));
        }
        for(const [date,zh,en] of [
          ['2011-12-30','2011年12月30日','December 30, 2011'],['0001-01-01','1年1月1日','January 1, 1'],
          ['0099-12-31','99年12月31日','December 31, 99'],['9999-12-31','9999年12月31日','December 31, 9999'],
        ]) {
          await setDates(page,date,date);await expect(start(page)).toHaveValue(date);await expect(end(page)).toHaveValue(date);
          await expect(summary(page)).toHaveText(lang==='zh'?`${zh} 至 ${zh}`:`${en} through ${en}`);
          await expect(cards(page)).toHaveCount(0);
        }
        await setDates(page,'2011-12-30','');
        await expect(summary(page)).toHaveText(lang==='zh'?'从 2011年12月30日 起':'From December 30, 2011');
        await expect(cards(page)).toHaveCount(3);
        await setDates(page,'','2011-12-30');
        await expect(summary(page)).toHaveText(lang==='zh'?'截至 2011年12月30日':'Through December 30, 2011');
        await expect(cards(page)).toHaveCount(0);
      });
    }
  });
}

test('US1 drafts, validation focus and one-application recovery',async({page})=>{
  await language(page);await installDateData(page);await page.goto('/#/schedule');await ready(page);
  await setDates(page,'2026-06-12','2026-06-12');const appliedSummary=await summary(page).textContent();
  await start(page).fill('2026-06-11');await expect(pending(page)).toBeVisible();expect(await ids(page)).toEqual([102]);await expect(summary(page)).toHaveText(appliedSummary);
  await start(page).fill('2026-06-12');await expect(pending(page)).toBeHidden();
  await start(page).fill('2026-06-13');await end(page).fill('2026-06-11');await apply(page).click();
  await expect(end(page)).toBeFocused();await expect(page.locator('#schedule-date-end-error')).toHaveText('结束日期不能早于开始日期');expect(await ids(page)).toEqual([102]);
  await start(page).fill('2026-02-30');await end(page).fill('2026-06-');await apply(page).click();
  await expect(start(page)).toBeFocused();await expect(start(page)).toHaveValue('2026-02-30');await expect(end(page)).toHaveValue('2026-06-');
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(2);expect(await ids(page)).toEqual([102]);await expect(summary(page)).toHaveText(appliedSummary);
  await setDates(page,'2026-06-11','2026-06-13');await expect(cards(page)).toHaveCount(3);await expect(apply(page)).toBeFocused();await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await setDates(page,'2024-02-29','2024-02-29');await expect(cards(page)).toHaveCount(0);await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
});

test('US1 loading and failed data stay distinct from zero matches and recover by retry',async({page})=>{
  await language(page);await installDateData(page);
  const gate=deferred();let bad=true;
  await page.route('**/data/matches.json',async route=>{await gate.promise;await route.fulfill({json:bad?invalidDateMatches:dateMatches});});
  await page.goto('/#/schedule',{waitUntil:'domcontentloaded'});
  try {
    await expect(page.locator('#app .loading')).toBeVisible();await expect(page.locator('[data-date-form]')).toHaveCount(0);await expect(page.locator('[data-follow-count]')).toHaveCount(0);
  } finally {gate.resolve();}
  await expect(page.locator('#app')).toContainText('赛事数据加载失败');await expect(page.locator('[data-follow-count]')).toHaveCount(0);await expect(page.locator('[data-date-form]')).toHaveCount(0);
  bad=false;await page.locator('[data-follow-action="retry"]').click();await ready(page);await expect(cards(page)).toHaveCount(3);
});

test('US1 restores applied dates and other filters after a decoded-data fault and retry',async({page})=>{
  await language(page);await installDateData(page,combinationMatches);
  // Fault injection is confined to the external decoded data. The actual store,
  // validation, rendering, cache invalidation and delegated retry remain intact.
  // Normal cached data does not expire or become invalid on its own.
  await page.addInitScript(()=>{
    localStorage.setItem('wc2026-followed-teams',JSON.stringify({version:1,teamCodes:['ARG','BRA']}));
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(...args)=>{
      const response=await originalFetch(...args);
      if(new URL(response.url).pathname==='/data/matches.json'){
        const json=response.json.bind(response);
        response.json=async()=>{const rows=await json();window.__dateTestDecodedMatches=rows;return rows;};
      }
      return response;
    };
  });
  const requests={teams:0,matches:0};
  page.on('request',request=>{const name=request.url().match(/\/data\/(teams|matches)\.json$/)?.[1];if(name)requests[name]++;});
  await page.goto('/#/schedule');await ready(page);await page.getByRole('checkbox').check();await page.locator('[data-filter="group"]').click();
  await setDates(page,'2026-06-12','2026-06-12');expect(await ids(page)).toEqual([201]);
  const saved=await page.evaluate(()=>localStorage.getItem('wc2026-followed-teams'));
  const before={...requests};
  await page.evaluate(()=>{if(!window.__dateTestDecodedMatches)throw Error('Data boundary was not exercised');window.__dateTestDecodedMatches[0].date='2026-02-30';});
  await page.locator('[data-filter="group"]').click();
  await expect(page.locator('#app')).toContainText('赛事数据加载失败');
  await expect(page.locator('[data-date-form]')).toHaveCount(0);await expect(page.locator('[data-follow-count]')).toHaveCount(0);
  await expect(page.locator('#scheduleDateStatus')).toHaveText('');expect(requests).toEqual(before);
  await page.locator('[data-follow-action="retry"]').click();await ready(page);
  await expect(start(page)).toHaveValue('2026-06-12');await expect(end(page)).toHaveValue('2026-06-12');
  await expect(summary(page)).toHaveText('2026年6月12日 至 2026年6月12日');
  await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.locator('[data-filter="group"]')).toHaveAttribute('aria-pressed','true');
  expect(await ids(page)).toEqual([201]);await expect(page.locator('[data-follow-count]')).toHaveText('共 1 场比赛');
  await expect(page.locator('#scheduleDateStatus')).toHaveText('共 1 场比赛');
  expect(requests).toEqual({teams:before.teams+1,matches:before.matches+1});
  expect(await page.evaluate(()=>localStorage.getItem('wc2026-followed-teams'))).toBe(saved);
});

for(const failure of ['unconfigured','unavailable']) {
  test(`US1 cached date operations and match details work with AI ${failure}`,async({page})=>{
    await language(page);await installDateData(page);
    let aiCalls=0,tournamentCalls=0;
    await page.route('**/api/chat',route=>{aiCalls++;return failure==='unavailable'?route.abort():route.fulfill({status:503,json:{error:'not configured'}});});
    await page.route('**/.netlify/functions/**',route=>{aiCalls++;return route.fulfill({status:503,json:{error:failure}});});
    page.on('request',request=>{if(/\/data\/(matches|teams)\.json/.test(request.url()))tournamentCalls++;});
    await page.goto('/#/schedule');await ready(page);await page.waitForLoadState('networkidle');
    const before={aiCalls,tournamentCalls};expect(await ids(page)).toEqual([101,102,103]);
    await setDates(page,'2026-06-12','2026-06-12');await expect(cards(page)).toHaveCount(1);expect(await ids(page)).toEqual([102]);
    await expect(page.locator('[data-follow-count]')).toHaveText('共 1 场比赛');
    await expect(summary(page)).toHaveText('2026年6月12日 至 2026年6月12日');
    expect({aiCalls,tournamentCalls}).toEqual(before);await expect(page.locator('.follow-demo')).toContainText('静态');
    await clear(page).click();await expect(cards(page)).toHaveCount(3);expect(await ids(page)).toEqual([101,102,103]);
    await expect(start(page)).toHaveValue('');await expect(end(page)).toHaveValue('');await expect(summary(page)).toHaveText('不限日期');
    await expect(page.locator('[data-follow-count]')).toHaveText('共 3 场比赛');
    expect({aiCalls,tournamentCalls}).toEqual(before);await expect(page.locator('.follow-demo')).toContainText('静态');
    const route='/match/102';await page.locator(`.schedule-page [data-route="${route}"]`).click();
    await expect(page).toHaveURL(new RegExp('#'+route+'$'));await expect(page.locator('#app .match-detail-page')).toBeVisible();
  });
}
