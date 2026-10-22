# Implementation Plan: 球队分组筛选

**Branch**: `002-team-group-filter` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: 已澄清的 `specs/002-team-group-filter/spec.md`。当前提交 `db26387`；功能生产代码基线保持 `d169b3bca1fdf7e0b0dc90e5a9b8ea2805707750`。

## Summary

在现有球队页加入小组复选框和“显示全部”。用一个纯逻辑/内存状态模块和一个根节点委托控制器实现；视图保持现有卡片，选择时同步切换小组分区的 hidden 状态。空选择显示全部，离开后返回保留选择，刷新重置，语言切换继续显示同一组选中的球队。

沿用既有构建与测试工具，不改共享路由、数据层、关注功能或后台。本计划按 **16 项实现任务预算、20 项硬上限**组织，真实 TDD 和新增生产代码单测行覆盖率 ≥80% 均包含在预算内。

## Technical Context

**Language/Version**: 原生 JavaScript ES Modules；开发/CI 基线 Node.js 24，本地 v24.21.0、npm 11.19.0。

**Primary Dependencies**: 已安装 Vite 7.3.6、Vitest/V8 4.1.10、Playwright 1.62.1、jsdom 26.1.0；保持 package-lock，不新增依赖。

**Storage**: 既有静态 JSON；分组选择仅在当前文档内存中，不增加 localStorage、sessionStorage 或 URL 参数。

**Testing**: Vitest node 测纯逻辑，按测试文件启用 jsdom 测真实视图/控制器；Playwright Chromium 验证实际构建。复用 V8、新增行比较及 HTML 渲染脚本。

**Target Platform**: 现有浏览器前端，自动化验收沿用 Chromium；小屏复核控件换行与焦点，不增加浏览器支持矩阵。

**Project Type**: Vite 静态 Web 应用；本功能无服务端接口。

**Performance Goals**: 数据加载后，每次选择至结果显示 ≤1 秒；实际更新为本地同步操作。

**Constraints**: 实现任务 ≤20；无额外框架/存储/数据迁移；真实 TDD；新增自有生产可执行行按未舍入汇总比例达到 80%。

**Scale/Scope**: 当前快照 12 组、48 队，选项由数据生成；仅球队页及启动初始化、词条、样式和测试/CI。完整规则见 [UI 契约](contracts/ui-and-state.md)。

## Constitution Check

研究前检查与设计后复核均完成；下表“通过”仅代表设计满足门禁，运行验证均待 implement。

| 原则／规则 | 研究前判断 | 设计后复核与执行条件 |
| --- | --- | --- |
| I 来源可追溯 | 规格含 2 项确认；Wiki 版本未知 | 通过：research 记录当前源码、配置与版本限制；未知不冒充已验证 |
| II 数据契约 | 复用球队 group/code，数据不迁移 | 通过：未知组及无数据提示明确；保留排序，不推断缺失球队未参赛 |
| III 职责分离 | 页面、状态和事件可局部拆分 | 通过：纯逻辑集中，视图/控制器共用谓词；无新后台或重复赛事算法 |
| IV 双语和状态 | 已有 langchange；明确状态周期 | 通过：内存状态跨路由/语言重绘保留，刷新自然重置；双语场景单独验收 |
| V AI 可选 | 筛选不依赖 AI | 通过：不触及 Function、密钥、限流或流式接口 |
| language/evidence | 继承当前快照 | 通过：中文产物、来源、待执行标记完整 |
| tdd/tests | 既有框架可用，新行为尚无用例 | 通过设计：三组实际 Red/Green/Refactor，关键谓词反向验证，禁止假 Red 与跳过 |
| coverage | 工具已有，002 manifest/CI 尚缺 | 通过设计：预算明确覆盖基线创建、002 门禁和真实输出；能力落实仍待实现验收 |

无需要豁免的宪法冲突。不能以“保持轻量”为由省略失败证据或降低覆盖率。

## Project Structure

### Documentation (this feature)

```text
specs/002-team-group-filter/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-and-state.md
└── checklists/requirements.md
```

后续 tasks 阶段创建 tasks.md；实现阶段创建 coverage-baseline.json、evidence/ 和需求到真实测试的映射。

### Source Code (repository root)

```text
src/features/team-group-filter/state.js          # 新增：分组、可见性和内存状态
src/features/team-group-filter/controller.js     # 新增：委托事件与局部显示更新
src/views/teams.js                               # 修改：控件、可见性、空/未知组提示
src/app.js                                      # 修改：初始化控制器
src/styles/components.css                       # 修改：控件换行、焦点、hidden 规则
public/i18n/zh.json                              # 修改：新增词条
public/i18n/en.json                              # 修改：对应词条
tests/team-group-filter-state.test.js            # 新增：真实纯逻辑
tests/team-group-filter-view.test.js             # 新增：真实视图、翻译、数据边界
tests/team-group-filter-controller.test.js       # 新增：真实事件/状态/DOM
e2e/team-group-filter.spec.js                    # 新增：端到端验收
.github/workflows/verify.yml                     # 修改：接入 002 覆盖率门禁和产物
```

