---
name: speckit-constitution
description: Create or update the project constitution from interactive or provided
  principle inputs.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: preset:easeus-sdd
---

# Speckit Constitution Skill

<!-- REPO_SDD_SCOPE:speckit:START -->
### 工作流隔离：Spec Kit
本区段及其下方正文仅在已明确选择 Spec Kit 工作流时生效；未选择时不得执行正文中的读取或阶段指令。
未指定工作流时，先询问用户：“本次使用 Spec Kit 还是 OpenSpec？”在获得回答前，不加载任一框架的规范、模板、专属约定或执行阶段命令。同时要求两套工作流时，先请用户选择本轮使用的一套，不自动拼接。普通代码说明、知识问答不必因此中断。
有效选择来自用户明确点名框架、用户显式调用对应技能或命令（speckit-*、/speckit.*、sdd-speckit-*），或适配向导明确标注本次框架。本轮已明确选择后，“继续”可沿用该选择；新任务未明确框架时重新询问。不能把目录存在、默认配置、历史任务或 Agent 自行触发技能当作用户选择。
选定 Spec Kit 后，只加载 .specify/ 内的规范、规则快照、模板及该框架的 Agent 专属约定，知识库使用当前 Agent 已注册的原生 MCP，按 .specify/<命名前缀>/knowledge.json 核对服务、查询参数和目标仓库；不依赖 Studio 包装服务。不得加载或套用另一框架（openspec/）的规范、模板、阈值或报告入口；另一框架的技能和共享文件受管区段保持不适用。工具缺失时报告问题，不改用另一框架兜底。
人工撰写的公共指令仍保留；公共指令与当前框架规则发生冲突时明确说明并询问，不静默合并政策。用户要求跨框架迁移或比较时先确认范围，该授权不等于两套规则同时生效。
<!-- REPO_SDD_SCOPE:speckit:END -->

<!-- easeus-sdd:policy:v1 -->
## EaseUS SDD：本阶段约定
本次阶段：constitution。保持用户参数；先读取 .specify/easeus.json、.specify/easeus/requirements.json（若存在），以及当前宪法和阶段所需产物。
先以 OpenDeepWiki 理解背景，再以 CodeGraph 定位代码，结合当前源码核实。真实取证，不把工具调用成功当作内容已核实。
本阶段工作：形成长期工程原则和修订机制。
人工评审产物必须“摘要先行、需确认项集中、正文分层、细节后置”：开头集中展示本次修订、治理决定、待确认项和影响；每条原则只表达一项可执行、可检查的要求，实施细节和来源放在后部，不粘贴原始日志。
## 当前启用的工程规则
<!-- easeus:requirements:8bae3a8445bb51712402500c925c1b174a4c8ac44ef17361dc2909851651c8d1 -->
### 交互与产物语言
面向团队评审的自然语言使用简体中文，包括标题、小标题、表头、任务类别和状态说明；命令、路径、代码标识符及框架固定标记保持原样。必要术语首次出现时提供简短解释，后续不重复翻译；遵守项目已有的公共 API、国际化和文档约定，不照抄基础模板英文标题作为最终自然语言标题。

### 真实 TDD
新增或修改可单测行为及修复缺陷时，先编写测试并实际运行，确认测试因预期行为尚未实现而失败，再编写最小实现使测试通过，随后按需重构并回归验证。依赖、环境或语法错误不能作为有效的 Red；不得将事后补写测试宣称为 TDD。纯重构先确认已有测试通过，再重构并回归，不人为制造失败；遗留代码可先补描述现状的特征测试。缺陷无法稳定复现时先调查并说明限制，不编造失败；探索性原型、环境配置及纯视觉调整采用适用验证。不适用或无法可靠执行测试先行时说明原因及替代验证，不得宣称为 TDD。

