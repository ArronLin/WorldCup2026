"""Portable task records. No Agent, language, shell or test-runner dependency."""
from contextlib import contextmanager
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import tempfile
import uuid

VERSION = 2
STAGES = ('created', 'assessed', 'implementing', 'verifying', 'finished')


def upgrade_rules(value):
    """Migrate only recognized factory prose; preserve custom policies verbatim."""
    import copy
    result = copy.deepcopy(value)
    migrations = read(Path(__file__).with_name('rule-migrations.json'))
    result['rules'] = [rule for rule in result.get('rules', []) if rule.get('kind') != 'reports']
    for rule in result['rules']:
        for migration in migrations:
            if rule.get('kind') == migration['kind'] and rule.get('text') == migration['before']:
                rule['text'] = migration['after']
                if rule.get('title') == migration.get('old_title'):
                    rule['title'] = migration['title']
    if result.get('rules') != value.get('rules'):
        fingerprint = digest(json.dumps(result['rules'], ensure_ascii=False, sort_keys=True).encode('utf-8'))
        result.update(revision='lean-' + fingerprint[:16], content_fingerprint=fingerprint)
    return result


def upgrade_task(value):
    """Upgrade on a write operation, retaining the complete previous record."""
    import copy
    if value['schema_version'] == VERSION:
        return value
    previous = copy.deepcopy(value)
    value.update(schema_version=VERSION, completion_scope='implementation', verification='unverified')
    value['rules'] = upgrade_rules(value['rules'])
    if value['rules'] != previous['rules']:value['revision'] += 1
    value['events'].append({'migration': 'lean-v2', 'previous_record': previous})
    return value


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
        if part.is_symlink() or getattr(part,'is_junction',lambda:False)():raise ValueError('不支持链接路径')
    if not p.resolve().is_relative_to(root):raise ValueError('路径超出仓库')
    return p


@contextmanager
def lock(root):
    # A kernel lock is released on process exit, including abnormal termination.
    root=Path(root).resolve()
    # Store the lock with the task records: moving or cloning the repository
    # must not require any state previously written by Studio on this machine.
    git_dir=root/'.git'
    path=(git_dir if git_dir.is_dir() else root/'.repo-sdd-studio')/'workflow.lock'
    path.parent.mkdir(parents=True,exist_ok=True)
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
    if value.get('schema_version') == 1 and type(value.get('schema_version')) is int:
        # Validate legacy records with their original fields, without rewriting reads.
        schema = dict(schema, properties=dict(schema['properties']))
        schema['properties'].pop('completion_scope', None)
        schema['properties']['schema_version'] = {'const': 1}
        schema['properties']['verification'] = {'enum': ['unverified', 'partial', 'failed', 'passed']}
        schema['required'] = [key for key in schema['required'] if key != 'completion_scope']
    visit(value,schema,'任务')
    return value


@serialized
def create(root, framework, ident, kind, title, acceptance, risks, rules,native_path=''):
    if kind not in ('feature','bug','quick','change'):raise ValueError('任务类型无效')
    if kind=='change':raise ValueError('需求变更必须明确关联已有任务，请对其清单使用 impact，不创建无关联变更')
    if framework=='speckit' and kind=='quick':
        raise ValueError('Spec Kit 轻量任务使用 specs/tiny/ 下的单一 Markdown，不创建 Studio work-item')
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
        'verification':'unverified','completion_scope':'implementation','events':[]}))
    return path


def checked(root,path):
    path=Path(path).resolve();relative=path.relative_to(Path(root).resolve()).as_posix()
    inside(root,relative);value=validate_record(read(path))
    if value.get('schema_version') not in (1, VERSION) or task_path(root,value['framework'],value['id']).resolve()!=path:
        raise ValueError('任务身份或版本不匹配')
    if value.get('stage') not in STAGES or type(value.get('revision')) is not int or value['revision']<1:
        raise ValueError('任务阶段或修订无效')
    return value


