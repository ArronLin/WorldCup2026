---
name: openspec-update-change
description: Update an OpenSpec change by revising its existing planning artifacts and keeping them coherent with one another. Use when the user wants to revise a change's plan, fold new decisions into it, or reconcile its artifacts after an edit. Also use when the user says "openspec update change" or "opsx update". If the user means the openspec update CLI command, which refreshes generated files, run that command instead. Never edits code.
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.13.2"
---
<!-- REPO_SDD_SCOPE:openspec:START -->
### 工作流隔离：OpenSpec
本区段及其下方正文仅在已明确选择 OpenSpec 工作流时生效；未选择时不得执行正文中的读取或阶段指令。
未指定工作流时，先询问用户：“本次使用 Spec Kit 还是 OpenSpec？”在获得回答前，不加载任一框架的规范、模板、专属约定或执行阶段命令。同时要求两套工作流时，先请用户选择本轮使用的一套，不自动拼接。普通代码说明、知识问答不必因此中断。
有效选择来自用户明确点名框架、用户显式调用对应技能或命令（openspec-*、/opsx:*），或适配向导明确标注本次框架。本轮已明确选择后，“继续”可沿用该选择；新任务未明确框架时重新询问。不能把目录存在、默认配置、历史任务或 Agent 自行触发技能当作用户选择。
选定 OpenSpec 后，只加载 openspec/ 内的规范、规则快照、模板及该框架的 Agent 专属约定，知识库使用 openspec_wizard 的本框架绑定。不得加载或套用另一框架（.specify/）的规范、模板、阈值或报告入口；另一框架的技能和共享文件受管区段保持不适用。工具缺失时报告问题，不改用另一框架兜底。
人工撰写的公共指令仍保留；公共指令与当前框架规则发生冲突时明确说明并询问，不静默合并政策。用户要求跨框架迁移或比较时先确认范围，该授权不等于两套规则同时生效。
<!-- REPO_SDD_SCOPE:openspec:END -->

