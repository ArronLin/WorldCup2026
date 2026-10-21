# 关注功能接口与用户界面契约

关联：[规格](../spec.md)、[数据模型](../data-model.md)。本应用不新增 HTTP API；对外契约是页面行为，对内接口保证可验证性。以下均为待实现设计。

## 入口与路由

| 入口                                | 契约                                            |
| --------------------------------- | --------------------------------------------- |
| `#/team/ARG` 等有效球队                | 读取明确成功的赛事快照，显示原球队内容与关注按钮。                     |
| `#/team`、`#/team/`、缺失／非法／不存在的球队参数 | 显示找不到球队与前往 `#/teams` 的链接，不显示可用关注操作；不能与加载失败混淆。 |
| `#/schedule`                      | 已有赛程页内新增筛选，不新增页面、导航项或筛选 query 参数。             |
| 原 `/match/<id>`                   | 比赛卡片保留原 data-route、键盘进入与显示信息。                 |

`app.js` 只将 `/team` 前缀下的参数错误转交 teamDetailView 处理，原其他路由顺序不改变；参数不直接插入 HTML。有效路径保持原大小写契约，不新增小写别名。

## 页面控件

- 关注操作使用真实 `button type=button`，`aria-pressed` 表示状态，文案明确表达“关注球队／取消关注”。当前球队 code 经数据验证后写入受控 data 属性。
- 关注筛选使用带可访问名称的原生 checkbox；阶段使用原生 button 与 `aria-pressed`，不可只靠颜色。阶段不存在于快照时不制造虚构比赛。
- 顶部结果数为当前可见唯一比赛数量；关注关闭时也保留原阶段条件。既有阶段分组、组内顺序及比赛详情不改变。
- 无关注：双语提示＋球队列表链接；无匹配：双语提示＋可修改的阶段／关注控件；加载失败：双语提示＋真正执行重取的按钮。
- 读取失败与保存失败分别提供对应文案。保存失败警告使用 `role=status`／`aria-live=polite`，在导航返回及语言重渲染后仍可见，不声称已永久保存。
- 赛程说明包含静态演示、非实时或官方信息的含义；复用已有 token 与样式，不新增视觉框架。
- 所有新增控件可通过 Tab、Space／Enter 操作，清楚显示 focus；语言和控制动作重渲染后将焦点恢复到相同且仍存在的控件。普通页面导航继续使用原路由滚动行为。

建议新增词条命名空间 `follow.*`（follow、unfollow、onlyFollowed、empty、chooseTeams、noMatches、restoreUnavailable、restoreCorrupt、saveFailed、dataError、retry、teamNotFound、staticNotice）。`public/i18n/zh.json` 与 `en.json` 同步维护，不展示异常原文或词条 key。

## 存储适配器与 state

`browser-storage.js` 提供 `read(key) -> {ok:true,value:string|null}|{ok:false}`、`write(key,value) -> {ok:boolean}`；取得浏览器 storage、读取及写入均在异常边界内。生产默认依赖 window，factory 可注入抛错或受限存储的测试替身；不得 mock 被测状态和筛选逻辑。

| state 接口                       | 行为与错误                                         |
| ------------------------------ | --------------------------------------------- |
| `createFollowState({storage})` | 创建独立状态；无顶层浏览器存储副作用，便于 Node 测试。                |
| `initialize(teams)`            | 只接受成功加载的有效球队字典；幂等恢复一次；数据失败不得调用；返回 FollowSnapshot。 |
| `getSnapshot()`                | 返回平铺 FollowSnapshot：initialized、teamCodes、followOnly、stage、restoreIssue、saveIssue。 |
| `setFollowed(code,desired)`    | 同步改内存再保存；失败保持更改，通过返回快照的 saveIssue 表达；无效 code 不操作；返回 FollowSnapshot。 |
| `setScheduleFilters(patch)`    | 平铺 patch 仅含 followOnly／stage；严格校验且不重置另一字段；返回 FollowSnapshot。 |

`FollowSnapshot` 的唯一字段、初值、枚举及JSON示例以 [数据模型](../data-model.md) 的“内存状态”为准；没有 codes／filters／issue 别名或嵌套对象。每次返回新对象及独立 teamCodes 数组，修改返回值不能影响内部状态；三个更新方法也遵守这一副本契约。

state 不直接依赖 DOM、翻译、fetch 或 Netlify；`matches.js` 的阶段和集合规则不直接读全局 state。

## 数据访问

`getTournamentSnapshot({retry=false}) -> Promise<ready|error>`，结果类型见数据模型。团队与比赛均通过 `store.js` 同一底层结果缓存读取。运行时验证失败返回 invalid-data，不能回退成无匹配。

- 旧 `getTeams/getMatches/getTeam/getMatchesByTeam/getTeamTopScorers` 等签名及降级类型保持兼容；新增结果接口不调用已吞掉错误的旧 getter 来猜状态。
- `retry=true` 在开始请求前仅失效 teams、matches；刷新失败结果后重新校验。保留其他缓存及所有关注／筛选内存状态。按钮在当前重试中禁用，避免重复并发重试；导航或语言变化仍允许由 navigationId 仲裁。
- 详情先区分结构合法参数、数据 error、字典中无球队。数据 ready 后沿用已有射手及比赛展示；派生函数若复用旧 getter，应共享本次 ready 缓存，不能又读取独立快照。
- 最小运行时检查覆盖本功能必需的字典、标识、主客队引用及支持阶段；不在此新建“官方完整性”保证，也不改变数据 schema 文件内容。

## 控制器与异步生命周期

1. app 启动时在 `#app` 安装一次 click／change 委托，只响应 `data-follow-action` 等本功能标记；忽略其他页面。初始化幂等，提供 disposer 供测试清理。
2. 页面 async 获取快照，ready 后 initialize state；**所有 await 完成后**再读取最新筛选与关注进行渲染。错误分支不清洗关注。
3. 用户动作先同步修改状态，再 `handleRoute({preserveScroll:true,focusKey})` 重新渲染当前页面。控制动作不先销毁旧控件；这允许快速连续动作进入同一状态实例。
4. `handleRoute` 保留原 requestId/navigationId 检查；返回 `{committed:boolean,path}`。只在最新提交后应用焦点恢复。普通 hashchange Event 没有上述选项，兼容原调用。
5. focusKey 仅接受已定义的关注按钮／筛选／阶段／重试标记，不能成为任意选择器注入入口。若路由已改变或控件已不存在，不把焦点移回旧页。
6. 重试使用 controller 的一次性 retry 请求意图；调用 `getTournamentSnapshot({retry:true})`，随后意图清除；不在每次 render 自动清缓存。数据失败可重复手动重试。
7. 不新增定时绑定、轮询、跨标签页监听或后端资源。刷新创建新模块实例，符合 Q1；导航和翻译不会重建 state。

语言异步也需独立防过期：i18n 用请求序号记录最新语言意图，词典加载先返回局部结果，只有最新请求可提交全局词典、currentLang、文档语言和 langchange；旧响应丢弃。toggle 根据最新请求目标计算下一目标，不能因请求未完成重复提交同一目标。主题／语言持久化失败不阻止该内存提交。该最小保护用于连续切换验收，不扩大为翻译服务重构。

## 必需契约验证

测试须直接调用真实 state、selector、store 和 controller；外部 storage／fetch 可注入或拦截。浏览器从实际 UI 确认关注、组合条件、状态保留、重试、双语、键盘和详情入口。错误提示不以 console 无异常或结果非空代替正确性判定。