@serialized
def transition(root,path,stage,precheck=None,verifier=None):
    value=upgrade_task(checked(root,path))
    if stage not in STAGES or stage=='finished':raise ValueError('请使用 finish 核对实施产物并结束流程')
    already_verified=value['stage']=='assessed' and stage=='verifying'
    implementation=None
    if already_verified:
        implementation=verifier() if verifier else None
        if not implementation or not implementation.get('implementation_complete'):raise ValueError('无需新增实施时，须先核对当前实施产物')
    elif STAGES.index(stage)!=STAGES.index(value['stage'])+1:raise ValueError('不能跳过流程阶段')
    if stage=='assessed' and not value['acceptance']:raise ValueError('请先确认验收条件')
    if stage=='implementing':
        if precheck is None:raise ValueError('实施前必须核对当前规则和任务身份')
        precheck()
    if stage=='verifying' and not already_verified:
        implementation=verifier() if verifier else None
        if not implementation or not implementation.get('implementation_complete'):raise ValueError('请先核对实施产物和未完成任务')
    event={'stage':stage,'revision':value['revision'],'implementation_already_verified':already_verified}
    if implementation and implementation.get('input_fingerprint'):event['input_fingerprint']=implementation['input_fingerprint']
    if implementation and implementation.get('implementation_fingerprint'):
        event['implementation_fingerprint']=implementation['implementation_fingerprint']
    value['stage']=stage;value['events'].append(event);write(path,value)
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
    value=upgrade_task(value)
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
    if value['stage']=='finished' and value['schema_version']==VERSION:
        result=verify()
        if not result.get('implementation_complete'):raise ValueError('当前实施产物未完成')
        previous=_completion_checkpoint(value)
        if not _same_inputs(previous,result):
            raise ValueError('实施产物在完成后发生变化，请重新评审当前任务')
        return {**value,'current_completion':result}
    if value['stage']!='verifying':raise ValueError('尚未进入验证阶段')
    before=read(path)
    revision=value['revision']
    result=verify()
    if checked(root,path)!=before:raise ValueError('验证期间输入发生变化')
    checkpoint=next((event for event in reversed(value['events'])
                     if event.get('stage')=='verifying' and event.get('revision')==revision),{})
    if not _same_inputs(checkpoint,result):
        raise ValueError('实施产物在核对后发生变化，请重新评审并核对当前任务')
    value=upgrade_task(value)
    value['verification']='unverified'
    value['events'].append({'completion_scope':'implementation','revision':revision,'result':result})
    if result.get('implementation_complete'):value['stage']='finished'
    write(path,value)
    return {**value,'current_completion':result}


def _completion_checkpoint(value):
    return next((event.get('result',{}) for event in reversed(value['events'])
                 if event.get('completion_scope')=='implementation' and event.get('revision')==value['revision']),{})


def _same_inputs(previous,current):
    # Legacy raw fingerprints remain strict. New snapshots additionally allow
    # only the checkbox of a fully described manual case to change afterward.
    key='implementation_fingerprint' if previous.get('implementation_fingerprint') else 'input_fingerprint'
    return not previous.get(key) or previous[key]==current.get(key)


def status(root,path,verify=None):
    """Read current completion without rewriting historical events or QA checks."""
    value=checked(root,path)
    if value['schema_version']==1:
        return {**value,'legacy_record':True,'current_verification':'unverified'}
    if value['stage'] not in ('verifying','finished'):return value
    try:
        if verify is None:raise ValueError('请通过当前仓库工作流启动器核对规则和实施产物')
        current=verify()
        if value['stage']=='finished' and not _same_inputs(_completion_checkpoint(value),current):
            raise ValueError('实施产物在完成后发生变化，请重新评审当前任务')
    except (ValueError,KeyError,OSError,TypeError) as exc:
        current={'implementation_complete':False,'verification':'unverified',
                 'summary':str(exc),'issues':[str(exc)]}
    return {**value,'current_completion':current}


