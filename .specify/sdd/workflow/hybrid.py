"""Read-only native task selection and optional hybrid task evaluation."""
from datetime import date
from graphlib import CycleError, TopologicalSorter
import hashlib
import json
from pathlib import Path
import re
import subprocess


RESULT_VERSION = 2
HEADER = re.compile(r'<!-- repo-sdd:hybrid-tasks:v1(?: (.*?))? -->')
HEADING = re.compile(r'^ {0,3}(#{1,6})[ \t]+(.+?)\s*$')
TASK = re.compile(r'^([ \t]*)[-*+]\s+\[([ xX])\]\s+(.*)$')
IDENT = re.compile(r'^(T\d+|\d+(?:\.\d+)+|[A-Z]+-\d+)\s+')
FIELD = re.compile(r'^\s*(?:[-*+]\s+)?([^:：]+)[:：]\s*(.*?)\s*$')
FENCE = re.compile(r'^\s*(`{3,}|~{3,})(.*)$')
TYPES = {'DEVELOPMENT', 'AUTOMATED_TEST', 'MANUAL_TEST', 'REVIEW', 'ACCEPTANCE', 'OTHER'}
FIELD_ALIASES = {
    '类型': 'type', '依赖': 'dependencies', '负责人': 'owner', '环境': 'environment',
    '原因': 'reason', '步骤': 'steps', '预期': 'expected', '证据': 'evidence',
    '发布必需': 'required for release', '最终验收': 'final acceptance',
    '阻塞原因': 'blocked reason', '关联任务': 'related to', '执行人': 'tester',
    '执行日期': 'execution date', '结果': 'result', '复核修订': 'reviewed revision',
    '实施复核': 'implementation review', '问题编号': 'issue', '结果证据': 'result evidence',
    '实际环境': 'actual environment', '复现步骤': 'reproduction',
    '延期批准人': 'deferred by', '延期截止日期': 'deferred until', '延期原因': 'deferral reason',
}
TYPE_ALIASES = {
    '开发': 'DEVELOPMENT', '自动化测试': 'AUTOMATED_TEST', '人工测试': 'MANUAL_TEST',
    '评审': 'REVIEW', '验收': 'ACCEPTANCE', '其他': 'OTHER',
}
BOOLEAN_ALIASES = {'是': 'true', '否': 'false'}
RECORD = {'tester', 'execution date', 'result', 'reviewed revision', 'implementation review',
          'issue', 'result evidence', 'actual environment', 'reproduction', 'deferred by',
          'deferred until', 'deferral reason'}


def _parse(text):
    tasks, issues = [], []
    lines = text.splitlines(keepends=True)
    normalized = lines.copy()
    fence = current = None
    headings, ancestors = [], []
    enabled = False
    header_seen = False
    for index, line in enumerate(lines):
        line = line.lstrip('\ufeff')
        marker = FENCE.match(line)
        if fence:
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence) and not marker[2].strip():
                fence = None
            continue
        if marker:
            fence = marker[1]
            current = None
            continue
        header = HEADER.fullmatch(line.strip())
        if header:
            try:
                options = json.loads(header[1]) if header[1] else {}
                if header_seen or not isinstance(options, dict) or set(options) - {'enabled'} or type(options.get('enabled', True)) is not bool:
                    raise ValueError
                enabled = options.get('enabled', True)
            except ValueError:
                issues.append('Invalid hybrid task header')
            header_seen = True
            continue
        heading = HEADING.match(line)
        if heading:
            level = len(heading[1])
            title = re.sub(r'\s+#+\s*$', '', heading[2]).strip()
            while ancestors and ancestors[-1]['level'] >= level:
                ancestors.pop()
            current_heading = dict(title=title, line=index + 1, level=level,
                                   path=[item['title'] for item in ancestors] + [title])
            headings.append(current_heading)
            ancestors.append(current_heading)
            current = None
        match = TASK.match(line)
        if match:
            indent, checkbox, title = match.groups()
            ident = IDENT.match(title)
            task_id = ident[1] if ident else f'line:{index + 1}'
            title = title[ident.end():] if ident else title
            labels = []
            while label := re.match(r'^\[([^\]]+)\]\s*', title):
                raw_label = label[1].upper()
                labels.append({'人工': 'MANUAL', '测试': 'TEST'}.get(raw_label, raw_label))
                title = title[label.end():]
            current = dict(id=task_id, checked=checkbox.lower() == 'x', labels=labels, title=title,
                           phase=ancestors[-1]['title'] if ancestors else '',
                           phases=[dict(item) for item in ancestors], fields={}, line=index + 1,
                           indent=len(indent))
            tasks.append(current)
            if current['checked'] and 'MANUAL' in labels:
                normalized[index] = re.sub(r'(?<=\[)[xX](?=\])', ' ', lines[index], count=1)
            continue
        if current and line.strip():
            if len(line) - len(line.lstrip(' \t')) <= current['indent']:
                current = None
                continue
            field = FIELD.fullmatch(line.rstrip('\r\n'))
            if field:
                key, value = field[1].strip().casefold(), field[2]
                key = FIELD_ALIASES.get(key, key)
                if key in current['fields']:
                    issues.append(f"{current['id']}: duplicate field {key}")
                current['fields'][key] = value
                if key in RECORD:
                    normalized[index] = ''
    return enabled, tasks, issues, ''.join(normalized), header_seen, headings


