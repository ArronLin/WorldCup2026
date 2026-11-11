# 接口契约：赛程日期区间筛选

本契约约束应用内模块、界面及现有数据消费边界，不新增 HTTP 接口。需求及状态转换分别见 [规格](../spec.md) 和 [数据模型](../data-model.md)。下述接口与选择器已实现，验证结果见 [任务清单](../tasks.md)。

## 纯逻辑与状态接口

| 入口 | 输入／输出 | 约束 |
| --- | --- | --- |
| `isValidISODate(value)` | 任意值 → 布尔值 | 只有非空真实日期返回真；无 DOM、语言、时区或存储依赖 |
| `validateDateRange(draft)` | 两个字符串 → 数据模型约定的判别结果 | 同时收集字段错误，合法后再判断倒置，不修改输入 |
| `filterMatchesByDate(matches, applied)` | 已去重比赛与合法区间 → 新数组 | 包含两端；保序；无日期限制时保留全部输入项 |
| `createScheduleDateState()` | 无持久化依赖 → 状态实例 | 提供 `getSnapshot`、`setDraft`、`apply`、`clear`、`discardDraft`，转换按数据模型 |
| `renderDateControls(snapshot)` | 日期快照 → 界面标记 | 用 `t()` 与下述日期摘要规则显示生效条件；不把草稿直接拼入 HTML 属性 |
| `syncDateControls(root, snapshot)` | 当前根节点与最新状态 → 局部 DOM 更新 | 使用 `.value`／`textContent`，仅值不同时回填；恢复输入和错误，不替换控件，不触发输入事件 |
| `initScheduleDateRange({ root, state, refresh, subscribe })` | 默认使用生产实例，可注入边界依赖 → 解绑函数 | 同一根节点只注册一次；解绑所有委托和路由订阅 |
| `withScheduleDateFocus(options, defaultTarget?)` | 刷新选项及可选默认目标 → 带焦点解析回调的选项 | 调用时捕获意图版本，返回选项可在语言加载后使用；仅装饰赛程同页刷新，不另建渲染队列 |

已有 `selectMatches`、关注状态及 `handleRoute(options)` 的原选项保持兼容；后者仅新增可选焦点解析回调。赛程只把已生效日期传给日期筛选，禁止传草稿。

### 日期摘要

`view.js` 仅格式化 `applied` 中已通过验证的非空 `YYYY-MM-DD`，直接拆出年月日分量；四位年份按十进制数显示，不能把 `0001`／`0099` 解释为 1901／1999。通过成对词条 `schedule.date.value`、`schedule.date.month.01`—`schedule.date.month.12` 与 `t()` 组合文字：中文模板为 `{year}年{month}月{day}日`，月份词条为 1—12；英文模板为 `{month} {day}, {year}`，月份词条为英文完整月份名称，日不补零。不构造 `Date`、时间戳或做时区换算，不调用现有 `formatDateFull()`。

两端为空、仅开始、仅结束和双端范围分别用已有规划的 `schedule.date.*` 摘要词条组合，空端点不传入日期格式化；非法／未应用草稿不改变摘要。语言变化只改变文字，年月日和生效值保持不变。

验证在 UTC、Asia/Shanghai、Pacific/Apia 下分别覆盖中英文及四种摘要形式。`2011-12-30` 必须显示“2011年12月30日”或“December 30, 2011”，即使该日期在当地民用时区被跳过；同时核对 `0001-01-01`、`0099-12-31`、`9999-12-31` 和赛事内日期，年份与日历日期不得变化。视图单测独立于控制器及路由；浏览器验证实际应用后的摘要、输入与匹配结果，不能只验证格式化函数。

## 路由通知与焦点

在 `src/router.js` 新增 `subscribeRouteLifecycle(listener)`，返回取消订阅函数。路由不导入日期特性。订阅者不能在提交通知中再次发起渲染。

| 通知 | 时机 | 载荷与处理 |
| --- | --- | --- |
| `navigation` | 目标路径与上次请求路径不同，在等待视图前同步通知 | `{ type, from, to, navigationId }`；控制器仅在从赛程转向非赛程时放弃草稿 |
| `rendered` | 仅最新请求写入页面后、焦点恢复前 | `{ type, path, navigationId }`；控制器在赛程控件存在时同步最新草稿与错误，更新持久数量播报区 |

既有 `navigationId` 继续控制谁能提交；被丢弃请求不发送 `rendered`。初次导航的 `from` 可为空，不能误清日期。`/schedule` 与 `/schedule/` 都视作赛程，不改变现有路由匹配语义。

### 目标身份与回退

`handleRoute` 新增可选 `resolveFocusTarget()`，在最新请求检查通过后、替换旧 DOM 前同步返回 `{ target, fallback }`。两项均为以下目标描述之一，或 `null`：

