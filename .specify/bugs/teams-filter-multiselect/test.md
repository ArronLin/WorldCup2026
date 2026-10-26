# Bug Verification: 球队筛选多选

- **Slug**: teams-filter-multiselect
- **Tested**: 2026-10-26
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

本轮已实际复验评估中的原始操作：先选择阿根廷，再选择巴西，两支球队保持选中并同时展示；取消一项、取消最后一项以及选择全部均得到预期结果。

## Checks Performed

| Check             | Command / Action                                    | Result  | Notes                                                       |
| ----------------- | --------------------------------------------------- | ------- | ----------------------------------------------------------- |
| 原始复现与交互回归         | CI=1 npm run test:e2e -- e2e/teams-dropdown.spec.js | pass    | 最新生产构建，Chromium，1 项通过；键盘展开/空格勾选、多选、取消、全选、英文、375px 面板边界与详情跳转 |
| 恢复后定向测试           | npm test -- tests/teams-dropdown.test.js            | pass    | 5 项通过，含重复初始化、释放、重新初始化、页面重渲染及无关事件                            |
| 全量单测与覆盖率          | npm run test:coverage                               | pass    | 21 文件、107 项通过；新增行汇总 26/26                                   |
| 关键条件反向验证          | 忽略目录 .tmp/check-multiselect.mjs                     | pass    | 反转集合包含判断导致 3 项断言失败，finally 恢复；恢复后 5 项再次通过                   |
| 构建                | npm run build                                       | pass    | 数据校验与生产构建成功                                                 |
| 差异检查              | git diff --check                                    | pass    | 无空白错误                                                       |
| Lint / type-check | 无独立配置命令                                             | not-run | 使用现有构建及测试检查                                                 |

## Output Excerpts

`Tests 107 passed (107)`；`1 passed (10.8s)`；恢复后 `Tests 5 passed (5)`。  
覆盖率基线和计算口径见 fix.md，26/26=1，满足未舍入比例至少 0.8。

## Residual Risks

未验证其他浏览器、实体移动设备和 CI；本轮非 AI 联调。既有英文导航的 1px 页面溢出未扩展修复；本次面板在 375px 边界内。无数据、接口、路由和存储变化。  
扩展 hooks 已核对，extensions.yml 中 hooks 为空。

## Recommendation

本次缺陷可关闭。此报告反映本轮执行证据；运行组件 finish 仍保留独立质量状态 unverified，不代表 CI 或独立审核已完成。
