// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
let router;
beforeEach(async () => {
  vi.resetModules();
  router = await import('../src/router.js');
  document.body.innerHTML = '<div id="app"><button data-follow-focus="follow-only">old</button></div>';
  window.scrollTo = vi.fn();
  location.hash = '#/schedule';
});
afterEach(() => vi.restoreAllMocks());

it('preserves controls while rendering, then restores focus and scroll only for control updates', async () => {
  let finish;
  router.addRoute(/^\/schedule$/, () => new Promise(resolve=>{ finish=resolve; }));
  const old = document.querySelector('button'); old.focus();
  const pending = router.handleRoute({preserveScroll:true,focusKey:'follow-only'});
  expect(document.querySelector('button')).toBe(old);
  finish('<button data-follow-focus="follow-only">new</button>');
  expect(await pending).toEqual({committed:true,path:'/schedule'});
  expect(document.activeElement.textContent).toBe('new');
  expect(window.scrollTo).not.toHaveBeenCalled();
});
it('does not let an older response commit or steal focus', async () => {
  let finish;
  router.addRoute(/^\/schedule$/, () => new Promise(resolve=>{finish=resolve;}));
  router.addRoute(/^\/teams$/, async()=>'<h1>teams</h1>');
  const old = router.handleRoute({preserveScroll:true,focusKey:'follow-only'});
  location.hash='#/teams';
  expect((await router.handleRoute()).committed).toBe(true);
  finish('<button data-follow-focus="follow-only">obsolete</button>');
  expect(await old).toEqual({committed:false,path:'/schedule'});
  expect(document.querySelector('#app').textContent).toBe('teams');
  expect(window.scrollTo).toHaveBeenCalledWith(0,0);
});
it('keeps ordinary Event calls compatible and ignores unsafe focus selectors', async () => {
  router.addRoute(/^\/schedule$/, async()=>'<button data-follow-focus="follow-only">safe</button>');
  expect((await router.handleRoute(new Event('hashchange'))).committed).toBe(true);
  expect(window.scrollTo).toHaveBeenCalledWith(0,0);
  await expect(router.handleRoute({preserveScroll:true,focusKey:'[autofocus]'})).resolves.toMatchObject({committed:true});
  expect(document.activeElement).toBe(document.body);
});
it('reports a missing app without crashing', async () => {
  document.body.innerHTML='';
  expect(await router.handleRoute()).toEqual({committed:false,path:'/schedule'});
});
