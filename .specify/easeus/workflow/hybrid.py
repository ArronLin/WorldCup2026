"""Read-only evaluation of the optional task convention in native Markdown."""
from datetime import date
from graphlib import CycleError, TopologicalSorter
import hashlib
import json
from pathlib import Path
import re
import subprocess


HEADER = re.compile(r'<!-- repo-sdd:hybrid-tasks:v1(?: (.*?))? -->')
TASK = re.compile(r'^([ \t]*)[-*+]\s+\[([ xX])\]\s+(.*)$')
IDENT = re.compile(r'^(T\d+|\d+(?:\.\d+)+|[A-Z]+-\d+)\s+')
FIELD = re.compile(r'^\s*(?:[-*+]\s+)?([^:：]+)[:：]\s*(.*?)\s*$')
FENCE = re.compile(r'^\s*(`{3,}|~{3,})(.*)$')
TYPES = {'DEVELOPMENT', 'AUTOMATED_TEST', 'MANUAL_TEST', 'REVIEW', 'ACCEPTANCE', 'OTHER'}
RECORD = {'tester', 'execution date', 'result', 'reviewed revision', 'implementation review',
          'issue', 'result evidence', 'actual environment', 'reproduction', 'deferred by',
          'deferred until', 'deferral reason'}


def _parse(text):
    tasks, issues = [], []
    lines = text.splitlines(keepends=True)
    normalized = lines.copy()
    fence = current = None
    phase = ''
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
        if re.match(r'^#{1,6}\s', line):
            phase = line.strip().lstrip('#').strip()
            current = None
        match = TASK.match(line)
        if match:
            indent, checkbox, title = match.groups()
            ident = IDENT.match(title)
            task_id = ident[1] if ident else f'line:{index + 1}'
            title = title[ident.end():] if ident else title
            labels = []
            while label := re.match(r'^\[([^\]]+)\]\s*', title):
                labels.append(label[1].upper())
                title = title[label.end():]
            current = dict(id=task_id, checked=checkbox.lower() == 'x', labels=labels, title=title,
                           phase=phase, fields={}, line=index + 1, indent=len(indent))
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
                if key in current['fields']:
                    issues.append(f"{current['id']}: duplicate field {key}")
                current['fields'][key] = value
                if key in RECORD:
                    normalized[index] = ''
    return enabled, tasks, issues, ''.join(normalized), header_seen


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
    enabled, tasks, issues, _, _ = _parse(text)
    if not enabled and not issues:
        remaining = [task['id'] for task in tasks if not task['checked']]
        return dict(enabled=False, tasks=tasks, issues=[], remaining_ai=remaining, ready_ai=remaining,
                    blocked=[], pending_manual=[], execution_batch_complete=bool(tasks) and not remaining,
                    implementation_complete=bool(tasks) and not remaining, finalized=False)
    by_id = {}
    for task in tasks:
        ident, labels, fields = task['id'], set(task['labels']), task['fields']
        if ident in by_id:
            issues.append(f'{ident}: duplicate task ID')
        by_id[ident] = task
        human = 'MANUAL' in labels
        kinds = labels & TYPES
        declared = fields.get('type', '').upper()
        kind = declared or next(iter(sorted(kinds)), 'MANUAL_TEST' if human and 'TEST' in labels else 'OTHER')
        if {'MANUAL', 'AI'} <= labels or len(kinds) > 1 or kind not in TYPES or (kinds and kind not in kinds):
            issues.append(f'{ident}: conflicting executor or type')
        if (human and kind in {'DEVELOPMENT', 'AUTOMATED_TEST'}) or (not human and kind == 'MANUAL_TEST'):
            issues.append(f'{ident}: executor does not match type')
        dependencies = re.split(r'[,，\s]+', fields['dependencies'].strip()) if fields.get('dependencies') else []
        release = fields.get('required for release', 'true').lower()
        final = fields.get('final acceptance', 'false').lower()
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
    unknown_selection = set(task_ids) - by_id.keys()
    if unknown_selection:
        issues.append('Unknown selected tasks: ' + ', '.join(sorted(unknown_selection)))
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
    selected = [task for task in remaining if (not task_ids or task['id'] in task_ids)
                and (not story or story.upper() in task['labels'])
                and (not phase or phase.casefold() == task['phase'].casefold())]
    if (story or phase) and not any((not story or story.upper() in task['labels'])
                                    and (not phase or phase.casefold() == task['phase'].casefold()) for task in tasks):
        issues.append('No tasks match the requested story or phase')
    ready, blocked = [], []
    for task in selected:
        unmet = [dep for dep in task['dependencies'] if dep not in complete]
        reason = task['fields'].get('blocked reason', '')
        if unmet or reason:
            blocked.append(dict(id=task['id'], dependencies=unmet, reason=reason))
        elif not issues:
            ready.append(task['id'])

    implemented = bool(tasks) and not remaining and not issues
    final_checks = [task for task in manual if task['final_acceptance']]
    reviewed = any(task['id'] in complete and task['fields'].get('implementation review', '').lower() == 'passed'
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
    return dict(enabled=enabled, tasks=tasks, issues=issues, ready_ai=ready, blocked=blocked,
                completed_ai=[task['id'] for task in ai if task['id'] in complete],
                remaining_ai=[task['id'] for task in remaining], pending_manual=[task['id'] for task in pending],
                execution_batch_complete=bool(tasks) and not ready and not issues,
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
