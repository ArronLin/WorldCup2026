# Tasks: 球队分组筛选

**Input**: `specs/002-team-group-filter/` 下已澄清的 spec.md、plan.md、research.md、data-model.md、contracts/ui-and-state.md、quickstart.md。

**Branch**: `002-team-group-filter`；生成日期：2026-10-21。

**Tests**: 必须执行真实 TDD、有效断言验证、新增生产代码单测行覆盖率检查及浏览器验收。

**任务总数**: **16**，硬上限 **20**；16 项已完成（2026-10-21），实际结果见 [验收记录](evidence/acceptance.md)。任务路径相对于仓库根目录。

## Format: `[ID] [P?] [Story] Description`

[P] 仅表示在明确前置完成后可与不共享文件、运行状态及报告目录的任务并行，不授予绕过 TDD 的权限。每项“事实状态”表示其执行状态；已核实的设计依据见末尾来源记录。

## Phase 1: Setup

- [x] T001 核实环境及生产代码差异，创建 `specs/002-team-group-filter/coverage-baseline.json`，用现有脚本重建到 `.tmp/002-coverage-baseline/`，执行原有单测并保存 `specs/002-team-group-filter/evidence/T001/` 的环境、基线和初始回归记录。
  - 依据：plan 的固定基线、coverage/tests/evidence 规则；前置：无。
  - 完成判据：基线固定为 `d169b3bca1fdf7e0b0dc90e5a9b8ea2805707750`；manifest 的 schemaVersion=1、mode=git-tree、productionPatterns 与工具一致，files 完整列出该 Git 树的生产路径及 LF 规范化 SHA256；重建校验通过。记录 HEAD、未提交变更归属、Node/依赖版本；`npm test` 确实发现并执行原有测试，环境问题在进入 Red 前解决。不得从修改后工作区或 001 manifest 复制基线。
  - 完成证据：运行 `npm run coverage:baseline -- --manifest specs/002-team-group-filter/coverage-baseline.json --output .tmp/002-coverage-baseline`、`npm test`；保存命令、退出码、测试统计、基线/工作区哈希。已执行，见 evidence/T001/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

## Phase 2: Foundational — 复用既有能力

本项目已有 Vitest/node/jsdom、V8、Playwright 和新增行工具，不另设框架搭建任务。T001 的基线及测试发现验证是所有故事的入口门禁；纯逻辑由最先使用它的 US1 构建。不改依赖版本、路由或数据层。

## Phase 3: User Story 1 — 只看所选小组的球队（P1，MVP）

**目标**：在中文界面完整实现单组/多组、恢复全部、详情往返、刷新重置、键盘与数据边界。

**独立验收**：全部→A→A+C→C→全部，结果与分组一致；详情返回保留、刷新重置；未知组和无数据提示符合规格。英文新增文案由 US2 完成。

### 行为包一：分组与内存状态

- [x] T002 [US1] Red：在 `tests/team-group-filter-state.test.js` 为 `src/features/team-group-filter/state.js` 的真实分组、可见性和状态接口编写并运行失败测试。
  - 依据：FR-001–003、FR-006/009、EC-01/02/04；data-model 约束原文：“空集合表示全部”“availableGroups 的子集，去重”“读取返回副本”“null、undefined、空字符串和纯空白分组归为未知”；前置：T001。
  - 完成判据：覆盖分组排序/组内原顺序、单组/并集/全选/清空、非法组不生效、syncGroups 保留有效选择、未知组仅全部可见、快照不可外部篡改及新实例初始为空。允许先建立可导入的最小接口外壳，但不得实现待测行为；有效 Red 必须是行为断言失败，不能仅是缺模块或导出错误。
  - 完成证据：`npm test -- tests/team-group-filter-state.test.js` 的真实失败断言、版本/差异和退出码存入 `specs/002-team-group-filter/evidence/T002/`。已执行，见 evidence/T002/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T003 [US1] Green：在 `src/features/team-group-filter/state.js` 实现 buildTeamGroups、isGroupVisible、createGroupFilterState 及应用共享实例，使 T002 测试通过。
  - 依据：FR-001–003/006/009、data-model.md；前置：T002 有效 Red。
  - 完成判据：纯逻辑无 DOM、网络或持久化依赖；组 key 缺失用空字符串哨兵且不进入 availableGroups，未知组排最后；按 code 唯一的输入保持队伍及顺序；内存选择只属当前文档。核心谓词供视图和控制器共用。
  - 完成证据：同一测试命令的通过记录及源码差异存入 `specs/002-team-group-filter/evidence/T003/`。已执行，见 evidence/T003/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T004 [US1] Refactor：审视并整理 `src/features/team-group-filter/state.js` 与 `tests/team-group-filter-state.test.js`，保持真实接口与单一筛选语义。
  - 依据：真实 TDD、职责分离；前置：T003。
  - 完成判据：去除必要的重复，重跑目标单测通过；若无必要重构，记录具体审视结论，不虚构改动或为了产生日志修改行为。
  - 完成证据：结论、实际差异及通过日志存入 `specs/002-team-group-filter/evidence/T004/`。已执行，见 evidence/T004/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

