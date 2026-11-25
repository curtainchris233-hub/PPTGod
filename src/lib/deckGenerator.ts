import { pickDefaultArtworkForArchetype } from "@/lib/slideArtworks";
import type {
  DeckSlideItem,
  LayoutArchetype,
  OutlineDraftItem,
  PromptItem,
  SlideType,
} from "@/types/prompt";

export interface SourceMaterialPreset {
  id: string;
  label: string;
  topic: string;
  subtitle: string;
  audience: string;
  rawText: string;
}

export const SOURCE_MATERIAL_PRESETS: SourceMaterialPreset[] = [
  {
    id: "preset_ai_product",
    label: "AI 企业知识库产品发布",
    topic: "OmniMind 2.0 · 企业级多模态知识引擎",
    subtitle: "毫秒级私有化检索与可溯源 Agent 协同 · 2026 春季产品发布",
    audience: "CIO、研发总监与数字化转型负责人",
    rawText: `一、行业痛点
传统企业内部文档散落在飞书、邮件、PDF财报与代码库中，员工平均每天花费 1.8 小时寻找资料；通用大模型直接接入存在幻觉高、权限穿透风险与响应慢三大痛点。

二、核心破题洞察
“企业 AI 落地的分水岭不在参数规模，而在每一句回答都能精确溯源到受控权限下的原始段落。”

三、三层技术架构
1. 多模态解析层：精准识别复杂跨页表格、架构图与扫描合同，版面还原准确率达 98.7%。
2. 混合图谱检索引擎：结合稠密向量、BM25 与知识图谱跳数推理，P99 检索延迟仅 18ms。
3. 细粒度权限沙箱：行级 ACL 实时鉴权，支持本地国产算力一体机离线部署。

四、关键验证指标
- 复杂业务问答准确率提升 +146%，幻觉率降至 0.8% 以下
- 客服与售前工单平均处理耗时缩短 64%
- 首季度标杆客户净推荐值达到 95.4%

五、推进路线图
Q1 完成金融与制造 20 家种子客户私有化交付；Q2 开放多步工作流编排 SDK；Q3 推出跨语种全球合规节点；Q4 构建行业插件生态市场。`,
  },
  {
    id: "preset_q4_strategy",
    label: "季度经营复盘与增长战略",
    topic: "2026 Q4 商业化经营复盘与来年生效增长策略",
    subtitle: "聚焦高毛利企业客户 · 从规模扩张转向高质量现金流增长",
    audience: "公司董事会与各事业部负责人",
    rawText: `核心经营结论：Q4 整体 ARR 突破 2.4 亿元，同比增长 +82%，通过主动收缩低毛利定制项目，综合毛利率提升至 76.5%。

现状对比：
过去粗放增长模式下，获客渠道分散、定制化交付周期长达 45 天、首年流失率偏高；
升级标准化行业套件后，开箱即用率提升至 85%、平均上线周期缩短至 7 天、大客户净留存率 NDR 跃升至 128%。

三大战略抓手：
01 产品套件化：将高频定制需求沉淀为 6 大标准化行业包，降低交付人力占比。
02 渠道伙伴赋能：重点扶持 30 家核心区域金牌服务商，贡献 40% 新增商机。
03 存量增购飞轮：围绕用量预警与高阶安全模块建立客户成功自动触达体系。

下阶段里程碑：
1-2月完成销售考核体系切换；3-5月上线行业标准包 2.0；6-9月全面铺开华东华南伙伴计划；10-12月冲刺全年正向自由现金流目标。`,
  },
  {
    id: "preset_academic_defense",
    label: "人工智能学术答辩汇报",
    topic: "面向超长上下文的低秩自适应稀疏注意力机制",
    subtitle: "吞吐量提升 3.4 倍且零精度损失 · 学位论文答辩报告",
    audience: "答辩委员会专家教授与实验室同侪",
    rawText: `研究动机：
随着大语言模型上下文窗口扩展至 128K–1M tokens，标准自注意力的二次方显存与计算复杂度成为端侧与高并发推理的首要瓶颈。

核心创新方法：
1. 动态语义锚点路由：在浅层快速识别全局关键汇聚 Token，跳过 82% 冗余键值计算。
2. 硬件感知分块核函数：对齐 GPU Tensor Core 访存粒度，消除稀疏索引碎片开销。
3. 渐进式免重训蒸馏：仅需 2% 微调语料即可从稠密基座平滑迁移。

实验关键结果：
在 LongBench 与 Needle-in-a-Haystack 128K 基准上，模型保持 99.4% 原始精度；端到端首字延迟 TTFT 降低 71%，单卡吞吐量实现 +240% 提升。

总结与展望：
未来将进一步探索多模态视频流长序列压缩与端侧 NPU 量化协同优化。`,
  },
];

