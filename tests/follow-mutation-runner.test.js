import {it,expect} from 'vitest';import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {runMutation} from '../scripts/check-follow-mutations.mjs';
function fixture(probe="assert.equal(value,1)"){
 const cwd=mkdtempSync(path.join(tmpdir(),'wc-mutation-'));const file=path.join(cwd,'subject.mjs');const original='export const value = 1;\r\n';writeFileSync(file,original);writeFileSync(path.join(cwd,'probe.mjs'),"import assert from 'node:assert/strict';import {value} from './subject.mjs';"+probe);
 return {cwd,file,from:'value = 1',to:'value = 2',command:process.execPath,args:['probe.mjs'],timeout:2000,original};
}
it('detects a real assertion failure, restores exact bytes and verifies the healthy test afterwards',()=>{
 const f=fixture();const result=runMutation(f);expect(result).toMatchObject({caught:true,restored:true});expect(result.beforeHash).toBe(result.afterHash);expect(readFileSync(f.file,'utf8')).toBe(f.original);
});
it('rejects a surviving mutant and restores',()=>{const f=fixture();f.to=f.from;expect(()=>runMutation(f)).toThrow(/surviv/i);expect(readFileSync(f.file,'utf8')).toBe(f.original)});
it('rejects syntax/collection errors rather than counting them as killed mutants',()=>{const f=fixture();f.to='value = (';expect(()=>runMutation(f)).toThrow(/assertion/i);expect(readFileSync(f.file,'utf8')).toBe(f.original)});
it('restores after a timeout and reruns the healthy command',()=>{const f=fixture('if(value===2)while(true){};assert.equal(value,1)');f.timeout=500;expect(()=>runMutation(f)).toThrow(/timeout/i);expect(readFileSync(f.file,'utf8')).toBe(f.original)});
it('refuses mutations if the original test already fails or the anchor is absent',()=>{const f=fixture('assert.equal(value,99)');expect(()=>runMutation(f)).toThrow(/baseline/i);expect(readFileSync(f.file,'utf8')).toBe(f.original);const g=fixture();g.from='absent';expect(()=>runMutation(g)).toThrow(/anchor/i)});
it('CLI exits nonzero on a survivor without leaving its fixture modified',()=>{
 const f=fixture();f.to=f.from;const config=path.join(f.cwd,'config.json');writeFileSync(config,JSON.stringify([f]));const r=spawnSync(process.execPath,[path.resolve('scripts/check-follow-mutations.mjs'),'--config',config],{encoding:'utf8'});expect(r.status).toBe(1);expect(readFileSync(f.file,'utf8')).toBe(f.original);
});