**Structure Decision**: 两个小模块加现有球队视图，不创建独立通用组件系统、服务层或新路由。测试文件可合并，但用例及证据必须保持需求映射。不为压低任务数而合并不可审查的大量无关行为。

## Complexity Tracking

没有架构豁免。避免存储迁移、全局状态框架、路由焦点扩展及报告引擎通用化；与本功能无关的现状差距不扩为任务。

## EaseUS：plan 阶段规则与依据

### 交互与产物语言

自然语言使用简体中文。产品词条补齐中英文；命令和固定标识保留。

### 真实 TDD

按三个行为包分别执行 Red → Green → Refactor：①分组/选择状态；②控件、局部筛选、详情入口与键盘；③双语、空数据、未知组及状态生命周期。Red 必须是目标行为断言失败，导入错误或环境故障不计有效 Red。每步保留命令、退出码、测试名称、源码版本或差异及结果，Refactor 后重跑对应测试。

### 新增生产代码单测行覆盖率

固定功能基线，复用已有单测 V8 与新增行审计；实现前创建 002 manifest。当前仅制定验证方案，不声称覆盖率已经达标。

### 有效测试与完成证据

纯逻辑、真实控制器与真实视图参与测试，允许替代网络/数据输入，不允许 mock 掉被测筛选核心。验收需核对发现数、执行数和跳过数；关键可见性谓词反向验证应导致目标断言失败，恢复后通过。

### 来源与事实核实

来源为本功能规格、宪法 1.0.0、factory-1.8.0 规则快照、当前源码与配置。Wiki main 未给出提交 SHA，仅作背景；具体决定和替代方案见 research.md。模板采用 core + easeus-sdd + easeus-project，合并重复的规则章节。

## 项目增补：现状证据与变更设计

### 技术基线复核

复核时间 2026-10-21；HEAD db26387 相对 d169b3b 仅增加规格文档，工作区无生产代码修改。未跟踪的 requirements/task-2.md 为本次原始输入，不纳入生产代码基线。

| 维度 | 当前证据与核实结果 | 本功能影响 |
| --- | --- | --- |
| 架构 | CodeGraph 当前 teams.js、app.js、router.js、关注控制器；原生模块与 Hash 路由 | 两个小模块；控制器独立命名空间，复用现有路由与取数 |
| 构建 | package.json 的 build = validate:data + vite build | 原有构建覆盖本次，产物仍为 dist |
| 单测 | vite.config.js：node 默认、tests/**/*.test.js、V8 生产范围 | 纯逻辑沿用 node；DOM 测试文件指定 jsdom |
| 浏览器 | playwright.config.js：e2e、4173、preview | 构建后执行；控制 locale、偏好与测试数据 |
| CI | verify.yml：Ubuntu、Node 24、npm ci、Chromium | 保留已有检查，追加 002 基线/门禁/HTML；同次覆盖率采集复用 |
| 部署 | netlify.toml：dist、静态数据、同源网络策略 | 没有新网络请求或 Function 变更，不需新增部署步骤 |
| 覆盖率差距 | 当前已经具备新增行工具；模板“尚未配置”描述已过时 | 只补 002 manifest、显式参数、CI，不重新建设框架 |

### 架构与契约影响

| 需求 | 入口和边界 | 设计与资源生命周期 | 验证 |
| --- | --- | --- | --- |
| FR-001–003 | teams.js → state.js | 完整数据生成选项，唯一谓词决定 visible；控制器同步更新 hidden | 纯逻辑/DOM 与集合精确断言 |
| FR-004/006 | 既有 data-route 卡片、应用级状态实例 | 不截获导航；内存保留，reload 清空；异步视图取数后读最新状态 | 详情往返、刷新、新页面 |
| FR-005/007 | 既有语言重绘；原生 checkbox/button | 状态不变；筛选不替换节点，焦点不丢；根节点监听幂等/可清理 | 双语、Tab/Space、dispose 和重复初始化 |
| FR-008/009 | getTeams 现有结果 | 空数据中性提示；未知组只在全部可见；不改缓存/重试机制 | 空、失败响应与缺少分组夹具 |

筛选本身无异步请求、计时器或订阅。页面过期响应继续由 router.navigationId 防护；不复制该机制。协议、数据格式和 Function 保持现有边界。

### 兼容性与环境矩阵

| 环境 | 已批准/继承范围 | 未知与验证安排 |
| --- | --- | --- |
| Chromium | 宪法的自动化基线 | 记录实际 Playwright/浏览器版本；本阶段未执行浏览器测试 |
| Node/依赖 | Node 24、现有 lockfile | 本地 Windows 24.21.0；CI Ubuntu 24，使用 npm ci 复现 |
| 其他浏览器 | 无新增最低版本承诺 | 不作为本次阻塞；使用原生控件及既有构建目标 |
| Netlify/AI | 不增加服务端能力 | 未验证生产响应头/Function；普通 preview 不作为此类证据 |

### 当前启用规则的验证设计

