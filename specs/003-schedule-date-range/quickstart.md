# 快速验证：赛程日期区间筛选

本指南用于复现当前实现的本地验证。测试、构建、覆盖率采集及浏览器检查已执行，实际范围与结果见 [任务清单](tasks.md)；重新执行时仍须核对源码、预览产物和工具环境。

## 前提

在仓库根目录使用 Node.js 24+；依赖以锁文件为准，缺少依赖时运行 `npm ci`。浏览器缺失时使用 `npx playwright install chromium`。需求入口为 [spec.md](spec.md)，状态及接口细节见 [数据模型](data-model.md) 和 [契约](contracts/schedule-date-range.md)。

```powershell
Set-Location 'D:/GitHub/WorldCup2026'
node --version
npm --version
```

## 1. 单元与契约验证

实施时对每项可单测行为先运行对应测试，确认是业务断言不符，再实现；以下测试文件均已创建。集成验证入口：

```powershell
npm test -- tests/schedule-date-range.test.js tests/schedule-date-state.test.js tests/schedule-date-controller.test.js tests/schedule-date-view.test.js tests/schedule-date-data-validation.test.js
npm test -- tests/store-results.test.js tests/data-contract.test.js tests/follow-schedule.test.js tests/router-follow.test.js tests/follow-language.test.js tests/added-coverage.test.js tests/run-unit-coverage.test.js
npm run validate:data
npm test
```

预期：实际生产入口被执行，日期、状态、DOM、路由及工具错误路径有断言；数据发布校验对正式快照通过、对隔离的非法日期样例失败。本轮澄清的重点为可控异步完成顺序下，最新草稿／提示与已生效结果分别保留，焦点覆盖最新可用目标、失效回退及无后续操作的默认目标，旧请求没有恢复副作用。完整单测仅在集成后完成一次，后续只因改动或失败重跑必要范围。用例和需求映射见计划，不复制测试正文。

## 2. 变更行覆盖率

当前工具已支持 Git 内存基线与显式工程脚本范围，使用以下入口：

```powershell
npm run test:coverage -- --config vitest.schedule-date-coverage.config.js --audit-sources scripts/check-added-coverage.mjs,scripts/run-unit-coverage.mjs,scripts/validate-data.mjs
npm run coverage:added -- --base-commit 5b16a460547e764caabf059b7e2dadaf29c59105 --audit-sources scripts/check-added-coverage.mjs,scripts/run-unit-coverage.mjs,scripts/validate-data.mjs --output coverage/schedule-date-range-added.json
```

预期：报告基线及采集范围正确，业务变更和工程脚本变更两组均达到计划定义的 80% 行口径；未跟踪的新生产文件不会漏出分母。未导入代码、哈希不符、缺覆盖或 JSON／LCOV 不一致必须被识别；不采信旧功能报告或全仓覆盖比例。报告沿用忽略目录 `coverage/`，结果在原任务记录引用。

## 3. 构建并验证浏览器

先运行构建并检查成功：

```powershell
npm run build
if ($LASTEXITCODE -ne 0) { throw '构建失败，不能继续浏览器验收' }
$previewListeners = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if ($previewListeners) { throw '4173 已被占用：先核对服务来源及 dist 对应关系，不能直接复用或终止未知进程' }
```

端口空闲后由 Playwright 从本仓库启动预览；`CI=1` 防止默默复用旧服务：

```powershell
$previousCI = $env:CI
try {
    $env:CI = '1'
    npm run test:e2e -- e2e/schedule-date-range.spec.js e2e/follow-teams.keyboard-race.spec.js e2e/follow-teams.empty-retry.spec.js e2e/follow-teams.language.spec.js
    if ($LASTEXITCODE -ne 0) { throw '浏览器验证失败，保留输出并处理失败场景' }
} finally {
    $env:CI = $previousCI
}
```

日期测试及原语言测试的截图路径适配均已实现，截图统一进入 test-results/，不覆盖旧功能截图。若确需复用 4173 服务，核对进程命令指向本仓库，并比较首页及其内容哈希资源与本次 `dist/`；仅能连通端口不算来源核实。

预期：AC-01—AC-13 覆盖的交互与兼容回归通过，按更新后的 AC-10 核对继续编辑、移到仍存在的比赛卡片／语言按钮、目标消失／不可操作和无后续操作四类焦点结果；语言测试还须延迟既有词典响应，核对等待期间的新编辑不会被抢焦或覆盖。断言实际活动元素及输入原文，不能以截图代替交互结果。改变浏览器时区不改变比赛 ID 集合；从页面网络记录确认日期操作不新增请求。

## 4. 界面结果与交接

按 AC-11 检查八种环境组合中的五种日期状态，共 40 个布局状态；检查文字、横向溢出、重叠、焦点及错误关联。保存必要的当前运行截图到 Playwright `testInfo.outputPath(...)` 对应的 `test-results/`，结合实际操作判断，不能只凭截图判断交互通过。

在既有任务／验收位置记录执行日期、候选提交与未提交范围、系统、实际 Chromium 版本、视口、缩放、字体、语言／主题和结果；只在确实完成核对后填写对应结果。界面方案确认沿用项目约定，不因此新增最终人工签收或独立证据包。

本次验证为静态前端及 AI 故障隔离：使用无密钥或受控故障，证明核心浏览可用。`?mock` 只能用于界面演示；不以它宣称 Netlify Function 或真实模型联调通过。本功能不需要发起真实 AI 对话。

## 排障

- **非法输入切换语言后消失**：检查是否仍用原生日期控件、是否每次 input 保存草稿，以及提交渲染后是否回填最新状态。
- **最后错误被旧成功刷新抢焦点**：检查无效应用是否也进入路由请求序列，目标是否在旧 DOM 替换前捕获、在最新状态回填后校验，以及调用方是否在刷新返回后再次聚焦。
- **移到卡片／外壳后又回到应用按钮**：核对稳定身份、真实可用性和统一刷新包装器；不能把未登记的可用目标当作已失效。语言场景检查是否在按钮激活时捕获意图，而非词典加载结束后。
- **新草稿保留但未应用提示消失**：检查提示是否只由当前草稿与生效值派生，旧刷新完成时不能再次清状态。
- **日期范围外全部显示为错误**：不要把用户合法区间外日期和快照非法日期混为一类。
- **覆盖率结果来自旧功能**：检查显式基线、输出路径及两次相同的脚本集合；能力未就绪时保持未核验，不调低门槛。
- **浏览器或服务不可用**：记录具体环境缺口，保持自动化测试待执行；不改标人工通过。
