---
name: speckit-bug-test
description: Validate that a previously fixed bug is resolved and record the verification
  report
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: preset:easeus-sdd
---

# Speckit Bug Test Skill

<!-- REPO_SDD_SCOPE:speckit:START -->
### 工作流隔离：Spec Kit
本区段及其下方正文仅在已明确选择 Spec Kit 工作流时生效；未选择时不得执行正文中的读取或阶段指令。
未指定工作流时，先询问用户：“本次使用 Spec Kit 还是 OpenSpec？”在获得回答前，不加载任一框架的规范、模板、专属约定或执行阶段命令。同时要求两套工作流时，先请用户选择本轮使用的一套，不自动拼接。普通代码说明、知识问答不必因此中断。
有效选择来自用户明确点名框架、用户显式调用对应技能或命令（speckit-*、/speckit.*、sdd-speckit-*），或适配向导明确标注本次框架。本轮已明确选择后，“继续”可沿用该选择；新任务未明确框架时重新询问。不能把目录存在、默认配置、历史任务或 Agent 自行触发技能当作用户选择。
选定 Spec Kit 后，只加载 .specify/ 内的规范、规则快照、模板及该框架的 Agent 专属约定，知识库使用 speckit_wizard 的本框架绑定。不得加载或套用另一框架（openspec/）的规范、模板、阈值或报告入口；另一框架的技能和共享文件受管区段保持不适用。工具缺失时报告问题，不改用另一框架兜底。
人工撰写的公共指令仍保留；公共指令与当前框架规则发生冲突时明确说明并询问，不静默合并政策。用户要求跨框架迁移或比较时先确认范围，该授权不等于两套规则同时生效。
<!-- REPO_SDD_SCOPE:speckit:END -->

<!-- easeus-sdd:policy:v1 -->
## EaseUS SDD：Bug 验证阶段约定
本次阶段：bug-test。保持用户参数；先读取 .specify/easeus.json、.specify/easeus/requirements.json（若存在）、当前宪法、assessment.md 和 fix.md。
使用仓库自己的测试工具真实复现原问题并执行适当回归；不把历史 passed、文档勾选或 Agent 声明当作本次结果。
test.md 必须摘要先行、需确认项集中、正文分层、细节后置：开头列原问题是否解决、实际命令与结果、回归范围、未验证项和风险，再列必要细节；不粘贴原始日志。面向人的标题和说明使用当前规则语言；官方 Result 等固定字段保留并在相邻位置说明语义。
## 当前启用的工程规则
<!-- easeus:requirements:2c98fef3095fcc8c9866caf5b4a3e5b6f9fbc3763b6e6d7a1ce45a2d7c22b714 -->
### 交互与产物语言
所有面向人的自然语言内容，包括标题、小标题、表头、任务类别、状态说明、目标、依赖与验证文字，使用简体中文；命令、文件路径、API 与代码标识符、协议关键字和框架固定标记保持原样。引用必须保留的英文固定标记时，应在相邻位置提供简体中文说明；不得照抄基础模板的英文标题作为最终文档标题。

### 真实 TDD
新增或修改可单测行为及修复缺陷时，先编写测试并实际运行，确认测试因预期行为尚未实现而失败，再编写最小实现使测试通过，随后按需重构并回归验证。依赖、环境或语法错误不能作为有效的 Red；不得将事后补写测试宣称为 TDD。

### 可计量新增业务逻辑测试覆盖率
对仓库现有工具能够可靠采集的新增或修改自有生产代码可执行业务逻辑，单元测试覆盖率不低于 80%；优先采用语句或分支覆盖率，现有工具仅提供行覆盖率时可使用行覆盖率。纯声明式界面（包括 QML）、生成代码、资源和配置不纳入百分比分母，但相关属性、绑定、信号、状态变化及关键用户场景必须通过自动化行为测试；复杂业务逻辑应优先移入可单测模块。无可靠采集能力时明确记为不适用或能力缺口，不得填成 0% 或 100%，也不得用 qmlprofiler 等性能分析事件作为覆盖率证明。

### 有效测试与验证
测试必须调用真实被测生产逻辑，包含能识别错误行为的断言并实际发现和执行。禁止占位成功、恒真断言、mock 掉被测核心与静默跳过；未实际执行测试不得宣称通过。关键控制逻辑采用可恢复的反向验证或适用变异测试。

### 来源与事实核实
知识库与源码说明现状，已确认需求定义期望；关键结论记录来源与适用版本，未知必须明确，现状缺陷不得自动固化为规范。
以上规则来自已评审快照；未启用的规则不得按旧默认值恢复。本预设不自动提交、推送或归档。

<!-- easeus-sdd:core:start -->

# Test Bug Fix

Validate that the fix recorded by `$speckit-bug-fix` actually resolves the bug described by `$speckit-bug-assess`. The output is a verification report at `.specify/bugs/<slug>/test.md`.

## User Input

```text
$ARGUMENTS
```

The user input should identify the bug to validate. Accept any of:

- `slug=<bug-slug>` or `--slug <bug-slug>` or a bare slug-like token.
- A path that contains the slug (e.g. `.specify/bugs/login-timeout/`).
- **Nothing** — fall back to context (see below).

## Slug Resolution

Resolve `BUG_SLUG` in this order, stopping at the first match:

