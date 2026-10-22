"""Portable commands and explicit collection capabilities, independent of stack."""
from __future__ import annotations
from pathlib import Path
import re
import shutil
from .contracts import validate, require, inside, fingerprint, ReportError

def blank():
    return {'schema_version':1,'contract_version':1,'tool_version':'1.0.0','adapter':{'id':'standard-formats','version':'1'},
        'confirmed':False,'production_include':[],'production_exclude':[],'test_include':[],'test_exclude':[],
        'suites':[],'capability_notes':[]}

def validate_config(value,root,confirmed=True):
    shared={k:v for k,v in value.items() if k not in {'policy','rules_fingerprint','config_fingerprint'}}
    validate(shared,'config')
    require(value['adapter']['id'] in {'standard-formats','custom'} and value['adapter']['version']=='1','尚未支持此采集接口版本')
    if confirmed: require(value['confirmed'],'请核对并保存报告设置；未知能力可保存为待建设状态')
    for key in ('production_include','production_exclude','test_include','test_exclude'):
        for pattern in value[key]:
            require(pattern and not pattern.startswith('/') and not any(x in pattern for x in ('\\',':','\x00')) and
                    '..' not in pattern.split('/'),'范围须为仓库内相对 glob：'+key)
    ids=[];outputs=[]
    for suite in value['suites']:
        ids.append(suite['id'])
        for command in [suite,suite['collect']] if suite['collect'] else [suite]:
            require(not Path(command['command']).is_absolute() and not re.search(r'[\s;&|<>`$\\:]',command['command']),
                    '共享配置只保存命令名或相对程序路径；参数逐项填写，本机程序路径另存')
            if '/' in command['command']: inside(root,command['command'])
            inside(root,command['cwd'],allow_dot=True)
            require(not any(re.search(r'(?i)(?:--?(?:token|password|secret|api[-_]?key)(?:=|$)|(?:token|password|secret|api[-_]?key)=|Bearer\s)',a) for a in command['args']),
                    '不能在报告配置保存认证参数，请使用现有环境变量')
        inputs=[suite['results']['path']]
        if suite['coverage']: inputs.append(suite['coverage']['path'])
        if suite['collect']: inputs.append(suite['collect']['output'])
        if suite['coverage'] and suite['coverage'].get('mapping_path'): inside(root,suite['coverage']['mapping_path'])
        for relative in inputs:
            inside(root,relative)
            require(relative not in outputs,'测试与采集结果路径不能重复：'+relative);outputs.append(relative)
    require(len(ids)==len(set(ids)),'测试套件 ID 重复');return value

def config_fingerprint(config):
    return fingerprint({k:v for k,v in config.items() if k not in {'confirmed','config_fingerprint','policy','rules_fingerprint'}})

def resolve_program(command,root,bindings=None):
    actual=(bindings or {}).get(command,command)
    if '/' in actual and not Path(actual).is_absolute(): actual=str(inside(root,actual))
    resolved=shutil.which(actual) or (actual if Path(actual).is_file() else None)
    require(resolved,'未找到程序 '+command+'；配置本机绑定或安排安装/适配任务',1)
    require(Path(resolved).suffix.lower() not in {'.bat','.cmd','.ps1'},'脚本请通过解释器和参数数组调用，不经隐式 shell',1)
    return str(Path(resolved).resolve())

def capabilities(config,policy,root,bindings=None):
    gaps=[]
    if not config['production_include']: gaps.append('尚未配置完整自有生产代码范围')
    if not config['suites']: gaps.append('尚未配置真实测试套件与结果采集')
    if policy['reports']['added_coverage_html'] and not any(s['level']=='unit' and s['coverage'] for s in config['suites']): gaps.append('缺少单元测试可执行行/覆盖率采集能力')
    if policy.get('tdd_required') and policy['reports']['requirements_tdd_html'] and not config['test_include']: gaps.append('缺少测试源码清单，TDD 无法核实断言是否变化')
    for suite in config['suites']:
        for c in [suite,suite['collect']] if suite['collect'] else [suite]:
            try: resolve_program(c['command'],root,bindings)
            except ReportError as exc: gaps.append(str(exc))
    return {'ready':not gaps,'gaps':gaps,'business_tests_run':False,'formats':{'coverage':['unified','lcov','cobertura'],'results':['unified','junit','trx']}}
