// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { deferred } from './fixtures/schedule-date.js';
let router;
beforeEach(async () => {
  vi.resetModules();
  router = await import('../src/router.js');
  document.body.innerHTML = '<div id="app"><button data-follow-focus="follow-only">old</button></div>';
  window.scrollTo = vi.fn();
  location.hash = '#/schedule';
});
afterEach(() => vi.restoreAllMocks());

it('keeps control refreshes visible during synchronous focus restoration', async () => {
  router.addRoute(/^\/schedule$/, async () => '<button data-follow-focus="follow-only">filter</button>');
  await router.handleRoute({ preserveScroll: true, focusKey: 'follow-only' });
  expect(document.querySelector('#app').style.animation).toBe('none');
  expect(document.activeElement.dataset.followFocus).toBe('follow-only');
  await router.handleRoute();
  expect(document.querySelector('#app').style.animation).toBe('');
});

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

it('notifies navigation synchronously and only committed renders, and unsubscribes', async () => {
  const pendingView = deferred();
  const events = [];
  const dispose = router.subscribeRouteLifecycle(event => {
    events.push({ ...event, text: document.querySelector('#app').textContent });
  });
  router.addRoute(/^\/schedule\/?$/, () => pendingView.promise);
  const pending = router.handleRoute({ preserveScroll: true });
  expect(events).toEqual([{ type: 'navigation', from: '', to: '/schedule', navigationId: 1, text: 'old' }]);
  pendingView.resolve('<p>ready</p>');
  await pending;
  expect(events[1]).toEqual({ type: 'rendered', path: '/schedule', navigationId: 1, text: 'ready' });
  await router.handleRoute({ preserveScroll: true });
  expect(events.filter(e => e.type === 'navigation')).toHaveLength(1);
  location.hash = '#/schedule/';
  await router.handleRoute({ preserveScroll: true });
  expect(events.at(-2)).toMatchObject({ type: 'navigation', from: '/schedule', to: '/schedule/' });
  const count = events.length;
  dispose();
  await router.handleRoute();
  expect(events).toHaveLength(count);
});

it('never resolves focus or notifies rendered for obsolete responses', async () => {
  const old = deferred();
  let requests = 0;
  router.addRoute(/^\/schedule$/, () => ++requests === 1 ? old.promise : '<p>latest</p>');
  const events = [];
  router.subscribeRouteLifecycle(e => events.push(e));
  const resolver = vi.fn();
  const first = router.handleRoute({ preserveScroll: true, resolveFocusTarget: resolver });
  await router.handleRoute({ preserveScroll: true });
  old.resolve('<p>old response</p>');
  expect(await first).toMatchObject({ committed: false });
  expect(resolver).not.toHaveBeenCalled();
  expect(events.filter(e => e.type === 'rendered')).toHaveLength(1);
  expect(events.at(-1)).toMatchObject({ navigationId: 2 });
});

it('resolves before replacement and focuses only after current state hydration', async () => {
  const app = document.querySelector('#app');
  app.innerHTML = '<input data-date-focus="schedule-date-start" value="draft"><button data-date-focus="schedule-date-apply">Apply</button>';
  const old = app.querySelector('input'); old.focus(); old.setSelectionRange(1, 3);
  const order = [];
  router.subscribeRouteLifecycle(event => {
    if (event.type !== 'rendered') return;
    order.push('hydrate');
    app.querySelector('input').value = 'draft';
    app.querySelector('input').addEventListener('focus', () => order.push('focus'));
  });
  router.addRoute(/^\/schedule$/, async () => '<input data-date-focus="schedule-date-start" value=""><button data-date-focus="schedule-date-apply">Apply</button>');
  await router.handleRoute({ preserveScroll: true, resolveFocusTarget: () => {
    expect(app.querySelector('input')).toBe(old);
    order.push('resolve');
    return { target: { kind: 'key', key: 'schedule-date-start' }, fallback: { kind: 'key', key: 'schedule-date-apply' } };
  } });
  expect(order).toEqual(['resolve', 'hydrate', 'focus']);
  expect(document.activeElement).toBe(app.querySelector('input'));
  expect(document.activeElement.selectionStart).toBe(1);
  expect(document.activeElement.selectionEnd).toBe(3);
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it.each([
  '',
  '<input data-date-focus="schedule-date-start" disabled>',
  '<fieldset disabled><input data-date-focus="schedule-date-start"></fieldset>',
  '<div hidden><input data-date-focus="schedule-date-start"></div>',
  '<div inert><input data-date-focus="schedule-date-start"></div>',
  '<div style="display:none"><input data-date-focus="schedule-date-start"></div>',
  '<input style="visibility:hidden" data-date-focus="schedule-date-start">',
  '<span data-date-focus="schedule-date-start">cannot focus</span>',
])('falls back after DOM/state makes a candidate unavailable: %s', async candidate => {
  router.addRoute(/^\/schedule$/, async () => candidate + '<button data-date-focus="schedule-date-apply">Apply</button>');
  await router.handleRoute({ preserveScroll: true, resolveFocusTarget: () => ({
    target: { kind: 'key', key: 'schedule-date-start' }, fallback: { kind: 'key', key: 'schedule-date-apply' },
  }) });
  expect(document.activeElement.dataset.dateFocus).toBe('schedule-date-apply');
});

it('keeps live shell references, supports exact stable keys and rejects unapproved ones', async () => {
  const shell = document.createElement('button'); shell.id = 'langToggle'; document.body.prepend(shell);
  router.addRoute(/^\/schedule$/, async () => '<a href="#/teams" data-route-focus="shell-nav:/teams">Teams</a><div tabindex="0" data-route-focus="schedule-match:101">Match</div><a href="#/teams" data-route-focus="schedule-choose-teams">Choose</a><button data-date-focus="schedule-date-clear">Clear</button><button data-route-focus="shell-nav:/bad">unsafe</button>');
  await router.handleRoute({ preserveScroll: true, resolveFocusTarget: () => ({ target: { kind: 'element', element: shell } }) });
  expect(document.activeElement).toBe(shell);
  for (const key of ['shell-nav:/teams', 'schedule-match:101', 'schedule-choose-teams', 'schedule-date-clear']) {
    await router.handleRoute({ preserveScroll: true, resolveFocusTarget: () => ({ target: { kind: 'key', key } }) });
    expect(document.activeElement.dataset.routeFocus || document.activeElement.dataset.dateFocus).toBe(key);
  }
  for (const key of ['shell-nav:/bad', 'schedule-match:101x', '[autofocus]']) {
    shell.focus();
    await router.handleRoute({ preserveScroll: true, resolveFocusTarget: () => ({ target: { kind: 'key', key } }) });
    expect(document.activeElement).toBe(shell);
  }
});

it('does not restore an old selection when hydration changes the current input value', async () => {
  document.querySelector('#app').innerHTML = '<input data-date-focus="schedule-date-start" value="previous">';
  const old = document.querySelector('input'); old.focus(); old.setSelectionRange(1, 2);
  router.addRoute(/^\/schedule$/, async () => '<input data-date-focus="schedule-date-start" value="current">');
  await router.handleRoute({ preserveScroll: true, resolveFocusTarget: () => ({ target: { kind: 'key', key: 'schedule-date-start' } }) });
  expect(document.activeElement.value).toBe('current');
  expect(document.activeElement.selectionStart).not.toBe(1);
});
