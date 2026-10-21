import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inside, isProduction, listProduction, normalize, sha256, parseArgs } from './capture-coverage-baseline.mjs';
import { styles, initReport } from './added-coverage-report.mjs';

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const percent = (C, D) => D ? `${Number((100 * C / D).toFixed(2))}%` : '不适用';
const requireValid = (condition, message) => { if (!condition) throw Error(`新增行报告无效：${message}`); };
const count = value => Number.isSafeInteger(value) && value >= 0;

// Render only the already-audited data. Never recollect, recapture or change its baseline.
export function renderAddedCoverage({ root = process.cwd(), report, title = '关注球队与我的比赛' }) {
  requireValid(report?.schemaVersion === 1 && Array.isArray(report.files), 'schema');
  requireValid(count(report.C) && count(report.D) && report.C <= report.D, '汇总计数');
  const seen = new Set();
  const entries = report.files.map((file, index) => {
    requireValid(typeof file.path === 'string' && isProduction(file.path) && !seen.has(file.path), '生产路径或重复文件');
    seen.add(file.path);
    const source = normalize(readFileSync(inside(root, file.path), 'utf8'));
    requireValid(sha256(source) === file.sourceHash, `源码摘要 hash 不匹配：${file.path}，请重新采集覆盖率`);
    const lines = source.split('\n');
    for (const key of ['changedLines', 'addedExecutableLines', 'hitLines']) {
      requireValid(Array.isArray(file[key]) && new Set(file[key]).size === file[key].length
        && file[key].every(n => Number.isSafeInteger(n) && n > 0 && n <= lines.length), `${file.path} 的 ${key}`);
    }
    const added = new Set(file.addedExecutableLines), hits = new Set(file.hitLines);
    requireValid([...hits].every(n => added.has(n)) && file.C === hits.size && file.D === added.size, `${file.path} 行数不一致`);
    return { ...file, index, lines, added, hits };
  });
  requireValid(JSON.stringify([...seen].sort()) === JSON.stringify(listProduction(root)), '生产文件清单不完整');
  requireValid(report.C === entries.reduce((sum, f) => sum + f.C, 0)
    && report.D === entries.reduce((sum, f) => sum + f.D, 0), '逐文件与汇总不一致');
  requireValid(report.ratio === (report.D ? report.C / report.D : null)
    && report.passed === (report.D === 0 || 5 * report.C >= 4 * report.D)
    && report.notApplicable === (report.D === 0), '比例或判定不一致');

  const changed = entries.filter(f => f.D > 0);
  const first = [...changed].sort((a, b) => (b.D - b.C) - (a.D - a.C))[0];
  const rows = entries.map(f => `<tr data-file-row="${escapeHTML(f.path)}" data-added="${f.D}" ${f.D ? '' : 'hidden'}>
    <td><button type="button" data-select="${f.index}" aria-controls="source-${f.index}" ${f === first ? 'aria-current="true"' : ''}>${escapeHTML(f.path)}</button></td>
    <td>${f.C} / ${f.D}</td><td>${f.D - f.C}</td><td><span class="badge ${f.D === f.C && f.D ? 'good' : f.D ? 'bad' : 'neutral'}">${percent(f.C, f.D)}</span></td></tr>`).join('');
  const sources = entries.map(f => `<section class="source" data-source="${escapeHTML(f.path)}" id="source-${f.index}" ${f === first ? '' : 'hidden'}>
    <div class="source-heading"><h3 tabindex="-1">${escapeHTML(f.path)}</h3><p>${f.D ? `已覆盖 ${f.C} / ${f.D} 行 · 新增未覆盖 ${f.D - f.C} 行` : '无新增可执行行，不参与本功能覆盖率计算。'}</p></div>
    <div class="code-scroll" tabindex="0" role="region" aria-label="${escapeHTML(f.path)} 源码，可横向滚动"><table class="code"><caption class="sr-only">源码行号、覆盖状态和代码</caption><tbody>${f.lines.map((text, i) => {
      const n = i + 1, state = f.added.has(n) ? f.hits.has(n) ? 'covered' : 'uncovered' : 'context';
      const label = state === 'covered' ? '✓ 已覆盖' : state === 'uncovered' ? '✕ 未覆盖' : '—';
      return `<tr class="code-line ${state}" data-line="${n}" id="source-${f.index}-L${n}"><td class="line-number"><a href="#source-${f.index}-L${n}">${n}</a></td><td class="line-status">${label}</td><td><pre>${escapeHTML(text) || ' '}</pre></td></tr>`;
    }).join('')}</tbody></table></div><p class="line-empty" hidden>当前文件没有符合条件的源码行。</p>
    <details class="file-meta"><summary>源码校验信息</summary><p>SHA256（LF）：<code>${escapeHTML(f.sourceHash)}</code></p><p>基线：${f.baseHash == null ? '新增文件，或报告未记录基线摘要' : escapeHTML(f.baseHash)}</p></details></section>`).join('');

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(title)} · 新增行覆盖率</title><style>${styles}</style></head>
<body><a class="skip" href="#source-view">跳至源码</a><main>
  <header><p class="eyebrow">WORLD CUP 2026 / 测试质量报告</p><h1>新增行覆盖率</h1><p class="subtitle">${escapeHTML(title)}<span class="badge ${report.passed ? 'good' : 'bad'}">${report.notApplicable ? '不适用' : report.passed ? '达到 80% 门槛' : '未达到 80% 门槛'}</span></p></header>
  <section class="metrics" aria-label="功能覆盖率汇总"><article><h2>新增行单测覆盖率</h2><strong data-summary="ratio">${percent(report.C, report.D)}</strong><p>按全部文件汇总，不取文件百分比平均值</p></article><article><h2>已覆盖 / 新增可执行行</h2><strong data-summary="fraction">${report.C} / ${report.D}</strong><p>由 Vitest 单元测试采集</p></article><article><h2>新增未覆盖行</h2><strong data-summary="missing">${report.D - report.C}</strong><p>${changed.length} 个文件有新增可执行行</p></article></section>
  <details class="explanation"><summary>为什么有些文件 C、D 都是 0？</summary><p>JSON 保留全部 ${entries.length} 个生产文件作为审计清单。C=0、D=0 表示没有新增可执行行，不会拉低或抬高汇总覆盖率；可能没有改动，也可能只修改了注释、空白等。此类文件的比例显示“不适用”。</p><p>可执行行按覆盖工具映射后的语句起始行统计；多行续行的修改会映射回所属语句。行覆盖率不代表分支覆盖率或测试用例通过率，也不包含浏览器端到端测试命中。</p></details>
  <section class="files" aria-labelledby="files-heading"><div class="section-heading"><h2 id="files-heading">逐文件覆盖率</h2><p id="file-count" role="status">显示 ${changed.length} / ${entries.length} 个文件</p></div>
    <div class="toolbar"><label class="search-label" for="file-search">搜索文件<input id="file-search" type="search" placeholder="输入文件路径，例如 state.js" autocomplete="off"></label><label class="check"><input id="show-all" type="checkbox">包括无新增可执行行的文件</label></div>
    <div class="table-scroll"><table class="file-table"><caption class="sr-only">点击文件路径查看源码</caption><thead><tr><th scope="col">生产文件</th><th scope="col">已覆盖 / 新增行</th><th scope="col">未覆盖</th><th scope="col">行覆盖率</th></tr></thead><tbody>${rows}</tbody></table></div><p id="file-empty" ${changed.length ? 'hidden' : ''}>没有符合条件的文件。</p></section>
  <section id="source-view" aria-labelledby="source-heading"><div class="section-heading"><h2 id="source-heading">源码明细</h2><label for="line-mode">显示范围 <select id="line-mode"><option value="all">全部源码</option><option value="added">仅新增可执行行</option><option value="uncovered">仅新增未覆盖行</option></select></label></div><p class="legend"><span class="good">✓ 新增已覆盖</span><span class="bad">✕ 新增未覆盖</span><span>— 原有代码或非新增可执行行</span></p><p id="source-placeholder" ${first ? 'hidden' : ''}>请在文件列表中选择一个文件。</p>${sources}</section>
  <footer><p>基线提交：<code>${escapeHTML(report.baseCommit || '未提供')}</code></p><p>本页面是输入 JSON 与匹配源码的离线快照；未重新执行测试。分享此 HTML 无需额外源码、网络或服务。</p><details><summary>报告来源摘要</summary><p>基线摘要：<code>${escapeHTML(report.baselineHash || '未提供')}</code></p><p>原始覆盖数据摘要：<code>${escapeHTML(report.reportHash || '未提供')}</code></p></details></footer>
</main><noscript>文件搜索、切换与行筛选需要 JavaScript；默认文件的源码和汇总仍可阅读。</noscript><script>(${initReport.toString()})();</script></body></html>`;
}

export function writeAddedCoverage({ root = process.cwd(), input = 'specs/001-follow-teams/evidence/coverage-added.json', output, title } = {}) {
  const inputPath = path.resolve(root, input);
  const outputPath = path.resolve(root, output || input.replace(/\.json$/i, '') + '.html');
  requireValid(/\.html?$/i.test(outputPath), '输出必须是 HTML 文件');
  requireValid(outputPath !== inputPath && !isProduction(path.relative(root, outputPath).replaceAll('\\', '/')), '输出不能覆盖输入报告或生产源码');
  const report = JSON.parse(readFileSync(inputPath, 'utf8'));
  const html = renderAddedCoverage({ root, report, title });
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);
  return { output: outputPath, C: report.C, D: report.D };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(writeAddedCoverage(parseArgs(process.argv.slice(2))))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
