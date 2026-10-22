"""Real process capture with immutable receipts and independently checked inputs."""
from __future__ import annotations
import os
from pathlib import Path
import subprocess
import uuid

from .contracts import *
from .config import resolve_program
from .workspace import sources,test_sources
from . import importers,trace

def read_runs(ctx):
    directory=ctx.store/'runs';runs=[]
    if not directory.exists(): return runs
    for p in directory.iterdir():
        require(p.is_dir() and (p/'receipt.json').is_file(),'发现中断或未知运行目录：'+p.name,1)
        require(not p.is_symlink(),'运行证据目录不能为符号链接')
        value=validate(read_json(p/'receipt.json'),'run-receipt');require(value['id']==p.name,'运行 ID 不匹配')
        runs.append(value)
    runs.sort(key=lambda r:(r['started_at'],r['id']));previous=None
    for record in runs:
        require(record['previous_receipt_hash']==previous,'运行链缺失或被修改',1)
        directory=ctx.store/'runs'/record['id']
        for relative,expected in record['files'].items():
            p=inside(directory,relative)
            require(p.is_file() and sha(p.read_bytes())==expected,'原始运行证据缺失或改变：'+record['id']+'/'+relative,1)
        normalized_result=read_json(directory/'results.json')
        require(normalized_result['tests']==record['results'] and normalized_result['global_errors']==record['global_errors'],'收据与结果不一致',1)
        previous=sha((directory/'receipt.json').read_bytes())
    return runs

def process(command,args,cwd,environment,log,timeout=600):
    with log.open('xb') as stream:
        try:
            proc=subprocess.Popen([command,*args],cwd=cwd,env=environment,stdout=stream,stderr=subprocess.STDOUT,
                                  **({'creationflags':0x08000000} if os.name=='nt' else {'start_new_session':True}))
            try: return proc.wait(timeout=timeout),None
            except subprocess.TimeoutExpired:
                if os.name=='nt': subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],capture_output=True,timeout=10)
                else:
                    import signal
                    os.killpg(proc.pid,signal.SIGTERM)
                proc.wait(timeout=10);return 1,'进程超时，已停止本次进程'
        except OSError as exc: return 1,'进程启动失败：'+str(exc)

