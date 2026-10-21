# 技术设计：关注球队与我的比赛

**Branch**：实际 Git 分支 `main`；Spec Kit 功能解析标识 `001-follow-teams`（二者独立） | **Date**：2026-10-20 | **Spec**：[spec.md](spec.md)

**Input**：已澄清规格（Q1、Q2 均采用 A），沿用现有技术栈。规格 SHA256：`5BAB341D95348ED3941F530D4D0570826B42869DB2821D65BF43B9B4737AB408`。

## 概述（Summary）

在现有球队详情增加关注按钮，在现有赛程增加关注开关，与阶段筛选取交集并稳定去重。用原生 ES Modules 管理标签页内状态，localStorage 只保存版本化球队代码集合；刷新重置筛选，导航及语言切换保留，保存失败保留临时选择并提示。

数据层添加显式成功／失败结果，兼容旧 getter；根节点一次委托复用现有路由重渲染。最小保护现有主题、语言存储异常，保证存储被拒绝仍可启动。新增运行时代码无需框架、远程 API、服务器或外部服务。

## 技术上下文（Technical Context）

| 项目 | 本功能决定与已核实版本 |
| --- | --- |
| Language/Version | 现有 JavaScript／ES Modules，Node 24+ 工具链；本机 Node 24.21.0、npm 11.19.0。 |
| Primary Dependencies | 锁定 Vite 7.3.6、Vitest 4.1.10、Playwright 1.62.1、Ajv 8.20.0；不新增浏览器运行依赖。 |
| Storage | 同源 localStorage key `wc2026-followed-teams`；标签页模块内存保留筛选、临时关注及警告；公开平铺 FollowSnapshot，六字段契约见 data-model。 |
| Testing | 保留 Vitest 默认 Node；拟补单文件 jsdom DOM 测试、同版 coverage-v8 与增量覆盖审计。原 Playwright Chromium 回归。 |
| Target Platform | 现有浏览器静态站点／Netlify；Chromium 是自动化基线，不新增其他浏览器最低版本承诺。 |
| Project Type | 现有原生前端 SPA；可选 Netlify Functions 不承担本功能。 |
| Performance Goals | 每次选择只做 O(M+F) 集合计算；成功缓存存在时筛选／关注不新增赛事网络请求。无新增吞吐或毫秒 SLA。 |
| Constraints | 双语、静态数据事实不变、真实 TDD、新增自有生产可执行行单测覆盖比值 ≥0.8；Q1、Q2 不得改变。 |
| Scale/Scope | 当前快照 48 队、104 场，仅为本次观察；不固化数量。影响球队详情、赛程及最小数据／路由／偏好边界。 |

## 宪法检查（Constitution Check）

研究前：规格无阻断产品歧义；以下差距已识别，不将现状视为合规证明。设计后：规则均有落实路径，无须豁免；能力缺口仍为待建设，**不代表实现符合或验证通过**。

| 原则／规则 | 适用性、研究前差距 | 设计后依据与完成门槛 |
| --- | --- | --- |
| I 来源与事实 | Wiki 不能对应当前 HEAD | [research.md](research.md) E1～E8 分离 verified／unknown，当前源码复核；设计与实现证据分开。 |
| II 数据契约 | 失败被缓存为空值 | 结果接口、轻量结构检查、明确错误／空状态、静态说明；不修改赛事事实。数据校验及错误恢复用例待执行。 |
| III 职责边界 | DOM 状态与筛选混在页面 | state／selector／controller／store 分工；页面继续呈现，单测真实模块。无服务端重复领域实现。 |
| IV 双语与状态 | 语言切换重建 DOM | 模块实例保留状态；先断言实际语言再验证 codes／开关／阶段／比赛 ID。 |
| V AI 可选 | 本功能无 AI 接口 | 静态路径无需模型；现有限流、SSE、密钥及生产故障策略不变，不作生产验证推断。 |
| language／evidence | 产物和来源需可追溯 | 简体中文，固定标识保持兼容；来源、版本、基线与实际执行状态留档。 |
| tdd／tests | 新行为尚无测试 | 后续先目标行为真实 Red，再 Green／Refactor；关键集合及失败降级做可恢复反向验证，禁止 mock 核心。 |
| coverage | 无采集和增量审计能力 | 明确建设项 V1～V4，证明未加载文件和阈值边界，再以原始整数判定。现状为待建设，不能标已达标。 |