- `{ kind: 'key', key }`：按下表的受限键及精确值匹配重建后的元素，不把键拼成任意 CSS 选择器。
- `{ kind: 'element', element }`：保留 `#app` 外未被替换的实际控件，例如语言、主题按钮；不能用已销毁的赛程节点引用代替稳定键。
- `null`：没有候选；`target` 为空或不可用时才尝试 `fallback`。两项均空时不主动移焦。

| 目标范围 | 稳定身份 |
| --- | --- |
| 日期输入与操作按钮 | `data-date-focus`：`schedule-date-start`、`schedule-date-end`、`schedule-date-apply`、`schedule-date-clear` |
| 原关注、阶段及重试控件 | 保留 `data-follow-focus` 及既有允许键 |
| 赛程比赛卡片 | 新增 `data-route-focus="schedule-match:<id>"`，以比赛 ID 标识；键格式限定为已校验数字 ID，不能按列表序号或译文定位 |
| 赛程空态的选择球队链接 | 新增 `data-route-focus="schedule-choose-teams"` |
| 语言刷新会重建的顶栏导航 | 新增 `data-route-focus="shell-nav:<path>"`，路径仅允许现有导航项，跨语言保持身份 |

上述映射覆盖当前赛程的可交互控件；不得因为可用控件没有加入映射就回退到按钮。新增键须同时加入允许集合／格式规则及对应范围的查找逻辑；同一范围内身份唯一。比赛路由、链接目的地及控件语义不变。

日期操作的 `fallback` 固定为该次操作的默认目标：成功应用按钮、清除按钮或首个错误字段。无后续主动操作时 `target` 使用该默认目标；有后续操作时使用最新主动选择的目标。阶段、关注及重试保留各自操作控件为默认；语言按钮发起切换时以该按钮为默认。没有回调的原调用方继续使用既有 `focusKey` 行为，`hashchange` 事件调用与返回值 `{ committed, path }` 不变。

可用性在新 DOM 与最新状态回填完成后判断：目标仍连接、可以聚焦且可操作，未被自身或祖先的隐藏／`inert` 状态排除，且未禁用。实际聚焦须核对活动元素；候选失效或聚焦失败时才尝试默认目标。默认目标应在数据就绪的日期刷新中保持可用；真正导航离页后不执行旧页面的回退。日期操作使用 `preventScroll: true`，不回到页面根部或强制滚动到页顶。

### 意图记录与提交顺序

控制器在每次操作起点记录默认目标与交互版本；日期输入、提交／清除及文档级 `focusin` 更新最新意图，覆盖赛程与外壳。自身 DOM 替换、回填和程序化恢复不算新的主动操作。即使移焦后又回到原控件，也以最新版本为准；元素后来消失时仍保留其身份供失效判断，不能把浏览器回落到 `body` 当成用户选择。

`withScheduleDateFocus` 同时用于日期控制器、通过 `initFollowTeams` 既有 `refresh` 参数注入的包装函数，以及 `langchange` 链路。默认目标依次取显式 `defaultTarget`、已有 `focusKey` 或操作起点的活动控件。语言按钮激活时，以该按钮为默认目标调用包装器并保存返回选项，再调用异步 `toggleLang()`；`langchange` 在 `buildNav` 等外壳刷新前取出最新语言操作的选项，不能重新捕获版本而漏掉词典等待期间的交互。没有按钮上下文的语言事件按事件前当前目标创建选项。旧语言操作的完成不能清除较新操作的上下文；离开赛程即使后来返回，旧上下文也已失效，不恢复旧日期焦点。

仅最新请求执行以下同步提交段，中间不插入新的异步等待：检查 `navigationId` → 解析目标并捕获必要选区 → 替换 DOM → 通知 `rendered` 回填当前草稿、错误及提示 → 再核对请求身份 → 检查候选／默认的可用性并恢复焦点。选区仅对同一输入和未变化的当前值恢复，也在该受保护段内完成；调用方不得在 `await refresh()` 后再次无条件聚焦。过期请求不触发回填、焦点、选区或数量播报。

## 界面接口

| 元素 | 约定 |
| --- | --- |
| 日期表单 | `[data-date-form]`，仅数据就绪时出现，`novalidate`，统一由应用处理校验 |
| 日期输入 | `[data-date-field="start"]`／`[data-date-field="end"]`，`type="text"`，显式标签和格式说明；不设赛事日期上下限或截断长度 |
| 操作 | `[data-date-action="apply"]` 为提交按钮；`[data-date-action="clear"]` 为普通按钮；数据就绪时两者可重复操作 |
| 摘要与草稿提示 | `[data-date-summary]`、`[data-date-pending]`；摘要只描述生效值，草稿提示仅由 `dirty` 决定 |
| 错误 | 固定字段错误 ID，通过 `aria-describedby` 与格式说明共同关联；有错误时 `aria-invalid="true"`，文字不能只用颜色表达 |
| 数量 | 保留可见 `[data-follow-count]`；由 `#app` 外的 `#scheduleDateStatus` 作为唯一数量播报区，使用 `role="status"`、`aria-live="polite"`、`aria-atomic="true"` |

