# 技术研究：关注球队与我的比赛

日期：2026-10-20。依据：[已澄清规格](spec.md)、宪法 1.0.0、规则快照 factory-1.8.0。本文选择均为技术设计，不宣称已实现或验证通过。

## 研究范围与证据

主代理先读取 OpenDeepWiki，再用 CodeGraph 获取当前磁盘源码；依本地 plan 技能要求，两名只读研究代理分别检查状态／生命周期和测试／覆盖率。没有联网查询或安装依赖。

| 编号 | 来源、适用版本                                                                                                                      | 核实结论与限制                                                                                                         |
| -- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| E1 | `src/store.js:5`、`:21`、`:25`、`:43`，HEAD `bb09b00616d2d7c151fbde512f7a11f7d35059aa`                                           | verified：Promise 缓存将请求失败转成并缓存 `[]`／`{}`；旧 getter 无法报告失败。                                                        |
| E2 | `src/views/schedule.js:6`、`:12`、`:78`                                                                                        | verified：阶段分类为小组或淘汰赛 round，固定顺序分组；筛选只修改 DOM，50ms 后绑定事件。                                                         |
| E3 | `src/app.js:92`、`src/router.js:25`、`:97`                                                                                     | verified：语言切换重新执行路由渲染；路由支持字符串视图和 navigationId 防过期提交；document 上已有路由委托。                                           |
| E4 | `src/app.js:8`、`:14`、`src/i18n.js:6`、`:41`                                                                                   | verified：主题和语言直接读写 localStorage，未捕获异常；完全拒绝存储时可能阻断应用启动或语言切换。                                                     |
| E5 | `src/views/team-detail.js:6`、`src/app.js:53`、`src/views/not-found.js:3`                                                      | verified：详情先查队再取比赛；现路由只接收三位大写代码，其他球队路径进入通用 404，该页仅有首页入口。                                                        |
| E6 | `package.json`、`package-lock.json`、`vite.config.js`                                                                          | verified：原生 ESM，无前端框架；锁定 Vite 7.3.6、Vitest 4.1.10、Playwright 1.62.1、Ajv 8.20.0。没有 coverage-v8、DOM 单测环境或新增行审计脚本。 |
| E7 | `playwright.config.js`、`.github/workflows/verify.yml`、`netlify.toml`                                                         | verified：4173 preview；CI 为 Ubuntu／Node 24／Chromium；静态资源及 Function 同源，CSP 不允许任意新连接。                              |
| E8 | OpenDeepWiki `easeus/WorldCup2026/main` 中文 `architecture/store-and-cache`、`architecture/app-entry-and-router`，读取于 2026-10-20 | 背景资料；与当前 HEAD 的提交对应 unknown。加载失败缓存及路由现状已通过 E1～E5 独立核实；不将 Wiki 建议作为已批准需求。                                        |

## R1：沿用原生 ESM，将状态与 DOM 分离

- **Decision**：新增 `src/features/follow-teams/state.js`、`matches.js`、`controller.js`。state 提供可注入 storage factory，浏览器用一个模块实例；页面继续返回 HTML 字符串，controller 一次绑定持久存在的 `#app`。
- **Rationale**：模块在同一标签页导航及语言重渲染时复用，刷新才新建，直接符合 Q1。纯筛选和状态逻辑可在 Node 单测。
- 接口统一为data-model中的平铺FollowSnapshot（initialized、teamCodes、followOnly、stage、restoreIssue、saveIssue）；公开快照及更新方法返回值都使用该形状，不再使用codes／filters／issue别名。
- **Alternatives considered**：DOM 作为状态会在重渲染时丢失；sessionStorage 会跨刷新恢复，违反 Q1；新增状态库或前端框架无必要。

## R2：关注先写内存，再尝试持久化

- **Decision**：独立 key `wc2026-followed-teams`，保存 `{version:1,teamCodes:[...]}`。只在首次成功取得有效球队字典后恢复一次；先更新内存，再 setItem，失败保留操作与警告；每次用户变更均尝试保存完整当前集合，成功后清除未保存警告。
- **Rationale**：满足 Q2；后续渲染不能重读旧值覆盖临时选择。只保存球队代码，不保存名称、语言或筛选。
- **Alternatives considered**：保存失败回滚违反 Q2；每次 render 重读会覆盖临时状态；自动清洗后立即写回可能在数据异常时破坏记录。只读恢复不写回，下一次用户变更才保存。
- 损坏 JSON、错误版本或整体结构错误视为 restoreIssue；无记录是正常空列表。合法数组内重复或无效代码过滤。球队加载失败不初始化关注，也不据此清空持久记录。跨标签页不订阅 storage 事件。

## R3：复用数据入口，显式表达加载结果

