# Spec Delta

<!-- 使用简体中文描述已确认的外部行为，保留 Requirement、Scenario、WHEN、THEN 等固定标记。只定义行为与验收，不放入内部函数名、工具选择、实施步骤或报告采集方案。源码和知识库用于说明现状；期望以已确认需求为依据，差异与未知如实记录。 -->
<!-- 每个能力使用 proposal 中的精确路径。新能力保留 Purpose；已有能力删除 Purpose。依据变更选用 Schema 支持的 ADDED、MODIFIED、REMOVED、RENAMED Requirements 二级标题，不将修改或删除误写为新增。MODIFIED 必须保留精确需求名并提供完整更新后的需求及全部场景；REMOVED 使用 **Reason** 和 **Migration**；纯重命名使用 FROM:/TO:。 -->
<!-- 为需求及场景分配稳定 ID，通过注释或追溯映射保存，并在名称调整时保留关联。ID 不替换固定标题，不使 MODIFIED 的需求名偏离原规范。追溯映射在 design/tasks 中关联测试、生产逻辑和执行证据；此处不预填测试通过状态。 -->

## Purpose
<!-- New capabilities only: one or two sentences (50+ characters) on what this capability is for. Delete this section for an existing capability. -->

## ADDED Requirements

### Requirement: <!-- requirement name -->
<!-- requirement text -->
<!-- requirement-id: <stable-requirement-id> -->
<!-- 使用 SHALL 或 MUST 表达明确、可验证的规范性要求。描述适用对象、输入、可观察输出及必要约束。正常、边界、异常、恢复与兼容场景按已确认范围补充，不凭现状推导未经确认的新行为。每个行为需求至少有一个验收场景。 -->

#### Scenario: <!-- scenario name -->
<!-- scenario-id: <stable-scenario-id> -->
- **WHEN** <!-- condition -->
- **THEN** <!-- expected outcome -->

<!-- 重复上述需求与场景结构，保持场景标题恰为四个 #。条件应可构造，结果应可观察并能区分正确与错误行为；避免“正常工作”等无法判定的结果。与中英文界面、Hash 深链接、静态数据错误或可选 AI 相关时，只补充本功能实际需要且已确认的验收场景。 -->
<!-- 无 spec 级行为变化时不生成虚构需求；遵循变更 .openspec.yaml 的 skip_specs 和当前 Schema 指令。 -->

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
