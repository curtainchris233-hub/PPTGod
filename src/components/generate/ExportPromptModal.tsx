"use client";

import React, { useMemo, useState } from "react";
import { Check, Copy, Download, FileCode, X } from "lucide-react";
import {
  compileDeckToMarpMarkdown,
  compileRealDeckPrompt,
} from "@/lib/promptCompiler";
import type { DeckSlideItem, VisualSpec } from "@/types/prompt";

type ExportMode = "marp" | "claude-html" | "gamma-kimi";

interface ExportPromptModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  audience: string;
  styleName: string;
  spec: VisualSpec;
  slides: DeckSlideItem[];
  onNotify: (msg: string, tone?: "default" | "success" | "error") => void;
}

export default function ExportPromptModal({
  open,
  onClose,
  title,
  subtitle,
  audience,
  styleName,
  spec,
  slides,
  onNotify,
}: ExportPromptModalProps) {
  const [mode, setMode] = useState<ExportMode>("marp");
  const [copied, setCopied] = useState(false);

  const outputText = useMemo(() => {
    const baseOpts = { title, subtitle, audience, styleName, spec, slides };
    if (mode === "marp") {
      return compileDeckToMarpMarkdown(baseOpts);
    }
    return compileRealDeckPrompt({ ...baseOpts, target: mode });
  }, [mode, title, subtitle, audience, styleName, spec, slides]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      onNotify(
        mode === "marp"
          ? "已复制可运行 Marp / Slidev Markdown 全文"
          : "已复制真实文稿精准 AI 提示词",
        "success"
      );
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotify("剪贴板权限受限，请手动全选文本框复制", "error");
    }
  };

  const handleDownload = () => {
    const ext = mode === "marp" ? "marp.md" : `${mode}-prompt.md`;
    const safeName = (title || "pptgod-deck")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .slice(0, 36);
    const blob = new Blob([outputText], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`已下载 ${safeName}.${ext}`, "success");
  };

  return (
    <div
      className="pg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="导出真实文稿 Marp Markdown 与精准提示词"
      id="pg-export-prompt-modal"
      onClick={onClose}
    >
      <div
        className="pg-export-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pg-export-modal-head">
          <div className="pg-panel-title-wrap">
            <FileCode size={16} style={{ color: "var(--accent)" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: "15px" }}>
                真实文稿一键导出（Marp Markdown / AI 精准提示词）
              </h3>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: "var(--ink-muted)",
                }}
              >
                基于当前已编辑的 {slides.length} 页真实标题、KPI 数值、讲稿备注与
                VisualSpec 色卡实时编译
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pg-gen-mini-icon"
            onClick={onClose}
            aria-label="关闭导出弹窗"
            id="pg-export-modal-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        <div className="pg-export-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            id="pg-export-tab-marp"
            aria-selected={mode === "marp"}
            className={`pg-mini-pill ${mode === "marp" ? "is-active" : ""}`}
            onClick={() => setMode("marp")}
          >
            Marp / Slidev 可运行源码 (.md)
          </button>
          <button
            type="button"
            role="tab"
            id="pg-export-tab-claude"
            aria-selected={mode === "claude-html"}
            className={`pg-mini-pill ${
              mode === "claude-html" ? "is-active" : ""
            }`}
            onClick={() => setMode("claude-html")}
          >
            Claude HTML 真实文稿提示词
          </button>
          <button
            type="button"
            role="tab"
            id="pg-export-tab-gamma"
            aria-selected={mode === "gamma-kimi"}
            className={`pg-mini-pill ${
              mode === "gamma-kimi" ? "is-active" : ""
            }`}
            onClick={() => setMode("gamma-kimi")}
          >
            Gamma / Kimi 定稿导入指令
          </button>
        </div>

        <textarea
          id="pg-export-modal-textarea"
          className="pg-export-modal-textarea"
          readOnly
          value={outputText}
          rows={15}
        />

        <div className="pg-export-modal-foot">
          <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
            共 {outputText.length} 字符 · 含 {slides.length} 页完整结构与色卡 Token
          </span>
          <div className="pg-btn-group">
            <button
              type="button"
              id="pg-export-modal-download-btn"
              className="pg-btn pg-btn-secondary pg-btn-sm"
              onClick={handleDownload}
            >
              <Download size={14} />
              <span>下载 .md</span>
            </button>
            <button
              type="button"
              id="pg-export-modal-copy-btn"
              className="pg-btn pg-btn-primary pg-btn-sm"
              onClick={handleCopy}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "已复制全文" : "一键复制全文"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
