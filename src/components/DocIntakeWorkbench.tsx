"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
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
import {
  DOMAIN_TABS,
  TOOL_METADATA,
  type DocumentAnalysisResult,
  type OutlineDraftItem,
  type PromptItem,
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
    id: "nsfc",
    label: "国自然基金申请书",
    fileName: "2026国家自然科学基金面上项目申请书.txt",
    text: `面向多模态单细胞空间转录组的跨尺度稀疏图推理方法研究
国家自然科学基金面上项目立项依据与技术路线汇报

一、立项依据与关键科学问题
当前空间转录组测序通量持续攀升，但跨组织切片的批次漂移与细胞微环境非线性耦合导致传统图神经网络泛化能力下降 31.4%。本课题拟解决“异质空间微环境如何实现跨批次可解释因果表征”这一关键科学问题，提出物理先验约束的双曲稀疏图注意假说。

二、研究内容与技术路线
1. 构建跨模态对齐编码器：融合组织病理 H&E 图像与 10x Visium 基因表达矩阵，显存占用降低 48%。
2. 设计层次化稀疏消息传递网络：在 14 个公开肿瘤微环境队列中实现细胞亚群识别准确率 94.6%（p < 0.001）。
3. 建立可解释靶点筛选流程：结合消融实验与湿实验免疫荧光验证，定位 6 个关键免疫浸润调控轴。

三、前期研究基础与预期成果
课题组近三年发表中科院一区 SCI 论文 12 篇，已完成 3.2x 推理加速原型验证与 85 万细胞预训练底座，预计申请国家发明专利 4 项并开源标准评测基准数据集。`,
  },
  {
    id: "teaching",
    label: "高中物理公开课教案",
    fileName: "高一物理-牛顿第二定律公开课教案.txt",
    text: `牛顿第二定律：加速度与力、质量的定量探究
高一物理必修一市级公开课教学设计（45 分钟）

一、教学目标与学情分析
学生已掌握加速度概念与受力分析基础，但在“控制变量法处理非线性 1/m 图像”上存在认知难点。本节目标是在 45 分钟课堂互动中，引导同学自主设计实验并得出 F = ma 的定量规律，课堂达成率目标 92%。

二、情境导入与生活设问
对比重载卡车与空载跑车在绿灯起步时的速度变化，抛出核心问题：加速度究竟受哪些物理量控制？

三、分组实验探究与板书重难点
1. 保持小车质量不变，改变槽码拉力进行 5 组测量，绘制 a-F 线性关系图。
2. 保持拉力不变，增加配重改变质量，引导将 a-m 曲线化曲为直转化为 a-1/m 直线。
3. 板书强调瞬时性、矢量性与同体性三大核心要点。

四、随堂例题与分层课后作业
通过 2 道梯度随堂辨析题即时检验重难点，课后布置基础巩固题与“电梯超重失重手机传感器测量”拓展实践任务。`,
  },
  {
    id: "biz",
    label: "Q4 商业增长复盘",
    fileName: "2026Q4商业增长与毛利重构复盘.txt",
    text: `2026 Q4 商业增长与毛利重构经营复盘
向董事会与核心管理层提交的战略诊断与 2027 行动方案

一、季度核心经营结果
本季度公司总 ARR 达到 ¥1.86 亿，同比增长 64%；综合毛利率提升至 76.4%（环比 +5.8pp）；大客户净留存率 NDR 稳定在 124%，回款周期缩短 18 天。

二、增长引擎与结构性瓶颈
AI 行业套件已成为第一大增量来源，贡献 58% 新增订单；但中小客群获客成本同比上升 22%，且私有化交付人力占比仍偏高，制约区域团队人效释放。

三、市场格局与竞争壁垒诊断
对比三家头部竞品，我们在垂直行业知识图谱与本地化合规部署上具备 12 个月先发窗口，但生态插件市场覆盖率落后 15 个百分点。

四、2027 Q1 战略建议与降本路线
1. 全面推行标准化 SaaS 交付模板，目标将单项目实施周期从 42 天压降至 16 天，运营成本下降 28%。
2. 聚焦 120 家年客单价超 80 万的头部 KA，启动联合标杆共创计划与续费健康度红黄绿预警机制。`,
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
      keyMetrics: parsed.analysis.keyMetrics,
      keySections: parsed.analysis.keySections,
      excerpt: parsed.text.slice(0, 1400),
    };
  }, [parsed]);

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
      parsedOutline: parsed.parsedOutline,
      analysis: parsed.analysis,
    });

    onClose();
    router.push(
      `/generate?style=${encodeURIComponent(chosenSlug)}&intake=1`
    );
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
        {/* Header */}
        <div className="pg-intake-head-row">
          <div>
            <p className="pg-kicker" style={{ marginBottom: "4px" }}>
              DROP-A-DOC INTELLIGENT PPT HUB · 资料直通车
            </p>
            <h2 id="pg-intake-title" className="pg-modal-title">
              丢入 PDF / Word / TXT，一站式推荐风格 · 生成提示词 · 自动整理 PPT
            </h2>
            <p className="pg-modal-sub">
              自动识别文档场景、提炼关键数字与章节骨架，从 {prompts.length}{" "}
              套视觉系统中匹配 Top 3 风格，一键直出可编辑 .pptx 或带真实资料的 6 工具提示词。
            </p>
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
              <span>上传文档 (.pdf / .docx / .txt / .md / .pptx)</span>
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
              <span>直接粘贴笔记/大纲</span>
            </button>
          </div>

          <div className="pg-intake-samples">
            <span className="pg-intake-sample-label">快速体验示例资料：</span>
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
                <FileUp size={parsed ? 16 : 20} />
              </span>
              <div>
                <div className="pg-intake-drop-title">
                  {parsed
                    ? `已解析「${parsed.fileName}」—— 拖拽或点击可随时更换新资料`
                    : "将 PDF、Word (.docx)、TXT、Markdown 或旧 PPTX 拖到这里"}
                </div>
                <div className="pg-intake-drop-sub">
                  最大支持 10MB · 纯本地与服务端即时解析，不落盘留存您的私有文稿
                </div>
              </div>
            </div>
            <button
              type="button"
              id="pg-intake-upload-btn"
              className="pg-btn pg-btn-secondary pg-btn-sm"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              <span>{parsing ? "解析识别中..." : parsed ? "更换文档" : "选择文档"}</span>
            </button>
          </div>
        ) : (
          <div className="pg-intake-paste-box">
            <textarea
              id="pg-intake-paste-textarea"
              className="pg-intake-paste-textarea"
              placeholder="在此粘贴你的论文摘要、教案讲义、项目周报、会议纪要或商业计划书正文，系统将自动识别领域并推荐 Top 3 PPT 风格与专属提示词..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="pg-intake-paste-foot">
              <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                当前已输入 {pasteText.trim().length} 字
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
                <span>立即智能识别并推荐风格</span>
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
            {/* Analysis Insight Strip */}
            <div className="pg-intake-insight" id="pg-intake-insight-bar">
              <div className="pg-intake-insight-top">
                <div className="pg-intake-badges">
                  <span className="pg-intake-file-pill" title={parsed.fileName}>
                    <FileText size={12} />
                    <span>
                      {parsed.fileName.length > 22
                        ? `${parsed.fileName.slice(0, 20)}…`
                        : parsed.fileName}
                      （{parsed.charCount} 字）
                    </span>
                  </span>
                  <span
                    className="pg-intake-scene-pill"
                    id="pg-intake-detected-scenario"
                  >
                    <Sparkles size={12} />
                    <span>
                      场景：{parsed.analysis.detectedScenario}（
                      {parsed.analysis.confidence}%）
                    </span>
                  </span>
                  <span className="pg-intake-domain-pill">
                    {parsed.analysis.detectedDomainLabel}
                  </span>
                </div>
                <button
                  type="button"
                  className="pg-btn pg-btn-primary pg-btn-sm"
                  id="pg-intake-auto-gen-btn"
                  onClick={() => handleAutoGeneratePpt()}
                >
                  <Sparkles size={14} />
                  <span>一键自动整理生成整套 PPT (.pptx)</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="pg-intake-edit-grid">
                <div className="pg-intake-field">
                  <label htmlFor="pg-intake-topic">提炼 PPT 主标题（可改）</label>
                  <input
                    id="pg-intake-topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
                <div className="pg-intake-field">
                  <label htmlFor="pg-intake-subtitle">副标题 / 叙事摘要</label>
                  <input
                    id="pg-intake-subtitle"
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>
                <div className="pg-intake-field">
                  <label htmlFor="pg-intake-audience">推荐受众</label>
                  <input
                    id="pg-intake-audience"
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>
                <div className="pg-intake-field">
                  <label htmlFor="pg-intake-slide-count">建议页数</label>
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

              {parsed.analysis.keyMetrics.length > 0 && (
                <div className="pg-intake-metrics-row">
                  <span className="pg-intake-metric-label">
                    提炼出 {parsed.analysis.keyMetrics.length} 组量化指标：
                  </span>
                  {parsed.analysis.keyMetrics.map((m, idx) => (
                    <span key={`${m}-${idx}`} className="pg-intake-metric-chip">
                      {m}
                    </span>
                  ))}
                </div>
              )}

              {parsed.analysis.keySections.length > 0 && (
                <details className="pg-intake-sections-details">
                  <summary>
                    查看系统提炼的 {parsed.analysis.keySections.length}{" "}
                    段核心章节结构（将自动注入 PPT 页面与提示词）
                  </summary>
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
                </details>
              )}
            </div>

            {/* Section 1: Top 3 Recommended Styles with Live 16:9 Canvas */}
            <section id="pg-intake-rec-styles">
              <div className="pg-intake-section-head" style={{ marginBottom: "10px" }}>
                <h3>
                  <span className="pg-intake-step-badge">1</span>
                  <span>
                    智能推荐最匹配的 Top 3 PPT 视觉风格（点击切换即可实时刷新下方提示词）
                  </span>
                </h3>
                <button
                  type="button"
                  id="pg-intake-compare-top3-btn"
                  className="pg-btn pg-btn-secondary pg-btn-xs"
                  onClick={handleCompareTop3}
                >
                  <Columns3 size={13} />
                  <span>把 Top 3 送入并排对比台</span>
                </button>
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
                          {idx === 0 ? "首选推荐 #1" : `推荐 #${idx + 1}`}
                        </span>
                        <span className="pg-intake-score-pill">
                          匹配度 {match.score}%
                        </span>
                      </div>

                      <div className="pg-intake-rec-canvas">
                        <SlideCanvas
                          spec={prompt.visualSpec}
                          slideType="cover"
                          topic={topic || parsed.suggestedTopic}
                          subtitle={subtitle || parsed.suggestedSubtitle}
                          englishTitle={prompt.englishTitle}
                          scenario={prompt.scenario}
                        />
                      </div>

                      <h4 className="pg-intake-rec-title">{prompt.title}</h4>
                      <p className="pg-intake-rec-reason">
                        {match.reasons.join(" · ")}
                      </p>

                      <div className="pg-intake-rec-actions">
                        <button
                          type="button"
                          className={`pg-btn pg-btn-xs pg-btn-flex ${
                            isSelected ? "pg-btn-ink" : "pg-btn-secondary"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlug(prompt.slug);
                          }}
                        >
                          {isSelected ? (
                            <>
                              <Check size={12} />
                              <span>已选中出词</span>
                            </>
                          ) : (
                            <span>选用此风格</span>
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
                          <span>直接生成 PPT</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Section 2: Document-Enriched 6-Tool Prompt Compiler */}
            <section
              className="pg-intake-prompt-box"
              id="pg-intake-prompt-panel"
            >
              <div className="pg-intake-section-head">
                <h3>
                  <span className="pg-intake-step-badge">2</span>
                  <span>
                    融合源文档素材的专属提示词（当前风格：{selectedPrompt.title}）
                  </span>
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
                    <option value="zh">全中文演示</option>
                    <option value="bilingual">中英双语</option>
                    <option value="en">全英文演示</option>
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
                rows={11}
              />

              <div className="pg-intake-footer">
                <span className="pg-intake-footer-meta">
                  <Layers
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: "5px" }}
                  />
                  共 {compiledPrompt.length} 字符 · 已自动嵌入源文档{" "}
                  {parsed.analysis.keySections.length} 段章节、
                  {parsed.analysis.keyMetrics.length} 组数字与「
                  {parsed.analysis.detectedScenario}」领域防幻觉护栏
                </span>

                <div className="pg-btn-group">
                  <Link
                    href={`/studio/${selectedPrompt.slug}`}
                    className="pg-btn pg-btn-ghost pg-btn-sm"
                    onClick={onClose}
                  >
                    <span>工作室微调色板</span>
                    <ArrowUpRight size={14} />
                  </Link>
                  <button
                    type="button"
                    id="pg-intake-download-prompt-btn"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    onClick={handleDownloadPrompt}
                  >
                    <Download size={14} />
                    <span>下载 .md</span>
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
                        ? "已复制融合提示词"
                        : `一键复制 ${TOOL_METADATA[targetTool].shortName} 提示词`}
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