**设计门槛结论**：可以生成任务；没有已知未决产品选择或未经说明的原则偏离。实现验收仍受下列能力建设及实际证据约束。

## 项目结构（Project Structure）

### 功能文档

```text
specs/001-follow-teams/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-and-state.md
└── checklists/requirements.md
```

本阶段不创建 tasks.md；它由下一步 speckit-tasks 生成。

### 拟影响源码（尚未修改）

```text
src/
├── browser-storage.js                  # 新增：安全偏好读写边界
├── features/follow-teams/
│   ├── state.js                        # 新增：关注与会话筛选
│   ├── matches.js                      # 新增：纯阶段／集合规则
│   └── controller.js                   # 新增：一次委托、更新及重试
├── store.js                            # 结果缓存与严格快照接口
├── router.js                           # 保留竞态检查，兼容可选控制重渲染
├── app.js                              # 安装控制器、球队参数错误路由、存储保护
├── i18n.js                             # 存储拒绝保护，语言请求防过期
├── views/schedule.js                   # 组合筛选、结果数与状态呈现
├── views/team-detail.js                # 关注操作与明确数据错误
└── styles/components.css               # 新控件／提示最小样式
public/i18n/{zh,en}.json                 # 对齐词条
vite.config.js                          # 覆盖采集，默认 Node 不变
package.json / package-lock.json        # 仅补开发依赖及验证命令
.github/workflows/verify.yml            # 新增覆盖采集／审计步骤
scripts/{capture-coverage-baseline,check-added-coverage,check-follow-mutations}.mjs
 tests/*.test.js                        # 状态、集合、store、DOM 与审计夹具
 e2e/follow-teams.spec.js                # 用户流程与故障恢复
```

**结构决定**：延续已有 `features`、`views`、`store` 分层；不用新的应用根目录或后端。测试文件最终细分由 tasks 安排，以上 script 为待建设路径。

## 复杂度追踪（Complexity Tracking）

无宪法例外。为满足现有工程规则新增开发验证依赖与脚本，浏览器运行依赖不增加。全局偏好保护和结果型 store 是 FR-009／010 的必要支撑，不能扩展为其他设置、缓存或 AI 系统重构。

## EaseUS：plan 阶段规则与依据
使用当前规则快照和已评审项目约定；为适用规则记录落实方式及完成条件。
<!-- easeus:requirements:643744c3c9752eb505c74dd48b842c8d61f88aeeae9a2f2f304cfe7ed741663f -->
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


<!-- WIZARD:PROJECT:plan-template:START -->
## EaseUS：plan 阶段规则与依据
使用当前规则快照和已评审项目约定；为适用规则记录落实方式及完成条件。
<!-- easeus:requirements:643744c3c9752eb505c74dd48b842c8d61f88aeeae9a2f2f304cfe7ed741663f -->
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




## 项目增补：现状证据与变更设计

### 技术基线复核

复核时间 2026-10-20；HEAD 为 `bb09b00616d2d7c151fbde512f7a11f7d35059aa`。实际 Git 分支 main；setup-plan 返回的 BRANCH 是功能标识，不据此声称已切换 Git 分支。当前已跟踪生产文件相对 HEAD 无差异，未跟踪项仅既有配置／需求及本功能文档。后续实现开始前必须重新核实。

| 维度 | 本次源码／配置证据 | 影响与差距 |
| --- | --- | --- |
| 架构 | research E1～E5，原生 ESM、Hash 路由、静态 JSON | 增加纯状态与筛选、控制委托；store 和路由只做兼容扩展。 |
| 构建 | package.json、vite.config.js | build 先 validate:data 再构建 dist；仅新增双语词条与源码打包，不改静态赛事数据。 |
| 单测 | vite.config.js、tests/data-contract.test.js | Node＋tests/**/*.test.js；DOM 单测及覆盖能力待建设。 |
| 浏览器 | playwright.config.js、e2e、verify.yml | preview 4173；必须当前构建，已有服务来源不明时不得复用。 |
| CI | .github/workflows/verify.yml | Ubuntu、Node 24、npm ci、数据／构建／Vitest／Chromium；补覆盖审计和报告，不省略原验证。 |
| 部署 | netlify.toml | dist、同源 JSON、Functions esbuild、connect-src self；不新增网络或 Function 包含项。 |
| 能力差距 | package.json／lock／vite.config.js | 无 coverage provider、jsdom 或增量审计；V1～V4 必须形成建设依赖。 |

### 架构与契约影响