### 可计量新增业务逻辑测试覆盖率
对本次新增或修改、可可靠采集的自有可执行业务逻辑，按项目明确的单元测试覆盖率指标和变更范围检查，默认门槛为 80%。计划中明确采用行、语句或分支覆盖率及计算范围，不混用指标，不以全项目覆盖率代替变更范围指标；关键行为、边界和错误路径不能因达标而省略测试。纯声明式 UI、生成代码、资源和配置可排除百分比分母，说明理由并采用适用的行为验证；不按文件类型整包排除，QML 内可执行 JavaScript 业务逻辑仍须单独评估，复杂逻辑优先移入可单测模块。无可靠采集能力记为未核验／能力缺口，不视为不适用，不得填成 0% 或 100%；qmlprofiler 等性能分析事件不能作为覆盖率证明。

### 有效测试与验证
测试必须调用真实被测生产逻辑，包含能识别错误行为的断言，并实际被发现和执行。禁止占位成功、恒真断言、替换被测核心逻辑与静默跳过；允许合理使用测试替身隔离网络、时钟、数据库、文件系统等外部依赖，并按风险补充集成验证。未实际执行或失败的测试不得宣称通过。对高风险或断言有效性存疑的逻辑，按需采用可恢复的反向验证或变异测试，不要求每次修改都执行。

### 来源与事实核实
知识库与源码说明现状，已确认需求定义期望；仅对影响需求、设计或兼容性判断的关键结论，在对应原生产物中简短记录必要来源与适用版本，不重复复制源码、知识库内容或工程规则全文。未知明确说明，现状缺陷不得自动固化为规范；知识库与当前源码不一致时指出差异，不仅凭更新时间推断谁正确。
以上规则来自已评审快照；未启用的规则不得按旧默认值恢复。已有规格或宪法与快照冲突时明确报告，交由用户处理。
本预设不授予额外写入或外部操作权限，不自动运行后续阶段。

<!-- easeus-sdd:core:start -->

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Scope Guard

This command's own work is limited to updating the project constitution itself. Dependent templates
and commands read the constitution at runtime and are not modified here.

- Classify every part of the user input as either constitution content or a separate,
  non-governance intent.
- If the input includes feature implementation, code generation, refactoring, building, or
  deployment requests, you **MUST NOT** execute them. Extract them as deferred intents instead.
- You **MUST NOT** create, modify, or delete application source files, feature routes,
  components, tests, deployment files, or other artifacts unrelated to the constitution
  workflow.
- If it is unclear whether an instruction is constitution content, ask for clarification before
  making changes.
- After completing the constitution update, include a `Next Actions` section for each deferred
  intent. List the original intent and suggest the appropriate follow-up Spec Kit command, such
  as `$speckit-specify`, without invoking it.
- If there are no non-governance intents, omit the `Next Actions` section.

## Pre-Execution Checks

