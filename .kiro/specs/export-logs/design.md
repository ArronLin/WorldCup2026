# 设计文档： 一键导出系统日志（export-logs）

## 概述

本功能在浏览器端为 WorldCup2026 新增日志收集与导出能力。用户在 AI 聊天设置面板（`src/features/chat/settings.js` 渲染的 `.chat-settings` 区域）点击"导出日志"按钮，系统将当前会话期间收集的前端运行日志打包为 ZIP 文件并触发浏览器下载。

整个流程纯浏览器端完成，不依赖外部服务，不上传任何数据，不包含模型密钥或用户凭据。技术选型使用 [fflate](https://github.com/101arrowz/fflate)（通过 npm 引入，Vite 打包）进行 ZIP 生成，与现有 `src/features/` 下的 `state.js + controller.js` 模式一致。

## 架构

```mermaid
graph TD
    A[页面生命周期] -->|app.js init 阶段| B[LogCollector.init]
    B -->|挂载 window.onerror / unhandledrejection| B
    C[应用各模块] -->|logCollector.log(level, module, msg)| B
    B -->|内存列表 ≤1000 条| D[(entries: LogEntry[])]

    E[用户点击"导出日志"按钮] --> F[LogExporter.export]
    F -->|读取| D
    F -->|遮盖凭据| G[mask]
    G -->|序列化为 JSONL| H[system-logs.jsonl]
    H -->|fflate.zip| I[ZIP Blob]
    I -->|<a download>| J[浏览器文件下载]

    K[settings.js renderSettings] -->|追加 export section| L[导出按钮 + 状态区域]
    L -->|click 事件| F
```

**数据流**：`LogCollector`（纯状态模块）在会话期间维护内存日志列表；`LogExporter`（纯函数模块）在触发时读取列表、遮盖、序列化、打包；`ExportController`（控制器模块）负责 UI 状态、按钮事件与超时管理；`settings.js` 在现有设置面板末尾注入导出 UI 区块。

## 组件与接口

### LogCollector（`src/features/export-logs/collector.js`）

纯状态模块，不依赖 DOM。工厂函数 `createLogCollector()` 返回收集器实例，全局单例 `logCollector` 由 `app.js` 在初始化时调用。

```js
// 接口
export function createLogCollector(options = {}) {
  // options.maxEntries?: number  默认 1000
  return {
    /** 初始化全局事件监听（window.onerror / unhandledrejection）*/
    init(),
    /** 追加一条日志 */
    log(level: 'debug'|'info'|'warn'|'error', module: string, message: string): void,
    /** 返回当前条目快照（浅拷贝数组）*/
    getEntries(): LogEntry[],
    /** 清空条目（单元测试用）*/
    clear(): void,
  };
}
export const logCollector = createLogCollector();

// LogEntry 结构
// { timestamp: string,  // ISO 8601 精确到毫秒
//   level: 'debug'|'info'|'warn'|'error',
//   module: string,     // 截断至 64 字符
//   message: string }   // 截断至 2048 字符
```

**关键行为**：
- `log()` 追加前先对 `message` 字段执行凭据遮盖（`maskCredentials`）。
- 超过 `maxEntries` 时移除最旧一条（FIFO）。
- `init()` 在 `window.onerror` 触发时调用 `log('error', 'window', …)`，在 `unhandledrejection` 触发时调用 `log('error', 'promise', …)`；幂等，重复调用不重复注册。

### LogExporter（`src/features/export-logs/exporter.js`）

序列化与遮盖函数不持有状态；导出函数负责异步压缩与临时下载 DOM 的创建、清理。

```js
export async function exportLogs(entries, options = {}) {
  // options.now?: () => Date  默认 () => new Date()
  // 返回 { ok: true } 或 { ok: false, reason: string }
}

export function maskCredentials(text) {
  // 将 sk-<1-200 非空白字符> 和 Bearer <1-500 非空白字符> 替换为 [REDACTED]
  // 返回处理后的字符串
}

export function serializeEntries(entries) {
  // 返回 JSONL 字符串（每条 JSON 对象 + \n，末尾无多余换行）
  // 若 entries 为空返回空字符串 ''
}

export function buildFilename(now) {
  // 返回 'wc2026-logs-YYYYMMdd-HHmmss.zip' 格式字符串
}
```

**关键行为**：
- `exportLogs` 对每条 entry 的字符串字段（含嵌套请求元数据）再次调用 `maskCredentials`（防止 collector 层面遗漏的运行时追加场景）。
- ZIP 中仅包含 `system-logs.jsonl` 一个文件，无子目录。
- 下载通过创建临时 `<a download>` 元素 + `.click()` 触发，完成后调用 `URL.revokeObjectURL()`。
- `localStorage` 中键名以 `model_` 为前缀或精确匹配 `apiKey`、`secretKey`、`accessToken` 的条目**不**写入 ZIP。

### ExportController（`src/features/export-logs/controller.js`）

控制器，负责将 `exportLogs` 与 DOM 元素绑定、管理按钮禁用状态、超时与进度刷新。

```js
export function initExportButton(buttonEl, statusEl, options = {}) {
  // options.collector?   默认 logCollector
  // options.timeout?     默认 60000 ms
  // options.progressInterval? 默认 1500 ms
  // 返回 dispose 函数
}
```

**关键行为**：
- 点击后立即禁用按钮，启动进度刷新计时器（≤2 s 间隔）。
- 超过 `timeout`（60 s）则中止，显示超时错误，恢复按钮。
- `exportLogs` resolve 后 ≤500 ms 内恢复按钮。
- `dispose()` 移除事件监听，清除计时器。

### Settings 集成（`src/features/chat/settings.js`）

在 `renderSettings` 函数末尾、`container.appendChild(wrap)` 之前，追加导出 UI 区块：

```js
// 追加到 wrap（已有的 .chat-settings 容器）
const exportSection = renderExportSection();  // 返回 HTMLElement
wrap.appendChild(exportSection);
```

`renderExportSection()` 位于新文件 `src/features/export-logs/export-ui.js`，使用 `t('exportLogs.button')` 等 i18n key，创建按钮和状态区域，调用 `initExportButton()`。这样对 `settings.js` 的改动最小，易于独立测试。

### 国际化词条

在 `public/i18n/zh.json` 和 `public/i18n/en.json` 中新增：

| 词条 | 中文 | 英文 |
|---|---|---|
| `exportLogs.button` | 导出日志 | Export Logs |
| `exportLogs.exporting` | 正在打包… | Packaging… |
| `exportLogs.done` | 下载已触发 | Download triggered |
| `exportLogs.timeout` | 导出超时，请重试 | Export timed out, please retry |
| `exportLogs.unsupported` | 当前浏览器不支持此功能 | This browser does not support this feature |
| `exportLogs.errorPrefix` | 导出失败：| Export failed: |
| `exportLogs.maskError` | 导出因安全检查失败而终止 | Export aborted: security check failed |

## 数据模型

### LogEntry

```ts
interface LogEntry {
  timestamp: string;   // ISO 8601，精确到毫秒，例如 "2026-06-11T14:30:00.123Z"
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string;      // 收集时截断至 64 字符
  message: string;     // 收集时截断至 2048 字符，凭据已遮盖
}
```

### JSONL 文件格式（`system-logs.jsonl`）

每行一个 `LogEntry` 的 JSON 序列化，行间以 `\n` 分隔，文件末尾不追加换行。空列表时文件大小为 0 字节。

```
{"timestamp":"2026-06-11T14:30:00.123Z","level":"info","module":"app","message":"init"}
{"timestamp":"2026-06-11T14:30:01.456Z","level":"warn","module":"chat","message":"..."}
```

### ZIP 包结构

```
wc2026-logs-20260611-143001.zip
└── system-logs.jsonl
```

无子目录，无其他文件。

### 凭据遮盖规则

| 模式 | 替换为 |
|---|---|
| `sk-` 后跟 1–200 个非空白字符 | `[REDACTED]` |
| `Bearer ` 后跟 1–500 个非空白字符 | `[REDACTED]` |

遮盖后原字符串其余内容保持不变。

## 正确性属性

属性描述所有有效输入应满足的不变式，并通过生成输入反复验证。

### 属性 1: 追加条目保持有序且满足结构约束

对于任意 合法的 `(level, module, message)` 参数组合，调用 `log()` 后，`getEntries()` 返回的最后一条条目的 `level`、截断后的 `module`、截断后的 `message` 字段必须与输入一致，且 `timestamp` 字段必须是合法的 ISO 8601 字符串。

**验证需求： 1.2**

### 属性 2: 日志列表长度上限不变式

对于任意 `N`（`N ≥ 1`）次 `log()` 调用序列，`getEntries()` 返回的数组长度永远不超过 `maxEntries`（默认 1000）；当 `N > maxEntries` 时，最先追加的条目被优先丢弃，最后 `maxEntries` 条条目的相对顺序不变。

**验证需求： 1.5**

### 属性 3: 收集时凭据遮盖不变式

对于任意 包含匹配凭据模式（`sk-…` 或 `Bearer …`）子字符串的 `message`，调用 `log()` 后，`getEntries()` 中该条目的 `message` 字段必须不包含原始凭据子字符串，且必须在对应位置包含 `[REDACTED]`，其余内容保持不变。

**验证需求： 1.6**

### 属性 4: JSONL 序列化往返

对于任意 `LogEntry` 数组（包含空数组），`serializeEntries(entries)` 生成的字符串被按 `\n` 分割后逐行 `JSON.parse()`，所得对象数组在 `timestamp`、`level`、`module`、`message` 四个字段上必须与原始数组完全一致。

**验证需求： 3.1, 5.4**

### 属性 5: 导出序列化阶段凭据遮盖不变式

对于任意 包含匹配凭据模式子字符串（`sk-…` 或 `Bearer …`）的条目批次，经 `exportLogs` 序列化后写入 JSONL 的内容必须不包含任何原始凭据子字符串，且对应位置包含 `[REDACTED]`。

**验证需求： 5.1**

### 属性 6: localStorage 凭据键不写入 ZIP

对于任意 `localStorage` 状态，`exportLogs` 生成的 ZIP 内容（读取 `system-logs.jsonl` 文本）必须不包含键名以 `model_` 为前缀或精确匹配 `apiKey`、`secretKey`、`accessToken` 的 `localStorage` 条目的值。

**验证需求： 5.2**

## 错误处理

| 错误场景 | 处理方式 |
|---|---|
| `fflate` 压缩抛出异常 | 捕获，向用户显示错误提示（含失败原因），不触发下载，不清空内存日志 |
| `JSON.stringify` 序列化失败 | 视为 ZIP 构建失败，同上 |
| 凭据遮盖阶段抛出异常 | 中止导出，显示 `exportLogs.maskError` 提示，不生成 ZIP |
| 导出超过 60 s | `ExportController` 通过 `AbortController` 信号中止，显示 `exportLogs.timeout` 提示，恢复按钮 |
| 浏览器不支持 `Blob` 或 `URL.createObjectURL` | 页面加载完成后检测，立即禁用按钮并显示 `exportLogs.unsupported` 文字 |
| `URL.revokeObjectURL` 失败 | 静默忽略（不影响用户体验） |

**内存日志条目在任何错误路径下均不丢失**：`exportLogs` 读取的是 `getEntries()` 的快照拷贝，不改变收集器内部状态。

## 测试策略

### 测试框架

延续项目现有方案：**Vitest**（单元/属性测试）+ **jsdom** 环境 + **Playwright**（端到端）。属性测试使用 [fast-check](https://github.com/dubzzz/fast-check)（通过 npm devDependency 引入）。

### 单元测试（示例 + 边界）

位于 `tests/export-logs-collector.test.js`、`tests/export-logs-exporter.test.js`、`tests/export-logs-controller.test.js`：

- **初始化**：`getEntries()` 在 `init()` 前后均返回 `[]`（需求 1.1）
- **全局错误监听**：模拟 `window.onerror` 事件，验证追加 `error` 级条目并包含文件名与行号（需求 1.3）
- **Promise 拒绝监听**：模拟 `unhandledrejection` 事件，验证追加 `error` 级条目（需求 1.4）
- **空列表导出**：`exportLogs([])` 生成 0 字节 `system-logs.jsonl`，不显示错误（需求 3.5）
- **文件名格式**：给定固定时间戳，验证输出文件名匹配 `wc2026-logs-YYYYMMdd-HHmmss.zip`（需求 3.2）
- **下载机制**：验证创建 `<a download>` 元素、调用 `.click()` 并随后调用 `URL.revokeObjectURL()`（需求 3.3）
- **超时处理**：使用 `vi.useFakeTimers()` 推进 60 s，验证导出中止、错误提示、按钮恢复（需求 2.5）
- **浏览器能力检测**：模拟缺失 `Blob`，验证按钮禁用和说明文字（需求 4.3）
- **凭据遮盖失败中止**：mock `maskCredentials` 抛出，验证导出中止（需求 5.3）

### 属性测试（fast-check）

**配置**：每个属性测试最少 100 次迭代，标注格式 `Feature: export-logs, Property N: <property_text>`。

**Property 1 实现要点**（追加结构约束）：
- Arbitraries：`fc.constantFrom('debug','info','warn','error')`、`fc.string({maxLength:100})`、`fc.string({maxLength:3000})`
- 断言：`module` 在条目中被截断至 ≤64 字符，`message` 截断至 ≤2048 字符，`timestamp` 通过 `Date.parse` 返回非 NaN
- 标注：`// Feature: export-logs, Property 1: append preserves structure invariants`

**Property 2 实现要点**（长度上限不变式）：
- Arbitraries：`fc.integer({min:1, max:2000})` 控制追加次数，`fc.string()` 生成消息
- 断言：`getEntries().length <= 1000`，当 `N > 1000` 时最后追加的条目仍在列表中
- 标注：`// Feature: export-logs, Property 2: list length cap invariant`

**Property 3 实现要点**（收集时遮盖）：
- Arbitraries：`fc.string()` 生成前缀/后缀，`fc.string({minLength:1,maxLength:200,charset:'printable-no-whitespace'})` 生成密钥体，拼接成 `sk-{key}` 嵌入消息
- 断言：存入条目的 `message` 不包含 `sk-{key}`，包含 `[REDACTED]`
- 标注：`// Feature: export-logs, Property 3: credential masking invariant at collection`

**Property 4 实现要点**（JSONL 往返）：
- Arbitraries：`fc.array(fc.record({timestamp:fc.date().map(d=>d.toISOString()), level:fc.constantFrom('debug','info','warn','error'), module:fc.string({maxLength:64}), message:fc.string({maxLength:2048})}))`
- 断言：往返后四个字段逐一 strict equal
- 标注：`// Feature: export-logs, Property 4: JSONL serialization round-trip`

**Property 5 实现要点**（导出序列化遮盖）：
- 与 Property 3 类似，但在 `exportLogs` 返回的 JSONL 文本上断言（通过 mock fflate 捕获写入内容）
- 标注：`// Feature: export-logs, Property 5: credential masking invariant at export`

**Property 6 实现要点**（localStorage 凭据键不写入）：
- Arbitraries：`fc.array(fc.oneof(fc.tuple(fc.string().map(s=>'model_'+s), fc.string()), fc.constantFrom(['apiKey','secretKey','accessToken'].map(k=>[k,fc.string()])).chain(x=>x)))` 生成若干敏感键值对，注入 mock localStorage
- 断言：捕获 JSONL 内容，不包含任何这些值
- 标注：`// Feature: export-logs, Property 6: sensitive localStorage keys excluded from ZIP`

### 端到端测试

在 `e2e/export-logs.spec.js` 中：
- 打开 `/?mock`（启用 mock 模式避免真实 API 请求），打开聊天面板，进入设置面板，验证"导出日志"按钮存在。
- 点击按钮，拦截文件下载（Playwright `page.waitForEvent('download')`），验证下载文件名匹配正则 `/^wc2026-logs-\d{8}-\d{6}\.zip$/`。
- 验证下载触发后按钮恢复可用状态。

### 覆盖率目标

针对本次新增的 `collector.js`、`exporter.js`、`export-ui.js` 中可执行业务逻辑，单元测试行覆盖率目标 ≥80%。纯 i18n 键声明和 DOM 样式属性赋值可排除分母，说明理由。

## 续做实现说明（2026-11-17）

- ZIP 采用 `fflate.zip` 异步压缩；控制器传入 `AbortSignal`，超时或面板销毁时终止压缩。旧任务结果不能覆盖新任务，重复初始化会清理旧监听。
- 对日志全部字段（含嵌套请求元数据）复制并遮盖；循环结构或字段读取异常按安全检查失败中止。超长凭据整段遮盖，避免只遮盖前缀后遗留尾部。不读取 localStorage。
- 下载链接阻止点击冒泡，避免触发现有聊天面板的外部点击关闭逻辑；成功或失败均清理临时链接和对象 URL。
- 失败原因使用双语安全文案，避免把异常消息中的潜在凭据重新展示出来。状态区域使用 `role="status"`；设置面板重建或关闭时调用清理函数。
- 属性测试解压真实 ZIP 检查内容，替代原建议的压缩函数模拟；测试仍调用生产导出逻辑。覆盖率按新增功能四个实现模块的可执行行计算，包含控制器与 UI 逻辑，不排除样式赋值。