完整接口见 [contracts/ui-and-state.md](contracts/ui-and-state.md)，恢复与转换见 [data-model.md](data-model.md)。

| 变更行为 | 当前入口／证据 | 拟修改边界与路径 | 共享语义与数据契约 | 失败、恢复与生命周期 | 验证 |
| --- | --- | --- | --- | --- | --- |
| FR-001～003、009 | team-detail／app；E4、E5 | state.js、browser-storage.js、team-detail、app／i18n | 版本化 code 集合；不保存名称或筛选 | restore 一次；先内存后保存；失败不回滚，重渲染不重读旧值 | Node 状态＋jsdom 控制＋E2E 保存故障 |
| FR-004～006 | scheduleView；E2 | matches.js、schedule.js | 主客 OR、球队并集、阶段 AND、ID 稳定唯一 | 所有 await 后读取最新状态，关闭关注不改阶段，结果计数与集合一致 | 独立期望 ID／顺序与反向验证 |
| FR-007～008、011 | app langchange／router；E3 | controller.js、router.js、字典 | Q1：刷新默认、返回保留；双语不改身份 | 一次根委托，保留 navigationId；可选控制刷新保持滚动焦点，旧渲染不能提交 | DOM 竞态／委托幂等＋双向语言 E2E |
| FR-010 | store loadJSON；E1 | store.js 结果缓存＋getTournamentSnapshot | 旧 getter 降级兼容，新接口明确 error／ready | 失败不当有效空；retry 失效两数据集，无关注写入；旧请求不回填新 cache | fetch 边界单测＋503 后点重试 |
| E4／FR-001、010 | app 的三大写字母路由；E5 | app 球队错误路径转交详情处理 | 不新增别名／query；未知队不能关注 | 参数错与加载失败分开，提供球队列表／重试 | 路由形状／未知代码 DOM 与 E2E |
| FR-012 | 原比赛卡片 data-route；E2、E3 | 现有视图与词条 | 比分、标识、组序、详情入口不变；无 Function 变更 | AI 不可用仍可浏览，静态演示说明 | 原冒烟回归＋新中英文流程 |

**控制器方案**：模块 state 同步接收用户动作，调用兼容扩展的 handleRoute；选项 preserveScroll 防止控制动作回顶，focusKey 只映射已定义控件。普通导航仍使用原加载与滚动。控制重渲染等待时保留控件，允许连续操作；提交仍由 navigationId 唯一仲裁；i18n 另以请求序号保护词典和语言提交，旧词典响应不得覆盖最新语言意图，toggle 基于最新请求目标翻转。重试意图只消费一次；不自动轮询，不每次 render 清缓存。不引入新的 mount/dispose 视图对象。

**缓存方案**：共用缓存 tagged result Promise；旧 getter 包装结果维持原降级类型及失败缓存行为。retry 只清 teams／matches，其他资源保持；不重新初始化已恢复关注。数据 ready 前不对存储代码做有效性清洗。详情统计复用同一 ready 缓存及原派生入口，不复制射手计算。

### 兼容性与环境矩阵

| 环境或能力 | 当前证据／支持范围 | 限制与安排 |
| --- | --- | --- |
| Chromium | Playwright 1.62.1 锁文件，CI 安装 Chromium；已批准自动化基线 | 实际浏览器版本／场景结果实现时记录；本阶段未执行。 |
| 其他浏览器／最低版本 | 无逐条批准记录 | 不作新支持承诺；使用现有 ESM、Set、localStorage 和原生控件，存储拒绝可降级。 |
| Node／开发依赖 | README 24+，CI 24，本机 24.21.0／npm 11.19.0 | provider 与 Vitest 严格同版；jsdom 选 Node 24 兼容版本并锁定；npm ci 复现。 |
| 本地 Windows／CI Linux | PowerShell 与 Ubuntu runner | 工具用 Node 路径 API、正斜线相对清单；不依赖 PowerShell 解析测试报告。 |
| Netlify／生产策略 | netlify.toml 只读核实 | 不改 Function、密钥、限流、SSE 或连接策略；preview 验证不能证明生产响应头或 Function。 |
| 存储拒绝／损坏 | 当前主题／语言存在未捕获读写 | 最小适配保护并做完全拒绝验收；只对新 key 故障的用例另行隔离。 |

### 当前启用规则的验证设计

