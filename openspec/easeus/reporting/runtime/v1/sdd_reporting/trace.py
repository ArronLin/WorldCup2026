"""Exact requirement/test identity and real Red/Green/regression association."""
import re
from .contracts import *

def validate_trace(value,spec,root):
    validate(value,'traceability');ids=[]
    for group,pattern in [('requirements',r'FR-\d+'),('scenarios',r'US\d+-AS\d+')]:
        for row in value[group]:
            require(re.fullmatch(pattern,row['id']) and row['id'] in spec,'规格缺少/不支持稳定 ID：'+row['id'])
            ids.append(row['id'])
            if row['applicability']!='automated': require(row.get('reason','').strip() and row.get('confirmed_by','').strip(),'手工或不适用项需原因和确认依据：'+row['id'])
            for t in row['tests']:
                if t['file']: inside(root,t['file'])
                if not t['tdd_applicable']: require(t['tdd_reason'].strip(),'TDD 不适用项需说明原因')
    require(len(ids)==len(set(ids)),'追踪 ID 重复')
    expected=set(re.findall(r'\b(?:FR-\d+|US\d+-AS\d+)\b',spec))
    require(expected and expected<=set(ids),'追踪缺少规格 ID：'+', '.join(sorted(expected-set(ids))),1)
    require(value['requirements'] and value['scenarios'],'需分别记录需求和验收场景',1)
    return value

def locate(locator,tests):
    return [t for t in tests if all(t[k]==locator[k] for k in ('provider','locator','container','parameters','level'))
            and (not locator['file'] or not t['file'] or locator['file']==t['file'])]

def evaluate(value,tests):
    def group(rows):
        output=[]
        for row in rows:
            matches=[]
            for locator in row['tests']:
                found=locate(locator,tests)
                matches.append({'locator':locator,'status':'unexecuted' if not found else 'ambiguous' if len(found)>1 else found[0]['status'],
                                'test':found[0] if len(found)==1 else None})
            status=row['applicability'] if row['applicability']!='automated' else 'unmapped' if not matches else next((m['status'] for m in matches if m['status']!='passed'),'passed')
            output.append({**row,'status':status,'matches':matches})
        return output
    requirements=group(value['requirements']);scenarios=group(value['scenarios'])
    def metric(rows):
        return {'total':len(rows),'automated':sum(r['applicability']=='automated' for r in rows),
                'passed':sum(r['status']=='passed' for r in rows),'manual':sum(r['status']=='manual' for r in rows),
                'not_applicable':sum(r['status']=='not_applicable' for r in rows)}
    return {'requirements':requirements,'scenarios':scenarios,'requirement_metric':metric(requirements),'scenario_metric':metric(scenarios),
            'passed':all(r['status'] in {'passed','manual','not_applicable'} for r in requirements+scenarios)}

def classify_red(value,selected,exit_code):
    if value['global_errors'] or not selected: return 'infrastructure_or_missing_target'
    if exit_code!=0 and all(t['status']=='failed' and t['failure_kind']=='assertion' and t['failure'].strip() for t in selected): return 'assertion_red'
    return 'needs_review'

def tdd(tests,runs,enabled,required_by_test):
    if not enabled: return {'status':'not_enabled','complete':None,'applicable':None,'items':[]}
    items=[]
    for test in tests:
        entry={'test_id':test['test_id'],'status':'missing_evidence' if test['status']=='passed' else 'not_passing'}
        if not test.get('file') or not test.get('file_hash'): entry['status']='missing_test_source';items.append(entry);continue
        candidates=[r for r in runs if r['cycle'] and any(t['test_id']==test['test_id'] for t in r['results'])]
        for red in candidates:
            if red['phase']!='red' or red['classification']!='assertion_red' or test['test_id'] not in red['targets']: continue
            green=next((r for r in candidates if r['phase']=='green' and r['cycle']==red['cycle'] and r['classification']=='passed' and
                r['started_at']>red['finished_at'] and r['source_after']!=red['source_before'] and test['test_id'] in r['targets'] and
                r['tests_after'].get(test['file'])==red['tests_before'].get(test['file'])==test['file_hash']),None)
            if not green: continue
            regression=next((r for r in candidates if r['phase']=='refactor' and r['cycle']==red['cycle'] and r['classification']=='passed' and
                r['started_at']>green['finished_at'] and r['source_before']!=green['source_after'] and
                r['tests_after'].get(test['file'])==test['file_hash'] and test['test_id'] in r['targets']),None)
            final=next((r for r in runs if r['phase']=='final' and r['classification']=='passed' and r['started_at']>green['finished_at'] and
                r.get('refactor_reason','') and r['tests_after'].get(test['file'])==test['file_hash'] and any(t['test_id']==test['test_id'] and t['status']=='passed' for t in r['results'])),None)
            required=required_by_test.get(test['test_id'],[])
            if (regression or final) and all(i in red['requirements'] and i in green['requirements'] for i in required):
                entry.update(status='complete',red=red['id'],green=green['id'],refactor=(regression or final)['id'],
                             reason=final['refactor_reason'] if not regression else None);break
        items.append(entry)
    return {'status':'assessed','complete':sum(i['status']=='complete' for i in items),'applicable':len(items),'items':items}
