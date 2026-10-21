import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const patterns = ['src/**/*.js','netlify/functions/**/*.mjs'];
export const normalize = s => s.replaceAll('\r\n','\n');
export const sha256 = s => createHash('sha256').update(normalize(s)).digest('hex');
export const isProduction = p => /^src\/.+\.js$/.test(p) || /^netlify\/functions\/.+\.mjs$/.test(p);
export function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => p === '..' || p === '.' || !p)) throw Error('Unsafe relative path');
  const target = path.resolve(root, relative);
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Path escapes root');
  if (existsSync(target)) {
    const real = path.relative(realpathSync(root), realpathSync(target));
    if (real.startsWith('..') || path.isAbsolute(real)) throw Error('Symlink escapes root');
  }
  return target;
}
export function listProduction(root) {
  function walk(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir,{withFileTypes:true}).flatMap(e => {
      if (e.isSymbolicLink()) throw Error('Production symlinks are not supported');
      const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[path.relative(root,p).replaceAll('\\','/')];
    });
  }
  return [...walk(path.join(root,'src')),...walk(path.join(root,'netlify/functions'))].filter(isProduction).sort();
}
export function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !['git-tree','snapshot'].includes(manifest.mode)
    || JSON.stringify(manifest.productionPatterns)!==JSON.stringify(patterns) || !Array.isArray(manifest.files)) throw Error('Invalid manifest schema or production scope');
  const seen=new Set();
  for (const f of manifest.files) {
    if (!isProduction(f.path) || seen.has(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256)) throw Error('Invalid manifest file');
    seen.add(f.path);
  }
}
export function rebuildBaseline({root=process.cwd(),manifest,output}) {
  root=path.resolve(root);manifest=path.resolve(root,manifest);output=path.resolve(root,output);
  const data=JSON.parse(readFileSync(manifest,'utf8'));validateManifest(data);
  const sources=new Map();let actual;
  if (data.mode === 'git-tree') {
    if (!/^[a-f0-9]{40}$/.test(data.baseCommit)) throw Error('Invalid base commit');
    const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    actual=git(['ls-tree','-r','--name-only',data.baseCommit,'--','src','netlify/functions']).trim().split('\n').filter(isProduction).sort();
    for (const p of actual) sources.set(p,normalize(git(['show',`${data.baseCommit}:${p}`])));
  } else {
    if (data.sourceRoot !== 'baseline-source') throw Error('Snapshot must use feature/baseline-source');
    const sourceRoot=inside(path.dirname(manifest),data.sourceRoot);
    if (!existsSync(sourceRoot)) throw Error('Missing snapshot source');
    actual=listProduction(sourceRoot);
    for (const p of actual) sources.set(p,normalize(readFileSync(inside(sourceRoot,p),'utf8')));
  }
  if (JSON.stringify(actual)!==JSON.stringify(data.files.map(f=>f.path).sort())) throw Error('Incomplete manifest');
  for (const f of data.files) {
    inside(root,f.path);
    if (sha256(sources.get(f.path))!==f.sha256) throw Error(`Baseline hash mismatch: ${f.path}`);
  }
  const rel=path.relative(root,output).replaceAll('\\','/');
  inside(root,rel);
  if (rel==='src'||rel.startsWith('src/')||rel==='netlify'||rel.startsWith('netlify/')||manifest.startsWith(output+path.sep)||output.startsWith(path.join(path.dirname(manifest),'baseline-source'))) throw Error('Unsafe output path');
  mkdirSync(output,{recursive:true});
  for (const [p,s] of sources) {const target=path.join(output,'sources',p);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,s);}
  const rebuilt={...data,sourceRoot:'sources',manifestSha256:sha256(readFileSync(manifest,'utf8'))};
  writeFileSync(path.join(output,'baseline.json'),JSON.stringify(rebuilt,null,2)+'\n');return rebuilt;
}
export function parseArgs(argv) {
  const result={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||!argv[i+1])throw Error('Expected --key value');result[argv[i].slice(2)]=argv[i+1]}return result;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result=rebuildBaseline(parseArgs(process.argv.slice(2)));console.log(`重建固定基线：${result.files.length} 个文件，${result.mode}，${result.baseCommit}`); }
  catch(error){console.error(error.message);process.exitCode=1;}
}
