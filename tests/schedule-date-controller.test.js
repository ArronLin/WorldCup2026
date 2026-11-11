// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prepareDom, dictionaries } from './fixtures/follow-dom.js';
import { deferred, dateTeams, dateMatches } from './fixtures/schedule-date.js';

let state,view,controller,router,refresh,dispose;
const root=()=>document.querySelector('#app');
function clearDate(){root().querySelector('[data-date-action="clear"]').click();}
const field=name=>root().querySelector(`[data-date-field="${name}"]`);
function input(name,value){field(name).value=value;field(name).dispatchEvent(new Event('input',{bubbles:true}));}
function submit(){root().querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
function mount(){root().innerHTML=view.renderDateControls(state.getSnapshot());view.syncDateControls(root(),state.getSnapshot());}
beforeEach(async()=>{
  vi.resetModules();await prepareDom();document.body.insertAdjacentHTML('beforeend','<p id="scheduleDateStatus" role="status" aria-live="polite" aria-atomic="true"></p>');location.hash='#/schedule';
  state=(await import('../src/features/schedule-date-range/state.js')).scheduleDateState;
  view=await import('../src/features/schedule-date-range/view.js');controller=await import('../src/features/schedule-date-range/controller.js');router=await import('../src/router.js');
  refresh=vi.fn(options=>router.handleRoute(options));mount();
  dispose=controller.initScheduleDateRange({root:root(),state,refresh,subscribe:router.subscribeRouteLifecycle});
});
afterEach(()=>{dispose?.();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('US3 lifecycle keeps same-page drafts, discards on actual leave and restores applied on return',async()=>{
  const leaving=deferred();router.addRoute(/^\/schedule\/?$/,async()=>view.renderDateControls(state.getSnapshot()));router.addRoute(/^\/teams$/,()=>leaving.promise);
  await router.handleRoute({preserveScroll:true});input('start','2026-06-11');submit();await refresh.mock.results.at(-1).value;input('end','bad');submit();await refresh.mock.results.at(-1).value;
  const saved=state.getSnapshot();await router.handleRoute({preserveScroll:true});location.hash='#/schedule/';await router.handleRoute({preserveScroll:true});expect(state.getSnapshot()).toEqual(saved);
  document.querySelector('#themeToggle').click();expect(state.getSnapshot()).toEqual(saved);
  location.hash='#/teams';const away=router.handleRoute();
  expect(state.getSnapshot()).toMatchObject({draft:saved.applied,applied:saved.applied,errors:{start:null,end:null},dirty:false});
  leaving.resolve('<p>teams</p>');await away;location.hash='#/schedule';await router.handleRoute();expect(field('start').value).toBe('2026-06-11');expect(field('end').value).toBe('');
});

it('US3 focus preserves latest editing and selection, including moving away and back',async()=>{
  const gate=deferred();router.addRoute(/^\/schedule$/,()=>gate.promise);
  field('start').focus();input('start','2026-06-11');submit();
  field('end').focus();field('start').focus();input('start','2026-06-');field('start').setSelectionRange(2,5,'backward');
  gate.resolve(view.renderDateControls(state.getSnapshot()));await refresh.mock.results[0].value;
  expect(document.activeElement).toBe(field('start'));expect(field('start').value).toBe('2026-06-');expect([field('start').selectionStart,field('start').selectionEnd,field('start').selectionDirection]).toEqual([2,5,'backward']);
  expect(state.getSnapshot()).toMatchObject({applied:{start:'2026-06-11'},dirty:true});expect(root().querySelector('[data-date-pending]').hidden).toBe(false);
});

for(const identity of ['follow-only','schedule-match:101','schedule-choose-teams','shell-nav:/teams','themeToggle']){
  it(`US3 focus preserves the latest available ${identity}`,async()=>{
    const outer=identity.startsWith('shell-')||identity==='themeToggle';
    const attr=identity==='follow-only'?'data-follow-focus':'data-route-focus';
    const markup=`<button ${attr}="${identity}">target</button>`;
    if(identity!=='themeToggle')(outer?document.querySelector('#navLinks'):root()).insertAdjacentHTML('beforeend',markup);
    const target=()=>identity==='themeToggle'?document.querySelector('#themeToggle'):document.querySelector(`[${attr}="${identity}"]`);
    const gate=deferred();router.addRoute(/^\/schedule$/,()=>gate.promise);submit();target().focus();
    if(identity.startsWith('shell-'))document.querySelector('#navLinks').innerHTML=markup;
    gate.resolve(view.renderDateControls(state.getSnapshot())+(outer?'':markup));await refresh.mock.results[0].value;
    expect(document.activeElement).toBe(target());
  });
}

for(const unavailable of ['removed','hidden','disabled','inert']){
  it(`US3 focus falls back when latest target is ${unavailable}`,async()=>{
    root().insertAdjacentHTML('beforeend','<button data-route-focus="schedule-match:101">match</button>');
    const gate=deferred();router.addRoute(/^\/schedule$/,()=>gate.promise);input('start','bad');submit();root().querySelector('[data-route-focus]').focus();
    const markup=unavailable==='removed'?'':`<div ${unavailable==='inert'?'inert':''}><button data-route-focus="schedule-match:101" ${unavailable==='inert'?'':unavailable}>match</button></div>`;
    gate.resolve(view.renderDateControls(state.getSnapshot())+markup);await refresh.mock.results[0].value;
    expect(document.activeElement).toBe(field('start'));expect(state.getSnapshot().errors.start).toBe('invalid-date');
  });
}

it('US3 focus keeps the latest invalid submission and ignores stale successful completions',async()=>{
  const gates=[deferred(),deferred(),deferred()];let i=0;router.addRoute(/^\/schedule$/,()=>gates[i++].promise);
  input('start','2026-06-11');submit();input('start','2026-06-12');submit();input('end','bad');submit();
  gates[2].resolve(view.renderDateControls(state.getSnapshot()));await refresh.mock.results[2].value;
  const committed=root().firstElementChild;expect(document.activeElement).toBe(field('end'));expect(state.getSnapshot().applied.start).toBe('2026-06-12');
  gates[0].resolve('<p>stale</p>');gates[1].resolve('<p>older</p>');await Promise.all(refresh.mock.results.slice(0,2).map(r=>r.value));
  expect(root().firstElementChild).toBe(committed);expect(document.activeElement).toBe(field('end'));expect(field('end').value).toBe('bad');
});

it('US3 focus uses the real schedule identities and a single persistent count announcement',async()=>{
  const schedule=(await import('../src/views/schedule.js')).default;router.addRoute(/^\/schedule$/,schedule);router.addRoute(/^\/teams$/,async()=>'<p>teams</p>');
  await router.handleRoute({preserveScroll:true});
  expect(root().querySelector('.match-card')?.dataset.routeFocus).toBe('schedule-match:1');
  const live=document.querySelector('#scheduleDateStatus');expect(live.textContent).toBe(root().querySelector('[data-follow-count]').textContent);expect(root().querySelector('[data-follow-count]').hasAttribute('role')).toBe(false);
  input('start','9999-12-31');submit();await refresh.mock.results.at(-1).value;expect(root().querySelector('.follow-empty a').dataset.routeFocus).toBe('schedule-choose-teams');expect(live.textContent).toContain('0');
  const store=await import('../src/store.js');store.clearDataCache();fetch.mockResolvedValue({ok:false});await router.handleRoute({preserveScroll:true});expect(live.textContent).toBe('');
  location.hash='#/teams';await router.handleRoute();expect(live.textContent).toBe('');expect(document.querySelector('#scheduleDateStatus')).toBe(live);
});

it('restores last applied dates after a real data error and delegated retry',async()=>{
  const schedule=(await import('../src/views/schedule.js')).default;router.addRoute(/^\/schedule$/,schedule);
  const original=fetch.getMockImplementation();await router.handleRoute({preserveScroll:true});
  input('start','2026-06-12');input('end','2026-06-12');submit();await refresh.mock.results.at(-1).value;
  const store=await import('../src/store.js');store.clearDataCache();fetch.mockResolvedValue({ok:false});await router.handleRoute({preserveScroll:true});
  expect(root().querySelector('[data-date-form]')).toBeNull();expect(document.querySelector('#scheduleDateStatus').textContent).toBe('');
  fetch.mockImplementation(original);
  const follow=(await import('../src/features/follow-teams/controller.js')).initFollowTeams({root:root(),refresh:options=>router.handleRoute(controller.withScheduleDateFocus(options))});
  try{
    root().querySelector('[data-follow-action="retry"]').click();
    await vi.waitFor(()=>expect(field('start')?.value).toBe('2026-06-12'));
    expect([...root().querySelectorAll('.match-card')].map(card=>card.dataset.route)).toEqual(['/match/2']);
    expect(root().querySelector('[data-follow-count]').textContent).toContain('1');expect(state.getSnapshot().applied).toEqual({start:'2026-06-12',end:'2026-06-12'});
  }finally{follow();}
});

it('clears synchronously and preserves a later draft through a pending clear refresh',async()=>{
  const gate=deferred();router.addRoute(/^\/schedule$/,()=>gate.promise);
  state.setDraft('start','2026-06-11');state.apply();state.setDraft('end','bad');state.apply();mount();
  const clear=root().querySelector('[data-date-action="clear"]');expect(clear).not.toBeNull();clearDate();
  expect(state.getSnapshot()).toMatchObject({draft:{start:'',end:''},applied:{start:'',end:''},errors:{start:null,end:null},dirty:false});
  expect(field('start').value).toBe('');input('end','2026-');gate.resolve(view.renderDateControls(state.getSnapshot()));await refresh.mock.results[0].value;
  expect(field('end').value).toBe('2026-');expect(root().querySelector('[data-date-pending]').hidden).toBe(false);
});

it('repeated clear keeps other filters and defaults focus to the clear button',async()=>{
  router.addRoute(/^\/schedule$/,async()=>view.renderDateControls(state.getSnapshot()));
  const follow=(await import('../src/features/follow-teams/state.js')).followState;
  follow.initialize(dateTeams);follow.setFollowed('ARG',true);follow.setScheduleFilters({stage:'group',followOnly:true});const saved=follow.getSnapshot();
  expect(root().querySelector('[data-date-action="clear"]')).not.toBeNull();
  for(let i=0;i<2;i++){clearDate();await refresh.mock.results.at(-1).value;expect(document.activeElement.dataset.dateFocus).toBe('schedule-date-clear');}
  expect(follow.getSnapshot()).toEqual(saved);expect(state.getSnapshot().dirty).toBe(false);
});

it('stores input synchronously without rerendering or applying it',()=>{
  const old=field('start');input('start','2026-06-');
  expect(state.getSnapshot()).toMatchObject({draft:{start:'2026-06-'},applied:{start:''},dirty:true});
  expect(field('start')).toBe(old);expect(refresh).not.toHaveBeenCalled();expect(root().querySelector('[data-date-pending]').hidden).toBe(false);
});

it('reads actual input on submit before awaiting refresh, then restores default focus',async()=>{
  router.addRoute(/^\/schedule$/,async()=>view.renderDateControls(state.getSnapshot()));
  field('start').value='2026-06-11';field('end').value='2026-06-12';submit();
  expect(state.getSnapshot().applied).toEqual({start:'2026-06-11',end:'2026-06-12'});
  await vi.waitFor(()=>expect(document.activeElement.dataset.dateFocus).toBe('schedule-date-apply'));
  expect(refresh).toHaveBeenCalledTimes(1);expect(field('start').value).toBe('2026-06-11');
});

it('refreshes invalid submissions while preserving applied conditions and focusing the first error',async()=>{
  router.addRoute(/^\/schedule$/,async()=>view.renderDateControls(state.getSnapshot()));
  state.setDraft('start','2026-06-11');state.apply();mount();
  field('start').value='bad';field('end').value='also bad';submit();
  expect(state.getSnapshot()).toMatchObject({draft:{start:'bad',end:'also bad'},applied:{start:'2026-06-11',end:''},errors:{start:'invalid-date',end:'invalid-date'}});
  expect(refresh).toHaveBeenCalledTimes(1);
  await vi.waitFor(()=>expect(document.activeElement.dataset.dateFocus).toBe('schedule-date-start'));
  expect(root().querySelector('[data-date-summary]').textContent).toContain('2026年6月11日');
});

it('hydrates latest raw drafts and pending state after a delayed successful submission',async()=>{
  const pending=deferred();router.addRoute(/^\/schedule$/,()=>pending.promise);
  input('start','2026-06-11');submit();
  expect(state.getSnapshot().applied.start).toBe('2026-06-11');
  const oldMarkup=view.renderDateControls(state.getSnapshot());
  input('start','2026-06-');pending.resolve(oldMarkup);
  await vi.waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));await refresh.mock.results[0].value;
  expect(field('start').value).toBe('2026-06-');expect(root().querySelector('[data-date-pending]').hidden).toBe(false);
  expect(root().querySelector('[data-date-summary]').textContent).toContain('2026年6月11日');
});

it('initializes once and fully detaches delegated handlers and subscriptions',async()=>{
  router.addRoute(/^\/schedule$/,async()=>view.renderDateControls(state.getSnapshot()));
  const again=controller.initScheduleDateRange({root:root(),state,refresh,subscribe:router.subscribeRouteLifecycle});
  field('start').value='2026-06-11';submit();expect(refresh).toHaveBeenCalledTimes(1);await refresh.mock.results[0].value;
  again();input('start','2026-06-12');expect(state.getSnapshot().draft.start).toBe('2026-06-11');
  await router.handleRoute({preserveScroll:true});expect(field('start').value).toBe('');
});

it('US3 stale disposal cannot duplicate a new instance or remove its focus wrapper',async()=>{
  router.addRoute(/^\/schedule$/,async()=>view.renderDateControls(state.getSnapshot()));
  const options={root:root(),state,refresh,subscribe:router.subscribeRouteLifecycle};
  const oldDispose=dispose,sharedOldDispose=controller.initScheduleDateRange(options);
  expect(sharedOldDispose).toBe(oldDispose);
  const oldFocus=controller.withScheduleDateFocus({}, {kind:'key',key:'schedule-date-apply'});
  oldDispose();
  const currentDispose=controller.initScheduleDateRange(options);
  sharedOldDispose();
  const currentFocus=controller.withScheduleDateFocus({preserveScroll:true}, {kind:'key',key:'schedule-date-apply'});
  const repeatedDispose=controller.initScheduleDateRange(options);
  try{
    input('start','2026-06-12');submit();
    await Promise.all(refresh.mock.results.map(result=>result.value));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(repeatedDispose).toBe(currentDispose);
    expect(oldFocus.resolveFocusTarget()).toEqual({target:null,fallback:null});
    expect(currentFocus.resolveFocusTarget).toBeTypeOf('function');
    const end=field('end');end.focus();
    expect(currentFocus.resolveFocusTarget()).toEqual({target:{kind:'key',key:'schedule-date-end'},fallback:{kind:'key',key:'schedule-date-apply'}});
    expect(state.getSnapshot().applied.start).toBe('2026-06-12');
  }finally{
    currentDispose();repeatedDispose();
  }
});

it('US3 disposal unsubscribes once and removes every active handler after reinitialization',async()=>{
  dispose();
  router.addRoute(/^\/schedule$/,async()=>view.renderDateControls(state.getSnapshot()));
  const subscriptions=[];
  const subscribe=vi.fn(listener=>{
    const unsubscribe=vi.fn(router.subscribeRouteLifecycle(listener));
    subscriptions.push(unsubscribe);return unsubscribe;
  });
  const options={root:root(),state,refresh,subscribe};
  const currentDispose=controller.initScheduleDateRange(options);
  const sharedDispose=controller.initScheduleDateRange(options);
  const pendingFocus=controller.withScheduleDateFocus({}, {kind:'key',key:'schedule-date-apply'});
  expect(subscribe).toHaveBeenCalledTimes(1);
  currentDispose();sharedDispose();
  expect(subscriptions[0]).toHaveBeenCalledTimes(1);
  const snapshot=state.getSnapshot();
  input('start','2026-06-12');submit();clearDate();field('end').focus();
  expect(refresh).not.toHaveBeenCalled();expect(state.getSnapshot()).toEqual(snapshot);
  expect(pendingFocus.resolveFocusTarget()).toEqual({target:null,fallback:null});
  const unchangedOptions={preserveScroll:true};
  expect(controller.withScheduleDateFocus(unchangedOptions)).toBe(unchangedOptions);
  state.setDraft('start','later draft');
  await router.handleRoute({preserveScroll:true});
  expect(field('start').value).toBe('');
  expect(state.getSnapshot().draft.start).toBe('later draft');
});

it('integrates the actual schedule view, data and router instead of a replacement selector',async()=>{
  fetch.mockImplementation(async url=>{
    const lang=String(url).match(/i18n\/(zh|en)\.json/)?.[1];
    return {ok:true,json:async()=>lang?dictionaries[lang]:String(url).includes('/teams.json')?dateTeams:String(url).includes('/matches.json')?dateMatches:{}};
  });
  const schedule=(await import('../src/views/schedule.js')).default;router.addRoute(/^\/schedule$/,schedule);
  await router.handleRoute({preserveScroll:true});
  expect(root().querySelector('[data-date-form]')).not.toBeNull();
  input('start','2026-06-12');input('end','2026-06-12');submit();await refresh.mock.results[0].value;
  expect([...root().querySelectorAll('.match-card')].map(card=>card.dataset.route)).toEqual(['/match/102']);
  expect(root().querySelector('[data-follow-count]').textContent).toContain('1');
  expect(root().querySelector('[data-date-summary]').textContent).toContain('2026年6月12日');
});
