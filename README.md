# PPTGod v4 — 可视化 PPT 提示词画廊与全栈在线生成工作台

**PPTGod** 是一个基于 **Next.js 16 (App Router) + React 19 + TypeScript + 100% 纯 Vanilla CSS + SQLite (`better-sqlite3`, WAL) + `pptxgenjs` + `mammoth` + `unpdf`** 的全栈可视化 PPT 提示词与在线演示生成平台。

采用**「可视化选词 + 跨生态提示词导出」与「结构化高保真闭环在线生成 PPT」双核设计**：先在真实 **16:9 幻灯片画布** 上预览、对比、微调每一套视觉提示词的 12 种商业版式，再无缝将调好的配色与主题带入在线工坊，上传文档或逆向导入存量 `.pptx` 一键翻新，直出高保真原生可编辑 **`.pptx`**、离线矢量打印 **`.html`**、可运行 **Marp / Slidev `.md`** 与纯净演播分享页 **`/deck/[id]`**。

## 核心能力一览（v4 全面升级）

- **16:9 实时多页幻灯片引擎（12 种商业页型 × 15 种版式原型 × 18 套精选风格库）**
  - 完整支持 12 种商业页型（封面、目录、方法架构、图文分栏、柱状数据、转化漏斗/环形占比、双栏对比、SWOT 四象限、路线图、核心团队、金句洞察、总结结尾），首页卡片支持 5 常用标签 + 紧凑「更多页型 ▾」即时切换全部 12 种页型。
  - `SlideCanvas` 模块化拆分至 `src/components/slide-canvas/*` 并采用 `React.memo` 性能优化。
- **交互式提示词工作室（`/studio/[slug]`）与动态 OpenGraph 预览卡**
  - 12 页 4×3 可视化胶片预览、键盘方向键全屏演播、5 维提示词结构透视与 6 大 AI 工具实时编译（`AI 整页生图` 支持单页精修、6 页连贯词包与 **12 页全页型词包**）。
  - **跨页无损承接（Studio → Generate Handoff）**：在工作室微调好的强调色、圆角、主题、受众与页数通过 `sessionStorage` + URL 路由无缝带入 `/generate` 工坊，零丢失继续深加工。
  - **动态社交预览图（`/studio/[slug]/opengraph-image`）**：基于 `next/og` 按每套风格的真实 `VisualSpec` 配色与图表色板实时生成 1200×630 PNG 预览卡（私有模板严格返回 `404` 零泄露）。
- **在线 PPT 生成与编辑工坊（`/generate`）**
  - **多文档解析 + 存量 `.pptx` 逆向导入翻新**：支持 `.pdf`、`.docx`、`.pptx`、`.md`、`.txt`（最大 10MB）。上传旧 `.pptx` 后由纯 Node OOXML 解析器（内置 Zip-Bomb 解压配额防护与 DrawingML 字号标题识别）自动反解逐页标题、正文与备注，直接载入第 1 步可控大纲一键换肤重排。
  - **独立文稿视觉微调器（`DeckSpecTweaker`）与本地防丢草稿箱**：支持在不破坏公共母版的前提下，为当前演示文稿微调品牌强调色、画布底色、卡片表面色、圆角与留白密度；未保存编辑每 1.2s 自动防抖暂存 `localStorage` 并在重返工坊时提供一键恢复横幅。
  - **两步可控大纲（5–20 页）、三合一单页智能配图、Undo/Redo 与单页智能润色**：完整涵盖 12 套自适应矢量图、本地图片 Canvas 压缩上传、BYOK AI 生图与高管风/量化/逐字稿润色。
  - **全格式 1:1 高保真交付**：
    - 原生可编辑 **`.pptx`**（15 种版式原型 + 11 种装饰纹理 + **12/12 套原生矢量配图几何零回退** + 原生柱状图/环形图 + 讲稿备注）。
    - 离线交互 **`.html` / 矢量 PDF**（完整内嵌全部 11 种装饰纹理与 Bento/Swiss/Keynote/新中式/野兽派封面变体 + `@media print` 满幅 16:9 打印）。
    - **真实文稿 Marp / Slidev `.md` 与 AI 精准词导出弹窗**：基于当前已编辑的真实文稿标题、KPI 数值、讲稿与色卡实时编译可运行 Marp Markdown 或 Claude HTML / Gamma-Kimi 精准导入指令。
- **纯净演播分享路由（`/deck/[id]`）与社区共创生态**
  - 公开保存的文稿可通过独立暗场演播路由 `/deck/[id]` 分享：支持键盘 `← / → / Space` 与触屏手势翻页、`N` 键演讲者备注抽屉、`.pptx`/`.html` 下载及「克隆到工坊编辑」，私有文稿对非作者严格返回 `404`（含 `<title>` 零泄露）。
- **生产级安全加固（v4 P0 防线）**
  - 全链路 `VisualSpec` 字段级深度校验（合法 CSS 色值、4 色图表元组、原型/纹理/字体枚举与圆角 `[0, 32]` 强边界）。
  - BYOK 端点 SSRF 防护（拦截 AWS/GCP/Alibaba 云元数据地址、RFC1918 内网段、CGNAT、十进制/十六进制混淆 IP 与 IPv6 内网段）。
  - 登录失败 / 注册内存限流（`429` + `Retry-After`）、复制计数器 5 秒防刷去重及过期 Session 主动清理。

## 本地运行与测试

```bash
npm install
npm run dev
```

首次启动会自动在 `./data/pptgod.db`（WAL 模式）初始化数据库并写入 18 套精选风格、3 个种子账号（含体验演示账号 `demo@pptgod.studio` / `demo1234`）与 5 条初始实测评价。

### 生产构建与端到端测试

```bash
npx tsc --noEmit --incremental false
npm run lint
npm run build
npx next start --port 3000

# 运行覆盖 Tiers 1–6 的 88 条全栈黑盒端到端测试（含安全防线、逆向 .pptx、跨页承接、/deck/[id] 演播与 OG 卡片）
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright python3 tests/e2e/run_e2e.py --base-url http://localhost:3000 --tier all --backup-db
```