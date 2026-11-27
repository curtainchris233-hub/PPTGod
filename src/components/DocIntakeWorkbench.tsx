"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ClipboardList,
  Columns3,
  Copy,
  Download,
  FileText,
  FileUp,
  Layers,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import AiAmbientAccent from "@/components/AiAmbientAccent";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import { saveDocIntakeHandoff } from "@/lib/docIntakeHandoff";
import { analyzeDocumentAndRecommendStyles } from "@/lib/documentAnalyzer";
import { compilePrompt } from "@/lib/promptCompiler";
import { savePackHandoff } from "@/lib/promptPack";
import {
  DOMAIN_TABS,
  EVIDENCE_DENSITY_LABELS,
  MATERIAL_KIND_LABELS,
  SLIDE_TYPE_LABELS,
  TOOL_METADATA,
  type DocumentAnalysisResult,
  type EvidenceDensity,
  type GenerationRouteMode,
  type OutlineDraftItem,
  type PromptItem,
  type SlideType,
  type SourceDocumentDigest,
  type TargetTool,
} from "@/types/prompt";
import "@/styles/doc-intake.css";

export interface DocIntakeParsedState {
  fileName: string;
  fileType: string;
  charCount: number;
  text: string;
  suggestedTopic: string;
  suggestedSubtitle: string;
  isScannedPdf?: boolean;
  warning?: string;
  parsedOutline?: OutlineDraftItem[];
  analysis: DocumentAnalysisResult;
}

interface DocIntakeWorkbenchProps {
  open: boolean;
  onClose: () => void;
  prompts: PromptItem[];
  initialParsed?: DocIntakeParsedState | null;
  onApplyTopic?: (topic: string) => void;
}

interface SampleDocItem {
  id: string;
  label: string;
  fileName: string;
  text: string;
}