1. **Explicit user input** — a slug passed in `$ARGUMENTS` (any of the forms above).
2. **Conversation context** — if the current session has just run `$speckit-bug-assess` or `$speckit-bug-fix`, the slug it reported is the working slug. Reuse it without re-prompting. Confirm it by checking that `.specify/bugs/<slug>/fix.md` exists; if it does not, fall through.
3. **Single candidate on disk** — list `.specify/bugs/*/fix.md`. If exactly one bug has a `fix.md`, use it.
4. **Disambiguate**:
   - **Interactive mode**: ask the user which bug to validate and list the candidates.
   - **Automated mode**: stop with an error listing the candidates. Do not guess.

Once resolved, set `BUG_SLUG` and `BUG_DIR = .specify/bugs/<BUG_SLUG>`, and briefly state in your reply which resolution path was used (explicit / from context / single candidate / asked).

## Prerequisites

- `BUG_DIR/assessment.md` MUST exist.
- `BUG_DIR/fix.md` MUST exist. If not, stop and instruct the user to run `$speckit-bug-fix` first.
- If `BUG_DIR/test.md` already exists, ask the user whether to overwrite it (interactive mode) or refuse (automated mode).
- Read both `assessment.md` and `fix.md` in full so you know:
  - The original symptom and reproduction steps (from `assessment.md`).
  - The actual code changes and tests added (from `fix.md`).

## Pre-Execution Checks

By this point `BUG_SLUG` and `BUG_DIR` have been resolved, so a hook command run in this session can reuse them from the conversation; nothing is passed to it automatically.

**Check for extension hooks (before bug verification)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_bug_test` key
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `$speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to Execution.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Execution

1. **Plan the validation**
   - Decide which checks prove the bug is gone:
     - Re-run the reproduction steps from the assessment (or their automated equivalent).
     - Run the tests added or updated in the fix.
     - Run any broader regression suite that touches the changed files.
   - Decide which checks prove nothing was broken:
     - Existing test suites for the changed modules.
     - Lint / type-check if the project uses them.

2. **Run the checks**
   - Execute each planned check. Capture command, exit status, and a short excerpt of relevant output (last few lines, or the failing assertion).
   - If a check is destructive, network-dependent, or expensive, skip it and record it as `skipped` with a reason; do not run it without explicit user consent.
   - If you cannot run a check at all (missing tooling, no test framework configured), record it as `not-run` with a reason instead of fabricating a result.

3. **Judge the outcome**
   - Mark the fix as:
     - **verified** — all critical checks pass and the original symptom no longer reproduces.
     - **partial** — the original symptom is gone but unrelated regressions appeared, or some checks are inconclusive.
     - **failed** — the symptom still reproduces or the regression suite is broken by the fix.
   - Do not over-claim. If reproduction was not actually performed (e.g., the bug required a production environment), say so explicitly.

4. **Write the verification report**

   Write to `BUG_DIR/test.md` using this structure:

   ```markdown
   # Bug Verification: <short title>

   - **Slug**: <BUG_SLUG>
   - **Tested**: <ISO 8601 date>
   - **Assessment**: ./assessment.md
   - **Fix**: ./fix.md
   - **Result**: verified | partial | failed

   ## Summary

   <One or two sentences: does the bug reproduce, did the fix hold, were any regressions found.>

   ## Checks Performed

   | Check | Command / Action | Result | Notes |
   |-------|------------------|--------|-------|
   | Reproduction (post-fix) | <command or manual steps> | pass / fail / skipped / not-run | <short note> |
   | New / updated tests | `<command>` | pass / fail | <short note> |
   | Regression suite | `<command>` | pass / fail / skipped | <short note> |
   | Lint / type-check | `<command>` | pass / fail / skipped | <short note> |

   ## Output Excerpts

   <Short snippets of relevant output (e.g., final summary line of a test run, the failing assertion). Keep it tight — no full logs.>

   ## Residual Risks

   - <known limitation, environment not covered, etc.>

   ## Recommendation

   <One paragraph. Examples:>
   - "Close the bug — verified end-to-end."
   - "Hold — reproduction inconclusive; needs verification in staging."
   - "Reopen — symptom still reproduces; rerun `$speckit-bug-assess`."
   ```

## Mandatory Post-Execution Hooks

**You MUST complete this section before reporting completion to the user.**

By this point `BUG_SLUG` and `BUG_DIR` have been resolved and the written report is available, so a hook command run in this session can reuse them from the conversation; nothing is passed to it automatically.

Check if `.specify/extensions.yml` exists in the project root.
- If it does not exist, or no hooks are registered under `hooks.after_bug_test`, skip to the Completion Report.
- If it exists, read it and look for entries under the `hooks.after_bug_test` key.
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue to the Completion Report.
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `$speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Mandatory hook** (`optional: false`) — **You MUST emit `EXECUTE_COMMAND:` for each mandatory hook**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## Completion Report

**Report back** with:

- The slug and `BUG_DIR/test.md` path.
- The result (`verified`, `partial`, `failed`).
- If the result is `failed`, recommend re-running `$speckit-bug-assess` with the new evidence captured in `test.md`.

## Guardrails

- This command MUST NOT modify source code. It only runs checks and writes inside `.specify/bugs/<slug>/`.
- Never overwrite an existing `test.md` without confirmation.
- Never mark a fix as `verified` based on tests alone if the original assessment listed a reproduction that you did not actually exercise — downgrade to `partial` and say so.

<!-- easeus-sdd:core:end -->
交付时说明实际测试、结果与未验证事项；未执行或失败的工作不得宣称通过。
