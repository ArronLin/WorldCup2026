"""Framework input adapter: native files, immutable hashes and exact trace positions."""
from __future__ import annotations
from pathlib import Path
import re
from .contracts import *


def read_specification(feature_root, framework='speckit'):
    root = Path(feature_root)
    if framework == 'speckit':
        p = inside(root, 'spec.md')
        require(p.is_file(), 'feature 目录或 spec.md 不存在')
        return {'framework':'speckit', 'files':{'spec.md':sha(p.read_bytes())}}
    require(framework == 'openspec', '不支持的规范框架')
    paths = sorted((root/'specs').rglob('spec.md')) if (root/'specs').is_dir() else []
    files = {}; result = {'framework':'openspec', 'files':files, 'requirements':[], 'scenarios':[]}
    for p in paths:
        relative = p.relative_to(root).as_posix(); p = inside(root, relative)
        raw = p.read_bytes(); files[relative] = sha(raw)
        capability = p.parent.relative_to(root/'specs').as_posix()
        operation = None; requirement = None; previous_name = None
        for line_number, line in enumerate(normalized(raw).splitlines(), 1):
            section = re.match(r'^##\s+(ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$', line)
            if section:
                operation = section[1].lower(); requirement = None; continue
            heading = re.match(r'^### Requirement:\s*(.+?)\s*$', line)
            rename_from = re.match(r'^\s*-\s*FROM:\s*`?### Requirement:\s*(.+?)`?\s*$', line)
            rename_to = re.match(r'^\s*-\s*TO:\s*`?### Requirement:\s*(.+?)`?\s*$', line)
            if operation == 'renamed' and rename_from:
                previous_name = rename_from[1].rstrip('`').strip(); continue
            if heading or operation == 'renamed' and rename_to:
                name = (heading or rename_to)[1].rstrip('`').strip()
                require(operation is not None, '需求未声明增量操作：'+relative+':'+str(line_number))
                require(operation != 'renamed' or previous_name, '重命名需求缺少 FROM：'+relative)
                ident = 'OSR-'+sha(capability+'\0'+name)[:20]
                requirement = {'id':ident, 'name':name, 'path':relative, 'line':line_number,
                    'position':relative+':'+str(line_number), 'capability':capability, 'operation':operation}
                if operation == 'renamed': requirement['previous_name'] = previous_name; previous_name = None
                result['requirements'].append(requirement)
                continue
            scenario = re.match(r'^#### Scenario:\s*(.+?)\s*$', line)
            if scenario:
                require(requirement is not None, '场景没有所属需求：'+relative+':'+str(line_number))
                result['scenarios'].append({'id':'OSS-'+sha(requirement['id']+'\0'+scenario[1])[:20],
                    'name':scenario[1], 'requirement_id':requirement['id'], 'path':relative, 'line':line_number,
                    'position':relative+':'+str(line_number), 'capability':capability, 'operation':operation})
        require(previous_name is None, '重命名需求缺少 TO：'+relative)
    metadata = root/'.openspec.yaml'
    skip = bool(metadata.is_file() and re.search(r'(?m)^skip_specs:\s*true\s*(?:#.*)?$', metadata.read_text(encoding='utf-8-sig')))
    require(result['requirements'] or skip, '没有可追踪的 OpenSpec 增量需求；无行为变化须明确 skip_specs: true', 1)
    # OpenSpec permits renaming a requirement and modifying its body in one delta.
    merged={}
    for row in result['requirements']:
        prior=merged.get(row['id'])
        if prior:
            require(prior['path']==row['path'] and {prior['operation'],row['operation']}=={'renamed','modified'},
                    'OpenSpec 需求名称重复，无法稳定定位')
            rename=prior if prior['operation']=='renamed' else row
            modified=row if row['operation']=='modified' else prior
            merged[row['id']]={**modified,'previous_name':rename['previous_name'],'operations':['renamed','modified']}
        else:merged[row['id']]=row
    result['requirements']=list(merged.values())
    for group in ('requirements','scenarios'):
        ids = [row['id'] for row in result[group]]
        require(len(ids) == len(set(ids)), 'OpenSpec 需求或场景名称重复，无法稳定定位')
    if metadata.is_file(): files['.openspec.yaml'] = sha(metadata.read_bytes())
    result['skip_specs'] = skip
    return result


def validate_native_trace(value, specification, root):
    validate(value, 'traceability')
    for group in ('requirements', 'scenarios'):
        expected = {row['id']:row for row in specification[group]}
        actual = {row['id']:row for row in value[group]}
        require(len(actual) == len(value[group]), '追踪 ID 重复')
        require(set(actual) == set(expected), '追踪缺少或包含未知 OpenSpec ID：'+', '.join(sorted(set(actual)^set(expected))), 1)
        for ident, row in actual.items():
            require(row['spec_position'] == expected[ident]['position'], 'OpenSpec 追踪位置不一致：'+ident)
            if row['applicability'] != 'automated':
                require(row.get('reason','').strip() and row.get('confirmed_by','').strip(), '手工或不适用项需原因和确认依据：'+ident)
            else:
                require(row['tests'], '自动验证项缺少真实测试定位：'+ident)
            for test in row['tests']:
                if test['file']: inside(root, test['file'])
                if not test['tdd_applicable']: require(test['tdd_reason'].strip(), 'TDD 不适用项需原因')
    return value


def snapshot(ctx, directory):
    value = ctx.specification()
    if ctx.framework == 'speckit':
        atomic(directory/'spec.md', (ctx.feature_root/'spec.md').read_bytes(), immutable=True)
    else:
        for relative, expected in value['files'].items():
            raw = inside(ctx.feature_root,relative).read_bytes()
            require(sha(raw) == expected, '捕获规格时文件变化：'+relative)
            atomic(inside(directory/'specifications',relative),raw,immutable=True)
        atomic(directory/'specification.json',value,immutable=True)
    return value