const SAMPLE_DOCS: SampleDocItem[] = [
  {
    id: "ai-transformer",
    label: "AI 论文 · Transformer 精读",
    fileName: "Attention_Is_All_You_Need_论文精读.txt",
    text: `Attention Is All You Need：Transformer 架构精读与演进
NeurIPS 2017 经典文献组会汇报（Vaswani et al., arXiv:1706.03762）

一、研究动机与文献综述
传统序列建模高度依赖 RNN/LSTM 递归结构，长距离依赖路径长度达 O(n) 且无法按时间步并行训练，制约大规模语料扩展。本文提出完全摒弃循环与卷积、仅基于注意力机制（Self-Attention）的 Transformer 编码器-解码器架构。

二、核心方法与模块拆解
1. 缩放点积注意力（Scaled Dot-Product Attention）：引入 1/√d_k 缩放因子防止点积过大导致 Softmax 梯度消失，任意两词交互路径缩短至 O(1)。
2. 多头注意力（Multi-Head Attention, h = 8, d_model = 512）：在 8 个独立子空间并行捕捉句法结构与长程语义依赖，配合残差连接与 LayerNorm 稳定深层训练。
3. 位置编码（Positional Encoding）：采用正余弦函数注入相对与绝对位置信息，支持序列长度外推。

三、实验结果与消融实验（Baseline 对比）
1. 在 WMT 2014 英德翻译基准（Dataset）上达到 28.4 BLEU，较此前最佳集成 Baseline 提升 +2.0 BLEU；英法翻译达到 41.8 BLEU。
2. 训练算力成本仅需 8 张 P100 GPU 训练 3.5 天，显著低于传统 ConvS2S 与 GNMT 模型。
3. 消融实验（Ablation）表明：单头注意力性能下降 0.9 BLEU，移除位置编码与过小 d_k 均显著拉低翻译准确率。`,
  },
  {
    id: "ai-deepseek-r1",
    label: "AI 论文 · DeepSeek-R1 拆解",
    fileName: "DeepSeek-R1_强化学习推理范式研读.txt",
    text: `DeepSeek-R1：强化学习驱动的大语言模型推理演进
AI 实验室前沿文献研读与消融实验分析（arXiv:2501.12948）

一、研究动机与核心问题
大语言模型在复杂数学与代码推理任务上长期依赖海量人工标注思维链（SFT）。论文探讨能否跳过监督微调，直接通过大规模纯强化学习激发模型自主涌现长思维链（Long-CoT）与自我反思能力。

二、核心训练方法与四阶段管线
1. 纯强化学习探索（DeepSeek-R1-Zero）：采用组相对策略优化（GRPO），免去独立 Critic 价值网络，降低显存开销约 45%，模型自发涌现“Aha Moment”回溯验算行为。
2. 冷启动与多阶段协同：引入数千条高质量冷启动长思维链（Cold-Start SFT），再执行面向推理的 RL、拒绝采样与全场景对齐，彻底解决语言混杂与可读性问题。
3. 小模型推理蒸馏：将 R1 生成的 80 万条高质量推理样本蒸馏至 7B / 32B 稠密模型，验证「大推小」显著优于小模型直接 RL。

三、基准实验结果与消融结论
1. 在 AIME 2024 数学竞赛基准上达到 79.8% Pass@1，在 MATH-500 基准上达到 97.3% 准确率，与主流闭源推理 Baseline 持平。
2. 蒸馏版 32B 模型在 AIME 2024 上取得 72.6%，较同尺寸纯 RL Baseline 提升超过 25 个百分点，证明强推理轨迹蒸馏的高性价比。`,
  },
  {
    id: "hs-physics",
    label: "高中物理 · 牛顿第二定律",
    fileName: "人教版高一物理-牛顿第二定律公开课教案.txt",
    text: `牛顿第二定律：加速度与力、质量的定量探究
人教版高中物理必修一第四章第 2 节公开课教学设计（45 分钟）

一、教学目标与学情分析
学生已掌握加速度概念与受力分析基础，但在“控制变量法处理非线性 a-m 图像与平衡摩擦力”上存在认知难点。本节目标是在 45 分钟课堂互动中，引导同学自主设计实验并得出 F = ma 的定量规律，课堂达成率目标 92%。

二、情境导入与生活设问
对比重载卡车与空载跑车在绿灯起步时的速度变化，抛出核心驱动问题：加速度究竟受哪些物理量控制？

三、分组实验探究与板书重难点
1. 保持小车质量不变，改变槽码拉力进行 5 组测量，绘制 a-F 过原点线性关系图。
2. 保持拉力不变，增加配重改变质量，引导将 a-m 双曲线化曲为直转化为 a-1/m 直线。
3. 板书强调矢量性、瞬时性与同体性三大核心要点，厘清质量远大于槽码条件的近似边界。

四、随堂例题与分层课后作业
通过 2 道梯度随堂辨析题即时检验重难点，课后布置基础巩固题与“电梯超重失重手机传感器测量”拓展实践任务。`,
  },
  {
    id: "ms-chinese",
    label: "初中语文 · 岳阳楼记",
    fileName: "统编版九上语文-岳阳楼记教学设计.txt",
    text: `《岳阳楼记》：写景抒情与“先忧后乐”家国情怀赏析
统编版初中语文九年级上册第三单元精品公开课教学设计（45 分钟）

一、教学目标与学情分析
九年级学生已具备一定文言文阅读积累，能借助注释疏通大意，但对“借景抒情与议论升华的内在结构”以及范仲淹“谪守巴陵”背后的政治抱负体会尚浅。本课聚焦朗读节奏、实词辨析与情感主旨探究。

二、情境导入与背景还原
展示洞庭湖阴晴气象对照图，介绍庆历新政受挫后滕子京与范仲淹同遭贬谪的时代背景，引出核心问题：范仲淹未亲临重修后的岳阳楼，为何能写出千古绝唱？

三、文本细读与板书对比设计
1. 疏通高频文言实词与一词多义（如“观”“微”“景”“一”），把握骈散结合的诵读韵律。
2. 双境板书对比：第三段“霪雨霏霏、薄暮冥冥”的迁客悲情 vs 第四段“春和景明、上下天光”的喜洋洋气象。
3. 主旨探究：剖析“不以物喜，不以己悲”的旷达胸襟，由一己悲欢升华至“先天下之忧而忧，后天下之乐而乐”的士大夫担当。

四、随堂例题与分层课后作业
课堂完成 3 道中考高频文言虚实词辨析随堂练习；课后分层布置背诵默写与“跨越千年的对话：给范仲淹写一封 300 字回信”拓展写作任务。`,
  },
];

const TOOL_LIST = Object.keys(TOOL_METADATA) as TargetTool[];

function extractClientTitleHints(
  text: string,
  fileName: string
): { suggestedTopic: string; suggestedSubtitle: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").replace(/^[\-\*•\s]+/, "").trim())
    .filter((l) => l.length >= 2);
  const fallback = fileName.replace(/\.[^.]+$/, "").trim() || "文档智能解析演示";
  const first = (lines[0] || fallback).slice(0, 48);
  const second = lines.find((l, i) => i > 0 && l.length >= 6 && l !== first);
  return {
    suggestedTopic: first,
    suggestedSubtitle: second
      ? second.slice(0, 72)
      : "基于源文档自动提炼的结构化演示方案",
  };
}