### 行为包二：控件、显示与页面生命周期

- [x] T005 [US1] Red：在 `tests/team-group-filter-view.test.js`、`tests/team-group-filter-controller.test.js` 增加 jsdom 测试，调用真实 teamsView、状态和拟新增控制器，验证中文筛选控件、局部更新、键盘、生命周期及空/未知数据边界。
  - 依据：US1-AS1–6、FR-004/006–009、EC-01–04；前置：T004。
  - 完成判据：断言标签/选择状态/模式提示、单组和多组可见集合、隐藏分区及链接不可聚焦、更新前后控件节点和焦点保持、重复初始化不重复响应、dispose 生效、无关卡片导航不被拦截；使用真实视图再次渲染验证共享选择保留，新实例模拟新文档重置。空字典/取数失败及缺组夹具验证中性提示和未知组边界。可替代 fetch 或 getTeams 输入，不能替代筛选核心；先取得行为 Red。
  - 完成证据：目标 Vitest 运行、具体失败断言及工作区差异存入 `specs/002-team-group-filter/evidence/T005/`。已执行，见 evidence/T005/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T006 [US1] Green：实现 `src/features/team-group-filter/controller.js`，修改 `src/views/teams.js`、`src/app.js`、`src/styles/components.css`、`public/i18n/zh.json`，完成中文核心筛选及边界提示。
  - 依据：FR-001–004/006–009，contracts/ui-and-state.md；前置：T005 有效 Red。
  - 完成判据：fieldset/legend + 原生 checkbox + 显示全部按钮；选择项来自完整数据而非筛选结果。视图 await 取数后同步组并读最新选择；控制器根节点委托、幂等/可 dispose，按 checked 同步状态并只更新 hidden、复选框及模式文本，不重绘路由、不替换控件。hidden CSS 保证布局及 Tab 排除；未知组仅全部可见，无数据无虚构选项。app 在 initRouter 前初始化，原有详情入口和信息/排序保留。T005 与状态测试通过。
  - 完成证据：目标单测、数据/词条检查结果、源码差异存入 `specs/002-team-group-filter/evidence/T006/`。已执行，见 evidence/T006/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T007 [US1] Refactor：审视 `src/features/team-group-filter/`、`src/views/teams.js` 和两份 DOM 测试，消除重复筛选判断与重复事件注册，复跑 US1 单测。
  - 依据：真实 TDD、FR-004/006/007；前置：T006。
  - 完成判据：视图/控制器共用 isGroupVisible；无计时器、旧页面节点引用或额外持久化；目标测试通过。无必要重构时记录审视结论和复跑结果。
  - 完成证据：命令、差异及通过日志存入 `specs/002-team-group-filter/evidence/T007/`。已执行，见 evidence/T007/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

**Checkpoint**：US1 的中文 MVP 可独立展示；尚不能宣称完整双语功能或最终验收通过。

## Phase 4: User Story 2 — 中英文切换保持相同球队（P2）

**目标**：新增提示完整双语，实际语言切换后所选组与球队集合不变。

**独立验收**：中文选择 A+C→英文→中文，以及显示全部时切换；分别断言实际语言、checkbox 状态和球队 code 集合。