function extractMetricsFromText(
  text: string
): { label: string; value: string; note: string }[] {
  const regex = /([+-]?\d+(?:\.\d+)?\s*(?:%|倍|x|X|ms|小时|天|亿元|万))/g;
  const matches = Array.from(new Set(text.match(regex) || [])).slice(0, 3);

  return [
    {
      label: "核心效能增幅",
      value: matches[0] || "+146%",
      note: "关键业务基准实测显著跃升",
    },
    {
      label: "响应与交付周期",
      value: matches[1] || "18ms",
      note: "端到端全链路耗时大幅压缩",
    },
    {
      label: "质量与留存表现",
      value: matches[2] || "98.7%",
      note: "稳定性与客户满意度双双达标",
    },
  ];
}

function extractSentences(text: string): string[] {
  return text
    .split(/[\n。；;！!]+/)
    .map((s) =>
      s
        .replace(
          /^(?:[\s\-*•]+|[一二三四五六七八九十]+[、.．)）\s]+|\d+[.．、)）\s]+|[(（][一二三四五六七八九十\d]+[)）]\s*)+/,
          ""
        )
        .trim()
    )
    .filter((s) => s.length >= 10 && s.length <= 72 && !/[:：]$/.test(s));
}

export interface GenerateDeckInput {
  topic: string;
  subtitle: string;
  audience: string;
  sourceText?: string;
  slideCount?: number;
  scenario?: string;
  archetype?: LayoutArchetype;
  outline?: OutlineDraftItem[];
}

export interface DefaultSlideOptions {
  index: number;
  topic: string;
  subtitle?: string;
  audience?: string;
  scenario?: string;
  summary?: string;
  archetype?: LayoutArchetype;
  sentences?: string[];
  kpis?: { label: string; value: string; note: string }[];
  quoteText?: string;
  chartMode?: "funnel" | "donut";
  imageLayout?: "left" | "right";
}