Revise a change's existing planning artifacts and keep them coherent. Never edit code.

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `openspec status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `openspec/` root.

**Project check:** These steps expect a project that already uses OpenSpec. Before the first step that writes anything (`new change`, `archive`, `sync specs`, or authoring an artifact file), confirm the project has a root: run `openspec list --json` (with `--store <id>` when a store is selected, since the store is then the root) and read `root`. A root object means the project is set up. `"root": null` means it is not - there is no `openspec/` directory here, and a write such as `openspec new change` would create one as a side effect. The command also exits non-zero, which is that answer rather than a broken CLI, so read the JSON instead of retrying or working around it.

One `"root": null` is not about setup: when a `status` error message starts with `Declared in` or `Invalid store declaration in` and names this project's `openspec/config.yaml` (or `config.yml`), the project does use OpenSpec through a store it declares, which this machine cannot resolve (the store is not registered, or the `store:` line is malformed). Do not treat it as uninitialized and skip the branches below: stop before writing and show the user that error's `message` and `fix`.

Otherwise, with no root, what happens next depends on how this workflow was reached:

- **Auto-selected**: you chose this workflow yourself, without the user naming OpenSpec, naming this skill, or running its slash command. Stop using OpenSpec and answer the request normally, as you would with no OpenSpec installed. Do not ask them to set anything up and do not mention OpenSpec setup.
- **Explicit OpenSpec request**: the user named OpenSpec, named this skill, or ran its slash command. Stop before writing and ask how to proceed: set this project up (`openspec init`), target a store they already have (`--store <id>`), or continue without OpenSpec for this request. Wait for their answer.

In both branches, never create the root as a side effect: do not run `openspec init` until the user asks for it, do not hand-create `openspec/` files, and do not let a command create it.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

This workflow revises artifacts that already exist; it never creates missing ones. When an artifact is missing, `openspec status --change "<name>" --json` names the next one and `openspec instructions "<artifact-id>" --change "<name>" --json` explains how to write it.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes sorted by most recently modified, and ask the user to select one

   When prompting, present the top 3-4 most recently modified changes as options, showing:
   - Change name
   - Status (e.g., "0/5 tasks", "complete", "no tasks")
   - How recently it was modified (from `lastModified` field)

   Mark the most recently modified change as "(Recommended)" since it's likely what the user wants to update.

   Always announce: "Using change: <name>" and how to override (e.g., `$openspec-update-change (Codex) or /openspec-update-change (other agents) <other>`).

2. **Get the change's artifacts**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand current state. The response includes:
   - `schemaName`: The workflow schema being used (e.g., "spec-driven")
   - `artifacts`: Array of artifacts with their status ("done", "skipped", "ready", "blocked")
   - `isPlanningComplete`: Boolean indicating if all planning artifacts are complete. Older CLI versions expose the same value as `isComplete`.
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context. Use these instead of assuming repo-local paths.

   The artifact ids and paths come from the active schema - do NOT assume them, and do NOT branch on hardcoded artifact names. Custom schemas must work unchanged.

   The files to edit are `artifactPaths.<id>.existingOutputPaths` - the concrete files that exist on disk, already glob-expanded for glob artifacts (e.g. `specs/**/*.md`). Do NOT write to `resolvedOutputPath`: for a glob artifact it is still the glob pattern, not a real file.

3. **Understand the request**
   - If the user asked for a specific revision ("the design now uses X"), that is the starting edit.
   - If they only said "update" / "make this coherent", treat it as a coherence review: read the existing artifacts and check them against each other for contradictions, gaps, and duplication.

4. **Read and reconcile**
   - Read the artifact(s) the request touches and the change's other existing artifacts.
   - Draft the requested edit in the conversation, not in files. Work out exactly what it changes; step 5 owns every write. Then check every other existing artifact against the drafted edit - in ANY direction: an edit to a later artifact may require revising an earlier one, not only the other way around. Build order is a useful reading order, not a constraint on which artifacts may be revised.
   - Note everything that is now inconsistent, missing, or contradictory.
   - Propose revisions to files that already exist (`existingOutputPaths`). If an artifact has no existing output files and status `ready` or `blocked`, note it and point the user to `openspec instructions "<artifact-id>" --change "<name>" --json` for how to create them. Leave `skipped` artifacts untouched; do not treat them as missing or defer them to the continue workflow.
   - A glob artifact (e.g. `specs/**/*.md`) is marked `done` after at least one file matches, and the continue workflow only handles `ready` artifacts. When reconciliation identifies a missing file for a glob artifact whose `existingOutputPaths` is non-empty:
     1. Run `openspec instructions "<artifact-id>" --change "<name>" --json` and use its `instruction` and `template`. Treat `context` and `rules` as constraints; do not copy them into the file. If instructions report `skipped: true`, do not create the file. Read current dependency files from disk; if a required non-skipped dependency is missing, stop and ask the user to restore it first.
     2. Choose a concrete path inside `changeRoot` that matches `artifactPaths.<id>.outputPath` and does not already exist. Verify it remains inside `changeRoot` after resolving any symlinked parent directories. The glob `resolvedOutputPath` is not a valid target.
     3. Include the new file in step 5's proposed revisions and create it only after the user confirms.
     4. After confirmation, immediately before creation, refresh status and instructions. Verify the artifact is still in scope, not skipped, and partially populated; repeat the concrete-path checks above.
     5. Use a create operation that fails if the target already exists. If `instruction` delegates creation to another skill or command, invoke it only if it can honor the confirmed path and these guardrails; otherwise stop. If any check fails or the confirmed draft is no longer valid, stop and reconcile with the user rather than replacing existing content or choosing a different path.
   - If the change is already coherent, say so and propose no revisions.

5. **Confirm and apply, one artifact at a time**
   - This step performs every artifact write in this workflow; no earlier step edits an artifact.
   - Show each proposed revision and why - including the requested edit drafted in step 4. Write only after the user confirms.
   - If the user rejects a revision, do not write it - leave that artifact unchanged.
   - When a substantial rewrite is needed, get that artifact's rules and template first:
     ```bash
     openspec instructions "<artifact-id>" --change "<name>" --json
     ```

6. **Point to the next step (guidance only - NEVER act on it)**
   - Artifacts with empty `existingOutputPaths` and status `ready` or `blocked` -> run `openspec status --change "<name>" --json` for the next artifact and point the user to `openspec instructions "<artifact-id>" --change "<name>" --json` for how to create it.
   - Change already implemented (tasks checked off / already applied) -> the code may no longer match the revised plan; suggest `$openspec-apply-change (Codex) or /openspec-apply-change (other agents)` to carry the delta into code.
   - Everything done and implemented -> suggest `$openspec-archive-change (Codex) or /openspec-archive-change (other agents)`.

**Output**

After each invocation, show:
- Which artifacts were revised (and which proposed revisions were rejected)
- Any file created under a glob artifact that was already partially populated
- Anything deferred because it does not exist yet (artifacts with no files and status `ready` or `blocked`, never `skipped` artifacts)
- Where the change stands and the recommended next command

**Guardrails**
- Planning artifacts only - NEVER edit implementation code. If the revised plan implies code changes, stop and point to `$openspec-apply-change (Codex) or /openspec-apply-change (other agents)`.
- Use the artifact ids and paths reported by `openspec status`; never branch on hardcoded artifact names.
- Edit only the concrete files in `existingOutputPaths`; never write to a glob `resolvedOutputPath`.
- Do not advance the build frontier: if an artifact has empty `existingOutputPaths` and status `ready` or `blocked`, creating them is a separate step, outside this workflow. Leave `skipped` artifacts untouched. The only new-file scope is a confirmed concrete path under a glob artifact whose `existingOutputPaths` is non-empty.
- Confirm every edit with the user before writing.
- If the request changes the change's *intent* rather than refining it, ask for a distinct unused change name and recommend `openspec new change "<new-change-name>"` instead (the "Update vs. Start Fresh" heuristic).

<!-- REPO-SDD-OPENSPEC:RULES:START -->
<!-- rules:620a5b53d7324e8bcb82c0b4cb75fbbe4332a4705f7faf038741a0fd0b21b705 -->
仅适用于 OpenSpec 工作流。先读取 `openspec/easeus/project-rules.md` 和当前规则快照。
使用 openspec_wizard MCP 先查询 opendeepwiki__<工具名>，再 codegraph__<工具名>，最后核实当前文件。
### 交互与产物语言
使用简体中文交互和编写自然语言产物；命令、标识符与固定标记保持兼容。

### 真实 TDD
新增或修改的可单测行为与缺陷修复执行真实 Red → Green → Refactor，记录实际失败与通过证据，不伪造历史 Red。

### 新增生产代码单测行覆盖率
仅新增自有生产代码的单元测试行覆盖率不低于 80%；以本功能明确基线计算新增可执行行的未舍入汇总比值，不要求存量代码或全项目达到 80%。集成或端到端覆盖率不能替代该指标，无新增可执行行记为不适用。

### 有效测试与完成证据
测试必须调用真实被测生产逻辑，包含能识别错误行为的断言并实际发现和执行。禁止占位成功、恒真断言、mock 掉被测核心、静默跳过与无证据勾选完成；关键控制逻辑采用可恢复的反向验证或适用变异测试。

### 来源与事实核实
知识库与源码说明现状，已确认需求定义期望；关键结论记录来源与适用版本，未知必须明确，现状缺陷不得自动固化为规范。

### 功能测试 HTML 报告
按选定设置生成本功能报告，使用真实测试结果和可追溯证据，缺失或失败必须如实展示。
- 规划变更时先用 OpenDeepWiki 理解背景，再用 CodeGraph 定位实现与调用关系；索引未命中、路径错配或版本不明时，用 repo_read 核对当前文件。记录来源、版本未知项及需求与现状的差异，不以未命中推断文件不存在，也不把现状缺陷写成期望行为。
- 在 OpenSpec design/tasks 中把验收场景关联到真实生产逻辑、测试源码及实际 Red/Green/Refactor 证据，关键控制逻辑关联可恢复反向验证。按已确认答案逐功能明确生产范围、排除项和基线；将结果采集、单元覆盖率适配及两类 HTML 报告缺口列为具体任务。新增自有生产代码的单测行覆盖率按未舍入汇总比值判断是否达到 80%，无新增可执行行标记不适用；缺失或未执行的证据如实保留，不勾选完成。
## 当前启用的功能报告
入口：`powershell.exe -NoProfile -ExecutionPolicy Bypass -File openspec/easeus/reporting/run.ps1 <doctor|spec-index|baseline|check|run|finalize> --feature openspec/changes/<变更>`。先 spec-index 获取各能力的 OSR/OSS 稳定 ID 和精确来源位置，建立 traceability.json 到真实测试的映射。新增、修改、删除、改名均须明确处理，手工或不适用项注明原因和确认人。首次生产修改前 baseline --confirm-before-changes；doctor 暴露缺口时在 design/tasks 安排采集适配任务。真实 run --phase red/green/refactor 记录过程，缺失历史 Red 不补造。使用仓库自己的测试命令和标准格式结果，不限定语言、测试框架或包管理器。最终各套件 run --phase final 后 finalize，核对 HTML、report-status.json 及退出码，未通过不得勾选报告完成任务。归档前核实报告当前有效；这是应用提供的检查，不是 OpenSpec 原生强制归档门禁。

仅当前 Agent 另读 `openspec/easeus/agents/codex.md`。
<!-- REPO-SDD-OPENSPEC:RULES:END -->
