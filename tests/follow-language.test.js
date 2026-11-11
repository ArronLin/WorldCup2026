// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {prepareDom} from './fixtures/follow-dom.js';
import { dictionaries } from './fixtures/follow-dom.js';
import { deferred } from './fixtures/schedule-date.js';
import { readFileSync } from 'node:fs';
let i18n;
const listeners=[];
beforeEach(async()=>{vi.resetModules();i18n=await prepareDom()});afterEach(async()=>{
 for(const [target,name,listener,options] of listeners.splice(0))target.removeEventListener(name,listener,options);
 const controller=await import('../src/features/schedule-date-range/controller.js');controller.initScheduleDateRange()();
 vi.restoreAllMocks();vi.unstubAllGlobals();delete window.__refreshChat;
});
const dateField=name=>document.querySelector(`[data-date-field="${name}"]`);
function editDate(name,value){dateField(name).value=value;dateField(name).dispatchEvent(new Event('input',{bubbles:true}));}
async function bootApp(){
 document.body.innerHTML=readFileSync('index.html','utf8').match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
 for(const target of [window,document]){
  const add=target.addEventListener.bind(target);vi.spyOn(target,'addEventListener').mockImplementation((name,listener,options)=>{listeners.push([target,name,listener,options]);add(name,listener,options);});
 }
 location.hash='#/schedule';await import('../src/app.js');await vi.waitFor(()=>expect(dateField('start')).not.toBeNull());
 return (await import('../src/features/schedule-date-range/state.js')).scheduleDateState;
}
function holdDictionaries(){
 const original=fetch.getMockImplementation(),requests=[];
 fetch.mockImplementation(url=>{const lang=String(url).match(/i18n\/(zh|en)\.json/)?.[1];if(!lang)return original(url);const gate=deferred();requests.push({lang,gate});return gate.promise;});
 return requests;
}
async function releaseDictionary(request){
 const router=await import('../src/router.js');let off;
 const rendered=new Promise(resolve=>{off=router.subscribeRouteLifecycle(event=>{if(event.type==='rendered'){off();resolve();}});});
 request.gate.resolve({ok:true,json:async()=>dictionaries[request.lang]});await rendered;expect(document.documentElement.lang).toBe(request.lang);
}

it('US3 actual app keeps editing and focus during dictionary loading and translates all date feedback',async()=>{
 const state=await bootApp();editDate('start','2026-06-11');state.apply();editDate('end','bad');document.querySelector('[data-date-form]').requestSubmit();await vi.waitFor(()=>expect(dateField('end').getAttribute('aria-invalid')).toBe('true'));
 const requests=holdDictionaries();document.querySelector('#langToggle').click();dateField('start').focus();editDate('start','2026-06-');dateField('start').setSelectionRange(2,5);
 await releaseDictionary(requests[0]);await vi.waitFor(()=>expect(document.querySelector('[data-date-action="apply"]').textContent).toBe('Apply dates'));
 expect(document.activeElement).toBe(dateField('start'));expect(dateField('start').value).toBe('2026-06-');expect(dateField('start').selectionStart).toBe(2);
 expect(state.getSnapshot()).toMatchObject({applied:{start:'2026-06-11'},errors:{end:'invalid-date'},dirty:true});
 for(const text of ['Start date','End date','Apply dates','Clear dates','Format: YYYY-MM-DD','Filter by the match dates in the tournament data','From June 11, 2026','Date changes have not been applied','Enter a valid date'])expect(document.querySelector('[data-date-form]').textContent).toContain(text);
 expect(document.querySelector('[data-date-form]').textContent).not.toMatch(/日期|请输入/);
});

it('US3 actual app keeps default language focus and stable rebuilt navigation identity',async()=>{
 await bootApp();const requests=holdDictionaries();document.querySelector('#langToggle').click();await releaseDictionary(requests[0]);await vi.waitFor(()=>expect(document.activeElement.id).toBe('langToggle'));
 document.querySelector('#langToggle').click();const nav=document.querySelector('#navLinks a[href="#/teams"]');nav.focus();await releaseDictionary(requests[1]);
 await vi.waitFor(()=>expect(document.activeElement).toBe(document.querySelector('#navLinks a[href="#/teams"]')));expect(document.activeElement.dataset.routeFocus).toBe('shell-nav:/teams');
});

