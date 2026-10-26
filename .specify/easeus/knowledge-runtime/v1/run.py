"""Run the repository-owned MCP bridge; no Studio installation or state is read."""
from __future__ import annotations

import argparse
import json
import ntpath
import os
from pathlib import Path
import re
import sys
from urllib.parse import parse_qsl, urlsplit

from sdd_knowledge import VERSION
from sdd_knowledge.client import KnowledgeError, MCPClient
from sdd_knowledge.core import Bridge, serve


def _expand(value, root, repository_id):
    if isinstance(value, str):
        return value.replace("{{project_path}}", str(root)).replace("{{repository_id}}", repository_id)
    if isinstance(value, list):
        return [_expand(item, root, repository_id) for item in value]
    if isinstance(value, dict):
        return {key: _expand(item, root, repository_id) for key, item in value.items()}
    return value


def load_configuration(config_path, root):
    root = root.resolve()
    config_path = config_path.resolve()
    if not config_path.is_relative_to(root):
        raise KnowledgeError("知识库配置必须位于当前仓库中。")
    try:
        config = json.loads(config_path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise KnowledgeError("无法读取仓库知识库配置：" + str(config_path)) from exc
    if config.get("schema_version") != 1 or config.get("runtime_version") != VERSION:
        raise KnowledgeError("知识库运行时版本与配置不匹配；请按迁移说明更新仓库受管文件。")
    if config.get("framework") not in {"speckit", "openspec"}:
        raise KnowledgeError("知识库配置缺少框架标识。")
    sources = {}
    for name in ("opendeepwiki", "codegraph"):
        source = config.get("sources", {}).get(name)
        if not isinstance(source, dict):
            raise KnowledgeError("知识库配置缺少 " + name)
        if source.get("setup_issues"):
            raise KnowledgeError(name + " 需要在当前机器配置：" + "；".join(source["setup_issues"]) + "。请编辑 " + str(config_path))
        source = _expand(source, root, source.get("repository_id", root.name))
        conn = source.get("connection", {})
        if conn.get("transport") not in {"stdio", "http"} or not source.get("allowed_tools"):
            raise KnowledgeError(name + " 缺少连接或允许的只读工具；请编辑 " + str(config_path))
        if not isinstance(source.get("allowed_tools"), list) or any(not isinstance(tool, str) for tool in source["allowed_tools"]):
            raise KnowledgeError(name + " 允许工具列表无效。")
        if conn.get("credential_ref"):
            raise KnowledgeError(name + " 仍引用 Studio 凭据；请改用 bearer_token_env_var 或 env:变量名。")
        if conn["transport"] == "stdio":
            command = conn.get("command", "")
            if not isinstance(command, str) or not command or ntpath.isabs(command) or Path(command).is_absolute():
                raise KnowledgeError(name + " 的 stdio 启动命令应是已加入 PATH 的命令名，不得是机器绝对路径。")
            if not isinstance(conn.get("args", []), list) or any(not isinstance(arg, str) or not arg
                    or ntpath.isabs(arg) or (Path(arg).is_absolute() and not arg.startswith("/")) for arg in conn.get("args", [])):
                raise KnowledgeError(name + " 的 stdio 参数无效或依赖旧机器绝对路径。")
            cwd = conn.get("cwd")
            if cwd and Path(cwd).resolve() != root:
                raise KnowledgeError(name + " 的 stdio 工作目录须为当前仓库根目录。")
        else:
            url = conn.get("url", "")
            try:
                parts = urlsplit(url)
                if parts.scheme not in {"http", "https"} or not parts.netloc or parts.username or parts.password or any(
                    re.search(r"token|secret|password|api.?key", key, re.I) for key, _ in parse_qsl(parts.query)):
                    raise ValueError()
            except (TypeError, ValueError) as exc:
                raise KnowledgeError(name + " HTTP 地址无效或含认证值；请改用环境变量。") from exc
        for ref in conn.get("env", {}).values():
            if not str(ref).startswith("env:"):
                raise KnowledgeError(name + " 环境变量配置仅支持 env:变量名。")
        sources[name] = source
    return {"root": str(root), "sources": sources, "repository_id": config.get("repository_id", root.name),
            "actor": "agent", "evidence_file": str(config_path.parent / "knowledge-evidence.jsonl")}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Repo SDD Studio portable knowledge MCP bridge")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="Connect to both configured MCP sources and check read-only tools")
    args = parser.parse_args(argv)
    try:
        if sys.version_info < (3, 10):
            raise KnowledgeError("需要 Python 3.10 或更新版本；安装后设置 REPO_SDD_PYTHON 或将 python 加入 PATH。")
        config = load_configuration(args.config, args.root)
        if args.check:
            with Bridge(config) as bridge:
                names = {tool["name"] for tool in bridge.tools()}
            print(json.dumps({"status": "ready", "framework": json.loads(args.config.read_text(encoding="utf-8-sig"))["framework"],
                "tools": sorted(names), "runtime_version": VERSION}, ensure_ascii=False))
        else:
            serve(config)
        return 0
    except (KnowledgeError, OSError, ValueError) as exc:
        print("知识库运行时不可用：" + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
