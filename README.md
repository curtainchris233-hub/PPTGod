<div align="center">

# PPTGod v7

**丢入 PDF / Word / TXT，一站式推荐风格 · 生成提示词 · 自动整理出可编辑 PPT**

玻璃拟态 + 轻拟态可视化 PPT 提示词画廊 · 资料直通车智能引擎 · 6 大 AI 生态领域编译器 · 100 分智能体检 · 演讲排练驾驶舱

![Next.js 16](https://img.shields.io/badge/Next.js-16.4-172033?style=flat-square&logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-172033?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-2563EB?style=flat-square&logo=typescript&logoColor=white)
![Vanilla CSS](https://img.shields.io/badge/CSS-100%25%20Vanilla%20CSS%20Glass%2FNeu-2563EB?style=flat-square)
![SQLite WAL](https://img.shields.io/badge/SQLite-WAL%20Mode-0D9488?style=flat-square&logo=sqlite&logoColor=white)
![E2E Tests](https://img.shields.io/badge/E2E%20Tests-103%2F103%20PASS-15803D?style=flat-square)
![Docker Ready](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED?style=flat-square&logo=docker&logoColor=white)

<br />

<img src="./docs/showcase/00-hero-overview.png" alt="PPTGod v7 玻璃拟态 + 资料直通车全景视觉总览" width="100%" />

</div>

---

## 产品定位与核心价值

**PPTGod** 是一个基于 **Next.js 16 (App Router) + React 19 + TypeScript + 100% 纯 Vanilla CSS（玻璃拟态 + 轻拟态）+ SQLite (`better-sqlite3`, WAL) + `pptxgenjs` + `mammoth` + `unpdf`** 构建的全栈开源平台，采用**「资料直通车智能解析」+「可视化选词与跨生态领域编译」+「结构化高保真在线生成与排练」**三核架构：

- **丢入资料一步直达（v7 资料直通车）**：在首页或工坊拖入任意 **PDF / Word (`.docx`) / TXT / Markdown / 旧 `.pptx`** 或直接粘贴笔记，系统即时识别 15 类汇报场景并提炼核心数字指标与章节结构，一步联动三大结果：**① 实时 16:9 画布推荐 Top 3 最佳风格**、**② 融合真实文档素材编译 6 大 AI 工具专属提示词**、**③ 一键交接 `/generate` 自动整理生成整套可编辑 `.pptx`**。
- **玻璃拟态 + 轻拟态与克制 AI 视觉体验**：全站采用大圆角半透明毛玻璃面板、双光柔和阴影与内凹轻拟态交互控件，局部以极简 SVG 数据流线条、神经网络节点与柔和粒子光点轻度点缀，视觉通透聚焦而不杂乱。
- **所见即所得，告别“盲猜提示词”**：内置 **36 套全领域精选设计系统 × 20 种版式原型 × 16 种装饰纹理 × 12 种页型**，覆盖商业科技、教师课堂、科研基金、项目政务与生活纪实全场景，所有卡片均以真实 **16:9 幻灯片画布**实时渲染。
- **跨工具零损耗交付 & 零外部付费依赖**：既可一键编译适配 **Claude HTML / Gamma / Kimi / NotebookLM / 即梦生图 / Slidev / Python-PPTX**，也可在站内经 **100 分制智能设计体检**与纯前端 Canvas **以图生风格**后直出原生 **`.pptx`**、离线 **`.html` / PDF**、可运行 **Marp `.md`** 与可移植 **`.pptgod.json`** 风格包，支持 `npm run dev` 与 `docker compose up` 开箱即用。

---

## 网站核心功能演示效果图

[界面设计规范 · 冰川白工作台（含首页改版对照图）](./docs/PPTGod_UI_Design_Spec.md)

### 1. 资料直通车（v7）· 丢入 PDF / Word / TXT 推风格 · 出词 · 直出 PPT

在首页右侧 Hero 区或 `/generate` 工坊直接拖入文档（亦内置 3 份典型示例资料与纯文本粘贴模式），自动识别科研基金、公开课教案、商业复盘等 15 类场景并提炼量化数据与章节骨架，实时渲染 Top 3 推荐风格（可一键送入 `/compare` 并排对比）、生成注入源文档真实内容的 6 大 AI 工具提示词，或一键跳转 `/generate?intake=1` 自动整理生成整套 16:9 幻灯片。

<p align="center">
  <img src="./docs/showcase/06-doc-intake-hub.png" alt="PPTGod v7 资料直通车：丢入文档自动推荐 Top 3 风格、生成融合提示词与一键整理成 PPT 演示效果" width="100%" />
</p>

### 2. 首页视觉画廊 · 36 套全领域设计系统与 5 大人群导航

支持全局输入主题实时刷新全部 36 张 16:9 风格画布、按 5 大人群领域与 15 类场景筛选、首页卡片直切全部 12 种页型，以及 6 目标「30 秒智能选词顾问」。

<p align="center">
  <img src="./docs/showcase/01-gallery-5-domains.png" alt="首页视觉画廊与 5 大人群领域导航演示效果" width="100%" />
</p>

### 3. 交互式提示词工作室 · 领域专属母版与 6 大 AI 生态编译

面向教师授课与科研基金等高专业度场景，提供护眼黑板粉笔板书、*Nature Methods* Okabe-Ito 色盲安全科研证据流、国自然 NSFC 蓝红答辩等真实规范母版；编译器自动按领域注入教学闭环铁律、科研零幻觉红线（缺失数据强制占位 `[待补实验数据]`）、PMO 管控与 STAR 述职规范，并支持 5 维视觉透视、动态 `1200×630` OG 社交预览卡与 `.pptgod.json` 导出。

<p align="center">
  <img src="./docs/showcase/02-studio-domains-showcase.png" alt="交互式提示词工作室：黑板粉笔板书与 Nature Okabe-Ito 科研证据流演示效果" width="100%" />
</p>

### 4. 并排风格对比台 · 20 种原生版式 × 16 种纹理三端 1:1 渲染

将 2–3 套心仪风格置于同一画布下，同步切换全部 12 种页型并注入你的真实汇报题目；所有 20 种版式原型与 15 种非空装饰纹理在浏览器画布、原生 `.pptx` 与离线 `.html` 三端保持 1:1 视觉一致。

<p align="center">
  <img src="./docs/showcase/03-compare-archetypes.png" alt="并排风格对比台：政务红金、PMO 红黄绿看板与柯达 35mm 胶片手账对比效果" width="100%" />
</p>

### 5. 在线生成工坊（100 分智能体检 + 自定义机构页脚）& 以图生风格

- **在线工坊（`/generate`）**：支持上传 `.pdf` / `.docx` / 存量 `.pptx` 逆向翻新 / `.md` / `.txt`（最大 10MB）并展示行内 Top 3 智能推荐风格条，提供 7 套全领域实景预设、5 领域 `<optgroup>` 分组换肤、两步可控大纲（5–20 页）、自定义机构/课程/实验室页脚署名（三端同步）及 **100 分制智能体检**（投影对比度、字数防溢出、版式节奏、一键补齐讲稿）。
- **以图生风格（`/create`）**：上传任意心仪海报或 PPT 截图，纯浏览器端 Canvas 毫秒级量化提取 8 色 + 4 阶图表色板并自动达标 WCAG 2.1 AA/AAA 可读性，零隐私上传。

<p align="center">
  <img src="./docs/showcase/04-generate-audit-and-extract.png" alt="在线 PPT 生成工坊 100 分智能体检与以图生风格取色演示效果" width="100%" />
</p>

### 6. 纯净演播分享页与演讲排练提词驾驶舱（`/deck/[id]`）

公开保存的文稿可一键生成暗场 16:9 演播分享链接（私有文稿对非作者严格返回 `404` 零泄露）；按 **`P` 键**即刻进入分屏演讲排练驾驶舱，内置正计时与 **5 分钟路演 / 10 分钟国自然答辩 / 15 分钟公开课 / 30 分钟汇报** 倒计时（剩余 < 20% 琥珀预警、超时红灯）、`A-/A+` 大字号提词稿与下一页 16:9 实时缩略预告。

<p align="center">
  <img src="./docs/showcase/05-rehearsal-cockpit.png" alt="/deck/[id] 纯净演播分享与演讲排练提词驾驶舱演示效果" width="100%" />
</p>

---

## 36 套全领域精选风格覆盖矩阵

| 人群领域 | 覆盖场景 | 代表风格与专属设计规范 |
| --- | --- | --- |
| **商业与科技**（11 套） | 产品发布、商业路演、品牌提案、技术分享 | 苹果柔光 Bento、暗夜星环 Keynote、瑞士网格、工业控制论橙黑、北欧静奢、巴黎高定画册、包豪斯几何 |
| **教师与课堂**（5 套） | 课堂教学、教育培训 | 墨绿护眼黑板粉笔板书（`chalkboard-class`）、K12 马卡龙绘本、STEAM 工程方格探究本、公开课青瓷说课、结构化企业内训 |
| **科研与学术**（6 套） | 科研基金、学术答辩 | 国自然 NSFC 蓝红基金答辩、*Nature Methods* Okabe-Ito 色盲安全科研（`scientific-figure`）、顶会组会精读、人文社科档案、临床医药、LaTeX 顶刊 |
| **项目与职场**（9 套） | 项目汇报、咨询汇报、政务党建、个人述职、年度总结 | PMO 红黄绿里程碑看板（`pmo-rag-grid`）、丹宸鎏金政务红金（`civic-redgold`）、Linear 敏捷 OKR、麦肯锡高管洞察、华尔街金融终端、STAR 晋升述职、ESG 绿色精益 |
| **生活与个人**（7 套） | 生活纪实、文化创意、个人述职 | 柯达 35mm 胶片手账游记（`polaroid-zine`）、香槟鼠尾草婚礼纪念、独立书店读书沙龙、牛油果极简生活、宋韵新中式、莫兰迪作品集 |

---

## 系统架构与安全防线

```mermaid
flowchart LR
    D["资料直通车 (v7)\nPDF / Word / TXT / PPTX"] --> A["15 场景语义分析\nTop 3 推风格 · 指标/章节提炼"]
    A --> C["6 大 AI 生态提示词编译器\n融合源文档素材 + 领域铁律"]
    A --> E["/generate?intake=1 工坊\n一键自动整理 PPT + 100 分体检"]
    B["VisualSpec 设计引擎\n36 风格 · 20 原型 × 16 纹理 · WCAG"] --> E
    E --> F["三端 1:1 交付\n原生 .pptx / 离线 .html / Marp .md"]
    E --> G["/deck/[id] 演播与排练驾驶舱\n倒计时 + 提词稿 + 下一页预告"]
    E --> H[("SQLite WAL 持久化\n深层校验 · SSRF 防护 · 限流")]
```

- **深层 `VisualSpec` 强校验**：严格校验所有 CSS 色值、4 色图表元组、20 原型 / 16 纹理枚举、圆角 `[0, 32]` 与 `brandFooter` 纯文本防 XSS。
- **BYOK SSRF 与权限隔离**：拦截云元数据地址、RFC1918/IPv6 内网段与混淆 IP；登录/注册 `429` 限流；私有风格与私有文稿在 SSR、API、OG 图像与 `/sitemap.xml` 全链路严格零泄露。

---

## 本地运行、Docker 部署与全栈测试

### 1. 本地开发运行

```bash
npm install
npm run dev
```

首次启动自动在 `./data/pptgod.db`（WAL 模式）初始化数据库并幂等写入 **36 套全领域精选风格**、3 个种子账号（内置体验账号：`demo@pptgod.studio` / `demo1234`）与 5 条初始实测评价。

### 2. Docker Compose 一键自托管部署

```bash
docker compose up -d --build

# 验证生产探活端点
curl http://localhost:3000/api/health
```

### 3. 生产构建与 103 条全栈黑盒端到端测试

```bash
# 静态类型、React 19 严格 ESLint 与生产构建
npx tsc --noEmit --incremental false
npm run lint
npm run build
npx next start --port 3000

# 运行覆盖 Tiers 1–9 的 103 条全栈端到端黑盒测试（含 SQLite WAL 数据卫生审计）
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright python3 tests/e2e/run_e2e.py \
  --base-url http://localhost:3000 --tier all --backup-db
```
