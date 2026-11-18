# 实施计划： 一键导出系统日志（export-logs）

## 概述

按设计文档将功能分为四个层次依次实施：
1. `LogCollector`（纯状态模块）
2. `LogExporter`（纯函数模块）
3. `ExportController` + `ExportUI`（UI 与控制器模块）
4. 集成接入（i18n 词条、`app.js` 初始化、`settings.js` 注入）

每层完成后通过测试检查点验证，再推进下一层，确保无悬空代码。

---

## 任务

- [x] 1. 建立目录结构与凭据遮盖基础
  - 创建 `src/features/export-logs/` 目录（占位 `index.js` 仅做 re-export）
  - 在 `src/features/export-logs/exporter.js` 中实现 `maskCredentials(text)` 函数：
    - 将 `sk-` 后跟 1–200 个非空白字符的子字符串替换为 `[REDACTED]`
    - 将 `Bearer ` 后跟 1–500 个非空白字符的子字符串替换为 `[REDACTED]`
    - 其余内容保持不变；对非字符串输入不抛出异常
  - 在同文件中实现 `serializeEntries(entries)` 函数（JSONL，空数组返回空字符串）
  - 在同文件中实现 `buildFilename(now)` 函数（返回 `wc2026-logs-YYYYMMdd-HHmmss.zip`）
  - _需求: 1.6, 3.1, 3.2, 5.1_

  - [x] 1.1 实现 `maskCredentials`、`serializeEntries`、`buildFilename`
    - 仅含纯函数，无副作用，无 DOM 依赖
    - _需求: 1.6, 3.1, 3.2, 5.1_

  - [x]* 1.2 为 `maskCredentials` 编写属性测试（Property 3）
    - **属性 3：收集时凭据遮盖不变式**
    - **验证： 需求 1.6**
    - 使用 fast-check；文件：`tests/export-logs-exporter.test.js`
    - 标注：`// Feature: export-logs, Property 3: credential masking invariant at collection`

  - [x]* 1.3 为 `serializeEntries` 编写属性测试（Property 4）
    - **属性 4：JSONL 序列化往返**
    - **验证： 需求 3.1, 5.4**
    - 标注：`// Feature: export-logs, Property 4: JSONL serialization round-trip`

  - [x]* 1.4 为 `maskCredentials`、`serializeEntries`、`buildFilename` 编写单元测试
    - 验证 Bearer 遮盖、`sk-` 遮盖、空列表序列化、固定时间戳文件名格式
    - _需求: 1.6, 3.1, 3.2_

- [x] 2. 实现 LogCollector（`src/features/export-logs/collector.js`）
  - 工厂函数 `createLogCollector(options)` 返回带有 `init()` / `log()` / `getEntries()` / `clear()` 的对象
  - `log()` 在写入前调用 `maskCredentials`，截断 `module`（≤64 字符）和 `message`（≤2048 字符），时间戳使用 `new Date().toISOString()`
  - 超过 `maxEntries`（默认 1000）时 FIFO 丢弃最旧条目
  - `init()` 挂载 `window.onerror` 和 `unhandledrejection` 全局监听；幂等，重复调用不重复注册
  - 导出全局单例 `logCollector = createLogCollector()`
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.1 实现 `createLogCollector` 及全局单例
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x]* 2.2 为 `log()` 追加结构约束编写属性测试（Property 1）
    - **属性 1：追加条目保持有序且满足结构约束**
    - **验证： 需求 1.2**
    - 文件：`tests/export-logs-collector.test.js`
    - 标注：`// Feature: export-logs, Property 1: append preserves structure invariants`

  - [x]* 2.3 为长度上限不变式编写属性测试（Property 2）
    - **属性 2：日志列表长度上限不变式**
    - **验证： 需求 1.5**
    - 标注：`// Feature: export-logs, Property 2: list length cap invariant`

  - [x]* 2.4 为 LogCollector 编写单元测试
    - 覆盖：初始化后列表为空（需求 1.1）、`window.onerror` 触发追加 error 条目含文件名和行号（需求 1.3）、`unhandledrejection` 触发追加 error 条目（需求 1.4）、幂等性（重复 `init()` 不重复注册）
    - _需求: 1.1, 1.3, 1.4_

- [x] 3. 检查点——确保已有测试全部通过
  - 确保 `tests/export-logs-collector.test.js` 和 `tests/export-logs-exporter.test.js` 中的测试全部通过，如有问题向用户说明。

