# Bug Verification: 球队页小组筛选与外部点击关闭

- **Slug**: teams-group-filter
- **Tested**: 2026-10-26
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

本轮重新执行了原报告操作的自动化等价复验。下拉提供小组，勾选 A/B 时面板仍展开且页面立即显示完整两组；点击页面标题或 app 外的页脚关闭，重开保留选择。关键检查及全量单测通过，未发现本次变更引入的回归。本轮没有修改源码。

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| 原始复现与浏览器回归 | CI=1 npm run test:e2e -- e2e/teams-dropdown.spec.js | pass | 退出码 0，Chromium 1 项通过（6.7s）；小组选项、即时 A/B 组筛选、完整 8 队、取消/全部、标题/页脚关闭、重开保留、键盘、中英文、375px 面板边界及详情跳转 |
| 新增/更新测试与全量回归 | npm run test:coverage | pass | 退出码 0，21 文件、109 项通过；包含本缺陷 7 项 DOM 单测，覆盖内部点击不关闭、外部停止冒泡、监听释放/去重/重渲染 |
| 当前生产构建 | npm run build | pass | 退出码 0，数据校验通过：104 场、48 队、132 条历史记录及双语词典；Vite 构建成功 |
| 新增代码行覆盖率复核 | 只读 Node 内联脚本：仓库 addedLines + coverage/coverage-final.json | pass | 退出码 0，app.js 1/1、teams.js 6/6、teams-filter.js 23/23，汇总 30/30=1，满足未舍入比例至少 0.8 |
| 差异空白检查 | git diff --check | pass | 退出码 0 |
| 独立 lint/type-check | 项目未提供独立命令 | not-run | 使用当前构建与测试检查，不声称已执行独立静态检查 |

## Output Excerpts

```text
Test Files 21 passed (21)
Tests 109 passed (109)
Validated 104 matches, 48 teams, 132 history records, and bilingual dictionaries.
1 passed (6.7s)
{ C: 30, D: 30, ratio: 1, passed: true }
```

覆盖率比较基线沿用 fix.md 的 fb2471a5e87607fcd1bf61e563b7a13b60cf0d75，包含之前尚未提交的筛选实现以及本轮修复；不是仅对上一轮工作区变更行的单独统计。使用本轮重新收集的覆盖率，本轮不再做需要改写生产源码的变异验证；修复阶段的反向验证记录见 fix.md。

浏览器测试前已构建当前源码，CI=1 禁止复用已有 preview 服务，4173 由本轮 Playwright 启动的 preview 提供该构建。模式为本地生产构建浏览器验证，未使用 AI mock 或 Netlify Function 调试。HEAD 未变且源码仍有未提交修改，提交号不能单独代表当前工作区。

## Residual Risks

- 未验证其他浏览器、实体手机、线上环境或远端 CI；375px 为 Chromium 视口模拟。
- 既有英文导航 1px 页面溢出未在本轮重新诊断或修复；面板边界测试通过。
- 本报告验证实际应用文档内的外部点击，不涵盖浏览器工具栏或其他应用。
- 历史 TDD 顺序及变异结果引用修复报告，本轮不重新宣称执行历史 Red 或变异步骤。
- 前后核对 .specify/extensions.yml，hooks 为空，无 before_bug_test/after_bug_test 可执行项。

## Recommendation

可以关闭 teams-group-filter：原始需求场景已实际执行自动化复验，关键检查通过。verified 指上述本地验证结果，不代表远端 CI、实体设备或独立质量审计已完成。
