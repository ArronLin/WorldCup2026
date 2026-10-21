import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {parseArgs} from './capture-coverage-baseline.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function runMutation({file,from,to,command=process.execPath,args=[],cwd=process.cwd(),timeout=90000,expectedFailure}) {
  file=path.resolve(cwd,file);const original=readFileSync(file),beforeHash=hash(original),text=original.toString('utf8');
  if(!text.includes(from))throw Error('Mutation anchor absent: '+file);
  const run=(limit=timeout)=>spawnSync(command,args,{cwd,encoding:'utf8',timeout:limit,maxBuffer:16*1024*1024,env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});
  const verificationTimeout=Math.max(timeout,10000);
  const baseline=run(verificationTimeout);if(baseline.error||baseline.status!==0)throw Error('Baseline tests must pass before mutation');
  let mutant,afterHash;
  try {
    writeFileSync(file,text.replace(from,to));mutant=run();
    if(mutant.error)throw Error(mutant.error.code==='ETIMEDOUT'?'Mutation timeout':'Mutation command failed: '+mutant.error.message);
    if(mutant.status===0)throw Error('Surviving mutant');
    const output=(mutant.stdout??'')+(mutant.stderr??'');
    if(!/AssertionError/.test(output)||/SyntaxError|Failed Suites|No test files found/.test(output)||expectedFailure&&!output.includes(expectedFailure))throw Error('Mutant did not fail a target assertion');
  } finally {
    writeFileSync(file,original);afterHash=hash(readFileSync(file));if(beforeHash!==afterHash)throw Error('Mutation restoration hash mismatch');
    const restored=run(verificationTimeout);if(restored.error||restored.status!==0)throw Error('Tests failed after restoration');
  }
  return {file,caught:true,restored:true,beforeHash,afterHash,exitCode:mutant.status,stdout:mutant.stdout,stderr:mutant.stderr};
}
function productionMutations(){
 const selector='src/features/follow-teams/matches.js';const selectTest='tests/follow-matches.test.js';
 const cases=[
  {name:'主客OR错误改为AND',file:selector,from:'(followed.has(m.home.code) || followed.has(m.away.code))',to:'(followed.has(m.home.code) && followed.has(m.away.code))',test:selectTest},
  {name:'阶段AND错误改为OR',file:selector,from:'teamMatches && stageMatches',to:'teamMatches || stageMatches',test:selectTest},
  {name:'错误删除ID去重',file:selector,from:'seen.has(m.id)',to:'false',test:selectTest},
  {name:'保存失败错误回滚',file:'src/features/follow-teams/state.js',from:"else saveIssue = 'failed';",to:"else { followed.clear(); saveIssue = 'failed'; }",test:'tests/follow-state.test.js'},
  {name:'切语言错误重置筛选',file:'src/app.js',from:'  const focusKey =',to:"  import('./features/follow-teams/state.js').then(({followState}) => followState.setScheduleFilters({followOnly:false,stage:'all'}));\n  const focusKey =",test:'tests/follow-localization.test.js'},
 ];
 return cases.map(c=>({...c,command:process.execPath,args:['node_modules/vitest/vitest.mjs','run',c.test],expectedFailure:c.test}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  const args=parseArgs(process.argv.slice(2));const cases=args.config?JSON.parse(readFileSync(args.config,'utf8')):productionMutations();const results=[];
  for(const item of cases){const result=runMutation(item);results.push({name:item.name,...result});console.log('已捕获并恢复：'+(item.name??item.file));}
  if(!args.config){const p='specs/001-follow-teams/evidence/mutations.json';mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,JSON.stringify({time:new Date().toISOString(),node:process.version,results},null,2)+'\n');}
 }catch(error){console.error(error.message);process.exitCode=1;}
}
