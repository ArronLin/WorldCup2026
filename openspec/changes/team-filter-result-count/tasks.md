# Tasks

共 **17 项**，上限 **20**。所有复选框均为尚未实施。路径相对仓库根目录；本变更目录为 openspec/changes/team-filter-result-count（下称 FEATURE）。需求/场景以 specs/team-filter-result-count/spec.md 为准；报告 ID 使用 spec-index 实际生成的 OSR/OSS，FR/AS 为人工追溯标签。

## 1. 报告接入、基线与追溯（先于生产修改）

- [x] 1.1 确定可复现的 OpenSpec 报告启动命令，记录 powershell.exe 已知解析失败与可用 PowerShell/Python 入口；在 reporting/config.json 声明设计中的完整生产范围（含预计自有适配路径）和排除项，首次生产修改前执行 baseline --confirm-before-changes，记录 HEAD、dirty、完整文件哈希与基线引用。验证基线可解析且覆盖现有未提交内容，不覆盖旧基线；不以 doctor passed=true 冒充 ready。
- [x] 1.2 配置 tests/fixtures/e2e 源码清单及 unit、integration、e2e 三类真实 suites，逐文件按测试边界分类，确定命令数组、cwd、provider版本、目标筛选和按run_id隔离的输出路径；以契约校验和真实测试发现清单验证没有漏掉新测试或重复计算，补写 FEATURE/reporting/usage.md。若标准格式不足，记录1.3的具体适配需求。
- [x] 1.3 对必要结果/覆盖率薄适配器先写真实失败夹具测试再最小实现并复跑，保留适配器自身 Red/Green/Refactor 原始证据；验证成功、断言失败、启动错误、同名参数、跳过/重试和源码哈希不符均正确分类，并证明未导入生产文件以真实可执行行零命中纳入。真实 Vitest/Playwright 输出往返导入成功才算完成；新自有适配逻辑纳入unit覆盖率，不改通用报告核心。
- [x] 1.4 执行 spec-index，在 FEATURE/reporting/traceability.json 建立 FR-001–004、US1-AS1–8 对应的 OSR/OSS→真实测试定位/源码→断言→执行周期映射；实现前可记录待执行目标，随后补齐实际ID。运行 check，核对所有新增需求均有处理，无删除/改名遗漏；手工或不适用项必须有具体理由和确认依据。映射和采集缺口消除才进入产品TDD。

## 2. 计数逻辑与数据桥接（FR-001、FR-004）

- [x] 2.1 在 tests/team-filter-count.test.js 编写 count-all、count-unequal-union、count-unknown、空集合/数据更新及输入不变测试；针对 count.js 可加载最小桩取得真实断言 Red，使用报告 run --phase red 记录同 cycle 的精确目标和源码/测试哈希。验证失败因计数行为缺失而非导入/环境故障。
- [x] 2.2 最小实现 src/features/team-group-filter/count.js 的纯计数及当前groups桥接接口，复用 isGroupVisible；取得同目标同测试指纹 Green。验证2/1/3不等组数据、未知组、空数据及替换数据后没有陈旧数量，保存 run --phase green 证据。
- [x] 2.3 审视计数与桥接接口，必要时重构后用 run --phase refactor 复跑；无需重构则记录具体理由供最终 --no-refactor 使用。同步本组接口/测试定位说明并检查原有筛选state回归；不得人为改代码制造重构记录。

## 3. 页面计数、双语与边界（FR-001–004）

- [x] 3.1 在 tests/team-filter-count-controller.test.js 和 tests/team-filter-count-view.test.js 编写设计表中的控制器unit及view集成测试；按新规格更新旧摘要期望，保留原有集合/顺序/焦点断言。取得真实 Red，覆盖初次、选择追加取消、恢复全部、快速切换、zh/en、返回重绘、无数据和未知组；各目标Green前固定测试文件与cycle。
- [x] 3.2 修改 teams.js、group-filter/controller.js 与中英词典，使用同一计数接口和 teams.filter.count，沿用 role=status；空数据路径清空桥接数据且不渲染计数。对3.1精确目标取得 Green，验证文本正确、输入焦点不丢失、没有额外请求/持久化或筛选规则变化。
- [x] 3.3 审视并必要时重构本组实现、复跑关联测试，更新实际模块到测试映射和文档；检查语言/返回/刷新现有机制兼容。无需重构按工具要求写理由，保留事实；新增行未被unit覆盖时添加真实隔离单测，禁止挪用集成命中作为单测。
- [x] 3.4 新建 e2e/team-filter-count.spec.js 并执行 count-journey、count-language-navigation、count-data-boundaries；先当前源码 npm run build，确认4173服务当前dist，显式locale/语言偏好。验证AS1–8、键盘焦点、计数=实际可见卡片数及375px可读；保存结果/截图并更新本组映射，失败需修复后复跑，不延后到收尾才首次验证。

## 4. 有效性与报告生成验证

- [x] 4.1 可恢复地将计数逻辑变异为 visible=total，目标单组/未知组测试必须断言失败；finally恢复并核对源码哈希，再复跑通过。记录独立变异证据，不将其冒充2.1或3.1的Red；变异期间不并行构建或采集。
- [x] 4.2 串行运行当前配置的真实unit覆盖率采集，对照本功能基线及最终源码核对全部新增可执行行、未导入行、多行映射和适配器路径。记录C、D和未舍入C/D，须≥0.8；D=0提供行集合依据，缺采集保持未完成。以单元原始报告及哈希验证，不使用文件平均或integration/e2e命中。
- [x] 4.3 完成本功能各套件有效final所需的真实运行，再执行finalize并打开两份HTML，核对新增行报告的C/D/源码标色，以及需求报告的OSR/OSS/真实测试/TDD周期与原始链接；对照report-status.json及退出码验证。失败、缺失、跳过和不适用如实显示，报告不能用硬编码通过数据生成；记录两个实际输出路径及阅读说明。

## 5. 跨组最终验收

- [x] 5.1 当前源码构建后完成全量既有回归及新功能验收，确认全部配置套件的最新 run --phase final 与最终生产/测试/规格/映射指纹一致。可复用4.3同状态的有效全量final，不无故重复；若发生修复则回到对应TDD组并重跑受影响检查及最终采集，保存真实发现/通过/失败/跳过数。
- [x] 5.2 按最终源码重核新增行门槛及两份HTML有效性；必要时重新finalize，核对所有FR/AS都有真实可追溯结果、实际Red/Green与Refactor或合理无需重构说明，反向验证已恢复。归档前报告仍有效才算完成，不将文档齐备等同验收通过。
- [x] 5.3 编写 FEATURE/acceptance.md：实际环境、基线和最终哈希、unit/integration/e2e分别通过率、C/D、两份HTML相对链接、执行异常与剩余问题；逐项对照完成证据后才勾选，最终任务数保持≤20。说明实现/验证/报告各自状态，不自动commit、push或archive。

依赖顺序：1.1→1.2→1.3→1.4→2.1→2.2→2.3→3.1→3.2→3.3→3.4→4.1→4.2→4.3→5.1→5.2→5.3。每组随工作保存自身测试、说明及真实证据；第5组仅做跨组最终核验。
