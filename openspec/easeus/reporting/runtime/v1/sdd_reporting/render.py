"""Self-contained offline HTML. All external evidence is escaped, never executed."""
from html import escape
from urllib.parse import quote
from .contracts import atomic

CSS='''
:root{color-scheme:light;--ink:#17243b;--muted:#52617a;--border:#dce3ee;--good:#14623a;--bad:#a92232}
*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:var(--ink);font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif;overflow-wrap:anywhere}
main{max-width:1180px;margin:auto;padding:32px 20px;min-width:0}h1{font-size:30px}h2{font-size:21px}h3{font-size:17px}p{margin:8px 0}a{color:#2454bd}button,input,select{font:inherit;min-height:44px}a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #2454bd;outline-offset:3px}
.status,.card,details{background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin:14px 0}.good{color:var(--good)}.bad{color:var(--bad)}.warn{color:#8a5200}.muted{color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric{background:white;border:1px solid var(--border);border-radius:10px;padding:18px}.metric strong{display:block;font-size:28px}.scroll{max-width:100%;overflow:auto}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border);vertical-align:top}th{background:#edf1f8}summary{cursor:pointer;min-height:32px;font-weight:600}pre,code{font:13px/1.7 Consolas,monospace}.code{white-space:pre;display:block;overflow:auto;max-height:560px;background:#fff}.line{display:block;min-width:max-content;padding:0 8px}.hit{background:#e7f5ec;color:#124b2b}.miss{background:#fff0f1;color:#8c1928}.number{display:inline-block;min-width:5ch;color:var(--muted);text-align:right;margin-right:2ch}.tag{display:inline-block;padding:2px 8px;background:#edf1f8;border-radius:5px}input[type=search]{width:100%;border:1px solid #b8c5d9;border-radius:6px;padding:8px 12px}label.check{display:flex;align-items:center;gap:8px;min-height:44px}label.check input{width:20px}footer{border-top:1px solid var(--border);margin-top:28px;padding-top:12px;color:var(--muted);font-size:13px}[hidden]{display:none!important}
@media(max-width:700px){main{padding:18px 12px}.metrics{grid-template-columns:1fr}h1{font-size:25px}.metric strong{font-size:25px}th,td{padding:8px}details{padding:10px}}
'''
JS='''
const search=document.querySelector('#search'),all=document.querySelector('#all');
function filter(){for(const row of document.querySelectorAll('[data-search]')){row.hidden=(!all.checked&&row.dataset.added==='0')||!row.dataset.search.toLowerCase().includes(search.value.toLowerCase());}}
search?.addEventListener('input',filter);all?.addEventListener('change',filter);if(search)filter();
'''
LABELS={'passed':'通过','failed':'失败','error':'错误','skipped':'跳过','todo':'待实现','not_run':'未执行','flaky':'重试通过 · 不稳定',
        'expected_failure':'预期失败','unknown':'未知','manual':'手工验收','not_applicable':'不适用','unmapped':'未映射',
        'unexecuted':'未发现/未执行','ambiguous':'定位有歧义','complete':'完整','missing_evidence':'缺少过程证据','missing_test_source':'缺少测试源码','not_passing':'最终未通过'}