export function createDefaultSlideOfType(
  slideType: SlideType,
  opts: DefaultSlideOptions
): DeckSlideItem {
  const idx = opts.index;
  const topic = (opts.topic || "2026 核心战略方案").trim();
  const subtitle = (
    opts.subtitle || "以结构化洞察驱动高质量业务增长与落地闭环"
  ).trim();
  const audience = (opts.audience || "核心管理层与业务团队").trim();
  const sentences = opts.sentences || [];
  const s = (i: number, fallback: string) => sentences[i] || fallback;
  const kpis = opts.kpis || extractMetricsFromText(opts.summary || "");
  const summary = (opts.summary || "").trim();
  const codePrefix = String(idx).padStart(2, "0");
  const defaultPreset = pickDefaultArtworkForArchetype(opts.archetype);

  switch (slideType) {
    case "cover":
      return {
        id: `slide_${idx + 1}_cover`,
        slideType: "cover",
        sectionTag: opts.scenario || "EXECUTIVE DECK",
        title: topic,
        subtitle,
        speakerNotes: `各位${audience}大家好，今天为大家汇报的主题是「${topic}」。接下来我们将系统拆解业务洞察、架构方案、核心指标与落地路线。`,
      };

    case "agenda":
      return {
        id: `slide_${idx + 1}_agenda`,
        slideType: "agenda",
        sectionTag: `${codePrefix} / AGENDA`,
        title: "核心目录与叙事演进脉络",
        steps: [
          {
            code: "01",
            title: "背景洞察与破题",
            desc: s(0, `剖析「${topic}」面临的效率瓶颈与行业拐点`),
          },
          {
            code: "02",
            title: "核心方法与架构",
            desc: s(2, "拆解三层关键能力底座与系统化协同工作流"),
          },
          {
            code: "03",
            title: "量化收益与对比",
            desc: s(5, "通过真实业务基准数据验证投入产出比与竞争优势"),
          },
          {
            code: "04",
            title: "落地路线与行动",
            desc: s(7, "明确分阶段里程碑节点、资源保障与近期行动清单"),
          },
        ],
        speakerNotes:
          "本次演示共分为四个紧密衔接的章节：首先对齐核心痛点，随后给出架构与视觉解法，接着用实测数据验证，最后对齐里程碑时间表。",
      };

    case "image-split":
      return {
        id: `slide_${idx + 1}_image_split`,
        slideType: "image-split",
        sectionTag: `${codePrefix} / VISUAL HIGHLIGHT`,
        title: summary
          ? summary.slice(0, 26)
          : `核心体验升级：以可视化架构重塑「${topic.slice(0, 12)}」`,
        subtitle:
          summary ||
          "左图右文 / 右图左文灵活切换，结合风格自适应矢量插画或实拍产品图增强说服力",
        bullets: [
          s(1, "直观呈现产品核心界面、业务蓝图或物理硬件形态，降低决策理解门槛"),
          s(2, "视觉焦点与三大结构化卖点黄金 5:5 对齐，兼顾审美张力与高信息密度"),
          s(4, "支持本地上传实拍图自动压缩，或一键复制即梦 / Midjourney 美术指令"),
        ],
        imageSlot: {
          kind: "svg-preset",
          presetId: defaultPreset,
          caption: `${topic.slice(0, 18)} · 核心视觉示意`,
          layout: opts.imageLayout || "left",
          promptHint: `${topic} — editorial geometric composition, clean minimal presentation visual`,
        },
        speakerNotes: `这一页我们通过图文分栏直观展示「${topic}」的核心落地形态。左侧视觉区聚焦核心架构与体验感知，右侧提炼了三条最值得关注的关键价值点。`,
      };

    case "process":
      return {
        id: `slide_${idx + 1}_process`,
        slideType: "process",
        sectionTag: `${codePrefix} / ARCHITECTURE`,
        title: "三层递进式核心能力架构设计",
        subtitle: `支撑「${topic.slice(0, 18)}」高效运转的标准化模块`,
        steps: [
          {
            code: "STEP 01",
            title: "全量感知与标准化接入",
            desc: s(
              2,
              "打通多源异构数据孤岛，建立高可靠统一输入规范与清洗流水线"
            ),
          },
          {
            code: "STEP 02",
            title: "智能编排与核心引擎",
            desc: s(
              3,
              "通过低延迟核心算法与规则护栏联动，实现高确定性任务处理"
            ),
          },
          {
            code: "STEP 03",
            title: "业务闭环与持续度量",
            desc: s(
              4,
              "嵌入一线高频工作场景，实时回收反馈指标驱动飞轮自进化"
            ),
          },
        ],
        speakerNotes:
          "在方案架构上，我们摒弃了单点修补，构建了从接入标准化、核心引擎编排到业务度量闭环的三层体系。",
      };

    case "data":
      return {
        id: `slide_${idx + 1}_data`,
        slideType: "data",
        sectionTag: `${codePrefix} / DATA VALIDATION`,
        title: `核心指标全面跃升，关键转化效率突破 ${kpis[0].value}`,
        kpis,
        bars: [
          { label: "Q1", v1: 45, v2: 62 },
          { label: "Q2", v1: 52, v2: 78 },
          { label: "Q3", v1: 60, v2: 96 },
          { label: "Q4", v1: 68, v2: 118 },
        ],
        speakerNotes: `从实测与经营数据来看，新方案上线后四个季度呈现稳步加速态势，其中关键指标达到 ${kpis[0].value}，响应表现稳定在 ${kpis[1].value}。`,
      };

    case "funnel-donut": {
      const mode = opts.chartMode || "funnel";
      return {
        id: `slide_${idx + 1}_funnel_donut`,
        slideType: "funnel-donut",
        sectionTag: `${codePrefix} / ${mode === "donut" ? "SHARE MIX" : "CONVERSION FUNNEL"}`,
        title:
          mode === "donut"
            ? "收入与核心资源结构占比持续向高价值板块集中"
            : "全链路漏斗转化效率显著优化，高意向线索留存翻倍",
        subtitle:
          summary ||
          (mode === "donut"
            ? "四大核心板块贡献结构分布与同比增长拆解"
            : "从潜客触达到最终复购的四级核心转化漏斗跟踪"),
        chartMode: mode,
        funnelStages:
          mode === "donut"
            ? [
                {
                  label: "标杆大客户订阅",
                  value: 46,
                  unit: "%",
                  note: "高续约率与年度增购核心盘",
                },
                {
                  label: "标准化行业套件",
                  value: 28,
                  unit: "%",
                  note: "毛利率 80%+ 的增速主力引擎",
                },
                {
                  label: "渠道伙伴联合交付",
                  value: 16,
                  unit: "%",
                  note: "区域市场规模化放量通道",
                },
                {
                  label: "增值插件与 API",
                  value: 10,
                  unit: "%",
                  note: "高粘性生态扩展收入来源",
                },
              ]
            : [
                {
                  label: "线索触达与建联",
                  value: 10000,
                  unit: "人",
                  note: "精准内容矩阵 + 行业峰会获客",
                },
                {
                  label: "深度体验与 POC",
                  value: 4200,
                  unit: "人",
                  note: "转化率 42.0% · 7 天极速试跑",
                },
                {
                  label: "商务签约与部署",
                  value: 1680,
                  unit: "人",
                  note: "转化率 40.0% · 标准化合同一键签",
                },
                {
                  label: "年度续费与增购",
                  value: 1290,
                  unit: "人",
                  note: "净留存 NDR 达 128%",
                },
              ],
        speakerNotes:
          mode === "donut"
            ? "通过环形占比结构可以清晰看到，前两大高毛利核心板块合计贡献超过 74% 的业务体量，结构健康度持续提升。"
            : "沿着四级转化漏斗来看，我们通过缩短体验门槛并引入标准化交付包，将 POC 到签约的转化率稳定拉升至 40% 以上。",
      };
    }

    case "comparison":
      return {
        id: `slide_${idx + 1}_comparison`,
        slideType: "comparison",
        sectionTag: `${codePrefix} / MATRIX COMPARISON`,
        title: "传统离散模式 vs 新一代体系化方案对比",
        leftTitle: "传统离散协作模式",
        leftPoints: [
          s(0, "流程割裂依赖人工经验，跨部门对齐成本高昂"),
          "缺乏统一质量标准与实时数据监控口径",
          "响应周期漫长，难以支撑业务快速扩展与复用",
        ],
        rightTitle: "新一代标准化体系（推荐）",
        rightPoints: [
          s(3, "端到端自动化流转，核心环节效率提升显著"),
          "内置可量化指标看板，风险与收益透明可控",
          "开箱即用模块化复用，边际交付成本持续下降",
        ],
        speakerNotes:
          "横向对比可以清晰看到，我们从过去依赖个人经验的手工模式，全面升级为可复制、可度量的系统化工程。",
      };

    case "swot":
      return {
        id: `slide_${idx + 1}_swot`,
        slideType: "swot",
        sectionTag: `${codePrefix} / SWOT STRATEGY`,
        title: `「${topic.slice(0, 14)}」SWOT 战略格局与攻防策略`,
        swot: {
          strengths: [
            s(2, "核心技术与产品架构领先，具备显著效率与体验壁垒"),
            "已跑通多家标杆客户私有化验证，形成可复制行业资产",
          ],
          weaknesses: [
            "跨区域交付与生态渠道覆盖仍在爬坡期，需加速伙伴赋能",
            "部分长尾细分场景的自动化配置工具仍待进一步打磨",
          ],
          opportunities: [
            "行业数字化与 AI 降本增效预算向高 ROI 刚需方案集中",
            "国产算力与安全合规升级催生存量系统替换窗口期",
          ],
          threats: [
            "通用型大厂产品快速迭代，中低端市场价格竞争加剧",
            "大客户采购决策周期延长，对首期落地见效速度要求更高",
          ],
        },
        speakerNotes:
          "从 SWOT 四象限战略复盘来看，我们的核心打法是放大技术与标杆先发优势，借势合规替换窗口期加速渠道扩面，并以标准化交付对冲竞争压力。",
      };

    case "timeline":
      return {
        id: `slide_${idx + 1}_timeline`,
        slideType: "timeline",
        sectionTag: `${codePrefix} / ROADMAP`,
        title: "分阶段推进路线图与关键里程碑",
        steps: [
          {
            code: "PHASE 1 · M1",
            title: "试点验证闭环",
            desc: "选定高价值核心场景完成首轮标杆上线与基线校准",
          },
          {
            code: "PHASE 2 · M2–M3",
            title: "标准沉淀扩面",
            desc: "提炼通用模板与SOP操作手册，覆盖 60% 主力业务线",
          },
          {
            code: "PHASE 3 · M4–M6",
            title: "全量规模推广",
            desc: "打通上下游协同生态，全面释放规模化降本增效红利",
          },
          {
            code: "PHASE 4 · H2",
            title: "长效运营迭代",
            desc: "建立季度复盘机制与自动化预警，构筑长期竞争壁垒",
          },
        ],
        speakerNotes:
          "在落地节奏上，我们采取小步快跑、标杆先行的策略，分为四个明确阶段稳步推进，确保每一步都有可验收的阶段成果。",
      };

    case "team-grid":
      return {
        id: `slide_${idx + 1}_team_grid`,
        slideType: "team-grid",
        sectionTag: `${codePrefix} / CORE TEAM`,
        title: "核心交付与研发领导团队保障落地确定性",
        subtitle: "兼具顶层战略视野、底层工程攻坚与一线行业交付经验",
        teamMembers: [
          {
            name: "陈致远",
            role: "首席架构师 · 项目总负责人",
            bio: "14 年企业级分布式系统与 AI 工程经验，主导过 3 个亿级营收核心平台架构演进。",
            badge: "ARCH",
          },
          {
            name: "林思语",
            role: "产品设计总监 · 体验负责人",
            bio: "曾任头部 SaaS 设计系统负责人，擅长将复杂业务流转化为高转化可视化工作台。",
            badge: "DESIGN",
          },
          {
            name: "周明轩",
            role: "算法与数据科学负责人",
            bio: "清华大学计算机博士，多篇顶会一作，专注大模型检索增强与低延迟推理优化。",
            badge: "AI LAB",
          },
          {
            name: "沈嘉宁",
            role: "商业化与客户成功总监",
            bio: "深耕金融与先进制造大客户交付 10 年，所负责标杆客户年度净留存率达 132%。",
            badge: "GROWTH",
          },
        ],
        speakerNotes:
          "强大的方案需要同样顶尖的团队来保障落地。我们的核心班底覆盖底层架构、产品体验、前沿算法与一线商业交付四个关键支点。",
      };

    case "quote":
      return {
        id: `slide_${idx + 1}_quote`,
        slideType: "quote",
        sectionTag: `${codePrefix} / CORE INSIGHT`,
        title: "关键破题洞察",
        quoteText:
          opts.quoteText ||
          s(
            1,
            `围绕「${topic}」，真正拉开差距的是系统化的底层标准与确定性的执行闭环。`
          ),
        quoteAuthor: `面向 ${audience} · 战略核心共识`,
        kpis: kpis.slice(0, 3),
        speakerNotes: `在进入下一章细节之前，我们希望再次锚定这一核心共识：${
          opts.quoteText ||
          `围绕「${topic}」，真正拉开差距的是系统化的底层标准与确定性的执行闭环。`
        }`,
      };

    case "closing":
    default:
      return {
        id: `slide_${idx + 1}_closing`,
        slideType: "closing",
        sectionTag: `${codePrefix} / NEXT STEPS`,
        title: `携手推进「${topic.slice(0, 16)}」落地见效`,
        steps: [
          {
            code: "01",
            title: "对齐核心目标与资源",
            desc: "本周内确认专项工作组名单与首期核心指标口径",
          },
          {
            code: "02",
            title: "启动首批标杆试点",
            desc: "两周内完成首个闭环场景上线并输出周度数据跟踪表",
          },
          {
            code: "03",
            title: "建立双周复盘机制",
            desc: "围绕关键里程碑滚动纠偏，确保季度目标高质量达成",
          },
        ],
        speakerNotes:
          "以上就是今天汇报的全部内容。建议我们围绕这三项近期行动立即启动，非常期待各位的指导意见，谢谢！",
      };
  }
}

