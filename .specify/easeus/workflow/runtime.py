"""Portable task records. No Agent, language, shell or test-runner dependency."""
from contextlib import contextmanager
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import uuid

VERSION = 1
STAGES = ('created', 'assessed', 'implementing', 'verifying', 'finished')


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def write(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    raw=json.dumps(value,ensure_ascii=False,indent=2).encode('utf-8')
    fd,name=tempfile.mkstemp(dir=path.parent,prefix='.task-')
    try:
        with os.fdopen(fd,'wb') as stream:
            stream.write(raw);stream.flush();os.fsync(stream.fileno())
        os.replace(name,path)
    finally:
        if os.path.exists(name):os.unlink(name)


def inside(root, relative):
    root=Path(root).resolve();p=root/relative
    if not relative or Path(relative).is_absolute() or '..' in Path(relative).parts:
        raise ValueError('必须使用仓库内相对路径')
    for part in (p,*p.parents):
        if part==root:break
        if part.is_symlink() or part.is_junction():raise ValueError('不支持链接路径')
    if not p.resolve().is_relative_to(root):raise ValueError('路径超出仓库')
    return p


@contextmanager
def lock(root):
    # A kernel lock is released on process exit, including abnormal termination.
    root=Path(root).resolve()
    key=digest(str(root).casefold().encode())[:24]
    state=Path(os.environ.get('SPECKIT_WIZARD_STATE',str(Path(os.environ.get('LOCALAPPDATA',str(Path.home()/'.local/share')))/'SpecKitWizard')))
    path=state/'projects'/key/'write.lock';path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('a+b') as stream:
        stream.seek(0);stream.write(b'0');stream.flush();stream.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError as exc:raise ValueError('仓库已有任务操作') from exc
        try:yield
        finally:
            stream.seek(0)
            if os.name=='nt':msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else:fcntl.flock(stream,fcntl.LOCK_UN)


def serialized(fn):
    def wrapped(root,*args,**kwargs):
        with lock(root):return fn(root,*args,**kwargs)
    return wrapped


def task_path(root, framework, ident):
    if framework not in ('speckit','openspec') or not re.fullmatch('[a-z][a-z0-9-]{0,63}',ident):
        raise ValueError('框架或任务 ID 无效')
    base='.specify' if framework=='speckit' else 'openspec'
    return inside(root,base+'/studio-tasks/'+ident+'/work-item.json')


def validate_record(value):
    schema=read(Path(__file__).with_name('work-item.schema.json'))
    def visit(item,node,path):
        types={'object':dict,'array':list,'string':str,'integer':int}
        if 'type' in node and type(item) is not types[node['type']]:raise ValueError(path+' 类型无效')
        if 'const' in node and (type(item) is not type(node['const']) or item!=node['const']):raise ValueError(path+' 版本无效')
        if 'enum' in node and item not in node['enum']:raise ValueError(path+' 值无效')
        if isinstance(item,dict):
            if any(k not in item for k in node.get('required',[])):raise ValueError(path+' 缺少必填字段')
            if node.get('additionalProperties') is False and set(item)-set(node['properties']):raise ValueError(path+' 包含未知字段')
            for k,child in node.get('properties',{}).items():
                if k in item:visit(item[k],child,path+'.'+k)
        if isinstance(item,list):
            for i,child in enumerate(item):visit(child,node.get('items',{}),path+'['+str(i)+']')
        if isinstance(item,str):
            if len(item)<node.get('minLength',0) or ('pattern' in node and not re.search(node['pattern'],item)):raise ValueError(path+' 格式无效')
        if type(item) is int and item<node.get('minimum',item):raise ValueError(path+' 超出范围')
    visit(value,schema,'任务')
    return value


@serialized
def create(root, framework, ident, kind, title, acceptance, risks, rules,native_path=''):
    if kind not in ('feature','bug','quick','change'):raise ValueError('任务类型无效')
    if kind=='change':raise ValueError('需求变更必须明确关联已有任务，请对其清单使用 impact，不创建无关联变更')
    if kind=='quick' and (risks or not acceptance):raise ValueError('轻量任务需要明确验收条件且无未处理风险')
    path=task_path(root,framework,ident)
    if path.exists():raise ValueError('任务已存在，请显式恢复，不覆盖历史')
    if not isinstance(title,str) or not title.strip():raise ValueError('任务标题不能为空')
    if not isinstance(acceptance,list) or not isinstance(risks,list) or not isinstance(rules,dict):
        raise ValueError('验收、风险和规则格式无效')
    native_path=native_path or (('openspec/changes/'+ident) if framework=='openspec' else '.specify/bugs/'+ident if kind=='bug' else 'specs/'+ident if kind=='feature' else path.parent.relative_to(Path(root).resolve()).as_posix()+'/task.md')
    inside(root,native_path)
    write(path,validate_record({'schema_version':VERSION,'id':ident,'framework':framework,'kind':kind,'title':title,
        'native_path':native_path,
        'acceptance':acceptance,'risks':risks,'rules':rules,'revision':1,'stage':'created',
        'verification':'unverified','events':[]}))
    return path


def checked(root,path):
    path=Path(path).resolve();relative=path.relative_to(Path(root).resolve()).as_posix()
    inside(root,relative);value=validate_record(read(path))
    if value.get('schema_version')!=VERSION or task_path(root,value['framework'],value['id']).resolve()!=path:
        raise ValueError('任务身份或版本不匹配')
    if value.get('stage') not in STAGES or type(value.get('revision')) is not int or value['revision']<1:
        raise ValueError('任务阶段或修订无效')
    return value


@serialized
def transition(root,path,stage,precheck=None,verifier=None):
    value=checked(root,path)
    if stage not in STAGES or stage=='finished':raise ValueError('完成必须运行独立证据检查')
    already_verified=value['stage']=='assessed' and stage=='verifying'
    if already_verified:
        if verifier is None or not verifier().get('passed'):raise ValueError('无需新增实施时，须先通过当前输入的真实验证')
    elif STAGES.index(stage)!=STAGES.index(value['stage'])+1:raise ValueError('不能跳过流程阶段')
    if stage=='assessed' and not value['acceptance']:raise ValueError('请先确认验收条件')
    if stage=='implementing':
        if precheck is None:raise ValueError('实施前必须通过 Worker 基线与 TDD 检查')
        precheck()
    value['stage']=stage;value['events'].append({'stage':stage,'revision':value['revision'],'implementation_already_verified':already_verified});write(path,value)
    return value


@serialized
def propose(root,path,updates):
    value=checked(root,path)
    if not updates:raise ValueError('缺少拟更新内容')
    changes={}
    for relative,content in updates.items():
        p=inside(root,relative)
        if p.resolve().is_relative_to(Path(path).resolve().parent):raise ValueError('更新不能改写任务记录或证据')
        if not p.is_file() or not isinstance(content,str):raise ValueError('更新只接受已存在的文本文件')
        changes[relative]={'before':digest(p.read_bytes()),'original':base64.b64encode(p.read_bytes()).decode('ascii'), 'after':content}
    proposal={'revision':value['revision'],'changes':changes,'approved':False}
    write(Path(path).parent/'impact.json',proposal)
    return proposal


@serialized
def apply_impact(root,path,approved):
    value=checked(root,path);p=Path(path).parent/'impact.json';proposal=read(p)
    if not approved or proposal['revision']!=value['revision']:raise ValueError('更新方案尚未确认或已过期')
    for old in (Path(path).parent/'history').glob('impact-*.json'):
        if read(old).get('state')=='writing':raise ValueError('存在未恢复更新事务，请先执行 recover-impact')
    journal=Path(path).parent/'history'/('impact-'+str(value['revision'])+'-'+uuid.uuid4().hex+'.json')
    for relative,change in proposal['changes'].items():
        if digest(inside(root,relative).read_bytes())!=change['before']:raise ValueError('文件在评审后被外部修改')
    # Durable journal exists before the first write. Recovery never overwrites later human edits.
    proposal['approved']=True;proposal['state']='writing';proposal['task_before']=value;write(journal,proposal)
    for relative,change in proposal['changes'].items():
        target=inside(root,relative)
        if digest(target.read_bytes())!=change['before']:raise ValueError('更新期间文件被外部修改：'+relative)
        fd,name=tempfile.mkstemp(dir=target.parent,prefix='.update-')
        try:
            with os.fdopen(fd,'wb') as stream:stream.write(change['after'].encode('utf-8'));stream.flush();os.fsync(stream.fileno())
            os.replace(name,target)
        finally:
            if os.path.exists(name):os.unlink(name)
    value['revision']+=1;value['stage']='assessed';value['verification']='unverified';write(path,value)
    proposal['state']='committed';write(journal,proposal)
    p.unlink();return value


@serialized
def recover_impact(root,path):
    checked(root,path)
    journals=list((Path(path).parent/'history').glob('impact-*.json'))
    for journal in journals:
        record=read(journal)
        if record['state']!='writing':continue
        for relative,change in record['changes'].items():
            raw=inside(root,relative).read_bytes()
            if digest(raw) not in (change['before'],digest(change['after'].encode('utf-8'))):
                raise ValueError('恢复冲突，保留外部修改：'+relative)
        for relative,change in record['changes'].items():
            target=inside(root,relative);raw=base64.b64decode(change['original'])
            if digest(raw)!=change['before']:raise ValueError('恢复备份损坏：'+relative)
            fd,name=tempfile.mkstemp(dir=target.parent,prefix='.recover-')
            try:
                with os.fdopen(fd,'wb') as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
                os.replace(name,target)
            finally:
                if os.path.exists(name):os.unlink(name)
        write(path,record['task_before']);record['state']='recovered';write(journal,record)
    return checked(root,path)


@serialized
def finish(root,path,verify):
    value=checked(root,path)
    if value['stage']!='verifying':raise ValueError('尚未进入验证阶段')
    revision=value['revision']
    # Caller must execute the real reporting gate, never trust a persisted passed flag.
    result=verify()
    if checked(root,path)['revision']!=revision:raise ValueError('验证期间输入发生变化')
    value['verification']='passed' if result.get('passed') else 'failed' if result.get('verification')=='failed' else 'partial'
    value['events'].append({'verification':value['verification'],'revision':revision,'result':result})
    if result.get('passed'):value['stage']='finished'
    write(path,value)
    return value


def main(argv=None,verifier=None,precheck=None,doctor=None):
    import sys
    for stream in (sys.stdout,sys.stderr):
        if stream is not None and hasattr(stream,'reconfigure'):stream.reconfigure(encoding='utf-8',errors='replace')
    parser=argparse.ArgumentParser(description='Repo SDD Studio 任务核心')
    parser.add_argument('action',choices=['doctor','create','status','transition','impact','apply-impact','recover-impact','finish'])
    parser.add_argument('--project',type=Path,default=Path.cwd());parser.add_argument('--work-item',type=Path)
    parser.add_argument('--input',type=Path);parser.add_argument('--stage');parser.add_argument('--approve',action='store_true')
    parser.add_argument('--config',type=Path)
    args=parser.parse_args(argv)
    try:
        if args.action=='doctor':result=doctor(args) if doctor else {'schema_version':VERSION,'runtime_available':True,'deployment_checked':False,'business_tests_run':False}
        elif args.action=='create':result={'work_item':str(create(args.project,**read(args.input)))}
        elif args.action=='status':result=checked(args.project,args.work_item)
        elif args.action=='transition':
            callback=(lambda:precheck(args)) if precheck is not None else None
            check=(lambda:verifier(args)) if verifier is not None else None
            result=transition(args.project,args.work_item,args.stage,callback,check)
        elif args.action=='impact':result=propose(args.project,args.work_item,read(args.input))
        elif args.action=='finish':
            if verifier is None:raise ValueError('请使用应用 Worker 的完成检查入口，不能信任外部成功标记')
            result=finish(args.project,args.work_item,lambda:verifier(args))
            print(json.dumps(result,ensure_ascii=False));return 0 if result['verification']=='passed' else 1
        elif args.action=='recover-impact':result=recover_impact(args.project,args.work_item)
        else:result=apply_impact(args.project,args.work_item,args.approve)
        print(json.dumps(result,ensure_ascii=False));return 0
    except (ValueError,KeyError,OSError,TypeError) as exc:
        import sys
        print(str(exc),file=sys.stderr);return 1


if __name__=='__main__':raise SystemExit(main())