def _framework(args):
    config=Path(args.config).resolve() if args.config else None
    if config is None and not getattr(args,'rules',None):raise ValueError('请通过当前框架的仓库工作流启动器执行')
    root=Path(args.project).resolve()
    base=Path(args.rules).resolve().parent if getattr(args,'rules',None) else config.parent.parent
    if not base.is_relative_to(root) or base.parent.relative_to(root).as_posix() not in ('.specify','openspec'):
        raise ValueError('规则配置不属于当前仓库框架')
    manifest=read(base/'workflow'/'install-manifest.json')
    framework='speckit' if base.parent.name=='.specify' else 'openspec'
    if manifest.get('framework')!=framework or manifest.get('owner')!='repo-sdd-studio':
        raise ValueError('任务部署清单缺失或框架不匹配')
    for relative,expected in manifest.get('files',{}).items():
        target=inside(root,relative)
        if not target.is_file() or digest(target.read_bytes())!=expected:
            raise ValueError('任务入口缺失或修改：'+relative)
    return framework,base.name


def _repository_rules(args):
    path=Path(args.rules).resolve() if getattr(args,'rules',None) else Path(args.config).resolve().parent.parent/'requirements.json'
    if not path.is_file():raise ValueError('仓库工程规则快照缺失：'+str(path))
    value=read(path)
    if not isinstance(value,dict) or not isinstance(value.get('rules'),list):
        raise ValueError('仓库工程规则快照格式无效：'+str(path))
    return upgrade_rules(value)


def _check_task_rules(args,task):
    if upgrade_rules(task.get('rules',{})).get('rules')!=_repository_rules(args).get('rules'):
        raise ValueError('任务规则快照与当前仓库不一致，请重新评审并更新任务；不得用空规则绕过已启用要求')


def inspect_tasks(text,source):
    """Inspect task checkboxes, excluding fenced examples; never change the file.

    MANUAL is an explicit task label, not a keyword in a task description. Each
    case owns its indented handoff fields; fields cannot leak from later tasks.
    """
    lines=text.splitlines(keepends=True)
    visible=[];fence=None
    for index,line in enumerate(lines):
        marker=re.match(r'^\s*(`{3,}|~{3,})',line)
        if fence:
            if marker and marker[1][0]==fence[0] and len(marker[1])>=len(fence):fence=None
            continue
        if marker:
            fence=marker[1];continue
        visible.append((index,line))
    task_pattern=re.compile(r'^(\ufeff?[ \t]*[-*+]\s+\[)([ xX])(\]\s*)(.*)')
    label_pattern=re.compile(r'^(T\d+|\d+(?:\.\d+)+|[A-Z]+-\d+)\s+((?:\[[^\]\r\n]+\]\s*)+)')
    fields={'owner':('执行人','Owner'),'environment':('环境','Environment'),
            'reason':('原因','Reason'),'steps':('步骤','Steps'),'expected':('预期','Expected')}
    aliases={alias.lower():key for key,names in fields.items() for alias in names}
    field_pattern=re.compile(r'(?:^|[;；]|\n[ \t]*(?:[-*+]\s*)?)\s*('+
        '|'.join(re.escape(alias) for alias in aliases)+r')\s*[:：]\s*',re.I)
    pending=[];manual=[];normalized=list(lines)
    for pos,(index,line) in enumerate(visible):
        match=task_pattern.match(line)
        if not match:continue
        labels=label_pattern.match(match[4])
        task_labels=re.findall(r'\[([^\]]+)\]',labels[2]) if labels else []
        is_manual=labels and 'MANUAL' in task_labels
        if not is_manual:
            if match[2]==' ':raise ValueError('实施任务仍有未完成项：'+source+':'+str(index+1))
            continue
        forbidden={'实现','准备','文档','implementation','implement','setup','documentation','document'}
        invalid=[label for label in task_labels if label.lower() in forbidden]
        if invalid:
            raise ValueError('人工测试不能标记为非测试任务：'+source+':'+str(index+1)+' '+invalid[0])
        indent=len(line)-len(line.lstrip(' \t'))
        block=[match[4]]
        for _,following in visible[pos+1:]:
            if task_pattern.match(following):break
            if following.strip() and len(following)-len(following.lstrip(' \t'))<=indent:break
            block.append(following.rstrip('\r\n'))
        description='\n'.join(block)
        matches=list(field_pattern.finditer(description));data={}
        for number,field in enumerate(matches):
            key=aliases[field[1].lower()]
            if key in data:raise ValueError('人工测试交接字段重复：'+source+':'+str(index+1)+' '+fields[key][0])
            end=matches[number+1].start() if number+1<len(matches) else len(description)
            data[key]=description[field.end():end].strip(' \t\r\n;；')
        missing=[names[0] for key,names in fields.items()
                 if not data.get(key) or data[key].lower() in ('tbd','todo','待定','未注明','待补充')]
        if missing:raise ValueError('人工测试交接信息不完整：'+source+':'+str(index+1)+' 缺少 '+ '、'.join(missing))
        result_pattern=re.compile(r'(?:^|[;；]|\n[ \t]*(?:[-*+]\s*)?)\s*(?:结果|Result)\s*[:：]\s*([^;；\r\n]+)',re.I)
        result_match=result_pattern.search(description)
        result=result_match[1].strip() if result_match else ''
        if result.lower() in ('失败','failed','fail'):
            raise ValueError('人工测试结果为失败，不能完成开发收尾：'+source+':'+str(index+1))
        item={'id':labels[1],'source':source,'line':index+1,'description':description,**data}
        if result:item['result']=result
        manual.append(item)
        if match[2]==' ':pending.append(item)
        normalized[index]=line[:match.start(2)]+' '+line[match.end(2):]
    return {'pending_manual_tests':pending,'manual_tests':manual,'normalized_text':''.join(normalized)}


