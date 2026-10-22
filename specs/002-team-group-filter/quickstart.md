# 快速验证：球队分组筛选

本指南供实现阶段执行；当前只完成设计，以下新增测试、manifest 与证据文件尚待创建。

## 前提

- 在仓库根目录，使用 Node.js 24 和现有 lockfile；首次准备执行 npm ci。
- 完成 tasks 中的实现和测试文件；覆盖率命令要求先生成本功能 coverage-baseline.json，固定基线见 plan.md。现有 coverage:baseline 只重建 manifest，不负责创建它。
- 端到端前执行构建；4173 已有服务时须确认来自当前仓库当前 dist，否则停止自己启动的旧服务再运行。不得把其他项目进程当本项目终止。
- 测试用 Chromium，依赖初始语言的用例显式 locale: zh-CN，并控制已有 wc2026-lang 偏好。

## 单元测试与 TDD

从首次尚无目标行为时开始逐包记录 Red，再实现 Green、重构后复跑；不要在完成实现后补写历史 Red。使用 npm test -- <测试文件> 执行每包，日志保存到 evidence 对应任务目录并记录源码差异、命令、退出码及具体断言。

```powershell
Set-Location 'D:\GitHub\WorldCup2026'
npm test -- tests/team-group-filter-state.test.js tests/team-group-filter-view.test.js tests/team-group-filter-controller.test.js
npm test
```

测试必须调用真实 state、view、controller；可以控制 getTeams 的数据或 fetch，不可替换核心筛选。jsdom 环境只在 DOM 测试文件启用。

## 构建与浏览器

```powershell
npm run build
npm run test:e2e -- e2e/team-group-filter.spec.js
npm run test:e2e
```

如 Chromium 尚未安装，先使用 npx playwright install chromium（CI 沿用 --with-deps）。记录浏览器实际版本及结果。

在预览页面 `http://127.0.0.1:4173/#/teams` 验收：

1. 默认全部；选择 A，再追加 C，取消 A，取消 C：可见集合依次为全部、A、A+C、C、全部；核对组序与球队信息。
2. 选择若干组后，“显示全部”一次恢复；逐一全选、快速切换不产生残留或重复。
3. 进入正确球队详情并返回，选择保留；刷新或新页面恢复全部。
4. 中文→英文→中文：先确认实际文案切换，再检查所选组和球队 code 集合保持。
5. Tab/Space/按钮激活可完成筛选；焦点留在原控件，隐藏卡片不进入 Tab；窄屏控件可换行。
6. 在受控数据场景检查空数据/失败提示和未知分组，勿改真实赛事 JSON。
7. 数据加载完成后，用浏览器内时间记录输入至结果满足预期的耗时，每次≤1000ms；不能以截图存在或测试退出码替代集合/时间断言。

详细场景见 contracts/ui-and-state.md，不新增赛事、AI 或后端验收。

## 覆盖率

先创建 manifest：固定 Git 树完整生产文件清单、LF 规范化 SHA256、schemaVersion=1、mode=git-tree、baseCommit 与 productionPatterns，按现有脚本契约验证。该准备工作发生在生产代码修改前。

```powershell
npm run coverage:baseline -- --manifest specs/002-team-group-filter/coverage-baseline.json --output .tmp/002-coverage-baseline
npm run test:coverage
npm run coverage:added -- --baseline .tmp/002-coverage-baseline/baseline.json --report coverage/coverage-final.json --output specs/002-team-group-filter/evidence/coverage-added.json
npm run coverage:html -- --input specs/002-team-group-filter/evidence/coverage-added.json --output specs/002-team-group-filter/evidence/coverage-added.html --title '球队分组筛选：新增行覆盖率'
```

保留 coverage 默认目录；test:coverage 的源码哈希约定依赖此目录。归档时一起保存 coverage-final.json、lcov.info、source-hashes.json 和该轮日志，确保报告与源码一致。报告失败后仍可生成 HTML 用于定位未覆盖行，但不能标记验收通过。

门槛为本功能新增生产可执行行 C/D 未舍入≥80%；D=0 说明不适用及依据。不使用全项目覆盖率或浏览器覆盖率替代。

## 有效测试与证据

- 对 isGroupVisible 临时引入错误（例如忽略 selectedGroups、始终显示），执行目标测试，必须因错误集合断言失败；恢复原文件后重跑通过。执行前备份该文件并用 finally/等效流程确保恢复，不提交变异代码。
- evidence/requirements-test-map.md 记录 FR/US/EC/SC → 实际测试文件及名称 → Red/Green/Refactor 日志 → 最终结果。每项结果标记通过、失败、未执行或不适用。
- evidence/acceptance.md 汇总环境、基线、测试发现/执行/通过/失败/跳过数、通过率分母、C/D、浏览器验收、手工检查和剩余问题。缺少证据不得勾选完成。
- 现有 requirements-TDD HTML 生成器绑定 001，本轮不直接调用它生成 002 报告。新增行 HTML 使用上面的显式路径；日志及映射可直接审查真实 TDD。
- CI 保留原检查并增加 002 门禁，使用同一次覆盖率采集结果；001 与 002 输出路径分开。
