---
name: sdd-speckit-bug
description: Diagnose and fix an explicitly requested bug within the authorized scope.
---

本次明确选择 speckit；先说明目标仓库、当前任务和本入口职责，不得加载另一框架的规则。
读取 `.specify/easeus/requirements.json`、本框架项目规范及知识库绑定；工程政策只来自启用规则，不恢复停用政策。
仓库运行入口：`powershell -NoProfile -ExecutionPolicy Bypass -File .specify/easeus/workflow/run.ps1`，后接动作和参数；每次传 --project 当前仓库，已有任务传 --work-item 明确清单路径。需要 Python 3.10+，不依赖 Studio 或用户目录绑定。
只请求查询、诊断或分析时只读，不创建文档、不登记或推进任务、不运行测试或安装依赖。只读调用附加 `--intent analyze`，该模式只允许 doctor/status；不得去掉参数、换用直接 Python API 或报告命令绕过只读边界。缺少环境时报告缺口，不自行修复。
任务归属或授权不明确时才询问；明确授权只适用于相应任务和范围，不自动扩展。

## 职责：指定缺陷的诊断与修复
明确预期行为、实际行为、复现步骤、影响和修复验收条件。仅诊断或分析的请求在给出结论后停止；明确要求修复时才登记任务并推进。不能把缺失依赖、环境错误或已有文档中的“通过”充当真实复现或测试证据。

## 已授权后的任务登记
先在获准范围形成可定位验收项，再用 create --input <JSON> 登记；输入包含 framework、ident、kind、title、acceptance、risks、rules、native_path。验收项包含稳定 id、description、仓库相对 source 和含该 ID 的真实 line。登记任务不代表实施或验证已完成。
使用已安装的官方 speckit-bug-assess、speckit-bug-fix、speckit-bug-test，依次诊断、修复与测试，保留原生产物和 Status/Result 字段。Bug 默认目录为 .specify/bugs/<任务ID>；实际 slug 不同时显式指定 native_path。官方扩展缺失则报告缺口，不伪造命令或自行改走新功能流程。

## 授权范围内的验证与完成
推进已有任务使用 transition；不得伪报尚未执行的阶段。工程政策以当前启用规则为准。
只有当前启用 TDD 时，先编写测试并实际运行，确认预期行为尚未实现导致断言失败，再编写最小实现使测试通过，按需重构并回归。依赖、环境或语法错误不是有效 Red；不把事后补测宣称为 TDD。停用时不得重新强制。
使用仓库自己的测试命令，按修改影响范围验证。覆盖率要求读取规则快照，沿用仓库已有工具和 CI；无新增可执行生产代码时说明不适用，不记为 100%。
在对话中简述实际命令、结果和未验证事项；不默认另建 evidence、收据、追踪映射、源码副本、截图、验收说明或 HTML。测试工具临时输出沿用项目已有忽略目录。
获准实施且真实运行测试后，核对原生产物和任务，再执行 finish --work-item <明确任务清单>。成功只表示实施流程已完成，质量状态仍为未核验，不代表测试、覆盖率或 CI 已通过。实际测试失败或未执行时如实披露，不能宣称通过或勾选未完成任务。Skill 约束不是权限沙箱，也不声称程序已审计 TDD 顺序。