- [x] 4. 实现 `exportLogs` 函数（`src/features/export-logs/exporter.js`）
  - 引入 `fflate`（需要先确认或添加 npm 依赖）
  - `exportLogs(entries, options)` 流程：
    1. 对每条 entry 再次调用 `maskCredentials`（覆盖运行时追加场景）
    2. 调用 `serializeEntries` 生成 JSONL
    3. 用 `fflate.zip` 打包为 `system-logs.jsonl`，无子目录
    4. 创建临时 `<a download>` 元素触发下载，完成后调用 `URL.revokeObjectURL()`
    5. 不将 `localStorage` 中符合 `model_` 前缀或精确匹配 `apiKey`/`secretKey`/`accessToken` 键名的条目写入 ZIP
    6. 凭据遮盖失败时中止，返回 `{ ok: false, reason: 'maskError' }`；ZIP 失败时返回 `{ ok: false, reason: ... }`；成功时返回 `{ ok: true }`
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4_

  - [x] 4.1 添加 `fflate` npm 依赖并实现 `exportLogs`
    - 运行 `npm install fflate` 添加生产依赖
    - 实现完整 `exportLogs` 函数
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3_

  - [x]* 4.2 为导出序列化阶段凭据遮盖编写属性测试（Property 5）
    - **属性 5：导出序列化阶段凭据遮盖不变式**
    - **验证： 需求 5.1**
    - 解压真实 fflate ZIP，核对写入的 JSONL 内容
    - 标注：`// Feature: export-logs, Property 5: credential masking invariant at export`

  - [x]* 4.3 为 localStorage 凭据键排除编写属性测试（Property 6）
    - **属性 6：localStorage 凭据键不写入 ZIP**
    - **验证： 需求 5.2**
    - 标注：`// Feature: export-logs, Property 6: sensitive localStorage keys excluded from ZIP`

  - [x]* 4.4 为 `exportLogs` 编写单元测试
    - 覆盖：空列表导出生成 0 字节 `system-logs.jsonl`（需求 3.5）、文件名格式（需求 3.2）、`<a download>` 机制和 `URL.revokeObjectURL` 调用（需求 3.3）、凭据遮盖失败中止（需求 5.3）
    - _需求: 3.2, 3.3, 3.5, 5.3_

- [x] 5. 实现 ExportController（`src/features/export-logs/controller.js`）
  - `initExportButton(buttonEl, statusEl, options)` 绑定点击事件，管理按钮禁用/恢复、进度刷新和超时
  - 点击后立即禁用按钮，启动 ≤2 s 间隔的进度刷新计时器
  - `exportLogs` resolve 后 ≤500 ms 内恢复按钮并更新状态文本
  - 超过 60 s 通过 `AbortController` 中止，显示超时错误，恢复按钮
  - 返回 `dispose()` 函数，移除事件监听并清除计时器
  - _需求: 2.2, 2.3, 2.4, 2.5, 2.6, 4.1_

  - [x] 5.1 实现 `initExportButton` 及 `dispose`
    - _需求: 2.2, 2.3, 2.4, 2.5, 2.6, 4.1_

  - [x]* 5.2 为 ExportController 编写单元测试
    - 覆盖：超时处理（使用 `vi.useFakeTimers()` 推进 60 s）（需求 2.5）、导出完成后 ≤500 ms 恢复按钮（需求 2.4）、`dispose()` 清除计时器
    - 文件：`tests/export-logs-controller.test.js`
    - _需求: 2.4, 2.5_

- [x] 6. 实现导出 UI 组件（`src/features/export-logs/export-ui.js`）
  - `renderExportSection()` 创建包含按钮和状态区域的 `HTMLElement`
  - 使用 `t('exportLogs.button')` 等 i18n key
  - 页面加载后检测 `Blob` 和 `URL.createObjectURL` 支持；不支持时禁用按钮并显示说明（需求 4.2, 4.3）
  - 调用 `initExportButton(buttonEl, statusEl)` 完成绑定
  - _需求: 2.1, 2.2, 2.3, 4.2, 4.3_

  - [x] 6.1 实现 `renderExportSection`，含浏览器能力检测
    - _需求: 2.1, 2.2, 2.3, 4.2, 4.3_

  - [x]* 6.2 为浏览器不支持场景编写单元测试
    - 模拟缺失 `Blob`，验证按钮禁用和说明文字
    - 文件：`tests/export-logs-controller.test.js`
    - _需求: 4.2, 4.3_

- [x] 7. 检查点——确保所有单元与属性测试通过
  - 运行 `npm test`，确保所有 export-logs 相关测试通过，如有问题向用户说明。

- [x] 8. 新增 i18n 词条
  - 在 `public/i18n/zh.json` 新增以下词条：
    - `exportLogs.button`：导出日志
    - `exportLogs.exporting`：正在打包…
    - `exportLogs.done`：下载已触发
    - `exportLogs.timeout`：导出超时，请重试
    - `exportLogs.unsupported`：当前浏览器不支持此功能
    - `exportLogs.errorPrefix`：导出失败：
    - `exportLogs.maskError`：导出因安全检查失败而终止
  - 在 `public/i18n/en.json` 新增对应英文词条
  - _需求: 2.1, 2.3, 2.5, 2.6, 4.3_

  - [x] 8.1 同步更新 `zh.json` 和 `en.json`
    - _需求: 2.1, 2.3, 2.5, 2.6, 4.3_

