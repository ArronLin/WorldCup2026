"""Small MCP client for the portable read-only knowledge bridge.

Only httpx is needed for Streamable HTTP. Stdio uses Python's standard library.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time


class KnowledgeError(Exception):
    pass


def result_text(result):
    parts = [item.get("text", "") for item in result.get("content", []) if item.get("type") == "text"]
    if result.get("structuredContent") is not None:
        parts.append(json.dumps(result["structuredContent"], ensure_ascii=False))
    return "\n".join(parts)


def _env_value(reference):
    kind, sep, name = str(reference).partition(":")
    if not sep or kind != "env" or not name:
        raise KnowledgeError("仓库运行时只支持 env:变量名；请将凭据放入本机环境变量，不使用 Studio 安全存储。")
    value = os.environ.get(name)
    if value is None:
        raise KnowledgeError(f"缺少环境变量 {name}；请在当前机器设置后重新启动 Agent。")
    return value


class MCPClient:
    def __init__(self, source):
        self.source = source
        self.connection = source.get("connection", {})
        self.timeout = float(self.connection.get("timeout", 60))
        self.counter = 0
        self.process = None
        self.output = queue.Queue()
        self.errors = []
        self.http = None
        self.headers = {"Accept": "application/json, text/event-stream"}
        self.tools = {}

    def __enter__(self):
        conn = self.connection
        if conn.get("transport") == "stdio":
            command = conn.get("command", "")
            exe = shutil.which(command)
            if not exe:
                raise KnowledgeError(f"找不到知识库 MCP 启动命令 {command!r}；请安装连接器并加入 PATH，或编辑 knowledge-runtime.json。")
            args = list(conn.get("args", []))
            if os.name == "nt" and Path(exe).suffix.lower() in {".cmd", ".bat"}:
                # Windows npm shims require cmd.exe. Reject shell metacharacters.
                import re
                if any(re.search(r"[&|<>^%!\r\n]", part) for part in [exe, *args]):
                    raise KnowledgeError("MCP 批处理参数含 shell 特殊字符；请改用实际可执行程序。")
                argv = [os.environ.get("COMSPEC", "cmd.exe"), "/d", "/s", "/c", subprocess.list2cmdline([exe, *args])]
            else:
                argv = [exe, *args]
            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            env.update({key: _env_value(ref) for key, ref in conn.get("env", {}).items()})
            self.process = subprocess.Popen(argv, cwd=conn.get("cwd") or None, env=env,
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, encoding="utf-8", errors="replace", bufsize=1)
            threading.Thread(target=self._read_stdout, daemon=True).start()
            threading.Thread(target=self._read_stderr, daemon=True).start()
        elif conn.get("transport") == "http":
            try:
                import httpx
            except ImportError as exc:
                raise KnowledgeError('HTTP MCP 需要 httpx：python -m pip install "httpx>=0.27,<1"') from exc
            self.http = httpx.Client(timeout=self.timeout, follow_redirects=False, trust_env=True)
            if token_env := conn.get("bearer_token_env_var"):
                self.headers["Authorization"] = "Bearer " + _env_value("env:" + token_env)
        else:
            raise KnowledgeError("知识库连接未配置；请编辑 knowledge-runtime.json 的 connection。")
        try:
            initial = self.request("initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                "clientInfo": {"name": "repo-sdd-knowledge", "version": "1.0.0"}})
            self.headers["MCP-Protocol-Version"] = initial.get("protocolVersion", "2025-03-26")
            self.notify("notifications/initialized", {})
            cursor = None
            for _ in range(100):
                page = self.request("tools/list", {"cursor": cursor} if cursor else {})
                for tool in page.get("tools", []):
                    self.tools[tool["name"]] = tool
                cursor = page.get("nextCursor")
                if not cursor:
                    break
            else:
                raise KnowledgeError("MCP 工具列表分页过多。")
            return self
        except BaseException:
            self.close()
            raise

    def _read_stdout(self):
        try:
            for line in self.process.stdout:
                try:
                    self.output.put(json.loads(line))
                except ValueError:
                    self.output.put({"_protocol_error": True})
        finally:
            self.output.put({"_eof": True})

    def _read_stderr(self):
        for line in self.process.stderr:
            self.errors.append(line.strip()[:500])
            self.errors = self.errors[-10:]

    def _send_http(self, packet):
        try:
            with self.http.stream("POST", self.connection["url"], json=packet, headers=self.headers) as response:
                if response.status_code in {401, 403}:
                    raise KnowledgeError("知识库认证失败；请检查本机环境变量和服务权限。")
                response.raise_for_status()
                if sid := response.headers.get("Mcp-Session-Id"):
                    self.headers["Mcp-Session-Id"] = sid
                if response.status_code in {202, 204}:
                    return None
                if "text/event-stream" not in response.headers.get("content-type", ""):
                    return response.json()
                data = []
                for line in response.iter_lines():
                    if line.startswith("data:"):
                        data.append(line[5:].lstrip())
                    elif not line and data:
                        item = json.loads("\n".join(data)); data = []
                        if item.get("id") == packet.get("id"):
                            return item
                if data:
                    item = json.loads("\n".join(data))
                    if item.get("id") == packet.get("id"):
                        return item
                if "id" not in packet:
                    return None
                raise KnowledgeError("HTTP MCP 未返回对应请求的响应。")
        except KnowledgeError:
            raise
        except Exception as exc:
            raise KnowledgeError("HTTP MCP 请求失败：" + type(exc).__name__) from exc

    def _send(self, packet):
        if self.process:
            try:
                self.process.stdin.write(json.dumps(packet, ensure_ascii=False) + "\n")
                self.process.stdin.flush()
            except (OSError, ValueError) as exc:
                raise KnowledgeError("知识库连接已关闭。") from exc
            return None
        return self._send_http(packet)

    def notify(self, method, params):
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def request(self, method, params):
        self.counter += 1
        packet = {"jsonrpc": "2.0", "id": self.counter, "method": method, "params": params}
        reply = self._send(packet)
        if self.process:
            deadline = time.monotonic() + self.timeout
            while True:
                remain = deadline - time.monotonic()
                if remain <= 0:
                    raise KnowledgeError("等待知识库 MCP 响应超时。")
                try:
                    reply = self.output.get(timeout=min(0.2, remain))
                except queue.Empty:
                    continue
                if reply.get("_eof"):
                    raise KnowledgeError("知识库 MCP 进程已退出。" + "\n".join(self.errors[-3:]))
                if reply.get("_protocol_error"):
                    raise KnowledgeError("知识库 MCP 向 stdout 写入了非 JSON 数据。")
                if "method" in reply and "id" in reply:
                    answer = ({"result": {}} if reply["method"] == "ping"
                              else {"error": {"code": -32601, "message": "unsupported"}})
                    self._send({"jsonrpc": "2.0", "id": reply["id"], **answer})
                    continue
                if reply.get("id") == packet["id"]:
                    break
        if not isinstance(reply, dict) or reply.get("id") != packet["id"]:
            raise KnowledgeError("知识库 MCP 响应 ID 不匹配。")
        if "error" in reply:
            raise KnowledgeError("知识库 MCP 错误：" + str(reply["error"].get("message", "未知错误"))[:300])
        return reply.get("result", {})

    def call(self, name, arguments):
        if name not in self.source.get("allowed_tools", []):
            raise KnowledgeError("工具不在仓库允许的只读范围：" + name)
        tool = self.tools.get(name)
        if not tool:
            raise KnowledgeError("知识库未提供工具：" + name)
        hints = tool.get("annotations", {})
        if hints.get("readOnlyHint") is False or hints.get("destructiveHint") is True:
            raise KnowledgeError("知识库将工具标为写入操作：" + name)
        merged = {**arguments, **self.source.get("bindings", {}).get(name, {})}
        result = self.request("tools/call", {"name": name, "arguments": merged})
        if result.get("isError") or not result_text(result).strip():
            raise KnowledgeError("知识库工具执行失败或未返回正文。")
        return result

    def close(self):
        if self.process:
            try:
                self.process.stdin.close()
                self.process.wait(timeout=0.5)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                self.process.kill()
            self.process = None
        if self.http:
            if "Mcp-Session-Id" in self.headers:
                try:
                    self.http.delete(self.connection["url"], headers=self.headers, timeout=2)
                except Exception:
                    pass
            self.http.close()
            self.http = None

    def __exit__(self, *_):
        self.close()
