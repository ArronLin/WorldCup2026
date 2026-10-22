# 研究结论：球队分组筛选

日期：2026-10-21。规格：`spec.md`。当前 HEAD 为 `db26387`；相较功能基线 `d169b3bca1fdf7e0b0dc90e5a9b8ea2805707750` 仅增加 002 规格与检查清单，生产代码相同。以下是设计决定，不是实现完成记录。

## 1. 技术栈与变更边界

- Decision：沿用原生 JavaScript ES Modules、Vite、Hash 路由、静态球队数据、Vitest/V8、Playwright；不新增依赖。
- Rationale：现有球队页已完成分组和详情导航，只需加入筛选状态与控件；已安装版本为 Node 24.21.0、Vite 7.3.6、Vitest/V8 4.1.10、Playwright 1.62.1、jsdom 26.1.0。
- Alternatives：新增组件框架、后端查询或状态管理库增加演示成本，没有需求依据。
- Evidence：`package.json`、`vite.config.js`、`playwright.config.js`、`npm ls --depth=0`，2026-10-21 核实。

## 2. 状态与筛选语义

- Decision：新增一个小型纯逻辑模块，提供可独立创建的状态对象和应用级默认实例。选择使用 Set；初始为空，空集合显示全部。当前标签页导航保留实例，刷新自然重建。
- Rationale：直接实现两项已确认澄清；多选按并集，不把“没有选择”解释为空结果。
- Alternatives：localStorage/sessionStorage 会跨刷新保留状态，不符合确认结果；URL 参数不在规格范围。使用已有关注状态会耦合无关功能。
- Evidence：`spec.md` 的 Clarifications、FR-002/003/006。

## 3. 界面更新与焦点

- Decision：使用 fieldset/legend、原生 checkbox 和“显示全部”按钮；在原球队页渲染全部小组分区，并以 hidden 控制可见范围。选择时同步更新分区、复选框和模式提示，不重新渲染整个路由。
- Rationale：无需修改共享路由或恢复焦点机制，原生控件留在 DOM 中，键盘焦点稳定。约 48 支球队的当前快照无需虚拟列表。
- Alternatives：每次调用 handleRoute 会替换 app 内容，并需扩展其目前仅服务关注功能的焦点恢复逻辑；逐次重建控件增加失焦与竞态风险。
- Evidence：CodeGraph 返回的当前 `src/views/teams.js`、`src/router.js`、`src/app.js`。隐藏分区须同时不可见、不可聚焦；CSS 显式保证 hidden 不被现有布局规则覆盖。

## 4. 生命周期与双语

- Decision：控制器在持久的 app 根节点委托一次 click/change，提供幂等初始化和 dispose。语言切换沿用既有 langchange → handleRoute，球队视图在 await getTeams 后读取最新选择，按新字典重建。
- Rationale：筛选操作同步提交状态，避免连续选择依赖旧 DOM 快照。导航/语言重绘复用状态；控件交互仅作用于当前球队页。
- Alternatives：每次渲染追加 document 监听容易重复响应；无须引入事件总线。
- Evidence：`src/features/follow-teams/controller.js` 的根节点委托惯例与 `src/app.js` 的初始化/语言链路；复用模式，不耦合关注模块。

## 5. 数据边界

- Decision：继续使用 getTeams，不修改数据层。无球队显示中性提示；分组缺失的球队置于“分组未知”，只在显示全部时出现，不生成筛选项。
- Rationale：规格明确不扩展整体取数和重试机制。现有 getter 混合空数据与读取失败，不能虚称已能区分故障类型。
- Alternatives：迁移完整赛事快照和错误重试状态机会扩大本轮范围。
- Evidence：`src/store.js`、spec FR-008/009。验收用受控数据覆盖空数据和缺少分组，不更改真实数据集。

## 6. 测试、覆盖率与任务预算

- Decision：复用测试和新增行覆盖率工具，固定 002 独立基线与输出路径；预算 16 项任务，硬上限 20。
- Rationale：现有工具足够；按三个行为包分别记录 Red/Green/Refactor，其余任务承担基线、浏览器、反向验证、CI 和归档。
- Alternatives：为每个断言拆任务会超出演示预算；跳过 TDD 或降低 80% 门槛不符合规则。
- Evidence：`scripts/capture-coverage-baseline.mjs`、`check-added-coverage.mjs`、`run-unit-coverage.mjs`、`render-added-coverage.mjs` 与 CI 已核实。baseline 命令重建已存在的 manifest，不负责首次创建它。
- 现有 `render-requirements-tdd.mjs` 绑定 001 任务链和旧场景编号，不能直接作为 002 的准确需求/TDD HTML 报告。当前范围采用真实日志及需求到测试映射；不将报告通用化扩入本轮。新增行 HTML 可显式传参复用。

## 来源与未知

OpenDeepWiki `easeus/WorldCup2026/main/tournament-data-and-views/teams-and-team-detail` 已作为背景阅读，其提交版本 unknown；关键事实通过 CodeGraph 的当前磁盘源码与本地配置复核（verified）。其他浏览器最低版本及生产部署效果未验证；本轮继承 Chromium 自动化基线，不新增支持承诺。没有阻塞技术设计的未决项。
