#!/usr/bin/env python3
"""Portable project setup for easeus-sdd. Python 3.11+, standard library only."""
from __future__ import annotations
import argparse
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib
from urllib.parse import parse_qsl, urlsplit

ID = "easeus-sdd"
VERSION = "1.8.0"
PACK = Path(__file__).resolve().parent.parent
CONFIG = Path(".specify/easeus.json")
STAGES = ("constitution", "specify", "clarify", "plan", "checklist",
          "tasks", "analyze", "implement", "converge")
MARKER = "<!-- easeus-sdd:policy:v1 -->"
START = "<!-- EASEUS_SDD:START -->"
END = "<!-- EASEUS_SDD:END -->"
AGENT_BLOCK = START + """
## 双底座 SDD 项目约定
- 在 Spec Kit 各阶段读取 .specify/easeus.json，
  以及 .specify/presets/easeus-sdd/policies/common.md。
- 语言及工程要求读取 .specify/easeus/requirements.json；Wiki 提供背景，理解/定位代码先用有效 CodeGraph，
  再核实当前源码，关键结论记录适用版本。
- 遵守启用规则的参数；未验证的任务不宣称完成。
- 不初始化 Git；阶段写入范围与授权以有效工作流为准。
- 预设缺失时说明设置不完整，不读取不存在文件或臆造执行结果。
""" + END
CLAUDE_BLOCK = START + """
@AGENTS.md
<!-- 共享指令由上方导入；保留本文件其他 Claude 专用内容。 -->
""" + END


class SetupError(Exception):
    pass


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise SetupError(f"无法读取 JSON：{path}（{type(exc).__name__}）") from exc


