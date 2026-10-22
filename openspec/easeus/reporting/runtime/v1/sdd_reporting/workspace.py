"""Immutable per-feature baseline and complete, explicit source inventories."""
from __future__ import annotations
import fnmatch
import os
from pathlib import Path
import re
import subprocess
import uuid

from .contracts import *
from .config import config_fingerprint, validate_config

def matches(name,patterns):
    # **/ matches zero or more directories, * stays within one path component.
    for pattern in patterns:
        bits=[];i=0
        while i<len(pattern):
            if pattern[i:i+3]=='**/': bits.append('(?:.*/)?');i+=3
            elif pattern[i:i+2]=='**': bits.append('.*');i+=2
            elif pattern[i]=='*': bits.append('[^/]*');i+=1
            elif pattern[i]=='?': bits.append('[^/]');i+=1
            else: bits.append(re.escape(pattern[i]));i+=1
        if re.fullmatch(''.join(bits),name): return True
    return False

def inventory(root,include,exclude):
    result={};root=Path(root)
    for directory,dirs,names in os.walk(root,followlinks=False):
        dirs[:]=[d for d in sorted(dirs) if d not in {'.git','.specify','specs','openspec'}]
        for name in sorted(names):
            p=Path(directory)/name;relative=p.relative_to(root).as_posix()
            if matches(relative,include) and not matches(relative,exclude):
                require(not p.is_symlink(),'源码符号链接不受支持：'+relative)
                inside(root,relative)
                try: result[relative]=sha(normalized(p.read_bytes()))
                except UnicodeError as exc: raise ReportError('生产/测试源码需为 UTF-8，请调整范围或提供转换适配：'+relative) from exc
        for d in list(dirs):
            if (Path(directory)/d).is_symlink():
                require(not matches((Path(directory)/d).relative_to(root).as_posix()+'/',include),'生产范围包含符号链接目录：'+d)
                dirs.remove(d)
    return dict(sorted(result.items()))

def sources(root,config): return inventory(root,config['production_include'],config['production_exclude'])
def test_sources(root,config): return inventory(root,config['test_include'],config['test_exclude'])

def git(root,args):
    try:
        p=subprocess.run(['git',*args],cwd=root,capture_output=True,timeout=30,**({'creationflags':0x08000000} if os.name=='nt' else {}))
        return p.stdout.decode('utf-8').strip() if p.returncode==0 else None
    except (OSError,subprocess.TimeoutExpired,UnicodeError): return None

