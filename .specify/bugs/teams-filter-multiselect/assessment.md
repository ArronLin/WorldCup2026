# Bug Assessment: 球队筛选不支持多选

- **Slug**: teams-filter-multiselect
- **Created**: 2026-10-26
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: low

## Report (verbatim or summarized)
“当前球队页面的球队筛选下拉框仅支持单选，不支持多选；需要支持多选”。任务标识由用户确认。

## Symptom
当前只能显示一个所选球队；本次明确要求同时显示多个所选球队。上一轮仅约定单选，因此这是本次新确认的期望，并非已证明的历史回归。

## Reproduction
1. 进入 #/teams，选择阿根廷。
2. 再选择巴西，阿根廷被替换，无法同时显示两队。
3. 当前源码的 select 无 multiple 属性，控制器只读取 event.target.value 并与单一 code 比较，可确定该限制。

## Suspected Code Paths
- src/views/teams.js:22：渲染单选 select。
- src/teams-filter.js:8：读取单一 value。
- tests/teams-dropdown.test.js、e2e/teams-dropdown.spec.js：目前只覆盖单选。

## Root Cause Hypothesis
置信度 high：控件和过滤条件都采用单值模型。

## Proposed Remediation
使用原生 details/summary 下拉面板，内部使用原生复选框和可见标签，避免桌面用户依赖 Ctrl/Command。控制器在原 app 根节点委托 change，读取已选球队集合，以 OR 语义显示球队；空小组隐藏。全选入口与具体球队互斥：选择任一球队清除“全部球队”，选择“全部球队”清除具体球队；取消最后一个球队自动恢复全部。默认全部，不持久化，不新增路由。

**Files likely to change**：src/views/teams.js、src/teams-filter.js、src/styles/pages.css、public/i18n/zh.json、public/i18n/en.json、tests/teams-dropdown.test.js、e2e/teams-dropdown.spec.js。

**Tests to add or update**：
- AC1：展开后可同时勾选不同小组的多支球队，显示结果为所选集合。
- AC2：取消一支仅移除该支，清空选择或勾选全部恢复所有球队。
- AC3：中英文可见标签、键盘、窄屏及现有控制器初始化/释放/重渲染行为正常。

## Risks & Considerations
局部展示行为改变，无接口、权限、数据迁移、路由或浏览器存储变更。使用已有颜色 token、原生语义和现有监听器生命周期。未提交的上一轮单选代码是当前修复前状态；保留其他工作区改动。

覆盖率同时核对当前 Git 基线 fb2471a5e87607fcd1bf61e563b7a13b60cf0d75 下整段筛选新增生产代码，包含本次修改，不生成源码副本。知识库 main 的提交对应关系未知；已用 CodeGraph 当前源码核实，绑定中 CodeGraph 参数缺口仍存在，使用独立可用工具。工程规则为 lean-15e0d7a4176bb023。extensions.yml 无注册 hooks。

## Open Questions
无阻塞问题。
