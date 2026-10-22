# 通用功能测试报告 · 契约 v1 / 工具 v1.0.0

本工具使用 Studio 的 Python Worker，或 Python 3.10+ 标准库运行。目标项目继续使用自己的语言、测试工具和包管理器。本工具不安装项目依赖、不修改锁文件、不运行常驻服务。

## 从配置到实际使用

1. 在 Studio 工程规则中启用所需报告，在“功能测试报告设置”确认当前仓库的生产代码范围、测试源码范围和命令。
2. 允许保存缺少采集能力的配置。Studio 成功表示工具已部署；完成页明确列出待建设能力，后续 plan/tasks 安排适配工作。
3. 完成第 9 步应用后，命令入口、契约和工具一起部署。关闭 Studio 仍可运行。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .specify/<namespace>/reporting/run.ps1 doctor --feature specs/<feature>
python .specify/<namespace>/reporting/runtime/v1/cli.py doctor --feature specs/<feature>
```

`<namespace>` 使用当前仓库实际前缀，不复制示例占位值。Windows 启动器读取本机的 runtime.json 绑定；程序移动后打开 Studio 修复绑定。CI 可使用同一 Python CLI，不要求安装 Studio、Node 或浏览器。

## 功能生命周期

- `baseline --confirm-before-changes`：只在功能创建、尚未修改生产代码时捕获工作区。保留原有未提交内容，并记录 Git HEAD/dirty（若存在）。已有基线只校验，不覆盖。工具不能独立证明人的时间声明；中途启用需明确指定可证明早于变更的完整 `--from-commit`，否则如实保留基线缺失。
- `check`：检查基线、稳定规格 ID、traceability.json 及配置能力；不要求实施前已有 Green，不运行测试。
- `run --phase red|green|refactor --suite <ID> --cycle <ID> --target <test_id> --requirements FR-001,US1-AS1`：执行配置的真实测试。可重复 `--target`。精确 test_id 计算规则见下文；参数不会拼接成 shell 字符串。
- `run --phase final --suite <ID>`：执行该套件完整的已配置命令，不接受局部目标。无需重构时，在 Green 后最终回归附加 `--no-refactor "具体理由"`。
- `finalize`：检查各配置套件最新 final、当前源码/测试/规格/映射/规则指纹，然后生成启用的 HTML、统一 JSON 和 report-status.json；不重跑测试。

所有命令显式指定 `--feature specs/<feature>`。功能目录需已存在并包含 spec.md，不猜测最新目录。最终验收以 finalize 的返回码和 `passed` 为准。run 返回真实测试进程退出码，即使收集失败但测试退出 0，仍必须检查收据 classification，并由 finalize 阻止完成。有效 Red 仍是非零码，不能当作测试通过。

`doctor/check/finalize` 的 0 表示通过；1 表示能力/证据/门槛不足；2 表示配置、输入或格式损坏。首次 baseline 缺少时机确认为证据不足。`doctor --self-check` 是部署自检：工具可执行不等于采集能力完备。

## 统一数据契约

完整机器规范在 schemas/。所有文本 UTF-8，源码哈希基于移除 BOM、统一 CRLF/CR 为 LF 后的文本；JSON/原始日志哈希使用原始字节。路径为仓库相对 POSIX 路径，行号从 1 开始，不能穿越或借符号链接访问仓库外。

### 执行配置

config.json 包含契约版本、适配器接口（standard-formats 或 custom，版本 1）、生产/测试 include/exclude glob、套件列表和能力说明。范围默认均为空，不预设 src 或语言扩展名。支持 `*`、`**`、`?`；配置目录、Git 元数据和 specs 功能产物不纳入生产清单。源码需为 UTF-8；二进制产物必须明确排除。

每个套件有 ID、unit/integration/e2e/other 层级、command、args 数组和相对 cwd；results 有 format/path/provider；unit 可附 coverage。程序本机绝对路径单独保存在本机绑定，不能写入共享 command。脚本通过解释器参数调用，不隐式执行 .bat/.cmd/.ps1。不要在参数中写入凭据，使用已有环境变量。

results 与 coverage 文件路径相对于仓库根；标准格式中的相对源文件路径也应以仓库根为基准。若工具输出相对于其他根目录、虚拟路径、压缩源映射或特殊重试扩展，请用 collect 适配器明确转换，不能猜测文件。doctor 只检查配置和程序是否存在；实际兼容性还需真实运行验证。

### 标准格式导入器的能力边界

|格式|支持|不足时如何扩展|
|---|---|---|
|LCOV|SF、DA、end_of_record；单测范围的行级可执行/命中清单|必须包括未导入文件；多行语句可提供 mapping_path；其他扩展用 collect|
|Cobertura XML|coverage/packages/classes/class filename/lines/line number/hits|不猜测 sources、虚拟文件或压缩 sourcemap 的根目录；先转换为仓库相对路径|
|JUnit XML|testsuite(s)/testcase，classname+name 定位，显式 file、time、failure/error/skipped，flakyFailure/逐次 rerun 扩展|未提供文件时保留空值；不从 classname 猜源文件；其他重试/预期失败用 unified|
|TRX XML|命名空间 UnitTestResult/TestDefinitions、testId、outcome、duration、RunInfo 错误|testId 为真实定位，不从显示名猜测；缺源码和重试信息由适配器补充|
|统一 JSON|coverage.schema.json 与 results.schema.json|完整保留参数身份、错误类型、重试、预期失败、源码和版本声明|

格式支持不是所有框架版本兼容承诺。provider ID/version 记录提供方声明；实际导入时校验结构与数据。XML 不允许 DTD/实体。输入缺失、格式变化、源码映射越界或清单不全不能给出成功。

### 覆盖率

统一 coverage 数据必须有 schema_version=1、provider、scope=unit、run_id、source_fingerprint，以及逐文件 path/source_hash/executable_lines/hit_lines。完整范围中未导入文件也必须列出真实可执行行；不能把缺失记录当零新增。只有 unit 套件可参与覆盖率，E2E/集成结果不合并进单测门槛。

默认按照提供方的行级语义计算差异交集。多行表达式提供 `source_mapping: {"version":1,"kind":"statement-ranges","ranges":[{"start":1,"end":3,"executable_line":1}]}`，将继续行变更映射至真实执行行。源映射还可声明 baseline_path：改名且修改的文件填写原基线路径；确实是新增文件填写 null。纯改名可按内容哈希识别；新增与删除同时出现且无法核实身份时，报告拒绝计算，不能将原有已覆盖代码算作新增以抬高指标。核心不包含语言 AST，也不把所有未命中行一律当可执行行。仅格式变化是否影响执行行遵循提供方声明的语义；需要语法等价过滤时由适配器提供可靠的范围/规范化能力，不宣传核心具有语言级语义 diff。

指标为 sum(C)/sum(D)，门槛复用已启用的覆盖率规则，以十进制未舍入值比较。D=0 显示不适用；未启用门槛显示未设置。源码前后清单、覆盖文件与结果哈希均保存，过期结果不可复用。

### 测试追踪与 TDD

规格使用稳定 FR-xxx 与 USx-ASx ID。traceability.json 分 requirements/scenarios，明确描述、规格位置、适用性、必需测试和手工/不适用依据。每个测试定位由 provider + container + locator + parameters + level 组成；可提供显式 file 和 TDD 适用性原因。test_id 为标准 JSON 四元组 `[provider,container,locator,parameters]` 的 SHA-256（序列化方法见 contracts.test_id）。ID 不是展示名的模糊搜索，重复定位拒绝匹配。

只有所有必需测试在最新有效 final 中严格 passed 才算自动验证。skipped、todo、not_run、error、flaky、expected_failure 均独立显示。手工/不适用项保留在清单、披露分母与确认依据，不冒充自动测试。

Red 必须是真实目标用例的断言失败；未知失败标为需核实，基础设施错误不算。Green 需同一目标、同 cycle、生产实现改变且目标测试文件指纹保持不变。Refactor 需实际修改后回归；或明确无需重构理由及 Green 后 final。映射显式给出的测试文件可用于无源文件位置的结果，但不改变原始结果的 file 空值。测试源码不在采集清单时 TDD 证据不足。停用 TDD 时不评定。

## 自定义 collect：不改报告核心扩展新工具

1. 项目自己的测试命令正常执行，输出原生结果。
2. 可选 collect command/args/cwd 读取真实结果，通过环境变量 REPO_SDD_CONTEXT 或 `{context}` 获取运行 ID、源清单、指纹和目标测试。
3. 在 `{output}` 写入 `{"schema_version":1,"results":<统一测试结果>,"coverage":<统一单测覆盖率或 null>,"diagnostics":[]}`。每条用例 provider/level/run_id/test_id 必须匹配配置；coverage 需绑定源清单和运行 ID。
4. 保存真实原始返回、日志和收据；格式转换失败以非零码和 diagnostics 返回。不要用程序常量伪造测试通过或历史 Red。
5. 用成功、断言失败、启动失败、跳过/重试、同名、缺文件、源码变化等夹具验证适配器；再完成真实框架验收。核心无需更改。

命令参数支持 `{context}`、`{run_id}`、`{root}`；collect 另有 `{output}`；精确单独参数 `{targets}` 扩展为目标 ID 数组。工具不会猜测框架的筛选参数；适配器可据上下文处理筛选，最终 run 不提供局部目标。

## 生命周期与审计

安装清单只管理明确列出的文件。升级、停用、改前缀和恢复纳入 Studio 事务；外部修改需要先处理，未知邻接文件不归应用所有。停用保留 specs 下历史证据。

开始新运行或生成失败会废止旧成功 HTML。每个报告标记生成时间、ID 和源指纹。原始日志保留在 reporting/runs，相对链接需要携带目录；单个 HTML 已内嵌摘要和源码，可独立离线阅读。运行期间每个 feature 只有一个写入操作；崩溃残留 .operation.lock 时，确认记录 PID 已不运行后再移除锁。

工具为 Python 标准库原创实现；不包含需要现场下载的依赖，不包含数据库或服务。Python/Qt 等宿主许可见应用第三方许可。时间和哈希是本地一致性证据，不是第三方防篡改证明。