**Check for extension hooks (before constitution update)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_constitution` key
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

    Wait for the result of the hook command before proceeding to the Outline.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

You are updating the project constitution at `.specify/memory/constitution.md`. The active
constitution scaffold is resolved at command time from `constitution-template` through the Spec Kit
preset/template resolution stack.

Follow this execution flow:

1. Run `.specify/scripts/powershell/resolve-template.ps1 constitution-template -Json` from the repository root and parse `TEMPLATE_CONTENT` as the active template.
   - The shared resolver applies project overrides, composing preset layers, and extension layers
     before the core template fallback. It MUST succeed before continuing.
   - If it fails, stop and report the resolution error; do not continue with only one contributing
     template layer.
   - If `.specify/memory/constitution.md` exists, load it as the source of current project-specific
     values and amendments. Preserve information that is still applicable when applying the newly
     resolved scaffold.
   - If it does not exist, use the resolved template as the initial document.
   - Do not write back to any versioned template layer.
   - Identify every placeholder token of the form `[ALL_CAPS_IDENTIFIER]`.
   **IMPORTANT**: The user might require less or more principles than the ones used in the template. If a number is specified, respect that - follow the general template. You will update the doc accordingly.

2. Collect/derive values for placeholders:
   - If user input (conversation) supplies a value, use it.
   - Otherwise infer from existing repo context (README, docs, prior constitution versions if embedded).
   - For governance dates: `RATIFICATION_DATE` is the original adoption date (if unknown ask or mark TODO), `LAST_AMENDED_DATE` is today if changes are made, otherwise keep previous.
   - `CONSTITUTION_VERSION` must increment according to semantic versioning rules:
     - MAJOR: Backward incompatible governance/principle removals or redefinitions.
     - MINOR: New principle/section added or materially expanded guidance.
     - PATCH: Clarifications, wording, typo fixes, non-semantic refinements.
   - If version bump type ambiguous, propose reasoning before finalizing.

3. Draft the updated constitution content using the resolved template as the required structure:
   - Replace every placeholder with concrete text (no bracketed tokens left except intentionally retained template slots that the project has chosen not to define yet—explicitly justify any left).
   - Preserve heading hierarchy and comments can be removed once replaced unless they still add clarifying guidance.
   - Ensure each Principle section: succinct name line, paragraph (or bullet list) capturing non‑negotiable rules, explicit rationale if not obvious.
   - Ensure Governance section lists amendment procedure, versioning policy, and compliance review expectations.

4. Produce a Sync Impact Report as an HTML comment at the top of the constitution file after update.
   This report is temporary scratch material for human review of the amendment, not governance
   content; it is expected to be removed before the amended constitution file is committed.
   - Version change: old → new
   - List of modified principles (old title → new title if renamed)
   - Added sections
   - Removed sections
   - Follow-up TODOs if any placeholders intentionally deferred.

5. Validation before final output:
   - No remaining unexplained bracket tokens.
   - Version line matches report.
   - Dates ISO format YYYY-MM-DD.
   - Principles are declarative, testable, and free of vague language ("should" → replace with MUST/SHOULD rationale where appropriate).

6. Write the completed constitution back to `.specify/memory/constitution.md` (overwrite).

7. Output a final summary to the user with:
   - New version and bump rationale.
   - Any TODO placeholders or deferred items requiring manual follow-up.
   - Suggested commit message (e.g., `docs: amend constitution to vX.Y.Z (principle additions + governance update)`).
   - A `Next Actions` section for any deferred non-governance intents.

Formatting & Style Requirements:

- Use Markdown headings exactly as in the template (do not demote/promote levels).
- Wrap long rationale lines to keep readability (<100 chars ideally) but do not hard enforce with awkward breaks.
- Keep a single blank line between sections.
- Avoid trailing whitespace.

If the user supplies partial updates (e.g., only one principle revision), still perform validation and version decision steps.

If critical info missing (e.g., ratification date truly unknown), insert `TODO(<FIELD_NAME>): explanation` and include in the Sync Impact Report under deferred items.

Write only `.specify/memory/constitution.md`; do not create or modify template source files.

## Post-Execution Checks

**Check for extension hooks (after constitution update)**:
Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.after_constitution` key
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

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

<!-- easeus-sdd:core:end -->
交付时说明实际来源、未知及已执行验证；未执行或失败的工作不得宣称通过。


<!-- repo-sdd:manual-testing:v1 -->
以下是生成和执行指令，只在原有产物记录必要信息，不新增平行任务文件、工作项或证据包。

### 混合任务与人工交接

先读项目已有验收、审批和发布约定（包括宪法及其引用），再核对当前规格的验收场景。默认不新增最终人工验收任务。仅为项目约定或已明确的功能需求生成必要人工测试、评审或验收；现有人工任务已覆盖要求时不重复增加。负责人或发布影响不清楚时走原有澄清流程。当前机器缺少设备、数据或权限但其他环境能自动运行的任务仍归自动化测试，用“阻塞原因”说明当前限制。不要把失败或缺失实现转成人工任务。不降低启用规则和既有门槛；停用规则保持停用。

启用简体中文规则时，所有本次生成或更新的 Markdown（含规格、计划、研究、数据模型、契约、快速验证、检查清单和任务交接）在交付前检查标题、表头、字段名、类别、状态和说明，全部采用简体中文。命令、路径、代码标识符、框架要求的固定语法和验收所需的原文文案照实保留。不要把英文工具输出、模板标签或内部字段名当作评审正文。