| 规则 | 执行安排 | 所需证据与预算归属 |
| --- | --- | --- |
| language | 文档中文；新增 UI 双语 | 词条与实际语言断言，行为包③ |
| evidence | 确认需求与源码现状分开；记录版本 | research、基线、最终 acceptance.md |
| tdd | 三行为包各自 Red/Green/Refactor | 每阶段日志与源码差异，9 项预算 |
| tests | 真正调用生产逻辑；核心谓词反向验证 | 失败原因、恢复后结果、执行/跳过统计 |
| coverage | 固定基线，V8+diff，未舍入汇总 ≥80% | manifest、JSON/lcov/hash、C/D、门禁退出码 |

### 新增生产代码单测行覆盖率设计

- 基线：`d169b3bca1fdf7e0b0dc90e5a9b8ea2805707750`；当前后继提交只有规格文档，生产代码未变，因此无需移动基线。
- 实现前生成 coverage-baseline.json：schemaVersion=1、mode=git-tree、baseCommit 固定为上述 SHA、productionPatterns 与现有工具一致、hashNormalization 沿用 LF 规则；files 列全固定 Git 树中的生产文件路径和规范化内容 SHA256。不可复制 001 的文件哈希或把修改后工作区当基线。
- 范围：`src/**/*.js`、`netlify/functions/**/*.mjs`，按基线比较本功能新增行。测试、第三方、静态词条/CSS、构建产物不计入可执行生产 JS 行；app.js 与 teams.js 的新增行为同样纳入。
- 工具：coverage:baseline 重建 manifest；test:coverage 保持默认 coverage 输出，校验源码哈希；coverage:added 显式指定 002 输出。既有 include 纳入未被测试导入的生产文件，JSON/lcov 及现有工具自测校验映射。
- 判定：D 为新增自有生产可执行行，C 为单测覆盖行；D>0 按未舍入 C/D≥0.8，不平均各文件百分比；D=0 记不适用且给出行集合。E2E 不替代单测。
- 归档：002/evidence 下保存报告与原始单测 JSON/lcov/hash；新增行 HTML 从该轮报告生成。保留 001 报告路径，不覆盖历史结果。
- CI：保留现有 001 检查，在同一份新采集的覆盖率上追加 002 基线重建与审计，上传 002 结果/HTML；两个检查失败均应使 job 失败。

### 构建与验收验证映射

| 需求／契约 | 验证层与真实入口 | 命令/操作 | 判定与证据 |
| --- | --- | --- | --- |
| FR-001–003、EC-01–02 | state.js 真实分组/可见性/状态 | npm test -- tests/team-group-filter-state.test.js | 单组/多组/空/全选/连续切换精确匹配 |
| FR-004/007、SC-002 | teams.js/controller.js，真实 DOM | 定向 Vitest + Playwright | 信息/顺序/焦点保持，隐藏卡片不可 Tab；更新≤1秒 |
| FR-005/006 | 实际应用与语言/导航 | Chromium 中文→英文→中文、详情返回、reload | 先核对语言，再核对球队 code 集合及选择 |
| FR-008/009 | 视图与受控数据 | 空字典/加载失败/未知分组场景 | 中性提示和未知组边界 |
| 回归/构建 | 既有关注功能、路由、数据检查 | npm test；npm run build；npm run test:e2e | 必须实际发现并执行；不得静默跳过 |
| 覆盖门禁 | 全量生产 include + 固定基线审计 | quickstart 命令 | C/D、原始文件、哈希、退出码，待执行 |
| 有效断言 | 对真实 isGroupVisible 做临时反向变更 | 备份→错误谓词→目标失败→恢复→通过 | 不提交错误代码，保存两次实际结果 |

全部运行证据在实现阶段保存到本功能 evidence，当前均为待执行。

### 轻量任务预算（供 tasks 阶段使用）

| 工作包 | 任务数 | 包含内容 |
| --- | --- | --- |
| 基线准备 | 1 | 002 manifest、环境/原始回归记录 |
| 纯逻辑与内存状态 | 3 | Red、Green、Refactor |
| 控件、局部显示与键盘 | 3 | Red、Green、Refactor；含启动接入与样式 |
| 双语、数据边界与生命周期 | 3 | Red、Green、Refactor |
| 浏览器验收与回归 | 1 | 构建后真实端到端、导航/刷新/语言/快速切换/性能 |
| 可恢复反向验证 | 1 | 错误谓词被断言识别，恢复后通过 |
| CI 接入 | 1 | 002 基线、门禁、报告上传，复用原有工具 |
| 最终单测/覆盖率门禁 | 1 | 原始报告、未舍入 C/D、新增行 HTML |
| 小屏与键盘人工复核 | 1 | 控件换行、可见焦点、无水平溢出 |
| 验收证据归档 | 1 | 需求到真实测试映射、日志、结果说明 |
| **合计** | **16** | **保留 4 项余量，硬上限 20** |

这是设计预算，不是已生成或已完成的 tasks.md。tasks 阶段须复核计数；发现拆分超限时先合并同一行为的合理执行单元或调整设计，不删除验收要求。两份 HTML 报告框架的通用化不纳入本功能；002 需求/TDD 追踪用 Markdown 映射与原始日志，不调用绑定 001 的生成器伪造覆盖。
