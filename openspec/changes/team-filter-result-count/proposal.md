# Proposal

## Why

球队页已有分组筛选，但提示仅说明“全部/所选小组”，用户不能直接知道筛选结果数量。增加结果计数，让用户一眼确认列表范围，同时作为范围小、验收直观的 OpenSpec 完整流程演示。

## What Changes

- 在现有筛选摘要位置显示“当前显示 X / Y 支球队”；X 为可见球队数，Y 为当前加载总数。
- 选择、取消、恢复全部、返回页面和切换语言时，计数与实际列表一致；提供英文提示。
- 数量来自实际数据，未知分组遵循现有可见规则；无可用数据时保留现有提示，不显示计数。
- 不新增筛选条件、页面、接口、持久化或数据更新；不调整现有筛选与路由状态规则。

## Capabilities

### New Capabilities

- `team-filter-result-count`：球队页可见结果与加载总量的动态计数。

### Modified Capabilities

无。OpenSpec 主规格清单当前为空；既有筛选作为实现依赖，不将整项旧功能重新立为本轮新增需求。

## Impact

- 预计涉及 src/views/teams.js、src/features/team-group-filter/controller.js、独立计数辅助模块及 public/i18n/zh.json、en.json；沿用原生 ES Modules、现有组件和测试工具，无新依赖或后端变更。
- 真实 TDD、单元/浏览器回归与可恢复反向验证；新增自有生产代码单测行覆盖率未舍入汇总值不低于 80%。默认统计 src/**/*.js、netlify/functions/**/*.mjs，详细排除与基线见设计。
- 交付新增行覆盖率 HTML 和需求/TDD HTML。当前 OpenSpec reporting/config.json 的生产范围、测试范围和 suites 均为空，尚不具备完整采集能力，需在实现任务中补齐配置及结果适配；不复用旧功能报告冒充本轮证据。
- 任务硬上限 20；本轮仅规划，不执行产品测试或实现。
- 来源：2026-10-22 用户确认范围；当前磁盘球队视图和控制器已核实。探索阶段使用独立 Wiki（easeus/WorldCup2026，main，版本 unknown）和 CodeGraph，后者对未索引控制器返回错配路径，已直接读文件核实。配置指定的 openspec_wizard 本会话未提供，未调用另一框架作兜底。
