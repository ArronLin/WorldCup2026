import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync} from 'node:fs';
import {listProduction,sha256} from './capture-coverage-baseline.mjs';
const root=process.cwd();const hashes=()=>Object.fromEntries(listProduction(root).map(p=>[p,sha256(readFileSync(p,'utf8'))]));
const before=hashes();const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','--coverage',...process.argv.slice(2)],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
if(JSON.stringify(before)!==JSON.stringify(hashes()))throw Error('Production changed during coverage collection');
writeFileSync('coverage/source-hashes.json',JSON.stringify({time:new Date().toISOString(),node:process.version,files:before,reportSha256:sha256(readFileSync('coverage/coverage-final.json','utf8'))},null,2)+'\n');