- [x] T008 [US2] Red：在 `tests/team-group-filter-view.test.js` 和 `tests/team-group-filter-controller.test.js` 增加使用真实字典/翻译入口的英文及语言重绘测试。
  - 依据：FR-005、US2-AS1/2、EC-03/04 的双语提示；前置：T007。
  - 完成判据：核对中→英→中实际词条、模式提示、全部/多组/无数据/未知组提示及选择保留。T006 未添加的英文词条应产生真实行为断言失败；已有状态保留若直接通过，记为已有行为验证，不人为破坏实现制造 Red。收集失败不是有效 Red。
  - 完成证据：实际失败和已有通过项分别存入 `specs/002-team-group-filter/evidence/T008/`，记录源码及词典状态。已执行，见 evidence/T008/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T009 [US2] Green：补齐 `public/i18n/en.json` 与 `public/i18n/zh.json` 的 teams.filter 对应词条，按测试需要修正 `src/views/teams.js` 和 `src/features/team-group-filter/controller.js` 的翻译读取，使双语和状态测试通过。
  - 依据：FR-005、US2-AS1/2；前置：T008 有效 Red。
  - 完成判据：复用 common.group 和现有球队名翻译；文案随语言变化、状态不因翻译重置，新增词条不泄漏内部 key。不修改共享路由或 i18n 引擎来扩展本轮范围；`npm run validate:data` 和目标测试通过。
  - 完成证据：目标单测、词条校验及变化记录存入 `specs/002-team-group-filter/evidence/T009/`。已执行，见 evidence/T009/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T010 [US2] Refactor：检查 `public/i18n/zh.json`、`public/i18n/en.json`、球队视图/控制器及双语用例，统一新增文案来源，运行完整 `npm test`。
  - 依据：真实 TDD、FR-005、现有功能回归；前置：T009。
  - 完成判据：无重复硬编码文案、语言相关分组计算或多套状态；三行为包及原有单测均实际执行通过。无需重构时记录结论，不编造改动。
  - 完成证据：审视结论、发现/执行/跳过数及完整单测日志存入 `specs/002-team-group-filter/evidence/T010/`。已执行，见 evidence/T010/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T011 对 `src/features/team-group-filter/state.js` 的 isGroupVisible 执行可恢复反向验证，以 `tests/team-group-filter-state.test.js` 识别“忽略选择、始终显示”等错误行为。
  - 依据：tests 规则、FR-002/003；前置：T010。
  - 完成判据：备份当前源码并记录哈希；临时变异导致目标集合断言失败；finally/等效机制恢复原文件且哈希一致，恢复后单测通过。不得把该失败冒充实现前 Red，不提交变异代码；验证期间禁止并行修改/测试同一源码。
  - 完成证据：变异差异、预期失败、恢复校验及通过结果存入 `specs/002-team-group-filter/evidence/T011/`。已执行，见 evidence/T011/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T012 [P] 修改 `.github/workflows/verify.yml`，保留现有检查并追加 002 基线重建、新增行门禁、HTML 生成及报告上传。
  - 依据：coverage、plan 的 CI 设计；前置：T001。
  - 完成判据：显式使用 002 manifest/输出路径，复用同一次 test:coverage 采集，001 与 002 结果互不覆盖；两项门禁失败均使 job 失败，覆盖失败仍能生成诊断报告。校验 YAML/命令参数及失败传播设计；本地真实命令结果由 T015 提供。无需为完成此任务自动 push 或触发远端发布。
  - 完成证据：配置差异、结构校验和门禁检查记录存入 `specs/002-team-group-filter/evidence/T012/`；远端 CI 未运行时如实记录，不假称通过。已执行，见 evidence/T012/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T013 在 `e2e/team-group-filter.spec.js` 增加并执行完整浏览器验收，先 `npm run build`，再运行目标与全量 `npm run test:e2e`。
  - 依据：US1-AS1–6、US2-AS1/2、EC-01–04、SC-001–003；前置：T010、T011 已恢复源码。
  - 完成判据：覆盖单组/多组/全选/取消最后一组/重复恢复/快速切换、信息与排序、正确详情往返、reload/新页面重置、真实中英切换、键盘焦点与隐藏链接、无数据/失败/未知组。设置 locale 与语言偏好；预览必须是当前仓库当前 dist。数据加载后以浏览器时间测量输入至可见结果，逐次≤1000ms，不能用宽松的默认等待超时代替性能断言。全量端到端包括原有关注功能回归；记录实际执行数与跳过情况。
  - 完成证据：构建日志、Chromium/Playwright 版本、用例结果、时间测量及必要截图/失败诊断存入 `specs/002-team-group-filter/evidence/T013/`。已执行，见 evidence/T013/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T014 按 `specs/002-team-group-filter/quickstart.md` 人工复核窄屏和键盘操作，记录到 `specs/002-team-group-filter/evidence/T014/`。
  - 依据：FR-007、UI 契约的换行/焦点要求；前置：T013。
  - 完成判据：在已记录的窄屏与桌面尺寸下控件换行、页面无横向溢出，焦点可见，Tab/Space 可连续筛选，隐藏卡片不可聚焦；无障碍状态与可见选择一致。发现缺陷进入相应行为包先加失败测试再修复，不能直接勾选通过。
  - 完成证据：尺寸、操作步骤、实际观察及截图/记录；若无法人工验证须明确已执行，见 evidence/T014/ 中的实际记录。已执行，见 evidence/T014/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T015 在最终源码状态运行全量单测及新增行覆盖率门禁，生成 `specs/002-team-group-filter/evidence/coverage-added.json`、`coverage-added.html` 并归档同轮原始报告。
  - 依据：coverage/tests、SC-001–003；前置：T011、T012、T013、T014，所有修复已完成并复跑受影响验证。
  - 完成判据：执行 quickstart 中 baseline→test:coverage→coverage:added→coverage:html 显式 002 参数；保持默认 coverage 目录。生产范围含 src/**/*.js、netlify/functions/**/*.mjs，未被测试导入的文件也纳入；复核既有新增行工具自测与 coverage:prove-unimported。记录新增可执行行 D、覆盖行 C，D>0 按未舍入 C/D≥0.8；D=0 附行集合证据记不适用。禁止用全项目、逐文件平均或 E2E 指标替代。若不通过则回到所属行为包修复并重跑，不降低门槛。
  - 完成证据：原始 coverage-final.json、lcov.info、source-hashes.json、发现/执行/通过/失败/跳过数、基线/最终源码哈希及命令结果存入 `specs/002-team-group-filter/evidence/T015/`，同时保留上面的汇总和 HTML。已执行，见 evidence/T015/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

