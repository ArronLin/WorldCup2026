"""Result-format importers; no knowledge of languages or test frameworks."""
from __future__ import annotations
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from .contracts import *

def xml(path):
    raw=Path(path).read_bytes()
    declaration=raw.replace(b'\x00',b'').upper()  # UTF-16/32 declarations also contain ASCII code points.
    require(len(raw)<=64_000_000 and b'<!DOCTYPE' not in declaration and b'<!ENTITY' not in declaration,'XML 过大或含不安全实体')
    try: return ET.fromstring(raw)
    except ET.ParseError as exc: raise ReportError('XML 结构不支持：'+str(exc)) from exc

def relative_file(root,value):
    if not value: return None
    p=Path(value)
    if p.is_absolute():
        require(p.resolve().is_relative_to(Path(root).resolve()),'结果文件指向仓库外：'+value)
        value=p.resolve().relative_to(Path(root).resolve()).as_posix()
    value=value.replace('\\','/').removeprefix('./');inside(root,value);return value

def case(provider,level,container,locator,run,status,original,file=None,duration=0,attempts=1,failure='',kind='none',parameters=''):
    return {'test_id':test_id(provider,container,locator,parameters),'provider':provider,'level':level,'locator':locator,
        'container':container,'parameters':parameters,'file':file,'status':status,'original_status':original,
        'attempts':attempts,'duration_ms':duration,'run_id':run,'failure':failure,'failure_kind':kind,'evidence':''}

def tests(path,format,level,provider,version,run,root):
    if format=='unified':
        value=validate(read_json(path),'results')
        require(value['provider']=={'id':provider,'version':version} and value['run_id']==run,'统一测试结果提供方/运行 ID 不匹配')
        for t in value['tests']:
            require(t['provider']==provider and t['level']==level and t['run_id']==run and
                    t['test_id']==test_id(provider,t['container'],t['locator'],t['parameters']),'用例身份与声明不一致')
            if t['file']: relative_file(root,t['file'])
        return value
    tree=xml(path);result=[];errors=[]
    if format=='junit':
        require(tree.tag in {'testsuites','testsuite'},'不是受支持的 JUnit XML')
        suites=list(tree.iter('testsuite'))
        if tree.tag=='testsuites' and tree.findall('testcase'): suites.append(tree)
        for suite in suites:
            for child in list(suite):
                if child.tag in {'error','failure'}: errors.append(''.join(child.itertext()) or child.get('message','未记录全局错误'))
            for t in suite.findall('testcase'):
                container=t.get('classname','') or suite.get('name','')
                name=t.get('name');require(name,'JUnit 用例没有真实定位符')
                locator=container+'::'+name if container else name
                status='passed';failure='';kind='none'
                if t.find('error') is not None: status='error';node=t.find('error');kind='infrastructure'
                elif t.find('failure') is not None: status='failed';node=t.find('failure');kind='assertion' if 'assert' in node.get('type','').lower() else 'unknown'
                elif t.find('skipped') is not None: status='skipped';node=None
                else: node=None
                if node is not None: failure=(node.get('message','')+' '+''.join(node.itertext())).strip()
                if status=='failed' and re.search(r'AssertionError|ERR_ASSERTION|Assertion failed|Assert\.',failure): kind='assertion'
                retries=t.findall('flakyFailure')+t.findall('flakyError')+t.findall('rerunFailure')+t.findall('rerunError')
                if retries and status=='passed': status='flaky'
                result.append(case(provider,level,container,locator,run,status,status,relative_file(root,t.get('file')),
                    float(t.get('time','0'))*1000,len(retries)+1,failure,kind))
            # Some producers report errors without testcase nodes.
            if int(suite.get('errors','0')) and not any(t['status']=='error' for t in result) and not errors:
                errors.append('JUnit suite 声明全局错误，未提供详情')
    elif format=='trx':
        ns=tree.tag.removesuffix('TestRun');require(tree.tag.endswith('TestRun'),'不是受支持的 TRX XML')
        definitions={t.get('id'):t for t in tree.iter(ns+'UnitTest')}
        for t in tree.iter(ns+'UnitTestResult'):
            definition=definitions.get(t.get('testId'));method=definition.find(ns+'TestMethod') if definition is not None else None
            container=(method.get('className','') if method is not None else '') or t.get('testType','')
            locator=t.get('testId') or t.get('testName');require(locator,'TRX 缺少 testId/testName')
            outcome=t.get('outcome','Unknown')
            status={'Passed':'passed','Failed':'failed','NotExecuted':'not_run','Inconclusive':'not_run','Error':'error','Timeout':'error','Aborted':'error'}.get(outcome,'unknown')
            failure=' '.join(''.join(e.itertext()) for e in t.iter(ns+'ErrorInfo'))
            pieces=t.get('duration','0:0:0').split(':')
            duration=sum(float(p)*factor for p,factor in zip(reversed(pieces),[1000,60000,3600000]))
            kind='assertion' if status=='failed' and re.search('Assert|Assertion|Expected:',failure) else 'infrastructure' if status=='error' else 'none' if status=='passed' else 'unknown'
            result.append(case(provider,level,container,locator,run,status,outcome,None,duration,failure=failure,kind=kind))
        for e in tree.iter(ns+'RunInfo'):
            if e.get('outcome') in {'Error','Failed'}: errors.append(''.join(e.itertext()))
    else: raise ReportError('测试格式未适配：'+format)
    return validate({'schema_version':1,'provider':{'id':provider,'version':version},'run_id':run,'tests':result,'global_errors':errors},'results')

def coverage(path,format,provider,version,run,root,inventory,snapshot_fingerprint,mapping_path=None):
    if format=='unified':
        value=validate(read_json(path),'coverage')
        require(value['provider']=={'id':provider,'version':version},'覆盖率提供方/版本不匹配');return value
    records={}
    def add(file,line,hits):
        relative=relative_file(root,file);require(relative,'覆盖率缺少源文件路径')
        require(line>0 and hits>=0,'覆盖率行号或命中数无效')
        rows=records.setdefault(relative,{})
        rows[line]=max(rows.get(line,0),hits)
    if format=='lcov':
        current=None
        for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
            if line.startswith('SF:'): current=line[3:];records.setdefault(relative_file(root,current),{})
            elif line.startswith('DA:'):
                require(current,'LCOV 的 DA 出现在 SF 之前');values=line[3:].split(',');require(len(values)>=2,'LCOV DA 格式损坏')
                add(current,int(values[0]),int(values[1]))
            elif line=='end_of_record': current=None
    elif format=='cobertura':
        tree=xml(path);require(tree.tag=='coverage','不是 Cobertura XML')
        for cls in tree.iter('class'):
            file=cls.get('filename');require(file,'Cobertura class 缺少 filename')
            records.setdefault(relative_file(root,file),{})
            for line in cls.findall('./lines/line'): add(file,int(line.get('number','0')),int(line.get('hits','-1')))
    else: raise ReportError('覆盖率格式未适配：'+format)
    mapping=read_json(mapping_path) if mapping_path else {}
    result=[]
    for file,hits in sorted(records.items()):
        require(file in inventory,'覆盖率含生产范围外文件，请修正采集范围：'+file)
        item={'path':file,'source_hash':inventory[file],'executable_lines':sorted(hits),'hit_lines':sorted(n for n,h in hits.items() if h>0)}
        if file in mapping: item['source_mapping']=mapping[file]
        result.append(item)
    return validate({'schema_version':1,'provider':{'id':provider,'version':version},'scope':'unit','run_id':run,
        'source_fingerprint':snapshot_fingerprint,'files':result},'coverage')
