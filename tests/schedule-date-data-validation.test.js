import { describe, it, expect } from 'vitest';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { validateData } from '../scripts/validate-data.mjs';

function fixture() {
  const root=mkdtempSync(path.join(tmpdir(),'wc-date-data-'));
  const dataDirectory=path.join(root,'data'),i18nDirectory=path.join(root,'i18n');
  cpSync(path.resolve('public/data'),dataDirectory,{recursive:true});
  cpSync(path.resolve('public/i18n'),i18nDirectory,{recursive:true});
  const mutate=(name,edit,directory=dataDirectory)=>{
    const file=path.join(directory,name+'.json'),value=JSON.parse(readFileSync(file,'utf8'));
    edit(value);writeFileSync(file,JSON.stringify(value));return value;
  };
  return {dataDirectory,i18nDirectory,mutate};
}

describe('shared runtime and release calendar-date contract',()=>{
  it('imports without process side effects and validates the unchanged published snapshot',async()=>{
    expect(await validateData()).toEqual({ok:true,failures:[],counts:{matches:104,teams:48,history:132}});
  });
  it.each(['2026-02-30','0000-01-01','2026-6-11',''])('reports the affected match for invalid date %j',async date=>{
    const f=fixture();const matches=f.mutate('matches',rows=>{rows[0].date=date;});
    const result=await validateData(f);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain(`match ${matches[0].id} has invalid date ${date}`);
  });
  it.each(['0001-01-01','0099-12-31','2024-02-29','9999-12-31'])('does not clamp a valid calendar date %s',async date=>{
    const f=fixture();f.mutate('matches',rows=>{rows[0].date=date;});
    expect((await validateData(f)).failures).toEqual([]);
  });
  it('retains existing IDs, references, venue and bilingual validation',async()=>{
    const f=fixture();f.mutate('matches',rows=>{rows[0].id=rows[1].id;rows[0].home.code='XXX';rows[0].stadium='Missing stadium';});
    f.mutate('en',dict=>{delete dict[Object.keys(dict)[0]];},f.i18nDirectory);
    const result=await validateData(f);
    expect(result.failures).toEqual(expect.arrayContaining([
      'match IDs must be unique',expect.stringContaining('references missing team XXX'),
      expect.stringContaining('references missing venue Missing stadium'),expect.stringContaining('missing English translation'),
    ]));
  });
  it('executes the real CLI against isolated valid and invalid data roots',()=>{
    const f=fixture(),cli=path.resolve('scripts/validate-data.mjs');
    const run=()=>spawnSync(process.execPath,[cli,'--data-root',f.dataDirectory],{encoding:'utf8'});
    expect(run().status).toBe(0);
    f.mutate('matches',rows=>{rows[0].date='2026-02-30';});
    const result=run();expect(result.status).toBe(1);expect(result.stderr).toContain('has invalid date 2026-02-30');
  });
  it('rejects missing or unknown CLI arguments',()=>{
    const cli=path.resolve('scripts/validate-data.mjs');
    for(const args of [['--data-root'],['--unknown','value']]) {
      expect(spawnSync(process.execPath,[cli,...args],{encoding:'utf8'}).status).toBe(1);
    }
  });
});
