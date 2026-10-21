// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {prepareDom} from './fixtures/follow-dom.js';
let i18n;
beforeEach(async()=>{vi.resetModules();i18n=await prepareDom()});afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});
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
