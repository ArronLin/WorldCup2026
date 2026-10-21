import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { styles } from './added-coverage-report.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slash = value => value.replaceAll('\\','/');
const ensure = (condition,message) => {if(!condition)throw Error('需求/TDD 报告：'+message)};
const clean = text => text.replace(/\x1b\[[0-9;]*m/g,'');
function inside(root,relative){ensure(typeof relative==='string'&&!path.isAbsolute(relative),'需要相对路径');const full=path.resolve(root,relative);ensure(full.startsWith(path.resolve(root)+path.sep),'路径越界');return full;}
const percent = (n,d) => d ? `${Number((100*n/d).toFixed(1))}%` : '不适用';
const statusLabels = {passed:'通过',verified:'映射测试通过',partial:'部分验证',unverified:'未验证',failed:'失败',skipped:'跳过',pending:'未执行',todo:'待实现',flaky:'重试后通过',timedOut:'超时','expected-failure':'预期失败'};
const badge = (status,label=statusLabels[status]||status) => `<span class="badge ${status==='passed'||status==='verified'?'good':status==='partial'||status==='flaky'?'warn':status==='unverified'||status==='failed'?'bad':'neutral'}">${esc(label)}</span>`;

export function normalizeUnit(data,root){
  ensure(Array.isArray(data.testResults),'Vitest 结果格式');
  return data.testResults.flatMap(file=>{
    const relative=slash(path.relative(root,file.name));ensure(!relative.startsWith('../')&&!path.isAbsolute(relative),'单测路径越界');
    return (file.assertionResults||[]).map(t=>({id:`unit:${relative}::${t.fullName}`,suite:'unit',file:relative,title:t.title,fullName:t.fullName,status:t.status,duration:t.duration||0,attempts:1,failure:(t.failureMessages||[]).map(clean).join('\n')}));
  });
}

export function normalizeBrowser(data,root=process.cwd()){
  ensure(Array.isArray(data.suites),'Playwright 结果格式');const cases=[];
  const testDir=data.config?.rootDir?slash(path.relative(root,data.config.rootDir)):'';
  function visit(suite,parents=[]){
    for(const spec of suite.specs||[]){for(const t of spec.tests||[]){
      const file=path.posix.normalize(path.posix.join(testDir,slash(spec.file||suite.file))),title=[...parents,spec.title].join(' › '),last=t.results?.at(-1);
      ensure(!file.startsWith('../')&&!path.isAbsolute(file),'浏览器测试路径越界');
      let status=t.status==='flaky'?'flaky':last?.status||'skipped';
      if(t.expectedStatus==='failed')status='expected-failure';
      cases.push({id:`browser:${t.projectName||'default'}:${file}::${title}`,suite:'browser',file,title:spec.title,fullName:title,status,duration:(t.results||[]).reduce((s,r)=>s+(r.duration||0),0),attempts:t.results?.length||0,failure:(t.results||[]).flatMap(r=>(r.errors||[]).map(e=>clean(e.message||''))).join('\n')});
    }}
    for(const child of suite.suites||[])visit(child,[...parents,...(child.title?[child.title]:[])]);
  }
  for(const suite of data.suites)visit(suite);return cases;
}

export function evaluateItems(mapping,tests){
  ensure(new Set(tests.map(t=>t.id)).size===tests.length,'测试 ID 重复');
  ensure(new Set(tests.map(t=>`${t.suite||'unit'}:${t.file}:${t.fullName}`)).size===tests.length,'同名测试歧义');
  ensure(new Set(mapping.items.map(i=>i.id)).size===mapping.items.length,'需求编号重复');
  return mapping.items.map(item=>{
    const matches=new Map(),missing=[];
    for(const key of item.groups){const selector=mapping.groups[key];ensure(selector,'映射引用不存在：'+key);
      const found=tests.filter(t=>t.file===selector.file&&t.title.startsWith(selector.prefix));
      if(!found.length)missing.push(key);for(const t of found)matches.set(t.id,t);
    }
    const selected=[...matches.values()],allPassed=selected.length>0&&!missing.length&&selected.every(t=>t.status==='passed');
    return {...item,testIds:selected.map(t=>t.id),missing,status:allPassed?(item.gap?'partial':'verified'):'unverified'};
  });
}

export function assessCycle(rows){
  const eligible=rows.filter(r=>r.valid&&Number.isFinite(Date.parse(r.time))).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  for(const red of eligible.filter(r=>r.phase==='red'&&r.exitCode!==0&&r.semanticRed&&r.assertionFailure)){
    const green=eligible.find(r=>r.phase==='green'&&r.exitCode===0&&Date.parse(r.time)>Date.parse(red.time));
    const refactor=green&&eligible.find(r=>r.phase==='refactor'&&r.exitCode===0&&Date.parse(r.time)>Date.parse(green.time));
    if(refactor)return {complete:true,perCaseVerified:false,selected:[red,green,refactor]};
  }
  return {complete:false,perCaseVerified:false,selected:[]};
}

const cycleDefinitions=[
  ['安全存储',['T004','T005','T006']],['数据结果与重试',['T007','T008','T009']],['路由与焦点',['T010','T011','T012']],['阶段语义',['T013','T014','T015']],
  ['关注状态与持久化',['T016','T017','T018']],['详情与控制器',['T019','T020','T021']],['比赛集合筛选',['T027','T028','T029']],['筛选状态与赛程',['T030','T031','T032']],
  ['语言加载顺序',['T037','T038','T039']],['实际双语状态保留',['T040','T041','T042']],['新增覆盖率审计',['T046','T047','T048']],['变异验证工具',['T049','T050']],
];

export function buildRequirementsReport({root=process.cwd(),feature='specs/001-follow-teams'}={}){
  const evidence=feature+'/evidence',runDir=evidence+'/requirements-report',sources=new Map();
  function read(relative){const raw=fs.readFileSync(inside(root,relative));sources.set(relative,{path:relative,hash:hash(raw)});return raw.toString('utf8');}
  function readJson(relative){return JSON.parse(read(relative).replace(/^\uFEFF/,''));}
  const spec=read(feature+'/spec.md'),mapping=readJson(feature+'/requirements-test-map.json');
  ensure(mapping.schemaVersion===1&&mapping.feature===path.basename(feature),'映射版本或功能不一致');
  const declared=new Map();
  for(const line of spec.split(/\r?\n/)){const m=line.match(/^(?:- |\d+\. )\*\*((?:FR-\d+|US\d+-A\d+|E\d+|SC-\d+))\*\*[：:]\s*(.*)/);if(m){ensure(!declared.has(m[1]),'规格编号重复');declared.set(m[1],m[2]);}}
  ensure(declared.size===mapping.items.length&&mapping.items.every(i=>declared.has(i.id)),'规格与映射清单不完整');
  mapping.items=mapping.items.map(i=>({...i,text:declared.get(i.id),kind:i.id.startsWith('FR-')?'FR':i.id.startsWith('US')?'AS':i.id.startsWith('SC-')?'SC':'E'}));
  const runs=[];
  for(const suite of ['unit','browser']){
    const receipt=readJson(runDir+'/'+suite+'-receipt.json'),raw=read(runDir+'/'+suite+'.json');
    ensure(receipt.unchanged&&receipt.resultHash===hash(raw),suite+' 结果或运行绑定不一致');
    // The capture also inventories the other framework's tests. They are not
    // execution inputs to this suite and must not force unrelated reruns.
    for(const [file,digest] of Object.entries(receipt.hashes)){
      if(suite==='browser'&&file.startsWith('tests/')||suite==='unit'&&file.startsWith('e2e/'))continue;
      ensure(hash(fs.readFileSync(inside(root,file)))===digest,'当前源码/测试/规格已变化：'+file);
    }
    const data=JSON.parse(raw);ensure(suite!=='browser'||!(data.errors||[]).length,'浏览器存在全局执行错误');
    runs.push({...receipt,resultFile:runDir+'/'+suite+'.json',tests:suite==='unit'?normalizeUnit(data,root):normalizeBrowser(data,root)});
  }
  const tests=runs.flatMap(r=>r.tests),items=evaluateItems(mapping,tests);
  ensure(tests.length>0,'没有真实测试结果');
  const cycles=cycleDefinitions.map(([label,tasks])=>{
    const attempts=[];
    for(const task of tasks){const index=readJson(evidence+'/'+task+'/index.json');
      for(const a of index.attempts){
        const metadata=evidence+'/'+task+'/'+a.metadata,log=evidence+'/'+task+'/'+a.log,raw=readJson(metadata),logText=clean(read(log));
        const valid=index.validEvidence.includes(a.metadata)&&a.runnerAccepted===true&&raw.accepted===true&&raw.phase===a.phase&&raw.exitCode===a.exitCode&&JSON.stringify(raw.command)===JSON.stringify(a.command);
        attempts.push({...a,task,metadata,log,logText,valid,assertionFailure:/AssertionError:/.test(logText),sourceHashCount:Object.keys(raw.sourceHashes||{}).length});
      }
    }
    const assessment=assessCycle(attempts),files=[...new Set(attempts.flatMap(a=>a.command.filter(s=>/^(tests\/.*\.test\.js)$/.test(s))))];
    return {id:tasks.join('–'),label,tasks,files,attempts,...assessment};
  });
  for(const test of tests)test.cycles=cycles.filter(c=>c.files.includes(test.file)).map(c=>c.id);
  const testSources=[...new Set(items.flatMap(i=>i.testIds).map(id=>tests.find(t=>t.id===id).file))].map(file=>({path:file,content:read(file)}));
  const summary=Object.fromEntries(['FR','AS','E','SC'].map(kind=>[kind,{total:items.filter(i=>i.kind===kind).length,passed:items.filter(i=>i.kind===kind&&i.status==='verified').length}]));
  read('scripts/render-requirements-tdd.mjs');read('scripts/added-coverage-report.mjs');
  const warnings=[
    '需求映射由对现有断言的人工核对建立；映射测试通过不等于证明所有可能输入都正确。请展开测试源码和结果审阅。',
    '历史记录提供任务级命令、时间、退出码、生产源码摘要和原始日志；没有逐用例历史测试源码指纹，不能证明当前每条用例的 Red→Green 连续性。逐用例 TDD 完整率不可判定，不填成 100%。',
    '12 组任务链包含业务测试与基础设施/测试工具；原始失败尝试保留，依赖/收集错误不计为业务 Red。Refactor 有审视后无需修改的回归，不代表每组都修改过代码。',
    'SC-005 的中文流程缺少单独的零 AI 请求断言，保守标记为部分验证。当前重跑证明现有测试结果，不补造历史 Red。',
    '这是本地 Chromium 和已配置测试数据的报告；不代表其他浏览器、远程 CI 或生产服务已经验收。',
  ];
  return {schemaVersion:1,feature,title:'关注球队与我的比赛',generatedAt:new Date().toISOString(),items,tests,cycles,runs:runs.map(({tests,...r})=>({...r,total:tests.length,passed:tests.filter(t=>t.status==='passed').length})),testSources,sources:[...sources.values()],summary,warnings,perCaseTdd:{status:'unknown',reason:'缺少历史逐用例测试指纹'},mappingReview:mapping.reviewNote};
}

export function initRequirementsReport(){
  const q=document.querySelector('#item-search'),kind=document.querySelector('#item-kind'),status=document.querySelector('#item-status'),rows=[...document.querySelectorAll('[data-item]')];
  function filter(){for(const row of rows)row.hidden=!(row.textContent.toLowerCase().includes(q.value.trim().toLowerCase())&&(!kind.value||row.dataset.kind===kind.value)&&(!status.value||row.dataset.status===status.value));const n=rows.filter(r=>!r.hidden).length;document.querySelector('#visible-count').textContent=`显示 ${n} / ${rows.length} 项`;document.querySelector('#empty').hidden=n>0;}
  q.addEventListener('input',filter);kind.addEventListener('change',filter);status.addEventListener('change',filter);filter();
  document.addEventListener('click',event=>{const a=event.target.closest('a[data-open]');if(!a)return;const target=document.getElementById(a.dataset.open);if(target){target.open=true;for(let p=target.parentElement.closest('details');p;p=p.parentElement.closest('details'))p.open=true;target.scrollIntoView?.({block:'start'});target.querySelector('summary')?.focus();}});
}

export function renderRequirementsReport(report){
  const tests=report.tests,byId=new Map(tests.map((t,i)=>[t.id,{...t,index:i}]));
  const mapped=new Set(report.items.flatMap(i=>i.testIds)),mappedPassed=[...mapped].filter(id=>byId.get(id)?.status==='passed').length;
  const sourceMap=new Map((report.testSources||[]).map((f,i)=>[f.path,i]));
  const rel=relative=>{const p=slash(path.posix.relative((report.feature||'specs/feature')+'/evidence',relative));return p.split('/').map(s=>encodeURIComponent(s)).join('/');};
  const fileLink=(relative,label)=>`<a href="${esc(rel(relative))}">${esc(label||relative)}</a>`;
  const caseLink=id=>{const t=byId.get(id);return t?`<a href="#test-${t.index}" data-open="test-${t.index}">${esc(t.file)} · ${esc(t.title)}</a>`:`缺少测试：${esc(id)}`};
  const metric=(name,label,value,note)=>`<article><h2>${label}</h2><strong data-metric="${name}">${value}</strong><p>${note}</p></article>`;
  const req=report.summary.FR,scenarios=report.summary.AS,complete=report.cycles.filter(c=>c.complete).length;
  const items=report.items.map(i=>`<article class="requirement" id="${esc(i.id)}" data-item="${esc(i.id)}" data-kind="${esc(i.kind)}" data-status="${i.status}"><div class="section-heading"><h3>${esc(i.id)}</h3>${badge(i.status)}</div><p>${esc(i.text)}</p>${i.gap?`<p class="gap">待补证据：${esc(i.gap)}</p>`:''}<details><summary>关联的真实测试（${i.testIds.length}）</summary><ul>${i.testIds.map(id=>`<li>${caseLink(id)} ${badge(byId.get(id)?.status||'pending')}</li>`).join('')}</ul>${i.missing.length?`<p class="gap">未找到映射组：${esc(i.missing.join('、'))}</p>`:''}</details></article>`).join('');
  const caseCards=tests.filter(t=>mapped.has(t.id)).map(t=>{const index=byId.get(t.id).index,links=report.items.filter(i=>i.testIds.includes(t.id)).map(i=>`<a href="#${esc(i.id)}">${esc(i.id)}</a>`).join(' · ');return `<details class="test-card" id="test-${index}"><summary>${badge(t.status)} <span>${esc(t.title)}</span></summary><p><code>${esc(t.file)}</code> · ${t.suite==='unit'?'Vitest 单元/DOM':'Playwright Chromium'} · ${Number(t.duration||0).toFixed(1)}ms · ${t.attempts||1} 次尝试</p><p>完整名称：${esc(t.fullName)}</p><p>对应条目：${links}</p><p>历史任务链：${t.cycles?.length?t.cycles.map(id=>`<a href="#cycle-${esc(id)}">${esc(id)}</a>`).join('、'):'没有对应的任务级 TDD 记录（不代表这条测试失败）'}</p><p class="muted">逐用例历史 Red/测试指纹未完整记录，不能据此宣称该用例已完成可证明的 TDD。</p>${sourceMap.has(t.file)?`<a href="#test-source-${sourceMap.get(t.file)}" data-open="test-source-${sourceMap.get(t.file)}">查看真实测试源码</a>`:''}${t.failure?`<pre class="log">${esc(t.failure)}</pre>`:''}</details>`;}).join('');
  const cycleCards=report.cycles.map(c=>`<article class="cycle" id="cycle-${esc(c.id)}"><div class="section-heading"><h3>${esc(c.label)} · ${esc(c.id)}</h3>${badge(c.complete?'verified':'unverified',c.complete?'任务级三阶段有记录':'任务级记录不完整')}</div><p class="muted">${esc(c.files.join('、'))}</p><div class="phase-grid">${c.selected.map(a=>`<details class="phase"><summary>${esc(a.phase.toUpperCase())} · exit ${a.exitCode}</summary><p>${esc(a.time)}（UTC）</p><p>${a.sourceHashCount} 个生产源码摘要；无历史测试文件摘要</p><pre class="command">${esc(a.command.join(' '))}</pre><p>${fileLink(a.metadata,'原始元数据')} · ${fileLink(a.log,'原始输出')}</p><pre class="log">${esc(a.logText)}</pre></details>`).join('')}</div><details><summary>全部尝试 ${c.attempts.length} 次（未纳入有效记录 ${c.attempts.filter(a=>!a.valid).length} 次）</summary><div class="table-scroll"><table><thead><tr><th>任务/阶段</th><th>时间（UTC）</th><th>退出码</th><th>记录判定</th><th>证据</th></tr></thead><tbody>${c.attempts.map(a=>`<tr><td>${esc(a.task+' / '+a.phase)}</td><td>${esc(a.time)}</td><td>${a.exitCode}</td><td>${a.valid?'历史索引接受':'未接受，不计有效证据'}${a.phase==='red'&&!a.assertionFailure?'；未见 AssertionError':''}</td><td>${fileLink(a.metadata,'JSON')} · ${fileLink(a.log,'TXT')}</td></tr>`).join('')}</tbody></table></div></details></article>`).join('');
  const extra=`
    .metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.metrics strong{font-size:32px}a{color:var(--primary);text-underline-offset:3px}nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}nav a{padding:8px 12px;background:white;border:1px solid var(--border);border-radius:8px}section{margin:30px 0}.requirement,.cycle,.test-card,.source-file{border:1px solid var(--border);background:white;border-radius:12px;padding:18px 20px;margin:12px 0;scroll-margin-top:18px;min-width:0}.requirement .section-heading,.cycle .section-heading{margin-bottom:8px}.requirement p,.test-card p,.cycle p{margin:8px 0;overflow-wrap:anywhere}.requirement details{margin-top:12px}summary{min-height:40px;overflow-wrap:anywhere}.test-card summary{display:flex;gap:10px;align-items:baseline}.test-card summary span:last-child{flex:1}ul{padding-left:22px}li{margin:8px 0;overflow-wrap:anywhere}.warn{background:#fff3d6;color:#78500b}.gap{background:#fff3d6;color:#69460a;border-left:3px solid #b87b05;padding:10px 14px}.muted{color:var(--muted);font-size:13px}.phase-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.phase{border:1px solid var(--border);border-radius:8px;padding:12px;min-width:0}.log,.command,.test-source{margin:10px 0;padding:14px;background:#f3f6fa;border:1px solid var(--border);border-radius:8px;overflow:auto;max-height:430px;font:12px/1.75 ui-monospace,Consolas,monospace;white-space:pre}.command{white-space:pre-wrap;overflow-wrap:anywhere}table{text-align:left;font-size:13px}th,td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}th{background:#edf1f8}td code{overflow-wrap:anywhere;word-break:break-all}code{font-size:12px}.provenance{table-layout:fixed}.provenance td:first-child{width:46%;overflow-wrap:anywhere}.toolbar label{font-size:13px}.summary-table{margin:14px 0}.run-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.run{background:white;padding:18px;border:1px solid var(--border);border-radius:10px;min-width:0}.run p{overflow-wrap:anywhere}.footnote{font-size:13px;color:var(--muted)}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.phase-grid{grid-template-columns:1fr}}@media(max-width:600px){.metrics,.run-grid{grid-template-columns:1fr}.requirement,.cycle,.test-card,.source-file{padding:14px}.toolbar{align-items:stretch}.toolbar label{width:100%}.toolbar select{width:100%}.test-card summary{display:block}.phase-grid{display:block}.phase{margin-top:10px}h1{font-size:26px}nav{gap:8px}.provenance{min-width:600px}}@media print{details{display:block}.toolbar{display:none}.phase-grid{display:block}}
  `;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(report.title||'功能')} · 需求覆盖与 TDD 证据</title><style>${styles}${extra}</style></head><body><a class="skip" href="#main">跳到报告正文</a><main id="main"><header><p class="eyebrow">WORLD CUP 2026 / FEATURE VERIFICATION</p><h1>需求覆盖与 TDD 证据</h1><p class="subtitle">${esc(report.title||'功能')} · ${esc(report.feature||'离线快照')} · ${esc(report.generatedAt)}（UTC）</p><nav aria-label="报告目录"><a href="#requirements">需求与场景</a><a href="#test-cases">真实测试</a><a href="#tdd">TDD 任务链</a><a href="#sources">来源与口径</a><a href="coverage-added.html">新增行覆盖率报告 ↗</a></nav></header>
  <div class="metrics">${metric('requirements','功能要求映射通过',`${req.passed} / ${req.total}`,percent(req.passed,req.total)+' · 已映射且全部关联测试通过')}${metric('scenarios','验收场景映射通过',`${scenarios.passed} / ${scenarios.total}`,percent(scenarios.passed,scenarios.total)+' · 不以任务勾选替代执行')}${metric('cases','关联测试通过',`${mappedPassed} / ${mapped.size}`,percent(mappedPassed,mapped.size)+' · 只统计去重后的关联用例')}${metric('cycles','历史任务链有三阶段记录',`${complete} / ${report.cycles.length}`,'逐用例 TDD 完整率：不可判定')}</div>
  <aside class="explanation"><strong>测试结果通过，与 TDD 证据完整是两个指标。</strong><p>本页用真实结果检查需求映射，并展示历史任务级 Red / Green / Refactor。历史缺少逐用例测试指纹，因此不把任务链的完整比例当作逐用例 TDD 完整率。</p></aside>
  <section aria-labelledby="runs-heading"><h2 id="runs-heading">本次真实测试运行</h2><div class="run-grid">${report.runs.map(r=>`<article class="run"><h3>${r.suite==='unit'?'Vitest 单元 / DOM 测试':'Playwright Chromium 浏览器测试'}</h3><p>${badge(r.exitCode===0?'passed':'failed')} ${r.passed} / ${r.total} 通过（完整运行范围，含未映射的其他测试）</p><p class="muted">${esc(r.startedAt)} → ${esc(r.finishedAt)} UTC</p><p>输入运行前后：${r.unchanged?'摘要一致':'发生变化'}</p><p>${fileLink(r.resultFile,'原始 JSON 结果')} · ${fileLink((report.feature||'specs/feature')+'/evidence/requirements-report/'+r.suite+'-receipt.json','运行收据')}</p></article>`).join('')}</div></section>
  <section id="requirements"><div class="section-heading"><h2>需求、验收场景与边界</h2><p id="visible-count" role="status" aria-live="polite"></p></div><div class="table-scroll summary-table"><table><caption class="sr-only">按条目类型汇总</caption><thead><tr><th>类型</th><th>映射通过 / 总数</th><th>口径</th></tr></thead><tbody>${Object.entries(report.summary).map(([k,s])=>`<tr><td>${esc({FR:'功能要求',AS:'验收场景',E:'边界场景',SC:'成功标准'}[k])}</td><td>${s.passed} / ${s.total} · ${percent(s.passed,s.total)}</td><td>部分验证不计入通过</td></tr>`).join('')}</tbody></table></div><div class="toolbar"><label class="search-label" for="item-search">搜索需求、用例或内容<input id="item-search" type="search" placeholder="例如 FR-009、保存、language" autocomplete="off"></label><label for="item-kind">类型 <select id="item-kind"><option value="">全部类型</option><option value="FR">功能要求</option><option value="AS">验收场景</option><option value="E">边界场景</option><option value="SC">成功标准</option></select></label><label for="item-status">状态 <select id="item-status"><option value="">全部状态</option><option value="verified">映射测试通过</option><option value="partial">部分验证</option><option value="unverified">未验证</option></select></label></div>${items}<p id="empty" hidden>没有符合筛选条件的条目。</p></section>
  <section id="test-cases"><div class="section-heading"><h2>真实测试用例与反向追踪</h2><p>${mapped.size} 条关联用例；参数化用例独立计数，同一用例只计一次</p></div>${caseCards}</section>
  <section id="tdd"><h2>历史任务级 Red → Green → Refactor</h2><p class="footnote">按任务链的有效索引、实际退出码、断言失败日志与时间先后核对。下列日志内嵌于本页，断网也可展开；原始元数据和完整证据目录可另行审计。</p>${cycleCards}</section>
  <section id="sources"><h2>来源、限制与指标解释</h2><ul>${report.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul><p class="footnote">${esc(report.mappingReview||'')}</p><details><summary>参与映射的真实测试源码（${report.testSources?.length||0} 个文件）</summary>${(report.testSources||[]).map((f,i)=>`<details class="source-file" id="test-source-${i}"><summary>${esc(f.path)}</summary><pre class="test-source">${esc(f.content)}</pre></details>`).join('')}</details><details><summary>输入文件 SHA-256 审计清单（${report.sources.length} 项）</summary><div class="table-scroll"><table class="provenance"><thead><tr><th>来源</th><th>SHA-256</th></tr></thead><tbody>${report.sources.map(f=>`<tr><td>${fileLink(f.path)}</td><td><code>${esc(f.hash)}</code></td></tr>`).join('')}</tbody></table></div></details></section><footer><p>这是生成时的离线证据快照；页面不会自动运行测试。需求覆盖、源码行覆盖、测试通过率与 TDD 过程完整性应分别解读。</p></footer></main><noscript>搜索和筛选需要 JavaScript；全部条目、测试和日志仍可阅读。</noscript><script>(${initRequirementsReport.toString()})();</script></body></html>`;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const feature=process.argv[2]||'specs/001-follow-teams',report=buildRequirementsReport({feature});
    const output=feature+'/evidence/requirements-tdd.html',data=feature+'/evidence/requirements-tdd.json';
    fs.writeFileSync(data,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(output,renderRequirementsReport(report));
    console.log(JSON.stringify({output,items:report.items.length,summary:report.summary,mappedTests:new Set(report.items.flatMap(i=>i.testIds)).size,taskCycles:report.cycles.filter(c=>c.complete).length,perCaseTdd:'unknown'}));
  }catch(error){console.error(error.stack);process.exitCode=1;}
}