`input` 只写草稿并更新局部提示。提交先从当前输入同步原文，再校验，确保自动填充等场景不漏值；所有提交和清除均先同步更新状态及当前控件的值／错误／提示，再刷新，无效提交仍按上次生效条件呈现结果。焦点恢复本身不修改日期状态。刷新后的 `syncDateControls` 只读最新快照，不再次执行提交、清除或重置；后续草稿原文、派生 `dirty` 及仍有效的错误均保留。离页清空播报文本，数据失败不播报“零场”。

### 日历选择接口（AC-14，赛事边界已实现）

`renderDateControls(snapshot, bounds)` 的第二参数由原最早日字符串改为 `{ min: string, max: string } | null`。`scheduleView` 从数据就绪后的完整 `result.matches` 提取最小／最大 ISO 比赛日，先求边界再组合其他筛选；空数组返回 `null`。这是特性内部接口调整，生产调用和 DOM／浏览器夹具需同步，不修改外部赛事数据结构。正式数据仍经过已有公历合法性校验，不静默忽略非法日期。

非空边界通过表单 `data-first-date`／`data-last-date` 传递；两端均为合法 ISO 日期且 `min <= max`。边界缺失或非法时日历不可操作，不使用默认年份扩展范围。空快照禁用两个 `[data-calendar-open="start|end"]`，并以关联说明提供“暂无赛事日期可选”／“No tournament dates available”；文字通过成对 `schedule.calendar.*` 词条生成。

入口保留 `aria-haspopup="dialog"`、`aria-expanded` 以及稳定焦点键 `schedule-calendar-start`／`schedule-calendar-end`。`createCalendar(root, state, sync)` 保留单一非模态弹层和 `close`／`dispose` 接口；根节点委托与文档外部点击监听均可清理。每次打开读取当前边界；重绘／离页关闭旧弹层。

显示的界外日期按钮使用原生 `disabled`，不能成为活动日或写入草稿。事件处理再次核对所选 ISO 日期是否在闭区间内，防止事件路径绕过禁用状态。年月控件只允许与边界相交的年月，手动年份越界时显示关联的双语错误、不改变当前日历页、不提交外层表单；恢复合法年月后光标取该月一日与赛事首日中的较晚者。方向键及 Home／End 的候选日裁剪到闭区间，越界时保持边界日可聚焦。

初始化候选、空快照和手写兼容按规格 AC-14；光标裁剪不得调用 `setDraft`。选日和单端清空仍仅更新对应草稿，筛选只通过原“应用日期”生效。`isValidISODate`、`validateDateRange`、日期状态及筛选函数均不新增赛事上下界约束。公历计算不使用时区转换。

## 双语词典

新增平铺键使用 `schedule.date.*` 与 `schedule.calendar.*` 命名空间；成对维护 `public/i18n/zh.json`、`en.json`，保留原 `follow.*` 键含义。

| 后缀 | 中文 | 英文 |
| --- | --- | --- |
| `start` / `end` | 开始日期 / 结束日期 | Start date / End date |
| `apply` / `clear` | 应用日期 / 清除日期 | Apply dates / Clear dates |
| `format` | 格式：YYYY-MM-DD | Format: YYYY-MM-DD |
| `basis` | 按赛事数据中的比赛日期筛选 | Filter by the match dates in the tournament data |
| `pending` | 日期尚未应用 | Date changes have not been applied |
| `all` | 不限日期 | All dates |
| `from` / `until` | 从 {date} 起 / 截至 {date} | From {date} / Through {date} |
| `range` | {start} 至 {end} | {start} through {end} |
| `invalid` | 请输入有效日期 | Enter a valid date |
| `reversed` | 结束日期不能早于开始日期 | End date cannot be earlier than start date |

结果数量、关注空态、无匹配和数据错误继续复用现有等义词条。应用内错误和摘要必须在语言切换后重新翻译，不能把翻译结果保存在状态中。

## 数据及外部兼容

`matches[].date` 必须符合数据模型的真实日期约束；运行时与发布校验使用同一纯函数。其他比赛字段、球队引用、关注记录、Hash 路径和聊天 HTTP/SSE 契约不变。日期操作不发起网络请求；数据重试沿用现有缓存清除与加载流程。AI 服务不可用不改变以上接口。

发布校验脚本的默认命令保持 `node scripts/validate-data.mjs`，成功退出码为 0、校验失败为非零。可选 `--data-root <目录>` 用于验证隔离的数据样例；不传时仍用仓库原目录，词典沿用原默认位置。模块导出的 `validateData({ dataDirectory, i18nDirectory })` 返回 `{ ok, failures, counts: { matches, teams, history } }`，其中 `failures` 为失败说明列表；CLI 和单测调用同一校验核心，导入模块不触发进程退出。该扩展用于验证消费契约，不新增网站接口。
