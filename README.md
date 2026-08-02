# 2026 FIFA World Cup | 2026年世界杯网站

一个现代化的2026年FIFA世界杯赛事信息网站，包含从小组赛到决赛的全部104场比赛赛程、比分、进球和红黄牌详情。

## 功能特性

- **完整赛程**：104场比赛（72场小组赛 + 32场淘汰赛），按阶段和小组分类筛选
- **比赛详情**：点击任意比赛查看比分、进球时间线、红黄牌信息、球场和裁判
- **小组积分榜**：12个小组的完整积分排名
- **淘汰赛对阵图**：从三十二强到决赛的完整对阵树
- **球队详情**：48支参赛球队的统计数据、队内射手榜和比赛列表
- **冠军与奖项**：冠军、亚军、季军、金球奖、金靴奖、金手套奖、最佳新人、公平竞赛奖
- **中英文切换**：一键切换中文/英文界面
- **深色主题**：现代化深色调设计，玻璃质感、发光效果、流畅动画

## 技术栈

- 纯 HTML / CSS / JavaScript（无框架、无构建步骤）
- ES Modules 模块化架构
- Hash 路由实现单页应用
- CSS 变量驱动的设计系统
- JSON 静态数据文件
- 响应式设计，支持移动端

## 项目结构

```
WorldCup2026/
├── index.html              # 入口文件
├── css/
│   ├── tokens.css          # 设计变量（颜色、间距、动效）
│   ├── base.css            # 基础样式、顶栏、布局
│   ├── components.css      # 可复用组件（卡片、表格、时间线等）
│   └── pages.css           # 页面专属样式
├── js/
│   ├── app.js              # 应用入口、路由注册、导航
│   ├── router.js           # Hash 路由
│   ├── store.js            # 数据访问层
│   ├── i18n.js             # 国际化引擎
│   ├── utils.js            # 工具函数（日期、旗帜、图标等）
│   └── views/
│       ├── home.js         # 首页
│       ├── schedule.js     # 赛程页
│       ├── match-detail.js # 比赛详情页
│       ├── group-standings.js  # 积分榜页
│       ├── bracket.js      # 淘汰赛对阵图页
│       ├── teams.js        # 球队列表页
│       ├── team-detail.js  # 球队详情页
│       ├── awards.js       # 奖项页
│       └── not-found.js    # 404页面
├── data/
│   ├── matches.json        # 104场比赛数据（含进球、红黄牌）
│   ├── teams.json          # 48支球队信息
│   ├── venues.json         # 球场信息
│   ├── standings.json      # 12个小组积分榜
│   ├── bracket.json        # 淘汰赛对阵结构
│   ├── awards.json         # 冠军与个人奖项
│   └── groups.json         # 小组信息
└── i18n/
    ├── zh.json             # 中文翻译
    └── en.json             # 英文翻译
```

## 如何运行

由于使用了 ES Modules 和 fetch 加载 JSON 数据，需要通过 HTTP 服务器运行（不能直接用 `file://` 打开）。

**Python:**
```bash
python -m http.server 5120
```

**Node.js:**
```bash
npx serve -l 5120
```

然后打开浏览器访问 `http://localhost:5120`。

## 数据来源

比赛数据来源于 Wikipedia 的 2026 FIFA World Cup 相关页面，通过 MediaWiki API 采集并解析 wikitext 模板生成结构化 JSON 数据。

## 赛事概况

- **举办地**：美国、加拿大、墨西哥
- **参赛队伍**：48支
- **比赛场次**：104场
- **赛制**：12个小组（每组4队）→ 三十二强 → 十六强 → 四分之一决赛 → 半决赛 → 季军战 → 决赛
- **冠军**：西班牙（第二次夺冠）
