import { describe,it,expect } from 'vitest';
import { selectMatches } from '../src/features/follow-teams/matches.js';
import {matches} from './fixtures/follow-teams.js';
const ids=result=>result.map(m=>m.id);
describe('match selection',()=>{
 it('selects home OR away with multiple-team union and stable ID deduplication',()=>{
 const input=[matches[1],matches[0],matches[0],matches[2]];const before=JSON.stringify(input);
 expect(ids(selectMatches(input,{teamCodes:['ARG','BRA'],followOnly:true,stage:'all'}))).toEqual([2,1,3]);expect(JSON.stringify(input)).toBe(before);
 expect(ids(selectMatches(matches,{teamCodes:['ARG'],followOnly:true,stage:'all'}))).toEqual([1,2]);
 });
 it('intersects stage with follows and keeps full results with follow disabled',()=>{
 expect(ids(selectMatches(matches,{teamCodes:['ARG'],followOnly:true,stage:'final'}))).toEqual([]);
 expect(ids(selectMatches(matches,{teamCodes:['BRA'],followOnly:true,stage:'final'}))).toEqual([3]);
 expect(ids(selectMatches(matches,{teamCodes:[],followOnly:false,stage:'group'}))).toEqual([1,2]);
 expect(ids(selectMatches([...matches,matches[0]],{teamCodes:[],followOnly:false,stage:'all'}))).toEqual([1,2,3]);
 expect(selectMatches(matches,{teamCodes:[],followOnly:true,stage:'all'})).toEqual([]);
 expect(selectMatches([],{teamCodes:['ARG'],followOnly:true,stage:'all'})).toEqual([]);
 });
});
