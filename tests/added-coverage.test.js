import {describe,it,expect} from 'vitest';
import {readFileSync,renameSync,mkdirSync,rmSync} from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {fixture,hash,patterns,coverage} from './fixtures/coverage/helpers.js';
import {auditCoverage,addedLines} from '../scripts/check-added-coverage.mjs';
import {rebuildBaseline} from '../scripts/capture-coverage-baseline.mjs';
function setup(source,hits,old=''){
 const f=fixture(),file=f.put('src/a.js',source);f.put('coverage/coverage-final.json',{[file]:coverage(file,source,hits)});
 f.put('coverage/source-hashes.json',{files:{'src/a.js':hash(source)},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});
 if(old)f.put('base/sources/src/a.js',old);
 const baseline=f.put('base/baseline.json',{schemaVersion:1,mode:'snapshot',productionPatterns:patterns,sourceRoot:'sources',files:old?[{path:'src/a.js',sha256:hash(old)}]:[]});
 return {...f,file,baseline,run:()=>auditCoverage({root:f.root,baseline})};
}
describe('added executable line coverage',()=>{
 it('requires exact unrounded aggregate 80 percent, including new unimported code',()=>{
 const s=Array.from({length:5},(_,i)=>`export const n${i} = ${i};`).join('\n');const a=setup(s,[1,1,1,1,0]);expect(a.run()).toMatchObject({C:4,D:5,passed:true});const b=setup(s,[1,1,1,0,0]);expect(b.run()).toMatchObject({C:3,D:5,passed:false});
 });
 it('maps changed old lines and excludes unchanged source, comments and blanks',()=>{
 expect(addedLines('a\nb\nc\n','a\nB\nc\nnew\n')).toEqual([2,4]);
 const s='export const old = 1;\n// comment\n\nexport const next = 2;';const f=setup(s,[1,0,0,0],'export const old = 1;');
 // Providers omit comments and blanks, rather than inventing statements.
 const report=coverage(f.file,s,[1]);report.statementMap[1]={start:{line:4,column:0},end:{line:4,column:22}};report.s[1]=0;
 f.put('coverage/coverage-final.json',{[f.file]:report});f.put('coverage/source-hashes.json',{files:{'src/a.js':hash(s)},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});expect(f.run()).toMatchObject({C:0,D:1,passed:false});
 });
 it('maps a changed multiline continuation to its enclosing executable line',()=>{
 const s='export const x =\n  2;';const f=setup(s,[1],'export const x =\n  1;');const report=coverage(f.file,s,[1]);report.statementMap[0].end={line:2,column:4};f.put('coverage/coverage-final.json',{[f.file]:report});f.put('coverage/source-hashes.json',{files:{'src/a.js':hash(s)},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});expect(f.run()).toMatchObject({C:1,D:1});
 });
 it('treats pure rename and no executable changes as not applicable',()=>{
 const s='export const x = 1;';const f=setup(s,[0],s);renameSync(path.join(f.root,'src/a.js'),path.join(f.root,'src/renamed.js'));const file=path.join(f.root,'src/renamed.js');f.put('coverage/coverage-final.json',{[file]:coverage(file,s,[0])});f.put('coverage/source-hashes.json',{files:{'src/renamed.js':hash(s)},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});expect(f.run()).toMatchObject({C:0,D:0,passed:true});
 });
 it('fails closed for missing reports, stale source, invalid mapping and missing baseline source',()=>{
 const f=setup('export const x=1;',[1],'export const x=0;');f.put('coverage/coverage-final.json',{});expect(f.run).toThrow();
 const g=setup('export const x=1;',[1]);g.put('src/a.js','export const x=2;');expect(g.run).toThrow(/hash/i);
 const h=setup('export const x=1;',[1],'export const x=0;');rmSync(path.join(h.root,'base/sources/src/a.js'));expect(h.run).toThrow();
 });
});
describe('fixed manifest reconstruction',()=>{
 function manifest(mode='snapshot'){const f=fixture();const source='export const x = 1;\n';f.put('src/a.js',source);f.put('feature/baseline-source/src/a.js',source);const data={schemaVersion:1,mode,baseCommit:'missing',hashNormalization:'lf',productionPatterns:patterns,sourceRoot:'baseline-source',files:[{path:'src/a.js',sha256:hash(source)}]};const m=f.put('feature/coverage-baseline.json',data);return {...f,m,data,source,run:()=>rebuildBaseline({root:f.root,manifest:m,output:path.join(f.root,'out')})}}
 it('rebuilds the complete snapshot read-only and normalizes LF',()=>{const f=manifest();const before=readFileSync(f.m,'utf8');const result=f.run();expect(result.files).toEqual(f.data.files);expect(readFileSync(path.join(f.root,'out/sources/src/a.js'),'utf8')).toBe(f.source);expect(readFileSync(f.m,'utf8')).toBe(before)});
 it('rejects corrupt hashes, missing snapshot, omitted files and escaping paths',()=>{
 for(const mutation of [f=>f.data.files[0].sha256='0'.repeat(64),f=>f.data.files=[],f=>f.data.sourceRoot='../elsewhere',f=>f.data.files[0].path='../outside.js']){const f=manifest();mutation(f);f.put('feature/coverage-baseline.json',f.data);expect(f.run).toThrow();}
 const f=manifest();rmSync(path.join(f.root,'feature/baseline-source'),{recursive:true});expect(f.run).toThrow();
 });
 it('reads only the specified Git commit, rejects missing commit and incomplete manifest',()=>{
 const f=manifest('git-tree');execFileSync('git',['init','-q'],{cwd:f.root});execFileSync('git',['add','src'],{cwd:f.root});execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','baseline'],{cwd:f.root});f.data.baseCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:f.root,encoding:'utf8'}).trim();f.put('feature/coverage-baseline.json',f.data);expect(f.run().files).toEqual(f.data.files);f.data.baseCommit='0'.repeat(40);f.put('feature/coverage-baseline.json',f.data);expect(f.run).toThrow();
 });
});
it('accepts provider null end columns as end-of-line, and rejects empty or out-of-range executable maps',()=>{
 const f=setup('export const x = 1;',[0]);const report=coverage(f.file,'export const x = 1;',[0]);report.statementMap[0].end.column=null;
 f.put('coverage/coverage-final.json',{[f.file]:report});f.put('coverage/source-hashes.json',{files:{'src/a.js':hash('export const x = 1;')},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});expect(f.run()).toMatchObject({C:0,D:1,passed:false});
 report.statementMap[0].end.line=99;f.put('coverage/coverage-final.json',{[f.file]:report});f.put('coverage/source-hashes.json',{files:{'src/a.js':hash('export const x = 1;')},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});expect(f.run).toThrow(/mapping/);
});
it('counts changed multiline template contents and fails missing-file coverage even with a freshly bound report',()=>{
 const s='export const text = `first\nchanged\nlast`;';const f=setup(s,[1],'export const text = `first\nold\nlast`;');const report=coverage(f.file,s,[1]);report.statementMap[0].end={line:3,column:6};f.put('coverage/coverage-final.json',{[f.file]:report});f.put('coverage/source-hashes.json',{files:{'src/a.js':hash(s)},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});expect(f.run()).toMatchObject({C:1,D:1});
 f.put('coverage/coverage-final.json',{});f.put('coverage/source-hashes.json',{files:{'src/a.js':hash(s)},reportSha256:hash('{}')});expect(f.run).toThrow(/Missing coverage/);
});