class Context:
    def __init__(self,root,config_path,feature=None,bindings=None):
        self.root=Path(root).resolve();self.config_path=Path(config_path).resolve()
        require(self.config_path.is_relative_to(self.root),'报告配置必须位于目标仓库')
        self.config=validate_config(read_json(self.config_path),self.root)
        self.bindings=bindings or {}
        require('policy' in self.config and 'reports' in self.config['policy'],'缺少已应用的规则快照')
        policy=self.config['policy'];reports=policy['reports']
        require(isinstance(reports,dict) and set(reports)=={'added_coverage_html','requirements_tdd_html'} and all(type(v) is bool for v in reports.values()),'报告开关必须是完整布尔参数')
        threshold=policy.get('new_unit_line_coverage_minimum')
        require(threshold is None or type(threshold) in (int,float) and 0<=threshold<=1,'覆盖率门槛必须在 0–1 之间')
        require(self.config.get('config_fingerprint')==config_fingerprint(self.config),'执行配置指纹不一致，请重新评审应用')
        require(bool(re.fullmatch('[a-f0-9]{64}',self.config.get('rules_fingerprint',''))),'缺少规则指纹')
        requirements=read_json(self.config_path.parent.parent/'requirements.json')
        rules=requirements.get('rules')
        require(isinstance(rules,list),'缺少仓库规则快照')
        import json
        require(sha(json.dumps(rules,ensure_ascii=False,indent=2)+'\n')==self.config['rules_fingerprint'],
                '报告配置与仓库当前规则不一致，请重新适配',1)
        active={r['kind']:r for r in rules if r.get('enabled')}
        coverage_rule=active.get('coverage',{}).get('parameters',{}).get('minimum_percent')
        expected_reports=active.get('reports',{}).get('parameters',{'added_coverage_html':False,'requirements_tdd_html':False})
        require(self.config['policy']['reports']==expected_reports and
            self.config['policy'].get('tdd_required')==('tdd' in active) and
            self.config['policy'].get('new_unit_line_coverage_minimum')==(coverage_rule/100 if coverage_rule is not None else None),
            '报告政策与有效规则快照不一致')
        require(any(self.config['policy']['reports'].values()),'报告能力未启用')
        self.feature=feature
        self.framework=self.config.get('framework','speckit')
        if feature is not None:
            pattern=r'openspec/changes/(?:archive/)?[^/]+' if self.framework=='openspec' else r'specs/[^/]+'
            require(re.fullmatch(pattern,feature),'--feature 需要当前框架下明确的功能或变更目录，不猜测最新目录')
            self.feature_root=inside(self.root,feature)
            require(self.feature_root.is_dir(),'功能或 change 目录不存在')
            self.evidence=inside(self.root,feature+'/evidence')
            self.store=inside(self.root,feature+'/evidence/reporting')
            self.specification()
            if self.framework=='openspec' and '/archive/' in feature and (self.store/'feature.json').is_file():
                saved=read_json(self.store/'feature.json')
                original=saved['feature']
                require(re.fullmatch(r'openspec/changes/[^/]+',original) and
                        (self.feature_root.name==Path(original).name or re.fullmatch(r'\d{4}-\d{2}-\d{2}-'+re.escape(Path(original).name),self.feature_root.name)),
                        '归档目录与原 change 身份不匹配')
                self.feature=original

    def specification(self):
        from .specification import read_specification
        return read_specification(self.feature_root,self.framework)

    def spec_digest(self):
        return sha((self.feature_root/'spec.md').read_bytes()) if self.framework=='speckit' else sha(encoded(self.specification()))

    @property
    def spec_record(self):
        return 'spec.md' if self.framework=='speckit' else 'specification.json'

    def frozen(self):
        feature=validate(read_json(self.store/'feature.json'),'feature')
        baseline=validate(read_json(self.store/'baseline.json'),'baseline')
        require(feature['feature']==self.feature and baseline['id']==feature['baseline_id'],'功能与基线不匹配')
        require(feature['config_fingerprint']==self.config['config_fingerprint'] and
                feature['rules_fingerprint']==self.config['rules_fingerprint'] and feature['config']==self.config,
                '规则/执行配置已改变，不能用新参数解释旧证据',1)
        require(fingerprint(feature)==baseline['feature_fingerprint'],'功能快照被修改')
        base_root=self.store/'baseline-sources'
        actual=inventory(base_root,self.config['production_include'],self.config['production_exclude'])
        require(actual==baseline['files'],'基线源码或完整清单损坏')
        if self.framework=='openspec':
            stored=read_json(self.store/'baseline-specifications/specification.json')
            require(fingerprint(stored)==feature.get('specification_fingerprint'),'基线规格清单损坏')
            for relative,expected in stored['files'].items():
                path=inside(self.store/'baseline-specifications/specifications',relative)
                require(path.is_file() and sha(path.read_bytes())==expected,'基线规格原文件损坏：'+relative)
        return feature,baseline

    def baseline(self,before_changes=False,from_commit=None):
        if (self.store/'baseline.json').exists(): return self.frozen()[1]
        require(self.config['production_include'],'缺少完整生产代码范围，安排 plan/tasks 建设采集能力',1)
        require(not (self.store/'feature.json').exists() and not (self.store/'runs').exists(),'发现不完整/已有历史，不得重建基线')
        require(before_changes or from_commit,'首次基线需 --confirm-before-changes；功能中途必须提供可信 --from-commit，不能以修改后源码补造基线',1)
        if from_commit:
            require(re.fullmatch('[a-f0-9]{40}',from_commit),'from-commit 必须为完整提交 ID')
            require(git(self.root,['merge-base','--is-ancestor',from_commit,'HEAD']) is not None,'基线提交不是 HEAD 的祖先')
            names=git(self.root,['ls-tree','-r','--name-only',from_commit]);require(names is not None,'无法读取基线提交')
            content={}
            for p in names.splitlines():
                if matches(p,self.config['production_include']) and not matches(p,self.config['production_exclude']):
                    inside(self.root,p)
                    raw=subprocess.check_output(['git','show',from_commit+':'+p],cwd=self.root)
                    content[p]=normalized(raw)
        else:
            initial=sources(self.root,self.config)
            content={p:normalized(inside(self.root,p).read_bytes()) for p in initial}
            require(initial==sources(self.root,self.config)=={p:sha(s) for p,s in content.items()},'捕获基线期间源码发生变化，请在修改前重试',1)
        ident=uuid.uuid4().hex;created=now()
        feature={'schema_version':1,'feature':self.feature,'name':self.feature_root.name,'spec_path':self.feature+('/spec.md' if self.framework=='speckit' else '/specs'),
            'created_at':created,'baseline_id':ident,'tool_version':'1.0.0','rules_fingerprint':self.config['rules_fingerprint'],
            'config_fingerprint':self.config['config_fingerprint'],'policy':self.config['policy'],'config':self.config}
        specification=self.specification() if self.framework=='openspec' else None
        if specification is not None:feature['specification_fingerprint']=fingerprint(specification)
        record={'schema_version':1,'id':ident,'created_at':created,'mode':'git-commit' if from_commit else 'snapshot',
            'head':git(self.root,['rev-parse','HEAD']),'dirty':git(self.root,['status','--porcelain']),
            'source_commit':from_commit,'files':{p:sha(s) for p,s in sorted(content.items())},'feature_fingerprint':fingerprint(feature)}
        (self.store/'baseline-sources').mkdir(parents=True,exist_ok=True)
        if self.framework=='openspec':
            from .specification import snapshot
            captured=snapshot(self,self.store/'baseline-specifications')
            require(captured==specification,'捕获基线期间规格发生变化')
        for p,s in content.items(): atomic(inside(self.store/'baseline-sources',p),s,immutable=True)
        atomic(self.store/'feature.json',feature,immutable=True);atomic(self.store/'baseline.json',record,immutable=True)
        return record
