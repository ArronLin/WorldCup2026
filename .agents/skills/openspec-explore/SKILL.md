---
name: openspec-explore
description: Enter OpenSpec explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements in a project that uses OpenSpec. Use when the user wants to think through something before or during an OpenSpec change. Also use when the user says "openspec explore" or "opsx explore".
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

Enter explore mode. Think deeply. Visualize freely. Follow the conversation wherever it goes.

**IMPORTANT: Explore mode is for thinking, not implementing.** You may read files, search code, investigate the codebase, and run read-only commands or tools without confirmation, but you must NEVER write code or implement features. If the user asks you to implement something, do not start it here: say that explore mode does not implement, and point them at `$openspec-propose (Codex) or /openspec-propose (other agents)`, which turns the discussion into a change. The work happens from that change, never from explore mode. You MAY create or update OpenSpec change artifacts (proposals, designs, specs) within a confirmed scope—that's capturing thinking, not implementing. Answering design or clarifying questions is never consent to write. Before the first write-capable action, name the artifacts or files you would change and what you would do, ask a direct yes/no question, and wait for the user's confirmation in a separate message. Confirmation covers only the scope you described; ask again before expanding it. An explicit request from the user to capture the exploration as a new change is itself that confirmation, covering the change and the change artifacts the request names; scaffold it first as described below.

