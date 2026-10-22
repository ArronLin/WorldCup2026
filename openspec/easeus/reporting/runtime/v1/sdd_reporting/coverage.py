"""Only standardized executable lines and declared mappings enter this core."""
from difflib import SequenceMatcher
from decimal import Decimal
from .contracts import *

def added_lines(before,after):
    a=before.replace('\r\n','\n').splitlines();b=after.replace('\r\n','\n').splitlines()
    return [n+1 for tag,_,__,start,end in SequenceMatcher(None,a,b,autojunk=False).get_opcodes()
            if tag in {'insert','replace'} for n in range(start,end)]

def validate_coverage(value,inventory,sources,run,source_fingerprint):
    validate(value,'coverage')
    require(value['run_id']==run and value['source_fingerprint']==source_fingerprint,'覆盖率与当前运行/源码清单不匹配',1)
    records={}
    for item in value['files']:
        name=item['path'];require(name not in records,'覆盖率文件路径重复：'+name)
        require(name in inventory and item['source_hash']==inventory[name],'覆盖率源文件哈希不匹配：'+name,1)
        count=len(sources[name].splitlines())
        executable=item['executable_lines'];hits=item['hit_lines']
        require(len(set(executable))==len(executable) and len(set(hits))==len(hits),'行清单重复：'+name)
        require(set(hits)<=set(executable),'命中行不是可执行行：'+name)
        require(all(1<=n<=count for n in executable),'覆盖率源映射越界：'+name)
        mapping=item.get('source_mapping')
        if mapping:
            require({'version','kind','ranges'}<=set(mapping)<={'version','kind','ranges','baseline_path'} and mapping['version']==1 and mapping['kind']=='statement-ranges','源映射接口不支持：'+name)
            require('baseline_path' not in mapping or mapping['baseline_path'] is None or isinstance(mapping['baseline_path'],str),'基线身份格式错误：'+name)
            for span in mapping['ranges']:
                require(set(span)=={'start','end','executable_line'} and all(type(n) is int for n in span.values()) and
                    1<=span['start']<=span['end']<=count and span['executable_line'] in executable,'语句映射越界：'+name)
        records[name]=item
    require(set(records)==set(inventory),'缺少完整生产代码可执行行信息：'+', '.join(sorted(set(inventory)-set(records))),1)
    return records

def audit(value,inventory,current,baseline,run,threshold):
    records=validate_coverage(value,inventory,current,run,fingerprint(inventory));rows=[]
    removed={p:sha(s) for p,s in baseline.items() if p not in current}
    for name,source in current.items():
        old=baseline.get(name,'');renamed=None
        if name not in baseline:
            candidates=[p for p,h in removed.items() if h==sha(source)]
            if len(candidates)==1: renamed=candidates[0];old=baseline[renamed]
            else:
                mapping=records[name].get('source_mapping',{})
                if 'baseline_path' in mapping:
                    original=mapping['baseline_path']
                    if original is not None:
                        require(original in baseline and original not in current,'声明的基线身份不存在或仍被其他文件使用：'+name,1)
                        renamed=original;old=baseline[original]
                else:
                    require(not removed,'新增与删除文件同时存在，需由适配器明确基线身份 baseline_path，避免改名代码抬高覆盖率：'+name,1)
        changed=added_lines(old,source);record=records[name]
        added=set(changed)&set(record['executable_lines'])
        for span in record.get('source_mapping',{}).get('ranges',[]):
            if any(span['start']<=n<=span['end'] for n in changed): added.add(span['executable_line'])
        covered=added&set(record['hit_lines'])
        rows.append({'path':name,'source':source,'source_hash':inventory[name],'renamed_from':renamed,
            'changed_lines':changed,'added_lines':sorted(added),'covered_lines':sorted(covered),'C':len(covered),'D':len(added)})
    C=sum(r['C'] for r in rows);D=sum(r['D'] for r in rows)
    return {'schema_version':1,'provider':value['provider'],'definition':'提供方声明的可执行行；可选 v1 statement-ranges 映射多行改动',
        'C':C,'D':D,'ratio':C/D if D else None,'threshold':threshold,'not_applicable':D==0,
        'passed':D==0 or threshold is None or Decimal(C)>=Decimal(D)*Decimal(str(threshold)),'files':rows,'source_fingerprint':fingerprint(inventory),'run_id':run}