- [x] 9. 集成接入：`settings.js` 注入与 `app.js` 初始化
  - 在 `src/features/chat/settings.js` 的 `renderSettings` 函数末尾（`container.appendChild(wrap)` 之前）追加：
    ```js
    import { renderExportSection } from '../export-logs/export-ui.js';
    // ...
    const exportSection = renderExportSection();
    wrap.appendChild(exportSection);
    ```
  - 在 `src/app.js` 的 `init()` 函数中初始化 `logCollector`：
    ```js
    import { logCollector } from './features/export-logs/collector.js';
    // 在 initI18n() 之后调用
    logCollector.init();
    ```
  - _需求: 1.1, 1.3, 1.4, 2.1_

  - [x] 9.1 修改 `settings.js` 注入导出区块
    - _需求: 2.1_

  - [x] 9.2 修改 `app.js` 调用 `logCollector.init()`
    - _需求: 1.1, 1.3, 1.4_

- [x] 10. 新增端到端测试（`e2e/export-logs.spec.js`）
  - 打开 `/?mock`，进入聊天面板设置，验证"导出日志"按钮存在
  - 点击按钮，拦截文件下载（`page.waitForEvent('download')`），验证文件名匹配 `/^wc2026-logs-\d{8}-\d{6}\.zip$/`
  - 验证下载触发后按钮恢复可用状态

  - [x] 10.1 编写 `e2e/export-logs.spec.js` 端到端测试
    - _需求: 2.1, 2.4, 3.2_

- [x] 11. 最终检查点——确保所有测试通过
  - 运行 `npm test`，确认无遗漏；对照设计文档确认 `collector.js`、`exporter.js`、`export-ui.js` 可执行业务逻辑行覆盖率 ≥80%，向用户说明结果。

## 说明

- 标有 `*` 的子任务为可选（属性测试和单元测试），可跳过以获得更快的 MVP；但所有非 `*` 子任务必须实施
- 属性测试需在 devDependencies 中添加 `fast-check`（`npm install --save-dev fast-check`），每个属性最少 100 次迭代
- 覆盖率指标：针对 `collector.js`、`exporter.js`、`export-ui.js` 中可执行业务逻辑，行覆盖率目标 ≥80%；纯 i18n 键声明和 DOM 样式属性赋值可排除分母
- 凭据遮盖在收集层（`collector.js`）和序列化层（`exporter.js`）各执行一次（双重防护），符合需求 1.6 和 5.1

## 任务依赖图

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "8.1"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "5.1"] },
    { "id": 5, "tasks": ["5.2", "6.1"] },
    { "id": 6, "tasks": ["6.2", "9.1", "9.2"] },
    { "id": 7, "tasks": ["10.1"] }
  ]
}
```

## 本轮验证（2026-11-17）

本轮完成原清单全部剩余任务（含可选测试），保留编号与 `tasks.meta.json` 中的历史记录。补齐元数据遮盖、真实取消、面板清理与下载点击冒泡隔离；没有待人工验收项。

- 全量单元回归：`npm test -- --maxWorkers=2`，32 个测试文件、319 项测试通过。
- 功能单元与属性测试：45 项通过；六组属性分别执行 100 次。新增缺陷测试先实际失败，再修复通过；不追溯宣称上一轮实现遵循测试先行。
- 行覆盖率：`collector.js` 24/24（100%）、`exporter.js` 41/42（97.61%）、`export-ui.js` 22/22（100%）、`controller.js` 27/28（96.42%）；合计 114/116（98.27%），均达到 80% 目标。仅转导出的 `index.js` 无可执行行。
- 覆盖率命令：`npx vitest run tests/export-logs-collector.test.js tests/export-logs-exporter.test.js tests/export-logs-controller.test.js --coverage --coverage.include=src/features/export-logs/*.js --maxWorkers=2`。
- `npm run build`（包含 `validate:data`）通过；`e2e/export-logs.spec.js` 4 项通过，验证双语、真实 ZIP、凭据遮盖、重复下载及按钮恢复。
- 全量浏览器回归：77 项通过、4 项失败。失败位于 `e2e/follow-teams.storage.spec.js`，其 `[role=status]` 同时匹配 `.follow-notice` 和 `#scheduleDateStatus`；日志面板未打开，不涉及新增日志状态区。本轮未修改该测试及已有关注球队改动，不能宣称全仓库浏览器测试全部通过。