function clampDeckCount(raw?: number, fallback = 7): number {
  const n = typeof raw === "number" ? raw : Number.NaN;
  return Math.max(
    5,
    Math.min(20, Number.isFinite(n) && n > 0 ? Math.round(n) : fallback)
  );
}

/**
 * Step 1 (Controllable 2-Step Outline):
 * Produces an editable 5-20 page OutlineDraftItem[] covering all 12 commercial slide types.
 */
export function generateOutlineDraft(
  input: GenerateDeckInput
): OutlineDraftItem[] {
  const topic =
    (typeof input.topic === "string" ? input.topic : "").trim() ||
    "2026 核心战略与创新架构方案";
  const subtitle =
    (typeof input.subtitle === "string" ? input.subtitle : "").trim() ||
    "以结构化洞察驱动高质量业务增长与落地闭环";
  const count = clampDeckCount(input.slideCount, 10);
  const raw = (typeof input.sourceText === "string" ? input.sourceText : "")
    .trim()
    .slice(0, 16000);
  const sentences = raw ? extractSentences(raw) : [];
  const s = (idx: number, fallback: string) => sentences[idx] || fallback;

  const blueprints: Array<{
    slideType: SlideType;
    tag: string;
    title: string;
    summary: string;
  }> = [
    {
      slideType: "cover",
      tag: input.scenario || "EXECUTIVE DECK",
      title: topic,
      summary: subtitle,
    },
    {
      slideType: "agenda",
      tag: "AGENDA",
      title: "核心目录与叙事演进脉络",
      summary: "拆解行业痛点、核心架构、数据验证与分阶段落地四大章节",
    },
    {
      slideType: "quote",
      tag: "CORE INSIGHT",
      title: "关键破题洞察与核心共识",
      summary: s(0, `直击「${topic}」当前最核心的结构性痛点与战略破局点`),
    },
    {
      slideType: "image-split",
      tag: "PRODUCT VISION",
      title: `核心方案全景：以可视化体系升级「${topic.slice(0, 12)}」`,
      summary: s(1, "左侧展示核心视觉结构图，右侧提炼三大差异化价值主张"),
    },
    {
      slideType: "process",
      tag: "ARCHITECTURE",
      title: "三层递进式核心能力架构设计",
      summary: s(2, "从标准化接入、核心引擎编排到业务度量闭环的三层底座"),
    },
    {
      slideType: "data",
      tag: "DATA VALIDATION",
      title: "核心效能指标与季度增长实测验证",
      summary: s(3, "通过四季度对比柱状图与三组大号 KPI 验证投入产出比"),
    },
    {
      slideType: "funnel-donut",
      tag: "CONVERSION FUNNEL",
      title: "全链路转化漏斗与关键节点效能拆解",
      summary: s(4, "量化触达、体验、签约到复购四级漏斗转化效率与留存率"),
    },
    {
      slideType: "comparison",
      tag: "MATRIX COMPARISON",
      title: "传统离散模式 vs 新一代体系化方案对比",
      summary: s(5, "左右双栏直观对比实施周期、质量口径与长期边际成本"),
    },
    {
      slideType: "swot",
      tag: "SWOT STRATEGY",
      title: "SWOT 四象限战略态势与攻防策略",
      summary: s(6, "系统盘点内部优势短板与外部市场机遇挑战，对齐竞争策略"),
    },
    {
      slideType: "timeline",
      tag: "ROADMAP",
      title: "分阶段推进路线图与关键里程碑",
      summary: s(7, "规划 M1 试点、M2-M3 扩面、M4-M6 推广与 H2 长效迭代四阶段"),
    },
    {
      slideType: "team-grid",
      tag: "CORE TEAM",
      title: "核心交付与研发团队保障落地确定性",
      summary: "展示架构、产品设计、算法研发与商业化交付四位核心负责人履历",
    },
    {
      slideType: "funnel-donut",
      tag: "SHARE STRUCTURE",
      title: "业务收入与资源投入占比结构分析",
      summary: "环形占比图展示高毛利核心板块贡献结构与资源倾斜方向",
    },
    {
      slideType: "image-split",
      tag: "CASE STUDY",
      title: "标杆客户落地实景与业务价值证言",
      summary: s(8, "结合真实行业标杆落地成果，验证跨组织规模化复用能力"),
    },
    {
      slideType: "data",
      tag: "ROI PROJECTION",
      title: "未来 12 个月财务收益与成本优化测算",
      summary: "分季度对比投入成本与预期产值，明确盈亏平衡与回报倍增点",
    },
    {
      slideType: "process",
      tag: "GOVERNANCE",
      title: "安全合规、权限隔离与质量保障体系",
      summary: "拆解权限沙箱、数据审计与 SLA 响应三大企业级合规防线",
    },
    {
      slideType: "comparison",
      tag: "TIERED PACKAGES",
      title: "标准版 vs 企业私有化旗舰版方案对比",
      summary: "明晰不同规模客户的功能配置、交付周期与专属服务权益",
    },
    {
      slideType: "swot",
      tag: "RISK MITIGATION",
      title: "关键落地风险识别与专项应对预案",
      summary: "围绕组织协同、技术迁移、数据质量与预算节奏制定前瞻预案",
    },
    {
      slideType: "timeline",
      tag: "90-DAY SPRINT",
      title: "首期 90 天攻坚冲刺执行排期表",
      summary: "细化到双周维度的首期关键交付物、验收标准与责任分工",
    },
    {
      slideType: "quote",
      tag: "EXECUTIVE VISION",
      title: "面向未来的长期护城河与演进愿景",
      summary: "以高张力愿景金句收束战略格局，强化团队长期协同信念",
    },
    {
      slideType: "closing",
      tag: "NEXT STEPS",
      title: `携手推进「${topic.slice(0, 16)}」落地见效`,
      summary: "明确本周资源确认、两周标杆启动与双周复盘三项立即行动",
    },
  ];

  // Always keep cover (0) and closing (last), pick middle (count - 2) entries in narrative order
  const coverBp = blueprints[0];
  const closingBp = blueprints[blueprints.length - 1];
  const middlePool = blueprints.slice(1, blueprints.length - 1);
  const middleCount = Math.max(3, count - 2);

  // If count <= 12, pick high-variety subset from the first 10 middle entries
  const selectedMiddle =
    middleCount <= 10
      ? middlePool.slice(0, middleCount)
      : middlePool.slice(0, middleCount);

  const combined = [coverBp, ...selectedMiddle, closingBp];

  return combined.map((bp, idx) => ({
    id: `outline_${idx + 1}`,
    slideType: bp.slideType,
    sectionTag:
      idx === 0 ? bp.tag : `${String(idx).padStart(2, "0")} / ${bp.tag}`,
    title: bp.title,
    summary: bp.summary,
  }));
}

