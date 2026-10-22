"""Completion gates consume only frozen contracts and independently checked runs."""
import uuid
from .contracts import *
from .workspace import sources,test_sources
from .runs import read_runs
from . import coverage,trace,render

def status(ctx,issues,passed=False):
    try: source=fingerprint(sources(ctx.root,ctx.config))
    except (OSError,ReportError): source=None
    try: spec=ctx.spec_digest()
    except (OSError,ReportError,AttributeError):spec=None
    try: tests=fingerprint(test_sources(ctx.root,ctx.config))
    except (OSError,ReportError,KeyError):tests=None
    return {'schema_version':1,'feature':ctx.feature,'generation_id':uuid.uuid4().hex,'generated_at':now(),
            'source_fingerprint':source,'config_fingerprint':ctx.config.get('config_fingerprint'),
            'specification_fingerprint':spec,'test_fingerprint':tests,
            'rules_fingerprint':ctx.config.get('rules_fingerprint'),'passed':passed,'issues':issues}

def invalidate(ctx,message):
    value=status(ctx,[message]);render.write(ctx,value);return value

def get_trace(ctx):
    if not ctx.config['policy']['reports']['requirements_tdd_html']:
        return {'schema_version':1,'requirements':[],'scenarios':[]}
    value=read_json(ctx.store/'traceability.json')
    if ctx.framework=='openspec':
        from .specification import validate_native_trace
        return validate_native_trace(value,ctx.specification(),ctx.root)
    return trace.validate_trace(value,(ctx.feature_root/'spec.md').read_text(encoding='utf-8-sig'),ctx.root)

def finalize(ctx):
    invalidate(ctx,'正在计算本次结果；历史成功结果已失效')
    issues=[];cov=None;req=None;runs=[]
    def attempt(fn):
        try:return fn()
        except (ReportError,OSError,ValueError) as exc:issues.append(str(exc));return None
    frozen=attempt(ctx.frozen);mapping=attempt(lambda:get_trace(ctx));runs=attempt(lambda:read_runs(ctx)) or []
    current=sources(ctx.root,ctx.config);current_tests=test_sources(ctx.root,ctx.config)
    current_text={p:normalized(inside(ctx.root,p).read_bytes()) for p in current}
    finals=[]
    for suite in ctx.config['suites']:
        candidates=[r for r in runs if r['phase']=='final' and r['suite']==suite['id']]
        if not candidates:issues.append('缺少最终运行：'+suite['id']);continue
        last=candidates[-1];directory=ctx.store/'runs'/last['id']
        valid=(last['stable'] and last['source_after']==current and last['tests_after']==current_tests and
               last['config_fingerprint']==ctx.config['config_fingerprint'] and last['rules_fingerprint']==ctx.config['rules_fingerprint'] and
               last['files'].get(ctx.spec_record)==ctx.spec_digest() and
               mapping is not None and last['files'].get('traceability.json')==sha(encoded(mapping)))
        if not valid:issues.append('最终运行已过期或与当前配置/规格不一致：'+suite['id']);continue
        finals.append(last)
        if last['classification']!='passed':issues.append('最终测试或采集未通过：'+suite['id']+' · '+last['classification'])
    if not ctx.config['suites']:issues.append('缺少采集能力：尚未配置测试套件，需在 plan/tasks 建设')
    if ctx.config['policy']['reports']['added_coverage_html'] and frozen:
        def added():
            unit=[r for r in finals if r['level']=='unit'];require(unit,'没有当前有效单测运行',1)
            combined=None;records={}
            for run in unit:
                value=validate(read_json(ctx.store/'runs'/run['id']/'coverage.json'),'coverage')
                checked=coverage.validate_coverage(value,current,current_text,run['id'],fingerprint(current))
                if combined is None:combined={**value,'files':[]}
                for name,item in checked.items():
                    if name in records:
                        prior=records[name]
                        require(prior['executable_lines']==item['executable_lines'] and prior.get('source_mapping')==item.get('source_mapping'),
                                '多个单测套件的可执行行口径不同：'+name)
                        prior['hit_lines']=sorted(set(prior['hit_lines'])|set(item['hit_lines']))
                    else:records[name]=dict(item)
            combined['files']=list(records.values());baseline=frozen[1]
            old={p:normalized(inside(ctx.store/'baseline-sources',p).read_bytes()) for p in baseline['files']}
            return coverage.audit(combined,current,current_text,old,combined['run_id'],ctx.config['policy'].get('new_unit_line_coverage_minimum'))
        cov=attempt(added)
        if cov and not cov['passed']:issues.append('新增生产代码单测行覆盖率低于当前门槛')
    if ctx.config['policy']['reports']['requirements_tdd_html'] and mapping is not None and frozen:
        tests=[dict(t) for r in finals for t in r['results']];req=trace.evaluate(mapping,tests)
        applicable={};required={};mapped_files={};excluded=[]
        for group in ('requirements','scenarios'):
            for row in req[group]:
                for match in row['matches']:
                    t=match['test'];locator=match['locator']
                    if t is None:continue
                    if locator['tdd_applicable']:
                        applicable[t['test_id']]=dict(t);required.setdefault(t['test_id'],[]).append(row['id'])
                        file=t['file'] or locator['file']
                        applicable[t['test_id']]['file']=file
                        applicable[t['test_id']]['file_hash']=current_tests.get(file)
                    else:excluded.append({'test_id':t['test_id'],'reason':locator['tdd_reason']})
        td=trace.tdd(list(applicable.values()),runs,ctx.config['policy'].get('tdd_required',False),required)
        req.update(schema_version=1,tests=tests,tdd=td,tdd_excluded=excluded)
        req['runs']=[{k:r[k] for k in ('id','phase','suite','started_at','finished_at','exit_code','classification')} for r in runs]
        if not req['passed']:issues.append('存在未严格通过自动验证的需求或验收场景')
        if td['status']!='not_enabled' and td['complete']!=td['applicable']:issues.append('TDD 过程证据不完整；历史 Red 不可事后补造')
    if sources(ctx.root,ctx.config)!=current or test_sources(ctx.root,ctx.config)!=current_tests:
        issues.append('报告计算期间源码或测试发生变化，请重新采集')
    result=status(ctx,issues,not issues)
    # Diagnostic JSON also replaces a previous successful metric on failure.
    atomic(ctx.store/'coverage-added.json',{'schema_version':1,'generation_id':result['generation_id'],'data':cov})
    atomic(ctx.store/'requirements-tdd.json',{'schema_version':1,'generation_id':result['generation_id'],'data':req})
    render.write(ctx,result,cov,req);return result
