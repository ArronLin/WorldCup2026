// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('../src/store.js',()=>({getTeams:vi.fn()}));
import {getTeams} from '../src/store.js';
import view from '../src/views/teams.js';
import {groupFilterState} from '../src/features/team-group-filter/state.js';
import {initI18n} from '../src/i18n.js';
afterEach(()=>vi.unstubAllGlobals());
it('count-render',async()=>{
  groupFilterState.clear();localStorage.setItem('wc2026-lang','zh');
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>JSON.parse(readFileSync('public/i18n/zh.json','utf8'))})));
  await initI18n();getTeams.mockResolvedValue({AAA:{code:'AAA',group:'A',name:{zh:'甲'}},BBB:{code:'BBB',group:'B',name:{zh:'乙'}}});
  document.body.innerHTML=await view();expect(document.querySelector('[data-team-group-summary]').textContent).toBe('当前显示 2 / 2 支球队');
  groupFilterState.setSelected('B',true);document.body.innerHTML=await view();expect(document.querySelector('[data-team-group-summary]').textContent).toBe('当前显示 1 / 2 支球队');
  getTeams.mockResolvedValue({});document.body.innerHTML=await view();expect(document.querySelector('[data-team-group-summary]')).toBeNull();
});
