"""Standalone and Worker entry point: same executable reporting core."""
from __future__ import annotations
import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sys

from .contracts import *
from .workspace import Context
from .config import capabilities
from .pipeline import finalize,get_trace,invalidate
from .runs import execute

@contextmanager
def lock(ctx):
    ctx.store.mkdir(parents=True,exist_ok=True);p=ctx.store/'.operation.lock'
    try:
        stream=p.open('x',encoding='ascii')
    except FileExistsError:
        raise ReportError('此功能已有操作，或上次进程异常中断。确认 PID 不在运行后删除 evidence/reporting/.operation.lock 再重试',1)
    try:
        with stream:stream.write(str(os.getpid()));stream.flush()
        yield
    finally:p.unlink(missing_ok=True)

def main(argv=None,bindings=None):
    for stream in (sys.stdout,sys.stderr):
        if stream is not None and hasattr(stream,'reconfigure'):
            stream.reconfigure(encoding='utf-8',errors='replace')
    parser=argparse.ArgumentParser(description='通用功能报告；不安装或升级项目测试工具')
    parser.add_argument('action',choices=['doctor','baseline','check','run','finalize','spec-index'])
    parser.add_argument('--feature');parser.add_argument('--project',type=Path,default=Path.cwd())
    parser.add_argument('--config',type=Path)
    parser.add_argument('--self-check',action='store_true');parser.add_argument('--confirm-before-changes',action='store_true')
    parser.add_argument('--from-commit');parser.add_argument('--phase',choices=['red','green','refactor','final'])
    parser.add_argument('--suite');parser.add_argument('--cycle');parser.add_argument('--target',action='append',default=[])
    parser.add_argument('--requirements',default='');parser.add_argument('--no-refactor')
    args=parser.parse_args(argv);ctx=None
    try:
        require(args.feature or args.action=='doctor' and args.self_check,'必须显式提供 --feature specs/<feature>')
        config=args.config or Path(__file__).resolve().parents[3]/'config.json'
        ctx=Context(args.project,config,args.feature,bindings)
        if args.action=='spec-index':
            print(encoded(ctx.specification()).decode());return 0
        if args.action=='doctor':
            result=capabilities(ctx.config,ctx.config['policy'],ctx.root,ctx.bindings)
            result.update(passed=True,tool_version='1.0.0',contract_version=1)
            print(encoded(result).decode());return 0 if args.self_check or result['ready'] else 1
        with lock(ctx):
            if args.action=='baseline': result=ctx.baseline(args.confirm_before_changes,args.from_commit)
            elif args.action=='finalize':
                result=finalize(ctx);print(encoded(result).decode());return 0 if result['passed'] else 1
            else:
                ctx.frozen();mapping=get_trace(ctx)
                if args.action=='check':
                    result=capabilities(ctx.config,ctx.config['policy'],ctx.root,ctx.bindings)
                    report_path=ctx.store/'report-status.json'
                    if report_path.exists():
                        from .workspace import sources,test_sources
                        old=read_json(report_path)
                        result['reports_current']=bool(old.get('passed') and old.get('source_fingerprint')==fingerprint(sources(ctx.root,ctx.config)) and
                            old.get('specification_fingerprint')==ctx.spec_digest() and old.get('test_fingerprint')==fingerprint(test_sources(ctx.root,ctx.config)) and
                            old.get('config_fingerprint')==ctx.config['config_fingerprint'] and old.get('rules_fingerprint')==ctx.config['rules_fingerprint'])
                    else: result['reports_current']=None
                    result['mapping_valid']=True;print(encoded(result).decode());return 0 if result['ready'] else 1
                require(args.phase and args.suite,'run 必须指定 --phase 与 --suite')
                invalidate(ctx,'正在执行新测试，历史成功报告已失效')
                result=execute(ctx,mapping,args.phase,args.suite,args.cycle,args.target,
                               [i for i in args.requirements.split(',') if i],args.no_refactor)
                print(encoded(result).decode());return result['exit_code']
        print(encoded(result).decode());return 0
    except (ReportError,OSError,ValueError) as exc:
        if ctx is not None and args.feature and args.action in {'run','finalize'}:
            try:invalidate(ctx,str(exc))
            except (OSError,ReportError):pass
        elif args.feature and args.action in {'run','finalize'}:
            # Even invalid current config must invalidate existing success pages.
            # Never follow an arbitrary path from the broken configuration.
            try:
                import re
                from types import SimpleNamespace
                from .pipeline import status
                from . import render
                if re.fullmatch(r'(?:specs/[^/]+|openspec/changes/(?:archive/)?[^/]+)',args.feature):
                    evidence=inside(args.project,args.feature+'/evidence')
                    fallback=SimpleNamespace(root=args.project,feature=args.feature,evidence=evidence,store=evidence/'reporting',
                        config={'production_include':[],'production_exclude':[], 'policy':{'reports':{
                            'added_coverage_html':(evidence/'coverage-added.html').exists(),
                            'requirements_tdd_html':(evidence/'requirements-tdd.html').exists()}}})
                    if evidence.exists():
                        invalid=status(fallback,[str(exc)]);invalid['source_fingerprint']=None
                        render.write(fallback,invalid)
            except (OSError,ReportError):pass
        print(str(exc),file=sys.stderr);return getattr(exc,'code',2)

if __name__=='__main__':raise SystemExit(main())
