# 阶段路由与完成边界

|阶段|Wiki|CodeGraph / 当前源码|应形成结果|
|---|---|---|---|
|constitution|背景、术语、已有流程|Wiki 建背景；CodeGraph 核实关键工程事实。|constitution.md：先列评审摘要和治理决定，再列原则与修订依据。|
|specify|背景、术语、已有流程|Wiki 为主；CodeGraph 按需核实影响需求的现状。|当前 feature 的 spec.md：先列用户价值、范围和待确认项，需求与验收场景相邻。|
|clarify|背景、术语、已有流程|按问题查两个底座；产品决定交给用户。|更新 spec 和工作流允许维护的内置检查状态。|
|plan|按需补充|CodeGraph 与当前源码为主，Wiki 提供架构背景。|plan.md 先列摘要、变更地图、决策与风险；research/data-model/contracts/quickstart 各自只保留其职责所需内容。|
|checklist|按需补充|工作产物为主，必要时查底座。|每项只提出一个可回答的评审问题并定位需求；不是实现任务或测试报告。|
|tasks|按需补充|复用 plan，按需用 CodeGraph 核实位置和依赖。|tasks.md 先列规模、依赖和阻塞；按故事依次分组测试、实施和验证，并添加中文任务类型标签。|
|analyze|按需补充|文档为主，必要事实再查底座。|分级报告与修正建议，不修改文件。|
|implement|按需补充|CodeGraph 和当前源码为主，Wiki 按需补充。|代码、测试、任务状态；在对话中说明实际验证结果，不另建过程证据文件。|
|converge|按需补充|当前源码与运行证据为主，CodeGraph 辅助，Wiki 解释背景。|差距及后续工作。当前上游默认只追加 tasks，本地定制以实际为准。|