- [x] T016 完成 `specs/002-team-group-filter/evidence/requirements-test-map.md` 与 `evidence/acceptance.md`，核对每项需求的真实测试、TDD 证据及最终验收结果。
  - 依据：evidence、全部 FR/SC/验收场景；前置：T015。
  - 完成判据：FR/US/EC/SC→实际测试名称/文件→Red/Green/Refactor 或已有行为验证→最终证据均可追踪；区分单测、浏览器通过率及其分母、跳过/未执行、不适用。列出实际环境、固定基线、最终哈希、C/D、浏览器/手工结果和剩余问题；没有证据的任务不能勾选。不得直接调用绑定 001 的 requirements-TDD HTML 生成器宣称 002 已覆盖；本轮使用真实日志与 Markdown 映射。
  - 完成证据：文档链接可访问、结果与原始报告一致、工作区状态已记录。收尾不再改变生产代码；如有变更，重新完成受影响验证及 T015。已执行，见 evidence/T016/ 中的实际记录。
  - 事实状态：verified（已执行；见实际证据）。

## Dependencies & Execution Order

主线：`T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T013 → T014 → T015 → T016`。

支线：`T001 → T012 → T015`。T015 同时依赖浏览器、手工、反向验证和 CI 配置检查，必须在最后一次生产代码修改后采集。

US1 的 6 项任务依赖 T001；US2 的 3 项任务依赖 US1 的共享控件，可独立按双语场景验收，但不声称可在控件不存在时实现。最终 6 项任务不属于任一单独故事。

## Parallel Examples

