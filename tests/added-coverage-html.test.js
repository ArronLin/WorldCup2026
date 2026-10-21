import { it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { sha256 } from '../scripts/capture-coverage-baseline.mjs';
import { renderAddedCoverage, writeAddedCoverage } from '../scripts/render-added-coverage.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'added-html-'));
  mkdirSync(path.join(root, 'src'));
  const a = 'export const first = 1;\nexport const second = 2;\n// </script><img src=x onerror="window.injected=true">\n';
  const z = 'export const untouched = 0;\n';
  writeFileSync(path.join(root, 'src/a.js'), a);
  writeFileSync(path.join(root, 'src/z.js'), z);
  const report = {
    schemaVersion: 1, baseCommit: 'a'.repeat(40), C: 1, D: 2,
    ratio: 0.5, passed: false, notApplicable: false,
    files: [
      { path: 'src/a.js', sourceHash: sha256(a), changedLines: [1,2,3], addedExecutableLines: [1,2], hitLines: [1], C: 1, D: 2 },
      { path: 'src/z.js', sourceHash: sha256(z), changedLines: [], addedExecutableLines: [], hitLines: [], C: 0, D: 0 },
    ],
  };
  return { root, report, render: () => renderAddedCoverage({ root, report }) };
}

it('renders aggregate and per-file coverage; labels covered/uncovered source and escapes source HTML', () => {
  const f = fixture();
  const dom = new JSDOM(f.render(), { runScripts: 'dangerously' });
  const doc = dom.window.document;
  expect(doc.querySelector('[data-summary="ratio"]')?.textContent).toContain('50%');
  expect(doc.querySelector('[data-summary="fraction"]')?.textContent).toBe('1 / 2');
  expect(doc.querySelector('[data-summary="missing"]')?.textContent).toBe('1');
  expect(doc.querySelector('[data-source="src/a.js"] [data-line="1"]').classList.contains('covered')).toBe(true);
  expect(doc.querySelector('[data-source="src/a.js"] [data-line="2"]').classList.contains('uncovered')).toBe(true);
  expect(doc.querySelector('[data-source="src/a.js"] [data-line="3"]').textContent).toContain('</script><img');
  expect(doc.querySelectorAll('img')).toHaveLength(0);
  expect(dom.window.injected).toBeUndefined();
  expect(doc.querySelectorAll('script[src],link[href^="http"]')).toHaveLength(0);
  dom.window.close();
});

it('filters files, exposes D=0 as not applicable, and switches actual source line visibility', () => {
  const f = fixture(); const dom = new JSDOM(f.render(), { runScripts: 'dangerously' });
  const { document: doc, Event } = dom.window;
  const scrollToSource = vi.fn();
  doc.querySelector('#source-view').scrollIntoView = scrollToSource;
  const rows = () => [...doc.querySelectorAll('[data-file-row]')].filter(el => !el.hidden);
  expect(rows()).toHaveLength(1);
  const all = doc.querySelector('#show-all'); all.checked = true; all.dispatchEvent(new Event('change'));
  expect(rows()).toHaveLength(2); expect(rows()[1].textContent).toContain('不适用');
  const search = doc.querySelector('#file-search'); search.value = 'src/z'; search.dispatchEvent(new Event('input'));
  expect(rows()).toHaveLength(1); rows()[0].querySelector('button').click();
  expect(scrollToSource).toHaveBeenCalledOnce();
  expect(doc.querySelector('[data-source="src/z.js"]').hidden).toBe(false);
  search.value = 'missing-file'; search.dispatchEvent(new Event('input'));
  expect(doc.querySelector('#file-empty').hidden).toBe(false);
  search.value = ''; search.dispatchEvent(new Event('input'));
  doc.querySelector('[data-file-row="src/a.js"] button').click();
  const mode = doc.querySelector('#line-mode'); mode.value = 'uncovered'; mode.dispatchEvent(new Event('change'));
  const visible = [...doc.querySelectorAll('[data-source="src/a.js"] [data-line]')].filter(el => !el.hidden);
  expect(visible.map(el => el.dataset.line)).toEqual(['2']);
  dom.window.close();
});

it('refuses stale sources, inconsistent counts, duplicate paths and out-of-range lines', () => {
  const f = fixture(); writeFileSync(path.join(f.root, 'src/a.js'), 'export const changed = 0;');
  expect(f.render).toThrow(/hash|摘要/i);
  for (const change of [
    f => f.report.C = 0,
    f => f.report.files[0].hitLines = [2,99],
    f => f.report.files.push(f.report.files[0]),
    f => f.report.files[0].path = '../outside.js',
  ]) { const f = fixture(); change(f); expect(f.render).toThrow(); }
});

it('represents D=0 as not applicable rather than 100 percent', () => {
  const f = fixture();
  Object.assign(f.report, { C:0, D:0, ratio:null, passed:true, notApplicable:true });
  Object.assign(f.report.files[0], { C:0, D:0, changedLines:[3], addedExecutableLines:[], hitLines:[] });
  const doc = new JSDOM(f.render()).window.document;
  expect(doc.querySelector('[data-summary="ratio"]')?.textContent).toBe('不适用');
  expect(doc.querySelector('#file-empty')?.textContent).toContain('没有符合条件的文件');
});

it('writes a portable HTML via the CLI, leaves JSON intact and rejects overwriting source or JSON', () => {
  const f = fixture(); const input = path.join(f.root, 'coverage-added.json');
  const original = JSON.stringify(f.report); writeFileSync(input, original);
  const command = path.resolve('scripts/render-added-coverage.mjs');
  const run = spawnSync(process.execPath, [command, '--root', f.root, '--input', input, '--title', 'Fixture report'], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  expect(readFileSync(input.replace('.json', '.html'), 'utf8')).toContain('Fixture report');
  expect(readFileSync(input, 'utf8')).toBe(original);
  expect(() => writeAddedCoverage({ root:f.root, input, output:input })).toThrow();
  expect(() => writeAddedCoverage({ root:f.root, input, output:'src/a.js' })).toThrow();
  const dom = new JSDOM(f.render(), { runScripts:'dangerously', url:'https://report.invalid/#source-0-L2' });
  expect(dom.window.document.querySelector('[data-source="src/a.js"]').hidden).toBe(false);
  expect(dom.window.document.querySelector('[data-line="2"]').hidden).toBe(false);
  dom.window.close();
});