需要混合任务或显式依赖时，在原任务文档写入 `<!-- repo-sdd:hybrid-tasks:v1 -->`，保留复选框、任务 ID、[P]、[USn] 等。中文清单的人工项用 `[人工]`；无执行者标签时沿用 Agent 执行。“类型”可填开发、自动化测试、人工测试、评审、验收或其他。用缩进说明行写 `依赖：T010, T011`；人工项写“负责人”“环境”“原因”“步骤”“预期”“证据”和“发布必需：是”或“发布必需：否”。默认阻塞发布。确需正式签收时才写“最终验收：是”。没有人工任务时不输出空分组。明确停用时使用 `<!-- repo-sdd:hybrid-tasks:v1 {"enabled":false} -->` 并执行原生规则。

非中文清单可使用既有英文约定：[MANUAL]、Type（DEVELOPMENT / AUTOMATED_TEST / MANUAL_TEST / REVIEW / ACCEPTANCE / OTHER）、Dependencies、Owner、Environment、Reason、Steps、Expected、Evidence、Required for release、Final acceptance、Blocked reason、Related to、Tester、Execution date、Result、Result evidence、Actual environment、Issue、Reproduction、Deferred by、Deferred until、Deferral reason、Implementation review、Reviewed revision。布尔值使用 true / false，结果使用 passed / failed。已有英文任务仍可读取；中文清单不重复写英文别名。

执行前读取整份清单。对启用混合任务的文件，运行当前框架 `workflow/run.ps1 inspect-tasks --tasks <仓库相对路径>`，或使用同目录 `python -B runtime.py inspect-tasks --project . --rules <当前规则快照> --tasks <仓库相对路径>`。运行组件路径见当前框架的项目指南和规则目录。可用 `--story US1`、`--phase <标题>`、`--task-id <ID>`（可重复）限制批次；前置任务仍跨批次检查。执行 `ready_ai`，完成后按原生格式更新 AI 复选框并重算。保持人工项未勾选，阻塞依赖未完成人工项的任务，继续独立任务。发现非法依赖或循环时报告并修正清单，不假装完成。对旧清单先读其已有交接约定；不得仅凭自由文本跳过原生任务。

交接时列出已完成和剩余 AI 任务数、待人工验收项、被阻塞任务及原因、实际自动化测试结果和可交接范围。区分当前批次暂无可执行任务和整份清单的 AI 任务已完成。人工通过后由授权人员填写“执行人”“执行日期”（YYYY-MM-DD）“实际环境”“结果：通过”和“结果证据”，然后勾选。失败保持未勾选，记录“结果：失败”“问题编号”“复现步骤”和证据，修复项用“关联任务”引用人工任务 ID，修复后重新验证。Agent 不写入人工结果或勾选，也不删除未通过项。延期需按现有流程批准，记录“发布必需：否”“延期批准人”“延期截止日期”“延期原因”，保留待验收状态。

最终核对时先按原生流程检查实现差距和真实测试，再在适当的已完成任务记录“实施复核：通过”和“复核修订”（填 inspect-tasks 返回的 revision）。只有完成实际核对才记录，正式人工验收项的结果和复核修订由授权人员填写。没有人工验收要求时，可以在现有 AI 验证任务内记录复核。当前修订的任务和验收记录齐备后报告“已收尾”，测试、CI 与审批真实性由项目原有机制核验。只读询问不得改文件；续做先核对剩余任务。需求变更使结果失效时，保留历史并重新打开受影响项。

Spec Kit：已启用混合任务的文档在 implement 中按当前可执行 AI 项推进；原生全量完成条件仍用于最终交付。plan/tasks 分开本地验证和人工交接；analyze 不把已明确交接的测试当作任务遗漏。checklist 仍用于需求质量，不把人工执行用例搬进需求质量检查清单；原有检查清单门禁保持。converge 继续核对实现差距，人工任务未完成时报告“待人工验收”；仍有被阻塞的实现则列明，不能给出全量收敛结论。TinySpec 在原单文件内使用同一交接方式，done 只表示开发实施已完成，另明确待人工验收。官方 Bug 沿用 assessment.md、fix.md、test.md；未执行用例不得写为 Result: Passed，不自动推进下一阶段。
