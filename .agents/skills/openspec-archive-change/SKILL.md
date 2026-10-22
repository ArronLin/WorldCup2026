---
name: openspec-archive-change
description: Archive a completed OpenSpec change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. Also use when the user says "openspec archive" or "opsx archive".
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

Archive a completed change in the experimental workflow.

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `openspec status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `openspec/` root.

**Project check:** These steps expect a project that already uses OpenSpec. Before the first step that writes anything (`new change`, `archive`, `sync specs`, or authoring an artifact file), confirm the project has a root: run `openspec list --json` (with `--store <id>` when a store is selected, since the store is then the root) and read `root`. A root object means the project is set up. `"root": null` means it is not - there is no `openspec/` directory here, and a write such as `openspec new change` would create one as a side effect. The command also exits non-zero, which is that answer rather than a broken CLI, so read the JSON instead of retrying or working around it.

One `"root": null` is not about setup: when a `status` error message starts with `Declared in` or `Invalid store declaration in` and names this project's `openspec/config.yaml` (or `config.yml`), the project does use OpenSpec through a store it declares, which this machine cannot resolve (the store is not registered, or the `store:` line is malformed). Do not treat it as uninitialized and skip the branches below: stop before writing and show the user that error's `message` and `fix`.

Otherwise, with no root, what happens next depends on how this workflow was reached:

- **Auto-selected**: you chose this workflow yourself, without the user naming OpenSpec, naming this skill, or running its slash command. Stop using OpenSpec and answer the request normally, as you would with no OpenSpec installed. Do not ask them to set anything up and do not mention OpenSpec setup.
- **Explicit OpenSpec request**: the user named OpenSpec, named this skill, or ran its slash command. Stop before writing and ask how to proceed: set this project up (`openspec init`), target a store they already have (`--store <id>`), or continue without OpenSpec for this request. Wait for their answer.

In both branches, never create the root as a side effect: do not run `openspec init` until the user asks for it, do not hand-create `openspec/` files, and do not let a command create it.

`<capability-path>` is the spec directory relative to `specs/` (for example, `user-auth` or `identity/user-auth`). Preserve the full path from each delta spec when resolving its main spec.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and ask the user to select one

   When prompting, show only active changes (not already archived).
   Include the schema used for each change if available.

   Always announce: "Using change: <name>" and how to override (e.g., `$openspec-archive-change (Codex) or /openspec-archive-change (other agents) <other>`).

   **Load current archive inputs before the existing archive checks:**

   After resolving the selected change and planning root, run:
   ```bash
   openspec instructions archive --change "<name>" --json
   ```
   Keep the same selected-root flags on this command. This lookup is advisory and
   optional: it only supplies extra prompt inputs, so it must never block archiving.
   If it exits non-zero or returns invalid JSON — for example on an older CLI that
   does not support this command yet — continue the archive workflow with no
   context and no operation guidance. Do not report an error and do not stop.

   A successful response may omit both optional fields. Treat `context` as a
   required prompt-level input: read and consider it, and apply relevant project
   facts, conventions, and constraints. Treat `operationGuidance` as optional
   additive advice: read and consider every entry, and follow entries that are
   applicable and compatible with the built-in archive workflow.

   Keep both fields separate from built-in steps, explicit user choices, resolved
   paths, CLI checks, and command contracts. If context conflicts with one of those
   controlling inputs, report the conflict and preserve the controlling value. If
   guidance is inapplicable or conflicts with a controlling input, do not follow it
   and explain why. Do not infer replacement paths, skipped prompts, or flags from
   either field, and do not copy their text verbatim into specs, change artifacts,
   or archive summaries unless the user separately asks for it. These are
   prompt-level behavior contracts, not enforceable checks.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: List of artifacts with their status (`done`, `skipped`, or other)

   **If any artifacts are neither `done` nor `skipped`** (skipped artifacts satisfy the requirement - the change declares skip_specs):
   - Display warning listing incomplete artifacts
   - Ask the user to confirm they want to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Run `openspec list --json` with the same selected-root flags and find the
   entry in `changes` whose `name` exactly matches the selected change.
   Require exactly one match and nonnegative integer `totalTasks` and
   `completedTasks`, with `completedTasks <= totalTasks`. The CLI resolves
   the schema's tracked task files, including custom artifact names, output
   paths, and globs.
   Incomplete tasks = `totalTasks - completedTasks`.

   Do not infer task completion from artifact status or the absence of a
   top-level `tasks.md`. If the lookup fails, returns invalid JSON, omits or
   duplicates the selected change, or returns invalid counts, report the problem
   and stop before syncing or archiving.
   The CLI counts only `x`/`X` checkbox markers as complete;
   other markers, including unfamiliar ones, remain incomplete.

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Ask the user to confirm they want to proceed
   - Proceed if user confirms

   **If `totalTasks` is zero:** Proceed without a task-related warning.

4. **Assess delta spec sync state**

   Use `artifactPaths.specs.existingOutputPaths` from status JSON as the only
   delta-spec source. If the `specs` entry is missing or
   `existingOutputPaths` is empty, proceed without a sync prompt and do not infer
   delta specs from other artifacts.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `<planningHome.root>/openspec/specs/<capability-path>/spec.md` (use the store-aware `planningHome.root` from step 2, not a hardcoded repo path)
   - A missing main spec is **not automatically** "already synced". For a new capability, the main spec is an *output* of the sync, not an input:
     - If the delta has MODIFIED or RENAMED requirements, report that only ADDED requirements can create a new main spec and mark that capability as sync-blocked. Never invent a requirement that has no current version.
     - Otherwise, if the delta has only REMOVED requirements and the change's `.openspec.yaml` declares `retire_capabilities: true`, the capability is already retired: count it as already synced, warn that there is nothing left to remove, and do not recreate the main spec. Apply this rule both now and when verifying a completed sync.
     - Otherwise, if the delta has no ADDED requirements, report that no sync is possible and mark that capability as sync-blocked. For a REMOVED-only delta, warn that there is no main spec to remove from and leave the main-spec tree unchanged. `openspec archive` refuses the unmarked REMOVED-only case with `Spec must have at least one requirement`.
     - Otherwise, count the capability as needing sync and name it in the summary (`<capability-path>: new main spec will be created`). If the delta also has REMOVED requirements, warn that they will be ignored because there is no main spec to remove from. The sync creates the main spec from only the delta's ADDED requirements, exactly as `openspec archive` does.
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Continue assessing the remaining capabilities even when one is sync-blocked. Show a combined summary before prompting.

   **Prompt options:**
   - If any capability is sync-blocked: explain why and offer only "Archive without syncing", "Cancel"
   - Otherwise, if changes needed: "Sync now (recommended)", "Archive without syncing"
   - Otherwise, if already synced: "Archive now", "Sync anyway", "Cancel"

   Route on the answer:
   - "Cancel" — stop, do not archive
   - "Archive without syncing" or "Archive now" — proceed to archive
   - "Sync now" or "Sync anyway" — sync, then verify (below). Do not start any sync while a capability is sync-blocked; explain the blocker and repeat the available choices.
   - Anything else — ask again rather than archiving

   Before a selected sync writes any main spec, run
   `openspec instructions specs --change "<name>" --json` once with the same
   selected-root flags. Require a zero exit status and valid artifact-instruction
   JSON. If the lookup fails or returns invalid JSON, report the error and stop
   before writing any main spec or moving the change. A valid response with omitted
   `rules` is the no-rules case. Apply returned `rules` only to the content and
   form of main specs produced by this merge; do not use them as archive guidance,
   change CLI behavior, or copy the rule text into any output file.

   Then run the `openspec-sync-specs` workflow inline (agent-driven intelligent merge) for change '<name>', passing the delta spec analysis and the fetched specs-rule snapshot from above, and wait for it to finish. The inline sync must reuse that snapshot without fetching `specs` instructions again. Do not delegate it to a background task — step 5 would move `changeRoot` out from under a sync that is still reading it, leaving the change archived and the main specs never updated. If your agent can only run it by delegation, delegate synchronously and wait for the result.

   Then re-run the comparison from the top of this step, including the explicitly retired, missing-spec case, against every capability that has a delta spec in `artifactPaths.specs.existingOutputPaths` — not only the ones the sync reports it touched. A successful sync leaves nothing left to apply, so each capability must now read as already synced:
   - ADDED requirements present
   - MODIFIED requirements carrying the scenario and description changes named in the delta, with their other scenarios intact
   - REMOVED requirements gone — and where this sync retired a capability (removed its last requirement, leaving `## Requirements` empty), its main spec deleted rather than left empty; a spec the sync deliberately kept and reported is also a match
   - RENAMED requirements present under the new name and absent under the old one

   If the sync failed, or any capability does not match, report what differs and stop — do not archive. Nothing has moved and `changeRoot` is intact, so the user can fix the mismatch or re-run the sync and start the archive again.

