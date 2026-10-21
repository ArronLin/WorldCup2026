# 执行证据

每个 Txxx 目录的 JSON 记录实际阶段、时间、命令、退出码及执行前生产源码哈希；同名 txt 是原始输出。业务 Red 仅接受目标断言失败，不能用收集或依赖错误替代。Green 后 Refactor 无需改代码时记录审视和回归，不虚构改动。

T001/baseline.json 为基线采集过程；权威可复现输入是功能目录 coverage-baseline.json。文件摘要以 LF 规范化支持 Windows/CI，执行状态另记录原文件哈希。任务完成标记仅在对应结果符合预期后写入，不修改规格质量检查清单。

2026-10-21新增HTML报告的Red/Green/浏览器/覆盖链证据单独放在 `html-report/`，不复用T054/T055目录覆盖历史日志。HTML入口为本目录 `coverage-added.html`。

2026-10-21补充 [需求覆盖与 TDD HTML](requirements-tdd.html)，展示规格条目、真实测试、历史任务级三阶段证据与缺口；结构化快照为 `requirements-tdd.json`。本次重跑结果和报告验证放在 [requirements-report/](requirements-report/README.md)，不覆盖 Txxx 原始记录。
