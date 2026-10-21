# 数据模型与状态转换

依据：[spec.md](spec.md)、[research.md](research.md)。下列文件、函数和字段为拟实现契约。

## 赛事只读实体

| 实体 | 关键字段 | 约束 |
| --- | --- | --- |
| Team | `code`、`name.zh`、`name.en` | code 使用成功加载的球队字典中的稳定键；不能用译名标识关注。 |
| Match | 数字 `id`、`home.code`、`away.code`、`stage`、可选 `round`／`group`、现有日期比分等 | 不改写比赛事实；ID 为去重键；队码须存在于成功加载的球队字典。 |
| TournamentSnapshot | `status:'ready'`、`teams`、`matches` | 数据成功加载且必要结构可用。合法空 matches 与加载失败不同，不承诺底层快照完整或实时。 |
| TournamentError | `status:'error'`、`dataset:'teams'\|'matches'`、`kind:'network'\|'http'\|'parse'\|'invalid-data'` | 不提供伪装成完整结果的空数组；UI 翻译错误类型，不直接展示原始异常文本。 |

阶段分类：`group`；淘汰赛取 `round`，范围为 `round_of_32`、`round_of_16`、`quarterfinal`、`semifinal`、`third_place`、`final`。非受支持类别或必要引用损坏属于 invalid-data，不静默隐藏比赛。显示顺序沿用当前分类顺序，小组按字母，组内保留快照相对顺序。数值仅为当前契约，不新增未来赛事赛制推断。

## 关注持久化

key：`wc2026-followed-teams`。唯一写入格式：

```json
{"version":1,"teamCodes":["ARG","BRA"]}
```

只保存 code；不保存名称、语言、筛选、密钥或比赛副本。序列化前去重并按字母排序，使保存格式稳定；展示比赛顺序不受关注列表顺序影响。

恢复校验顺序：

1. 数据尚未 ready：不读／不规范化关注，等待球队字典成功；失败不清空原记录。
2. 取得 storage 或 getItem 抛异常：空临时集合，标记 `restoreIssue:'unavailable'`。
3. key 不存在：正常空集合，无错误。
4. JSON 解析失败、非对象、version 不为 1、teamCodes 非数组：空临时集合，标记 `restoreIssue:'corrupt'`，原记录不自动覆写。
5. 正确数组：仅保留字符串且精确存在于当前球队字典的代码，去重；大小写不符视无效，不猜测别名。整体合法但全无效时表现为无关注。
6. 恢复只执行一次；没有用户关注变更就不自动保存清洗结果。损坏后用户明确关注时才用完整新集合覆盖该 key。

## 内存状态

state factory 用依赖注入接受 storage adapter，浏览器模块导出一个实例；单测每例创建独立实例。

| 字段 | 初值 | 生命周期 |
| --- | --- | --- |
| `initialized` | false | 首次 ready 后恢复一次；切换路由或语言不重置。 |
| `teamCodes` | 空 Set | 有效关注集合；更改先写内存，保存失败不回滚。 |
| `followOnly` | false | 标签页未刷新期间保留；刷新重新初始化为 false。 |
| `stage` | `all` | 标签页未刷新期间保留；刷新重新初始化为 all。 |
| `restoreIssue` | null | unavailable／corrupt；成功保存新完整集合后清除。 |
| `saveIssue` | null | failed；任何一次后续保存成功才清除。 |

公开状态统一命名为 `FollowSnapshot`，使用下列平铺结构，不导出 `codes`、`filters` 或 `issue` 别名／嵌套包装：

```json
{
  "initialized": false,
  "teamCodes": [],
  "followOnly": false,
  "stage": "all",
  "restoreIssue": null,
  "saveIssue": null
}
```

`teamCodes` 对外为按代码字母排序的唯一字符串数组，对内仍可用 Set；`restoreIssue` 只能为 null／unavailable／corrupt，`saveIssue` 只能为 null／failed。`getSnapshot()` 每次返回新对象和新数组，调用方修改任何返回字段或数组均不影响内部状态。`initialize`、`setFollowed`、`setScheduleFilters` 均返回操作后的同形 `FollowSnapshot` 副本；无效操作也返回内容未改变的副本，不另设返回包装。

`setFollowed(code, desired)` 使用布尔 desired，校验已初始化及有效 code；不合法请求不抛错、不持久化。`setScheduleFilters(patch)` 只接受平铺的 `followOnly`／`stage` 字段，只更新提供且合法的字段，不能改变另一字段；stage 为白名单或 all，非法值不改原值。controller／视图统一读取上述六个字段；selector 使用其中 `teamCodes`、`followOnly`、`stage`，不读取或改变 issue 字段。

## 转换规则

| 事件 | 内存结果 | 保存结果／UI |
| --- | --- | --- |
| 首次 ready | 根据合法记录恢复 codes，筛选保持默认 | 不写回；读取异常可见且可继续关注。 |
| 关注／取消 | 同步生成新的有效集合 | 尝试保存完整集合；失败保留新集合、saveIssue=failed。 |
| 保存失败后离开／返回／切换语言 | codes、筛选、issue 全保留 | 不重新读旧持久记录覆盖临时值。 |
| 后续关注变更且保存成功 | 保留最新集合 | 写入最新完整集合，清除 restoreIssue 和 saveIssue。 |
| 关注开关／阶段更改 | 同步仅改对应字段 | 不写浏览器存储，不发额外赛事网络请求。 |
| 正常导航返回／语言切换 | 使用现有实例和最新快照 | 保留开关、阶段、codes；翻译文案但不改变结果 ID。 |
| 数据失败／点击重试 | 不初始化失败字典、不改变已初始化状态 | 重试仅失效 teams／matches 缓存，不触碰偏好存储。 |
| 刷新／重新打开 | 生成新实例；可从此前成功写入恢复 codes | 开关 false、阶段 all；未保存的临时更改可能丢失。 |

完全拒绝 localStorage 时，主题使用默认 dark，语言使用有效浏览器语言推断；用户切换语言在当前内存中继续生效，不因偏好写入失败中断 langchange。

## 比赛集合与展示状态

`selectMatches(matches,{teamCodes,followOnly,stage})` 不 mutate 输入：先检查阶段，再判断关闭关注或任一主客队命中，按 id 保留首次匹配项。原始顺序稳定；两个关注球队交手只产生一个 ID。合法输入复杂度 O(M+F)，M 为比赛数，F 为关注数。

渲染优先级：数据 error → 加载失败；ready 且 followOnly 且有效 codes 为空 → 未关注；ready 且其余条件产生空结果 → 无匹配；其余 → 比赛列表。restore／save 警告独立显示，不覆盖已有比赛或空状态。followOnly=false 时无关注不妨碍浏览。

状态不依赖 AI，不为用户偏好建立服务器实体，不跨标签页实时同步。
