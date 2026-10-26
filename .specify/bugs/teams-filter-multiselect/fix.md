# Bug Fix: 球队筛选多选

- **Slug**: teams-filter-multiselect
- **Fixed**: 2026-10-26
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary
将单选下拉框改为原生 details/summary 可展开复选框列表，使用所选球队集合的并集过滤。默认全部，取消最后一项或选择全部恢复完整列表。沿用既有 app 根节点委托监听与释放责任。

## Changes
| File | Change | Notes |
|------|--------|-------|
| src/views/teams.js | modified | 可展开的复选框列表与可见双语标签，默认全部 |
| src/teams-filter.js | modified | Set 集合过滤、全部与具体球队互斥、空选回退 |
| src/styles/pages.css | modified | 下拉面板滚动、44px 标签目标、键盘焦点与窄屏布局 |
| tests/teams-dropdown.test.js | modified | 默认、跨组多选、逐项取消、全选、空选、生命周期和双语 |
| e2e/teams-dropdown.spec.js | modified | 真实键盘、跨组多选、取消、全选、英文窄屏与详情导航 |

## Tests Added or Updated
5 项 DOM 单测调用真实视图和控制器，使用真实球队 JSON。1 项 Chromium 测试在最新构建上操作复选框。

## Local Verification
- TDD Red：`npm test -- tests/teams-dropdown.test.js`，5 项因缺少多选控件失败；未修改生产代码前实际执行。
- Green：相同命令，5 项通过。
- `npm run test:coverage`：21 文件、107 项单测通过。
- 新增生产代码行覆盖率：相对 fb2471a5e87607fcd1bf61e563b7a13b60cf0d75，用仓库 addedLines 和 Istanbul 可执行语句起始行汇总，app.js 1/1、teams.js 6/6、teams-filter.js 19/19，合计 26/26=100%。该基线包含上一轮尚未提交的筛选实现及本次修复，严格覆盖整段新增代码；不把全项目覆盖率当作门槛。
- 可恢复反向验证：将 !codes.has 临时改为 codes.has，3 项真实测试失败；finally 恢复原源码。
- `npm run build`：数据校验及生产构建通过。
- `CI=1 npm run test:e2e -- e2e/teams-dropdown.spec.js`：1 项通过；4173 由本轮 preview 提供构建产物，无 AI mock/Function 调试。
- `git diff --check`：通过。

## Deviations from Assessment
无需新增或修改双语词典，复用 teams.filter、teams.all 和现有球队名称。无其他偏离。

## Follow-ups
无本次范围内待完成项；未覆盖实体手机及其他浏览器，既有导航 1px 溢出不在本次范围。未修改路由、数据和存储。extensions.yml 无 before/after_bug_fix hooks。
