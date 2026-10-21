# 实现后的验证指南

日期：2026-10-20。功能及下列验证命令已实现；实际执行结果和边界见 [验收记录](evidence/acceptance.md)。

## 前提与本阶段边界

- 工作目录 `D:\GitHub\WorldCup2026`；Node.js 24+，本机读取为 24.21.0、npm 11.19.0。依赖以锁文件为准。
- 使用锁定的开发依赖。默认单测环境仍为 Node，DOM 用例使用单文件 jsdom 注解；新增行覆盖审计和变异工具均已提供。
- 阅读 [规格](spec.md)、[数据模型](data-model.md) 和 [页面契约](contracts/ui-and-state.md)。无须模型密钥或 Netlify Function；验证的是静态浏览功能。

## 安装与单测

```powershell
Set-Location 'D:\GitHub\WorldCup2026'
npm ci
npx vitest run tests/environment-node.test.js tests/environment-dom.test.js
npm run validate:data
npm test
```

T002已建设并运行两份环境用例：默认Node断言document未定义；带单文件jsdom注解的DOM用例实际创建/读取DOM并断言。上述命令须发现并通过两类用例，不能只检查依赖安装。验证包括数据引用、双语词条集合与真实行为测试；记录发现、执行和跳过数量，不允许通过skip隐藏失败。环境冒烟不是业务Red；实现期每个行为仍需真实Red→Green→Refactor。

## 覆盖率与反向验证

以下命令均可直接运行。coverage:baseline 只重建实现前的固定基线，不会重新捕获或覆盖基线。

```powershell
npm run coverage:baseline -- --manifest specs/001-follow-teams/coverage-baseline.json --output .tmp/follow-teams-baseline
npm run test:coverage
npm run coverage:added -- --baseline .tmp/follow-teams-baseline/baseline.json
npm run test:mutations:follow
npm run coverage:prove-unimported
```

**首次捕获与后续重建分开**：T001在任何生产改动前生成权威 `coverage-baseline.json`，包含schemaVersion/mode/baseCommit、固定生产范围和完整路径/SHA256清单。生产源与原提交一致用git-tree；有需保留的原生产差异则用snapshot，并把完整原源码放在同功能目录 `baseline-source/`、在manifest记录sourceRoot。这些是随实现提供的版本输入；本任务不执行提交或推送。本次已在任何生产改动前捕获 git-tree 基线，原始27文件均与指定提交一致。

上面的coverage:baseline**读取既定manifest重建**，不是重新捕获当前源码；git-tree从指定原提交取文件，snapshot从已固定原快照取文件，核验完整性及哈希后只写 `.tmp/follow-teams-baseline/`。不得修改权威manifest或回退当前HEAD。覆盖审计明确读取重建产物；若manifest、原提交、快照或哈希缺失/不符，必须失败。

**干净检出复现**：T052使用包含拟交付源码和上述版本输入、但不带本地evidence、既有coverage/.tmp的检出副本，取全历史（CI checkout fetch-depth:0），实际执行同一基线重建→单测采集→新增行审计命令。分别验证正常输入和错误哈希/缺源的失败结果，记录实际证据；不把本地复现标成远程CI已通过。

覆盖报告包含全部自有生产文件，含未 import 文件；审计提供 C、D、每个新增行映射及缺失项，D>0 时按原始整数比较 `5*C >= 4*D`，不以四舍五入数值或 E2E 覆盖替代。D=0 需明确报告不适用。负向夹具必须证明未加载新增代码／缺失报告／低于阈值均会失败。反向验证临时变更生产逻辑，相关断言必须失败，finally 恢复后哈希一致、单测恢复通过。

## 构建与浏览器验收

```powershell
npm run build
$env:CI = '1'  # 要求Playwright自行启动当前dist，不复用未知服务
npm run test:e2e
Remove-Item Env:CI
```

必须先构建当前工作区。测试前核对 4173 服务来自本仓库当前 dist；不能确认时停止自己拥有的旧预览服务再启动，不杀死未知进程。Playwright 未安装浏览器时才执行 `npx playwright install chromium`（CI 沿用 --with-deps）。

