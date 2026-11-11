import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fixture, hash } from './fixtures/coverage/helpers.js';
import { parseCoverageArgs, runUnitCoverage } from '../scripts/run-unit-coverage.mjs';

const cli = path.resolve('scripts/run-unit-coverage.mjs');
function runnerFixture(exit = 0, mutate = false) {
  const f = fixture();
  f.put('src/a.js', 'export const x=1;');
  f.put('coverage/coverage-final.json', {});
  f.put('node_modules/vitest/vitest.mjs', `import {writeFileSync} from 'node:fs';
    writeFileSync('runner-args.json', JSON.stringify(process.argv.slice(2)));
    ${mutate ? "writeFileSync('src/a.js','export const x=2;');" : ''}
    process.exitCode=${exit};`);
  return { ...f, run: (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: f.root, encoding: 'utf8' }) };
}

describe('coverage runner existing CLI', () => {
  it('forwards runner arguments and stamps the actual source/report', () => {
    const f = runnerFixture();
    expect(f.run('tests/example.test.js').status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(f.root, 'runner-args.json'), 'utf8'))).toEqual(['run', '--coverage', 'tests/example.test.js']);
    expect(JSON.parse(readFileSync(path.join(f.root, 'coverage/source-hashes.json'), 'utf8'))).toMatchObject({
      files: { 'src/a.js': hash('export const x=1;') }, reportSha256: hash('{}'),
    });
  });
  it('propagates failed execution without stamping a successful collection', () => {
    const f = runnerFixture(7);
    expect(f.run().status).toBe(7);
    expect(existsSync(path.join(f.root, 'coverage/source-hashes.json'))).toBe(false);
  });
  it('rejects a source mutation during collection', () => {
    const f = runnerFixture(0, true);
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Production changed during coverage collection');
  });
});

describe('explicit audit source collection', () => {
  it('strips only its own option and preserves Vitest options', () => {
    expect(parseCoverageArgs(['--config', 'custom.js', '--audit-sources', 'scripts/b.mjs,scripts/a.mjs', 'tests/a.test.js'])).toEqual({
      auditSources: ['scripts/a.mjs', 'scripts/b.mjs'], vitestArgs: ['--config', 'custom.js', 'tests/a.test.js'],
    });
    expect(parseCoverageArgs(['--audit-sources=scripts/a.mjs'])).toEqual({ auditSources: ['scripts/a.mjs'], vitestArgs: [] });
  });
  it.each([['--audit-sources'], ['--audit-sources', '../outside.js'], ['--audit-sources', 'tests/fake.js'], ['--audit-sources', 'scripts/a.mjs', '--audit-sources', 'scripts/b.mjs']].map(args => [args]))('rejects malformed or ambiguous collection scope %j', args => {
    expect(() => parseCoverageArgs(args)).toThrow();
  });
  it('collects the actual explicit script and stamps the same scope', () => {
    const f = runnerFixture(); f.put('scripts/tool.mjs', 'export const x=1;');
    const spawn = vi.fn(() => ({ status: 0 }));
    expect(runUnitCoverage({ root: f.root, argv: ['--audit-sources', 'scripts/tool.mjs', '--config', 'custom.js'], spawn })).toBe(0);
    expect(spawn.mock.calls[0][1].slice(1)).toEqual(['run', '--coverage', '--config', 'custom.js']);
    expect(JSON.parse(readFileSync(path.join(f.root, 'coverage/source-hashes.json'), 'utf8'))).toMatchObject({
      auditSources: ['scripts/tool.mjs'], files: { 'src/a.js': hash('export const x=1;'), 'scripts/tool.mjs': hash('export const x=1;') },
    });
  });
  it('fails when requested script is missing or changes during collection', () => {
    const f = runnerFixture();
    expect(() => runUnitCoverage({ root: f.root, argv: ['--audit-sources', 'scripts/missing.mjs'], spawn: vi.fn(() => ({ status: 0 })) })).toThrow();
    f.put('scripts/tool.mjs', 'export const x=1;');
    expect(() => runUnitCoverage({ root: f.root, argv: ['--audit-sources', 'scripts/tool.mjs'], spawn: () => {
      f.put('scripts/tool.mjs', 'export const x=2;'); return { status: 0 };
    } })).toThrow(/changed during/);
  });
  it('returns a failed spawn status without claiming collection success', () => {
    const f = runnerFixture();
    expect(runUnitCoverage({ root: f.root, spawn: () => ({ status: null }) })).toBe(1);
    expect(existsSync(path.join(f.root, 'coverage/source-hashes.json'))).toBe(false);
  });
});
