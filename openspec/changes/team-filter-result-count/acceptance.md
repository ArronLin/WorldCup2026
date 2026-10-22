# 球队筛选结果计数验收

2026-10-22：实现与本地验收完成，17项任务完成；未提交、未推送、未归档，远端CI未执行。

已实现实际可见数量/已加载总数，单组选中、多组并集、取消、恢复全部、真实中英切换、详情返回/刷新/新页面、未知分组与无数据均符合规格。复用原有筛选及翻译，不新增依赖、接口或持久化。

| 套件 | 最终结果 | 证据 |
| --- | --- | --- |
| unit | 7/7，失败/跳过/重试通过均0 | [原始日志](evidence/reporting/runs/d617a79e5bea40ab9088cb4c1c939a88/output.log) |
| integration | 124/124，失败/跳过/重试通过均0 | [原始日志](evidence/reporting/runs/a22f7fcf8f9a4d6088c399dd24dbccfc/output.log) |
| browser | 38/38，失败/跳过/重试通过均0 | [原始日志](evidence/reporting/runs/2c3207bfee88491184edf7520be32104/output.log) |

Vitest总共131项通过：独立unit 7项，保守归类integration的既有混合回归及新组合测试124项；不能将124项的覆盖率计入单测门槛。本功能新增unit 7项、integration 4项、e2e 5项。Playwright共38项通过，包含原有33项回归。

新增生产可执行行 C=12、D=12，未舍入C/D=1.0≥0.8。当前提供方为V8 LCOV，完整34个基线文件与新增count.js参与范围核对，未导入文件以真实可执行行零命中保留。计数模块9/9、控制器1/1、视图2/2；其他文件D=0不影响汇总。无新增自有适配生产脚本，采用标准JUnit/LCOV。

## 两份报告

- [新增行单测覆盖率 HTML](evidence/coverage-added.html)：汇总、逐文件、源码新增行。
- [需求与TDD HTML](evidence/requirements-tdd.html)：需求4/4、场景8/8、最终测试169/169、映射的TDD目标8/8。
- [报告状态](evidence/reporting/report-status.json)：passed=true，issues为空；生成ID d72fe56cc7274081a6f09acc94a3fc3d。
- [报告浏览器检查](evidence/report-browser-check.json)：两份文件已打开，需求报告203个本地链接均存在；报告截图已逐张复核。

## TDD、基线与环境

真实core Red为4个断言失败、Green为4个通过；ui-unit Red为3个目标断言失败、Green为7个单测全过；ui-integration有效Red为4个目标断言失败、Green为124项回归全过。每轮命令、源码/测试哈希、原始JUnit与LCOV由工具保存，详见报告运行表。Red/Green目标测试文件指纹一致；审视后无需结构重写，使用工具支持的具体无需重构理由及最终回归，不虚构Refactor修改。

关键反向验证将visible改为total，单组/并集断言失败；finally恢复哈希一致并复跑4项通过，见 [变异记录](evidence/mutation.json) 与 [失败日志](evidence/mutation.log)。变异不是历史Red。

基线ID 066bebf607f043e2b95ce484c6fcec6a，HEAD 4ba4cc7d8818ddf7f8a53326d366db802e1462cb，在count.js创建前捕获完整生产清单，含dirty状态。最终源码指纹 8c55bba9c5074cfd18f8b3c6f976f660a3cd3ff28c13c7c89cd108867afe992e；每个run的context/receipt保存逐文件哈希。最终报告经过finalize校验，无过期final。

环境：Windows、Node v24.21.0、Vitest 4.1.10、Playwright 1.62.1、PowerShell 7；当前源码构建通过，Playwright自行启动当前dist，未复用未知4173服务。[构建日志](evidence/build.log)。[桌面截图](evidence/screenshots/1280.png) 与 [375px截图](evidence/screenshots/375.png) 均可读，计数为8/48，键盘验收通过。

## 过程异常与边界

- 原生JUnit暴露旧参数化测试的同名身份；首次integration Red classification=collection_error，未计有效Red。为两个实际参数添加稳定索引后重跑取得assertion_red；原始失败收据保留。
- 运行器拒绝了一次上一轮尚未结束的并发采集请求；等待完成后串行重试，没有删除锁或修改历史收据。
- Python配置脚本初次使用系统默认GBK失败，改为显式UTF-8后成功；发生在生产修改及基线前。
- Windows PowerShell 5的供应启动器解析问题仍存在，本轮使用已验证PowerShell 7入口，未重写报告核心。
- 报告适配夹具检查与真实结果导入已完成；既有无数据测试参数身份修正记录于测试源码。没有需要新写的自定义转换器，因此没有虚构适配器Red。
- 旧功能浏览器证据运行前按当前字节备份、结束恢复，git diff确认未带入旧证据变更。团队成员人工签字未执行，视觉检查由Codex完成。
- OpenSpec向导MCP未提供，沿用探索/规划阶段独立Wiki与CodeGraph及当前磁盘核实的事实；Wiki版本unknown，不作为验收证据。