def verify_native(root,task,namespace):
    return _native_inputs(root,task,namespace)[0]


def _native_inputs(root,task,namespace):
    root=Path(root).resolve();native=task.get('native_path')
    if not native:raise ValueError('任务未关联原生产物，请补充 native_path 后复核')
    path=inside(root,native)
    if task['framework']=='speckit':
        expected=('.specify/bugs/' if task['kind']=='bug' else 'specs/' if task['kind']=='feature' else '.specify/studio-tasks/')
        if not native.startswith(expected):raise ValueError('原生产物不属于当前框架与任务类型')
        files=[path/name for name in ('assessment.md','fix.md','test.md')] if task['kind']=='bug' else [path/name for name in ('spec.md','plan.md','tasks.md')] if task['kind']=='feature' else [path]
    else:
        if not native.startswith('openspec/changes/'):raise ValueError('必须关联明确的 OpenSpec change')
        meta=path/'.openspec.yaml'
        if not meta.is_file():raise ValueError('缺少 OpenSpec change 元数据')
        match=re.search(r'(?m)^\s*schema:\s*[\'\"]?([a-z0-9-]+)[\'\"]?\s*(?:#.*)?$',meta.read_text(encoding='utf-8-sig'))
        if not match:raise ValueError('OpenSpec change 元数据无法解析')
        schema=match[1]
        if task['kind'] in ('bug','quick') and schema not in ([namespace+'-bugfix',namespace+'-bugfix-specs'] if task['kind']=='bug' else [namespace+'-quick']):
            raise ValueError('change 未选择对应的项目任务 Schema')
        files=[path/'assessment.md',path/'tasks.md'] if task['kind'] in ('bug','quick') else [path/'tasks.md']
    for file in files:
        if not file.is_file() or not file.read_text(encoding='utf-8-sig').strip():
            raise ValueError('缺少原生流程产物：'+file.relative_to(root).as_posix())
    task_file=path if path.is_file() else path/('fix.md' if task['framework']=='speckit' and task['kind']=='bug' else 'tasks.md')
    text=task_file.read_bytes().decode('utf-8')
    hybrid=None
    if 'repo-sdd:hybrid-tasks:v1' in text:
        core=runpy.run_path(str(Path(__file__).with_name('hybrid.py')))
    else:
        core=None
    if core and core['configured'](text):
        hybrid=core['inspect_file'](root,task_file)
        if hybrid['issues'] or not hybrid['implementation_complete']:
            details=hybrid['issues'] or hybrid['remaining_ai'] or ['没有任务']
            raise ValueError('实施尚未完成：'+', '.join(details))
        pending=[{'id':task['id'],'source':task_file.relative_to(root).as_posix(),
                  'line':task['line'],'owner':task['fields']['owner']}
                 for task in hybrid['tasks'] if task['id'] in hybrid['pending_manual']]
        inspection={'pending_manual_tests':pending,
                    'manual_tests':[task['id'] for task in hybrid['tasks'] if task.get('executor')=='MANUAL'],
                    'normalized_text':core['definition_text'](text),
                    'hybrid_tasks':{key:hybrid[key] for key in ('feature_state','finalized','release_tasks_satisfied','final_qa_completed') if key in hybrid}}
    else:
        inspection=inspect_tasks(text,task_file.relative_to(root).as_posix())
    if task['framework']=='speckit' and task['kind']=='bug':
        for name,key,expected in (('fix.md','Status','applied'),('test.md','Result','verified')):
            raw=(path/name).read_text(encoding='utf-8-sig')
            match=re.search(r'(?im)^\s*-\s*\*\*'+key+r'\*\*:\s*`?([a-z-]+)`?\s*$',raw)
            if not match or match[1].lower()!=expected:
                raise ValueError('原生 Bug 结果尚未通过：'+name+' 需要 '+key+'='+expected)
    inputs={*files,task_file,*[inside(root,item['source']) for item in task['acceptance']]}
    if task['framework']=='openspec':
        inputs.update(file for file in (path/'proposal.md',path/'design.md',path/'.openspec.yaml') if file.is_file())
        inputs.update((path/'specs').rglob('*.md'))
    files={file.relative_to(root).as_posix():digest(file.read_bytes()) for file in inputs}
    # Preserve raw file hashes for compatibility and historical integrity. Only
    # the new implementation fingerprint ignores execution records, while still
    # checking current task completion and changes to task definitions.
    normalized=dict(files)
    if inspection['manual_tests'] or hybrid:
        normalized[task_file.relative_to(root).as_posix()]=digest(inspection['normalized_text'].encode('utf-8'))
    return files,normalized,inspection


