# PPTGod v6 — 全领域可视化 PPT 提示词画廊、智能体检与演讲排练全栈平台

**PPTGod** 是一个基于 **Next.js 16 (App Router) + React 19 + TypeScript + 100% 纯 Vanilla CSS + SQLite (`better-sqlite3`, WAL) + `pptxgenjs` + `mammoth` + `unpdf`** 的全栈可视化 PPT 提示词与在线演示生成平台。

采用**「可视化选词 + 跨生态领域提示词编译」与「结构化高保真闭环在线生成 + 演讲排练」双核设计**：覆盖 **商业科技、教师课堂、科研基金、项目政务与生活纪实** 5 大人群领域、**36 套精选风格母版**。支持上传参考图本地 Canvas 毫秒级**以图生风格**与 **WCAG 2.1 对比度守卫**、整套文稿 **100 分制智能设计体检**、自定义机构/课程页脚署名三端 1:1 同步、以及 `/deck/[id]` **演讲排练提词驾驶舱**，一键交付原生可编辑 **`.pptx`**、离线矢量打印 **`.html`**、可运行 **Marp / Slidev `.md`** 与可移植 **`.pptgod.json`** 风格包。

## 核心能力一览（v6 深度完善与生产就绪）

- **36 套全领域精选风格库 × 20 种版式原型 × 16 种装饰纹理 × 12 种页型**
  - **5 大人群领域紧凑导航与 6 目标智能选词**：首页提供「全部领域 / 商业与科技 / 教师与课堂 / 科研与学术 / 项目与职场 / 生活与个人」同排搜索与实时统计，联动场景胶囊与 6 目标 30 秒选词顾问。
  - **三端 1:1 渲染与自定义品牌署名（`brandFooter`）**：20 种版式原型（含黑板粉笔板书、Nature Okabe-Ito 色盲安全科研证据流、红金政务、PMO 红黄绿状态看板、柯达 35mm 胶片手账）、15 种非空装饰纹理以及自定义机构/课程/实验室页脚署名，在浏览器 [`SlideCanvas`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/components/SlideCanvas.tsx)、原生 `.pptx` 与离线 `.html` 三端完全一致。
- **以图生风格（Image-to-Style）+ WCAG 2.1 对比度守卫 + `.pptgod.json` 风格移植**
  - 在 `/create` 上传任意参考图或 PPT 截图，纯浏览器端 Canvas 量化引擎（[`paletteExtractor.ts`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/lib/paletteExtractor.ts)，零 API Key、零隐私上传）毫秒级自动提取 8 项色值与 4 阶图表色板并自动达标 WCAG AA/AAA 投影可读性。
  - 全链路接入实时 WCAG 对比度徽章与「一键校正对比度」；支持在 `/studio/[slug]` 导出 `.pptgod.json` 并在 `/create` 无损导入复用。
- **领域自适应专业提示词编译器（`promptCompiler.ts`）**
  - 适配 Claude HTML、Gamma/Kimi、NotebookLM、AI 整页生图（单页 / 6 页 / 12 页连贯词包）、Slidev/Marp、Python-PPTX 六大生态，自动按场景注入课堂教学、科研零幻觉（`[待补实验数据]`）、PMO RAG 管控、政务规范、STAR 述职与生活纪实专业铁律，并按域自动匹配工作室默认受众。
- **在线 PPT 生成、100 分制智能体检与编辑工坊（`/generate`）**
  - **7 套全领域实景素材预设**（商业、科技、学术、教师公开课、国自然 NSFC 基金、PMO 里程碑、冰岛胶片游记）+ **5 领域 `<optgroup>` 分组样式选择器**。
  - **整套 PPT 智能体检面板（[`deckLinter.ts`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/lib/deckLinter.ts)）**：从投影对比度、字数密度与防溢出、叙事起承转合、讲稿覆盖率四个维度实时打出 100 分制质量评分并估算演讲时长，支持点击直达问题页、一键补齐缺失讲稿（兼容 Undo/Redo）与一键修复低对比度。
  - **多文档解析 + 存量 `.pptx` 逆向导入翻新**：支持 `.pdf`、`.docx`、`.pptx`、`.md`、`.txt`（最大 10MB，内置 Zip-Bomb 配额防护），两步可控大纲（5–20 页）、三合一单页配图、本地防丢草稿箱与全格式导出。
- **演讲排练提词驾驶舱（`/deck/[id]`）与生产运维就绪**
  - 公开演播页新增 `P` 键分屏排练模式：左侧 16:9 主画布 + 右侧 **演播计时器**（正计时及 `5分 / 10分国自然答辩 / 15分课堂 / 30分汇报` 倒计时预设，剩余 < 20% 与超时自动变色提醒）+ **A-/A+ 可调字号大字提词稿** + **下一页 16:9 实时缩略预告**。
  - **生产部署与安全防线**：内置多阶段 [`Dockerfile`](file:///home/antigravity/curtainchris233-hub/PPTGod/Dockerfile)、[`docker-compose.yml`](file:///home/antigravity/curtainchris233-hub/PPTGod/docker-compose.yml)、[`GET /api/health`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/app/api/health/route.ts) 探针、隐私零泄露动态 [`/sitemap.xml`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/app/sitemap.ts) 与 [`/robots.txt`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/app/robots.ts)、GitHub Actions CI（[`.github/workflows/ci.yml`](file:///home/antigravity/curtainchris233-hub/PPTGod/.github/workflows/ci.yml)），以及深层 `VisualSpec` 校验、BYOK SSRF 防护与登录限流。

## 本地运行与 Docker 一键部署

### 本地开发

```bash
npm install
npm run dev
```

首次启动自动在 `./data/pptgod.db`（WAL 模式）初始化并幂等写入 **36 套全领域精选风格**、3 个种子账号（内置体验账号 `demo@pptgod.studio` / `demo1234`）与 5 条初始实测评价。

### Docker Compose 一键自托管部署

```bash
docker compose up -d --build
# 验证健康探针
curl http://localhost:3000/api/health
```

### 生产构建与 99 条全栈端到端测试

```bash
npx tsc --noEmit --incremental false
npm run lint
npm run build
npx next start --port 3000

# 运行覆盖 Tiers 1–8 的 99 条全栈黑盒端到端测试（含 v6 以图生风格、100分体检、品牌页脚、排练驾驶舱与 Health/Sitemap 隐私验收）
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright python3 tests/e2e/run_e2e.py --base-url http://localhost:3000 --tier all --backup-db
```