from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sys
import uuid
from contextlib import ExitStack

from .client import MCPClient, KnowledgeError, result_text

WizardError = KnowledgeError
SOURCES = ("opendeepwiki", "codegraph")


def redact(text):
    text = re.sub(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/=\-]+", r"\1[已隐藏]", str(text))
    text = re.sub(r"(?i)((?:api[_-]?key|password|access_token|secret|token)[\s\"':=]+)([^\s\",}]+)",
                  r"\1[已隐藏]", text)
    for name, value in os.environ.items():
        if len(value) >= 8 and re.search(r"TOKEN|SECRET|PASSWORD|API.?KEY", name, re.I):
            text = text.replace(value, "[已隐藏]")
    return text


def safe_path(root, relative):
    if not isinstance(relative, str) or not relative or ":" in relative:
        raise WizardError("路径须为仓库相对路径。")
    p = Path(relative)
    if p.is_absolute() or ".." in p.parts:
        raise WizardError("路径不能离开仓库。")
    target = (root / p).resolve()
    if not target.is_relative_to(root):
        raise WizardError("路径不能离开仓库。")
    return target


def display_record(record):
    """Readable summary kept in the same evidence contract as Studio."""
    source, tool = record.get("source", ""), record.get("tool", "")
    text = record.get("excerpt", "")
    title = record.get("arguments", {}).get("path") or record.get("arguments", {}).get("query") or tool
    kind = "code" if source == "repo" and tool == "repo_read" else "markdown"
    if source == "opendeepwiki":
        try:
            payload = json.loads(text)
            if isinstance(payload, dict):
                title = payload.get("title") or payload.get("path") or title
                text = payload.get("content") or payload.get("text") or text
        except (ValueError, TypeError):
            pass
    version = record.get("result_metadata", {}).get("version") or record.get("snapshot") or "unknown"
    return {"id": record.get("id", ""), "source": {"repo": "本地文件", "opendeepwiki": "文档知识库", "codegraph": "代码知识库"}.get(source, source),
            "title": str(title), "body": redact(str(text)[:35000]), "kind": kind,
            "truncated": bool(record.get("excerpt_truncated") or len(str(text)) > 35000),
            "version": "版本未记录" if version == "unknown" else version,
            "reading": "目录 / 仓库列表" if tool in {"repo_list", "list_repositories", "get_repo_structure", "search_repositories"} else "内容读取"}

EXCLUDED = {".git", ".codegraph", "node_modules", ".venv", "__pycache__", "backups", "transactions", "credentials"}
PRIVATE = {".env", ".mcp.json", ".claude.json", "config.toml", "settings.local.json", "local.json"}


def result_metadata(text: str):
    """Keep validation facts outside the display excerpt, which may be truncated."""
    try:
        payload = json.loads(text)
    except (TypeError, ValueError):
        return {}
    if not isinstance(payload, dict):
        return {}
    repository = payload.get("repository")
    if isinstance(repository, dict):
        repository = repository.get("full_name")
    if not repository and payload.get("owner") and payload.get("repo"):
        repository = payload["owner"] + "/" + payload["repo"]
    content = payload.get("content") or payload.get("text") or ""
    if isinstance(content, list):
        content = "\n".join(str(item.get("text", "")) for item in content if isinstance(item, dict))
    metadata = {}
    if isinstance(repository, str) and repository:
        metadata["repository"] = repository
    if isinstance(content, str):
        metadata["content_length"] = len(content)
    version = next((payload.get(key) for key in ("source_commit", "commit_sha", "commit", "revision")
                    if isinstance(payload.get(key), str) and re.fullmatch(r"[0-9a-fA-F]{40,64}", payload[key])), None)
    if version:
        metadata["version"] = version
    return metadata


def readable(root: Path, relative: str):
    p = safe_path(root, relative)
    parts = Path(relative).parts
    if any(x in EXCLUDED for x in parts) or p.name in PRIVATE or p.name.startswith(".env.") or p.suffix in {".pem", ".key", ".pfx", ".p12"}:
        raise WizardError("该文件属于凭据、缓存或内部状态，读取工具不公开其内容。")
    if not p.is_file():
        raise WizardError("文件不存在：" + relative)
    if p.stat().st_size > 2_000_000:
        raise WizardError("文件过大，请定位较小源码文件。")
    return p


