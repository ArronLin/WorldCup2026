// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prepareDom } from './fixtures/follow-dom.js';
import { createScheduleDateState } from '../src/features/schedule-date-range/state.js';
import { renderDateControls, syncDateControls } from '../src/features/schedule-date-range/view.js';

let state,i18n;
const root=()=>document.querySelector('#app');
function render() {const snapshot=state.getSnapshot();root().innerHTML=renderDateControls(snapshot);syncDateControls(root(),snapshot);}
beforeEach(async()=>{i18n=await prepareDom();state=createScheduleDateState();});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

it('provides labelled text inputs, format guidance and a native application form',()=>{
  render();const inputs=[...root().querySelectorAll('[data-date-field]')];
  expect(root().querySelector('form').noValidate).toBe(true);
  expect(inputs).toHaveLength(2);
  for(const input of inputs){
    expect(input.type).toBe('text');
    expect(root().querySelector(`label[for="${input.id}"]`)?.textContent).toContain(input.dataset.dateField==='start'?'开始日期':'结束日期');
    expect(input.getAttribute('aria-describedby')).toContain('schedule-date-format');
    expect(input.hasAttribute('maxlength')).toBe(false);
    expect(input.dataset.dateFocus).toBe('schedule-date-'+input.dataset.dateField);
  }
  expect(root().textContent).toContain('YYYY-MM-DD');expect(root().textContent).toContain('按赛事数据中的比赛日期筛选');
  expect(root().querySelector('[data-date-action="apply"]').textContent).toBe('应用日期');
  expect(root().querySelector('[data-date-pending]').hidden).toBe(true);
});

for(const lang of ['zh','en']){
  it(`${lang}: renders all four applied summaries without using a draft`,async()=>{
    await i18n.setLang(lang);
    const cases=[
      ['', '',lang==='zh'?'不限日期':'All dates'],
      ['2011-12-30','',lang==='zh'?'从 2011年12月30日 起':'From December 30, 2011'],
      ['','2011-12-30',lang==='zh'?'截至 2011年12月30日':'Through December 30, 2011'],
      ['2011-12-30','2026-06-11',lang==='zh'?'2011年12月30日 至 2026年6月11日':'December 30, 2011 through June 11, 2026'],
    ];
    for(const [start,end,summary] of cases){
      state.setDraft('start',start);state.setDraft('end',end);state.apply();state.setDraft('end','unapplied');render();
      expect(root().querySelector('[data-date-summary]').textContent).toBe(summary);
      expect(root().querySelector('[data-date-pending]').hidden).toBe(false);
    }
  });
  it(`${lang}: keeps the calendar year and date for extreme and skipped civil dates`,async()=>{
    await i18n.setLang(lang);
    for(const [date,zh,en] of [
      ['0001-01-01','1年1月1日','January 1, 1'],['0099-12-31','99年12月31日','December 31, 99'],
      ['9999-12-31','9999年12月31日','December 31, 9999'],['2011-12-30','2011年12月30日','December 30, 2011'],
      ['2024-02-29','2024年2月29日','February 29, 2024'],
    ]){
      state.setDraft('start',date);state.setDraft('end',date);state.apply();render();
      expect(root().querySelector('[data-date-summary]').textContent).toBe(lang==='zh'?`${zh} 至 ${zh}`:`${en} through ${en}`);
      expect(root().querySelector('[data-date-field="start"]').value).toBe(date);
    }
  });
}

it('restores arbitrary literal input only through DOM properties without replacing nodes',()=>{
  const literal=' "><img src=x onerror="alert(1)"> ';
  state.setDraft('start',literal);
  const html=renderDateControls(state.getSnapshot());expect(html).not.toContain(literal);root().innerHTML=html;
  const input=root().querySelector('[data-date-field="start"]');const event=vi.fn();input.addEventListener('input',event);
  syncDateControls(root(),state.getSnapshot());expect(input.value).toBe(literal);expect(root().querySelector('img')).toBeNull();
  input.focus();input.setSelectionRange(2,5);syncDateControls(root(),state.getSnapshot());
  expect(root().querySelector('[data-date-field="start"]')).toBe(input);expect(input.selectionStart).toBe(2);expect(input.selectionEnd).toBe(5);expect(event).not.toHaveBeenCalled();
});

it('associates and translates errors, clearing stale text only when state clears errors',async()=>{
  state.setDraft('start','bad');state.setDraft('end','also bad');state.apply();render();
  for(const field of ['start','end']){
    const input=root().querySelector(`[data-date-field="${field}"]`),error=root().querySelector(`#schedule-date-${field}-error`);
    expect(input.getAttribute('aria-invalid')).toBe('true');expect(input.getAttribute('aria-describedby')).toContain(error?.id);
    expect(error?.textContent).toBe('请输入有效日期');
  }
  await i18n.setLang('en');render();expect(root().textContent).toContain('Enter a valid date');expect(root().textContent).not.toContain('请输入有效日期');
  state.setDraft('start','2026-06-13');state.setDraft('end','2026-06-11');state.apply();syncDateControls(root(),state.getSnapshot());
  expect(root().querySelector('#schedule-date-end-error')?.textContent).toBe('End date cannot be earlier than start date');
  state.setDraft('end','2026-06-13');state.apply();syncDateControls(root(),state.getSnapshot());
  expect(root().querySelector('#schedule-date-end-error')?.textContent).toBe('');
  expect(root().querySelector('[data-date-field="end"]').getAttribute('aria-invalid')).toBe('false');
  expect(root().querySelector('[data-date-pending]').hidden).toBe(true);
});
