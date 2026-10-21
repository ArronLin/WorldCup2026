import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { getTournamentSnapshot, clearDataCache, getTeams, getMatches, getTeam, getMatchesByTeam, getTeamTopScorers, getVenues } from '../src/store.js';
import { teams, matches } from './fixtures/follow-teams.js';

const response = data => ({ ok: true, json: async () => data });
beforeEach(() => {
  clearDataCache();
  vi.stubGlobal('fetch', vi.fn(async url => response(url.includes('teams') ? teams : url.includes('matches') ? matches : {})));
});
afterEach(() => vi.unstubAllGlobals());

describe('observable tournament results and legacy cache', () => {
  it('returns the real ready snapshot and deduplicates concurrent fetches', async () => {
    const [a,b] = await Promise.all([getTournamentSnapshot(),getTournamentSnapshot()]);
    expect(a).toEqual({ status: 'ready', teams, matches });
    expect(b).toEqual(a);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await getTeams()).toEqual(teams);
    expect(await getMatches()).toEqual(matches);
    expect(await getTeam('ARG')).toEqual(teams.ARG);
    expect((await getMatchesByTeam('ARG')).map(m=>m.id)).toEqual([1,2]);
    expect(await getTeamTopScorers('ARG')).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('keeps an actually empty match list ready', async () => {
    fetch.mockImplementation(async url => response(url.includes('teams') ? teams : []));
    expect(await getTournamentSnapshot()).toEqual({ status:'ready', teams, matches:[] });
  });
  it.each(['network','http','parse'])('distinguishes %s failures from empty data, including a legacy first caller', async kind => {
    fetch.mockImplementation(async url => {
      if (url.includes('teams')) return response(teams);
      if (kind==='network') throw new Error('network');
      if (kind==='http') return {ok:false,status:503};
      return {ok:true,json:async()=>{throw new SyntaxError('json')}};
    });
    expect(await getMatches()).toEqual([]);
    expect(await getTournamentSnapshot()).toMatchObject({status:'error',dataset:'matches',kind});
    expect(await getTeams()).toEqual(teams);
  });
  it.each([null,[], { ARG: null }, { ARG: {...teams.ARG,code:'BRA'} }].map(bad=>[bad]))('rejects malformed team dictionaries: %j', async bad => {
    fetch.mockImplementation(async url => response(url.includes('teams') ? bad : matches));
    expect(await getTournamentSnapshot()).toMatchObject({status:'error',dataset:'teams',kind:'invalid-data'});
  });
  it.each([{},[{...matches[0],id:'1'}],[{...matches[0],home:{code:'XXX'}}],[{...matches[0],stage:'unknown'}]].map(bad=>[bad]))('rejects malformed match inputs: %j', async bad => {
    fetch.mockImplementation(async url => response(url.includes('teams') ? teams : bad));
    expect(await getTournamentSnapshot()).toMatchObject({status:'error',dataset:'matches',kind:'invalid-data'});
  });
  it('retries just teams/matches and preserves unrelated cached resources', async () => {
    await getVenues();
    fetch.mockImplementation(async () => ({ok:false,status:503}));
    expect((await getTournamentSnapshot()).status).toBe('error');
    fetch.mockImplementation(async url => response(url.includes('teams') ? teams : matches));
    expect((await getTournamentSnapshot()).status).toBe('error');
    expect((await getTournamentSnapshot({retry:true})).status).toBe('ready');
    await getVenues();
    expect(fetch.mock.calls.filter(([url])=>url.includes('venues'))).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it('does not let an old in-flight request replace a retried cache', async () => {
    const resolvers=[];
    fetch.mockImplementation(url => new Promise(resolve=>resolvers.push({url,resolve})));
    const old = getTournamentSnapshot();
    await Promise.resolve();
    fetch.mockImplementation(async url => response(url.includes('teams') ? teams : matches));
    expect((await getTournamentSnapshot({retry:true})).matches).toEqual(matches);
    for(const r of resolvers) r.resolve(response(r.url.includes('teams')?teams:[]));
    await old;
    expect((await getTournamentSnapshot()).matches).toEqual(matches);
  });
});
