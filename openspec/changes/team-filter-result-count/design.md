# Design

## Context

2026-10-22 确认的范围见 proposal.md，外部行为见 specs/team-filter-result-count/spec.md。当前 teamsView 构造分组 HTML，控制器就地切换 section.hidden 并更新摘要；摘要已有 role=status。i18n.t 支持 {变量} 替换，语言切换触发现有路由重绘。无需新状态存储或网络请求。

源码证据：探索阶段 CodeGraph 返回 teams.js 当前源码；未命中 group-filter/controller 时直接读取核实，不能采用它误返回的 follow-teams/controller。此次 CodeGraph 核实 i18n.js；直接读取现有 view 测试和 vite.config.js。Wiki easeus/WorldCup2026/main 的球队文档仅作背景，提交版本 unknown；指定 openspec_wizard 不可用，使用已提供独立工具，不加载另一框架规则。

规划参考 HEAD：4ba4cc7d8818ddf7f8a53326d366db802e1462cb。工作区已有 OpenSpec 安装与公共配置变更，保留。正式不可变基线尚未捕获：实施时在任何生产修改前，记录完整工作区生产清单/规范化哈希、HEAD 和 dirty，调用本框架 baseline；若生产状态与本次规划不符先核对差异，不把既有筛选代码算为本次新增。

报告预检事实：Windows PowerShell 的 powershell.exe -File 启动方式遇到 UTF-8 脚本解析错误；当前 PowerShell 直接调用同一 run.ps1 可运行 doctor。规格存在后 doctor 返回 passed=true、ready=false、退出码 1，列出生产范围、套件、覆盖率和测试源码四项缺口。passed 仅代表工具检查完成，不代表报告就绪。没有运行产品测试。

## Goals / Non-Goals

**Goals:** 单一计数来源、初次渲染和事件更新结果一致；覆盖 FR-001–004 的 8 个场景；真实 TDD、新增行单测 C/D≥0.8、两份真实 HTML；实现任务 17 项，硬上限 20。

**Non-Goals:** 新筛选、持久化、路由或数据层重构、页头修复、依赖升级、全项目覆盖率达标、报告核心重写、自动提交或归档。

## Decisions

### 1. 计数从分组记录派生，复用可见谓词

新增 src/features/team-group-filter/count.js，导出纯函数 countTeamGroups(groups, selectedGroups)，返回 {visible,total}。对 buildTeamGroups 的同一分组输入累计 teams.length，visible 使用现有 isGroupVisible。不维护第二套 selected 状态；不按固定人数推算。未知分组自然参与 total，仅全部模式参与 visible。选择纯函数而不是分别在视图和 DOM 中计数，避免两处口径漂移。

视图与控制器共享计数：teamsView 每次成功分组后向控制器提供当前 groups（通过模块导出的 WeakMap 注册 page 模型不可用于尚未挂载字符串，故采用单一模块内当前 groups 引用及显式 setGroups/getCounts 接口）。模块只持有当前数据引用，不持久化；view 在空数据路径也更新为空。初次渲染与语言/路由重绘均先同步 groups，再读取当前选择计算；控制器局部更新后用同一接口计算摘要。纯计算仍可独立单测。可将这些轻量接口保留在 count.js 内，无需新的状态框架。

只替换摘要文案，新增词条 teams.filter.count：中文“当前显示 {visible} / {total} 支球队”，英文“Showing {visible} / {total} teams”。沿用 t 插值与 role=status，不替换 checkbox 节点、不移动焦点。无数据视图继续提前返回，不输出计数节点。原有 teams.subtitle 不在本轮调整范围。

### 2. 测试分层与 TDD

| 需求与场景 | 真实生产逻辑 | 计划测试文件/稳定用例名 | 层级与关键断言 |
| --- | --- | --- | --- |
| FR-001，AS1/2；FR-004，AS7 | count.js、isGroupVisible | tests/team-filter-count.test.js：count-all、count-unequal-union、count-unknown | unit；构造非48且非等组数据，断言准确整数，输入不被修改 |
| FR-002，AS3/4 | controller 更新与 count 接口 | tests/team-filter-count-controller.test.js：count-change、count-clear-rapid-focus | unit；真实控制器、最小DOM，断言摘要和焦点，不 mock 核心计数 |
| FR-001/003/004，AS1/5/6/7/8 | teamsView、真实词典、状态、控制器组合 | tests/team-filter-count-view.test.js：count-render、count-language、count-return-reset、count-no-data、count-unknown-view | integration；真实模块与受控数据，验证文本和列表一致 |
| FR-001–004，AS1–8 | 构建后真实页面 | e2e/team-filter-count.spec.js：count-journey、count-language-navigation、count-data-boundaries | e2e；逐步计数等于可见卡片数，键盘、刷新、新页面、空/失败/未知组 |

AS 均指 US1-ASx。首次 spec-index 取得 OSR/OSS 自动稳定 ID 与精确路径后，在 reporting/traceability.json 映射上述逻辑标签，不自行猜造 OSR/OSS；需求标题保持稳定。结果 test_id 根据实际 provider/container/locator/parameters 计算；名称只是规划定位，不伪称已存在用例。所有新增场景标明单测、集成或E2E，已有回归标明非本次新增TDD目标及原因。

两条主要 TDD 链：纯计数与数据桥接（任务 2.1–2.3）；界面控制、双语及边界（3.1–3.3）。编写可加载接口最小桩后获取真实行为断言 Red，导入/启动错误不算。每个目标同 cycle 保存原始结果、命令、时间、退出码、生产/测试源码哈希；Red→Green 保持目标测试文件不变。若为修复测试夹具必须改测试，重跑有效 Red。新增适配脚本也先用格式/失败夹具取得 Red 后实现。Refactor 无必要时明确理由，使用工具支持的 --no-refactor 及 Green 后 final，不虚构改动。

