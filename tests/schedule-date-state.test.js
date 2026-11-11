import { describe, it, expect, vi } from 'vitest';
import { createScheduleDateState } from '../src/features/schedule-date-range/state.js';

const range = { start: '2026-06-11', end: '2026-06-12' };

it('US3 discard restores independent applied values and clears errors without persistence',()=>{
  const getItem=vi.fn(),setItem=vi.fn();vi.stubGlobal('localStorage',{getItem,setItem});
  try{
    const state=createScheduleDateState();setRange(state);state.apply();state.setDraft('end','bad');state.apply();state.discardDraft();
    expect(state.getSnapshot()).toEqual({draft:range,applied:range,errors:{start:null,end:null},dirty:false});
    state.setDraft('start','edited');expect(state.getSnapshot().applied).toEqual(range);
    expect(createScheduleDateState().getSnapshot().applied).toEqual({start:'',end:''});expect(getItem).not.toHaveBeenCalled();expect(setItem).not.toHaveBeenCalled();
  }finally{vi.unstubAllGlobals();}
});

it('clear removes only date state and is idempotent', () => {
  const state=createScheduleDateState();setRange(state);state.apply();state.setDraft('start','bad');state.apply();
  state.clear();
  const empty={draft:{start:'',end:''},applied:{start:'',end:''},errors:{start:null,end:null},dirty:false};
  expect(state.getSnapshot()).toEqual(empty);state.clear();expect(state.getSnapshot()).toEqual(empty);
});
function setRange(state, value = range) {
  state.setDraft('start', value.start); state.setDraft('end', value.end);
}

describe('draft and applied dates', () => {
  it('starts unlimited and returns independent nested snapshots', () => {
    const state = createScheduleDateState();
    const expected = { draft: { start: '', end: '' }, applied: { start: '', end: '' }, errors: { start: null, end: null }, dirty: false };
    expect(state.getSnapshot()).toEqual(expected);
    const snapshot=state.getSnapshot();
    snapshot.draft.start='changed'; snapshot.applied.end='changed'; snapshot.errors.start='invalid-date'; snapshot.dirty=true;
    expect(state.getSnapshot()).toEqual(expected);
  });
  it('keeps literal drafts, including spaces, invalid characters and long input', () => {
    const state=createScheduleDateState(), other=createScheduleDateState();
    for(const value of ['2026-06-',' 2026-06-11 ','<script>raw</script>', 'x'.repeat(40)]) {
      state.setDraft('start',value);
      expect(state.getSnapshot()).toMatchObject({draft:{start:value},applied:{start:'',end:''},dirty:true});
      expect(other.getSnapshot().draft.start).toBe('');
    }
    state.setDraft('start','');expect(state.getSnapshot().dirty).toBe(false);
  });
  it('applies both dates atomically and keeps subsequent editing separate', () => {
    const state=createScheduleDateState();setRange(state);
    const result=state.apply();expect(result).toEqual({ok:true,range});
    expect(state.getSnapshot()).toEqual({draft:range,applied:range,errors:{start:null,end:null},dirty:false});
    result.range.start='mutated';expect(state.getSnapshot().applied).toEqual(range);
    state.setDraft('end','2026-06-13');
    expect(state.getSnapshot()).toMatchObject({draft:{end:'2026-06-13'},applied:range,dirty:true});
    state.setDraft('end',range.end);expect(state.getSnapshot().dirty).toBe(false);
  });
  it('rejects a reversed range without altering the most recent valid application', () => {
    const state=createScheduleDateState();setRange(state);state.apply();
    setRange(state,{start:'2026-06-13',end:'2026-06-11'});
    const result=state.apply();
    expect(result).toEqual({ok:false,errors:{start:null,end:'reversed-range'},firstInvalid:'end'});
    expect(state.getSnapshot()).toMatchObject({applied:range,errors:{end:'reversed-range'},dirty:true});
    result.errors.end=null;expect(state.getSnapshot().errors.end).toBe('reversed-range');
  });
  it('retains field errors while editing, even when dirty becomes false, until valid reapplication', () => {
    const state=createScheduleDateState();setRange(state);state.apply();
    setRange(state,{start:'bad',end:'also bad'});expect(state.apply().firstInvalid).toBe('start');
    expect(state.getSnapshot()).toMatchObject({applied:range,errors:{start:'invalid-date',end:'invalid-date'}});
    setRange(state);expect(state.getSnapshot()).toMatchObject({dirty:false,errors:{start:'invalid-date',end:'invalid-date'}});
    state.apply();expect(state.getSnapshot()).toMatchObject({dirty:false,applied:range,errors:{start:null,end:null}});
  });
  it('accepts open-ended and unlimited applications without stale state', () => {
    const state=createScheduleDateState();setRange(state);state.apply();
    for(const value of [{start:'',end:range.end},{start:range.start,end:''},{start:'',end:''}]) {
      setRange(state,value);expect(state.apply()).toEqual({ok:true,range:value});
      expect(state.getSnapshot()).toMatchObject({draft:value,applied:value,dirty:false});
    }
  });
});
