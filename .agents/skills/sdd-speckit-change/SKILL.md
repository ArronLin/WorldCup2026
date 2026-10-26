---
name: sdd-speckit-change
description: Analyze a change to an existing task and apply only a specifically approved artifact update.
---

本次明确选择 speckit；先说明目标仓库、当前任务和本入口职责，不得加载另一框架的规则。
读取 `.specify/easeus/requirements.json`、本框架项目规范及知识库绑定；工程政策只来自启用规则，不恢复停用政策。
仓库运行入口：`powershell -NoProfile -ExecutionPolicy Bypass -File .specify/easeus/workflow/run.ps1`，后接动作和参数；每次传 --project 当前仓库，已有任务传 --work-item 明确清单路径。需要 Python 3.10+，不依赖 Studio 或用户目录绑定。
只请求查询、诊断或分析时只读，不创建文档、不登记或推进任务、不运行测试或安装依赖。只读调用附加 `--intent analyze`，该模式只允许 doctor/status；不得去掉参数、换用直接 Python API 或报告命令绕过只读边界。缺少环境时报告缺口，不自行修复。
任务归属或授权不明确时才询问；明确授权只适用于相应任务和范围，不自动扩展。

## 职责：已有任务的影响分析与受控文档更新
必须先定位明确的已有任务，使用 status --intent analyze 核对其规格、修订与阶段；不得新建无关联任务或替换原基线。
默认在对话中只读展示影响：需求、设计、任务、测试、历史证据和拟更新的具体文件及内容；此时不持久化 impact 提案。
取得针对该方案的明确确认后，才调用 impact --input <文件到拟更新正文的映射 JSON>，再次核对实际差异与确认后的批准范围，随后 apply-impact --approve。不能用“调用了 change”代替对具体方案的批准。源文件或方案变化时停止并重新核对，不能自动批准新内容。
保留已有任务 ID、历史完成记录及证据。标记不再适用的验证和任务，不重建原始基线，不补造 Red。
更新文档和检查一致性后停止，不自动继续业务代码实施；只有用户另有明确实施授权时才交接对应实施流程。当前运行核心只更新已存在文本文件；新增或删除规格文件需明确授权并走原生框架能力，不能假装已完成。