变异将 visible 临时改为 total，单组选中/未知组断言必须失败；finally 恢复且哈希一致再复跑，不将变异失败当作历史 Red。

### 3. 报告接入与范围

唯一入口为 openspec/easeus/reporting/run.ps1（在已验证可解析的 PowerShell 运行），或同目录 runtime/v1/cli.py 的 Python 3.10+ 入口。实现时先确定可复现启动命令，必要时修复本框架启动器编码并测试；不改另一框架文件。所有调用显式 --feature openspec/changes/team-filter-result-count。不把 README 中另一框架的示例路径复制过来。

配置 production_include 为 src/**/*.js、netlify/functions/**/*.mjs；若新增项目自有结果适配脚本，追加其 scripts/reporting/** 路径并纳入真实单测覆盖，不能作为工具名义漏算。排除 tests/**、e2e/**、node_modules/**、dist/**、coverage/** 和 openspec 规划/运行证据；CSS/JSON 为非JS可执行代码，不进入行分母。通用已部署 Python报告运行时属于既有供应工具，不为本功能新增生产逻辑。test_include 明确 tests/**/*.test.js、tests/fixtures/**、e2e/**/*.spec.js 及实际辅助文件。

结果优先复用标准 JUnit/LCOV；TDD 断言分类、参数身份或源码位置不足时，由 scripts/reporting/ 下薄 collect 适配器转换 Vitest/Playwright 原始 JSON 到契约 unified，绑定真实 run_id/source_fingerprint。禁止直接声称原生 JSON 就是 unified。最终选择与真实往返导入验证在任务1.2–1.4完成，不改报告核心。

| 套件 | 命令基础和来源 | 采集与分层 |
| --- | --- | --- |
| count-unit | node node_modules/vitest/vitest.mjs run，显式纯计数/控制器及适配器测试清单，--coverage | unit；V8→LCOV或unified，必须包括完整生产范围未导入文件，不混入下行集成命中 |
| regression-integration | node node_modules/vitest/vitest.mjs run，显式其余现有测试与新view组合测试 | integration；结果进入需求报告，覆盖率不进入单测门槛。不能只因使用Vitest就归unit |
| browser | 先 npm run build，再 node node_modules/@playwright/test/cli.js test | e2e；全量既有及新增场景，真实JSON转换，记录失败/跳过/重试 |

上述为基础命令，最终 args、排除重复清单、provider版本、输出位置和 targeted runner 在配置任务落定并验证。所有已配置套件最终必须完整 run --phase final，不允许局部目标代替；unit、integration、e2e 串行，避免报告覆盖。单测采集需证明新增 view 生产行是否有 unit 命中；若未命中也如实计入 D，用针对 view 的隔离单元测试补足，不能用 integration 命中补数。

范围声明后、首次产品及自有适配生产修改前捕获 baseline；适配器新文件在基线中不存在是合法新增。运行顺序：范围声明→baseline→适配器TDD/采集接入→spec-index/traceability/check→产品TDD→反向验证→构建/各套件final→finalize。若采集器尚未实现，先保留适配器自身真实原生Red日志和源码快照，随后验证导入，不能补造历史；baseline不得在适配器实现后捕获。

本变更 reporting/ 保存基线、spec-index、traceability.json、runs 原始结果/收据与统一数据；原始输出必须按 run_id 独立，避免跨套件覆盖。最终 HTML 位置以 finalize 实际输出为准，验收文档提供两条精确相对链接：新增行覆盖率（基线、范围、C/D、未覆盖源码与证据）和需求/TDD（OSR/OSS、真实用例/结果、Red/Green/Refactor、缺失/失败/跳过/不适用）。核对 report-status.json 和退出码，不能以文件存在判通过。

新增可执行行按基线差异与最终 unit 可执行行交集计算，支持未导入文件零命中、多行语句范围映射、改名来源；C/D 未舍入汇总≥0.8，D=0附依据记不适用，采集不全是失败。不要沿用旧功能的分母或报告。适配验证包括成功、断言失败、基础设施错误、同名参数化、跳过/重试、源码错配与未导入零命中；真实失败状态不能变成 passed。

## Risks / Trade-offs

实施落定：使用标准 Vitest/Playwright JUnit 与 V8 LCOV，未新增自定义生产适配器；旧参数化无数据用例标题加入参数索引以保证身份唯一，原断言保留。完整原始结果按run ID存于 evidence/reporting/runs。采集配置在基线前一次确定，后续未变更基线政策。运行入口采用已验证 PowerShell 7，Windows PowerShell 5原有解析问题未改动供应脚本。

- 功能轻量但首次报告配置为空 → 预留4项接入任务；不降低TDD/覆盖率要求来凑任务数。
- PowerShell版本编码差异 → 先验证可用入口；Windows PowerShell错误留为已知事实，尚未修复。
- 共享当前groups可能过期 → 每次view含空数据都重置；返回、语言重绘及未知组组合测试验证，无异步新增请求。
- 原有测试断言旧摘要 → Red阶段更新对应期望并固定目标文件，保留既有选择/顺序/焦点断言；新统计不是旧功能失败的掩盖。
- 报告适配格式兼容尚未真实验证 → 开始实现先做真实往返试运行，能力不足如实阻断验收；不宣称两份报告已可生成。
- 归档由后续明确命令触发，之前核对报告指纹仍有效。回退撤销本轮计数与词条、恢复旧摘要；无数据迁移。
