# 需求覆盖与 TDD 报告生成验证

报告入口：[需求覆盖与 TDD HTML](../requirements-tdd.html)。结构化快照：[requirements-tdd.json](../requirements-tdd.json)。映射源：功能目录的 `requirements-test-map.json`。

2026-10-21 根据规格原文与真实断言建立 35 项追踪关系：12 条功能要求、12 个验收场景、6 个边界场景和 5 个成功标准。关联 47 条去重测试，均通过；SC-005 因中文流程没有独立记录零 AI 请求断言，保守标记部分验证，其余条目的映射测试通过。映射覆盖不是对所有输入的形式证明。

本次实际执行：先 `npm run build`，再以 CI 模式启动当前构建的独立预览并执行 Playwright，24/24 通过；最终 Vitest 102/102 通过，其中包括报告生成器的 7 项测试。原始框架 JSON、命令、UTC 时间、退出码、运行前后文件摘要与结果摘要分别见 `unit.json`、`browser.json` 及对应 `*-receipt.json`。

历史 12 组任务级三阶段记录的原始文件保持不变。报告核对有效索引、退出码、实际断言失败和时间顺序；保留未接受的尝试。原记录没有逐用例历史测试源码指纹，因此逐用例 TDD 完整率标记不可判定，不能用任务链 12/12 替代。

报告工具本次开发的取证：`report-red.txt` 是初次模块缺失造成的收集失败，不作为业务 Red；`report-red-assertions.txt` 是接口 stub 下的测试失败；`report-green.txt` 是首轮 5 项通过。实际发现的 Playwright 相对路径及折叠源码跳转问题先补充 2 个失败回归用例，见 `report-regression-red.txt`，修复后的 7 项测试包含在最终 `unit.json` 中。不把这些新执行记录追加为原功能的历史 Red。

离线 Chromium 检查见 `browser-check.json`，验证筛选、需求到用例、用例到源码、内嵌 Red 日志、无网络请求、无 JavaScript 错误、无断裂锚点及 375px 页面不溢出。`desktop.png`、`mobile.png` 为报告截图；`validation.json` 另记录本次开始前已有输入是否变化及本地证据链接检查。

提交前复核发现键盘用例在赛程异步重绘前继续按 Tab 会偶发失败；该用例增加了等待筛选结果更新的断言，重复运行 5 轮共 10 次通过，并重新采集完整的 102/102 单元测试及 24/24 浏览器测试、重建 HTML。`validation.json` 如实记录原始输入中这 1 个测试文件发生变化；报告的两份运行收据均对应修订后的源码，且本地证据链接无断裂。

重新渲染现有证据：在仓库根目录执行 `node scripts/render-requirements-tdd.mjs`。若源文件、规格或对应测试输入已经变化，生成器拒绝用旧运行结果渲染，需重新采集真实结果及收据。HTML 内嵌了测试源码和选中的历史阶段日志，可独立离线查看；原始 JSON 和全部尝试审计需同时保留证据目录。
