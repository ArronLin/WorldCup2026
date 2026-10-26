---
name: sdd-speckit-start
description: Analyze the task and recommend a workflow without creating files. Continue only on explicit user request.
---

本次明确选择 speckit；先说明目标仓库、当前任务和本入口职责，不得加载另一框架的规则。
读取 `.specify/easeus/requirements.json`、本框架项目规范及知识库绑定；工程政策只来自启用规则，不恢复停用政策。
仓库运行入口：`powershell -NoProfile -ExecutionPolicy Bypass -File .specify/easeus/workflow/run.ps1`，后接动作和参数；每次传 --project 当前仓库。使用 Studio 工作项协议的任务传 --work-item 明确清单路径；`specs/tiny/` 单文件任务直接读取 Markdown，不使用此参数。需要 Python 3.10+，不依赖 Studio 或用户目录绑定。
只请求查询、诊断或分析时只读，不创建文档、不登记或推进任务、不运行测试或安装依赖。只读调用附加 `--intent analyze`，该模式只允许 doctor/status；不得去掉参数、换用直接 Python API 或报告命令绕过只读边界。缺少环境时报告缺口，不自行修复。
任务归属或授权不明确时才询问；明确授权只适用于相应任务和范围，不自动扩展。

## 默认只分析和推荐
调用本入口只表示选择框架和请求分流。仅仅描述要实现或修复的目标，不代表允许创建任务或推进实施。
只读取必要源码、现有任务及知识库；可用 doctor --intent analyze 检查能力，用 status --intent analyze 核对明确任务。不得执行有写入副作用的检查、生成索引、测试、采集或依赖安装。
默认不得创建任务文件，包括 task.md、tasks.md、work-item.json 和 create-input.json；不得写入规格、记录基线、转换阶段、修改配置或业务代码。
按以下格式在对话中给出结果：
1. 目标与验收理解；不确定之处。
2. 推荐类别：新功能、Bug、轻量改动或已有任务的需求变更。
3. 分类理由与风险：公共行为、接口、权限、数据迁移、兼容性、影响范围和验证能力；不得主要按修改行数分类。
4. 当前前置缺口及建议，不自动补建采集配置。
5. 推荐的下一入口及可复制调用示例；只展示，不自动调用。
新功能：核对已安装的原生需求入口；Bug：先调用官方 `$speckit-bug-assess`，审阅诊断后再分别调用 `$speckit-bug-fix` 和 `$speckit-bug-test`；不得自动串行推进。 轻量用 $sdd-speckit-quick；已有任务需求变更用 $sdd-speckit-change；续做用 $sdd-speckit-resume。
6. 停止，等待用户明确要求继续。推荐结果只保留在对话，不保存到仓库。

## 明确继续后的交接
用户在看到建议后明确选择流程或要求继续，才读取并交接给对应入口，沿用已说明的任务和批准范围。
原始请求若明确要求“分析推荐后直接按推荐流程继续执行”，可在完整展示建议后交接；单独调用 start 或“实现某功能”的任务描述不满足这一条件。
用户只说“继续”但对应多个任务、多个建议或范围不明时，先明确归属。后续方案或范围改变，需要新的相应确认。
本入口不携带实施步骤；不得在尚未交接时自行登记任务或调用写入接口。技能指令和意图参数不是权限沙箱，不声称能强制限制 Agent 的所有文件访问。
