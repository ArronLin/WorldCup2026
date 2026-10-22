// @vitest-environment jsdom
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTeamGroupFilter } from '../src/features/team-group-filter/controller.js';
import { createGroupFilterState } from '../src/features/team-group-filter/state.js';
import { setGroups } from '../src/features/team-group-filter/count.js';
import { initI18n } from '../src/i18n.js';
import { readFileSync } from 'node:fs';
let root, state, dispose;
beforeEach(async () => {
  localStorage.setItem('wc2026-lang', 'zh');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => JSON.parse(readFileSync('public/i18n/zh.json', 'utf8')) })));
  await initI18n();
  document.body.innerHTML = '<div id="app"><div class="teams-page">' + ['A','B','C'].map(g=>`<input type="checkbox" data-team-group-action="select" data-team-group="${g}"><section class="group-card" data-team-group="${g}"></section>`).join('') + '<button data-team-group-action="all">全部</button><p data-team-group-summary role="status"></p></div></div>';
  root = document.getElementById('app'); state = createGroupFilterState(); state.syncGroups(['A','B','C']);
  setGroups([{key:'A',teams:[{},{}]},{key:'B',teams:[{}]},{key:'C',teams:[{},{},{}]}]);
  dispose = initTeamGroupFilter({root,state});
});
afterEach(()=>{dispose();vi.unstubAllGlobals();});
const summary=()=>root.querySelector('[data-team-group-summary]').textContent;
function select(g,on){const el=root.querySelector(`input[data-team-group="${g}"]`);el.focus();el.checked=on;el.dispatchEvent(new Event('change',{bubbles:true}));return el;}
it('count-change',()=>{
  select('A',true);expect(summary()).toBe('当前显示 2 / 6 支球队');
  select('C',true);expect(summary()).toBe('当前显示 5 / 6 支球队');
  const el=select('A',false);expect(summary()).toBe('当前显示 3 / 6 支球队');expect(document.activeElement).toBe(el);
});
it('count-clear-rapid-focus',()=>{
  select('A',true);const el=select('A',false);expect(summary()).toBe('当前显示 6 / 6 支球队');expect(document.activeElement).toBe(el);
  for(let i=0;i<10;i++)select('C',i%2===0);
  expect(summary()).toBe('当前显示 6 / 6 支球队');
  select('B',true);const button=root.querySelector('button');button.focus();button.click();button.click();
  expect(summary()).toBe('当前显示 6 / 6 支球队');expect(document.activeElement).toBe(button);expect(root.querySelectorAll('input:checked')).toHaveLength(0);
});