def definition_text(text):
    return _parse(text)[3]


def configured(text):
    return _parse(text)[4]


def _date(value):
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _present(fields, *keys):
    return all(fields.get(key, '').strip().casefold() not in {'', '-', 'tbd', 'todo', '待填写', '待定'} for key in keys)


def analyze(text, *, task_ids=(), story=None, phase=None, revision=None):
    enabled, tasks, issues, _, _, headings = _parse(text)
    by_id = {}
    for task in tasks:
        ident, labels, fields = task['id'], set(task['labels']), task['fields']
        if ident in by_id:
            issues.append(f'{ident}: duplicate task ID')
        by_id[ident] = task
        dependencies = re.split(r'[,，\s]+', fields['dependencies'].strip()) if fields.get('dependencies') else []
        if not enabled:
            # Native files use checkbox completion. Labels or free text alone
            # must not silently enable handoff, approval or deferral semantics.
            task.update(executor='AI', type='OTHER', dependencies=dependencies,
                        failed=False, stale=False, deferred=False, final_acceptance=False,
                        recorded_pass=False)
            continue
        human = 'MANUAL' in labels
        kinds = labels & TYPES
        declared = fields.get('type', '').upper()
        declared = TYPE_ALIASES.get(declared, declared)
        kind = declared or next(iter(sorted(kinds)), 'MANUAL_TEST' if human and 'TEST' in labels else 'OTHER')
        if {'MANUAL', 'AI'} <= labels or len(kinds) > 1 or kind not in TYPES or (kinds and kind not in kinds):
            issues.append(f'{ident}: conflicting executor or type')
        if (human and kind in {'DEVELOPMENT', 'AUTOMATED_TEST'}) or (not human and kind == 'MANUAL_TEST'):
            issues.append(f'{ident}: executor does not match type')
        release = fields.get('required for release', 'true').lower()
        final = fields.get('final acceptance', 'false').lower()
        release = BOOLEAN_ALIASES.get(release, release)
        final = BOOLEAN_ALIASES.get(final, final)
        if release not in {'true', 'false'} or final not in {'true', 'false'}:
            issues.append(f'{ident}: release and final acceptance fields require true or false')
        if final == 'true' and (not human or kind not in {'REVIEW', 'ACCEPTANCE'} or release != 'true'):
            issues.append(f'{ident}: final acceptance must be a required manual review or acceptance')
        if human and (not IDENT.match(ident + ' ') or not _present(fields, 'owner', 'environment', 'reason', 'steps', 'expected', 'evidence')):
            issues.append(f'{ident}: manual task needs an ID and complete handoff instructions')
        result = fields.get('result', '').lower()
        failed = human and result in {'fail', 'failed', '失败', '未通过'}
        recorded = (human and task['checked'] and result in {'pass', 'passed', '通过'}
                    and _present(fields, 'tester', 'environment', 'evidence')
                    and _date(fields.get('execution date', '')) is not None)
        reviewed = fields.get('reviewed revision')
        stale = bool(recorded and ((final == 'true' and not reviewed) or (reviewed and reviewed != revision)))
        deferred_until = _date(fields.get('deferred until', ''))
        deferred = (release == 'false' and not failed and _present(fields, 'deferred by', 'deferral reason')
                    and deferred_until is not None and deferred_until >= date.today())
        task.update(executor='MANUAL' if human else 'AI', type=kind, dependencies=dependencies,
                    failed=failed, stale=stale, deferred=deferred, final_acceptance=final == 'true',
                    recorded_pass=bool(recorded and not stale))

    for ident, task in by_id.items():
        for dep in task['dependencies']:
            if dep == ident or dep not in by_id:
                issues.append(f'{ident}: invalid dependency {dep}')
    graph = {ident: task['dependencies'] for ident, task in by_id.items()}
    try:
        order = list(TopologicalSorter(graph).static_order())
    except CycleError:
        issues.append('Cyclic task dependencies')
        order = []
    complete = set()
    for ident in order:
        if ident not in by_id:
            continue
        task = by_id[ident]
        if (task['recorded_pass'] if task['executor'] == 'MANUAL' else task['checked'] and not task['fields'].get('blocked reason')):
            if set(task['dependencies']) <= complete:
                complete.add(ident)
            else:
                issues.append(f'{ident}: completed with unfinished dependencies')

    ai = [task for task in tasks if task['executor'] == 'AI']
    manual = [task for task in tasks if task['executor'] == 'MANUAL']
    remaining = [task for task in ai if task['id'] not in complete]
    pending = [task for task in manual if task['id'] not in complete]
    # Scope is determined from all tasks, not only the unfinished AI tasks.
    # Thus an already completed or exclusively manual batch remains selectable.
    ids = set(task_ids)
    unknown_selection = ids - by_id.keys()
    scope_issues = []
    if unknown_selection:
        scope_issues.append('Unknown selected tasks: ' + ', '.join(sorted(unknown_selection)))
    phase_candidates = [item for item in headings if phase is not None and item['title'].casefold() == phase.casefold()]
    phase_line = phase_candidates[0]['line'] if len(phase_candidates) == 1 else None
    if phase is not None:
        if len(phase_candidates) > 1:
            locations = ', '.join(f"{' / '.join(item['path'])} (line {item['line']})" for item in phase_candidates)
            scope_issues.append('Ambiguous phase; select explicit --task-id values: ' + locations)
        elif not phase_candidates:
            scope_issues.append('Unknown selected phase: ' + phase)
    if story is not None and not story.strip():
        scope_issues.append('Selected story must not be empty')
    selected = [task for task in tasks if (not ids or task['id'] in ids)
                and (story is None or story.upper() in task['labels'])
                and (phase is None or any(item['line'] == phase_line for item in task['phases']))]
    if scope_issues:
        selected = []
    if not selected and not scope_issues:
        scope_issues.append('No tasks match the requested scope')
    batch_remaining = [task for task in selected if task['executor'] == 'AI' and task['id'] not in complete]
    batch_pending = [task for task in selected if task['executor'] == 'MANUAL' and task['id'] not in complete]
    ready, blocked = [], []
    for task in selected:
        if task['id'] in complete:
            continue
        unmet = [dep for dep in task['dependencies'] if dep not in complete]
        reason = task['fields'].get('blocked reason', '')
        if unmet or reason:
            blocked.append(dict(id=task['id'], dependencies=unmet, reason=reason))
        elif task['executor'] == 'AI' and not issues and not scope_issues:
            ready.append(task['id'])

    implemented = bool(tasks) and not remaining and not issues
    final_checks = [task for task in manual if task['final_acceptance']]
    reviewed = enabled and any(task['id'] in complete and task['fields'].get('implementation review', '').lower() in {'passed', '通过'}
                   and revision and task['fields'].get('reviewed revision') == revision for task in tasks)
    finalized = bool(implemented and not pending and reviewed)
    if any(task['failed'] for task in manual):
        state = 'QA_FAILED'
    elif not tasks:
        state = 'PLANNING'
    elif remaining and (issues or any(task['fields'].get('blocked reason') or set(task['dependencies']) <= complete for task in remaining)):
        state = 'IMPLEMENTING'
    elif any(not task['final_acceptance'] for task in pending):
        state = 'PENDING_MANUAL_QA'
    elif implemented:
        state = 'FINALIZED' if finalized else 'PENDING_FINAL_VERIFICATION'
    else:
        state = 'IMPLEMENTING'
    # Selection errors affect this batch, not a feature's previously evaluated
    # global lifecycle. Structural/dependency issues invalidate both.
    all_issues = issues + scope_issues
    batch_ai_complete = bool(selected) and not batch_remaining and not all_issues
    batch_complete = batch_ai_complete and not batch_pending
    if all_issues:
        batch_status = 'invalid'
    elif ready:
        batch_status = 'ready'
    elif batch_remaining:
        batch_status = 'blocked'
    elif batch_pending:
        batch_status = 'pending_manual'
    else:
        batch_status = 'complete'
    return dict(result_version=RESULT_VERSION, enabled=enabled, tasks=tasks, issues=all_issues,
                selected_tasks=[task['id'] for task in selected], phase_candidates=phase_candidates,
                ready_ai=ready, blocked=blocked,
                batch_completed_ai=[task['id'] for task in selected if task['executor'] == 'AI' and task['id'] in complete],
                batch_remaining_ai=[task['id'] for task in batch_remaining],
                batch_pending_manual=[task['id'] for task in batch_pending],
                batch_ai_complete=batch_ai_complete, batch_status=batch_status,
                completed_ai=[task['id'] for task in ai if task['id'] in complete],
                remaining_ai=[task['id'] for task in remaining], pending_manual=[task['id'] for task in pending],
                execution_batch_complete=batch_complete,
                implementation_complete=implemented, implementation_review_recorded=bool(reviewed),
                final_acceptance_tasks=[task['id'] for task in final_checks],
                final_qa_completed=not pending and not issues,
                release_tasks_satisfied=implemented and all(task['deferred'] for task in pending),
                feature_state=state, finalized=finalized, revision=revision, verification='unverified')