def portable_doctor(args):
    framework,_=_framework(args)
    _repository_rules(args)
    return {'deployed':True,'ready':True,'framework':framework,'business_tests_run':False,
            'reports_required':False,'verification':'unverified','gaps':[]}


def portable_verifier(args):
    framework,namespace=_framework(args)
    task=checked(args.project,args.work_item)
    if task['framework']!=framework:raise ValueError('任务与当前框架不匹配')
    _check_task_rules(args,task)
    files,normalized,inspection=_native_inputs(args.project,task,namespace)
    common={'rules':_repository_rules(args),'acceptance':task['acceptance'],'revision':task['revision']}
    pending=inspection['pending_manual_tests']
    return {'implementation_complete':True,'verification':'unverified',
            'input_fingerprint':digest(json.dumps({'files':files,**common},sort_keys=True,ensure_ascii=False).encode('utf-8')),
            'implementation_fingerprint':digest(json.dumps({'files':normalized,**common},sort_keys=True,ensure_ascii=False).encode('utf-8')),
            'pending_manual_tests':pending,'manual_test_count':len(inspection['manual_tests']),
            **({'hybrid_tasks':inspection['hybrid_tasks']} if 'hybrid_tasks' in inspection else {}),
            'completion_scope':'implementation','business_tests_verified':False,'ci_verified':False,
            'summary':('开发实施完成；待人工验收 '+str(len(pending))+' 项；' if pending else '实施流程已完成；')+
                '测试、覆盖率和 CI 结果未由此命令核验。'}


def portable_precheck(args):
    framework,_=_framework(args)
    task=checked(args.project,args.work_item)
    if task['framework']!=framework:raise ValueError('任务与当前框架不匹配')
    _check_task_rules(args,task)
    if not task.get('acceptance'):raise ValueError('请先确认验收条件')
    for item in task['acceptance']:
        source=inside(args.project,item['source'])
        lines=source.read_text(encoding='utf-8-sig').splitlines()
        if item['line']>len(lines) or item['id'] not in lines[item['line']-1]:
            raise ValueError('验收来源与任务不一致：'+item['id'])


