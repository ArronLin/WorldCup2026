# Design

<!-- 使用简体中文填写技术决策，保留原 Schema 结构。本文解释如何实现及验证，引用 proposal 的动机和 specs 的行为，避免重复。仅采用本次有效规则与已采纳约定，不加载另一框架的规范、Preset、专属命令或报告入口。 -->

## Context

<!-- Current state and constraints that shape the approach. See proposal.md for motivation - don't restate it -->
<!-- 记录本功能必要的源码现状、调用关系、运行环境和约束，并引用真实证据及适用版本。按 OpenDeepWiki → CodeGraph → 必要的 repo_read 核对；明确知识库版本关系、索引遗漏和需求与实现的差异。 -->
<!-- 当前工程参考：原生 ES Modules、src/views 与 src/features、src/shared/tournament-query、统一数据层、public/data 静态快照、public/i18n 词典和可选 Netlify Functions；Node.js 24+。只纳入实际受影响的边界，重大架构调整说明兼容与迁移依据。 -->
<!-- 明确本功能实施前基线：可解析的提交或不可变源码清单、已有未提交内容及其哈希、生产文件清单和比较方式。不能仅以分支名标识基线，也不能把当前已有功能实现冒充未来新增代码。尚未采集的基线明确标为待采集，并在 tasks 中安排于生产修改之前。 -->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->
<!-- 描述模块职责、数据流、兼容边界与验证目标；需求及场景使用稳定 ID 关联。明确新增自有生产代码单测行覆盖率门槛为 80%，以及两类 HTML 报告所需的证据能力。 -->

**Non-Goals:**
<!-- What is explicitly out of scope -->
<!-- 明确技术层面的非目标。80% 门槛不扩展为存量或全项目门槛；集成和端到端覆盖率不替代单元指标。无新增可执行行时该指标不适用；采集缺失不能当作不适用。 -->

## Decisions

<!-- Key design decisions with rationale and alternatives considered -->
<!-- 对每项关键技术选择说明理由、备选方案和影响。按需覆盖模块边界、共享语义、缓存与错误处理、双语界面、深链接及 AI 隔离；不能把既有缺陷当作设计目标。存在会改变 specs、方案或任务拆分的重大未知时先解决，不留作无约束的实施猜测。 -->
<!-- 验证设计：建立稳定的需求 ID → 场景 ID → 生产逻辑 → 测试源码路径/用例 ID/关键断言 → 实际执行记录 → Red/Green/Refactor 证据关联。区分 unit、integration、e2e，不能仅因测试使用 Vitest 或位于 tests/ 就将其全部认定为单元测试。skip_specs 变更使用真实任务验收目标建立关联，不虚构业务需求。 -->
<!-- TDD 设计：新增或修改的可单测行为及缺陷修复先编写调用真实生产逻辑的有效测试，实际执行并确认因目标行为缺失或错误而失败，再最小实现、通过及重构复跑。依赖故障或语法错误不作为有效目标 Red。记录命令、时间、退出码、实际发现/执行的用例、失败断言、原始结果位置及源码哈希；关联各阶段测试与生产源码，说明断言变化。历史 Red 缺失标为缺失，后续反向验证不能冒充历史 Red。 -->
<!-- 测试有效性：不得占位成功、恒真断言、mock 掉被测核心或静默跳过。关键控制逻辑设计可恢复的反向验证或适用变异测试，注明目标、预期失败、恢复方法及恢复后通过验证。 -->
<!-- 生产范围与覆盖率：逐功能确认 production_include、production_exclude 及排除理由，默认参考 src/**/*.js 和 netlify/functions/**/*.mjs，并补入实际新增自有生产路径。保存基线与最终源码的对应关系，计算相对基线新增行与最终生产可执行行的交集；包含未被导入或未命中的新增可执行行，不通过漏采缩小分母。按去重后的总覆盖新增可执行行数 / 总新增可执行行数，以未舍入汇总比值 >= 0.8 判定，不能平均文件百分比；分母为零记录不适用和依据。 -->
<!-- 通用报告适配：遵循 reporting 的 schema_version=1、contract_version=1 和 standard-formats 适配器契约。确认真实生产范围、test_include/test_exclude、测试源码清单及 suites；每个套件记录真实命令、工作目录、分类、结果与覆盖率来源、格式和输出位置。结果使用 unified/junit/trx 之一，覆盖率使用 unified/lcov/cobertura 之一。仓库 Vitest 与 LCOV 是可核实的接入来源，Playwright 另行分类；不将未经适配的原生结果直接宣称为通用格式。报告核心不绑定语言、测试框架或包管理器。 -->
<!-- 报告计划：在本变更实际路径下约定独立的原始采集、映射、基线、过程证据和两类 HTML 输出位置，避免覆盖其他功能结果；不直接复用历史功能或另一框架入口。新增行单测覆盖率 HTML 展示基线、生产范围、分子分母、未覆盖位置、未舍入判定及证据链接；需求/TDD HTML 展示稳定需求与场景映射、真实执行结果、源码/断言关联和实际过程证据。两者都展示缺失、失败、跳过、未执行及有依据的不适用，不能将报告生成成功等同于验收通过。 -->
<!-- 能力缺口：当前 reporting.capability.ready=false。将生产范围配置、真实套件和结果采集、单元可执行行/覆盖率适配及测试源码清单分别落实为有验证方式的 tasks；适配完成前不能宣称报告能力就绪。若本变更按 Schema 条件省略 design.md，上述必要决策、基线与采集安排写入对应 tasks，不新增 plan.md 或其他规划产物。 -->

## Risks / Trade-offs

<!-- Known risks and trade-offs -->
<!-- 按“风险 → 缓解措施”记录版本未知、索引错配、未提交内容、采集缺失、基线漂移和兼容风险。涉及部署、数据或接口迁移时说明迁移、回退与验证安排；可安全后置的未知注明解决条件，影响行为或方案的未知先澄清。 -->
<!-- 完成检查设计：核对需求/场景到真实执行的映射完整性、有效 TDD 证据、关键控制逻辑反向验证及恢复、新增行单测覆盖率和两类 HTML 的一致性。测试、构建或采集未执行时如实保留状态，不预填通过率、覆盖率或完成结论。 -->

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
