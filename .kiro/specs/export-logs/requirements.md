# Requirements Document

## Introduction

本功能为 WorldCup2026 赛事网站新增**一键导出系统日志**能力。用户在设置或调试入口点击一个按钮，系统即将当前会话期间收集的前端运行日志（包括错误记录、操作事件、聊天请求日志等）打包为 ZIP 文件并触发浏览器下载，以便用户自助提交问题反馈或进行本地分析。

导出不依赖任何外部服务，完全在浏览器端完成，符合宪法条款-002（核心浏览独立于可选 AI）和条款-003（外传前告知）的要求。ZIP 中不包含任何模型密钥或用户凭据（遵守条款-004）。

## Glossary

- **日志收集器（Log_Collector）**：浏览器端模块，负责在内存中捕获并存储当前会话的运行日志条目。
- **日志导出器（Log_Exporter）**：浏览器端模块，负责将日志条目序列化并打包为 ZIP 文件后触发下载。
- **日志条目（Log_Entry）**：单条日志记录，包含时间戳、级别（info / warn / error）、来源模块和消息正文。
- **ZIP 包（ZIP_Package）**：符合 ZIP 规范的压缩归档文件，扩展名为 `.zip`。
- **系统（System）**：WorldCup2026 前端应用整体。
- **会话（Session）**：从页面加载到页面卸载的完整生命周期。

---

## Requirements

### Requirement 1: 日志收集

**User Story:** 作为开发者，我希望系统在运行期间自动收集前端日志，以便导出时能够获得完整的运行记录。

#### Acceptance Criteria

1. WHEN 应用会话启动时，THE Log_Collector SHALL 初始化并在内存中维护一个有序的日志条目列表，初始列表为空。
2. WHEN 应用代码调用日志收集接口时，THE Log_Collector SHALL 将包含时间戳（ISO 8601 格式，精确到毫秒）、级别（debug、info、warn、error 之一）、来源模块名称（不超过 64 个字符）和消息正文（不超过 2048 个字符）的日志条目追加到内存列表末尾。
3. WHEN 浏览器触发全局未处理异常（`window.onerror`）时，THE Log_Collector SHALL 以级别 error 将包含异常消息、文件名和行号的日志条目追加到内存列表中。
4. WHEN 浏览器触发未处理的 Promise 拒绝（`unhandledrejection`）时，THE Log_Collector SHALL 以级别 error 将包含拒绝原因字符串的日志条目追加到内存列表中。
5. WHEN 新条目追加后内存列表长度超过 1000 条时，THE Log_Collector SHALL 移除最旧的一条条目，使列表长度保持不超过 1000 条。
6. WHEN 日志条目的消息正文包含与模型密钥、用户凭据或 Authorization 头值匹配的字符串时，THE Log_Collector SHALL 在写入前将该字段中匹配的值替换为固定占位符 `[REDACTED]`，并保留其余内容不变。

---

### Requirement 2: 一键导出触发

**User Story:** 作为用户，我希望通过单次点击即可触发日志导出，以便快速完成操作而无需额外步骤。

#### Acceptance Criteria

1. THE System SHALL 在设置面板或调试入口处提供一个明确标识为"导出日志"的可点击按钮。
2. WHEN 用户点击"导出日志"按钮时，THE Log_Exporter SHALL 开始执行打包流程，不需要用户进行任何额外确认步骤。
3. WHILE 打包流程正在进行时，THE System SHALL 将按钮更新为禁用状态并显示进度提示，防止重复触发；进度提示至少每 2 秒刷新一次当前状态。
4. WHEN 打包流程完成时，THE System SHALL 在 500 毫秒内将按钮恢复为可用状态。
5. IF 打包流程未能在 60 秒内完成，THEN THE Log_Exporter SHALL 终止当前打包操作，并向用户显示说明超时的错误提示，同时将按钮恢复为可用状态。
6. IF 打包流程因错误提前终止，THEN THE Log_Exporter SHALL 向用户显示说明失败原因的错误提示，并将按钮恢复为可用状态。

---

### Requirement 3: ZIP 包生成与下载