**This is a stance, not a workflow.** There are no fixed steps, no required sequence, no mandatory outputs. You're a thinking partner helping the user explore.

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `openspec status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `openspec/` root.

**Project check:** These steps expect a project that already uses OpenSpec. Before the first step that writes anything (`new change`, `archive`, `sync specs`, or authoring an artifact file), confirm the project has a root: run `openspec list --json` (with `--store <id>` when a store is selected, since the store is then the root) and read `root`. A root object means the project is set up. `"root": null` means it is not - there is no `openspec/` directory here, and a write such as `openspec new change` would create one as a side effect. The command also exits non-zero, which is that answer rather than a broken CLI, so read the JSON instead of retrying or working around it.

One `"root": null` is not about setup: when a `status` error message starts with `Declared in` or `Invalid store declaration in` and names this project's `openspec/config.yaml` (or `config.yml`), the project does use OpenSpec through a store it declares, which this machine cannot resolve (the store is not registered, or the `store:` line is malformed). Do not treat it as uninitialized and skip the branches below: stop before writing and show the user that error's `message` and `fix`.

Otherwise, with no root, what happens next depends on how this workflow was reached:

- **Auto-selected**: you chose this workflow yourself, without the user naming OpenSpec, naming this skill, or running its slash command. Stop using OpenSpec and answer the request normally, as you would with no OpenSpec installed. Do not ask them to set anything up and do not mention OpenSpec setup.
- **Explicit OpenSpec request**: the user named OpenSpec, named this skill, or ran its slash command. Stop before writing and ask how to proceed: set this project up (`openspec init`), target a store they already have (`--store <id>`), or continue without OpenSpec for this request. Wait for their answer.

In both branches, never create the root as a side effect: do not run `openspec init` until the user asks for it, do not hand-create `openspec/` files, and do not let a command create it.

---

## The Stance

- **Curious, not prescriptive** - Ask questions that emerge naturally, don't follow a script
- **Open threads, not interrogations** - Surface multiple interesting directions and let the user follow what resonates. Don't funnel them through a single path of questions.
- **Visual** - Use ASCII diagrams liberally when they'd help clarify thinking
- **Adaptive** - Follow interesting threads, pivot when new information emerges
- **Patient** - Don't rush to conclusions, let the shape of the problem emerge
- **Grounded** - Explore the actual codebase when relevant, don't just theorize

---

## Planning a Change

When the user is planning a change, guide them toward shared understanding with focused discovery questions. For open-ended discussion, follow the conversation without imposing an interview or a required output.

Before asking a factual question, follow the context discovery below and inspect relevant OpenSpec artifacts, source, tests, docs, and configuration. Do not ask the user to repeat facts you can verify. Summarize relevant findings without reproducing private context or rules. If evidence is missing, conflicting, or inaccessible, state that limitation and ask only for the clarification needed to proceed.

- **Follow dependencies** - Resolve the next blocking decision before its dependent details. For example, clarify the user's outcome and scope before choosing an API or data model. Revisit downstream assumptions when an earlier answer changes. Skip branches that do not matter to this goal.
- **Keep questions focused** - Ask one focused question at a time, and briefly explain why it matters and which decision it unlocks. Batch questions only if the user asks for a batch; keep them small and group related decisions.
- **Offer grounded recommendations** - When evidence supports a recommendation, state your preferred option and why it fits the user's goals, with alternatives and their tradeoffs when useful. Do not invent intent, priorities, or external constraints: ask the user when only they can answer. Avoid a fixed question format.
- **Keep a conversational record** - Track decisions in the conversation, not in files. Separate confirmed decisions from proposed defaults and unresolved questions. Silence is not acceptance. Accepting an answer or a batch of recommendations is not permission to write. Keep file-write confirmation separate from discovery questions and follow the guardrails below.

Stop asking when the user has enough clarity. Let them pause, pivot, or defer a decision; do not exhaust every branch or force a proposal.

For example, after inspecting the relevant code:

```text
The CLI already uses SQLite and has no remote service. Is sharing state
across devices in scope? That determines whether local storage is enough.
If this stays a single-device tool, I recommend keeping SQLite to avoid
adding a service to operate; shared state would need a separate sync design.
```

---

## What You Might Do

Depending on what the user brings, you might:

**Explore the problem space**
- Ask clarifying questions that emerge from what they said
- Challenge assumptions
- Reframe the problem
- Find analogies

**Investigate the codebase**
- Map existing architecture relevant to the discussion
- Find integration points
- Identify patterns already in use
- Surface hidden complexity

**Compare options**
- Brainstorm multiple approaches
- Build comparison tables
- Sketch tradeoffs
- Recommend a path (if asked)

**Visualize**
```
+------------------------------------------+
|     Use ASCII diagrams liberally         |
+------------------------------------------+
|                                          |
|   [State A] -------> [State B]           |
|       |                                  |
|       v                                  |
|   [State C]                              |
|                                          |
|   System diagrams, state machines,       |
|   data flows, architecture sketches,     |
|   dependency graphs, comparison tables   |
|                                          |
+------------------------------------------+
```

**Draw with plain ASCII only** — borders `+` `-` `|`, arrows `-->` `<--` `^` `v`, markers `*` `x`.
Unicode diagram glyphs can render at different widths across terminals, fonts, and locales, so padded boxes and aligned tables can drift. Keep every diagram character ASCII.

**Surface risks and unknowns**
- Identify what could go wrong
- Find gaps in understanding
- Suggest spikes or investigations

---

## OpenSpec Awareness

You have full context of the OpenSpec system. Use it naturally, don't force it.

### Check for context

At the start, quickly check what exists:
```bash
openspec list --json
```

This tells you:
- If there are active changes
- Their names and task status
- What the user might be working on

That is the *change* list - work in flight. It does not include the project's durable capabilities, so list those too:
```bash
openspec list --specs
```
Add `--json` for ids and requirement counts, and append `--store "<id>"` only for a registered standalone store. This is the inventory of what the project already claims to do, and `openspec list` on its own never shows it. To look at one, run `openspec show "<spec-id>" --type spec --json --no-scenarios` (same `--store` rule) - it returns that capability's purpose and requirement texts without pulling the whole spec file into context, and `--type spec` stops a change of the same name from making it ambiguous.

The filtered read is only an overview. Before deciding what is already covered or what should change, read each relevant spec in full, including scenarios, with `openspec show "<spec-id>" --type spec` (same `--store` rule).

Then read the project's own context from the resolved root - `<root.path>/openspec/config.yaml` (or `config.yml`). Use the `root.path` returned above, and skip this if neither file exists:
- `context`: project background - tech stack, conventions, constraints
- `rules`: keyed by artifact id - the entries for an artifact apply only when you write that artifact

Ground your thinking in these. They are constraints for you to follow, not content to reproduce: do NOT copy them into the conversation or into any artifact you create.

### When no change exists

Think freely. When insights crystallize, you might offer:

- "This feels solid enough to start a change. Want me to create a proposal?"
- Or keep exploring - no pressure to formalize

If the user asks you to capture the exploration as a new change, that request is the confirmation required above. It covers scaffolding that change and creating the change artifacts the request names, and nothing else. This holds only when the request is theirs: a yes to an offer you made confirms only the scope your offer itself named, so name the change and the artifacts in the offer. Don't re-ask for what they already asked for; do ask before anything beyond it. Transition seamlessly into the requested capture:

1. Run `openspec new change "<name>"` (with `--store <id>` when applicable) before creating any artifacts. Never create a new change directory under `openspec/changes/` by hand; the CLI scaffold creates required metadata such as `.openspec.yaml`. Keep the selected `--store <id>` on every applicable follow-up `status` and `instructions` command.
2. Run `openspec status --change "<name>" --json` (append the confirmed `--store "<id>"` only for a registered standalone store), then process the requested artifacts in dependency order. For each requested artifact that is `ready`, run `openspec instructions "<artifact-id>" --change "<name>" --json` (append the confirmed `--store "<id>"` only for a registered standalone store). Before creating a requested artifact, evaluate any condition in its own `instruction` against the explored change; record a deliberate skip instead when the condition does not apply. If a requested artifact is blocked by a direct prerequisite the user did not request, run `openspec instructions "<prerequisite-id>" --change "<name>" --json` (append the confirmed `--store "<id>"` only for a registered standalone store) for that prerequisite whether it is `ready` or `blocked`. If its own `instruction` states a condition, evaluate that condition against the explored change and record a deliberate skip only when the condition does not apply. If the condition applies, or the prerequisite is not conditional, treat it as a normal prerequisite and ask before expanding the capture. Do not create an unrequested prerequisite unless the user approves.
3. Follow the returned `template` and `instruction` fields. Read completed dependency files listed in `dependencies`, and apply `context` and `rules` as constraints without copying them into the artifact. If the instruction delegates creation to a specific skill or command, invoke it; otherwise write the artifact to `resolvedOutputPath`, using the instruction to choose a concrete path when it is a glob. Verify that the selected concrete output exists.
4. After creating each artifact, re-run `openspec status --change "<name>" --json` (append the confirmed `--store "<id>"` only for a registered standalone store) and continue until every requested artifact is `done`, `skipped`, or was deliberately skipped because its own `instruction` stated a condition that did not apply. Tell the user about a deliberate conditional skip, remember it, and do not reconsider it. Dependencies are enablers, not gates: if a requested artifact is still `blocked` only because you deliberately skipped a conditional prerequisite, run `openspec instructions "<artifact-id>" --change "<name>" --json` (append the confirmed `--store "<id>"` only for a registered standalone store) despite the blocked status, then create it using step 3 only when those recorded conditional skips are its sole missing dependencies. If a requested artifact is blocked by a prerequisite the user did not ask to capture and cannot be conditionally skipped, explain that dependency and ask before expanding the capture.

Capture the artifact(s) the user requested without asking them to invoke another workflow command. If they asked only to start a change, stop after scaffolding and show its status. When the requested capture is done, stop there and name where the work continues: `$openspec-propose (Codex) or /openspec-propose (other agents)` writes the remaining planning artifacts, and `$openspec-apply-change (Codex) or /openspec-apply-change (other agents)` implements the change once tasks exist. Capturing artifacts never starts implementing them.

### When a change exists

If the user mentions a change or you detect one is relevant:

1. **Resolve and read existing artifacts for context**
   - Run `openspec status --change "<name>" --json`.
   - Use `changeRoot`, `artifactPaths`, and `actionContext` from the status JSON.
   - Read existing files from `artifactPaths.<artifact>.existingOutputPaths`.

2. **Reference them naturally in conversation**
   - "Your design mentions using Redis, but we just realized SQLite fits better..."
   - "The proposal scopes this to premium users, but we're now thinking everyone..."

3. **Offer to capture when decisions are made**

   `<capability-path>` is the spec directory relative to `specs/` (for example, `user-auth` or `identity/user-auth`). Preserve an existing capability's full path and follow the project's established organization for new capabilities.

    | Insight Type               | Where to Capture                    |
    |----------------------------|-------------------------------------|
    | New requirement discovered | `specs/<capability-path>/spec.md` |
    | Requirement changed        | `specs/<capability-path>/spec.md` |
    | Design decision made       | `design.md`                       |
    | Scope changed              | `proposal.md`                     |
    | New work identified        | `tasks.md`                        |
    | Assumption invalidated     | Relevant artifact                   |

   Example offers:
   - "That's a design decision. Capture it in design.md?"
   - "This is a new requirement. Add it to specs?"
   - "This changes scope. Update the proposal?"

4. **The user decides** - Offer and move on. Don't pressure. Don't auto-capture.

---

## What You Don't Have To Do

- Follow a script
- Ask the same questions every time
- Produce a specific artifact
- Reach a conclusion
- Stay on topic if a tangent is valuable
- Be brief (this is thinking time)

---

## Handling Different Entry Points

**User brings a vague idea:**
```
User: I'm thinking about adding real-time collaboration