function buildSlideFromOutlineItem(
  item: OutlineDraftItem,
  idx: number,
  input: GenerateDeckInput,
  sentences: string[],
  kpis: { label: string; value: string; note: string }[],
  quoteText: string,
  donutSeenCount: { count: number },
  imageSeenCount: { count: number }
): DeckSlideItem {
  const chartMode =
    item.slideType === "funnel-donut"
      ? donutSeenCount.count++ % 2 === 1 ||
        /占比|结构|分布|share|donut|饼/i.test(
          `${item.title} ${item.summary} ${item.sectionTag}`
        )
        ? "donut"
        : "funnel"
      : undefined;

  const imageLayout =
    item.slideType === "image-split"
      ? imageSeenCount.count++ % 2 === 1
        ? "right"
        : "left"
      : undefined;

  const base = createDefaultSlideOfType(item.slideType, {
    index: idx,
    topic: input.topic,
    subtitle: input.subtitle,
    audience: input.audience,
    scenario: input.scenario,
    summary: item.summary,
    archetype: input.archetype,
    sentences,
    kpis,
    quoteText,
    chartMode,
    imageLayout,
  });

  const cleanTitle = (item.title || "").trim() || base.title;
  const cleanSummary = (item.summary || "").trim();
  const cleanTag = (item.sectionTag || "").trim() || base.sectionTag;

  const merged: DeckSlideItem = {
    ...base,
    id: item.id || `slide_${idx + 1}_${item.slideType}`,
    sectionTag: cleanTag,
    title: cleanTitle,
  };

  if (cleanSummary) {
    if (item.slideType === "cover") {
      merged.subtitle = cleanSummary;
    } else if (item.slideType === "quote") {
      merged.quoteText = cleanSummary.length >= 12 ? cleanSummary : quoteText;
    } else if (
      item.slideType === "image-split" ||
      item.slideType === "process" ||
      item.slideType === "funnel-donut" ||
      item.slideType === "team-grid"
    ) {
      merged.subtitle = cleanSummary;
    }
    merged.speakerNotes = `第 ${idx + 1} 页聚焦「${cleanTitle}」。${cleanSummary}，帮助${
      input.audience || "核心团队"
    }快速对齐关键结论与下一步动作。`;
  }

  return merged;
}