it('US3 older language completion cannot erase the newer pending intent context',async()=>{
 await bootApp();const requests=holdDictionaries();const button=document.querySelector('#langToggle');button.click();button.click();dateField('end').focus();editDate('end','new draft');
 requests[0].gate.resolve({ok:true,json:async()=>dictionaries.en});await new Promise(resolve=>setTimeout(resolve,0));await releaseDictionary(requests[1]);
 await vi.waitFor(()=>expect(document.activeElement).toBe(dateField('end')));expect(dateField('end').value).toBe('new draft');expect(document.documentElement.lang).toBe('zh');
});

it('US3 leaving and returning invalidates a pending language focus context',async()=>{
 await bootApp();const requests=holdDictionaries();document.querySelector('#langToggle').click();dateField('end').focus();
 const router=await import('../src/router.js');location.hash='#/teams';await router.handleRoute();location.hash='#/schedule';await router.handleRoute();
 await releaseDictionary(requests[0]);await vi.waitFor(()=>expect(document.querySelector('[data-date-action="apply"]').textContent).toBe('Apply dates'));
 expect(document.activeElement).not.toBe(dateField('end'));expect(dateField('end').value).toBe('');
});

it('US3 actual app wraps stage refreshes and non-button language events without applying drafts',async()=>{
 const state=await bootApp();editDate('start','2026-06-11');state.apply();
 document.querySelector('[data-filter="group"]').click();dateField('end').focus();editDate('end','unapplied');
 await vi.waitFor(()=>expect(document.querySelector('[data-filter="group"]').getAttribute('aria-pressed')).toBe('true'));
 expect(document.activeElement.id).toBe('schedule-date-end');expect(state.getSnapshot()).toMatchObject({draft:{end:'unapplied'},applied:{end:''},dirty:true});
 const original=dateField('end');await i18n.setLang('en');await vi.waitFor(()=>expect(dateField('end')).not.toBe(original));
 expect(document.activeElement.id).toBe('schedule-date-end');expect(dateField('end').value).toBe('unapplied');
 const before=state.getSnapshot();document.querySelector('#themeToggle').click();expect(state.getSnapshot()).toEqual(before);expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});
it('commits only the latest language and dictionary when responses arrive in reverse order',async()=>{
 const requests=[];fetch.mockImplementation(url=>new Promise(resolve=>requests.push({url,resolve})));
 const event=vi.fn();document.addEventListener('langchange',event);
 try{const old=i18n.setLang('en');const latest=i18n.setLang('zh');
 requests[1].resolve({ok:true,json:async()=>({'follow.only':'最新中文'})});await latest;
 requests[0].resolve({ok:true,json:async()=>({'follow.only':'stale English'})});await old;
 expect(i18n.t('follow.only')).toBe('最新中文');expect(i18n.getLang()).toBe('zh');expect(document.documentElement.lang).toBe('zh');expect(window.__lang).toBe('zh');expect(event).toHaveBeenCalledTimes(1);expect(localStorage.getItem('wc2026-lang')).toBe('zh');
 }finally{document.removeEventListener('langchange',event)}
});
it('toggles from the pending intent, while no partial language commit occurs',async()=>{
 const requests=[];fetch.mockImplementation(url=>new Promise(resolve=>requests.push({url,resolve})));
 const a=i18n.toggleLang();expect(i18n.getLang()).toBe('zh');expect(document.documentElement.lang).toBe('zh');const b=i18n.toggleLang();
 expect(requests.map(r=>r.url)).toEqual(['i18n/en.json','i18n/zh.json']);requests[1].resolve({ok:true,json:async()=>({message:'zh'})});await b;requests[0].resolve({ok:true,json:async()=>({message:'en'})});await a;expect(i18n.t('message')).toBe('zh');
});
it('supports switching with storage denied and handles failed dictionary loading',async()=>{
 vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw Error('denied')});await i18n.setLang('en');expect(i18n.getLang()).toBe('en');expect(i18n.t('follow.follow')).toBe('Follow team');
 fetch.mockRejectedValue(Error('offline'));await i18n.setLang('zh');expect(i18n.t('missing')).toBe('missing');expect(document.documentElement.lang).toBe('zh');
});
