import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import path from 'node:path';
import {auditCoverage} from '../scripts/check-added-coverage.mjs';import {sha256,listProduction,patterns} from '../scripts/capture-coverage-baseline.mjs';
const root=path.resolve('tests/fixtures/coverage/unimported-project');const r=spawnSync(process.execPath,[path.resolve('node_modules/vitest/vitest.mjs'),'run','--coverage','--config',path.join(root,'vite.config.mjs')],{cwd:root,stdio:'inherit'});if(r.status)process.exit(r.status);
const raw=readFileSync(path.join(root,'coverage/coverage-final.json'),'utf8'),report=JSON.parse(raw),missing=report[path.join(root,'src/unloaded.js')];if(!missing||!Object.values(missing.s).length||!Object.values(missing.s).every(h=>h===0))throw Error('Unimported file omitted or falsely covered');
mkdirSync(path.join(root,'base/sources'),{recursive:true});writeFileSync(path.join(root,'base/baseline.json'),JSON.stringify({schemaVersion:1,mode:'snapshot',sourceRoot:'sources',productionPatterns:patterns,files:[]}));
writeFileSync(path.join(root,'coverage/source-hashes.json'),JSON.stringify({files:Object.fromEntries(listProduction(root).map(p=>[p,sha256(readFileSync(path.join(root,p),'utf8'))])),reportSha256:sha256(raw)}));
const result=auditCoverage({root,baseline:'base/baseline.json',requireLcov:true});console.log(JSON.stringify(result));if(result.D!==2||result.C!==1||result.passed)throw Error('Expected real unimported code to fail 80% threshold');
writeFileSync('specs/001-follow-teams/evidence/unimported-coverage-proof.json',JSON.stringify(result,null,2));console.log('PASS: real unimported zero-hit line counted, 1/2 rejected.');

