# 本功能报告使用

在仓库根目录使用 PowerShell 7：

```powershell
& ./openspec/easeus/reporting/run.ps1 doctor --feature openspec/changes/team-filter-result-count
& ./openspec/easeus/reporting/run.ps1 check --feature openspec/changes/team-filter-result-count
& ./openspec/easeus/reporting/run.ps1 run --feature openspec/changes/team-filter-result-count --phase final --suite unit --no-refactor '计数与控制器审视后没有必要重构，执行最终回归'
& ./openspec/easeus/reporting/run.ps1 run --feature openspec/changes/team-filter-result-count --phase final --suite integration --no-refactor '界面组合保留现有架构，执行最终回归'
npm run build
& ./openspec/easeus/reporting/run.ps1 run --feature openspec/changes/team-filter-result-count --phase final --suite browser
& ./openspec/easeus/reporting/run.ps1 finalize --feature openspec/changes/team-filter-result-count
```

Windows PowerShell 5 的 powershell.exe 对当前无BOM脚本出现编码解析错误，本轮采用已验证 PowerShell 7，不修改供应报告核心。也可用 Python 3.10+ 调用 openspec/easeus/reporting/runtime/v1/cli.py 并显式 --config openspec/easeus/reporting/config.json。

实际基线、规格索引、映射、运行收据位于 **evidence/reporting/**，这是部署工具的实际位置（设计中的 reporting/ 仅用于本文档）。基线ID 066bebf607f043e2b95ce484c6fcec6a，在count.js创建前保存34个生产文件。

unit只运行count纯逻辑、最小DOM控制器与隔离view测试；integration运行其余混合回归及新view组合；browser运行Playwright全量。各套件串行，真实JUnit与LCOV暂存 .tmp/reporting/，运行器将每次原始结果复制到独立run ID目录并哈希，不把暂存路径当归档证据。所有报告run的stdout/stderr见对应output.log。

优先使用已部署标准导入，无自定义生产适配器。Vitest参数化用例必须具有可区分的名称（旧无数据两种参数已加入索引），禁止在收集后按位置拼造测试身份。格式夹具验证保存在 evidence/reporting/format-validation.json，覆盖失败、基础设施错误、跳过、重试、参数身份、未导入零命中与源码错配拒绝。

真实TDD命令使用 --phase red/green、--cycle、--target（精确test_id）与 --requirements（实际OSR/OSS）。目标ID为 provider/container/locator/parameters 的契约SHA256；各run归档原始用例和定位。Red必须为 assertion_red，collection_error不能充当有效Red；未满足要求保持未完成。

计数接口：countTeamGroups不修改输入，setGroups在view每次取数后替换当前数据，getCounts读取同一可见谓词。core链已取得真实Red与Green；审视后单一循环足够清晰，无需人为重写，最终final补充具体无需重构理由。

全量浏览器测试会写既有功能截图；运行前备份其当前内容，运行后恢复。不得将它们重写为本功能证据。最终HTML分别为 evidence/coverage-added.html 与 evidence/requirements-tdd.html；以report-status.json.passed及退出码判定，文件存在不代表成功。
