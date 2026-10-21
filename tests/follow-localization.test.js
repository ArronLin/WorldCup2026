// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {prepareDom} from './fixtures/follow-dom.js';
it('actual app keeps state, results, warnings, scroll and focused follow control across both languages',async()=>{
 vi.resetModules();const i18n=await prepareDom();location.hash='#/schedule';
 vi.doMock('../src/features/chat/index.js',()=>({initChat(){},refreshChat(){}}));
 const set=Storage.prototype.setItem;const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(k,v){if(k==='wc2026-followed-teams')throw Error('quota');return set.call(this,k,v)});
 try{
 await import('../src/app.js');await vi.waitFor(()=>expect(document.querySelector('[data-follow-focus=follow-only]')).not.toBeNull());
 const state=(await import('../src/features/follow-teams/state.js')).followState;
 state.setFollowed('BRA',true);state.setScheduleFilters({followOnly:true,stage:'final'});
 const router=await import('../src/router.js');await router.handleRoute();
 const snapshot=state.getSnapshot();const input=document.querySelector('[data-follow-focus=follow-only]');input.focus();window.scrollTo.mockClear();
 for(const [lang,label] of [['en','Only followed teams'],['zh','只看已关注球队']]){
 await i18n.setLang(lang);await vi.waitFor(()=>expect(document.querySelector('.follow-controls').textContent).toContain(label));
 expect(document.documentElement.lang).toBe(lang);expect(state.getSnapshot()).toEqual(snapshot);
 expect([...document.querySelectorAll('#app [data-route]')].map(e=>e.dataset.route)).toEqual(['/match/3']);
 expect(document.activeElement.dataset.followFocus).toBe('follow-only');expect(window.scrollTo).not.toHaveBeenCalled();
 expect(document.querySelector('.follow-notice').textContent).toContain(lang==='en'?'Unable to save':'无法保存');
 }
 }finally{spy.mockRestore();vi.restoreAllMocks();vi.unstubAllGlobals()}
});