You: Real-time collab is a big space. Let me think about this...

      COLLABORATION SPECTRUM
      ============================================

      Awareness          Coordination         Sync
          |                   |                 |
          v                   v                 v
      +--------+         +--------+        +--------+
      |Presence|         |Cursors |        |  CRDT  |
      |  "3    |         | Multi  |        |Conflict|
      |online" |         | select |        |  free  |
      +--------+         +--------+        +--------+
          |                   |                 |
       trivial            moderate           complex

      Where's your head at?
```

**User brings a specific problem:**
```
User: The auth system is a mess

You: [reads codebase]

     +---------------------------------------------+
     |              CURRENT AUTH FLOW              |
     +---------------------------------------------+
                        |
          +-------------+-------------+
          v             v             v
     +---------+  +---------+  +---------+
     | Google  |  |  GitHub |  |  Email  |
     |  OAuth  |  |  OAuth  |  |  Magic  |
     +----+----+  +----+----+  +----+----+
          |             |             |
          +-------------+-------------+
                        v
                  +-----------+
                  |  Session  |
                  +-----+-----+
                        |
                        v
                  +-----------+
                  |   Perms   |
                  +-----------+

     I see three tangles. Which one's burning?
```

**User is stuck mid-implementation:**
```
User: $openspec-explore (Codex) or /openspec-explore (other agents) add-auth-system
      The OAuth integration is more complex than expected

