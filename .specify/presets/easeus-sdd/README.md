# Repo SDD Studio Preset v2.1.0

默认 ID 为 easeus-sdd，桌面向导支持自定义前缀。阶段命令采用 wrap，模板采用 append。有效规则来自仓库 .specify/<前缀>/requirements.json。

推荐通过 Repo SDD Studio 安装：生成、评审后，在第 9 步自动启用并验证，不需要额外命令。命名、语言、TDD 和覆盖率等设置均按本次快照生成。所有 SDD 文档采用摘要先行、需确认项集中、正文分层、细节后置的评审结构；任务按用户故事组织，并用 `[测试]`、`[实现]`、`[验证]` 等标签区分。标题、小标题、表头和状态说明遵循当前语言规则。

保留便携脚本用于已有 Spec Kit 项目：

    python scripts/sdd_preset.py install --project <仓库目录> --agents codex --default-agent codex

脚本默认前缀为 easeus；自定义命名推荐使用桌面应用。脚本安装会先渲染规则再注册 Preset，不要直接安装尚含规则占位符的源码目录。

单独 Preset 的 doctor 只检查配置与技能，不证明真实 Agent、MCP 或项目业务测试通过。桌面应用另行完成实际取证及读取验证。