def e(value):return escape(str(value if value is not None else '未记录'))
def label(value):return LABELS.get(value,value)
def ratio(count,total):return f'{count}/{total}（{count/total:.1%}）' if total else '不适用（分母为 0）'
def metric(title,value):return '<div class="metric">'+e(title)+'<strong>'+e(value)+'</strong></div>'
def table(headers,rows):return '<div class="scroll"><table><thead><tr>'+''.join('<th scope="col">'+e(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+x+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def shell(title,status,body):
    return ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:">'
        '<title>'+e(title)+'</title><style>'+CSS+'</style></head><body><main><h1>'+e(title)+'</h1><div class="status"><strong class="'+('good' if status['passed'] else 'bad')+'">'+('报告验收通过' if status['passed'] else '未完成 · 请处理诊断')+'</strong>'
        '<p>'+e(status['feature'])+' · '+e(status['generated_at'])+'</p><p class="muted">生成 ID：'+e(status['generation_id'])+'<br>源码指纹：'+e(status.get('source_fingerprint','未取得'))+'</p></div>'+
        ('<section class="card"><h2>需要处理</h2><ul>'+''.join('<li>'+e(x)+'</li>' for x in status['issues'])+'</ul></section>' if status['issues'] else '')+body+
        '<footer>本报告使用本机真实运行收据和哈希关联，不构成第三方防篡改证明。单个 HTML 可离线阅读；完整日志需保留 reporting/runs 目录。历史 Red 缺失不能事后补造。</footer></main><script>'+JS+'</script></body></html>')

def coverage_html(status,value):
    title='新增生产代码单测行覆盖率'
    if value is None:return shell(title,status,'<p>证据不足，无法计算完整覆盖率。缺失值不按 0 或 100% 处理。</p>')
    threshold='未设置门槛' if value['threshold'] is None else f"{value['threshold']:.2%}"
    body='<div class="metrics">'+metric('新增行单测覆盖率','不适用' if value['D']==0 else f"{value['C']/value['D']:.2%}")+metric('已覆盖 / 新增可执行行',str(value['C'])+' / '+str(value['D']))+metric('本功能门槛',threshold)+'</div>'
    body+='<p class="muted">'+e(value['definition'])+' · 提供方 '+e(value['provider'])+' · 运行 '+e(value['run_id'])+'</p>'
    body+='<label for="search">搜索文件</label><input id="search" type="search" placeholder="输入仓库相对路径"><label class="check"><input id="all" type="checkbox">显示全部文件（包括无新增可执行行的文件）</label>'
    for index,file in enumerate(value['files']):
        added=set(file['added_lines']);covered=set(file['covered_lines'])
        lines=''.join('<span class="line '+('hit' if n in covered else 'miss' if n in added else '')+'" id="f'+str(index)+'-l'+str(n)+'"><span class="number">'+str(n)+'</span>'+('✓ ' if n in covered else '✕ ' if n in added else '  ')+e(line)+'</span>' for n,line in enumerate(file['source'].splitlines(),1))
        body+='<details data-search="'+e(file['path'])+'" data-added="'+str(file['D'])+'"><summary>'+e(file['path'])+' · '+str(file['C'])+'/'+str(file['D'])+(' · 不适用' if file['D']==0 else '')+'</summary><p>✓ 新增已覆盖　✕ 新增未覆盖；未标记行为上下文。</p>'+('<p>纯重命名来自 '+e(file['renamed_from'])+'</p>' if file['renamed_from'] else '')+'<div class="code" tabindex="0" aria-label="源码及覆盖状态">'+lines+'</div></details>'
    return shell(title,status,body)

def requirements_html(status,value):
    title='需求与验收场景覆盖 · TDD 过程证据'
    if value is None:return shell(title,status,'<p>缺少当前最终有效测试与追踪关系，不能宣称需求或 TDD 已通过。</p>')
    rm=value['requirement_metric'];sm=value['scenario_metric'];td=value['tdd'];tests=value['tests']
    body='<div class="metrics">'+metric('需求自动验证',ratio(rm['passed'],rm['automated']))+metric('场景自动验证',ratio(sm['passed'],sm['automated']))+metric('测试严格通过率',ratio(sum(t['status']=='passed' for t in tests),len(tests)))+'</div>'
    body+='<section class="card"><h2>TDD 完整程度</h2><p>'+('规则未启用，不评定' if td['status']=='not_enabled' else ratio(td['complete'],td['applicable']))+'</p><p>手工与不适用项独立列出，不进入自动验证分母；重试通过不计入严格通过。未映射项保留在自动分母中。</p></section>'
    if value.get('tdd_excluded'):
        body+='<section class="card"><h3>TDD 不适用项</h3><ul>'+''.join('<li>'+e(t['test_id'])+'：'+e(t['reason'])+'</li>' for t in value['tdd_excluded'])+'</ul></section>'
    if value.get('runs'):
        body+='<h2>过程与最终运行</h2>'+table(['阶段 / 套件','时间（UTC）','退出码与结果','原始日志'],[
            (e(r['phase']+' / '+r['suite']),e(r['started_at'])+'<br>'+e(r['finished_at']),e(str(r['exit_code'])+' · '+r['classification']),
             '<a href="reporting/runs/'+quote(r['id'])+'/output.log">'+e(r['id'])+'</a>') for r in value['runs']])
    for heading,key in [('需求','requirements'),('验收场景','scenarios')]:
        body+='<h2>'+heading+'</h2>'
        for row in value[key]:
            body+='<details><summary>'+e(row['id']+' · '+row['description']+' · '+label(row['status']))+'</summary><p>规格位置：'+e(row['spec_position'])+'</p>'
            if row['applicability']!='automated':body+='<p>'+e(row.get('reason'))+' · 确认依据：'+e(row.get('confirmed_by'))+'</p>'
            body+=table(['测试定位符','层级','结果'],[(e(m['locator']['provider']+' / '+m['locator']['container']+' / '+m['locator']['locator']),e(m['locator']['level']),e(label(m['status']))) for m in row['matches']])+'</details>'
    body+='<h2>真实测试与反向追踪</h2>'
    for test in tests:
        ids=[r['id'] for key in ('requirements','scenarios') for r in value[key] if any(m['test'] and m['test']['test_id']==test['test_id'] for m in r['matches'])]
        t=next((t for t in td['items'] if t['test_id']==test['test_id']),{})
        log='reporting/runs/'+quote(test['run_id'])+'/output.log'
        body+='<details><summary>'+e(test['locator']+' · '+label(test['status']))+'</summary><p>提供方：'+e(test['provider'])+' · 容器：'+e(test['container'])+' · 参数：'+e(test['parameters'])+'</p><p>源码位置：'+e(test['file'])+' · 关联 '+e(', '.join(ids) or '未映射')+'</p><p>尝试次数 '+str(test['attempts'])+' · '+str(test['duration_ms'])+' ms · 原始状态 '+e(test['original_status'])+'</p><p>TDD：'+e(label(t.get('status','未适用/未启用')))+'</p>'
        for phase in ('red','green','refactor'):
            if phase in t:body+='<p>'+e(phase)+'：<a href="reporting/runs/'+quote(t[phase])+'/output.log">'+e(t[phase])+'</a></p>'
        if t.get('reason'):body+='<p>无需重构，已回归：'+e(t['reason'])+'</p>'
        if test['failure']:body+='<pre class="scroll">'+e(test['failure'])+'</pre>'
        body+='<p><a href="'+log+'">原始运行日志</a></p></details>'
    return shell(title,status,body)

def write(ctx,status,cov=None,req=None):
    if ctx.config['policy']['reports']['added_coverage_html']:
        atomic(ctx.evidence/'coverage-added.html',coverage_html(status,cov))
    if ctx.config['policy']['reports']['requirements_tdd_html']:
        atomic(ctx.evidence/'requirements-tdd.html',requirements_html(status,req))
    atomic(ctx.store/'report-status.json',status)
