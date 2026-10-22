# Proposal

<!-- 使用简体中文填写自然语言，保留 Schema 固定标题、标记和标识符。结合当前有效规则、已评审项目画像、openspec/easeus/project-rules.md 的有效内容及本次已采纳约定；尚未落盘的评审候选不得描述为已安装配置。其他框架的受管区段不适用于本工作流。 -->

## Why

<!-- Explain the motivation for this change. What problem does this solve? Why now? -->
<!-- 用一至两句话说明已确认的问题、受影响对象和现在变更的原因。先用 OpenDeepWiki 理解背景，再用 CodeGraph 定位实现与调用关系；版本不明、索引未命中或路径错配时用 repo_read 核对当前文件。关键结论关联真实来源及适用版本，明确未知项和需求与现状的差异；不将现状缺陷自动写成期望。 -->

## What Changes

<!-- Describe what will change. Be specific about new capabilities, modifications, or removals. -->
<!-- 列出可观察能力的新增、修改、移除及范围边界；破坏性变更使用 **BREAKING**。说明本次不包含的行为，避免将技术方案、详细测试步骤或报告采集实现写在此处。技术选择放入 design.md，可验证实施工作放入 tasks.md。 -->

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Use kebab-case for path segments you introduce
     (e.g., user-auth or identity/user-auth) that follow the project's existing
     spec organization. Each creates specs/<capability-path>/spec.md. -->
- `<capability-path>`: <brief description of what this capability covers>

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use the exact existing path under openspec/specs/. Leave empty if no requirement
     changes. A change with no capabilities at all (pure refactor, tooling, docs)
     must set `skip_specs: true` in its .openspec.yaml - openspec validate rejects
     a zero-delta change without that marker. Do not invent a requirement just to
     satisfy validation. -->
- `<existing-capability-path>`: <what requirement is changing>

<!-- 填写前核对所选 OpenSpec 根中的能力清单并完整读取相关规范及场景；使用已有能力的精确完整路径，不用历史功能目录推断 OpenSpec 能力。每个列出的能力对应一个 delta spec。无行为变化时保留真实范围并按 Schema 使用 skip_specs，不为测试或报告治理虚构产品需求。 -->

## Impact

<!-- Affected code, APIs, dependencies, systems -->
<!-- 根据当前源码列出实际受影响模块、调用方、数据、词典、路由、依赖、部署和兼容面；仅填写本功能相关项。项目背景为原生 ES Modules、Hash 路由、静态赛事快照、共享查询逻辑和可选 Netlify AI，不能据此冻结全部既有实现。 -->
<!-- 说明需要的单元、集成或端到端验证，以及新增自有生产代码统计范围的预期变化。默认参考 src/**/*.js 与 netlify/functions/**/*.mjs，按功能确认新增路径和排除理由。 -->
<!-- 本次启用新增行单测覆盖率 HTML 与需求/TDD HTML 两类报告。若生产范围、测试源码、真实套件、结果格式、覆盖率或过程证据采集尚不可用，说明交付影响，并在 design/tasks 中安排具体适配工作；不直接复用历史功能或其他框架的报告入口，不宣称测试或覆盖率已达标。 -->

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
<!-- REPO-SDD-OPENSPEC:RULES:END -->
