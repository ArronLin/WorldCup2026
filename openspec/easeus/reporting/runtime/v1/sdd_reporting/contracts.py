"""Strict versioned input validation and safe repository file operations."""
from __future__ import annotations
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

class ReportError(Exception):
    def __init__(self,message,code=2):
        super().__init__(message); self.code=code

def require(condition,message,code=2):
    if not condition: raise ReportError(message,code)

def now(): return datetime.now(timezone.utc).isoformat()
def encoded(value): return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf-8')
def sha(value): return hashlib.sha256(value if isinstance(value,bytes) else value.encode('utf-8')).hexdigest()
def fingerprint(value): return sha(encoded(value))
def normalized(raw): return raw.decode('utf-8-sig').replace('\r\n','\n').replace('\r','\n')

def native(path):
    value=os.path.abspath(os.fspath(path))
    if os.name=='nt' and not value.startswith('\\\\?\\'):
        return '\\\\?\\UNC\\'+value[2:] if value.startswith('\\\\') else '\\\\?\\'+value
    return value

def inside(root,relative,allow_dot=False):
    require(isinstance(relative,str) and relative and '\\' not in relative and ':' not in relative,
            '路径须为仓库内 POSIX 相对路径：'+str(relative))
    parts=relative.split('/')
    require(not relative.startswith('/') and '..' not in parts and '' not in parts and
            ('.' not in parts or allow_dot and relative=='.'),'路径越界或格式无效：'+relative)
    root=Path(root).resolve(); target=root.joinpath(relative)
    require(target.resolve().is_relative_to(root),'符号链接指向仓库外：'+relative)
    return target

def read_json(path):
    try: return json.loads(Path(native(path)).read_text(encoding='utf-8-sig'))
    except (OSError,ValueError) as exc: raise ReportError('JSON 缺失或损坏：'+str(path)+' · '+str(exc)) from exc

def atomic(path,value,immutable=False):
    path=Path(path);os.makedirs(native(path.parent),exist_ok=True)
    raw=value if isinstance(value,bytes) else value.encode('utf-8') if isinstance(value,str) else encoded(value)
    if immutable:
        with open(native(path),'xb') as stream: stream.write(raw);stream.flush();os.fsync(stream.fileno())
        return
    directory=str(path.parent.resolve())
    if os.name=='nt' and not directory.startswith('\\\\?\\'):
        directory='\\\\?\\UNC\\'+directory[2:] if directory.startswith('\\\\') else '\\\\?\\'+directory
    fd,tmp=tempfile.mkstemp(prefix='.report-',dir=directory)
    try:
        with os.fdopen(fd,'wb') as stream: stream.write(raw);stream.flush();os.fsync(stream.fileno())
        os.replace(tmp,os.path.join(directory,path.name))
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def _validate(value,schema,location='$'):
    if 'anyOf' in schema:
        for candidate in schema['anyOf']:
            try: _validate(value,candidate,location);return
            except ReportError: pass
        raise ReportError('字段类型/结构错误：'+location)
    if 'const' in schema: require(type(value) is type(schema['const']) and value==schema['const'],'字段常量错误：'+location)
    if 'enum' in schema: require(value in schema['enum'],'不支持的字段值：'+location)
    if 'type' in schema:
        types=schema['type'] if isinstance(schema['type'],list) else [schema['type']]
        matches={'object':isinstance(value,dict),'array':isinstance(value,list),'string':isinstance(value,str),
                 'integer':type(value) is int,'number':type(value) in (int,float),'boolean':type(value) is bool,'null':value is None}
        require(any(matches.get(t,False) for t in types),'字段类型错误：'+location)
    if isinstance(value,str):
        require(len(value)>=schema.get('minLength',0),'字段不能为空：'+location)
        if 'pattern' in schema: require(re.search(schema['pattern'],value),'字段格式错误：'+location)
    if type(value) in (int,float):
        import math
        require(math.isfinite(value) and value>=schema.get('minimum',float('-inf')),'数值越界：'+location)
    if isinstance(value,list):
        require(len(value)>=schema.get('minItems',0),'列表不能为空：'+location)
        for i,item in enumerate(value): _validate(item,schema.get('items',{}),f'{location}.{i}')
    if isinstance(value,dict):
        for key in schema.get('required',[]): require(key in value,'缺少字段：'+location+'.'+key)
        for key,item in value.items():
            child=schema.get('properties',{}).get(key);extra=schema.get('additionalProperties',True)
            require(child is not None or extra is not False,'未知字段：'+location+'.'+key)
            _validate(item,child if child is not None else extra if isinstance(extra,dict) else {},location+'.'+key)

def validate(value,name):
    schema=read_json(Path(__file__).resolve().parents[3]/'schemas'/(name+'.schema.json'))
    _validate(value,schema);return value

def test_id(provider,container,locator,parameters): return fingerprint([provider,container,locator,parameters])
