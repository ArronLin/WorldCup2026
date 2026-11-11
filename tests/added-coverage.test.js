import {describe,it,expect} from 'vitest';
import {readFileSync,renameSync,mkdirSync,rmSync,readdirSync,existsSync} from 'node:fs';import path from 'node:path';import {execFileSync,spawnSync} from 'node:child_process';
import {fixture,hash,patterns,coverage} from './fixtures/coverage/helpers.js';
import {auditCoverage,addedLines,parseAuditArgs} from '../scripts/check-added-coverage.mjs';
import {rebuildBaseline} from '../scripts/capture-coverage-baseline.mjs';
function setup(source,hits,old=''){
 const f=fixture(),file=f.put('src/a.js',source);f.put('coverage/coverage-final.json',{[file]:coverage(file,source,hits)});
 f.put('coverage/source-hashes.json',{files:{'src/a.js':hash(source)},reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))});
 if(old)f.put('base/sources/src/a.js',old);
 const baseline=f.put('base/baseline.json',{schemaVersion:1,mode:'snapshot',productionPatterns:patterns,sourceRoot:'sources',files:old?[{path:'src/a.js',sha256:hash(old)}]:[]});
 return {...f,file,baseline,run:()=>auditCoverage({root:f.root,baseline})};
}

function gitAuditFixture(businessHits = [1,1,1,1,1], scriptHits = [0]) {
 const f=fixture();
 const git=(...args)=>execFileSync('git',args,{cwd:f.root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 f.put('src/a.js','export const original = 0;');
 git('init');git('add','.');git('-c','user.name=Coverage Fixture','-c','user.email=fixture@example.invalid','commit','-m','baseline');
 const baseCommit=git('rev-parse','HEAD');
 const samples={'src/a.js':businessHits,'scripts/tool.mjs':scriptHits};
 const sources={},records={};
 for(const [p,hits] of Object.entries(samples)){
  sources[p]=hits.map((_,i)=>`export const value${i} = ${i};`).join('\n');
  const file=f.put(p,sources[p]);records[file]=coverage(file,sources[p],hits);
 }
 f.put('coverage/coverage-final.json',records);
 const stamp={auditSources:['scripts/tool.mjs'],files:Object.fromEntries(Object.entries(sources).map(([p,s])=>[p,hash(s)])),reportSha256:hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'))};
 f.put('coverage/source-hashes.json',stamp);
 f.put('coverage/lcov.info',Object.entries(samples).map(([p,hits])=>`SF:${p}\n`+hits.map((hit,i)=>`DA:${i+1},${hit}`).join('\n')+'\nend_of_record\n').join(''));
 return {...f,baseCommit,stamp,records,run:(options={})=>auditCoverage({root:f.root,baseCommit,auditSources:['scripts/tool.mjs'],requireLcov:true,...options})};
}

describe('Git memory baseline and separate scopes',()=>{
 it('does not let covered product code mask an untested script in legacy mode',()=>{
  const f=gitAuditFixture([1,1,1,1,1],[0]);
  const baseline=f.put('baseline.json',{schemaVersion:1,mode:'snapshot',productionPatterns:patterns,sourceRoot:'sources',files:[]});
  const result=auditCoverage({root:f.root,baseline,auditSources:['scripts/tool.mjs'],requireLcov:true});
  expect(result.passed).toBe(false);
  expect(result.groups).toMatchObject({business:{C:5,D:5,passed:true},scripts:{C:0,D:1,passed:false}});
 });
 it('normalizes CLI options and rejects mutually exclusive baseline modes',()=>{
  expect(parseAuditArgs(['--base-commit','a'.repeat(40),'--audit-sources','scripts/tool.mjs','--output','coverage/new.json'])).toMatchObject({baseCommit:'a'.repeat(40),auditSources:['scripts/tool.mjs'],output:'coverage/new.json'});
  expect(()=>parseAuditArgs(['--baseline','old.json','--base-commit','a'.repeat(40)])).toThrow(/exclusive|one baseline/i);
  const f=setup('export const x=1;',[1]);
  expect(()=>auditCoverage({root:f.root,baseline:f.baseline,baseCommit:'a'.repeat(40)})).toThrow(/exclusive|one baseline/i);
 });
 it('reads Git originals in memory and includes untracked scripts without creating source copies',()=>{
  const f=gitAuditFixture([1,1,1,1,1],[1]);
  const before=readdirSync(f.root,{recursive:true}).sort();
  const result=f.run();
  expect(result).toMatchObject({baseCommit:f.baseCommit,C:6,D:6,passed:true});
  expect(result.files.map(x=>x.path)).toEqual(['scripts/tool.mjs','src/a.js']);
  expect(result.files.find(x=>x.path==='src/a.js').baseHash).toBe(hash('export const original = 0;'));
  expect(result.files.find(x=>x.path==='scripts/tool.mjs').baseHash).toBeNull();
  expect(readdirSync(f.root,{recursive:true}).sort()).toEqual(before);
 });
 it.each([
  [[1,1,1,1,1],[0],{C:5,D:5,passed:true},{C:0,D:1,passed:false}],
  [[1,1,1,0,0],Array(20).fill(1),{C:3,D:5,passed:false},{C:20,D:20,passed:true}],
  [[1,1,1,1,0],[1,1,1,1,0],{C:4,D:5,passed:true},{C:4,D:5,passed:true}],
 ])('enforces exact thresholds separately for business and scripts', (business,script,expectedBusiness,expectedScripts)=>{
  const result=gitAuditFixture(business,script).run();
  expect(result.groups.business).toMatchObject(expectedBusiness);
  expect(result.groups.scripts).toMatchObject(expectedScripts);
  expect(result.passed).toBe(expectedBusiness.passed&&expectedScripts.passed);
 });
 it('rejects a mismatched collection scope and missing source hashes',()=>{
  const f=gitAuditFixture();f.stamp.auditSources=[];f.put('coverage/source-hashes.json',f.stamp);
  expect(f.run).toThrow(/scope/i);
  const g=gitAuditFixture();delete g.stamp.files['scripts/tool.mjs'];g.put('coverage/source-hashes.json',g.stamp);
  expect(g.run).toThrow(/scope|hash/i);
 });
 it('rejects missing coverage, stale reports and JSON/LCOV disagreement',()=>{
  const f=gitAuditFixture();delete f.records[path.join(f.root,'scripts/tool.mjs')];f.put('coverage/coverage-final.json',f.records);f.stamp.reportSha256=hash(readFileSync(path.join(f.root,'coverage/coverage-final.json'),'utf8'));f.put('coverage/source-hashes.json',f.stamp);
  expect(f.run).toThrow(/Missing coverage/);
  const g=gitAuditFixture();g.put('coverage/coverage-final.json',{});expect(g.run).toThrow(/Report hash/);
  const h=gitAuditFixture();h.put('coverage/lcov.info','SF:scripts/tool.mjs\nDA:1,1\nend_of_record\n');expect(h.run).toThrow(/disagreement/);
 });
 it('includes new nested production files and refuses absent coverage',()=>{
  const f=gitAuditFixture();f.put('src/nested/new.js','export const untested=1;');
  expect(f.run).toThrow(/scope|hash|Missing coverage/i);
 });
 for(const mode of ['git','legacy'])for(const file of ['src/a.js','scripts/tool.mjs']){
  it(`rejects absent zero-hit LCOV lines for ${mode} ${file}`,()=>{
   const f=gitAuditFixture([1,1,1,1,0],[1,1,1,1,0]);
   const baseline=f.put('baseline.json',{schemaVersion:1,mode:'snapshot',productionPatterns:patterns,sourceRoot:'sources',files:[]});
   const run=()=>f.run(mode==='git'?{}:{baseCommit:undefined,baseline});
   const complete=readFileSync(path.join(f.root,'coverage/lcov.info'),'utf8');
   expect(run().groups).toMatchObject({business:{C:4,D:5,passed:true},scripts:{C:4,D:5,passed:true}});
   const incomplete=complete.split('end_of_record').map(record=>record.includes(`SF:${file}\n`)?record.replace('DA:5,0\n',''):record).join('end_of_record');
   f.put('coverage/lcov.info',incomplete);
   expect(run).toThrow(`Missing lcov line: ${file}:5`);
   f.put('coverage/lcov.info',complete);expect(run().passed).toBe(true);
  });
 }
 it('fails the real CLI when an uncovered LCOV line is absent',()=>{
  const f=gitAuditFixture([1,1,1,1,0],[1,1,1,1,0]),script=path.resolve('scripts/check-added-coverage.mjs');
  const args=['--root',f.root,'--base-commit',f.baseCommit,'--audit-sources','scripts/tool.mjs'];
  const run=output=>spawnSync(process.execPath,[script,...args,'--output',path.join(f.root,'coverage',output)],{encoding:'utf8'});
  expect(run('complete.json').status).toBe(0);
  const lcov=readFileSync(path.join(f.root,'coverage/lcov.info'),'utf8');
  f.put('coverage/lcov.info',lcov.replace('DA:5,0\n',''));
  const failed=run('incomplete.json');
  expect(failed.status).toBe(1);expect(failed.stderr).toContain('Missing lcov line: src/a.js:5');
  expect(existsSync(path.join(f.root,'coverage/incomplete.json'))).toBe(false);
 });
 it('runs the real CLI with the Git baseline and preserves failure exit codes',()=>{
  const f=gitAuditFixture([1,1,1,1,1],[1]);const script=path.resolve('scripts/check-added-coverage.mjs');
  const args=['--root',f.root,'--base-commit',f.baseCommit,'--audit-sources','scripts/tool.mjs','--output',path.join(f.root,'coverage/audit.json')];
  const ok=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
  expect(ok.status,ok.stderr).toBe(0);expect(existsSync(path.join(f.root,'coverage/audit.json'))).toBe(true);
  const failed=spawnSync(process.execPath,[script,...args,'--baseline','old.json'],{encoding:'utf8'});
  expect(failed.status).toBe(1);expect(failed.stderr).toMatch(/exclusive|one baseline/i);
 });
});
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