def inspect_file(root, path, **selection):
    root = Path(root).resolve()
    path = (root / path).resolve()
    relative = path.relative_to(root).as_posix()
    text = path.read_bytes().decode('utf-8')
    revision = None
    revision_issue = None
    # Include staged, tracked and nonignored working-tree files. Ignore task
    # execution records only in the inspected task list. Do not copy sources.
    try:
        top = subprocess.check_output(['git', '-C', str(root), 'rev-parse', '--show-toplevel'], stderr=subprocess.PIPE, timeout=15)
        if Path(top.decode('utf-8').strip()).resolve() != root:
            raise ValueError('Git root differs from the selected repository')
        paths = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], stderr=subprocess.PIPE, timeout=30)
        digest = hashlib.sha256(definition_text(text).encode('utf-8'))
        for name in sorted(set(paths.decode('utf-8').split('\0')) - {'', relative}):
            # The optional runtime record is updated by transition/finish itself.
            if name.endswith('/work-item.json') and name.startswith(('.specify/', 'openspec/')):
                continue
            file = root / name
            if not file.resolve().is_relative_to(root) or file.is_symlink() or (file.exists() and not file.is_file()):
                raise ValueError('Unsupported file for revision check: ' + name)
            digest.update(name.encode('utf-8') + b'\0')
            if file.is_file():
                content = hashlib.sha256()
                with file.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                        content.update(chunk)
                digest.update(content.digest())
            digest.update(b'\0')
        revision = digest.hexdigest()
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        revision_issue = str(exc)
    return dict(analyze(text, revision=revision, **selection), revision_issue=revision_issue)