export default function DocIntakeWorkbench({
  open,
  onClose,
  prompts,
  initialParsed = null,
  onApplyTopic,
}: DocIntakeWorkbenchProps) {
  const router = useRouter();
  const { showToast, replaceCompareIds, setGlobalTopic } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [parsed, setParsed] = useState<DocIntakeParsedState | null>(
    () => initialParsed
  );

  // Editable parameters derived from parsed document
  const [topic, setTopic] = useState(
    () => initialParsed?.suggestedTopic || ""
  );
  const [subtitle, setSubtitle] = useState(
    () => initialParsed?.suggestedSubtitle || ""
  );
  const [audience, setAudience] = useState(
    () => initialParsed?.analysis.suggestedAudience || "核心受众与评审专家"
  );
  const [slideCount, setSlideCount] = useState(
    () => initialParsed?.analysis.suggestedSlideCount || 8
  );
  const [tone, setTone] = useState<
    "executive" | "storytelling" | "analytical" | "inspiring"
  >(() => initialParsed?.analysis.suggestedTone || "executive");

  const [selectedSlug, setSelectedSlug] = useState(
    () =>
      initialParsed?.analysis.recommendedStyles[0]?.slug ||
      prompts[0]?.slug ||
      ""
  );
  const [targetTool, setTargetTool] = useState<TargetTool>("claude-html");
  const [language, setLanguage] = useState<"zh" | "en" | "bilingual">("zh");
  const [proofSlideMode, setProofSlideMode] = useState<"cover" | "content">("cover");
  const [routeMode, setRouteMode] = useState<GenerationRouteMode>(
    () => initialParsed?.analysis.recommendedRouteMode || "restructure"
  );
  const [evidenceDensity, setEvidenceDensity] = useState<EvidenceDensity>(
    () => initialParsed?.analysis.recommendedEvidenceDensity || "balanced"
  );
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const applyParsedResult = (next: DocIntakeParsedState) => {
    setParsed(next);
    setErrorMsg(null);
    setTopic(next.suggestedTopic);
    setSubtitle(next.suggestedSubtitle);
    setAudience(next.analysis.suggestedAudience);
    setSlideCount(next.analysis.suggestedSlideCount);
    setTone(next.analysis.suggestedTone);
    setRouteMode(next.analysis.recommendedRouteMode || "restructure");
    setEvidenceDensity(next.analysis.recommendedEvidenceDensity || "balanced");
    setProofSlideMode("cover");
    const topSlug = next.analysis.recommendedStyles[0]?.slug;
    if (topSlug) {
      setSelectedSlug(topSlug);
    }
    if (next.suggestedTopic && !next.isScannedPdf) {
      onApplyTopic?.(next.suggestedTopic);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (parsing) return;
    setParsing(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "文档解析失败，请检查文件格式";
        setErrorMsg(msg);
        showToast(msg, "error");
        return;
      }

      const analysis: DocumentAnalysisResult =
        data.analysis ||
        analyzeDocumentAndRecommendStyles({
          text: String(data.text || ""),
          fileName: data.fileName || file.name,
          suggestedTopic: data.suggestedTopic,
          suggestedSubtitle: data.suggestedSubtitle,
          styles: prompts,
        });

      const nextState: DocIntakeParsedState = {
        fileName: data.fileName || file.name,
        fileType: data.fileType || "txt",
        charCount: Number(data.charCount) || String(data.text || "").length,
        text: String(data.text || ""),
        suggestedTopic: data.suggestedTopic || file.name,
        suggestedSubtitle:
          data.suggestedSubtitle || "基于源文档自动提炼的结构化演示方案",
        isScannedPdf: Boolean(data.isScannedPdf),
        warning: data.warning,
        parsedOutline: Array.isArray(data.parsedOutline)
          ? data.parsedOutline
          : undefined,
        analysis,
      };
      applyParsedResult(nextState);
      showToast(
        `已完成解析「${nextState.fileName}」· 识别为「${analysis.detectedScenario}」并推荐 Top 3 风格`,
        "success"
      );
    } catch {
      const msg = "文档上传解析网络异常，请重试";
      setErrorMsg(msg);
      showToast(msg, "error");
    } finally {
      setParsing(false);
    }
  };

  const runClientTextAnalysis = (rawText: string, fileName: string) => {
    const clean = rawText.replace(/\r\n?/g, "\n").trim();
    if (clean.length < 12) {
      setErrorMsg("请输入至少 12 个字的资料正文或大纲，系统才能精准识别场景与推荐风格");
      return;
    }
    const { suggestedTopic, suggestedSubtitle } = extractClientTitleHints(
      clean,
      fileName
    );
    const analysis = analyzeDocumentAndRecommendStyles({
      text: clean.slice(0, 16000),
      fileName,
      suggestedTopic,
      suggestedSubtitle,
      styles: prompts,
    });
    const nextState: DocIntakeParsedState = {
      fileName,
      fileType: "txt",
      charCount: clean.length,
      text: clean.slice(0, 16000),
      suggestedTopic,
      suggestedSubtitle,
      analysis,
    };
    applyParsedResult(nextState);
    showToast(
      `已分析资料「${fileName}」· 推荐 3 套最契合的 PPT 风格与融合提示词`,
      "success"
    );
  };

  const selectedPrompt = useMemo(() => {
    return (
      prompts.find((p) => p.slug === selectedSlug) ||
      prompts[0] ||
      null
    );
  }, [prompts, selectedSlug]);

  const recommendedEntries = useMemo(() => {
    if (!parsed) return [];
    return parsed.analysis.recommendedStyles
      .map((match) => {
        const prompt = prompts.find(
          (p) => p.slug === match.slug || p.id === match.id
        );
        return prompt ? { match, prompt } : null;
      })
      .filter(
        (
          item
        ): item is {
          match: DocumentAnalysisResult["recommendedStyles"][number];
          prompt: PromptItem;
        } => Boolean(item)
      );
  }, [parsed, prompts]);

  const sourceDigest: SourceDocumentDigest | undefined = useMemo(() => {
    if (!parsed) return undefined;
    return {
      fileName: parsed.fileName,
      charCount: parsed.charCount,
      detectedScenario: parsed.analysis.detectedScenario,
      materialKind: parsed.analysis.materialKind,
      evidenceDensity,
      routeMode,
      keyMetrics: parsed.analysis.keyMetrics,
      keySections: parsed.analysis.keySections,
      excerpt: parsed.text.slice(0, 1400),
    };
  }, [parsed, evidenceDensity, routeMode]);

  const compiledPrompt = useMemo(() => {
    if (!parsed || !selectedPrompt) return "";
    return compilePrompt(selectedPrompt, selectedPrompt.visualSpec, {
      topic: topic.trim() || parsed.suggestedTopic,
      subtitle: subtitle.trim() || parsed.suggestedSubtitle,
      audience: audience.trim() || parsed.analysis.suggestedAudience,
      slideCount,
      language,
      tone,
      targetTool,
      sourceDigest,
    });
  }, [
    parsed,
    selectedPrompt,
    topic,
    subtitle,
    audience,
    slideCount,
    language,
    tone,
    targetTool,
    sourceDigest,
  ]);

  if (!open) return null;

  const handleCopyPrompt = async () => {
    if (!compiledPrompt) return;
    try {
      await navigator.clipboard.writeText(compiledPrompt);
      setCopied(true);
      showToast(
        `已复制融合源文档的「${TOOL_METADATA[targetTool].shortName}」专属提示词！`,
        "success"
      );
      if (selectedPrompt) {
        fetch(`/api/prompts/${selectedPrompt.id}/copy`, {
          method: "POST",
        }).catch(() => {});
      }
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("剪贴板受限，请手动全选下方提示词复制", "error");
    }
  };

  const handleDownloadPrompt = () => {
    if (!compiledPrompt) return;
    const safeName = (topic || parsed?.fileName || "pptgod-doc")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .slice(0, 36);
    const blob = new Blob([compiledPrompt], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}-${targetTool}-prompt.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已下载 ${safeName}-${targetTool}-prompt.md`, "success");
  };

  const handleAutoGeneratePpt = (overrideSlug?: string) => {
    if (!parsed) return;
    const chosenSlug =
      overrideSlug || selectedPrompt?.slug || prompts[0]?.slug || "";
    const finalTopic = topic.trim() || parsed.suggestedTopic;
    const finalSubtitle = subtitle.trim() || parsed.suggestedSubtitle;
    const finalAudience = audience.trim() || parsed.analysis.suggestedAudience;

    saveDocIntakeHandoff({
      fileName: parsed.fileName,
      fileType: parsed.fileType,
      charCount: parsed.charCount,
      text: parsed.text,
      topic: finalTopic,
      subtitle: finalSubtitle,
      audience: finalAudience,
      slideCount,
      styleSlug: chosenSlug,
      autoGenerate: true,
      routeMode,
      evidenceDensity,
      parsedOutline: parsed.parsedOutline,
      analysis: parsed.analysis,
    });

    onClose();
    router.push(
      `/generate?style=${encodeURIComponent(chosenSlug)}&intake=1`
    );
  };

  const handleSendToPack = () => {
    if (!parsed) return;
    const finalTopic = topic.trim() || parsed.suggestedTopic;
    const finalAudience = audience.trim() || parsed.analysis.suggestedAudience;
    savePackHandoff({
      text: parsed.text,
      fileName: parsed.fileName,
      topic: finalTopic,
      audience: finalAudience,
      slideCount,
    });
    const styleQuery = selectedPrompt?.slug
      ? `?style=${encodeURIComponent(selectedPrompt.slug)}`
      : "";
    onClose();
    router.push(`/pack${styleQuery}`);
  };

  const handleCompareTop3 = () => {
    if (recommendedEntries.length === 0) return;
    const ids = recommendedEntries.map((entry) => entry.prompt.id);
    replaceCompareIds(ids);
    if (topic.trim()) {
      setGlobalTopic(topic.trim());
    }
    showToast("已将 Top 3 推荐风格送入并排对比台！", "success");
    onClose();
    router.push("/compare");
  };

  const groupedStyles = (() => {
    const assigned = new Set<string>();
    const groups = DOMAIN_TABS.filter((t) => t.id !== "all").map((tab) => {
      const items = prompts.filter((st) => {
        if (assigned.has(st.id)) return false;
        if (tab.scenarios.includes(st.scenario)) {
          assigned.add(st.id);
          return true;
        }
        return false;
      });
      return { label: tab.label, items };
    });
    const remaining = prompts.filter((st) => !assigned.has(st.id));
    if (remaining.length > 0) {
      groups.push({ label: "社区风格", items: remaining });
    }
    return groups.filter((g) => g.items.length > 0);
  })();

  return (
    <div
      className="pg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pg-intake-title"
      id="pg-doc-intake-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pg-intake-modal">
        <AiAmbientAccent variant="panel-corner" />
        {/* Minimal Modal Header */}
        <div className="pg-intake-head-row">
          <div>
            <h2 id="pg-intake-title" className="pg-modal-title">
              丢入资料 · 推风格 · 出词 · 生成 PPT
            </h2>
          </div>
          <button
            type="button"
            className="pg-icon-btn"
            onClick={onClose}
            aria-label="关闭资料直通车"
            id="pg-intake-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Mode Switcher + 3 Instant Samples */}
        <div className="pg-intake-mode-bar">
          <div className="pg-intake-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              id="pg-intake-mode-upload"
              aria-selected={inputMode === "upload"}
              className={`pg-intake-mode-tab ${
                inputMode === "upload" ? "is-active" : ""
              }`}
              onClick={() => setInputMode("upload")}
            >
              <FileUp size={13} />
              <span>上传文档</span>
            </button>
            <button
              type="button"
              role="tab"
              id="pg-intake-mode-paste"
              aria-selected={inputMode === "paste"}
              className={`pg-intake-mode-tab ${
                inputMode === "paste" ? "is-active" : ""
              }`}
              onClick={() => setInputMode("paste")}
            >
              <FileText size={13} />
              <span>粘贴正文</span>
            </button>
          </div>

          <div className="pg-intake-samples">
            <span className="pg-intake-sample-label">示例：</span>
            {SAMPLE_DOCS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                id={`pg-intake-sample-${sample.id}`}
                className="pg-preset-chip"
                onClick={() =>
                  runClientTextAnalysis(sample.text, sample.fileName)
                }
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Dropzone OR Paste Box */}
        {inputMode === "upload" ? (
          <div
            className={`pg-intake-dropzone ${dragging ? "is-drag-over" : ""} ${
              parsed ? "is-compact" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleUploadFile(file);
            }}
          >
            <input
              ref={fileInputRef}
              id="pg-intake-file-input"
              type="file"
              accept=".pdf,.docx,.pptx,.md,.txt"
              className="pg-intake-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
                e.target.value = "";
              }}
            />
            <div className="pg-intake-drop-info">
              <span className="pg-intake-drop-icon">
                <FileUp size={parsed ? 15 : 18} />
              </span>
              <div>
                <div className="pg-intake-drop-title">
                  {parsed
                    ? `已解析「${parsed.fileName}」`
                    : "拖入 PDF / Word (.docx) / TXT / MD / PPTX"}
                </div>
                {!parsed && (
                  <div className="pg-intake-drop-sub">
                    最大 10MB · 即时解析，不留存私有文稿
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              id="pg-intake-upload-btn"
              className="pg-btn pg-btn-secondary pg-btn-sm"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} />
              <span>{parsing ? "解析中..." : parsed ? "更换文档" : "选择文档"}</span>
            </button>
          </div>
        ) : (
          <div className="pg-intake-paste-box">
            <textarea
              id="pg-intake-paste-textarea"
              className="pg-intake-paste-textarea"
              placeholder="粘贴论文摘要、教案、项目周报或商业计划书正文..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="pg-intake-paste-foot">
              <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                {pasteText.trim().length} 字
              </span>
              <button
                type="button"
                id="pg-intake-analyze-paste-btn"
                className="pg-btn pg-btn-primary pg-btn-sm"
                onClick={() =>
                  runClientTextAnalysis(pasteText, "粘贴原始资料.txt")
                }
              >
                <Wand2 size={14} />
                <span>识别并推荐风格</span>
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="pg-intake-error" id="pg-intake-error">
            {errorMsg}
          </div>
        )}

        {parsed?.warning && (
          <div className="pg-intake-warning" id="pg-intake-warning">
            {parsed.warning}
          </div>
        )}

        {/* Parsed Results Hub */}
        {parsed && selectedPrompt && (
          <>
            {/* Compact Analysis Insight Strip + Collapsible Parameter Tweaks */}
            <div className="pg-intake-insight" id="pg-intake-insight-bar">
              <div className="pg-intake-insight-top">
                <div className="pg-intake-badges">
                  <span
                    className="pg-intake-scene-pill"
                    id="pg-intake-detected-scenario"
                  >
                    <Sparkles size={12} />
                    <span>
                      {parsed.analysis.detectedScenario} ·{" "}
                      {parsed.analysis.confidence}%
                    </span>
                  </span>
                  {parsed.analysis.materialKind && (
                    <span
                      className="pg-intake-domain-pill"
                      id="pg-intake-material-kind"
                      title={
                        parsed.analysis.materialStrategy ||
                        MATERIAL_KIND_LABELS[parsed.analysis.materialKind].strategy
                      }
                    >
                      {MATERIAL_KIND_LABELS[parsed.analysis.materialKind].label}
                    </span>
                  )}
                  <span className="pg-intake-file-pill" title={parsed.fileName}>
                    <span>
                      {parsed.charCount} 字 · {slideCount} 页
                      {parsed.analysis.estimatedTalkMinutes
                        ? ` · 约 ${parsed.analysis.estimatedTalkMinutes} 分钟`
                        : ""}
                    </span>
                  </span>
                </div>
                <div className="pg-btn-group">
                  <button
                    type="button"
                    className="pg-btn pg-btn-primary pg-btn-sm"
                    id="pg-intake-to-pack-btn"
                    onClick={handleSendToPack}
                  >
                    <ClipboardList size={14} />
                    <span>转入提示词包工作台</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    id="pg-intake-auto-gen-btn"
                    onClick={() => handleAutoGeneratePpt()}
                  >
                    <Sparkles size={14} />
                    <span>一键生成 PPT</span>
                  </button>
                </div>
              </div>

              {parsed.analysis.keyMetrics.length > 0 && (
                <div className="pg-intake-metrics-row">
                  <span className="pg-intake-metric-label">核心数据：</span>
                  {parsed.analysis.keyMetrics.map((m, idx) => (
                    <span key={`${m}-${idx}`} className="pg-intake-metric-chip">
                      {m}
                    </span>
                  ))}
                </div>
              )}

              {/* Compact 3-Item Scenario Contract Pills (Auto-Preselected, Zero Clutter) */}
              <div className="pg-intake-contract-row" id="pg-intake-contract-row">
                {parsed.analysis.materialKind === "existing-pptx" && (
                  <div className="pg-intake-contract-group">
                    <span className="pg-intake-contract-label">路由：</span>
                    <div
                      className="pg-intake-contract-seg"
                      role="group"
                      aria-label="旧 PPT 处理路由"
                    >
                      <button
                        type="button"
                        id="pg-intake-route-beautify"
                        className={`pg-intake-contract-btn ${
                          routeMode === "beautify-1to1" ? "is-active" : ""
                        }`}
                        onClick={() => setRouteMode("beautify-1to1")}
                      >
                        1:1 保词换肤
                      </button>
                      <button
                        type="button"
                        id="pg-intake-route-restructure"
                        className={`pg-intake-contract-btn ${
                          routeMode === "restructure" ? "is-active" : ""
                        }`}
                        onClick={() => setRouteMode("restructure")}
                      >
                        重构故事
                      </button>
                    </div>
                  </div>
                )}

                <div className="pg-intake-contract-group">
                  <span className="pg-intake-contract-label">证据密度：</span>
                  <div
                    className="pg-intake-contract-seg"
                    role="group"
                    aria-label="证据密度契约"
                  >
                    {(
                      ["light", "balanced", "high-evidence"] as EvidenceDensity[]
                    ).map((dens) => (
                      <button
                        key={dens}
                        type="button"
                        id={`pg-intake-density-${dens}`}
                        className={`pg-intake-contract-btn ${
                          evidenceDensity === dens ? "is-active" : ""
                        }`}
                        title={EVIDENCE_DENSITY_LABELS[dens].label}
                        onClick={() => setEvidenceDensity(dens)}
                      >
                        {EVIDENCE_DENSITY_LABELS[dens].short}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <details className="pg-intake-sections-details">
                <summary>
                  微调主题、受众、页数与 {parsed.analysis.keySections.length} 段章节提炼
                </summary>

                <div className="pg-intake-edit-grid" style={{ marginTop: "10px" }}>
                  <div className="pg-intake-field">
                    <label htmlFor="pg-intake-topic">PPT 主标题</label>
                    <input
                      id="pg-intake-topic"
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>
                  <div className="pg-intake-field">
                    <label htmlFor="pg-intake-subtitle">副标题</label>
                    <input
                      id="pg-intake-subtitle"
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                    />
                  </div>
                  <div className="pg-intake-field">
                    <label htmlFor="pg-intake-audience">目标受众</label>
                    <input
                      id="pg-intake-audience"
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                    />
                  </div>
                  <div className="pg-intake-field">
                    <label htmlFor="pg-intake-slide-count">页数</label>
                    <input
                      id="pg-intake-slide-count"
                      type="number"
                      min={5}
                      max={20}
                      value={slideCount}
                      onChange={(e) =>
                        setSlideCount(
                          Math.max(5, Math.min(20, Number(e.target.value) || 8))
                        )
                      }
                    />
                  </div>
                </div>

                {parsed.analysis.keySections.length > 0 && (
                  <ul className="pg-intake-sections-list">
                    {parsed.analysis.keySections.map((sec, idx) => (
                      <li key={`${sec.heading}-${idx}`}>
                        <strong>
                          {idx + 1}. {sec.heading}
                        </strong>
                        <span>{sec.summary}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>

            {/* Section 1: Top 3 Recommended Styles with 2-Slide Calibration Proof */}
            {(() => {
              const repSlideType: SlideType =
                parsed.analysis.representativeSlideType || "data";
              const activeProofType: SlideType =
                proofSlideMode === "cover" ? "cover" : repSlideType;
              const repLabel = (
                SLIDE_TYPE_LABELS[repSlideType]?.label || "内容页"
              ).replace(/页$/, "");

              return (
                <section id="pg-intake-rec-styles">
                  <div
                    className="pg-intake-section-head"
                    style={{ marginBottom: "10px" }}
                  >
                    <h3>
                      <span className="pg-intake-step-badge">1</span>
                      <span>推荐风格 Top 3</span>
                    </h3>

                    <div className="pg-intake-proof-controls">
                      <div
                        className="pg-intake-proof-switch"
                        role="tablist"
                        aria-label="双样张风格校准切换"
                      >
                        <button
                          type="button"
                          role="tab"
                          id="pg-intake-proof-cover"
                          aria-selected={proofSlideMode === "cover"}
                          className={`pg-intake-proof-tab ${
                            proofSlideMode === "cover" ? "is-active" : ""
                          }`}
                          onClick={() => setProofSlideMode("cover")}
                        >
                          封面样张
                        </button>
                        <button
                          type="button"
                          role="tab"
                          id="pg-intake-proof-content"
                          aria-selected={proofSlideMode === "content"}
                          className={`pg-intake-proof-tab ${
                            proofSlideMode === "content" ? "is-active" : ""
                          }`}
                          onClick={() => setProofSlideMode("content")}
                        >
                          {repLabel}样张
                        </button>
                      </div>

                      <button
                        type="button"
                        id="pg-intake-compare-top3-btn"
                        className="pg-btn pg-btn-secondary pg-btn-xs"
                        onClick={handleCompareTop3}
                      >
                        <Columns3 size={13} />
                        <span>对比 Top 3</span>
                      </button>
                    </div>
                  </div>

                  <div className="pg-intake-rec-grid">
                    {recommendedEntries.map(({ match, prompt }, idx) => {
                      const isSelected = prompt.slug === selectedPrompt.slug;
                      return (
                        <div
                          key={prompt.id}
                          data-style-slug={prompt.slug}
                          className={`pg-intake-rec-card ${
                            isSelected ? "is-selected" : ""
                          }`}
                          onClick={() => setSelectedSlug(prompt.slug)}
                        >
                          <div className="pg-intake-rec-top">
                            <span className="pg-intake-rank-pill">
                              {idx === 0 ? "首选 #1" : `推荐 #${idx + 1}`}
                            </span>
                            <span className="pg-intake-score-pill">
                              {match.score}%
                            </span>
                          </div>

                          <div className="pg-intake-rec-canvas">
                            <div
                              className="pg-canvas-motion-slot"
                              key={`${prompt.id}-${activeProofType}`}
                            >
                              <SlideCanvas
                                spec={prompt.visualSpec}
                                slideType={activeProofType}
                                topic={topic || parsed.suggestedTopic}
                                subtitle={subtitle || parsed.suggestedSubtitle}
                                englishTitle={prompt.englishTitle}
                                scenario={prompt.scenario}
                              />
                            </div>
                          </div>

                      <h4 className="pg-intake-rec-title">{prompt.title}</h4>
                      <p
                        className="pg-intake-rec-reason"
                        title={match.reasons.join(" · ")}
                      >
                        {match.reasons[0] || prompt.scenario}
                      </p>

                      <div className="pg-intake-rec-actions">
                        <button
                          type="button"
                          className={`pg-btn pg-btn-xs pg-btn-flex ${
                            isSelected ? "pg-btn-primary" : "pg-btn-secondary"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlug(prompt.slug);
                          }}
                        >
                          {isSelected ? (
                            <>
                              <Check size={12} />
                              <span>已选中</span>
                            </>
                          ) : (
                            <span>选用</span>
                          )}
                        </button>
                        <button
                          type="button"
                          className="pg-btn pg-btn-primary pg-btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAutoGeneratePpt(prompt.slug);
                          }}
                        >
                          <Sparkles size={12} />
                          <span>生成 PPT</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                  </div>
                </section>
              );
            })()}

            {/* Section 2: Document-Enriched 6-Tool Prompt Compiler */}
            <section
              className="pg-intake-prompt-box"
              id="pg-intake-prompt-panel"
            >
              <div className="pg-intake-section-head">
                <h3>
                  <span className="pg-intake-step-badge">2</span>
                  <span>融合提示词 · {selectedPrompt.title}</span>
                </h3>

                <div className="pg-intake-prompt-controls">
                  <select
                    id="pg-intake-style-select"
                    className="pg-select"
                    aria-label="切换任意全站风格编译提示词"
                    value={selectedPrompt.slug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                  >
                    {groupedStyles.map((g) => (
                      <optgroup
                        key={g.label}
                        label={`${g.label} (${g.items.length})`}
                      >
                        {g.items.map((st) => (
                          <option key={st.id} value={st.slug}>
                            {st.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <select
                    id="pg-intake-lang-select"
                    className="pg-select"
                    aria-label="提示词输出语言"
                    value={language}
                    onChange={(e) =>
                      setLanguage(e.target.value as "zh" | "en" | "bilingual")
                    }
                  >
                    <option value="zh">全中文</option>
                    <option value="bilingual">中英双语</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="pg-intake-tool-bar">
                <div
                  className="pg-intake-tool-tabs"
                  role="tablist"
                  aria-label="切换目标 AI PPT 工具"
                >
                  {TOOL_LIST.map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      role="tab"
                      id={`pg-intake-tool-${tool}`}
                      aria-selected={targetTool === tool}
                      className={`pg-mini-pill ${
                        targetTool === tool ? "is-active" : ""
                      }`}
                      onClick={() => setTargetTool(tool)}
                    >
                      {TOOL_METADATA[tool].shortName}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                id="pg-intake-compiled-prompt"
                className="pg-intake-compiled-textarea"
                readOnly
                value={compiledPrompt}
                rows={9}
              />

              <div className="pg-intake-footer">
                <span className="pg-intake-footer-meta">
                  <Layers
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: "5px" }}
                  />
                  {compiledPrompt.length} 字符 · 含 {parsed.analysis.keySections.length} 章节与{" "}
                  {parsed.analysis.keyMetrics.length} 组数据
                </span>

                <div className="pg-btn-group">
                  <Link
                    href={`/studio/${selectedPrompt.slug}`}
                    className="pg-btn pg-btn-ghost pg-btn-sm"
                    onClick={onClose}
                  >
                    <span>工作室</span>
                    <ArrowUpRight size={14} />
                  </Link>
                  <button
                    type="button"
                    id="pg-intake-download-prompt-btn"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    onClick={handleDownloadPrompt}
                  >
                    <Download size={14} />
                    <span>.md</span>
                  </button>
                  <button
                    type="button"
                    id="pg-intake-copy-prompt-btn"
                    className="pg-btn pg-btn-primary pg-btn-sm"
                    onClick={handleCopyPrompt}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>
                      {copied
                        ? "已复制"
                        : `复制 ${TOOL_METADATA[targetTool].shortName} 提示词`}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