**User Story:** 作为用户，我希望导出的日志以 ZIP 包形式保存到本地，以便在不依赖外部服务的情况下完成归档。

#### Acceptance Criteria

1. WHEN 导出触发时，THE Log_Exporter SHALL 将内存中的全部日志条目序列化为 JSON Lines 格式（每行一个 JSON 对象）的文本文件，文件名为 `system-logs.jsonl`，文件编码为 UTF-8，条目间以换行符（`\n`）分隔，文件末尾不附加额外换行符。
2. THE Log_Exporter SHALL 生成一个包含 `system-logs.jsonl` 的 ZIP_Package，ZIP 文件名格式为 `wc2026-logs-{YYYY}{MM}{DD}-{HH}{mm}{ss}.zip`，时间戳使用导出发起时的本地时间，ZIP_Package 中不包含任何其他文件或目录层级。
3. WHEN ZIP_Package 生成完成时，THE Log_Exporter SHALL 通过浏览器文件下载机制（创建并点击临时 `<a download>` 元素）触发文件保存，不跳转页面、不打开新标签页，下载触发后释放为该操作创建的临时对象 URL。
4. THE Log_Exporter SHALL 完全在浏览器端完成 ZIP 生成，不向任何外部服务器上传日志数据。
5. WHEN 内存日志列表为空时，THE Log_Exporter SHALL 仍生成包含空 `system-logs.jsonl` 文件（文件大小为 0 字节）的 ZIP_Package 并触发下载，不显示错误提示。
6. IF ZIP_Package 生成过程中发生错误（包括序列化失败或 ZIP 构建失败），THEN THE Log_Exporter SHALL 向用户显示错误提示，说明下载未能完成，不触发文件下载，不丢失内存中的现有日志条目。

---

### Requirement 4: 错误处理

**User Story:** 作为用户，我希望在导出失败时收到明确提示，以便了解问题原因并决定后续操作。

#### Acceptance Criteria

1. IF ZIP 打包过程中发生异常，THEN THE Log_Exporter SHALL 在页面内以可见的错误提示区域显示一条包含具体失败原因（如文件读取失败、压缩失败）的文字说明，并将导出按钮的禁用状态解除，使其恢复可点击。
2. WHEN 页面加载完成，THE Log_Exporter SHALL 检测当前浏览器是否支持 `Blob` 和 `URL.createObjectURL` API。
3. IF 浏览器不支持 `Blob` 或 `URL.createObjectURL` API，THEN THE Log_Exporter SHALL 将导出按钮设为禁用状态，并在按钮旁显示一条指明"当前浏览器不支持此功能"的文字说明。

---

### Requirement 5: 导出内容安全

**User Story:** 作为用户，我希望导出的日志包不包含我的模型密钥或其他凭据，以便安全地将日志文件分享给他人。

#### Acceptance Criteria

1. WHEN Log_Exporter 对日志条目批次执行序列化，THE Log_Exporter SHALL 对该批次内每条条目的消息正文和请求元数据字段执行遮盖处理，将所有匹配已知凭据模式的子字符串替换为 `[REDACTED]`；已知凭据模式至少包括：以 `sk-` 开头后跟 1 至 200 个非空白字符的子字符串，以及以 `Bearer ` 开头后跟 1 至 500 个非空白字符的子字符串。
2. THE Log_Exporter SHALL 不将 `localStorage` 中键名符合模型配置命名约定（即键名以 `model_` 为前缀或键名精确匹配 `apiKey`、`secretKey`、`accessToken` 之一）的条目写入 ZIP_Package。
3. IF 任意日志条目的消息正文或请求元数据字段在遮盖处理阶段发生错误，THEN THE Log_Exporter SHALL 中止当前导出操作，不生成 ZIP_Package，并向用户呈现错误提示，说明导出因安全检查失败而终止。
4. WHEN Log_Exporter 完成遮盖处理并完成序列化再反序列化，THE Log_Exporter SHALL 确保所得每条条目的时间戳、级别、来源模块及消息正文字段与遮盖处理后、序列化前的对应值完全一致。