5. **Perform the archive**

   Create an `archive` directory under `planningHome.changesDir` if it doesn't exist:
   ```bash
   mkdir -p "<planningHome.changesDir>/archive"
   ```

   Generate the target name: use the change name as-is when it already starts with a `YYYY-MM-DD-` prefix; otherwise prepend the current date as `YYYY-MM-DD-<change-name>`. Never stack a second date (same rule as `openspec archive`).

   **Check if target already exists:**
   - If yes: Fail with error, suggest renaming existing archive or using different date
   - If no: Move `changeRoot` to the archive directory

   ```bash
   mv "<changeRoot>" "<planningHome.changesDir>/archive/<target-name>"
   ```

6. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Whether specs were synced (if applicable)
   - Note about any warnings (incomplete artifacts/tasks)

**Output On Success**

```markdown
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/<target-name>/
**Specs:** <"✓ Synced to main specs" only if the step 4 verification passed; otherwise "No delta specs" or "Sync skipped">

<"All artifacts complete. All tasks complete." — or, if archived with warnings, list them instead (e.g. "Archived with 2 incomplete tasks")>
```

**Guardrails**
- Announce the selected change; prompt for selection when it is ambiguous
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- If sync is requested, run the `openspec-sync-specs` workflow inline (agent-driven)
- Never archive while a spec sync is still in flight — run the sync inline and verify the main specs before moving `changeRoot`
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
- Apply relevant runtime context and report conflicts; operation guidance remains advisory
- Consider every guidance entry and explain any inapplicable or conflicting advice
- Existing CLI checks, resolved paths, prompts, and command contracts are unchanged
- Artifact rules constrain only the specs being written and are never operation guidance
- Never copy runtime context, operation guidance, or artifact-rule text verbatim into output files

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
