import { describe, it, expect } from 'vitest';
import { isValidISODate, validateDateRange, filterMatchesByDate } from '../src/features/schedule-date-range/date-range.js';
import { dateMatches } from './fixtures/schedule-date.js';

describe('calendar dates without timezone conversion', () => {
  it.each(['0001-01-01','0099-12-31','9999-12-31','2000-02-29','2024-02-29','2011-12-30','2026-06-11'])('accepts the exact real Gregorian date %s', value => {
    expect(isValidISODate(value)).toBe(true);
  });
  it.each(['',' ','2026-6-11','2026-06','2026-06-','2026-02-30','1900-02-29','2100-02-29','2025-02-29','0000-01-01','10000-01-01','2026-00-01','2026-13-01','2026-01-00','2026-04-31','2026-06-11 ',' 2026-06-11','2026-06-11T00:00:00Z',null,undefined,123,{}])('rejects invalid date %j without normalization', value => {
    expect(isValidISODate(value)).toBe(false);
  });
  it.each([
    ['', '', [101,102,103]],
    ['2026-06-12','',[102,103]],
    ['','2026-06-12',[101,102]],
    ['2026-06-12','2026-06-12',[102]],
    ['2026-06-11','2026-06-12',[101,102]],
    ['2026-06-14','2026-06-15',[]],
    ['0001-01-01','9999-12-31',[101,102,103]],
  ])('validates and filters the inclusive range %s to %s', (start,end,ids) => {
    const draft={start,end}; const before=structuredClone(dateMatches);
    expect(validateDateRange(draft)).toEqual({ok:true,range:{start,end}});
    const filtered=filterMatchesByDate(dateMatches,draft);
    expect(filtered.map(m=>m.id)).toEqual(ids);
    expect(filtered).not.toBe(dateMatches);
    expect(dateMatches).toEqual(before);
    expect(draft).toEqual({start,end});
  });
  it('preserves supplied order rather than sorting results', () => {
    expect(filterMatchesByDate([...dateMatches].reverse(),{start:'2026-06-11',end:'2026-06-13'}).map(m=>m.id)).toEqual([103,102,101]);
  });
  it.each([
    [{start:'2026-06-13',end:'2026-06-11'},{start:null,end:'reversed-range'},'end'],
    [{start:'2026-02-30',end:'2026-01-01'},{start:'invalid-date',end:null},'start'],
    [{start:'bad',end:'also bad'},{start:'invalid-date',end:'invalid-date'},'start'],
    [{start:'',end:'2026-06-'},{start:null,end:'invalid-date'},'end'],
  ])('reports field errors before checking order for %j', (draft,errors,firstInvalid) => {
    const before={...draft};
    expect(validateDateRange(draft)).toEqual({ok:false,errors,firstInvalid});
    expect(draft).toEqual(before);
  });
});