def execute(ctx,value,phase,suite_id,cycle=None,targets=None,requirements=None,no_refactor=None):
    ctx.frozen();config=ctx.config;targets=targets or [];requirements=requirements or []
    coverage_enabled=config['policy']['reports']['added_coverage_html']
    suite=next((s for s in config['suites'] if s['id']==suite_id),None);require(suite,'未配置的测试套件：'+suite_id)
    require(phase in {'red','green','refactor','final'},'不支持的测试阶段')
    require(phase=='final' or (cycle and targets and requirements),'TDD 阶段必须指定 --cycle、--target 测试 ID 和 --requirements')
    require(phase!='final' or not targets and not cycle,'final 不允许局部测试筛选')
    known={row['id'] for group in ('requirements','scenarios') for row in value[group]}
    require(set(requirements)<=known,'cycle 关联了未知需求/场景')
    prior=read_runs(ctx);ident=uuid.uuid4().hex;directory=ctx.store/'runs'/ident;directory.mkdir(parents=True)
    before=sources(ctx.root,config);tests_before=test_sources(ctx.root,config);started=now()
    context={'schema_version':1,'run_id':ident,'phase':phase,'suite':suite_id,'level':suite['level'],'cycle':cycle,
             'targets':targets,'requirements':requirements,'source_inventory':before,'source_fingerprint':fingerprint(before),
             'root':str(ctx.root),'evidence_directory':str(directory)}
    atomic(directory/'context.json',context,immutable=True)
    atomic(directory/'traceability.json',value,immutable=True)
    from .specification import snapshot
    snapshot(ctx,directory)
    environment={**os.environ,'REPO_SDD_CONTEXT':str(directory/'context.json'),'REPO_SDD_RUN_ID':ident}
    diagnostics=[];parsed={'schema_version':1,'provider':suite['results']['provider'],'run_id':ident,'tests':[],'global_errors':[]}
    coverage_value=None;exit_code=1;command=None;actual_args=[]
    # Remove previous output bytes before executing. Never remove production/test
    # sources or spec evidence; this prevents stale files proving a new run.
    paths=[suite['results']['path']]
    if suite['coverage'] and coverage_enabled: paths.append(suite['coverage']['path'])
    if suite['collect']: paths.append(suite['collect']['output'])
    try:
        for relative in paths:
            require(relative not in before and relative not in tests_before and not relative.startswith(('.specify/','specs/','openspec/')),
                    '采集输出不能覆盖源码、配置或历史证据：'+relative)
            p=inside(ctx.root,relative);p.parent.mkdir(parents=True,exist_ok=True)
            if p.exists(): require(p.is_file(),'采集输出必须是文件');p.unlink()
        command=resolve_program(suite['command'],ctx.root,ctx.bindings)
        tokens={'{context}':str(directory/'context.json'),'{run_id}':ident,'{root}':str(ctx.root)}
        def arguments(args):
            out=[]
            for a in args:
                if a=='{targets}': out+=targets
                else:
                    for key,v in tokens.items(): a=a.replace(key,v)
                    out.append(a)
            return out
        actual_args=arguments(suite['args'])
        exit_code,error=process(command,actual_args,inside(ctx.root,suite['cwd'],allow_dot=True),environment,directory/'output.log')
        if error: diagnostics.append(error)
        collected=None
        if suite['collect']:
            collector=suite['collect'];output=inside(ctx.root,collector['output']);tokens['{output}']=str(output)
            code,error=process(resolve_program(collector['command'],ctx.root,ctx.bindings),arguments(collector['args']),
                inside(ctx.root,collector['cwd'],allow_dot=True),environment,directory/'collect.log')
            require(code==0 and not error,'自定义 collect 命令失败：'+str(error or code),1)
            raw=output.read_bytes();atomic(directory/'raw-collect.json',raw,immutable=True)
            collected=read_json(output)
            require(set(collected)=={'schema_version','results','coverage','diagnostics'} and collected['schema_version']==1 and
                    isinstance(collected['diagnostics'],list) and all(isinstance(i,str) for i in collected['diagnostics']),
                    'collect 输出需为 v1 results/coverage/diagnostics 契约')
            diagnostics+=collected['diagnostics'];parsed=validate(collected['results'],'results')
            require(parsed['run_id']==ident,'collect 返回的运行 ID 不匹配')
            coverage_value=collected['coverage'] if coverage_enabled else None
            if coverage_value is not None: validate(coverage_value,'coverage')
        else:
            raw=inside(ctx.root,suite['results']['path']).read_bytes()
            atomic(directory/'raw-results',raw,immutable=True)
            result=suite['results'];provider=result['provider']
            parsed=importers.tests(inside(ctx.root,result['path']),result['format'],suite['level'],provider['id'],provider['version'],ident,ctx.root)
        for t in parsed['tests']:
            require(t['provider']==suite['results']['provider']['id'] and t['level']==suite['level'] and t['run_id']==ident and
                    t['test_id']==test_id(t['provider'],t['container'],t['locator'],t['parameters']),'用例身份、层级或运行 ID 与配置不匹配')
            if t['file']: inside(ctx.root,t['file'])
            t['evidence']='runs/'+ident+'/results.json'
        if coverage_enabled and suite['coverage'] and suite['level']=='unit' and coverage_value is None:
            c=suite['coverage'];p=inside(ctx.root,c['path']);atomic(directory/'raw-coverage',p.read_bytes(),immutable=True)
            mapping=inside(ctx.root,c['mapping_path']) if c.get('mapping_path') else None
            if mapping: atomic(directory/'source-mapping.json',mapping.read_bytes(),immutable=True)
            coverage_value=importers.coverage(p,c['format'],c['provider']['id'],c['provider']['version'],ident,ctx.root,before,fingerprint(before),mapping)
        if coverage_value is not None:
            require(suite['level']=='unit','非单元测试不得提供单测覆盖率')
            atomic(directory/'coverage.json',coverage_value,immutable=True)
    except (ReportError,OSError,ValueError) as exc:
        diagnostics.append(str(exc))
    after=sources(ctx.root,config);tests_after=test_sources(ctx.root,config);stable=before==after and tests_before==tests_after
    selected=[t for t in parsed['tests'] if not targets or t['test_id'] in targets]
    missing=set(targets)-{t['test_id'] for t in selected}
    if missing: diagnostics.append('未发现目标测试：'+', '.join(sorted(missing)))
    duplicates=len({t['test_id'] for t in parsed['tests']})!=len(parsed['tests'])
    classification=('source_changed' if not stable else 'collection_error' if diagnostics or duplicates else
        trace.classify_red(parsed,selected,exit_code) if phase=='red' else
        'passed' if exit_code==0 and selected and all(t['status']=='passed' for t in selected) and not parsed['global_errors'] else 'failed')
    atomic(directory/'results.json',parsed,immutable=True)
    record={'schema_version':1,'id':ident,'phase':phase,'suite':suite_id,'level':suite['level'],'cycle':cycle,'targets':targets,
        'requirements':requirements,'started_at':started,'finished_at':now(),'command':[command or suite['command'],*(actual_args or suite['args'])],
        'exit_code':exit_code,'source_before':before,'source_after':after,'tests_before':tests_before,'tests_after':tests_after,
        'stable':stable,'files':{p.relative_to(directory).as_posix():sha(p.read_bytes()) for p in sorted(directory.rglob('*')) if p.is_file()},
        'results':parsed['tests'],'global_errors':parsed['global_errors'],'classification':classification,'diagnostics':diagnostics,
        'config_fingerprint':config['config_fingerprint'],'rules_fingerprint':config['rules_fingerprint'],
        'previous_receipt_hash':sha((ctx.store/'runs'/prior[-1]['id']/'receipt.json').read_bytes()) if prior else None,'refactor_reason':no_refactor}
    validate(record,'run-receipt');atomic(directory/'receipt.json',record,immutable=True);return record
