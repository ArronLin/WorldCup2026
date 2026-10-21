"""Safety/regression tests: standard library, no LLM or network."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import tomllib
import unittest

PACK = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sdd_preset", PACK / "scripts/sdd_preset.py")
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.sandbox = PACK / "tests" / ".work"
        self.sandbox.mkdir(exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix="中文 O'Brien ", dir=self.sandbox)).resolve()
        self.root.relative_to(self.sandbox.resolve())
        (self.root / ".specify").mkdir()

    def tearDown(self):
        self.root.resolve().relative_to(self.sandbox.resolve())
        shutil.rmtree(self.root)

    def run_tool(self, *args):
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
            code = tool.main([*args, "--project", str(self.root)])
        return code, stream.getvalue()

    def settings(self, patch):
        path = self.root / "settings.json"
        path.write_text(json.dumps(patch), encoding="utf-8")
        return str(path)

    def test_preserves_existing_instructions_and_idempotency(self):
        (self.root / "AGENTS.md").write_text("已有 CodeGraph 要求\n", encoding="utf-8")
        (self.root / "CLAUDE.md").write_text("@AGENTS.md\n\n专用规则\n", encoding="utf-8")
        self.assertEqual(self.run_tool("configure", "--repository-id", "测试项目")[0], 0)
        before = {x: (self.root / x).read_bytes()
                  for x in ("AGENTS.md", "CLAUDE.md", str(tool.CONFIG))}
        self.assertEqual(self.run_tool("configure")[0], 0)
        for x, content in before.items():
            self.assertEqual((self.root / x).read_bytes(), content)
        self.assertIn("已有 CodeGraph 要求", before["AGENTS.md"].decode())
        self.assertIn("专用规则", before["CLAUDE.md"].decode())
        self.assertEqual(before["CLAUDE.md"].decode().count("@AGENTS.md"), 1)

    def test_dry_run_and_bad_marker_do_not_write(self):
        self.assertEqual(self.run_tool("configure", "--dry-run")[0], 0)
        self.assertFalse((self.root / tool.CONFIG).exists())
        (self.root / "AGENTS.md").write_text(tool.START + "\n坏标记", encoding="utf-8")
        self.assertEqual(self.run_tool("configure")[0], 2)
        self.assertFalse((self.root / tool.CONFIG).exists())

    def test_http_stdio_mcp_preserves_other_servers_comments_and_idempotency(self):
        (self.root / ".mcp.json").write_text(
            json.dumps({"mcpServers": {"existing": {"url": "https://existing.example/mcp"}}}),
            encoding="utf-8")
        (self.root / ".codex").mkdir()
        (self.root / ".codex/config.toml").write_text(
            '# 保留注释\n[mcp_servers.existing]\nurl = "https://existing.example/mcp"\n',
            encoding="utf-8")
        patch = {"sources": {
            "codegraph": {"mcp": {"transport": "stdio", "command": "C:\\工具\\codegraph.exe",
                                 "args": ["--project", "D:\\代码 仓库"]}},
            "opendeepwiki": {"mcp": {"transport": "http", "url": "https://wiki.example/mcp",
                                    "bearer_token_env_var": "WIKI_TOKEN"}}}}
        self.assertEqual(self.run_tool("configure", "--settings", self.settings(patch), "--write-mcp")[0], 0)
        c = json.loads((self.root / ".mcp.json").read_text(encoding="utf-8"))
        raw = (self.root / ".codex/config.toml").read_text(encoding="utf-8")
        x = tomllib.loads(raw)
        self.assertEqual(c["mcpServers"]["existing"]["url"], "https://existing.example/mcp")
        self.assertEqual(x["mcp_servers"]["codegraph"]["command"], "C:\\工具\\codegraph.exe")
        self.assertEqual(c["mcpServers"]["opendeepwiki"]["headers"]["Authorization"], "Bearer $" + "{WIKI_TOKEN}")
        self.assertIn("# 保留注释", raw)
        self.assertEqual(self.run_tool("configure", "--write-mcp")[0], 0)
        self.assertEqual((self.root / ".codex/config.toml").read_text(encoding="utf-8"), raw)

    def test_mcp_conflict_prevents_any_configuration_write(self):
        (self.root / ".mcp.json").write_text(
            '{"mcpServers":{"codegraph":{"type":"http","url":"https://keep.example/mcp"}}}',
            encoding="utf-8")
        before = (self.root / ".mcp.json").read_bytes()
        patch = {"sources": {"codegraph": {"mcp": {"transport": "http", "url": "https://new.example/mcp"}}}}
        code, message = self.run_tool("configure", "--settings", self.settings(patch), "--write-mcp")
        self.assertEqual(code, 2)
        self.assertIn("未覆盖", message)
        self.assertEqual((self.root / ".mcp.json").read_bytes(), before)
        self.assertFalse((self.root / tool.CONFIG).exists())
        self.assertFalse((self.root / "AGENTS.md").exists())

    def test_rejects_lower_gate_credentials_and_bad_shape(self):
        bad = [
            {"policy": {"new_unit_line_coverage_minimum": 0.2}},
            {"sources": {"codegraph": {"mcp": {"transport": "http", "url": "https://u:p@x.example"}}}},
            {"sources": {"codegraph": {"mcp": {"transport": "http", "url": "https://x.example/?token=secret"}}}},
            {"sources": {"codegraph": {"mcp": {"transport": "http", "url": "https://x.example", "api_key": "secret"}}}},
            {"sources": None},
        ]
        for patch in bad:
            with self.subTest(patch=patch):
                self.assertEqual(self.run_tool("configure", "--settings", self.settings(patch))[0], 2)
                self.assertFalse((self.root / tool.CONFIG).exists())

    def test_project_mismatch_and_no_false_tool_verification(self):
        self.assertEqual(self.run_tool("configure")[0], 0)
        code, output = self.run_tool("context", "--stage", "implement")
        self.assertEqual(code, 0)
        self.assertIn("不执行 MCP", output)
        data = tool.configured(self.root)
        data["project"]["path"] = str(self.sandbox.resolve())
        (self.root / tool.CONFIG).write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(self.run_tool("context", "--stage", "implement")[0], 2)

    def test_correct_agent_prompts_and_output_containment(self):
        self.assertEqual(self.run_tool("configure")[0], 0)
        for agent, prefix in (("claude", "/speckit-specify"), ("codex", "$speckit-specify")):
            code, text = self.run_tool("prompts", "--agent", agent, "--stage", "specify",
                                      "--feature", "新功能", "--requirements", "用户行为")
            self.assertEqual(code, 0)
            self.assertIn(prefix, text)
            self.assertIn("新功能", text)
            self.assertNotIn("{{", text)
        self.assertEqual(self.run_tool("prompts", "--agent", "codex", "--output", "../escape.txt")[0], 2)
        self.assertFalse((self.root.parent / "escape.txt").exists())

    def test_backup_keeps_original(self):
        (self.root / "AGENTS.md").write_text("保留这份原文", encoding="utf-8")
        self.assertEqual(self.run_tool("configure")[0], 0)
        copies = list((self.root / ".specify/easeus/backups").glob("*/AGENTS.md"))
        self.assertEqual(len(copies), 1)
        self.assertEqual(copies[0].read_text(encoding="utf-8"), "保留这份原文")
        self.assertIn("/backups/", (self.root / ".specify/easeus/.gitignore").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
