import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from './capture-coverage-baseline.mjs';
import { listAuditFiles, normalizeAuditSources } from './check-added-coverage.mjs';

export function parseCoverageArgs(argv) {
  let sources;
  const vitestArgs = [];
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (argument === '--audit-sources' || argument.startsWith('--audit-sources=')) {
      if (sources !== undefined) throw Error('Duplicate --audit-sources');
      sources = argument === '--audit-sources' ? argv[++i] : argument.slice('--audit-sources='.length);
      if (!sources || sources.startsWith('--')) throw Error('Missing --audit-sources value');
    } else vitestArgs.push(argument);
  }
  return { auditSources: normalizeAuditSources(sources), vitestArgs };
}

export function runUnitCoverage({ root = process.cwd(), argv = [], spawn = spawnSync } = {}) {
  const { auditSources, vitestArgs } = parseCoverageArgs(argv);
  const hashes = () => Object.fromEntries(listAuditFiles(root, auditSources).map(p => [p, sha256(readFileSync(path.join(root, p), 'utf8'))]));
  const before = hashes();
  const result = spawn(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--coverage', ...vitestArgs], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) return result.status ?? 1;
  if (JSON.stringify(before) !== JSON.stringify(hashes())) throw Error('Production changed during coverage collection');
  writeFileSync(path.join(root, 'coverage/source-hashes.json'), JSON.stringify({
    time: new Date().toISOString(), node: process.version, auditSources, files: before,
    reportSha256: sha256(readFileSync(path.join(root, 'coverage/coverage-final.json'), 'utf8')),
  }, null, 2) + '\n');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = runUnitCoverage({ argv: process.argv.slice(2) }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