export function generateStructuredDeck(
  input: GenerateDeckInput
): DeckSlideItem[] {
  const topic =
    (typeof input.topic === "string" ? input.topic : "").trim() ||
    "2026 核心战略与创新架构方案";
  const subtitle =
    (typeof input.subtitle === "string" ? input.subtitle : "").trim() ||
    "以结构化洞察驱动高质量业务增长与落地闭环";
  const audience =
    (typeof input.audience === "string" ? input.audience : "").trim() ||
    "核心管理层与业务团队";
  const count = clampDeckCount(input.slideCount, 7);
  const raw = (typeof input.sourceText === "string" ? input.sourceText : "")
    .trim()
    .slice(0, 16000);

  const sentences = raw ? extractSentences(raw) : [];
  const kpis = extractMetricsFromText(raw);

  // Extract quote if any quoted text exists
  const quoteMatch = raw.match(/[“"「]([^”"」\n]{10,68})[”"」]/);
  const quoteText =
    quoteMatch?.[1] ||
    sentences[1] ||
    `围绕「${topic}」，真正拉开差距的是系统化的底层标准与确定性的执行闭环。`;

  // If caller provided an explicit editable outline (Step 2 of 2-step flow), honor every page
  if (Array.isArray(input.outline) && input.outline.length > 0) {
    const cleanOutline = input.outline.slice(0, 20);
    const donutCounter = { count: 0 };
    const imageCounter = { count: 0 };
    return cleanOutline.map((item, idx) =>
      buildSlideFromOutlineItem(
        item,
        idx,
        { ...input, topic, subtitle, audience },
        sentences,
        kpis,
        quoteText,
        donutCounter,
        imageCounter
      )
    );
  }

  // For 5..8 slides, preserve the classic 8-type deck composition (100% v2 compatible)
  if (count <= 8) {
    const classicTypes: SlideType[] = [
      "cover",
      "agenda",
      "quote",
      "process",
      "data",
      "comparison",
      "timeline",
      "closing",
    ];
    const fullSequence = classicTypes.map((st, idx) =>
      createDefaultSlideOfType(st, {
        index: idx,
        topic,
        subtitle,
        audience,
        scenario: input.scenario,
        archetype: input.archetype,
        sentences,
        kpis,
        quoteText,
      })
    );

    if (count === 8) return fullSequence;
    const priorityRemove: SlideType[] = ["quote", "timeline", "comparison"];
    const result = [...fullSequence];
    for (const rem of priorityRemove) {
      if (result.length <= count) break;
      const idx = result.findIndex((item) => item.slideType === rem);
      if (idx !== -1) result.splice(idx, 1);
    }
    return result.map((item, idx) => {
      if (idx === 0) return item;
      const parts = item.sectionTag.split(" / ");
      const suffix =
        parts.length > 1 ? parts.slice(1).join(" / ") : item.sectionTag;
      return {
        ...item,
        sectionTag: `${String(idx).padStart(2, "0")} / ${suffix}`,
      };
    });
  }

  // For 9..20 slides, expand cleanly through generateOutlineDraft to cover all 12 commercial types
  const outline = generateOutlineDraft({
    ...input,
    topic,
    subtitle,
    audience,
    slideCount: count,
  });
  const donutCounter = { count: 0 };
  const imageCounter = { count: 0 };
  return outline.map((item, idx) =>
    buildSlideFromOutlineItem(
      item,
      idx,
      { ...input, topic, subtitle, audience },
      sentences,
      kpis,
      quoteText,
      donutCounter,
      imageCounter
    )
  );
}

export type PolishAction = "executive" | "metrics" | "notes";

function condenseExecutiveLine(line: string): string {
  const clean = line.trim().replace(/[。；;，,]+$/, "");
  if (!clean) return clean;
  if (clean.includes("：") || clean.includes(":")) return clean;
  if (clean.length > 26) {
    return `${clean.slice(0, 24)}，实现确定性闭环`;
  }
  return clean;
}

function addMetricAnchor(line: string, idx: number): string {
  if (/\d+(?:\.\d+)?\s*(?:%|倍|x|X|ms|天|小时|万|亿)/.test(line)) {
    return line;
  }
  const anchors = [
    "（核心效率提升 +38%）",
    "（端到端周期缩短 52%）",
    "（综合准确率稳定 >= 98.5%）",
    "（标杆复购留存提升 +24%）",
  ];
  return `${line.replace(/[。；;]+$/, "")}${anchors[idx % anchors.length]}`;
}

/**
 * Zero-config single-slide smart polisher supporting executive distillation,
 * quantitative metric enrichment, and natural spoken script generation.
 */
export function polishSlideContent(
  slide: DeckSlideItem,
  action: PolishAction
): DeckSlideItem {
  const next: DeckSlideItem = structuredClone(slide);

  if (action === "executive") {
    const baseTitle = (next.title || "").trim().replace(/[。！!]+$/, "");
    if (baseTitle && !/^(核心结论|战略聚焦|关键洞察|决策要点)[:：]/.test(baseTitle)) {
      next.title =
        baseTitle.length <= 20 ? `核心结论：${baseTitle}` : `${baseTitle.slice(0, 22)}（决策要点）`;
    }
    if (next.subtitle) {
      next.subtitle = `聚焦高 ROI 关键路径 · ${next.subtitle.replace(/^聚焦[^·]+·\s*/, "")}`;
    }
    if (next.bullets) {
      next.bullets = next.bullets.map(condenseExecutiveLine);
    }
    if (next.leftPoints) {
      next.leftPoints = next.leftPoints.map(condenseExecutiveLine);
    }
    if (next.rightPoints) {
      next.rightPoints = next.rightPoints.map(condenseExecutiveLine);
    }
    if (next.steps) {
      next.steps = next.steps.map((st) => ({
        ...st,
        desc: condenseExecutiveLine(st.desc),
      }));
    }
    if (next.swot) {
      next.swot = {
        strengths: next.swot.strengths.map(condenseExecutiveLine),
        weaknesses: next.swot.weaknesses.map(condenseExecutiveLine),
        opportunities: next.swot.opportunities.map(condenseExecutiveLine),
        threats: next.swot.threats.map(condenseExecutiveLine),
      };
    }
    next.speakerNotes = `【高管决策口吻】请直接关注本页核心结论：「${next.title}」。我们省略冗余背景，直接聚焦决定业务成败的 3 个关键支点，建议当场对齐资源与验收口径。`;
    return next;
  }

  if (action === "metrics") {
    if (next.title && !/\d+%|\d+倍|\+\d+/.test(next.title)) {
      next.title = `${next.title.replace(/[。！!]+$/, "").slice(0, 20)}（效率提升 +42%）`;
    }
    if (next.bullets) {
      next.bullets = next.bullets.map((b, i) => addMetricAnchor(b, i));
    }
    if (next.rightPoints) {
      next.rightPoints = next.rightPoints.map((p, i) => addMetricAnchor(p, i));
    }
    if (next.steps) {
      next.steps = next.steps.map((st, i) => ({
        ...st,
        desc: addMetricAnchor(st.desc, i),
      }));
    }
    if (next.swot) {
      next.swot = {
        ...next.swot,
        strengths: next.swot.strengths.map((p, i) => addMetricAnchor(p, i)),
        opportunities: next.swot.opportunities.map((p, i) =>
          addMetricAnchor(p, i + 1)
        ),
      };
    }
    if (next.kpis && next.kpis.length > 0) {
      next.kpis = next.kpis.map((k) => ({
        ...k,
        note: k.note.includes("同比") ? k.note : `${k.note}（较基线同比验证）`,
      }));
    }
    if (next.funnelStages && next.funnelStages.length > 0) {
      next.funnelStages = next.funnelStages.map((f, i) => ({
        ...f,
        note: f.note && /\d+%/.test(f.note) ? f.note : `${f.note || "阶段达标"} · 环比 +${12 + i * 4}%`,
      }));
    }
    next.speakerNotes = `【量化论据强化】本页已补充关键基准对比数据：「${next.title}」。汇报时建议先指出最醒目的量化增幅，再用横向基准说明投入产出比（ROI）的确定性。`;
    return next;
  }

  // action === "notes"
  const highlights: string[] = [];
  if (next.kpis?.length) {
    highlights.push(
      `重点数据包括${next.kpis
        .slice(0, 3)
        .map((k) => `${k.label}达到 ${k.value}`)
        .join("、")}`
    );
  }
  if (next.steps?.length) {
    highlights.push(
      `依次拆解为${next.steps
        .slice(0, 4)
        .map((st) => `「${st.title}」`)
        .join("、")}`
    );
  }
  if (next.bullets?.length) {
    highlights.push(`核心聚焦于：${next.bullets[0]}`);
  }
  if (next.swot) {
    highlights.push(
      `优势侧重于「${next.swot.strengths[0] || "核心壁垒"}」，同时前瞻应对「${
        next.swot.threats[0] || "外部竞争"
      }」`
    );
  }
  if (next.funnelStages?.length) {
    highlights.push(
      `首位环节「${next.funnelStages[0].label}」体量为 ${next.funnelStages[0].value}${
        next.funnelStages[0].unit || ""
      }，末端留存与占比表现稳健`
    );
  }
  if (next.teamMembers?.length) {
    highlights.push(
      `由${next.teamMembers
        .slice(0, 3)
        .map((m) => `${m.name}（${m.role.split("·")[0].trim()}）`)
        .join("、")}等核心成员领衔推进`
    );
  }
  if (next.quoteText) {
    highlights.push(`核心洞察金句是：“${next.quoteText}”`);
  }

  next.speakerNotes = `各位好，我们来看这一页「${next.title}」。${
    highlights.length > 0
      ? highlights.join("；") + "。"
      : "这一页承上启下，明确了本阶段的核心抓手与落地标准。"
  }建议大家重点关注画面中的高亮结论，接下来我们将顺着这条主线继续展开下一页的详细拆解。`;
  return next;
}

export function buildSampleDeckFromPrompt(
  prompt: PromptItem,
  topicOverride?: string,
  subtitleOverride?: string
): DeckSlideItem[] {
  return generateStructuredDeck({
    topic: topicOverride?.trim() || prompt.sampleTopic,
    subtitle: subtitleOverride?.trim() || prompt.sampleSubtitle,
    audience: "核心决策团队",
    slideCount: 6,
    scenario: prompt.scenario,
    archetype: prompt.visualSpec.layout.archetype,
  });
}
