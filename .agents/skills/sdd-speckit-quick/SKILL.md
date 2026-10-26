---
name: sdd-speckit-quick
description: Execute an explicitly requested low-risk change with clear acceptance criteria.
---

本次明确选择 speckit；先说明目标仓库、当前任务和本入口职责，不得加载另一框架的规则。
读取 `.specify/easeus/requirements.json`、本框架项目规范及知识库绑定；工程政策只来自启用规则，不恢复停用政策。
仓库运行入口：`powershell -NoProfile -ExecutionPolicy Bypass -File .specify/easeus/workflow/run.ps1`，后接动作和参数；每次传 --project 当前仓库，已有任务传 --work-item 明确清单路径。需要 Python 3.10+，不依赖 Studio 或用户目录绑定。
只请求查询、诊断或分析时只读，不创建文档、不登记或推进任务、不运行测试或安装依赖。只读调用附加 `--intent analyze`，该模式只允许 doctor/status；不得去掉参数、换用直接 Python API 或报告命令绕过只读边界。缺少环境时报告缺口，不自行修复。
任务归属或授权不明确时才询问；明确授权只适用于相应任务和范围，不自动扩展。

## 职责：明确的低风险小改动
仅在边界清楚、验收明确且没有未处理的接口、权限、迁移、兼容等风险时推进。风险不清楚或范围扩大时，先提出升级流程建议并等待范围授权，不得自行扩成完整新功能，也不能用“改动少”绕过正式流程。获准后保存简短目标、边界、验收、实际修改和验证的 task.md；不使用空文件充当产物。

## 已授权后的任务登记
先在获准范围形成可定位验收项，再用 create --input <JSON> 登记；输入包含 framework、ident、kind、title、acceptance、risks、rules、native_path。验收项包含稳定 id、description、仓库相对 source 和含该 ID 的真实 line。登记任务不代表实施或验证已完成。
标准新功能仍走本框架已安装的原生需求、计划、任务和实施技能；它们不是 Specify CLI 子命令。本入口不得跳过原生前置产物。

## 授权范围内的验证与完成
推进已有任务使用 transition；不得伪报尚未执行的阶段。工程政策以当前启用规则为准。
只有当前启用 TDD 时，先编写测试并实际运行，确认预期行为尚未实现导致断言失败，再编写最小实现使测试通过，按需重构并回归。依赖、环境或语法错误不是有效 Red；不把事后补测宣称为 TDD。停用时不得重新强制。
使用仓库自己的测试命令，按修改影响范围验证。覆盖率要求读取规则快照，沿用仓库已有工具和 CI；无新增可执行生产代码时说明不适用，不记为 100%。
在对话中简述实际命令、结果和未验证事项；不默认另建 evidence、收据、追踪映射、源码副本、截图、验收说明或 HTML。测试工具临时输出沿用项目已有忽略目录。
获准实施且真实运行测试后，核对原生产物和任务，再执行 finish --work-item <明确任务清单>。成功只表示实施流程已完成，质量状态仍为未核验，不代表测试、覆盖率或 CI 已通过。实际测试失败或未执行时如实披露，不能宣称通过或勾选未完成任务。Skill 约束不是权限沙箱，也不声称程序已审计 TDD 顺序。
