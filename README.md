# 2026 FIFA World Cup｜2026 年世界杯赛事网站

一个使用原生 JavaScript 构建的世界杯赛事信息单页应用。网站提供静态赛事数据浏览、全局搜索、中英文界面、主题切换，以及可选的 AI 赛事问答能力。

## 功能

- 104 场比赛的赛程、比分、进球、红黄牌、场馆与裁判信息
- 12 个小组积分榜、淘汰赛对阵图、球队详情和赛事奖项
- 全局搜索球队、比赛和球员；支持键盘导航
- 中文/英文切换、深浅主题和移动端布局
- AI 赛事问答：生产环境通过 Netlify Function 调用，`?mock` 可在无需密钥时演示界面

## 技术与架构

- 原生 HTML、CSS、JavaScript 与 ES Modules
- Vite 负责开发服务、生产构建和带内容哈希的资源输出
- Hash 路由与按页面分块加载
- 静态 JSON 赛事数据，客户端采用 Promise 缓存避免重复请求
- Netlify Functions 处理生产环境 AI 对话；可选 Upstash Redis 提供跨实例限流
- Vitest 数据契约测试、Playwright 端到端冒烟测试与 GitHub Actions 校验

## 快速开始

要求：Node.js 24 或更高版本。

```bash
npm install
npm run dev
```

Vite 会在终端输出本地访问地址。默认情况下，应用仅启动前端；生产 AI Function 不会在该命令中运行。

### 常用命令

```bash
npm run validate:data  # 校验静态数据、引用和双语词典
npm test               # 运行 Vitest 单元测试
npm run build          # 数据校验后构建到 dist/
npm run preview        # 预览构建产物
npm run test:e2e       # 运行 Playwright 冒烟测试
```

首次运行端到端测试时，如本机尚未安装浏览器，请执行：

```bash
npx playwright install chromium
```

### 本地调试 AI Function

前端界面演示可直接打开 `/?mock`。如需连同 Netlify Function 调试，请配置环境变量后使用 Netlify CLI：

```bash
npx netlify-cli dev
```

## 项目结构

```text
├── public/
│   ├── assets/                 # 会徽与国旗等静态资源
│   ├── data/                   # 赛事、球队、积分榜等 JSON 快照
│   └── i18n/                   # 中文与英文词典
├── src/
│   ├── app.js                  # 应用入口、导航与功能初始化
│   ├── views/                  # 路由页面
│   ├── features/search/        # 全局搜索
│   ├── features/chat/          # 聊天界面与本地 BYOK 模式
│   ├── shared/tournament-query/ # 浏览器与 Function 共用的数据归一化
│   └── styles/                 # 设计变量、基础样式和页面样式
├── netlify/functions/          # AI 对话、数据查询和限流 Function
├── scripts/validate-data.mjs   # 发布前数据契约校验
├── tests/                      # Vitest 测试
├── e2e/                        # Playwright 冒烟测试
└── netlify.toml                # 构建、缓存和安全响应头配置
```

## 部署与配置

Netlify 构建命令为 `npm run build`，发布目录为 `dist`。生产环境 AI 问答需要：

| 环境变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 是（仅 AI 问答） | DeepSeek API 密钥 |
| `DEEPSEEK_MODEL` | 否 | 模型名称，默认 `deepseek-v4-flash` |
| `CHAT_MAX_TOKENS` | 否 | 单次回答 token 上限，默认 800 |
| `CHAT_IP_DAILY_CAP` | 否 | 单 IP 每日额度，默认 60 |
| `CHAT_GLOBAL_DAILY_CAP` | 否 | 全站每日额度，默认 800 |
| `UPSTASH_REDIS_REST_URL` | 建议 | Upstash Redis 地址，用于持久限流 |
| `UPSTASH_REDIS_REST_TOKEN` | 建议 | Upstash Redis 访问令牌 |

未配置 Upstash 时，聊天服务仍保持可用，但无法提供跨 Serverless 实例的一致限流。

## 数据说明

赛事信息以仓库中的 `public/data/` JSON 静态快照为准，不提供实时比分或自动数据同步。更新数据时必须运行 `npm run validate:data`，确保比赛 ID、球队与场馆引用、积分榜数据及双语词典保持一致。

数据最初参考 2026 FIFA World Cup 相关公开资料整理，仅供学习和演示使用；请勿将其视为实时或官方比赛信息。

## 质量保障

每次推送和 Pull Request 都会运行 GitHub Actions：安装依赖、校验数据、构建应用、执行 Vitest 测试及 Playwright 冒烟测试。提交前建议至少执行：

```bash
npm run build
npm test
```
