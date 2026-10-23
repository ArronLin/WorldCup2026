---
name: sdd-speckit-change
description: Explicit speckit change workflow requested by the user.
---

本次明确选择 speckit。先显示目标仓库、任务和下一步；不得加载另一框架的规则。
读取 `.specify/easeus/requirements.json`、本框架项目规范及知识库绑定。工程政策仅来自启用规则，不恢复停用政策。
执行入口：`powershell -NoProfile -ExecutionPolicy Bypass -File .specify/easeus/workflow/run.ps1`，后接动作与参数；该启动器调用本机绑定 Worker，不要求测试仓库安装 Python。Python `.specify/easeus/workflow/runtime.py` 支持记录与更新，完成检查使用 Worker。
先调用 doctor，再使用 create/status/transition；每次都传 --project 当前仓库，已有任务传 --work-item 明确清单路径。
create --input 接受 JSON：framework、ident、kind、title、acceptance、risks、rules、native_path（实际原生产物目录；Spec Kit feature 须使用实际含编号的目录）。验收项包含 id、description、source（仓库相对文件）、line（含 ID 的真实行号）；先形成验收项再 create。需求变更用已有任务 impact。Bug 默认原生 slug 为任务 ID，不一致时必须显式提供 native_path。完成检查同时核对原生产物与实际报告。
本入口为 change。start 先根据实际任务及源码提出分类与风险依据；quick 仅在验收明确、无接口/权限/迁移/兼容等未处理风险时使用；范围扩大转标准流程并保留关联。
quick 在记录的 native_path 保存目标、边界、验收、实际修改和验证的简短 Markdown；不使用空文件充当产物。
不按改动行数判风险，不按时间猜已有任务；有多个任务询问归属。只授权分析/计划时不得实施代码。
Spec Kit 的 feature 使用原生 Agent 技能 speckit-specify、speckit-plan、speckit-tasks、speckit-implement，它们不是 Specify CLI 子命令。bug 使用已安装官方 speckit-bug-assess、fix、test，原生报告保留 Status/Result 机器字段：先 assessment、验收项与基线；仅在当前启用 TDD 时要求修复前真实断言 Red，再生产修复与复现验证。TDD 停用时不强制 Red/Green/Refactor，不补造历史过程。扩展缺失报告待修复，不伪造官方命令。
OpenSpec 的 bug/quick 使用项目 easeus-bugfix、easeus-bugfix-specs、easeus-quick Schema，按 change 显式选择，不改变普通默认 Schema。
需求变更：调用 impact --input 提交明确文件到拟更新正文的映射，展示差异、影响和待更新任务；用户确认后 apply-impact --approve。源文件变化应停止。保留历史，不自动撤销业务代码。
若更新后现有实现已满足需求，不制造无意义的修改或 Red；先针对当前输入真实 final 与 finalize，通过后可从 assessed 进入 verifying，Worker 会重新核对，不把未实施阶段伪报为执行完成。TDD 不适用项按追踪契约填写具体原因，不能借此规避实际生产实现的规则。
启用报告时使用 `.specify/easeus/reporting/run.ps1`。先调查仓库自己的测试命令、源码范围及结果格式；若采集尚未就绪，依据 reporting/README.md 编写候选 JSON，执行 configure --input <候选 JSON> 和 doctor，不凭猜测宣称完成。之后传 --work-item 明确任务清单，替代 --feature。生产修改前 baseline --confirm-before-changes；按启用规则执行实际 run 阶段，TDD 停用时仅需实际 final 与 finalize，不要求补录 Red/Green/Refactor。当前未具备采集能力时安排适配任务，不能声称通过。历史 Red 不补造。
标准 feature 复用 native_path 中已有原生规格、追踪、基线与收据，不在任务目录重新建立基线；Bug/quick 才使用任务目录的验收追踪。不要为复用功能补造历史 Red。
resume 必须先 status 核对任务、输入修订、文件及既有证据，再从已完成阶段继续。最后使用 Worker --task-workflow finish --project 当前仓库 --work-item 明确清单 --config .specify/easeus/reporting/config.json；该命令重新计算报告而非信任历史 passed。未通过时只报告缺口，不宣称验证通过。未启用报告时不强制开启，说明验证能力限制。
