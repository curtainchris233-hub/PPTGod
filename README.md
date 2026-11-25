# PPTGod v5 — 全领域可视化 PPT 提示词画廊与全栈在线生成工作台

**PPTGod** 是一个基于 **Next.js 16 (App Router) + React 19 + TypeScript + 100% 纯 Vanilla CSS + SQLite (`better-sqlite3`, WAL) + `pptxgenjs` + `mammoth` + `unpdf`** 的全栈可视化 PPT 提示词与在线演示生成平台。

采用**「可视化选词 + 跨生态领域提示词编译」与「结构化高保真闭环在线生成 PPT」双核设计**：覆盖 **商业科技、教师课堂、科研基金、项目政务与生活纪实** 5 大人群领域、**36 套精选风格母版**。先在真实 **16:9 幻灯片画布** 上预览、对比、微调每套视觉提示词的 12 种页型，再无缝将调好的配色与主题带入在线工坊，上传文档或逆向导入存量 `.pptx` 一键翻新，直出高保真原生可编辑 **`.pptx`**、离线矢量打印 **`.html`**、可运行 **Marp / Slidev `.md`** 与纯净演播分享页 **`/deck/[id]`**。

## 核心能力一览（v5 全领域升级）

- **36 套全领域精选风格库 × 20 种版式原型 × 16 种装饰纹理 × 12 种页型**
  - **5 大人群领域一键切换**：首页新增「全部领域 / 商业与科技 / 教师与课堂 / 科研与学术 / 项目与职场 / 生活与个人」领域标签页与实时统计，同步驱动场景筛选与 6 大目标的「30 秒智能选词顾问」。
  - **新增 18 套真实标准调研级风格**：
    - **教师与课堂（+4）**：墨绿护眼黑板粉笔板书（`chalkboard-class` + `chalk-frame`）、K12 马卡龙绘本课堂、STEAM 工程方格探究本、公开课青瓷竞赛说课。
    - **科研与学术（+4）**：国自然 NSFC 基金答辩蓝红高辨识体系、*Nature Methods* Okabe-Ito 色盲安全科研证据流（`scientific-figure` + `citation-axis`）、顶会组会精读汇报、人文社科档案研讨。
    - **项目、政务与职场（+5）**：PMO 红黄绿里程碑风险看板（`pmo-rag-grid` + `status-dots`）、丹宸鎏金政务党建庄重汇报（`civic-redgold` + `redgold-ribbon`）、Linear 风格敏捷 Sprint & OKR、ESG 绿色精益制造、STAR 晋升述职与答辩。
    - **生活与个人（+5）**：柯达 35mm 胶片手账游记（`polaroid-zine` + `film-sprocket`）、香槟鼠尾草婚礼纪念、独立书店读书沙龙、牛油果极简生活指南、莫兰迪创意人作品集。
  - **全链路 1:1 渲染同步**：20 种版式原型与 15 种非空装饰纹理在浏览器 [`SlideCanvas`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/components/SlideCanvas.tsx)、原生 `.pptx`（[`pptxArchetypes.ts`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/lib/pptxArchetypes.ts)）与离线 `.html`（[`htmlExporter.ts`](file:///home/antigravity/curtainchris233-hub/PPTGod/src/lib/htmlExporter.ts)）三端完全一致。
- **领域自适应专业提示词编译器（`promptCompiler.ts`）**
  - 在原有 6 大 AI 工具（Claude HTML、Gamma/Kimi、NotebookLM、AI 整页生图含 6/12 页连贯词包、Slidev/Marp、Python-PPTX）基础上，按风格所属场景自动注入**领域专属专业铁律**：
    - 课堂教学：四段式教学闭环 + 后排可读大字号标准 + 课堂互动设问；
    - 科研基金/学术答辩：零数据幻觉红线（缺失数据强制占位 `[待补实验数据]`）+ 科学结论句式 + 对照/显著性标注；
    - PMO 项目汇报：首屏 RAG 红黄绿健康度 + Owner / ETA 风险闭环；
    - 政务党建：庄重对仗纲目 + 实绩数据支撑；
    - 个人述职：STAR 法则与个人核心主导贡献拆解；
    - 生活纪实：去公文腔松弛叙事与画面留白。
- **交互式提示词工作室（`/studio/[slug]`）与动态 OpenGraph 预览卡**
  - 12 页 4×3 可视化胶片预览、键盘方向键全屏演播、5 维提示词结构透视、**Studio → Generate 跨页无损承接**，以及基于 `next/og` 按真实 `VisualSpec` 实时渲染的 1200×630 PNG 社交卡片（私有模板严格返回 `404`）。
- **在线 PPT 生成与编辑工坊（`/generate`）**
  - **7 套全领域一键实景素材预设**：除 AI 产品发布、Q4 战略复盘与学术答辩外，新增**教师公开课说课**、**国自然 NSFC 基金项目答辩**、**PMO 财务中台上线复盘**与**冰岛胶片旅行游记** 4 套真实素材。
  - **多文档解析 + 存量 `.pptx` 逆向导入翻新**：支持 `.pdf`、`.docx`、`.pptx`、`.md`、`.txt`（最大 10MB，含 Zip-Bomb 配额防护），上传旧 `.pptx` 后自动反解大纲一键换肤重排。
  - **独立文稿品牌微调器（`DeckSpecTweaker`）+ 本地防丢草稿箱 + 两步可控大纲（5–20 页）+ 三合一单页配图 + Undo/Redo + 单页智能润色**。
  - **全格式高保真交付**：原生 `.pptx`（12/12 矢量配图几何零回退 + 原生图表 + 讲稿备注）、离线 `.html` / 矢量 PDF、以及真实文稿 Marp `.md` 与 Claude/Gamma 精准词导出弹窗。
- **纯净演播分享路由（`/deck/[id]`）与生产级安全防线**
  - 公开文稿支持暗场 16:9 剧场播放、`N` 键备注抽屉、下载与克隆编辑；私有文稿与私有风格对非作者严格 `404` 零泄露。
  - 全链路 `VisualSpec` 字段级校验（20 原型 / 16 纹理 / CSS 色值防注入）、BYOK SSRF 内网与云元数据拦截、登录/注册 `429` 限流、复制计数 5 秒去重与过期 Session 主动清理。

## 本地运行与测试

```bash
npm install
npm run dev
```

首次启动会自动在 `./data/pptgod.db`（WAL 模式）初始化数据库并幂等写入 **36 套全领域精选风格**、3 个种子账号（含体验演示账号 `demo@pptgod.studio` / `demo1234`）与 5 条初始实测评价。

### 生产构建与端到端测试

```bash
npx tsc --noEmit --incremental false
npm run lint
npm run build
npx next start --port 3000

# 运行覆盖 Tiers 1–7 的 93 条全栈黑盒端到端测试（含 v5 36 套全领域风格、5 领域导航、领域编译器与 5 新母版导出验收）
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright python3 tests/e2e/run_e2e.py --base-url http://localhost:3000 --tier all --backup-db
```