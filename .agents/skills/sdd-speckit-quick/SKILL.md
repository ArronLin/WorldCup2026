---
name: sdd-speckit-quick
description: Execute an explicitly requested low-risk change with clear acceptance criteria.
---

## 职责：单文件低风险小改动

本入口只处理边界清楚、验收明确且没有未处理接口、权限、数据迁移、架构或兼容风险的小改动。改动行数不是低风险证明；风险不清楚或范围扩大时，说明原因，推荐 `$sdd-speckit-start` 或完整 Spec Kit 流程并停止，等待用户重新授权，不得自行扩成完整新功能。

只请求分析时保持只读。用户明确要求实施后，读取 `.specify/easeus/requirements.json`、`.specify/memory/constitution.md`、必要源码和知识库；工程政策只来自当前启用规则，不恢复停用政策。

## 唯一任务产物

在 `specs/tiny/<kebab-name>.md` 创建或继续**一份 Markdown**，它是该小改动的需求、计划和进度的唯一来源。不得创建 `.specify/studio-tasks/`、`work-item.json`、`create-input.json`、独立 `task.md`，也不得调用 Studio 工作项运行时登记或推进新 quick。旧版 quick 的工作项只作历史兼容，不迁移、不复制到新任务。

文件尽量不超过 80 行，并使用以下结构；没有价值的样板内容应删减，但验收、任务和完成条件不可为空：

```markdown
# TinySpec: <标题>

**Branch**: <当前分支>
**Date**: <YYYY-MM-DD>
**Status**: draft
**Complexity**: small

## What
<目标、原因和边界，1–3 句>

## Context
| File | Role |
|---|---|
| `<仓库相对路径>` | <修改或参考作用> |

## Requirements
1. **AC-001**: <可验证要求>

## Plan
1. <具体文件与修改方式>

## Tasks
- [ ] <实施任务>
- [ ] <适用的测试任务>

## Done When
- [ ] 所有任务已完成
- [ ] 适用测试已实际运行并如实记录结果
- [ ] 当前启用的工程规则已满足
```

创建前检查同名文件；已有文件必须显式继续，不覆盖。列出实际预计修改和参考的文件。预计超过 5 个文件或 10 个任务，或涉及多模块、架构、数据库结构、新服务、跨领域能力时，停止并建议完整流程。

## 实施与完成

明确获准实施后，将状态改为 `in-progress`，严格按已批准范围逐项执行并更新同一文件中的复选框。只有当前启用 TDD 时，先编写测试并实际运行，确认预期行为尚未实现导致断言失败，再做最小实现、按需重构并回归；依赖、环境或语法错误不是有效 Red，事后补测不得宣称为 TDD。停用 TDD 时不得重新强制。

使用仓库自己的测试工具。覆盖率要求读取当前规则快照并沿用仓库已有工具和 CI；无新增可执行生产代码时说明不适用，不记为 100%。不默认另建 evidence、收据、追踪映射、源码副本、截图、验收说明或 HTML。

完成前重新读取 TinySpec，确认所有 Tasks 和适用的 Done When 均已勾选，且实际修改没有越界；然后将 `**Status**` 改为 `done`。若测试失败或未执行，保持相应条件未勾选并如实说明，不得声称质量通过。完成只表示这份单文件计划已经实施，质量状态保持“未核验”，不代表程序核验了测试、覆盖率或 CI。不得自动提交、推送或归档。
