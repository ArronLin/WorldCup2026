import { describe, it, expect, vi } from 'vitest';
import { createFollowState, FOLLOW_KEY } from '../src/features/follow-teams/state.js';
import { teams, memoryStorage } from './fixtures/follow-teams.js';
const persisted = codes => JSON.stringify({version:1,teamCodes:codes});
describe('follow state and versioned persistence', () => {
  it('returns the exact flat initial snapshot without touching storage', () => {
    const storage={read:vi.fn(),write:vi.fn()};const state=createFollowState({storage});
    expect(state.getSnapshot()).toEqual({initialized:false,teamCodes:[],followOnly:false,stage:'all',restoreIssue:null,saveIssue:null});
    expect(storage.read).not.toHaveBeenCalled();
    expect(state.setFollowed('ARG',true).initialized).toBe(false);
  });
  it('restores once, validates codes and exposes independent sorted copies', () => {
    const storage=memoryStorage(persisted(['BRA','ARG','ARG','arg','XXX',null,3]));
    const read=vi.spyOn(storage,'read');const write=vi.spyOn(storage,'write');
    const state=createFollowState({storage});
    const snapshot=state.initialize(teams);
    expect(snapshot.teamCodes).toEqual(['ARG','BRA']);
    expect(snapshot.initialized).toBe(true);
    expect(Object.keys(snapshot).sort()).toEqual(['initialized','teamCodes','followOnly','stage','restoreIssue','saveIssue'].sort());
    snapshot.teamCodes.push('ESP');snapshot.stage='final';
    expect(state.getSnapshot().teamCodes).toEqual(['ARG','BRA']);
    expect(state.getSnapshot().stage).toBe('all');
    state.initialize(teams);expect(read).toHaveBeenCalledOnce();expect(write).not.toHaveBeenCalled();
  });
  it('adds and removes multiple teams without duplicates and restores the saved list after refresh', () => {
    const storage=memoryStorage();const state=createFollowState({storage});state.initialize(teams);
    state.setFollowed('ARG',true);state.setFollowed('BRA',true);state.setFollowed('ARG',true);
    expect(state.getSnapshot().teamCodes).toEqual(['ARG','BRA']);
    expect(JSON.parse(storage.value())).toEqual({version:1,teamCodes:['ARG','BRA']});
    expect(state.setFollowed('ARG',false).teamCodes).toEqual(['BRA']);
    const reopened=createFollowState({storage});expect(reopened.initialize(teams).teamCodes).toEqual(['BRA']);
    expect(reopened.getSnapshot().followOnly).toBe(false);expect(reopened.getSnapshot().stage).toBe('all');
    expect(FOLLOW_KEY).toBe('wc2026-followed-teams');
  });
  it.each(['{broken','null','[]','{"version":2,"teamCodes":[]}','{"version":1,"teamCodes":{}}'])('reports corrupt records without overwriting them: %s', value => {
    const storage=memoryStorage(value);const state=createFollowState({storage});
    expect(state.initialize(teams)).toMatchObject({initialized:true,teamCodes:[],restoreIssue:'corrupt'});
    expect(storage.value()).toBe(value);
    expect(state.setFollowed('ARG',true).restoreIssue).toBeNull();
    expect(JSON.parse(storage.value()).teamCodes).toEqual(['ARG']);
  });
  it('treats missing and all-invalid records as ordinary empty lists', () => {
    for(const value of [null,persisted(['XXX',null])]){
      const state=createFollowState({storage:memoryStorage(value)});
      expect(state.initialize(teams)).toMatchObject({teamCodes:[],restoreIssue:null});
    }
  });
  it('reports an unreadable record, but keeps a usable temporary state', () => {
    const storage={read:()=>({ok:false}),write:()=>({ok:false})};const state=createFollowState({storage});
    expect(state.initialize(teams).restoreIssue).toBe('unavailable');
    expect(state.setFollowed('ARG',true)).toMatchObject({teamCodes:['ARG'],saveIssue:'failed'});
  });
  it('keeps the latest in-memory choice after write failure, never rereads old storage, and later saves the whole list', () => {
    let fail=true;const base=memoryStorage(persisted(['ARG']));
    const storage={read:vi.fn(base.read),write:vi.fn((key,value)=>fail?{ok:false}:base.write(key,value))};
    const state=createFollowState({storage});state.initialize(teams);
    expect(state.setFollowed('ARG',false)).toMatchObject({teamCodes:[],saveIssue:'failed'});
    state.initialize(teams);state.setFollowed('BRA',true);
    expect(state.getSnapshot().teamCodes).toEqual(['BRA']);expect(storage.read).toHaveBeenCalledOnce();
    expect(JSON.parse(base.value()).teamCodes).toEqual(['ARG']);
    fail=false;
    expect(state.setFollowed('ESP',true)).toMatchObject({teamCodes:['BRA','ESP'],saveIssue:null,restoreIssue:null});
    expect(JSON.parse(base.value()).teamCodes).toEqual(['BRA','ESP']);
  });
  it('rejects invalid initialization and invalid operations without persisting', () => {
    const storage=memoryStorage();const write=vi.spyOn(storage,'write');const state=createFollowState({storage});
    for(const value of [null,undefined,[]]) expect(state.initialize(value).initialized).toBe(false);
    state.initialize(teams);
    for(const [code,value] of [['XXX',true],['ARG','true'],['arg',true],[null,true]]) state.setFollowed(code,value);
    expect(state.getSnapshot().teamCodes).toEqual([]);expect(write).not.toHaveBeenCalled();
  });
});
