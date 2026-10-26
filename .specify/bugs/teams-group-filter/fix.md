# Bug Fix: 球队页小组筛选与外部点击关闭

- **Slug**: teams-group-filter
- **Fixed**: 2026-10-26
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

将球队多选改为小组多选，选项来自现有分组数据。勾选后同步显示所选组的完整球队，无需确认或关闭；取消最后一个组或选择全部小组恢复完整列表。文档级捕获 click 关闭控件外点击时的面板，保留选择，不阻止原操作。

## Changes

| File | Change | Notes |
|------|--------|-------|
| src/views/teams.js | modified | groupKeys 生成小组选项，组卡片记录小组值 |
| src/teams-filter.js | modified | 按组集合同步过滤；document click 捕获判断外部点击；dispose 同时移除 change 和 click |
| public/i18n/zh.json | modified | 筛选小组、全部小组 |
| public/i18n/en.json | modified | Filter groups、All groups |
| tests/teams-dropdown.test.js | updated | 7 项小组过滤、完整球队、全选、外部点击、生命周期、双语测试 |
| e2e/teams-dropdown.spec.js | updated | 实际键盘、小组多选、即时更新、外部关闭、英文窄屏及详情跳转 |

## Tests Added or Updated

- 默认 12 个小组加全部项；A/B 多选立即展示完整两组共 8 队；取消/全选恢复。
- 面板内点击不关闭，app 内标题及 app 外按钮点击关闭，外部目标停止冒泡仍关闭且目标处理执行。
- 重复初始化复用同一控制器，释放后 change/click 失效，重新初始化及 DOM 替换后正常，无球队页时不干扰其他内容。
- 浏览器在面板保持展开时断言过滤结果，点击标题及页脚关闭、重开保留选择，验证键盘和中英文组名、375px 面板边界及详情导航。

## Local Verification

- TDD Red：先更新测试并运行 `npm test -- tests/teams-dropdown.test.js`，7 项失败，包含外部点击后 open 仍为 true 的真实行为断言，以及缺少小组选项的断言；随后实施。
- `npm run test:coverage`：21 文件、109 项测试通过。
- 覆盖率比较基线：fb2471a5e87607fcd1bf61e563b7a13b60cf0d75。工作区包含前几轮未提交筛选代码，故核对整段新增筛选生产代码（包含本轮新增行），不将 HEAD 当作上一轮工作区状态。沿用仓库 addedLines 与 Istanbul 语句起始行统计：app.js 1/1、teams.js 6/6、teams-filter.js 23/23，总计 30/30=1，满足至少 0.8；没有生成源码副本或 HTML 报告。
- 反向验证一：临时反转小组集合判断，3 项真实测试失败；finally 恢复。
- 反向验证二：临时将外部点击关闭改为保持展开，2 项真实测试失败；finally 恢复。
- 恢复后 `npm test -- tests/teams-dropdown.test.js`：7 项通过。
- `npm run build`：赛事数据/双语校验及生产构建通过。
- `CI=1 npm run test:e2e -- e2e/teams-dropdown.spec.js`：Chromium 1 项通过（9.3s）；4173 preview 提供本轮构建，未使用 AI mock 或 Function 调试。
- `git diff --check`：通过。
- 手工设备检查：未执行；以上为自动化检查。

## Deviations from Assessment

无。复用既有面板样式，未出现需在本范围内调整样式的验证失败。未修改 assessment.md、路由、数据、存储及其他业务功能。

## Follow-ups

- 建议下一步运行 `$speckit-bug-test slug=teams-group-filter`，生成独立的验证报告；本轮仅执行修复入口，未创建 test.md 或宣称独立验证阶段完成。
- 未验证实体手机、其他浏览器或 CI。已知既有英文导航 1px 溢出不在本轮修改范围。
- 知识库、来源及版本限制沿用评估记录；当前代码由 CodeGraph 当前磁盘源码核实，未修复知识库运行参数或生成索引。
- 前后检查 .specify/extensions.yml，hooks 为空，无需执行 before_bug_fix/after_bug_fix hooks。