- **Decision**：`store.js` 内新增结果型底层加载器，缓存 `{status:'ready',data}` 或 `{status:'error',kind}` 的 Promise。原 `loadJSON` 及所有旧 getter 从结果中返回原先的降级类型；新增 `getTournamentSnapshot({retry:false})` 给本功能返回 ready／error 联合类型。`retry:true` 只失效 teams、matches 两项，再取数。
- **Rationale**：区分真正空比赛数组与网络、JSON、结构失败，满足 FR-010；继续共用缓存、同源路径和原 getter，不在 view 另起 fetch。
- **Alternatives considered**：检查数组长度无法区分失败；修改所有 getter 为抛错会扩大兼容风险；独立 fetch 会绕过缓存边界。
- 对球队字典、比赛数组及必要标识／主客队引用做轻量运行时检查；不把当前 48 队、104 场写成永久限制，不静默丢弃损坏比赛。重复比赛留给筛选稳定去重。构建数据校验继续负责完整数据契约。
- 缓存创建时写入 Promise，完成时不回填被清除的旧条目；重试与旧请求并存时旧结果只能返回旧调用方，不能覆盖新缓存。路由 navigationId 继续阻止旧视图提交。

## R4：筛选规则集中为纯函数

- **Decision**：`matches.js` 导出阶段顺序／分类与 `selectMatches`。球队条件为主队 OR 客队，多个球队取并集；再与阶段条件 AND；按比赛 ID 稳定去重，不改变输入对象、组内相对顺序或分组语义。结果计数使用去重后的可见比赛数。
- **Rationale**：同一处定义比赛集合语义，供展示及真实单测调用；本功能无服务端查询，无需改造 Function 的领域逻辑。
- **Alternatives considered**：逐球队拼接数组容易重复；视图中分别实现条件容易让开关和阶段互相覆盖；只隐藏整个分组无法正确处理关注球队筛选。

## R5：一次委托与兼容的重渲染

- **Decision**：移除本赛程页 50ms 绑定；controller 同步修改 state，再调用现有 `handleRoute`。增加可选 `preserveScroll`／`focusKey` 参数及提交结果返回值，普通导航行为不变；控制动作等待缓存数据时保留旧控件，最终只提交 navigationId 最新结果并恢复仍存在的对应控件焦点。页面在 await 数据后读取最新 state，不能捕获过期筛选。
- **Rationale**：避免定时器、重复监听和字符串视图大改；快速操作同步进入状态，旧异步渲染不能覆盖最终选择。
- **Alternatives considered**：完整引入 mount/dispose 视图对象影响全部路由；每次绑定新的 document 监听会重复执行；绕过路由局部写大量 DOM 会复制视图逻辑。
- 控件不嵌在比赛卡片 data-route 内。委托只处理标记的真实按钮或 checkbox，忽略其他页面；初始化幂等，返回 dispose 供单测清理。不新增全局 timer、轮询或跨标签页订阅。
- 当前 i18n.loadDict 直接修改共享词典，旧语言请求可能晚到；仅靠路由 navigationId 不能阻止词典被旧响应覆盖。设计增加独立语言请求序号，局部加载词典、仅最新意图提交；toggle 基于请求目标翻转。用延迟反序响应单测及快速切换浏览器场景验证。

## R6：最小存储兼容保护

- **Decision**：新增小型 `src/browser-storage.js` 安全读写适配器，异常保护覆盖取得 `window.localStorage` 本身及 getItem/setItem。关注状态消费结构化结果；app 与 i18n 的现有偏好读写通过适配器降级为默认／当前内存值。
- **Rationale**：完全禁用存储时也要能启动并切换语言，才能兑现 FR-009；不扩大成设置系统重构。
- **Alternatives considered**：只对关注 key 做测试会漏掉 E4 的启动阻断；忽略主题和语言错误与“保存失败仍可使用”冲突。聊天设置已有独立捕获，不扩展修改。

## R7：验证能力建设与门槛

- **Decision**：保留 Vitest 默认 Node；新增 DOM 测试用单文件 jsdom 环境。实现阶段补与锁定 Vitest **同版**的 `@vitest/coverage-v8@4.1.10`，jsdom 作为 Node 24 兼容的开发依赖经 npm 锁定，不新增浏览器运行依赖。覆盖 include 显式包含全部自有生产 JS/MJS；产出 Istanbul JSON、lcov。另建新增行审计与已知边界夹具测试。
- **Rationale**：新增 DOM、存储保护及路由分支同样属于覆盖率分母；仅测纯函数不够。环境按文件选择，原 Node 数据契约测试不改变。
- **Alternatives considered**：全项目 80% 会扩大范围，且不能代替新增行门槛；用 E2E 覆盖代替单测违反规则；只收集被导入文件会漏报未测试代码。
- 研究阶段未安装包或运行测试；兼容性、采集有效性和精确行映射必须在实现阶段以实际执行证明，不能将本决定当作已具备能力。
- 环境有效性在T002以独立Node/DOM冒烟用例证明，早于业务Red；基线在T001先固定为仓库内coverage-baseline.json（git-tree或带baseline-source的snapshot模式），T047只重建、不重拍。T052以不带本地evidence/coverage/.tmp的干净检出复现CI链；具体接口和失败条件见plan的CI V4及quickstart。

## 结论与边界

阻断设计的产品歧义已由 Q1、Q2 消除，技术选择已在上文解决。其余浏览器最低版本与生产 Function 行为不在本功能支持承诺内；覆盖采集与审计是明确的待建设能力，需进入 tasks 后才能证明完成。技术设计无需新增远程接口、账号或服务。