| 规则 | 本功能安排 | 所需实际证据与建设依赖 |
| --- | --- | --- |
| language | 中文文档，新增 zh／en 文案一致 | 词条对齐、实际语言切换与状态断言；命令和 ID 不翻译。 |
| evidence | 来源 E1～E8、spec 两项用户决定，工作区基线 | 命令、时间、HEAD／哈希、退出码、执行和未执行范围；日志存 evidence。 |
| tdd | 状态恢复→关注失败降级→集合规则→严格数据→DOM／路由，逐行为 Red／Green／Refactor | 实际目标断言先失败，避免把缺包或语法错误称业务 Red；记录重构后通过。 |
| tests | 调用真实 state／selector／store／controller，仅替换 storage／fetch 边界 | 发现与执行数、skip、关键断言；OR→AND、AND→OR、删去重、保存失败回滚、重渲染重置的临时变异应失败。 |
| coverage | 全部新增自有生产 JS／MJS，包括旧文件新增行及 UI／偏好保护 | V1～V4、原始覆盖数据、清单行映射及 C／D；不能用 E2E 或全项目平均代替。 |

反向验证须串行隔离，变异前保存文件内容／哈希，使用 try/finally 恢复；失败、超时也必须恢复并确认哈希及正常测试。测试不能 mock 关键 selector/state 函数以制造绿灯。新功能数据层兼容改动要求原 getter 的成功、降级、缓存和派生查询回归。

### 新增生产代码单测行覆盖率设计

- **基线**：本功能实现基线候选 HEAD 为上述提交，当前 tracked 生产文件干净，且无未跟踪生产代码。本次未跟踪配置和 docs 不属于生产新增。实现前 V1 再捕获 HEAD、工作区文件内容／哈希及完整自有生产清单；若已有未提交生产修改，须记录归属并保存对应源码快照，不默认以 HEAD 代表全部现状。
- **范围**：全部 `src/**/*.js`、`netlify/functions/**/*.mjs` 中本功能新文件及新增行，包含 app、router、i18n、store、视图和存储保护；Netlify 本功能预计不变，但枚举保留完整自有生产边界。排除 tests、e2e、scripts、docs、node_modules、dist、生成文件；JSON／CSS 本身无 JS 可执行行，分别靠数据／浏览器验证，不虚构其覆盖率。
- **采集 V1**：补同版 coverage-v8，显式 coverage.include 包含上述全量生产源，输出 `coverage/coverage-final.json`、`coverage/lcov.info`；单文件 jsdom，不改变默认 Node。T002 同时建设 `tests/environment-node.test.js`（默认环境断言 document 未定义）和 `tests/environment-dom.test.js`（单文件 jsdom 注解，实际创建/读取 DOM 并断言），执行 `npx vitest run tests/environment-node.test.js tests/environment-dom.test.js`，确认发现并通过两类环境用例后才进入依赖任务。环境冒烟只证明测试能力，不冒充业务 Red。新依赖仅 devDependency，暂不安装。
- **映射 V2**：工具从捕获基线对比当前文件，使用无上下文新增行映射，包含未跟踪新源文件、旧文件修改增加行和重命名；旧文件增改均纳入，删除行不进入新增分母。用 provider 源码映射后的行命中表定义可执行行，结合 AST／instrumentation 校验注释、空白、多行表达式；不能将无法分类或映射的新增代码静默视为不可执行。缺失文件报告、源码哈希不符或无法映射必须 fail closed，先解决映射再给指标。
- **未加载文件**：必须出现在报告并记录可执行行零命中；报告如果遗漏，审计失败，不从分母消失。V3 以已知新增但未 import 的真实夹具证明 provider 与审计确实计入。
- **判定**：D 为新增可执行行集合大小，C 为其中单元测试命中行数。D>0 用原始整数 `5*C >= 4*D` 判定（等价 C/D≥0.8），显示比例不参与判定，不平均各文件百分比；D=0 才记录不适用及集合依据。
- **能力自检 V3**：夹具覆盖全新文件、修改旧文件、多行语句、注释空白、重命名、未 import 文件、缺失 coverage、恰好 80% 通过及低于 80% 失败；实际执行这些断言才能证明工具可用。夹具不混进应用业务生产目录。
- **CI V4**：以仓库内固定输入 `specs/001-follow-teams/coverage-baseline.json` 为基线权威，不依赖本地 evidence 目录。T001 在生产改动前生成 manifest，至少记录 schemaVersion、mode、baseCommit、固定生产范围及完整文件路径/SHA256清单；不得改为实现后基线。生产源与 baseCommit 完全一致时 mode=git-tree，CI checkout 使用 fetch-depth:0，从 manifest 指定提交提取并逐项核验。存在需保留的实现前生产差异时 mode=snapshot，完整原源码存入同功能目录的 `baseline-source/`，sourceRoot 写入 manifest，相对路径受限于该目录并逐文件核验；缺提交、快照、文件、哈希不符或清单不完整均失败，不回退到当前HEAD。manifest及snapshot模式必要源码作为与实现源码一起提供的版本输入，本阶段只安排生成，不执行提交或推送。
- **CI 基线重建接口**：`npm run coverage:baseline -- --manifest specs/001-follow-teams/coverage-baseline.json --output .tmp/follow-teams-baseline` 只读取既定 manifest／原提交或原快照，输出归一化 `.tmp/follow-teams-baseline/baseline.json` 及对应原源码；不能覆盖权威 manifest。随后 `npm run coverage:added -- --baseline .tmp/follow-teams-baseline/baseline.json` 使用该产物及本次覆盖报告。输出临时目录与原始/增量报告区分。T052 在不带本地 evidence 的干净检出副本中实际执行同一重建、采集、审计链，并验证错误哈希/缺输入会失败；远程CI未执行则另行标注，不以本地复现声称远程通过。
- **待建设命令／输出**：`coverage:baseline`、`test:coverage`、`coverage:added`、`test:mutations:follow`；结果存 `specs/001-follow-teams/evidence/`（实现阶段生成）。V1→V2→V3→V4 按能力依赖推进，配置存在不是通过证据。