class Bridge:
    def __init__(self, config, cancel=None, client_factory=None, display=None):
        self.config = config
        self.root = Path(config["root"]).resolve()
        self.cancel = cancel
        self.client_factory = client_factory or (lambda source, _: MCPClient(source))
        self.display = display or display_record
        self.stack = ExitStack()
        self.clients = {}
        self.tool_map = {}

    def close(self):
        self.stack.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def evidence(self, source, tool, arguments, text):
        record = {"id": "E-" + uuid.uuid4().hex[:16], "actor": self.config.get("actor", "agent"),
            "source": source, "tool": tool, "arguments": json.loads(redact(json.dumps(arguments, ensure_ascii=False))),
            "repository_id": self.config.get("repository_id", "unknown"),
            "snapshot": self.config.get("sources", {}).get(source, {}).get("snapshot", self.config.get("source_snapshot", "unknown")),
            "content_hash": hashlib.sha256(text.encode()).hexdigest(), "result_metadata": result_metadata(text),
            "excerpt": redact(text)[:35000], "excerpt_truncated": len(redact(text)) > 35000}
        record["display"] = self.display({**record, "excerpt": redact(text), "excerpt_truncated": False})
        if path := self.config.get("evidence_file"):
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            # One bridge process owns each generation evidence file.
            with p.open("a", encoding="utf-8") as out:
                out.write(json.dumps(record, ensure_ascii=False) + "\n")
                out.flush()
        return record["id"]

    def tools(self):
        definitions = [
            {"name": "repo_list", "description": "列出本次选定仓库的文件；理解或定位代码应先查询 CodeGraph。",
             "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
             "inputSchema": {"type": "object", "properties": {"directory": {"type": "string"}}, "additionalProperties": False}},
            {"name": "repo_read", "description": "读取所选仓库当前源码/文档，返回行号和真实读取证据 ID。理解代码先查 CodeGraph。",
             "annotations": {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False},
             "inputSchema": {"type": "object", "required": ["path"], "properties": {
                 "path": {"type": "string"}, "start_line": {"type": "integer", "minimum": 1},
                 "line_count": {"type": "integer", "minimum": 1, "maximum": 400}}, "additionalProperties": False}},
        ]
        for source in SOURCES:
            setting = self.config.get("sources", {}).get(source)
            if not setting:
                continue
            if source not in self.clients:
                self.clients[source] = self.stack.enter_context(self.client_factory(setting, self.cancel))
            client = self.clients[source]
            for name in setting.get("allowed_tools", []):
                if name not in client.tools:
                    raise WizardError(f"{source} 未提供配置中的工具：{name}")
                native = client.tools[name]
                hints = native.get("annotations", {})
                if hints.get("readOnlyHint") is False or hints.get("destructiveHint") is True:
                    raise WizardError("公司工具范围包含写操作，请管理员修正：" + name)
                exposed = source + "__" + name
                self.tool_map[exposed] = (source, name)
                schema = json.loads(json.dumps(native.get("inputSchema", {"type": "object"})))
                for field in setting.get("bindings", {}).get(name, {}):
                    if field in schema.get("required", []):
                        schema["required"].remove(field)
                    schema.get("properties", {}).pop(field, None)
                definitions.append({"name": exposed, "description": f"[{source}，仓库范围已绑定] " + native.get("description", "")[:10000],
                                    "inputSchema": schema, "annotations": {"readOnlyHint": True}})
        return definitions

    def call(self, name, arguments):
        if name == "repo_read":
            p = readable(self.root, arguments["path"])
            lines = p.read_text(encoding="utf-8-sig", errors="replace").splitlines()
            start = max(1, int(arguments.get("start_line", 1)))
            count = min(400, max(1, int(arguments.get("line_count", 200))))
            text = "\n".join(f"{i + 1}: {line}" for i, line in enumerate(lines) if start - 1 <= i < start - 1 + count)
            eid = self.evidence("repo", name, arguments, text)
        elif name == "repo_list":
            directory = arguments.get("directory", "")
            p = safe_path(self.root, directory) if directory else self.root
            if any(x in EXCLUDED for x in p.relative_to(self.root).parts) or not p.is_dir():
                raise WizardError("该目录不可读取。")
            items = []
            for child in sorted(p.iterdir(), key=lambda x: x.name.casefold()):
                if child.name in EXCLUDED or child.name in PRIVATE or child.is_symlink():
                    continue
                items.append(str(child.relative_to(self.root)).replace("\\", "/") + ("/" if child.is_dir() else ""))
                if len(items) == 250:
                    items.append("（已截断，请按目录继续查询）")
                    break
            text = "\n".join(items)
            eid = self.evidence("repo", name, arguments, text)
        else:
            if name not in self.tool_map:
                self.tools()
            if name not in self.tool_map:
                raise WizardError("不允许调用该工具。")
            source, native = self.tool_map[name]
            fixed = self.config["sources"][source].get("bindings", {}).get(native, {})
            result = self.clients[source].call(native, arguments)
            text = result_text(result)
            eid = self.evidence(source, native, {**arguments, **fixed}, text)
        return {"content": [{"type": "text", "text": f"证据 ID：{eid}\n" + redact(text)[:40000]}]}


def serve(config, bridge_factory=Bridge):
    bridge = bridge_factory(config)
    try:
        for raw in sys.stdin:
            message = None
            try:
                message = json.loads(raw)
                method, params = message.get("method"), message.get("params", {})
                if "id" not in message:
                    continue
                if method == "initialize":
                    result = {"protocolVersion": params.get("protocolVersion", "2025-03-26"),
                        "capabilities": {"tools": {}}, "serverInfo": {"name": "repo-sdd-knowledge-readonly", "version": "1.0.0"}}
                elif method == "ping":
                    result = {}
                elif method == "tools/list":
                    result = {"tools": bridge.tools()}
                elif method == "tools/call":
                    try:
                        result = bridge.call(params["name"], params.get("arguments", {}))
                    except Exception as exc:
                        result = {"isError": True, "content": [{"type": "text", "text": redact(str(exc))[:2000]}]}
                else:
                    raise WizardError("不支持的 MCP 方法：" + str(method))
                packet = {"jsonrpc": "2.0", "id": message["id"], "result": result}
            except Exception as exc:
                packet = {"jsonrpc": "2.0", "id": message.get("id") if isinstance(message, dict) else None,
                          "error": {"code": -32603, "message": redact(str(exc))[:2000]}}
            sys.stdout.write(json.dumps(packet, ensure_ascii=False) + "\n")
            sys.stdout.flush()
    finally:
        bridge.close()


def records(path):
    if not path or not Path(path).exists():
        return []
    result = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        try:
            result.append(json.loads(line))
        except ValueError:
            continue  # A writer may be in the middle of its last append.
    return result
