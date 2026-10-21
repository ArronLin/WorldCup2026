import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s.replaceAll('\r\n','\n')).digest('hex');
export const patterns=['src/**/*.js','netlify/functions/**/*.mjs'];
export function fixture(){const root=mkdtempSync(path.join(tmpdir(),'wc-coverage-'));return {root,put(p,s){mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),typeof s==='string'?s:JSON.stringify(s));return path.join(root,p)}}}
export function coverage(file,source,hits){const lines=source.split('\n');return {path:file,statementMap:Object.fromEntries(hits.map((_,i)=>[i,{start:{line:i+1,column:0},end:{line:i+1,column:lines[i].length}}])),s:Object.fromEntries(hits.map((hit,i)=>[i,hit]))};}
