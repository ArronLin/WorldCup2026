import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { normalizeUnit, normalizeBrowser, evaluateItems, assessCycle, renderRequirementsReport } from '../scripts/render-requirements-tdd.mjs';

const cases = [{ id:'unit:one', file:'tests/a.test.js', title:'works', fullName:'suite works', status:'passed', duration:2 }];
const mapping = { groups:{ one:{ file:'tests/a.test.js', prefix:'works' } }, items:[{id:'FR-001',kind:'FR',text:'<script>bad()</script>',groups:['one']}] };
it('normalizes real Vitest and nested Playwright results and preserves retries and skipped tests', () => {
  expect(normalizeUnit({testResults:[{name:'D:/repo/tests/a.test.js',assertionResults:[{title:'works',fullName:'suite works',status:'passed',duration:2}]}]},'D:/repo')[0]).toMatchObject({file:'tests/a.test.js',status:'passed'});
  const browser = normalizeBrowser({suites:[{title:'e2e/a.spec.js',file:'e2e/a.spec.js',specs:[{title:'flaky',file:'e2e/a.spec.js',tests:[{projectName:'chromium',status:'flaky',expectedStatus:'passed',results:[{status:'failed'},{status:'passed'}]}]}]}]});
  expect(browser[0]).toMatchObject({file:'e2e/a.spec.js',status:'flaky',attempts:2});
});
it('resolves Playwright testDir-relative paths using the recorded rootDir', () => {
  const data={config:{rootDir:'D:/repo/e2e'},suites:[{file:'a.spec.js',specs:[{title:'works',file:'a.spec.js',tests:[{results:[{status:'passed'}]}]}]}]};
  expect(normalizeBrowser(data,'D:/repo')[0].file).toBe('e2e/a.spec.js');
});
it('never counts missing, skipped, failed, flaky or partial mappings as fully verified', () => {
  expect(evaluateItems(mapping,cases)[0].status).toBe('verified');
  for(const status of ['failed','skipped','flaky']) expect(evaluateItems(mapping,[{...cases[0],status}])[0].status).toBe('unverified');
  expect(evaluateItems(mapping,[])[0].status).toBe('unverified');
  expect(evaluateItems({...mapping,items:[{...mapping.items[0],gap:'尚无独立断言'}]},cases)[0].status).toBe('partial');
  expect(()=>evaluateItems({...mapping,items:[{...mapping.items[0],groups:['absent']}]},cases)).toThrow(/映射/);
});
it('requires ordered valid semantic Red and passing Green/Refactor; does not infer per-case TDD', () => {
  const rows = [
    {phase:'red',time:'2026-10-20T01:00:00Z',exitCode:1,valid:true,semanticRed:true,assertionFailure:true},
    {phase:'green',time:'2026-10-20T01:01:00Z',exitCode:0,valid:true},
    {phase:'refactor',time:'2026-10-20T01:02:00Z',exitCode:0,valid:true},
  ];
  expect(assessCycle(rows)).toMatchObject({complete:true,perCaseVerified:false});
  expect(assessCycle(rows.map(r=>({...r,semanticRed:false})) ).complete).toBe(false);
  expect(assessCycle(rows.map(r=>({...r,assertionFailure:false})) ).complete).toBe(false);
  expect(assessCycle(rows.filter(r=>r.phase!=='red')).complete).toBe(false);
  expect(assessCycle([rows[1],rows[2],{...rows[0],time:'2026-10-20T01:03:00Z'}]).complete).toBe(false);
});
it('rejects duplicate requirements and ambiguous selectors rather than inventing coverage', () => {
  expect(()=>evaluateItems({...mapping,items:[...mapping.items,...mapping.items]},cases)).toThrow(/重复/);
  expect(()=>evaluateItems(mapping,[...cases,{...cases[0],id:'other'}])).toThrow(/歧义/);
});
it('renders offline traceability with escaped input, independent metrics and real working filters', () => {
  const report = {generatedAt:'2026-10-21T00:00:00Z',items:evaluateItems(mapping,cases),tests:cases,cycles:[],runs:[],sources:[],warnings:['逐用例 TDD 不可判定'],summary:{FR:{passed:1,total:1},AS:{passed:0,total:0},E:{passed:0,total:0},SC:{passed:0,total:0}}};
  const dom = new JSDOM(renderRequirementsReport(report),{runScripts:'dangerously'}); const d=dom.window.document;
  expect(d.querySelector('[data-metric="requirements"]').textContent).toContain('1 / 1');
  expect(d.querySelectorAll('script')).toHaveLength(1);expect(d.querySelectorAll('script[src],link[href^="http"]')).toHaveLength(0);
  expect(d.querySelector('[data-item]').textContent).toContain('<script>bad()</script>');
  const search=d.querySelector('#item-search');search.value='missing';search.dispatchEvent(new dom.window.Event('input'));
  expect(d.querySelector('[data-item]').hidden).toBe(true);expect(d.querySelector('#empty').hidden).toBe(false);
  search.value='FR-001';search.dispatchEvent(new dom.window.Event('input'));expect(d.querySelector('[data-item]').hidden).toBe(false);
  const status=d.querySelector('#item-status');status.value='unverified';status.dispatchEvent(new dom.window.Event('change'));expect(d.querySelector('[data-item]').hidden).toBe(true);
  dom.window.close();
});
it('opens every collapsed ancestor when following a test source link', () => {
  const report={items:evaluateItems(mapping,cases),tests:cases,cycles:[],runs:[],sources:[],warnings:[],testSources:[{path:'tests/a.test.js',content:'expect(real()).toBe(true)'}],summary:{FR:{passed:1,total:1},AS:{passed:0,total:0}}};
  const dom=new JSDOM(renderRequirementsReport(report),{runScripts:'dangerously'}),d=dom.window.document;
  d.querySelector('[data-open="test-source-0"]').click();
  const source=d.getElementById('test-source-0');expect(source.open).toBe(true);expect(source.parentElement.closest('details').open).toBe(true);
  dom.window.close();
});
