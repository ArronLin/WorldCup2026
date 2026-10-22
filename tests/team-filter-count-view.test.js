// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import {mountTeams,teams,visibleCodes,checkbox} from './fixtures/team-group-filter.js';
let mounted;
afterEach(()=>{mounted?.dispose();vi.unstubAllGlobals();vi.restoreAllMocks();});
const summary=()=>mounted.root.querySelector('[data-team-group-summary]')?.textContent;
function choose(g,on){const el=checkbox(mounted.root,g);el.checked=on;el.dispatchEvent(new Event('change',{bubbles:true}));}
it('count-language',async()=>{
  mounted=await mountTeams();choose('A',true);choose('C',true);expect(summary()).toBe('当前显示 3 / 4 支球队');
  const codes=visibleCodes(mounted.root);await mounted.i18n.setLang('en');mounted.root.innerHTML=await mounted.view();
  expect(document.documentElement.lang).toBe('en');expect(summary()).toBe('Showing 3 / 4 teams');expect(visibleCodes(mounted.root)).toEqual(codes);
  await mounted.i18n.setLang('zh');mounted.root.innerHTML=await mounted.view();expect(summary()).toBe('当前显示 3 / 4 支球队');
});
it('count-return-reset',async()=>{
  mounted=await mountTeams();choose('B',true);mounted.root.innerHTML='<p>other route</p>';mounted.root.innerHTML=await mounted.view();
  expect(summary()).toBe('当前显示 1 / 4 支球队');expect(visibleCodes(mounted.root)).toEqual(['BBB']);
  mounted.dispose();mounted=await mountTeams();expect(summary()).toBe('当前显示 4 / 4 支球队');
});
it('count-no-data',async()=>{
  for(const data of [{},new Error('offline')]) {
    for(const lang of ['zh','en']) {
      mounted?.dispose();mounted=await mountTeams(data,lang);
      const counts=await import('../src/features/team-group-filter/count.js');counts.setGroups([{key:'A',teams:[{}]}]);
      mounted.root.innerHTML=await mounted.view();expect(counts.getCounts([])).toEqual({visible:0,total:0});
      expect(summary()).toBeUndefined();expect(mounted.root.textContent).toContain(lang==='zh'?'暂无可显示的球队':'No teams available');
    }
  }
});
it('count-unknown-view',async()=>{
  mounted=await mountTeams({...teams,XXX:{code:'XXX',name:{zh:'未知',en:'Unknown'}}});expect(summary()).toBe('当前显示 5 / 5 支球队');
  choose('A',true);expect(summary()).toBe('当前显示 2 / 5 支球队');expect(visibleCodes(mounted.root)).not.toContain('XXX');
  mounted.root.querySelector('button[data-team-group-action="all"]').click();expect(summary()).toBe('当前显示 5 / 5 支球队');
});