- US1：T002–T007 因真实 TDD 与共享 state/view 文件必须串行；在 T001 完成后，可由另一执行者处理仅修改 CI 文件的 T012，与 US1 文件互不冲突。
- US2：T008–T010 串行；T012 若尚未完成可并行编写和静态校验配置，但不得同时运行会改变共享覆盖率目录或源码的验证。
- T011 反向变更时禁止并行运行产品测试/构建；T013、T014、T015 采用同一工作区串行取证。没有为了增加并行标记而拆分任务。

## Implementation Strategy

1. T001 固定基线并证明现有测试可执行。
2. 两条 US1 TDD 链完成中文核心 MVP；可演示筛选、恢复、返回和刷新。
3. 一条 US2 TDD 链完成双语；已有行为测试直接通过时如实标记，真正新增文案/行为保留真实 Red。
4. 执行有效性、CI、浏览器及人工检查，再以最终源码完成覆盖率和证据归档。
5. 文档/配置可按逻辑组提交，生产代码和测试按完成的行为组提交；是否实际 commit/push 由用户指令决定。

## EaseUS：tasks 阶段规则与依据

- 交互与产物使用简体中文；每项任务保持固定 ID、故事标签和实际路径。
- 三条 TDD 链为 T002→T003→T004、T005→T006→T007、T008→T009→T010。Red 是目标行为失败；Refactor 无需改动时记录审视与复跑，不能伪造。新增缺陷修复也需先测后改。
- 若测试文件不存在导致收集错误，只能作为准备问题，补齐可加载接口后重新取得真实断言失败；不把异常导入作为产品 Red。
- 真实测试调用生产逻辑；数据边界允许受控输入，核心谓词不得 mock；T011 提供独立有效性证据。
- T001/T012/T015 落实基线、能力接入和最终新增行门禁；不要求存量代码整体达到 80%。
- 来源：本轮已读取的有效技能、规则快照/宪法及五份设计文档；沿用 plan 中经 CodeGraph 当前源码核实的架构事实（verified）。OpenDeepWiki 背景提交版本 unknown；不把未知版本当作最终源码证明。
- 任务生成阶段未执行产品验证；现已完成实现、真实 TDD、覆盖率及验收，见各任务证据。未发现 extensions.yml，无 before_implement/after_implement hook 需要执行。

## 项目增补：任务依赖与完成证据

### 需求与任务覆盖

| 需求／场景 | 实现与 TDD | 最终验证 |
| --- | --- | --- |
| FR-001–003；US1-AS1–4；EC-01/02；SC-001 | T002–T007 | T011、T013、T015 |
| FR-004/006；US1-AS5 | T002–T007 | T013（详情、返回、刷新、新页面） |
| FR-007；US1-AS6 | T005–T007 | T013、T014 |
| FR-008/009；EC-03/04 | T002–T007；英文 T008–T010 | T013、T015 |
| FR-005；US2-AS1/2 | T008–T010 | T013、T015 |
| SC-002 | T005–T007 的同步局部更新 | T013 的浏览器事件时间测量 |
| SC-003 | T005–T010 | T013、T014 |
| TDD/有效测试 | T002–T010 | T011、T016 |
| 新增行覆盖率/证据 | T001、T012 | T015、T016 |

### 每项证据记录

每项 evidence/Txxx/ 至少记录命令或操作、时间、环境、基线与当前 HEAD、未提交差异或内容哈希、实际退出码、测试发现/执行/失败/通过/跳过情况及结论。日志与被测源码必须对应；已提交 HEAD 不能代表所有未提交文件。

### 新增行覆盖率完成记录

T015 已完成：固定基线 d169b3bca1fdf7e0b0dc90e5a9b8ea2805707750；最终源码哈希和原始报告见 evidence/T015/。C=61、D=61，未舍入 C/D=1 ≥ 0.8。全部新增行映射见 evidence/coverage-added.json；测试/第三方/生成物排除口径及未导入文件处理见 evidence/acceptance.md。

### 完成与评审边界

仅实际满足完成判据并有证据后勾选任务。失败、未执行、阻塞、不适用分别说明；不修改其他质量检查清单标记来绕过门槛。功能不涉及 AI/Function，未产生相应任务。变更任务拆分时总数仍不得超过 20，当前 16 项留有 4 项余量；不能省略需求或质量规则。