def json_text(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def project_path(value):
    root = Path(value).expanduser().resolve()
    if not root.is_dir():
        raise SetupError("项目目录不存在；请先提供正确的已有项目路径。")
    if not (root / ".specify").is_dir():
        raise SetupError("尚无 .specify。先按 README 使用 specify init 初始化；本工具不自动初始化。")
    return root


def contained(root: Path, relative: Path | str):
    path = root / relative
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        raise SetupError(f"拒绝写入项目以外的解析路径：{relative}")
    return path


def deep_merge(base, patch):
    if not isinstance(base, dict) or not isinstance(patch, dict):
        raise SetupError("配置与配置补丁都必须为 JSON 对象。")
    result = copy.deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def effective_policy(root):
    path = root / '.specify/easeus/requirements.json'
    value = load_json(path if path.is_file() else PACK / 'policies/requirements.json')
    rules = {r['kind']: r for r in value['rules'] if r['enabled']}
    return {'language': rules.get('language', {}).get('parameters', {}).get('language'),
            'tdd_required': 'tdd' in rules,
            'new_unit_line_coverage_minimum': rules['coverage']['parameters']['minimum_percent'] / 100 if 'coverage' in rules else None}


def defaults(root):
    return {
        "schema_version": 1,
        "project": {"path": str(root), "repository_id": root.name, "source_snapshot": "unknown"},
        "sources": {
            "codegraph": {"access": "unknown", "index_path": "", "snapshot": "unknown",
                          "server_name": "codegraph", "mcp": None},
            "opendeepwiki": {"access": "unknown", "location": "", "snapshot": "unknown",
                            "server_name": "opendeepwiki", "mcp": None},
        },
        "verification": {"new_code_baseline": "unknown", "known_commands": []},
        "policy": effective_policy(root),
    }


def url_check(value):
    if not isinstance(value, str):
        raise SetupError("MCP url 必须为字符串。")
    try:
        url = urlsplit(value)
        bad = (url.scheme not in ("http", "https") or not url.netloc
               or url.username is not None or url.password is not None)
    except ValueError as exc:
        raise SetupError("MCP url 无效。") from exc
    if bad:
        raise SetupError("MCP URL 必须为 HTTP(S)，不得内嵌用户名或密码。")
    if any(re.search(r"token|secret|password|api.?key", key, re.I)
           for key, _ in parse_qsl(url.query)):
        raise SetupError("不要将认证秘密放入 URL；使用认证环境变量或服务的 OAuth。")


def validate_config(data, root):
    try:
        if data["schema_version"] != 1:
            raise SetupError("不支持的项目配置 schema_version。")
        if data["project"]["path"] != "." and Path(data["project"]["path"]).resolve() != root:
            raise SetupError("配置的 project.path 与本次 --project 不一致；请重新 configure。")
        if not isinstance(data["project"]["repository_id"], str) or not data["project"]["repository_id"].strip():
            raise SetupError("repository_id 必须为非空字符串。")
        if not isinstance(data["project"]["source_snapshot"], str):
            raise SetupError("source_snapshot 必须为字符串。")
        for key in ("codegraph", "opendeepwiki"):
            source = data["sources"][key]
            if not isinstance(source, dict) or not isinstance(source["access"], str):
                raise SetupError(f"{key}.access 必须为文字访问说明。")
            if not isinstance(source["snapshot"], str):
                raise SetupError(f"{key}.snapshot 必须为字符串。")
            for field in ("index_path",) if key == "codegraph" else ("location",):
                if not isinstance(source[field], str):
                    raise SetupError(f"{key}.{field} 必须为字符串。")
            name = source["server_name"]
            if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                raise SetupError("MCP server_name 仅使用字母、数字、下划线与短横线。")
            mcp = source.get("mcp")
            if mcp is None:
                continue
            if not isinstance(mcp, dict):
                raise SetupError("mcp 必须为对象或 null。")
            allowed = {"transport", "url", "command", "args", "bearer_token_env_var"}
            if set(mcp) - allowed:
                raise SetupError("MCP 配置含未支持字段；不接受明文密钥或任意 env/headers。")
            if mcp.get("transport") == "http":
                url_check(mcp.get("url"))
                if "command" in mcp or "args" in mcp:
                    raise SetupError("HTTP 配置不能同时设置 stdio 命令。")
                env = mcp.get("bearer_token_env_var")
                if env and not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", env):
                    raise SetupError("认证环境变量名称无效。")
            elif mcp.get("transport") == "stdio":
                if not isinstance(mcp.get("command"), str) or not mcp["command"].strip():
                    raise SetupError("stdio 需要真实可执行命令。")
                if not isinstance(mcp.get("args", []), list) or not all(
                        isinstance(x, str) for x in mcp.get("args", [])):
                    raise SetupError("stdio args 必须是字符串数组。")
                if "url" in mcp or "bearer_token_env_var" in mcp:
                    raise SetupError("stdio 配置不接受 HTTP 字段。")
            else:
                raise SetupError("MCP transport 仅支持 http / stdio。")
        if data["sources"]["codegraph"]["server_name"] == data["sources"]["opendeepwiki"]["server_name"] and data["sources"]["codegraph"]["server_name"] != "speckit_wizard":
            raise SetupError("两个底座须使用不同的 MCP server_name。")
        policy = data["policy"]
        minimum = policy.get('new_unit_line_coverage_minimum')
        if minimum is not None and (isinstance(minimum, bool) or not isinstance(minimum, (float, int)) or not 0 <= minimum <= 1):
            raise SetupError('新增代码覆盖率参数必须为 0–1 或 null。')
        commands = data["verification"]["known_commands"]
        if not isinstance(commands, list) or not all(isinstance(x, str) for x in commands):
            raise SetupError("known_commands 必须为字符串数组；本工具不会执行其中的内容。")
    except (KeyError, TypeError, AttributeError) as exc:
        raise SetupError("项目配置缺少必需字段或字段类型错误。") from exc


def configured(root):
    data = load_json(contained(root, CONFIG))
    validate_config(data, root)
    return data


def block_merge(old, block):
    if old.count(START) != old.count(END) or old.count(START) > 1:
        raise SetupError("项目指令中的预设标记损坏或重复；请先人工检查，未覆盖文件。")
    if START in old:
        start, end = old.index(START), old.index(END)
        if end < start:
            raise SetupError("项目指令的预设标记顺序错误。")
        return old[:start] + block + old[end + len(END):]
    return old.rstrip() + ("\n\n" if old.strip() else "") + block + "\n"


def mcp_values(data):
    claude, codex = {}, {}
    for key in ("codegraph", "opendeepwiki"):
        source = data["sources"][key]
        m = source.get("mcp")
        if not m:
            continue
        name = source["server_name"]
        if m["transport"] == "http":
            c, x = {"type": "http", "url": m["url"]}, {"url": m["url"]}
            if m.get("bearer_token_env_var"):
                env = m["bearer_token_env_var"]
                c["headers"] = {"Authorization": "Bearer $" + "{" + env + "}"}
                x["bearer_token_env_var"] = env
        else:
            c = {"type": "stdio", "command": m["command"], "args": m.get("args", [])}
            x = {"command": m["command"], "args": m.get("args", [])}
        claude[name], codex[name] = c, x
    return claude, codex


def toml_snippet(servers):
    # TOML basic strings accept JSON escaping for these supported scalar values.
    lines = []
    for name, server in servers.items():
        lines += ["[mcp_servers." + json.dumps(name) + "]"]
        lines += [key + " = " + json.dumps(value, ensure_ascii=False)
                  for key, value in server.items()]
        lines += [""]
    return "\n".join(lines)


def mcp_plan(root, data, write_actual):
    claude, codex = mcp_values(data)
    if not claude:
        if write_actual:
            raise SetupError("--write-mcp 需要 settings 中提供真实 MCP transport/URL/命令。")
        return {}
    files = {
        Path(".specify/easeus/mcp/claude.example.json"): json_text({"mcpServers": claude}),
        Path(".specify/easeus/mcp/codex.example.toml"): toml_snippet(codex),
    }
    if not write_actual:
        return files
    cp = contained(root, ".mcp.json")
    current = load_json(cp) if cp.exists() else {}
    if not isinstance(current, dict) or not isinstance(current.get("mcpServers", {}), dict):
        raise SetupError("已有 .mcp.json 结构无效；未覆盖。")
    current = copy.deepcopy(current)
    existing = current.setdefault("mcpServers", {})
    for name, value in claude.items():
        if name in existing and existing[name] != value:
            raise SetupError(f".mcp.json 已有不同配置的 {name}；未覆盖，请手动合并。")
        existing[name] = value
    files[Path(".mcp.json")] = json_text(current)
    tp = contained(root, ".codex/config.toml")
    old = tp.read_text(encoding="utf-8") if tp.exists() else ""
    try:
        parsed = tomllib.loads(old)
    except tomllib.TOMLDecodeError as exc:
        raise SetupError("已有 .codex/config.toml 无效；未覆盖。") from exc
    servers = parsed.get("mcp_servers", {})
    if not isinstance(servers, dict):
        raise SetupError("已有 mcp_servers 不是 TOML 表；未覆盖。")
    additions = {}
    for name, value in codex.items():
        if name in servers and servers[name] != value:
            raise SetupError(f"Codex 已有不同配置的 {name}；未覆盖，请手动合并。")
        if name not in servers:
            additions[name] = value
    files[Path(".codex/config.toml")] = (
        old.rstrip() + ("\n\n" if old.strip() else "") + toml_snippet(additions)
        if additions else old)
    return files


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=".sdd-write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def write_plan(root, plan, dry_run=False):
    """Preflight every path. Preserve changed files in a project-local backup."""
    changes = []
    for relative, text in plan.items():
        path = contained(root, relative)
        if path.exists() and not path.is_file():
            raise SetupError(f"目标不是普通文件：{relative}")
        old = path.read_bytes() if path.exists() else None
        if old == text.encode("utf-8"):
            continue
        changes.append((Path(relative), path, text, old))
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    for relative, path, text, old in changes:
        print(("计划写入：" if dry_run else "写入：") + str(relative))
        if dry_run:
            continue
        if old is not None:
            backup = contained(root, Path(".specify/easeus/backups") / stamp / relative)
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(old)
        atomic_write(path, text)
    return [str(x[0]) for x in changes]


def make_configuration(root, args):
    cp = contained(root, CONFIG)
    data = deep_merge(defaults(root), load_json(cp) if cp.exists() else {})
    if getattr(args, "settings", None):
        patch = load_json(Path(args.settings).expanduser().resolve())
        if not isinstance(patch, dict):
            raise SetupError("settings 必须为 JSON 对象。")
        data = deep_merge(data, patch)
    for key in ("project", "sources", "verification", "policy"):
        if not isinstance(data.get(key), dict):
            raise SetupError(f"配置中的 {key} 必须为对象。")
    for key in ("codegraph", "opendeepwiki"):
        if not isinstance(data["sources"].get(key), dict):
            raise SetupError(f"sources.{key} 必须为对象。")
    data["project"]["path"] = str(root)
    for arg, container, key in [
        ("repository_id", data["project"], "repository_id"),
        ("source_snapshot", data["project"], "source_snapshot"),
        ("codegraph_access", data["sources"]["codegraph"], "access"),
        ("codegraph_index", data["sources"]["codegraph"], "index_path"),
        ("codegraph_snapshot", data["sources"]["codegraph"], "snapshot"),
        ("wiki_access", data["sources"]["opendeepwiki"], "access"),
        ("wiki_location", data["sources"]["opendeepwiki"], "location"),
        ("wiki_snapshot", data["sources"]["opendeepwiki"], "snapshot"),
        ("baseline", data["verification"], "new_code_baseline"),
    ]:
        value = getattr(args, arg, None)
        if value is not None:
            container[key] = value
    validate_config(data, root)
    plan = {CONFIG: json_text(data)}
    agent_path, claude_path = contained(root, "AGENTS.md"), contained(root, "CLAUDE.md")
    old_agent = agent_path.read_text(encoding="utf-8-sig") if agent_path.exists() else ""
    old_claude = claude_path.read_text(encoding="utf-8-sig") if claude_path.exists() else ""
    plan[Path("AGENTS.md")] = block_merge(old_agent, AGENT_BLOCK)
    # Existing imports remain outside our managed block; avoid adding a duplicate.
    outside = re.sub(re.escape(START) + r".*?" + re.escape(END), "", old_claude, flags=re.S)
    cb = CLAUDE_BLOCK
    if re.search(r"(?m)^@AGENTS\.md\s*$", outside):
        cb = CLAUDE_BLOCK.replace("@AGENTS.md\n", "")
    plan[Path("CLAUDE.md")] = block_merge(old_claude, cb)
    ignore_path = contained(root, ".specify/easeus/.gitignore")
    old_ignore = ignore_path.read_text(encoding="utf-8") if ignore_path.exists() else ""
    additions = [pattern for pattern in ("/backups/", "/install-state.json")
                 if pattern not in old_ignore.splitlines()]
    if additions:
        plan[Path(".specify/easeus/.gitignore")] = (
            old_ignore.rstrip() + ("\n\n" if old_ignore.strip() else "")
            + "# easeus-sdd: machine-local backups/state\n"
            + "\n".join(additions) + "\n")
    plan.update(mcp_plan(root, data, getattr(args, "write_mcp", False)))
    return data, plan


def configure(args):
    root = project_path(args.project)
    data, plan = make_configuration(root, args)
    changed = write_plan(root, plan, args.dry_run)
    print(json_text({"configuration": str(root / CONFIG), "changes": len(changed),
                     "dry_run": args.dry_run, "mcp_connection_verified": False}))
    return 0


def specify_cmd(root, *arguments):
    executable = shutil.which("specify")
    if not executable:
        raise SetupError("找不到 specify CLI；先按 README 安装已验证版本。")
    result = subprocess.run([executable, *arguments], cwd=root, text=True,
                            encoding="utf-8", errors="replace", capture_output=True,
                            timeout=180)
    if result.returncode:
        # Avoid echoing configuration secrets. These invocations contain no credentials.
        raise SetupError("specify " + " ".join(arguments[:3]) + " 失败：\n"
                         + (result.stderr or result.stdout)[-5000:])
    return result.stdout


def require_cli(root):
    version = json.loads(specify_cmd(root, "version", "--json")).get("cli_version", "")
    match = re.fullmatch(r"1\.1\.(\d+)", version)
    if not ((match and int(match.group(1)) >= 3) or version == "1.2.0"):
        raise SetupError(f"当前 CLI {version!r} 不在已验证范围 1.1.3 或 1.2.0；不自动升级。")
    return version


def integration_info(root):
    path = contained(root, ".specify/integration.json")
    data = load_json(path)
    return data.get("installed_integrations", []), data.get(
        "default_integration", data.get("integration"))


def agent_list(value):
    return ["claude", "codex"] if value == "both" else [value]


def skill_paths(root, agent, stage):
    prefix = ".claude/skills" if agent == "claude" else ".agents/skills"
    return contained(root, Path(prefix) / ("speckit-" + stage) / "SKILL.md")


def materialization_issues(root, agents):
    issues = []
    for agent in agents:
        for stage in STAGES:
            path = skill_paths(root, agent, stage)
            if not path.is_file():
                issues.append(f"{agent}/{stage}：缺少实际 SKILL.md")
                continue
            content = path.read_text(encoding="utf-8")
            if MARKER not in content:
                issues.append(f"{agent}/{stage}：双底座政策未生效（可能被高优先级覆盖）")
            if "{CORE_TEMPLATE}" in content:
                issues.append(f"{agent}/{stage}：未完成核心模板组合")
            if "## User Input" not in content or "easeus-sdd:core:end" not in content:
                issues.append(f"{agent}/{stage}：缺少原工作流或组合边界")
    return issues


def install(args):
    root = project_path(args.project)
    require_cli(root)
    data, plan = make_configuration(root, args)  # All config conflicts before CLI mutations.
    wanted = agent_list(args.agents)
    if args.default_agent not in wanted:
        raise SetupError("--default-agent 必须包含在 --agents 中。")
    installed, original = integration_info(root)
    already = json.loads(specify_cmd(root, "preset", "list", "--json"))
    if any(item.get("id") == ID for item in already):
        raise SetupError("预设已安装。修改项目参数请 configure；升级先按 README 备份并卸载。")
    # CLI itself protects modified managed files and integration collisions; never use --force.
    for agent in wanted:
        if agent not in installed:
            opts = ["integration", "install", agent]
            if agent == "codex":
                opts += ['--integration-options=--skills']
            specify_cmd(root, *opts)
    with tempfile.TemporaryDirectory(prefix='easeus-preset-') as temp:
        staged = Path(temp) / ID
        shutil.copytree(PACK, staged)
        rules_path = root / '.specify/easeus/requirements.json'
        rules = load_json(rules_path if rules_path.is_file() else PACK / 'policies/requirements.json')
        texts = []
        for rule in rules['rules']:
            if rule['enabled']:
                text = rule['text']
                for key, value in rule.get('parameters', {}).items():
                    text = text.replace('{{' + key + '}}', str(value))
                texts.append(text)
        for path in staged.rglob('*.md'):
            path.write_text(path.read_text(encoding='utf-8').replace('{{EASEUS_RULES}}', '\n\n'.join(texts)), encoding='utf-8')
        specify_cmd(root, 'preset', 'add', '--dev', str(staged), '--priority', str(args.priority))
    specify_cmd(root, 'preset', 'enable', ID)
    # The CLI materializes commands only for the active integration.
    try:
        for agent in wanted:
            specify_cmd(root, "integration", "use", agent)
        issues = materialization_issues(root, wanted)
        if issues:
            raise SetupError("安装未完整生效；没有覆盖本地定制：\n" + "\n".join(issues))
    finally:
        # Explicit user-selected default; no force, no rewriting project metadata by hand.
        specify_cmd(root, "integration", "use", args.default_agent)
    # integration hooks may have changed project instructions; merge the latest content.
    data, plan = make_configuration(root, args)
    write_plan(root, plan)
    state = {"preset_version": VERSION, "tested_cli": require_cli(root),
             "previous_default": original, "agents": wanted, "default_agent": args.default_agent}
    write_plan(root, {Path(".specify/easeus/install-state.json"): json_text(state)})
    print("预设与两种所选集成已注册。尚未验证 MCP 连接、业务实现或测试结果。")
    return 0


def doctor(args):
    root = project_path(args.project)
    errors, warnings = [], []
    try:
        config = configured(root)
    except SetupError as exc:
        errors.append(str(exc)); config = None
    if not contained(root, f".specify/presets/{ID}/preset.yml").is_file():
        errors.append("预设尚未安装。")
    else:
        try:
            registry = load_json(contained(root, ".specify/presets/.registry"))
            registration = registry.get("presets", {}).get(ID)
            if not registration or registration.get("enabled") is not True:
                errors.append("预设未注册或已禁用，不能由旧命令残留认定生效。")
        except (SetupError, AttributeError):
            errors.append("无法确认预设注册状态。")
        errors += materialization_issues(root, agent_list(args.agents))
    for name in ("AGENTS.md", "CLAUDE.md"):
        path = contained(root, name)
        if not path.is_file() or START not in path.read_text(encoding="utf-8-sig"):
            errors.append(name + " 缺少共享规则锚点；重新 configure。")
    if config:
        for name, value in [("源码", config["project"]["source_snapshot"])] + [
                (name, source["snapshot"]) for name, source in config["sources"].items()]:
            if value.strip().lower() in ("", "unknown") or "<" in value:
                warnings.append(name + " 版本未知，不能宣称底座与当前源码一致。")
        for name, source in config["sources"].items():
            if source["access"].strip().lower() in ("", "unknown") or "填写" in source["access"]:
                warnings.append(name + " 访问方法未落实。")
        idx = config["sources"]["codegraph"]["index_path"]
        if idx and "<" not in idx:
            target = Path(idx).expanduser()
            target = target if target.is_absolute() else root / target
            if not target.exists():
                warnings.append("CodeGraph Index 路径当前不存在；不自动创建。")
        if not config["sources"]["opendeepwiki"]["location"]:
            warnings.append("Wiki location 未设置。")
    report = {"kind": "configuration-and-materialization-only",
              "errors": errors, "warnings": warnings,
              "mcp_connection_verified": False, "tests_verified": False,
              "semantic_correctness_verified": False}
    print(json_text(report))
    return 1 if errors or (args.strict_metadata and warnings) else 0


def context(args):
    root = project_path(args.project)
    config = configured(root)
    routes = {
        "constitution": "Wiki 理解背景，CodeGraph/源码核实工程约定；现状不自动成为规范。",
        "specify": "Wiki 优先了解术语/流程，按需 CodeGraph/源码核实影响需求的现状。",
        "clarify": "资料查事实，产品决定由用户确认。",
        "plan": "CodeGraph/源码为主核实接口与影响；Wiki 补背景。",
        "tasks": "复用有效计划，按需核实代码位置/测试入口。",
        "checklist": "检查需求质量，按主题使用底座。",
        "analyze": "以工作产物一致性为主，必要时核实事实；只读。",
        "implement": "当前源码及有效 Index 定位；真实测试与覆盖率验证。",
        "converge": "当前实现/运行证据决定差距，遵守有效命令的写入边界。",
    }
    print(json_text({"stage": args.stage, "route": routes[args.stage],
                     "configuration": config,
                     "note": "配置不是工具结果；本助手不执行 MCP、测试或构建。"}))
    return 0


def prompt_values(config, args):
    c, w = config["sources"]["codegraph"], config["sources"]["opendeepwiki"]
    return {"repo": config["project"]["path"], "repo_id": config["project"]["repository_id"],
            "cg": json.dumps(c, ensure_ascii=False),
            "wiki": json.dumps(w, ensure_ascii=False),
            "snapshot": "源码：" + config["project"]["source_snapshot"]
                        + "；Index：" + c["snapshot"] + "；Wiki：" + w["snapshot"],
            "feature": args.feature or "【本次功能】",
            "requirements": args.requirements or "【请填写用户需求】",
            "constraints": args.constraints or "【请填写明确约束与非目标】",
            "toolchain": "以项目现有配置与源码核实，不自行升级",
            "baseline": config["verification"]["new_code_baseline"],
            "verify": "\n".join(config["verification"]["known_commands"]) or "未知，先核实项目现有命令",
            "focus": args.focus or "当前阶段的适用完整范围",
            "command": ""}


def prompts(args):
    root = project_path(args.project)
    config = configured(root)
    stages = list(STAGES) + ["repair-tests", "handoff"] if args.stage == "all" else [args.stage]
    values = prompt_values(config, args)
    rendered = []
    for stage in stages:
        values["command"] = ("$" if args.agent == "codex" else "/") + "speckit-" + stage
        source = (PACK / "prompts" / (stage + ".md")).read_text(encoding="utf-8")
        text = re.sub(r"\{\{(\w+)\}\}", lambda m: values.get(m[1], "【" + m[1] + "】"), source)
        rendered.append("==== " + stage + " ====\n\n" + text)
    result = "\n\n".join(rendered)
    if args.output:
        output = Path(args.output)
        if output.is_absolute():
            try:
                output = output.resolve().relative_to(root)
            except ValueError:
                raise SetupError("--output 须位于所选项目内。")
        write_plan(root, {output: result + "\n"})
    else:
        print(result)
    return 0


def uninstall(args):
    root = project_path(args.project)
    require_cli(root)
    specify_cmd(root, "preset", "remove", ID)
    plans = {}
    for filename, expected in (("AGENTS.md", AGENT_BLOCK), ("CLAUDE.md", CLAUDE_BLOCK)):
        path = contained(root, filename)
        if not path.exists():
            continue
        old = path.read_text(encoding="utf-8-sig")
        if START not in old:
            continue
        match = re.search(re.escape(START) + r".*?" + re.escape(END), old, re.S)
        acceptable = [expected]
        if filename == "CLAUDE.md":
            acceptable.append(expected.replace("@AGENTS.md\n", ""))
        if match and match.group() in acceptable:
            plans[Path(filename)] = old[:match.start()] + old[match.end():]
        else:
            print("保留用户修改过的锚点，请人工检查：" + filename)
    write_plan(root, plans)
    print("已卸载预设；保留项目配置、备份、MCP 和 Agent 集成，不自动删除或断开连接。")
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description="双底座中文 TDD Spec Kit Preset 项目工具")
    parser.add_argument("--version", action="version", version=VERSION)
    sub = parser.add_subparsers(dest="operation", required=True)
    def base(name, help):
        p = sub.add_parser(name, help=help)
        p.add_argument("--project", required=True, help="已有且已初始化 Spec Kit 的项目目录")
        return p
    def configuration_options(p):
        for flag in ("repository-id", "codegraph-access", "codegraph-index", "wiki-access",
                     "wiki-location", "source-snapshot", "codegraph-snapshot", "wiki-snapshot", "baseline"):
            p.add_argument("--" + flag)
        p.add_argument("--settings", help="JSON 配置补丁，合并已有值；不接受明文密钥")
        p.add_argument("--write-mcp", action="store_true", help="显式合并项目 MCP；同名冲突拒绝覆盖")
    p = base("install", "安装到已有 Spec Kit，注册所选 Agent 并配置")
    configuration_options(p)
    p.add_argument("--agents", choices=("both", "claude", "codex"), default="both")
    p.add_argument("--default-agent", choices=("claude", "codex"), default="codex")
    p.add_argument("--priority", type=int, default=10)
    p.set_defaults(func=install)
    p = base("configure", "配置项目与指令锚点，可重复执行")
    configuration_options(p)
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(func=configure)
    p = base("doctor", "只检查配置和物化指令，不验证真实工具或测试")
    p.add_argument("--agents", choices=("both", "claude", "codex"), default="both")
    p.add_argument("--strict-metadata", action="store_true")
    p.set_defaults(func=doctor)
    p = base("context", "阶段只读上下文")
    p.add_argument("--stage", choices=STAGES, required=True)
    p.set_defaults(func=context)
    p = base("prompts", "输出匹配当前 Agent 的提示词")
    p.add_argument("--agent", choices=("claude", "codex"), required=True)
    p.add_argument("--stage", choices=(*STAGES, "all", "repair-tests", "handoff"), default="all")
    p.add_argument("--feature")
    p.add_argument("--requirements")
    p.add_argument("--constraints")
    p.add_argument("--focus")
    p.add_argument("--output")
    p.set_defaults(func=prompts)
    p = base("uninstall", "卸载预设，移除未被编辑的指令锚点")
    p.set_defaults(func=uninstall)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    if getattr(args, "priority", 1) < 1:
        print("错误：priority 必须为正整数。", file=sys.stderr)
        return 2
    try:
        return args.func(args)
    except (SetupError, OSError, subprocess.TimeoutExpired, ValueError) as exc:
        print("错误：" + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