def main(argv=None,verifier=None,precheck=None,doctor=None):
    import sys
    for stream in (sys.stdout,sys.stderr):
        if stream is not None and hasattr(stream,'reconfigure'):stream.reconfigure(encoding='utf-8',errors='replace')
    parser=argparse.ArgumentParser(description='Repo SDD Studio 任务核心')
    parser.add_argument('action',choices=['doctor','create','status','transition','impact','apply-impact','recover-impact','finish','inspect-tasks'])
    parser.add_argument('--project',type=Path,default=Path.cwd());parser.add_argument('--work-item',type=Path)
    parser.add_argument('--input',type=Path);parser.add_argument('--stage');parser.add_argument('--approve',action='store_true')
    parser.add_argument('--config',type=Path,help='兼容旧入口：仅定位框架目录，不读取报告配置')
    parser.add_argument('--rules',type=Path,help='当前框架的 requirements.json')
    parser.add_argument('--tasks',help='仓库内原生任务 Markdown 的相对路径')
    parser.add_argument('--task-id',action='append',default=[])
    parser.add_argument('--story');parser.add_argument('--phase')
    parser.add_argument('--intent',choices=['analyze','execute'],default='execute',
                        help='analyze 只读检查；execute 保留现有已授权任务接口')
    args=parser.parse_args(argv)
    try:
        if args.intent=='analyze' and args.action not in ('doctor','status','inspect-tasks'):
            raise ValueError('只读分析不允许创建任务、推进阶段、更新文档或保存完成结果；请先取得明确继续授权')
        verifier=verifier or portable_verifier
        precheck=precheck or portable_precheck
        doctor=doctor or portable_doctor
        if args.action=='inspect-tasks':
            if not args.tasks:raise ValueError('inspect-tasks 需要 --tasks <相对路径>')
            framework,_=_framework(args)
            path=inside(args.project,args.tasks)
            relative=path.relative_to(Path(args.project).resolve()).as_posix()
            prefixes=('specs/','.specify/bugs/','.specify/studio-tasks/') if framework=='speckit' else ('openspec/changes/',)
            if path.suffix.lower()!='.md' or not relative.startswith(prefixes):
                raise ValueError('任务 Markdown 不属于当前框架')
            inspect=runpy.run_path(str(Path(__file__).with_name('hybrid.py')))['inspect_file']
            result=inspect(args.project,path,task_ids=args.task_id,story=args.story,phase=args.phase)
            print(json.dumps(result,ensure_ascii=False));return 1 if result['issues'] else 0
        if args.action=='doctor':result=doctor(args)
        elif args.action=='create':
            framework,_=_framework(args)
            request=read(args.input)
            if request.get('framework')!=framework:raise ValueError('任务与当前框架不匹配')
            _check_task_rules(args,request)
            result={'work_item':str(create(args.project,**request))}
        elif args.action=='status':
            result=status(args.project,args.work_item,lambda:verifier(args))
        elif args.action=='transition':
            callback=(lambda:precheck(args)) if precheck is not None else None
            check=(lambda:verifier(args)) if verifier is not None else None
            result=transition(args.project,args.work_item,args.stage,callback,check)
        elif args.action=='impact':result=propose(args.project,args.work_item,read(args.input))
        elif args.action=='finish':
            result=finish(args.project,args.work_item,lambda:verifier(args))
            print(json.dumps(result,ensure_ascii=False));return 0 if result['stage']=='finished' else 1
        elif args.action=='recover-impact':result=recover_impact(args.project,args.work_item)
        else:result=apply_impact(args.project,args.work_item,args.approve)
        print(json.dumps(result,ensure_ascii=False));return 0
    except (ValueError,KeyError,OSError,TypeError) as exc:
        import sys
        print(str(exc),file=sys.stderr);return 1


if __name__=='__main__':raise SystemExit(main())
