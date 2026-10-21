import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';import {pathToFileURL} from 'node:url';
import {parse} from '@babel/parser';
import {inside,listProduction,sha256,normalize,validateManifest,parseArgs} from './capture-coverage-baseline.mjs';

// LCS yields zero-context added/changed lines, including untracked files.
export function addedLines(oldSource,newSource) {
  const a=normalize(oldSource).split('\n'),b=normalize(newSource).split('\n');
  const dp=Array.from({length:a.length+1},()=>new Uint32Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  const added=[];let i=0,j=0;
  while(j<b.length){if(i<a.length&&a[i]===b[j]){i++;j++;}else if(i<a.length&&dp[i+1][j]>dp[i][j+1])i++;else added.push(++j);}
  return added;
}
function intersectsToken(range,token) {
  return token.loc.start.line>=range.start.line && token.loc.start.line<=range.end.line
    && (token.loc.start.line!==range.start.line || token.loc.start.column>=range.start.column)
    && (token.loc.start.line!==range.end.line || range.end.column===null || token.loc.start.column<range.end.column);
}
export function auditCoverage({root=process.cwd(),baseline,report='coverage/coverage-final.json',requireLcov=false}) {
  root=path.resolve(root);baseline=path.resolve(root,baseline);
  const base=JSON.parse(readFileSync(baseline,'utf8'));validateManifest(base);
  const sources=inside(path.dirname(baseline),base.sourceRoot);
  const originals=new Map();
  for(const f of base.files){const s=readFileSync(inside(sources,f.path),'utf8');if(sha256(s)!==f.sha256)throw Error('Baseline hash mismatch');originals.set(f.path,normalize(s));}
  const reportPath=path.resolve(root,report),raw=readFileSync(reportPath,'utf8');
  const collected=JSON.parse(raw),stamp=JSON.parse(readFileSync(path.join(path.dirname(reportPath),'source-hashes.json'),'utf8'));
  if(stamp.reportSha256!==sha256(raw))throw Error('Report hash mismatch');
  const records=new Map(Object.entries(collected).map(([file,value])=>[path.resolve(file),value]));
  let lcov=null;
  if(requireLcov){lcov=new Map();for(const record of readFileSync(path.join(path.dirname(reportPath),'lcov.info'),'utf8').split('end_of_record')){
    const sf=record.match(/^SF:(.+)$/m)?.[1]?.trim();if(!sf)continue;lcov.set(path.resolve(root,sf),new Map([...record.matchAll(/^DA:(\d+),(\d+)/gm)].map(m=>[+m[1],+m[2]])));}}
  const current=listProduction(root),files=[];
  for(const p of current){
    const full=path.join(root,p),source=normalize(readFileSync(full,'utf8')),sourceHash=sha256(source);
    if(stamp.files[p]!==sourceHash)throw Error(`Source hash mismatch: ${p}`);
    const record=records.get(full);
    if(!record || !record.statementMap || !record.s)throw Error(`Missing coverage: ${p}`);
    let old=originals.get(p),renamedFrom=null;
    if(old===undefined){const renamed=base.files.find(f=>!current.includes(f.path)&&f.sha256===sourceHash);if(renamed){old=originals.get(renamed.path);renamedFrom=renamed.path;}}
    const changed=addedLines(old??'',source);
    const ast=parse(source,{sourceType:'module',tokens:true,allowAwaitOutsideFunction:true});
    const changedTokens=ast.tokens.filter(token=>typeof token.type==='object'&&token.type.label!=='eof'
      &&changed.some(line=>line>=token.loc.start.line&&line<=token.loc.end.line));
    const lineHits=new Map(),ranges=Object.entries(record.statementMap);
    for(const [id,range] of ranges){
      if(!Number.isInteger(record.s[id])||record.s[id]<0||range.start.line<1||range.end.line>source.split('\n').length||range.end.line<range.start.line)throw Error(`Invalid coverage mapping: ${p}`);
      lineHits.set(range.start.line,Math.max(lineHits.get(range.start.line)??0,record.s[id]));
    }
    // AST proves executable statements cannot disappear from the report.
    function verify(node){
      if(!node||typeof node!=='object')return;
      if(['VariableDeclaration','ExpressionStatement','ReturnStatement','ThrowStatement'].includes(node.type)&&(node.type!=='VariableDeclaration'||node.declarations.some(d=>d.init))&&changed.includes(node.loc.start.line)
        &&!ranges.some(([,range])=>range.start.line<=node.loc.start.line&&range.end.line>=node.loc.start.line))throw Error(`Unmapped executable statement: ${p}:${node.loc.start.line}`);
      for(const [key,value] of Object.entries(node)){if(['loc','tokens','comments'].includes(key))continue;if(Array.isArray(value))value.forEach(verify);else if(value&&typeof value==='object')verify(value);}
    }
    verify(ast.program);
    if(lcov){const lines=lcov.get(full);if(!lines)throw Error(`Missing lcov: ${p}`);for(const [line,hits] of lineHits)if((lines.get(line)>0)!==(hits>0))throw Error(`JSON/lcov disagreement: ${p}:${line}`);}
    // Istanbul executable line = mapped statement start. A changed continuation
    // maps to that same line; it cannot evade the denominator by moving to line 2.
    const addedExecutableLines=[...new Set(ranges.filter(([,range])=>changedTokens.some(token=>intersectsToken(range,token))).map(([,range])=>range.start.line))].sort((a,b)=>a-b);
    const hitLines=addedExecutableLines.filter(line=>lineHits.get(line)>0);
    files.push({path:p,sourceHash,baseHash:old===undefined?null:sha256(old),renamedFrom,changedLines:changed,addedExecutableLines,hitLines,C:hitLines.length,D:addedExecutableLines.length});
  }
  const C=files.reduce((s,f)=>s+f.C,0),D=files.reduce((s,f)=>s+f.D,0);
  return {schemaVersion:1,baseCommit:base.baseCommit,baselineHash:sha256(readFileSync(baseline,'utf8')),reportHash:sha256(raw),definition:'Istanbul source-mapped executable statement-start lines; changed multiline tokens map to their enclosing statement starts; comments/whitespace excluded with Babel tokens',C,D,ratio:D?C/D:null,passed:D===0||5*C>=4*D,notApplicable:D===0,files};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const args=parseArgs(process.argv.slice(2));const result=auditCoverage({...args,requireLcov:true});const output=args.output??'specs/001-follow-teams/evidence/coverage-added.json';mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({C:result.C,D:result.D,ratio:result.ratio,passed:result.passed}));if(!result.passed)process.exitCode=1;}
 catch(error){console.error(error.message);process.exitCode=1;}
}