### 构建与验收验证映射

| 需求／契约 | 验证层及真实入口 | 命令或操作 | 判定与实际证据位置 |
| --- | --- | --- | --- |
| FR-001～003、009，Q2 | Node 调用真实 state＋适配器；jsdom 真实按钮 | npm test；存储正常、损坏、拒绝读写、临时状态 | codes 正确、失败不回滚、一次恢复、副本隔离、警告保持；evidence，待执行。 |
| FR-004～006 | 真实 selectMatches | npm test，手写独立期望集合与组序 | 主客 OR、阶段 AND、同场唯一、无输入 mutation；evidence，待执行。 |
| FR-007～008、011，Q1 | jsdom 委托／router＋浏览器 | npm test；build 后 test:e2e | 真正双向翻译、返回保留／刷新重置／最新操作、焦点；evidence，待执行。 |
| FR-010、E1～E4 | store fetch 边界＋路由／故障恢复 | npm test；导航前 503，移除后点重试 | error 不当空数据、关注不被清空、旧 getter 兼容、失效后重取；evidence，待执行。 |
| FR-012、SC-005 | 既有静态数据／词条＋真实 UI 流程 | validate:data；build；test:e2e | 无 AI／登录完成关注→筛选→详情，中英文各一次，旧冒烟继续通过；evidence，待执行。 |
| 关键控制逻辑有效性 | 真实生产逻辑可恢复变异 | 待建 test:mutations:follow | 定向测试应失败，恢复哈希一致且回归通过；evidence，待执行。 |
| 新增行 ≥80% | Vitest 单测采集＋新增行审计 | 待建 test:coverage／coverage:added | 全量报告、未加载文件、原始 C／D 及阈值有效性；evidence，待执行。 |

浏览器前先运行 `npm run build` 再 `npm run test:e2e`；已有 4173 必须证明服务本仓库当前 dist，否则重启自己拥有的 preview。固定 locale／语言偏好，不用每次加载重新注入关注值伪造持久化；数据故障在请求缓存前注入并通过真实重试恢复。详见 [quickstart.md](quickstart.md)。

### 阶段交付与复核结论

Phase 0 研究及 Phase 1 数据模型／UI 接口／验证指南已完成文档设计。规则保护段沿用解析后的双 preset 合成模板；无外部 hooks 配置。源码、依赖和 CI 均未改动，本阶段未运行功能测试、构建、覆盖率或部署；这些仍是后续执行项。

技术设计与 12 项 FR、5 项 SC、Q1／Q2 对照无已知冲突，无阻断设计的未解决选择。研究前的加载状态、页面状态与存储保护差距已有设计；覆盖能力 V1～V4 仍待建设，不能宣称实现合规。下一步执行 speckit-tasks 将设计和能力建设拆为有依赖的任务。
<!-- WIZARD:PROJECT:plan-template:END -->
