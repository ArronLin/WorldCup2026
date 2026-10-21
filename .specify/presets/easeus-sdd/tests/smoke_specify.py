"""Real CLI smoke test; isolated, no Git/MCP/LLM calls. Pass --work-root outside package."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

PACK = Path(__file__).resolve().parents[1]
STAGES = ("constitution","specify","clarify","plan","checklist","tasks","analyze","implement","converge")


def run(argv, root):
    result = subprocess.run(argv, cwd=root, text=True, encoding="utf-8",
                            errors="replace", capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError("命令失败：" + repr(argv) + "\n" + result.stdout + result.stderr)
    return result.stdout


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work-root", required=True)
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--initial-agent", choices=("claude", "codex"), default="claude")
    args = ap.parse_args()
    parent = Path(args.work_root).expanduser().resolve()
    if parent.is_relative_to(PACK):
        raise RuntimeError("work-root 必须位于包目录之外，避免自复制。")
    parent.mkdir(parents=True, exist_ok=True)
    root = Path(tempfile.mkdtemp(prefix="sdd 集成 O'Brien ", dir=parent)).resolve()
    root.relative_to(parent)
    cli = shutil.which("specify")
    if not cli:
        raise RuntimeError("需要已安装的 Specify CLI 1.1.3。")
    tool = [sys.executable, str(PACK / "scripts/sdd_preset.py")]
    report = {"project": str(root), "cli": None, "checks": [], "mcp_verified": False,
              "llm_execution_verified": False}
    try:
        report["cli"] = json.loads(run([cli, "version", "--json"], root))["cli_version"]
        run([cli, "init", "--here", "--integration", args.initial_agent, "--script", "ps",
             "--non-interactive", "--ignore-agent-tools"], root)
        assert not (root / ".git").exists(), "不能初始化 Git"
        (root / "AGENTS.md").write_text("原有项目规则\n", encoding="utf-8")
        (root / "CLAUDE.md").write_text("原有 Claude 规则\n", encoding="utf-8")
        original_constitution = digest(root / ".specify/memory/constitution.md")
        index = root / "index fixture"
        index.mkdir()
        run(tool + ["install", "--project", str(root), "--agents", "both",
                    "--default-agent", "codex", "--repository-id", "fixture/repo",
                    "--codegraph-index", str(index), "--codegraph-access", "fixture MCP only",
                    "--wiki-location", "https://wiki.example/fixture",
                    "--wiki-access", "fixture document only",
                    "--source-snapshot", "fixture-v1", "--codegraph-snapshot", "fixture-v1",
                    "--wiki-snapshot", "fixture-v1"], root)
        assert digest(root / ".specify/memory/constitution.md") == original_constitution
        report["checks"].append("install preserves constitution and creates no Git repository")
        for agent, folder in (("claude", ".claude"), ("codex", ".agents")):
            for stage in STAGES:
                body = (root / folder / "skills" / ("speckit-" + stage) / "SKILL.md").read_text(encoding="utf-8")
                assert "<!-- easeus-sdd:policy:v1 -->" in body
                assert "{CORE_TEMPLATE}" not in body
                assert "## User Input" in body
                assert "easeus-sdd:core:end" in body
        report["checks"].append("all 18 materialized skills preserve upstream and include preset policy")
        for name in ("spec-template","plan-template","tasks-template","constitution-template","checklist-template"):
            resolved = run([cli, "preset", "resolve", name], root)
            assert "easeus-sdd" in resolved, resolved
        report["checks"].append("all 5 appended template layers resolve through real CLI")
        status = json.loads(run(tool + ["doctor", "--project", str(root)], root))
        assert not status["errors"]
        assert status["mcp_connection_verified"] is False
        assert status["tests_verified"] is False
        report["checks"].append("doctor validates registration without claiming MCP or test success")
        paths = ["AGENTS.md", "CLAUDE.md", ".specify/easeus.json"]
        before = {p: digest(root / p) for p in paths}
        run(tool + ["configure", "--project", str(root)], root)
        assert before == {p: digest(root / p) for p in paths}
        report["checks"].append("configure is idempotent and preserves user instructions")
        # Disabling retains registered skills in upstream CLI. Doctor must reject that stale state.
        run([cli, "preset", "disable", "easeus-sdd"], root)
        disabled = subprocess.run(tool + ["doctor", "--project", str(root)],
                                  capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert disabled.returncode == 1
        assert json.loads(disabled.stdout)["errors"]
        run([cli, "preset", "enable", "easeus-sdd"], root)
        report["checks"].append("doctor rejects disabled preset despite residual skills")
        run(tool + ["uninstall", "--project", str(root)], root)
        for folder in (".claude", ".agents"):
            for stage in STAGES:
                text = (root / folder / "skills" / ("speckit-" + stage) / "SKILL.md").read_text(encoding="utf-8")
                assert "easeus-sdd:policy" not in text
                assert "## User Input" in text
        assert "原有项目规则" in (root / "AGENTS.md").read_text(encoding="utf-8")
        assert "原有 Claude 规则" in (root / "CLAUDE.md").read_text(encoding="utf-8")
        assert "DUAL_CONTEXT_SDD:START" not in (root / "AGENTS.md").read_text(encoding="utf-8")
        assert "DUAL_CONTEXT_SDD:START" not in (root / "CLAUDE.md").read_text(encoding="utf-8")
        assert (root / ".specify/easeus.json").exists()
        assert not (root / ".git").exists()
        report["checks"].append("uninstall restores both upstream skill sets and preserves user configuration")
        report["status"] = "passed"
        report["initial_agent"] = args.initial_agent
        (parent / ("last-smoke-" + args.initial_agent + ".json")).write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        if not args.keep:
            root.resolve().relative_to(parent)
            shutil.rmtree(root)


if __name__ == "__main__":
    main()
