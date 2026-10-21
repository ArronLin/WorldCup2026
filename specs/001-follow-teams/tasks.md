\---  
description: "关注球队与我的比赛：依赖有序的实现任务"  
\---

# 实现任务：关注球队与我的比赛

**Input**：[规格](spec.md)、[技术计划](plan.md)、[研究](research.md)、[数据模型](data-model.md)、[接口契约](contracts/ui-and-state.md)、[验证指南](quickstart.md)。  
**日期**：2026-10-20。**功能标识**：001-follow-teams；当前实际 Git 分支 main。  
**状态**：已实施；完成标记与下方逐任务证据对应。最终结论见 [验收记录](evidence/acceptance.md)。  
**测试要求**：宪法及本次规则已启用真实 TDD、有效测试和新增行单测覆盖率 ≥80%；基础模板的“测试可选”不适用于本功能。

## 格式与路径约定

每项使用 `- [ ] Txxx [P?] [USx]`；所有路径以仓库根 `D:\GitHub\WorldCup2026` 为基准。只有用户故事任务带 US 标签。  
每项附依据、具体前置、完成判据、证据及事实状态；`[P]` 只在所列前置满足、文件与报告输出无冲突时允许并行。无 [P] 默认串行。  
下方判据保留为验收依据；实际结果以完成证据为准。失败尝试原样留档，不以文件存在替代通过。

**Red 的执行规则**：缺模块时可先创建仅含公开签名和最小可运行返回值的契约骨架，再执行真实目标断言；缺包、语法错误、收集失败或服务器不可达不算业务 Red。若目标已由前置满足，记录已有行为的回归结果，只对尚未满足行为做真实 Red，不故意破坏正确代码伪造历史。  
所有 Green 依赖对应实际 Red；所有 Refactor 依赖 Green，并需复跑。意外生产改动须回到相应 TDD 环，且使最终构建、浏览器及覆盖证据重新对应最终源码。

## 阶段 1：准备与测试环境

保存改动前基线，准备现有测试栈及独立夹具。T001 必须先于任何生产源码改动。覆盖采集能力可在此配置，新增行审计建设留到最终阶段，不无谓阻塞业务故事。

