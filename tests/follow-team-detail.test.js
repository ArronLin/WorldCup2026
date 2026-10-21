// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prepareDom, installFetch } from './fixtures/follow-dom.js';
import { teams } from './fixtures/follow-teams.js';
let view, state;
beforeEach(async()=>{
  vi.resetModules(); await prepareDom();
  view=(await import('../src/views/team-detail.js')).default;
  state=(await import('../src/features/follow-teams/state.js')).followState;
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});

it('renders a real accessible follow control and preserves all original team matches', async()=>{
  document.querySelector('#app').innerHTML=await view('ARG');
  const button=document.querySelector('[data-follow-action="toggle"]');
  expect(button).not.toBeNull();expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(button.textContent).toBe('关注球队');
  expect(document.querySelectorAll('[data-route^="/match/"]')).toHaveLength(2);
  state.setFollowed('ARG',true);
  document.querySelector('#app').innerHTML=await view('ARG');
  expect(document.querySelector('[data-follow-action="toggle"]').getAttribute('aria-pressed')).toBe('true');
});
it.each([undefined,'','arg','XXX','ARG<script>'])('rejects missing, invalid and unknown team codes: %s',async code=>{
  const html=await view(code);document.querySelector('#app').innerHTML=html;
  expect(document.querySelector('[data-follow-action="toggle"]')).toBeNull();
  expect(document.querySelector('a[href="#/teams"]')).not.toBeNull();
  expect(document.querySelector('#app').textContent).toContain('找不到球队');
});
it('separates data failure from unknown team and never initializes or clears a saved list',async()=>{
  const saved=JSON.stringify({version:1,teamCodes:['ARG']});localStorage.setItem('wc2026-followed-teams',saved);
  fetch.mockImplementation(async()=>({ok:false,status:503}));
  const html=await view('ARG');document.querySelector('#app').innerHTML=html;
  expect(document.querySelector('#app').textContent).toContain('赛事数据加载失败');
  expect(document.querySelector('[data-follow-action="retry"]')).not.toBeNull();
  expect(state.getSnapshot().initialized).toBe(false);
  expect(localStorage.getItem('wc2026-followed-teams')).toBe(saved);
});
it('shows corrupted/read/write failures as warnings without suppressing valid browsing',async()=>{
  localStorage.setItem('wc2026-followed-teams','{broken');
  document.querySelector('#app').innerHTML=await view('ARG');
  expect(document.querySelector('[role="status"]').textContent).toContain('关注记录已损坏');
  expect(document.querySelectorAll('[data-route^="/match/"]')).toHaveLength(2);
});
it('boots the actual app and permits temporary follow when all localStorage access is denied',async()=>{
  vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw new Error('denied')});
  vi.doMock('../src/features/chat/index.js',()=>({initChat:()=>{},refreshChat:()=>{}}));
  location.hash='#/team/ARG';
  await import('../src/app.js');
  await vi.waitFor(()=>expect(document.querySelector('[data-follow-action="toggle"]')).not.toBeNull());
  document.querySelector('[data-follow-action="toggle"]').click();
  await vi.waitFor(()=>expect(state.getSnapshot().teamCodes).toEqual(['ARG']));
  expect(state.getSnapshot().saveIssue).toBe('failed');
});