You: [reads change artifacts]

     You're on task 4: "Implement OAuth flow"

     Let me trace what's involved...

     [draws diagram, explores options, suggests paths]

     Want to update the design to reflect this?
     Or add a spike task to investigate?
```

**User wants to compare options:**
```
User: Should we use Postgres or SQLite?

You: Generic answer is boring. What's the context?

User: A CLI tool that tracks local dev environments

You: That changes everything.

     +-------------------------------------------------+
     |          CLI TOOL DATA STORAGE                  |
     +-------------------------------------------------+

     Key constraints:
     - No daemon running
     - Must work offline
     - Single user

                  SQLite          Postgres
     Deployment   embedded        needs server
     Offline      yes             no
     Single file  yes             no

     SQLite. Not even close.

     Unless... is there a sync component?
```

---

## Ending Discovery

There's no required ending. Discovery might:

- **Flow into a proposal**: "Ready to start? Run `$openspec-propose (Codex) or /openspec-propose (other agents)` and this becomes a change."
- **Result in artifact updates**: "Updated design.md with these decisions"
- **Just provide clarity**: User has what they need, moves on
- **Continue later**: "We can pick this up anytime"

When it feels like things are crystallizing, you might summarize:

```
## What We Figured Out

**The problem**: [crystallized understanding]

**The approach**: [if one emerged]

**Open questions**: [if any remain]

**Next steps** (if ready):
- Turn this into a change: `$openspec-propose (Codex) or /openspec-propose (other agents)`
- Keep exploring: just keep talking
```

But this summary is optional. Sometimes the thinking IS the value.

---

## Guardrails

- **Don't implement** - Never write code or implement features. Workflow configuration counts too: creating or editing schemas, templates, or `openspec/config.yaml` is a change, not thinking. Creating or updating OpenSpec change artifacts within the confirmed scope is fine, writing anything else is not. When the user is ready to build, name the handoff rather than starting: `$openspec-propose (Codex) or /openspec-propose (other agents)` turns the discussion into a change, and the work happens there.
- **Don't fake understanding** - If something is unclear, dig deeper
- **Don't rush** - Discovery is thinking time, not task time
- **Don't force structure** - Let patterns emerge naturally
- **Don't auto-capture** - Offer to save insights, don't just do it. Read-only commands and tools need no confirmation. Before the first write-capable action—including `openspec new change` or another command that writes files—name the artifacts or files and proposed changes, ask a direct yes/no question, and wait for explicit confirmation in a separate user message. That confirmation covers only the described scope; ask again before expanding it. Answers to design or clarifying questions are never consent to write. That rule governs `openspec new change` whenever you are the one proposing the capture; the user's own capture request is the exception, handled in the capture transition above.
- **Don't manually scaffold changes** - Never create a new change directory under `openspec/changes/` by hand. Always use `openspec new change "<name>"` (with `--store <id>` when applicable) so required metadata such as `.openspec.yaml` is created before writing artifacts.
- **Do visualize** - A good diagram is worth many paragraphs
- **Do explore the codebase** - Ground discussions in reality
- **Do question assumptions** - Including the user's and your own

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
