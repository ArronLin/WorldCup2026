// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { teams, memoryStorage } from './fixtures/follow-teams.js';
let createFollowState, initFollowTeams, consumeRetry;
beforeEach(async()=>{
  vi.resetModules();
  ({createFollowState}=await import('../src/features/follow-teams/state.js'));
  ({initFollowTeams,consumeRetry}=await import('../src/features/follow-teams/controller.js'));
  document.body.innerHTML='<div id="app"><button data-follow-action="toggle" data-team="ARG" data-follow-focus="follow-team">follow</button><button data-follow-action="retry" data-follow-focus="follow-retry">retry</button><button>unrelated</button></div>';
  location.hash='#/team/ARG';
});
afterEach(()=>vi.restoreAllMocks());
it('delegates once, updates real state synchronously and supports disposal',async()=>{
  const state=createFollowState({storage:memoryStorage()});state.initialize(teams);
  const refresh=vi.fn(async()=>({committed:true}));const root=document.querySelector('#app');
  const dispose=initFollowTeams({root,state,refresh});
  expect(initFollowTeams({root,state,refresh})).toBe(dispose);
  root.querySelector('[data-follow-action="toggle"]').click();
  expect(state.getSnapshot().teamCodes).toEqual(['ARG']);
  await Promise.resolve();expect(refresh).toHaveBeenCalledOnce();
  root.querySelector('button:last-child').click();expect(refresh).toHaveBeenCalledOnce();
  dispose();root.querySelector('button').click();expect(refresh).toHaveBeenCalledOnce();
});
it('consumes retry once, disables duplicate retries and recovers after completion',async()=>{
  let finish;const refresh=vi.fn(()=>new Promise(r=>{finish=r}));
  const root=document.querySelector('#app');const dispose=initFollowTeams({root,refresh});
  const button=root.querySelector('[data-follow-action="retry"]');button.click();button.click();
  expect(button.disabled).toBe(true);expect(refresh).toHaveBeenCalledOnce();
  expect(consumeRetry()).toBe(true);expect(consumeRetry()).toBe(false);
  finish({committed:true});await Promise.resolve();await Promise.resolve();
  expect(button.disabled).toBe(false);dispose();
});
it('handles absent roots without creating listeners',()=>{
  expect(typeof initFollowTeams({root:null})).toBe('function');
});
