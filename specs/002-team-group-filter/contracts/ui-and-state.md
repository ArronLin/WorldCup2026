# UI 与状态契约：球队分组筛选

## 入口与界面

入口保持 `#/teams`；不新增请求接口或筛选 URL 参数。卡片继续使用 `/team/{code}` 导航。控件放在页面标题/副标题之后、小组列表之前。

- fieldset 和 legend 标识“小组筛选 / Filter by group”。每个已知组一项原生 checkbox，按字母排序，label 为“小组 A / Group A”。
- “显示全部 / Show all”为原生 button；始终允许重复操作。所有 checkbox 未选中时，单独显示“显示全部球队 / Showing all teams”的模式提示，避免把未选中误解为无结果。
- 有选择时显示“显示所选小组 / Showing selected groups”，由 checkbox 明确哪些小组已选中。
- 小组分区始终有稳定的分组标识；未匹配的分区设 hidden，内部球队链接也应退出可见布局和键盘 Tab 顺序。显示全部恢复既有信息、排序和所有队伍。
- 分组未知显示“分组未知 / Unknown group”；无可用数据显示“暂无可显示的球队，可刷新重试 / No teams available. Refresh to try again.”，不显示虚构小组选项。
- 采用可换行的紧凑控件布局，使用既有颜色与间距；为 checkbox、按钮保留可见 focus-visible。小屏不引入页面水平溢出。

拟新增词条使用 `teams.filter.*` 前缀，包括 legend、all、showingAll、showingSelected、unknownGroup、unavailable；已有 common.group 和球队名称翻译继续复用。

## 内部接口（拟定）

| 边界 | 约定 |
| --- | --- |
| state.js | `buildTeamGroups(teams)` 形成分组；`isGroupVisible(group, selected)` 定义唯一筛选谓词；`createGroupFilterState()` 提供 syncGroups、setSelected、clear、getSnapshot |
| teams.js | await getTeams 后构建完整分组并同步可用组，再读取最新选择，生成控件、模式提示、全部分区及初始 hidden 状态 |
| controller.js | `initTeamGroupFilter({root, state})` 使用默认 app 根节点及共享状态，返回 dispose；同一根节点重复初始化不重复注册 |
| app.js | 在 initRouter 前初始化控制器；沿用现有 langchange 处理，路由与 i18n 引擎无需修改 |

DOM 使用独立的 `data-team-group-action`、`data-team-group` 命名空间，不能匹配关注功能的事件标记。控制器只响应 `.teams-page` 内的自身控件，不拦截卡片详情链接。

## 交互时序与资源

1. checkbox change 同步写入目标组 checked 值；显示全部 click 同步 clear。
2. 从最新状态更新当前页所有 checkbox、模式文本及分区 hidden；不替换控件节点、不发起数据请求、不调用 handleRoute。
3. 筛选操作保留当前焦点，Tab/Space 可连续操作；没有延迟回调覆盖后续选择。
4. 页面导航由现有路由处理，已有 navigationId 拒绝过期页面提交；控制器不保存旧页面节点。返回球队页重新读共享状态。
5. 语言切换按既有路由重绘，视图在取数后读最新状态；新文案和相同选择同时呈现。语言按钮原有焦点行为不扩为新的共享路由改造。
6. 初始化只注册一组根节点事件；dispose 移除注册并允许再次初始化。无计时器、网络订阅或 storage 监听。

## 需求到验证

| 规格 | 验证契约 |
| --- | --- |
| FR-001–003、SC-001、EC-01–02 | 初始全部；A；A+C；取消 A；取消最后一组；全选；重复恢复；快速变化后最终一致 |
| FR-004/006、US1-AS5 | 组序及组内顺序保持；点击正确详情；返回保留；reload/新页面全部 |
| FR-005、US2-AS1–2 | 明确 locale 和初始偏好，断言中→英→中实际文案，再断言选择和球队 code 集合不变 |
| FR-007、US1-AS6 | Tab 聚焦、Space 选择、按钮键盘激活；更新后焦点仍在原控件，隐藏卡片不可聚焦 |
| FR-008–009、EC-03–04 | 空字典与读取失败的受控响应给出中性提示；未知组仅全部可见，不加入选项 |
| SC-002 | 数据已加载、无人工节流的 Chromium 中，以输入事件至 DOM 达到预期的浏览器时间测量，逐次更新 ≤1000ms；一次恢复全部 |

上述均为待实现和待执行的契约；不将静态文档审查记为运行通过。