- [x] T001 核实实现前基线，生成权威输入 `specs/001-follow-teams/coverage-baseline.json`，记录 schemaVersion、mode、baseCommit、固定生产范围和完整路径/SHA256清单；当前候选提交为 bb09b00616d2d7c151fbde512f7a11f7d35059aa。与原提交一致使用git-tree；有需保留的原生产差异则使用snapshot，并保存完整原源码到 `specs/001-follow-teams/baseline-source/`。另在 `evidence/T001/` 留存采集过程。
  - 依据：coverage/evidence；plan 基线；具体字段及行为以所链接设计原文为准。
  - 前置任务：无。
  - 完成判据：生产改动前固定原提交/差异归属和完整清单；manifest及snapshot必要源码作为随实现提供的版本输入，不只留在本地evidence。git-tree可从原提交重建，snapshot逐项哈希可验；禁止实现后重设、自动回退当前HEAD或遗漏生产文件；本任务不执行提交/推送。
  - 完成证据：已执行，见 [T001命令/日志索引](evidence/T001/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T002 [P] 在 `package.json`、`package-lock.json`、`vite.config.js` 补同版 `@vitest/coverage-v8@4.1.10` 和Node 24兼容的锁定jsdom、全量生产coverage及test:coverage；新增 `tests/environment-node.test.js` 和 `tests/environment-dom.test.js`，实际验证默认Node和单文件jsdom环境。
  - 依据：plan V1、research R7；具体字段及行为以所链接设计原文为准。
  - 前置任务：T001。
  - 完成判据：npm ci可复现；Node用例在无环境注解时断言document未定义，DOM用例使用单文件jsdom注解并创建/读取真实DOM、验证断言；`npx vitest run tests/environment-node.test.js tests/environment-dom.test.js` 必须实际发现并通过两类用例，无skip。include覆盖全部src/**/*.js和netlify/functions/**/*.mjs；不设全项目80%替代新增行门槛。此处为环境能力验证，不冒充业务Red。
  - 完成证据：已执行，见 [T002命令/日志索引](evidence/T002/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T003 [P] 在 `specs/001-follow-teams/evidence/README.md` 定义逐任务证据格式，在 `tests/fixtures/follow-teams.js` 准备可独立推导结果的球队/比赛夹具。
  - 依据：evidence/tests；SC-002；具体字段及行为以所链接设计原文为准。
  - 前置任务：T001。
  - 完成判据：记录命令、时间、环境、基线/最终哈希、发现/执行/跳过数及退出码；夹具含主客命中、双关注、重复ID、阶段、空结果及损坏输入，不调用生产 selector 计算期望。
  - 完成证据：已执行，见 [T003命令/日志索引](evidence/T003/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。

**检查点**：基线已固定、环境可执行测试，才能开始生产改动。

## 阶段 2：共享基础（阻塞用户故事）

先完成安全存储、结果型数据入口、可保持控件的路由重渲染和阶段语义。它们是本功能各故事实际需要的共用能力。每个能力都按 Red → Green → Refactor。

- [x] T004 Red：在 `tests/browser-storage.test.js` 验证安全读写接口 `read(key) -> {ok:true,value:string|null}|{ok:false}`、`write(key,value) -> {ok:boolean}`，覆盖取得 localStorage 本身、getItem、setItem 抛错及正常无记录。
  - 依据：FR-009；contracts 存储适配器；具体字段及行为以所链接设计原文为准。
  - 前置任务：T002、T003。
  - 完成判据：测试调用真实适配器，只注入外部存储；捕获目标行为断言失败，不能用缺模块、缺包或测试收集失败代替 Red。
  - 完成证据：已执行，见 [T004命令/日志索引](evidence/T004/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T005 Green：在 `src/browser-storage.js` 实现可注入 storage getter 的安全适配器，所有存储接触均在异常边界中，无顶层浏览器副作用。
  - 依据：FR-009；research R6；具体字段及行为以所链接设计原文为准。
  - 前置任务：T004。
  - 完成判据：T004 用例全部通过；读写失败返回契约结果，不抛到调用者，不偷偷保存其他 key。
  - 完成证据：已执行，见 [T005命令/日志索引](evidence/T005/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T006 Refactor：审视 `src/browser-storage.js`，复跑 `tests/browser-storage.test.js`；无需改动时记录审视结论。
  - 依据：tdd/tests；具体字段及行为以所链接设计原文为准。
  - 前置任务：T005。
  - 完成判据：保存实际通过记录；工厂在 Node 和浏览器均可使用，测试未 mock 被测函数。
  - 完成证据：已执行，见 [T006命令/日志索引](evidence/T006/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T007 Red：在 `tests/store-results.test.js` 覆盖 `getTournamentSnapshot({retry=false})` 的 ready/error、合法空 matches、HTTP/网络/JSON/invalid-data、仅重试 teams/matches、并发去重与旧请求不污染新缓存；测试原 getter 的成功与降级兼容。
  - 依据：FR-010；E3；contracts 数据访问；具体字段及行为以所链接设计原文为准。
  - 前置任务：T006。
  - 完成判据：真实 store 对目标缺失行为产生语义断言失败；夹具含未知球队引用/不支持阶段，失败与空结果可区分，未固定48队104场。
  - 完成证据：已执行，见 [T007命令/日志索引](evidence/T007/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T008 Green：在 `src/store.js` 实现 tagged-result Promise 缓存、严格快照接口及轻量结构校验；`retry:true` 仅失效 teams/matches，原 getter 签名、返回类型及降级行为保留。
  - 依据：FR-010；data-model TournamentError；具体字段及行为以所链接设计原文为准。
  - 前置任务：T007。
  - 完成判据：T007 通过；error.kind 严格属于 network/http/parse/invalid-data；不回填被失效旧请求，不把失败当零场，不改持久关注。
  - 完成证据：已执行，见 [T008命令/日志索引](evidence/T008/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T009 Refactor：审视 `src/store.js` 并运行 `tests/store-results.test.js` 及既有数据契约单测，记录旧查询/派生接口共用 ready 缓存。
  - 依据：宪法II/III、tdd；具体字段及行为以所链接设计原文为准。
  - 前置任务：T008。
  - 完成判据：失败缓存/清理/并发用例与旧 getter 回归通过；不另起视图 fetch，不复制球队射手计算。
  - 完成证据：已执行，见 [T009命令/日志索引](evidence/T009/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T010 Red：在 `tests/router-follow.test.js`（单文件 jsdom）验证 `handleRoute({preserveScroll,focusKey})`、返回 committed/path、过期路由不提交、控制更新期间保留控件、普通 hashchange 调用兼容及焦点白名单。
  - 依据：FR-011/E5；contracts 生命周期；具体字段及行为以所链接设计原文为准。
  - 前置任务：T009。
  - 完成判据：用受控延迟路由产生真实竞态，目标行为断言失败；旧路径/新路径交错时最终路径及焦点有独立期望。
  - 完成证据：已执行，见 [T010命令/日志索引](evidence/T010/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T011 Green：在 `src/router.js` 增加兼容可选参数和提交结果，保留 navigationId；仅最新提交允许按安全 focusKey 恢复仍存在的控件，普通导航原滚动/加载行为不变。
  - 依据：FR-011；research R5；具体字段及行为以所链接设计原文为准。
  - 前置任务：T010。
  - 完成判据：T010 通过；控制动作不先销毁旧控件，旧响应不写DOM/抢焦点，未知focusKey不作为任意选择器执行。
  - 完成证据：已执行，见 [T011命令/日志索引](evidence/T011/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T012 Refactor：复跑 `tests/router-follow.test.js`，审视 `src/router.js` 的旧调用、键盘路由与错误回落兼容。
  - 依据：tdd/tests；具体字段及行为以所链接设计原文为准。
  - 前置任务：T011。
  - 完成判据：路由测试通过，监听资源可清理，无新增全局定时器。
  - 完成证据：已执行，见 [T012命令/日志索引](evidence/T012/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T013 Red：在 `tests/follow-stage.test.js` 为阶段顺序/分类、合法 stage 白名单和非法值处理建立真实语义断言。
  - 依据：FR-005；data-model 阶段分类；具体字段及行为以所链接设计原文为准。
  - 前置任务：T012。
  - 完成判据：覆盖 group、round_of_32、round_of_16、quarterfinal、semifinal、third_place、final 与 all 筛选值；缺失/不支持类别不能默默变成合法比赛。
  - 完成证据：已执行，见 [T013命令/日志索引](evidence/T013/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T014 Green：在 `src/features/follow-teams/matches.js` 提供纯阶段顺序/分类及校验辅助；让 `src/store.js` 的必要阶段校验复用它，暂不实现 selectMatches。
  - 依据：宪法III；research R4；具体字段及行为以所链接设计原文为准。
  - 前置任务：T013。
  - 完成判据：T013 和 store 兼容测试通过；常量不依赖 DOM/storage/翻译，不重复维护阶段语义；若调整既有 store 行为先补对应实际 Red。
  - 完成证据：已执行，见 [T014命令/日志索引](evidence/T014/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T015 Refactor：审视 `src/features/follow-teams/matches.js` 与 `src/store.js`，运行阶段/存储/路由测试并在 `specs/001-follow-teams/evidence/foundation.md` 记录基础验收。
  - 依据：tdd/tests、plan 基础边界；具体字段及行为以所链接设计原文为准。
  - 前置任务：T014。
  - 完成判据：基础环境可测试、错误可区分、重渲染边界已测；覆盖审计工具仍待最终阶段建设，不宣称覆盖达标。
  - 完成证据：已执行，见 [T015命令/日志索引](evidence/T015/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。

**检查点**：共享基础目标断言和回归实际满足后，才开始故事。

## 阶段 3：US1 管理关注球队（P1，最小可演示增量）

目标：详情页关注/取消、多队独立保存、刷新恢复，拒绝保存时仍临时有效。独立验收：只从球队详情完成 US1-A1～A4，不依赖赛程筛选实现。双语按钮和必要安全边界随故事交付，不能留到后续才可使用。

- [x] T016 [US1] Red：在 `tests/follow-state.test.js` 为首次恢复、关注/取消、损坏/读写拒绝、保存失败保留内存、后来成功清警告、副本隔离建立测试；严格引用数据约束：“version 不为 1、teamCodes 非数组”视损坏，“恢复只执行一次”。
  - 依据：FR-001～003/009；US1-A1～A4；E1/E2；具体字段及行为以所链接设计原文为准。
  - 前置任务：T015。
  - 完成判据：覆盖“仅保留字符串且精确存在于当前球队字典的代码，去重；大小写不符视无效，不猜测别名”；公开FollowSnapshot严格为initialized=false、teamCodes=[]、followOnly=false、stage=all、restoreIssue=null、saveIssue=null的六字段平铺初值，不含codes/filters/issue别名。getSnapshot、initialize、setFollowed均返回同形新对象和新数组，修改返回值不影响内部；setScheduleFilters的同形返回与行为由T030/T031验证，不在US1提前实现；数据失败不初始化/不写回；实际目标断言Red。
  - 完成证据：已执行，见 [T016命令/日志索引](evidence/T016/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T017 [US1] Green：在 `src/features/follow-teams/state.js` 实现 createFollowState、initialize、getSnapshot、setFollowed 及浏览器单实例；key 固定 `wc2026-followed-teams`，仅保存 `{version:1,teamCodes:[...]}`，去重按字母排序。
  - 依据：FR-001～003/009；Q2；data-model 关注持久化；具体字段及行为以所链接设计原文为准。
  - 前置任务：T016。
  - 完成判据：T016通过；遵守data-model的唯一FollowSnapshot六字段契约，内部Set对外转为排序唯一teamCodes数组；setFollowed的desired须布尔且code有效，非法操作不改状态/不抛错/不保存；先内存后保存，失败不回滚，渲染不重读旧值；更新方法返回同形快照，错误经restoreIssue/saveIssue表达。
  - 完成证据：已执行，见 [T017命令/日志索引](evidence/T017/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T018 [US1] Refactor：审视 `src/features/follow-teams/state.js` 并复跑 `tests/follow-state.test.js`；保留独立factory和浏览器单实例边界。
  - 依据：tdd/tests；具体字段及行为以所链接设计原文为准。
  - 前置任务：T017。
  - 完成判据：状态行为通过，清洗恢复不自动覆盖存储，成功写入才清除 restoreIssue/saveIssue；无需重构时如实记录。
  - 完成证据：已执行，见 [T018命令/日志索引](evidence/T018/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T019 [US1] Red：在 `tests/follow-team-detail.test.js`、`tests/follow-controller.test.js` 建立真实详情/控制器 DOM 测试，覆盖有效/缺失/非法/未知球队、加载失败与重试、按钮aria-pressed、委托幂等/卸载、存储全面拒绝时启动及临时关注。
  - 依据：FR-001/003/009/010；E3/E4；contracts 页面控件；具体字段及行为以所链接设计原文为准。
  - 前置任务：T018。
  - 完成判据：目标行为 Red，原 getTeam/详情渲染及 controller 不被 mock；只控制外部 fetch/storage/路由边界。缺失/非法输入有球队列表入口且不能关注；数据失败不清关注。
  - 完成证据：已执行，见 [T019命令/日志索引](evidence/T019/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T020 [US1] Green：在 `src/views/team-detail.js`、`src/features/follow-teams/controller.js`、`src/app.js` 接入严格快照、关注按钮、一次根委托/重试意图及错误球队路径；以 `src/browser-storage.js` 最小保护 app/i18n 偏好读写，并在 `public/i18n/zh.json`、`en.json` 和 `src/styles/components.css` 补本故事双语控件/提示/可见焦点。
  - 依据：FR-001～003/007/009/010；contracts 全部相关边界；具体字段及行为以所链接设计原文为准。
  - 前置任务：T019。
  - 完成判据：T019 通过；所有await后读最新state，重试意图一次消费，重试时按钮禁用；按钮不放在data-route卡片内，失败提示不暴露原始异常；保留原详情/射手入口，无存储仍能启动和切语言。
  - 完成证据：已执行，见 [T020命令/日志索引](evidence/T020/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。


- [x] T021 [US1] Refactor：审视 `src/views/team-detail.js`、`src/features/follow-teams/controller.js`、`src/app.js`、`src/i18n.js`，复跑本故事及基础测试。
  - 依据：tdd/tests；宪法III；具体字段及行为以所链接设计原文为准。
  - 前置任务：T020。
  - 完成判据：无重复监听/50ms绑定/独立fetch，disposer生效，原路由和主题/语言正常存储路径兼容。
  - 完成证据：已执行，见 [T021命令/日志索引](evidence/T021/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T022 [US1] 对 `src/features/follow-teams/state.js` 执行一次可恢复反向验证：临时将保存失败处理改为回滚，运行 `tests/follow-state.test.js` 必须失败，finally恢复原文及哈希后测试通过。
  - 依据：tests有效性；Q2；具体字段及行为以所链接设计原文为准。
  - 前置任务：T021。
  - 完成判据：在 evidence/T022/ 保留错误行为被识别、恢复哈希及恢复后通过记录；不将变异失败冒充历史 Red。
  - 完成证据：已执行，见 [T022命令/日志索引](evidence/T022/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T023 [US1] 运行 `tests/follow-state.test.js`、`tests/follow-team-detail.test.js`、`tests/follow-controller.test.js` 与既有单测，核对 `src/features/follow-teams/` 及偏好保护行为并记录US1单测检查点。
  - 依据：US1-A1～A4；SC-001/004；具体字段及行为以所链接设计原文为准。
  - 前置任务：T022。
  - 完成判据：真实发现/执行数量、无静默跳过；临时关注导航/翻译保持和恢复异常各有明确断言，发现新缺陷返回对应TDD环。
  - 完成证据：已执行，见 [T023命令/日志索引](evidence/T023/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T024 [P] [US1] 在 `e2e/follow-teams.storage.spec.js` 编写本故事存储故障与数据503后点击重试场景，分别覆盖定向 key 读写拒绝、损坏和全面存储拒绝。
  - 依据：US1-A4；E1～E4；具体字段及行为以所链接设计原文为准。
  - 前置任务：T023。
  - 完成判据：独立context；故障在首次请求前注入，数据失败时原存储不变，解除503后真实重试恢复；这里只写场景，统一由T026执行。
  - 完成证据：已执行，见 [T024命令/日志索引](evidence/T024/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T025 [P] [US1] 在 `e2e/follow-teams.persistence.spec.js` 编写真实UI关注两队、取消、刷新及同源重新打开恢复场景；首次导航前设置locale和需要的storageState。
  - 依据：US1-A1～A3；SC-001；具体字段及行为以所链接设计原文为准。
  - 前置任务：T023。
  - 完成判据：不用addInitScript每次重新seed关注；重开复用存储输入的测试如实标范围，不声称证明浏览器退出落盘；这里只写场景，统一由T026执行。
  - 完成证据：已执行，见 [T025命令/日志索引](evidence/T025/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T026 [US1] 先 `npm run build`，确认4173为本仓库当前dist，再执行US1的Playwright场景及既有冒烟，把结果写 `specs/001-follow-teams/evidence/US1.md`。
  - 依据：SC-001/004；AGENTS 构建前提；具体字段及行为以所链接设计原文为准。
  - 前置任务：T024、T025。
  - 完成判据：US1可仅从球队详情独立演示关注/取消/刷新；构建及浏览器均有实际结果，失败不能勾完成，未知4173服务不能直接复用。
  - 完成证据：已执行，见 [T026命令/日志索引](evidence/T026/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。

**检查点**：可独立演示US1，不代表整个功能完成。

## 阶段 4：US2 集中查看关注球队比赛（P1）

目标：关注并集与阶段交集、ID唯一、明确空状态、结果数、返回保留及刷新默认。独立验收：以给定关注列表/静态夹具直接进入赛程，核对明确比赛ID及顺序，无需通过US1按钮准备状态。实际集成仍复用US1状态模块，默认顺序执行以避开共享文件冲突。

- [x] T027 [US2] Red：在 `tests/follow-matches.test.js` 为 selectMatches 建立主客队OR、多队并集、阶段AND、ID稳定去重、原顺序、空结果/开关关闭及不修改输入的独立期望。
  - 依据：FR-004～006；US2-A1/A2；E6；具体字段及行为以所链接设计原文为准。
  - 前置任务：T026。
  - 完成判据：至少一个目标行为真实断言Red；现有阶段辅助复用，禁止用生产selector计算测试期望。
  - 完成证据：已执行，见 [T027命令/日志索引](evidence/T027/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T028 [US2] Green：在 `src/features/follow-teams/matches.js` 实现 `selectMatches(matches,{teamCodes,followOnly,stage})`，一次建立关注Set并稳定遍历，O(M+F)。
  - 依据：FR-004～005；data-model 比赛集合；具体字段及行为以所链接设计原文为准。
  - 前置任务：T027。
  - 完成判据：T027通过；按id保留首次匹配项，原对象/数组不变；关闭关注仍应用阶段，双方均关注同场仍唯一。
  - 完成证据：已执行，见 [T028命令/日志索引](evidence/T028/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T029 [US2] Refactor：审视 `src/features/follow-teams/matches.js` 并运行阶段/selector及store单测。
  - 依据：tdd/tests；宪法III；具体字段及行为以所链接设计原文为准。
  - 前置任务：T028。
  - 完成判据：阶段定义唯一、结果顺序及匹配语义保持，通过记录对应本次源码。
  - 完成证据：已执行，见 [T029命令/日志索引](evidence/T029/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T030 [US2] Red：在 `tests/follow-schedule.test.js` 和 `tests/follow-filters.test.js` 覆盖真实赛程视图、控件及state筛选patch，验证字段独立、无关注/无匹配/加载失败、结果计数、返回保留/刷新默认、最后操作和详情入口。
  - 依据：FR-003～006/010～012；US2-A1～A5；E5/E6；Q1；具体字段及行为以所链接设计原文为准。
  - 前置任务：T029。
  - 完成判据：约束：“setScheduleFilters(patch) 只更新提供且合法的字段，不能改变另一字段”；stage为all或阶段白名单，非法值不改原值，布尔类型严格；setScheduleFilters返回与getSnapshot一致的六字段平铺FollowSnapshot新对象及独立teamCodes数组；界面目标断言Red。
  - 完成证据：已执行，见 [T030命令/日志索引](evidence/T030/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T031 [US2] Green：在 `src/features/follow-teams/state.js` 实现筛选patch，在 `src/views/schedule.js`、`src/features/follow-teams/controller.js` 接入真实开关/阶段、严格快照、结果数/分组/空状态/静态说明及对应 `public/i18n/zh.json`、`en.json` 文案和 `src/styles/components.css` 样式，移除本页50ms绑定。
  - 依据：FR-004～006/010～012；contracts 控制器；具体字段及行为以所链接设计原文为准。
  - 前置任务：T030。
  - 完成判据：T030通过；数据error优先于空状态，警告独立；所有await后读最新state，返回采用最新关注、刷新默认，正常筛选不发新赛事请求，原比赛卡片键盘/路由保持。
  - 完成证据：已执行，见 [T031命令/日志索引](evidence/T031/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T032 [US2] Refactor：审视 `src/views/schedule.js`、`src/features/follow-teams/state.js`、`controller.js`，复跑真实DOM与集合/基础回归。
  - 依据：tdd/tests；具体字段及行为以所链接设计原文为准。
  - 前置任务：T031。
  - 完成判据：无重复过滤语义/监听，原阶段组序保留；控制器只响应本功能标记，不影响其他页面。
  - 完成证据：已执行，见 [T032命令/日志索引](evidence/T032/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T033 [US2] 对 `src/features/follow-teams/matches.js` 分别临时执行 OR→AND、阶段交集AND→OR、删除ID去重，运行 `tests/follow-matches.test.js` 各应失败，逐次finally恢复并回归。
  - 依据：tests有效性；FR-004/005；具体字段及行为以所链接设计原文为准。
  - 前置任务：T032。
  - 完成判据：三种错误均被有效断言识别，单次变异串行、每次原文/哈希恢复，正常测试通过。
  - 完成证据：已执行，见 [T033命令/日志索引](evidence/T033/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T034 [P] [US2] 在 `e2e/follow-teams.schedule.spec.js` 编写关注并集、阶段组合、重复ID夹具、具体ID与组内顺序、关注→赛程→详情链路。
  - 依据：US2-A1/A2；SC-002/005；E6；具体字段及行为以所链接设计原文为准。
  - 前置任务：T033。
  - 完成判据：用受控夹具的明确独立ID期望，不只断言非空，不mock生产selector；这里只写场景，T036统一执行。
  - 完成证据：已执行，见 [T034命令/日志索引](evidence/T034/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T035 [P] [US2] 在 `e2e/follow-teams.empty-retry.spec.js` 编写无关注、无匹配、取消最后关注后返回、数据503→点重试及已有筛选/关注不被清空的场景。
  - 依据：US2-A3～A5；FR-010；SC-004；具体字段及行为以所链接设计原文为准。
  - 前置任务：T033。
  - 完成判据：三种状态能区分，故障在缓存前注入，恢复靠按钮重试而非仅reload；这里只写场景，T036统一执行。
  - 完成证据：已执行，见 [T035命令/日志索引](evidence/T035/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T036 [US2] 先构建当前 `dist/` 后运行US2和US1浏览器回归，记录 `specs/001-follow-teams/evidence/US2.md` 的匹配ID、顺序、空状态与Q1结果。
  - 依据：SC-002/004/005；AGENTS；具体字段及行为以所链接设计原文为准。
  - 前置任务：T034、T035。
  - 完成判据：US2可用给定关注列表独立验证，不依赖关注按钮准备数据；US1无退步，旧冒烟通过，失败回到对应TDD环。
  - 完成证据：已执行，见 [T036命令/日志索引](evidence/T036/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。

**检查点**：US2和US1回归均有证据，集合匹配不靠结果非空推断。

## 阶段 5：US3 双语使用且保留状态（P2）

目标：实际中英双向切换、关注和筛选不变、旧词典响应不覆盖新意图、焦点与警告保持。独立验收：给定状态后切语言并核对实际文案、codes/开关/阶段/结果ID；不要求重复完成US1完整准备流程。

- [x] T037 [US3] Red：在 `tests/follow-language.test.js` 用反序词典响应验证 `src/i18n.js` 的最后语言意图、只提交最新词典/语言/langchange、toggle按最新请求目标翻转，以及存储拒绝仍可切换。
  - 依据：FR-007/008；E5；contracts 语言异步；具体字段及行为以所链接设计原文为准。
  - 前置任务：T036。
  - 完成判据：真实i18n、受控外部fetch响应；目标断言失败而非缺词典/网络收集错误；同一最新意图不被旧返回覆盖。
  - 完成证据：已执行，见 [T037命令/日志索引](evidence/T037/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T038 [US3] Green：在 `src/i18n.js` 实现语言请求序号、局部加载词典及最新意图提交，保留已做存储保护和原公开接口。
  - 依据：FR-007/008；research R5/R6；具体字段及行为以所链接设计原文为准。
  - 前置任务：T037。
  - 完成判据：T037通过；过期请求不得提交词典、currentLang、document.lang或langchange；正常zh/en及翻转回归通过。
  - 完成证据：已执行，见 [T038命令/日志索引](evidence/T038/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T039 [US3] Refactor：审视 `src/i18n.js` 并复跑语言、存储、路由及原词典对齐单测。
  - 依据：tdd/tests；具体字段及行为以所链接设计原文为准。
  - 前置任务：T038。
  - 完成判据：独立语言序号与导航序号职责清楚，未扩大到翻译服务或聊天配置重构。
  - 完成证据：已执行，见 [T039命令/日志索引](evidence/T039/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T040 [US3] Red：在 `tests/follow-localization.test.js` 验证真实app的langchange与关注/赛程重渲染，新增语言切换焦点恢复断言，并复核codes/开关/阶段/结果ID/保存失败警告保持。
  - 依据：US3-A1～A3；FR-007/008；contracts 焦点；具体字段及行为以所链接设计原文为准。
  - 前置任务：T039。
  - 完成判据：对尚未满足的语言重渲染焦点行为记录Red；已满足的状态断言记回归通过，不人为破坏功能来伪造Red。
  - 完成证据：已执行，见 [T040命令/日志索引](evidence/T040/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T041 [US3] Green：在 `src/app.js` 语言重渲染路径接入受控焦点/滚动保持，按需完善 `src/views/team-detail.js`、`src/views/schedule.js`、`controller.js` 及 `public/i18n/zh.json`、`en.json` 的全量双语状态提示。
  - 依据：FR-007/008；US3-A1～A3；具体字段及行为以所链接设计原文为准。
  - 前置任务：T040。
  - 完成判据：T040通过；切换语言确实发生、关注/筛选/结果ID不变；所有新增文案无裸key，空状态与错误语义双语一致，旧导航焦点不被抢回。
  - 完成证据：已执行，见 [T041命令/日志索引](evidence/T041/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T042 [US3] Refactor：复跑 `tests/follow-localization.test.js` 与语言/路由回归；对 `src/features/follow-teams/state.js` 或语言重渲染入口临时注入“切语言重置筛选”错误，断言失败、finally恢复哈希后通过。
  - 依据：tdd/tests有效性；FR-008；具体字段及行为以所链接设计原文为准。
  - 前置任务：T041。
  - 完成判据：重构审视、反向失败和恢复证据分开；不把故意变异当历史Red，控制动作与语言竞态均保留最新状态。
  - 完成证据：已执行，见 [T042命令/日志索引](evidence/T042/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T043 [P] [US3] 在 `e2e/follow-teams.language.spec.js` 编写中文→英文→中文，分别覆盖详情、赛程、两种空状态和保存失败警告，逐次断言实际语言及完整状态。
  - 依据：US3-A1～A3；SC-003；具体字段及行为以所链接设计原文为准。
  - 前置任务：T042。
  - 完成判据：固定locale且控制已有语言偏好；先确认界面语言再比关注/开关/阶段/比赛ID；这里只写场景，T045统一执行。
  - 完成证据：已执行，见 [T043命令/日志索引](evidence/T043/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T044 [P] [US3] 在 `e2e/follow-teams.keyboard-race.spec.js` 编写Tab/Space/Enter、可见焦点、快速筛选/反序语言响应、完全禁用存储仍启动并临时关注的场景。
  - 依据：E5；FR-007～009；contracts 可访问性；具体字段及行为以所链接设计原文为准。
  - 前置任务：T042。
  - 完成判据：最终控件/词典/结果由最后意图决定，旧提交不抢焦点；测试界定Chromium范围；这里只写场景，T045统一执行。
  - 完成证据：已执行，见 [T044命令/日志索引](evidence/T044/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。


- [x] T045 [US3] 先构建当前 `dist/` 后运行US3及既有/新功能浏览器回归，写 `specs/001-follow-teams/evidence/US3.md`，中英文各完成无需AI的完整链路。
  - 依据：SC-003/005；AGENTS；具体字段及行为以所链接设计原文为准。
  - 前置任务：T043、T044。
  - 完成判据：双向语言、键盘、状态和竞态实际通过，报告发现/执行/跳过及浏览器版本，旧功能无退步。
  - 完成证据：已执行，见 [T045命令/日志索引](evidence/T045/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。

**检查点**：US1～3均具独立场景，仍需最终覆盖门槛及完整回归。

## 阶段 6：覆盖能力、有效性与最终验收

完成 plan V2～V4 的新增行审计及有效性建设，自动化可恢复反向检查、CI本地配置、最终构建/浏览器/单测覆盖。此阶段完成前不得把整体功能标为完成或宣称满足工程门槛。

- [x] T046 Red：在 `tests/added-coverage.test.js`、`tests/fixtures/coverage/` 为权威manifest的git-tree/snapshot重建及缺源/哈希/路径越界失败、全新/修改/重命名、多行语句/注释空白、未import源、缺失报告、D=0、恰好80%与低于80%建立可执行夹具断言。
  - 依据：coverage；plan V2/V3；具体字段及行为以所链接设计原文为准。
  - 前置任务：T045。
  - 完成判据：实际调用拟建审计/捕获工具的真实逻辑，边界有独立C/D预期，Red来自映射/判定能力不足，不是模块未导入。
  - 完成证据：已执行，见 [T046命令/日志索引](evidence/T046/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T047 Green：实现 `scripts/capture-coverage-baseline.mjs`、`scripts/check-added-coverage.mjs` 及 `package.json` 的coverage:baseline/coverage:added；前者接受 `--manifest specs/001-follow-teams/coverage-baseline.json --output .tmp/follow-teams-baseline`，只重建T001既定基线；后者接受 `--baseline .tmp/follow-teams-baseline/baseline.json` 并结合本次完整JSON/lcov生成新增行映射。
  - 依据：coverage；plan V1～V3；具体字段及行为以所链接设计原文为准。
  - 前置任务：T046。
  - 完成判据：T046通过；支持manifest的git-tree/snapshot两种重建，核验固定范围完整清单、受限相对路径与SHA256；输出归一化baseline.json和原源码，不改权威manifest。新增行含src/**/*.js和netlify/functions/**/*.mjs，缺提交/快照/报告/文件、清单遗漏、无法映射或哈希不符均fail closed，无当前HEAD回退，未import文件零命中纳入分母；用例同时覆盖两种模式和重建失败。
  - 完成证据：已执行，见 [T047命令/日志索引](evidence/T047/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T048 Refactor并实际验证 `scripts/check-added-coverage.mjs` 与 `vite.config.js` 采集链，运行 `tests/added-coverage.test.js` 及独立未import夹具的真实Vitest采集，写 `specs/001-follow-teams/evidence/coverage-tooling.md`。
  - 依据：coverage/tests；plan V3；具体字段及行为以所链接设计原文为准。
  - 前置任务：T047。
  - 完成判据：证明provider不是只报告已加载文件；工具以未舍入原始整数5*C>=4*D判定；新文件/旧文件新增行/阈值及缺报告负例确会失败，正常夹具通过。
  - 完成证据：已执行，见 [T048命令/日志索引](evidence/T048/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T049 Red：在 `tests/follow-mutation-runner.test.js` 为 `scripts/check-follow-mutations.mjs` 建立定向测试失败判定、异常/超时finally恢复、恢复哈希、原本测试失败则拒绝变异及进程退出码的工具测试。
  - 依据：tests有效性；plan 反向验证；具体字段及行为以所链接设计原文为准。
  - 前置任务：T048。
  - 完成判据：只在临时夹具中验证runner安全性；目标断言实际Red，不能把一个非业务语法错误当有效变异命中。
  - 完成证据：已执行，见 [T049命令/日志索引](evidence/T049/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T050 Green→Refactor：实现 `scripts/check-follow-mutations.mjs` 并加入 `package.json` 的test:mutations:follow，复跑 `tests/follow-mutation-runner.test.js`；串行修改及可靠恢复，不改测试来造失败。
  - 依据：tests有效性；plan 验证命令；具体字段及行为以所链接设计原文为准。
  - 前置任务：T049。
  - 完成判据：安全性测试通过；finally恢复和恢复后验证可用，记录Green与Refactor各自证据，生产变异不被提交。
  - 完成证据：已执行，见 [T050命令/日志索引](evidence/T050/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T051 对最终 `src/features/follow-teams/matches.js`、`state.js` 与语言重渲染入口运行 `npm run test:mutations:follow`，汇总 `specs/001-follow-teams/evidence/mutations.md`。
  - 依据：FR-004/005/008/009；tests有效性；具体字段及行为以所链接设计原文为准。
  - 前置任务：T050。
  - 完成判据：主客OR、阶段AND、ID去重、失败回滚、语言重置五类错误分别被识别；全程串行，每项恢复哈希一致且最终正常单测通过。
  - 完成证据：已执行，见 [T051命令/日志索引](evidence/T051/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T052 在 `.github/workflows/verify.yml` 集成完整coverage流程及报告留存，checkout设fetch-depth:0，读取 `specs/001-follow-teams/coverage-baseline.json`；先执行 `npm run coverage:baseline -- --manifest specs/001-follow-teams/coverage-baseline.json --output .tmp/follow-teams-baseline`，再test:coverage及 `npm run coverage:added -- --baseline .tmp/follow-teams-baseline/baseline.json`，保留原验证步骤。
  - 依据：coverage/evidence；plan V4；具体字段及行为以所链接设计原文为准。
  - 前置任务：T051。
  - 完成判据：在包含拟交付源码/manifest且不带本地evidence、既有coverage或.tmp产物的干净检出副本中，实际执行与CI相同的重建/采集/审计链；git-tree按原提交校验，snapshot仅依赖随源码提供的baseline-source。错误哈希/缺提交或快照应失败；不回退当前HEAD。留存命令/输入哈希/结果，远程CI未执行另行标注，不创建远程操作。
  - 完成证据：已执行，见 [T052命令/日志索引](evidence/T052/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T053 在最终工作区运行 `npm run validate:data`、`npm test`、`npm run build`，检查 `dist/` 产物，写 `specs/001-follow-teams/evidence/final-build.md`。
  - 依据：FR-007/012；SC-001～005；AGENTS；具体字段及行为以所链接设计原文为准。
  - 前置任务：T052。
  - 完成判据：词条键对齐、真实生产单测和数据/构建通过；无新增运行依赖、赛事事实或Function策略变更；保存最终源哈希。
  - 完成证据：已执行，见 [T053命令/日志索引](evidence/T053/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T054 确认4173为T053当前构建后运行完整 `npm run test:e2e`，汇总 `specs/001-follow-teams/evidence/final-e2e.md`，核对US1～3、Q1/Q2及原冒烟/历史页回归。
  - 依据：SC-001～005；E1～E6；AGENTS；具体字段及行为以所链接设计原文为准。
  - 前置任务：T053。
  - 完成判据：明确Chromium版本与实际执行数，无静默skip、无每次重seed的假恢复、无复用未知服务；静态前端证据不扩称Function/生产响应头通过。
  - 完成证据：已执行，见 [T054命令/日志索引](evidence/T054/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T055 在最终未再变更的生产源码先运行 `npm run coverage:baseline -- --manifest specs/001-follow-teams/coverage-baseline.json --output .tmp/follow-teams-baseline` 重建既定基线，再运行 `npm run test:coverage` 及 `npm run coverage:added -- --baseline .tmp/follow-teams-baseline/baseline.json`，保存原始报告与 `specs/001-follow-teams/evidence/coverage-added.json`。
  - 依据：coverage；plan V1～V4；具体字段及行为以所链接设计原文为准。
  - 前置任务：T054。
  - 完成判据：逐文件新增行集合、未加载文件和基线/最终哈希齐全；D>0原始C/D>=0.8才通过，不平均、不四舍五入、不用E2E/全项目替代；D=0附集合证据记不适用。
  - 完成证据：已执行，见 [T055命令/日志索引](evidence/T055/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。
- [x] T056 更新 `specs/001-follow-teams/quickstart.md` 中已落地命令，在 `specs/001-follow-teams/evidence/acceptance.md` 逐项映射FR/SC/场景与实际证据，并仅据证据更新 `specs/001-follow-teams/tasks.md` 完成状态。
  - 依据：evidence；全部FR/SC及工程规则；具体字段及行为以所链接设计原文为准。
  - 前置任务：T055。
  - 完成判据：所有预期文件、测试发现/跳过、Red/Green/Refactor、变异恢复、C/D、构建和浏览器证据可追溯；失败/未执行/阻塞/不适用分别说明；不得改自定义checklist标记解锁，不自动部署/提交/发布。
  - 完成证据：已执行，见 [T056命令/日志索引](evidence/T056/index.json)；最终源码及验收见 [acceptance.md](evidence/acceptance.md)。
  - 事实状态：verified（根据实际命令、断言及产物复核；失败尝试与未执行范围在验收记录单列）。

**检查点**：全部最终证据可核对后才能勾选相应任务，配置或文件存在不能替代执行。

## 依赖与执行顺序

完整的逐项边由每条“前置任务”定义，均仅指向更早的任务，无反向依赖。

```text
T001 → {T002, T003} → T004…T015
  → US1 T016…T023 → {T024,T025} → T026
  → US2 T027…T033 → {T034,T035} → T036
  → US3 T037…T042 → {T043,T044} → T045
  → T046…T056
```

- 所有 Red→Green→Refactor 必须保持顺序；反向验证是实现后有效性检查，不能代替历史 Red。
- US2 的独立验收可直接给定关注状态，但实际集成依赖已实现 state/controller；US3 使用两个页面及状态。不能宣称三个完整故事可同时修改共享代码。
- T002/T003 可在 T001 后并行；业务故事内仅分离浏览器场景文件的编写标记 [P]。构建、预览端口、实际 Playwright 执行和覆盖报告为共享资源，均串行。
- 覆盖环境 T002 必须先于任何依赖该环境的测试；增量审计 T046～048 只阻塞最终覆盖判定，不阻塞已具备环境的业务 Red。
- 基线捕获脚本晚于基线事实出现，必须消费或核验 T001 保存的原始快照，不允许重新覆盖为实现后源码。
- T052 未执行远程 CI 的状态必须明确；本任务不包含提交、推送、建远程议题、发布或部署。

## 每个用户故事的并行示例

| 故事  | 前置必须完成 | 可并行的文件编写                                         | 统一串行验收           |
| --- | ------ | ------------------------------------------------ | ---------------- |
| US1 | T023   | T024 storage.spec.js；T025 persistence.spec.js    | T026 先build再运行场景 |
| US2 | T033   | T034 schedule.spec.js；T035 empty-retry.spec.js   | T036 先build再运行场景 |
| US3 | T042   | T043 language.spec.js；T044 keyboard-race.spec.js | T045 先build再运行场景 |

文件均在 `e2e/follow-teams.*.spec.js`。编写时分别使用独立夹具/输出，不并行运行共享4173服务，也不跨越尚未满足的Green前置。

## 实现策略

1. 准备并固定基线，完成必须的共享基础。
2. 先完成US1作为最小可演示增量：管理多队关注、持久恢复与明确失败提示。MVP仍须遵守适用规则；不能因“演示”省略实际测试。
3. 加入US2形成“关注→我的比赛→详情”的主要价值链，独立核对比赛集合。
4. 加入US3的双向状态与异步语言保护。
5. 完成有效性/覆盖能力和最终验收，才认定全功能完成；若要只交付MVP，应明确范围并执行该范围的最终覆盖/回归，不能直接跳过工程门槛。
6. 本轮按已分析通过的任务完成implement；不自动提交、发布或部署。

## 需求与验证映射

| 需求／成功标准           | 任务链                                          | 关键证据                           |
| ----------------- | -------------------------------------------- | ------------------------------ |
| FR-001～003、SC-001 | T016～026、T053～056                            | 真实多队关注、取消、刷新/返回、状态副本与持久存储      |
| FR-004～005、SC-002 | T013～015、T027～036、T051、T055                  | 主客OR/阶段AND、ID稳定唯一、明确集合和组内顺序    |
| FR-006、SC-004     | T030～036、T054                                | 未关注与无匹配提示、取消最后关注的最新结果          |
| FR-007～008、SC-003 | T020、T031、T037～045、T051、T053～054             | 词条对齐、真双向语言、同一业务状态、反序词典响应与焦点    |
| FR-009、Q2、E1/E2   | T004～006、T016～026、T044、T051、T054             | 异常存储适配、先内存后保存、全面拒绝仍启动、保存失败不回滚  |
| FR-010、E3/E4      | T007～009、T014～015、T019～026、T035、T054         | error≠空结果、重试实际重取、不清空关注、无效入口无关注 |
| FR-011、Q1、E5      | T010～012、T030～036、T037～045、T054              | 刷新重置筛选/关注恢复、页内返回保留、最后意图获胜      |
| FR-012、E6、SC-005  | T020、T031、T034、T045、T053～056                 | 静态说明、原比赛详情、无AI完整中英文浏览路径        |
| tdd/tests         | 各组Red/Green/Refactor、T022/T033/T042/T049～051 | 实际失败与通过、有效断言、变异恢复哈希            |
| coverage          | T001～002、T046～048、T052、T055                  | 原始基线、全量源与未加载文件、行映射、C/D与工具边界失败  |

## 任务生成阶段的来源（历史记录）

- spec 含Q1/Q2确认；plan、research、data-model、contracts与quickstart均已读取，设计决定不在tasks阶段改写。
- 工程规则来源：宪法1.0.0、factory-1.8.0、easeus-sdd 1.8.0与easeus-project 1.0.0。模板通过setup-tasks实际组合解析，使用进程级SPECKIT_PYTHON_EXECUTABLE指向已装Spec Kit环境，未安装或更新工具。
- Wiki仅作背景，当前提交对应关系unknown；沿用research E1～E8并再次CodeGraph核实store.loadJSON、router.handleRoute、i18n.setLang当前磁盘源码。当前缓存降级、navigationId及语言词典提交边界为verified，不代表新行为已实现。
- 当前HEAD仍为bb09b00616d2d7c151fbde512f7a11f7d35059aa，Git分支main；未提交配置/输入/设计产物属于既有工作。实现前T001必须重新核实完整生产基线。
- 任务生成时未执行这些工作；当前实现结果以各项完成证据和acceptance.md为准。无extensions.yml，前后hook均不适用。

## EaseUS：tasks 阶段规则与依据

使用当前规则快照和已评审项目约定；为适用规则记录落实方式及完成条件。

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
记录来源、适用版本、关键差距与待决定事项。保持该阶段原有职责，不将未执行验证标为通过。

## EaseUS：tasks 阶段规则与依据

使用当前规则快照和已评审项目约定；为适用规则记录落实方式及完成条件。

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
记录来源、适用版本、关键差距与待决定事项。保持该阶段原有职责，不将未执行验证标为通过。

## 项目增补：任务依赖与完成证据

每项任务已列依据、前置、完成判据、证据路径和事实状态。适用TDD均为实际Red→Green→Refactor；有效性变异独立记录；最终覆盖判定依赖能力实际自检及最终源码。

### 项目验证任务

| 影响          | 任务                                   | 完成证据                                |
| ----------- | ------------------------------------ | ----------------------------------- |
| 数据/词条       | T007～009、T020、T031、T037～045、T053     | 严格结果/旧getter、双语键、数据校验与真实语言断言        |
| 领域/存储       | T004～006、T013～018、T027～029、T022/T033 | 真实逻辑单测、断言失败与通过、反向错误被识别              |
| UI/状态/异步    | T010～012、T019～045                    | 控件状态、焦点、重渲染、最后意图及浏览器场景              |
| 构建/浏览器      | T026/T036/T045、T053～054              | 每次先build当前工作区，4173服务来源、实际Chromium结果 |
| 验证能力        | T002、T046～052、T055                   | 采集全量、审计边界及变异恢复能力的实际自检               |
| AI/Function | 不适用：本功能不修改该路径                        | 不安排外部模型/生产策略验证，不扩称静态证据              |

### 最终新增行覆盖记录（由T055实测填写）

| 字段          | 当前状态／需填写内容                                                                         |
| ----------- | ---------------------------------------------------------------------------------- |
| 基线与最终状态     | git-tree bb09b00616d2d7c151fbde512f7a11f7d35059aa；当前未提交源码摘要见evidence/delivery.json |
| 新增生产/可执行行集合 | 全部32生产文件核验；逐行映射见evidence/coverage-added.json                                       |
| 原始单测采集      | Vitest4.1.10，90通过/0跳过；evidence/unit-coverage保存原始JSON/lcov/哈希                       |
| C、D         | C=200，D=200                                                                        |
| 判定          | 200/200=1，5*C>=4*D，通过                                                              |
| 禁止替代        | 全项目百分比、文件百分比平均、E2E或集成覆盖率均不能替代                                                      |

### 完成与评审边界

仅在完成判据与实际证据满足后勾选任务。失败、未执行、阻塞、不适用分别记录。自定义checklist由评审者维护，不为解除门槛擅改。最终源码若再次修改，受影响的测试、构建、浏览器与覆盖报告必须重新对应；禁止预填通过结果。