| 场景      | 操作与应观察的结果                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| 关注与取消   | 在两个有效球队详情页分别关注，返回查看并刷新；每队状态独立；取消一队不影响另一队。                                                                  |
| 比赛集合    | 开启“只看关注球队”，用独立手写夹具期望断言具体 match ID 集合与顺序；双方均关注仍只出现一次。不可调用生产 selector 来生成测试期望。                               |
| 阶段组合    | 更改阶段不关闭关注；关闭关注不重置阶段；所有结果都符合当前两条件。                                                                          |
| Q1      | 选择关注筛选与某阶段，离开到球队／比赛详情再返回，保持筛选；reload 后关闭关注、全部阶段，但关注列表仍存在。                                                  |
| 双语      | 固定 context locale，控制已有语言偏好；先断言中文实际文案，再切英文确认文案，最后切回中文。逐次确认关注、开关、阶段与结果 ID 不变。                                |
| 空状态     | 无关注＋开关开启显示引导；有关注但阶段无匹配显示另一提示；关掉开关仍能浏览。                                                                     |
| Q2      | 首次导航前仅对关注 key 注入 setItem 拒绝；操作仍更新按钮及比赛；返回／切语言后仍有效且警告存在；reload 恢复此前成功保存的记录，而非临时值。                           |
| 恢复异常    | 分别注入损坏 JSON、错误版本、重复／无效代码、getItem 拒绝；合理区分损坏与正常空，允许重新关注，不崩溃。                                                 |
| 全面存储拒绝  | 单独场景使取得或读写 localStorage 全部抛错；应用仍能启动、切换语言和临时关注；不能只测定向 key 失败。                                               |
| 数据失败与恢复 | 在导航前拦截实际 `/data/teams.json` 或 `/data/matches.json` 返回 503，显示加载失败；持久关注原文不变。移除拦截并点重试，恢复有效结果；不能仅重载页面代替检验重试缓存。 |
| 无效入口    | 直接访问缺失／非法／不存在球队路径，显示球队列表入口，无可用关注操作。                                                                        |
| 连续动作／键盘 | 快速切换开关、阶段和语言，最终控件及结果对应最后选择；Tab、Space／Enter 操作有效，焦点可见且不会被旧渲染抢回。                                             |

每个场景使用独立 browser context。持久化初始值用首次导航前的 storageState 或一次性的 UI 操作；**不得在 addInitScript 每次导航重新 seed 数据**，否则刷新可能是假恢复。故障注入可用 addInitScript，因为需要在新文档保留同一故障，但不得顺带重写被验证的关注值。

重新打开场景用同源新页面；可从已保存的 storageState 创建新 context 复现既有持久记录，但报告中标明这验证的是相同存储输入的恢复，不声称证明真实浏览器退出落盘。人工关闭重开可作额外演示。

## 证据交付

实现阶段写 `specs/001-follow-teams/evidence/`：基线与清单、Red／Green／Refactor、有效性反向检查及恢复哈希、原始 coverage 报告、增量行映射和 C/D、数据校验／构建／Playwright 日志。保留失败与未执行状态；成功退出之外还需对应具体行为断言。

Spec Kit 模板脚本若再次运行，进程内指定已安装环境可避免系统 Python 缺少 PyYAML：

```powershell
$env:SPECKIT_PYTHON_EXECUTABLE = 'C:\Users\admin\AppData\Roaming\uv\tools\specify-cli\Scripts\python.exe'
```

该变量只影响当前进程；环境路径变动时重新检查。它不是应用运行依赖。

## 本次落地说明

- 固定基线：`bb09b00616d2d7c151fbde512f7a11f7d35059aa`，权威输入 `coverage-baseline.json` 不得改为实现后源码。
- `test:coverage` 绑定采集前后源码哈希及原始JSON摘要；审计同时核对lcov。源文件变化后须重新采集。
- 可执行行使用Istanbul源码映射后的语句起始行；多行表达式或模板的续行发生修改时，映射回所属可执行行；Babel词法排除注释和空白，不靠文本正则推测命中。
- 未导入夹具实际采集为1/2，低于80%会失败；工具单测同时覆盖恰好4/5通过、3/5失败、缺报告和哈希错误等边界。
- 浏览器并发固定为2，单测最大4个worker，避免本机资源竞争。测试不依赖AI；原聊天冒烟仍仅使用`?mock`。
- 远程CI未执行，本地干净副本的覆盖链复现结果单独留档；不包含提交、推送或部署。

## 新增行覆盖率 HTML 报告（2026-10-21 补充）

打开 [本功能新增行覆盖率](evidence/coverage-added.html)。它与原始 `coverage-added.json` 对应，内嵌源码与样式，可作为单个文件离线查看或分享。

```powershell
# 从本功能已归档的 JSON 生成同目录 HTML，不改动原始 JSON
npm run coverage:html

# 从本次重新采集的 JSON 生成临时 HTML（CI 使用此方式）
npm run coverage:html -- --input coverage/coverage-added.json --output coverage/added/index.html
```

- 汇总使用全部文件 C/D，逐文件显示已覆盖/新增可执行行及未覆盖数。
- 默认仅显示 D>0 的文件；勾选“包括无新增可执行行的文件”可查看完整审计清单。D=0 显示“不适用”，不当作0%或100%。
- 点击文件路径查看源码。绿色与“✓ 已覆盖”表示新增已覆盖行；红色与“✕ 未覆盖”表示新增未覆盖行；其余为原有代码或非新增可执行行。
- “显示范围”可选全部源码、仅新增可执行行、仅新增未覆盖行。文件搜索支持路径片段；行号链接可以定位到对应文件与行。
- 生成器核对源码SHA256、行号集合和汇总计数；源码已变化时会拒绝生成，须重新采集覆盖率，而不是把旧结果套到新源码上。生成页面本身不会执行测试。
- CI在新增行审计完成后生成 `coverage/added/index.html`；即使低于门槛而使审计失败，也会尝试生成报告辅助定位，CI仍保持失败。下载 `unit-coverage` artifact 后打开 `added/index.html`。

补充验证见 [HTML报告验收记录](evidence/html-report/validation.md)；2026-10-20的历史验收日志保持不变。
