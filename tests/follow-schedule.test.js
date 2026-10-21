// @vitest-environment jsdom
import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import {prepareDom} from './fixtures/follow-dom.js';
let view,state,init;
beforeEach(async()=>{vi.resetModules();await prepareDom();view=(await import('../src/views/schedule.js')).default;state=(await import('../src/features/follow-teams/state.js')).followState;init=(await import('../src/features/follow-teams/controller.js')).initFollowTeams;location.hash='#/schedule'});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});
const app=()=>document.querySelector('#app');const ids=()=>[...document.querySelectorAll('[data-route]')].map(e=>e.dataset.route);
it('renders native controls, unique count, stable groups and real detail links',async()=>{
 app().innerHTML=await view();expect(app().querySelector('input[type=checkbox]')).not.toBeNull();
 expect(ids()).toEqual(['/match/1','/match/2','/match/3']);expect(app().querySelector('[data-follow-count]').textContent).toContain('3');
 state.setFollowed('ARG',true);state.setScheduleFilters({followOnly:true,stage:'group'});app().innerHTML=await view();
 expect(ids()).toEqual(['/match/1','/match/2']);expect(app().querySelector('input').checked).toBe(true);expect(app().querySelector('[data-filter=group]').getAttribute('aria-pressed')).toBe('true');
 expect(app().textContent).toContain('静态演示数据');
});
it('distinguishes no follows, no matches and data errors without clearing state',async()=>{
 await view();state.setScheduleFilters({followOnly:true});app().innerHTML=await view();expect(app().textContent).toContain('还没有关注球队');expect(app().querySelector('a[href="#/teams"]')).not.toBeNull();
 state.setFollowed('ARG',true);state.setScheduleFilters({stage:'final'});app().innerHTML=await view();expect(app().textContent).toContain('当前筛选条件下没有比赛');
 const store=await import('../src/store.js');store.clearDataCache();fetch.mockResolvedValue({ok:false});app().innerHTML=await view();expect(app().textContent).toContain('赛事数据加载失败');expect(state.getSnapshot()).toMatchObject({teamCodes:['ARG'],followOnly:true,stage:'final'});
});
it('delegates checkbox and stages synchronously; rerender reads the latest intent',async()=>{
 app().innerHTML=await view();state.setFollowed('BRA',true);const refresh=vi.fn(async()=>{app().innerHTML=await view();return {committed:true}});const dispose=init({root:app(),state,refresh});
 const input=app().querySelector('input');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));app().querySelector('[data-filter=final]').click();
 expect(state.getSnapshot()).toMatchObject({followOnly:true,stage:'final'});await vi.waitFor(()=>expect(ids()).toEqual(['/match/3']));expect(refresh).toHaveBeenCalledTimes(2);dispose();
});
