<!-- easeus:requirements:8bae3a8445bb51712402500c925c1b174a4c8ac44ef17361dc2909851651c8d1 -->
<!-- 生成指导：遵守当前规则快照与宪法，不复制工程规则全文或新增规则说明章节；仅将本阶段需要的决策、任务或验收写入产物。 -->
正文开头增加“评审摘要”，只列本次修订、需确认的治理决定、影响范围和主要风险。原则按长期主题分组，每条原则只表达一项可执行、可检查的要求；修订说明、来源和细节后置，不复制背景或原始日志。
记录来源、适用版本、关键差距与待决定事项。保持该阶段原有职责，不将未执行验证标为通过。




<!-- repo-sdd:manual-testing:v1 -->
以下是生成和执行指令，只在原有产物记录必要信息，不新增平行任务文件、工作项或证据包。

### 混合任务与人工交接

先读项目已有验收、审批和发布约定（包括宪法及其引用），再核对当前规格的验收场景。默认不新增最终人工验收任务。仅为项目约定或已明确的功能需求生成必要人工测试、评审或验收；现有人工任务已覆盖要求时不重复增加。负责人或发布影响不清楚时走原有澄清流程。当前机器缺少设备、数据或权限但其他环境能自动运行的任务仍归 AI/AUTOMATED_TEST，用 `Blocked reason` 说明当前限制。不要把失败或缺失实现转成人工任务。不降低启用规则和既有门槛；停用规则保持停用。

在现有任务文档中，需要混合任务或显式依赖时写入 `<!-- repo-sdd:hybrid-tasks:v1 -->`，保留原生 Markdown checkbox、任务 ID、[P]、[USn] 等。`[AI]` 或无执行者标记沿用 Agent 执行，人工用 `[MANUAL]`，人工测试用 `[MANUAL] [TEST]`。`Type` 可为 DEVELOPMENT、AUTOMATED_TEST、MANUAL_TEST、REVIEW、ACCEPTANCE 或 OTHER。用缩进的说明行写字段，字段名保持固定，字段值遵循项目语言。用 `Dependencies: T010, T011` 表示真正的前置任务。人工项写 `Owner`（执行人或角色）、`Environment`（环境）、`Reason`（原因）、`Steps`（步骤）、`Expected`（预期）、`Evidence`（既有记录位置）和 `Required for release: true` 或 `false`。默认阻塞发布。只有确需正式人工签收时才用 `Final acceptance: true`，可加依赖要求先完成其他任务。没有人工任务时不输出空分组。已启用文档若明确选择停用，保留 `<!-- repo-sdd:hybrid-tasks:v1 {"enabled":false} -->` 并执行原生规则；旧文件未经确认不自动转换。

执行前读取整份清单。对启用混合任务的文件，运行当前框架 `workflow/run.ps1 inspect-tasks --tasks <仓库相对路径>`，或使用同目录 `python -B runtime.py inspect-tasks --project . --rules <当前规则快照> --tasks <仓库相对路径>`。运行组件路径见当前框架的项目指南和规则目录。可用 `--story US1`、`--phase <标题>`、`--task-id <ID>`（可重复）限制批次；前置任务仍跨批次检查。执行 `ready_ai`，完成后按原生格式更新 AI 复选框并重算。保持人工项未勾选，阻塞依赖未完成人工项的任务，继续独立任务。发现非法依赖或循环时报告并修正清单，不假装完成。对旧清单先读其已有交接约定；不得仅凭自由文本跳过原生任务。

交接时列出已完成和剩余 AI 任务数、待人工验收项、被阻塞任务及原因、实际自动化测试结果、可交给 QA 的范围。`execution_batch_complete` 仅指当前批次暂无可执行任务，`implementation_complete` 核对整份清单的 AI 任务。人工通过后由授权人员填写 `Tester`、`Execution date`（YYYY-MM-DD）、实际环境（不同则补 `Actual environment`）、`Result: passed` 和实际测试记录（`Result evidence` 或已填写的 `Evidence` 链接），然后勾选。失败保持未勾选，记录 `Result: failed`、`Issue`、`Reproduction` 和证据，增加 `Related to: <人工任务 ID>` 的修复任务，修复后重新验证。Agent 不写入人工结果或勾选，也不删除未通过项。延期需现有流程批准并记录 `Required for release: false`、`Deferred by`、`Deferred until`、`Deferral reason`；待验收状态继续保留。

最终核对时先按原生流程检查实现差距和真实测试，再在适当的已完成任务记录 `Implementation review: passed`、`Reviewed revision: <inspect-tasks 返回的 revision>`。只有完成了实际核对才记录，正式人工验收项的结果和复核修订由授权人员填写。没有人工验收要求时，可以在现有 AI 验证任务内记录复核，无需增设人工任务。`FINALIZED` 表示当前修订的任务和验收记录齐备，测试、CI 与审批真实性由项目原有机制核验。只读询问不得改文件；续做先核对剩余任务。需求变更使结果失效时，保留历史并重新打开受影响项。

Spec Kit：已启用混合任务的文档在 implement 中按当前可执行 AI 项推进；原生全量完成条件仍用于最终交付。plan/tasks 分开本地验证和人工交接；analyze 不把已明确交接的测试当作任务遗漏。checklist 仍用于需求质量，不把人工执行用例搬进需求质量检查清单；原有检查清单门禁保持。converge 继续核对实现差距，人工任务未完成时报告 Pending Manual QA；仍有被阻塞的实现则列明，不能给出全量 Converged 结论。TinySpec 在原单文件内使用同一交接方式，done 只表示开发实施已完成，另明确待人工验收。官方 Bug 沿用 assessment.md、fix.md、test.md；未执行用例不得写为 Result: Passed，不自动推进下一阶段。
