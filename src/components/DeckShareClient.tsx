"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileCode2,
  FileSpreadsheet,
  Globe,
  Lock,
  MessageSquareText,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { useApp } from "@/context/AppContext";
import { exportStandaloneHtmlDeck } from "@/lib/htmlExporter";
import { SLIDE_TYPE_LABELS, type SavedDeck } from "@/types/prompt";
import "@/styles/deck-share.css";

interface DeckShareClientProps {
  deck: SavedDeck;
}

const TIMER_PRESETS: { seconds: number; label: string }[] = [
  { seconds: 0, label: "正计时" },
  { seconds: 300, label: "5分" },
  { seconds: 600, label: "10分答辩" },
  { seconds: 900, label: "15分课堂" },
  { seconds: 1800, label: "30分汇报" },
];

function formatClock(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  const abs = Math.abs(Math.trunc(totalSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${neg ? "-" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DeckShareClient({ deck }: DeckShareClientProps) {
  const { showToast } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [targetSeconds, setTargetSeconds] = useState<number>(600);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [teleprompterFontPx, setTeleprompterFontPx] = useState<number>(17);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const total = Math.max(1, deck.slides.length);
  const safeIndex = Math.max(0, Math.min(activeIndex, total - 1));
  const currentSlide = deck.slides[safeIndex];
  const nextSlide = safeIndex < total - 1 ? deck.slides[safeIndex + 1] : null;

  const goPrev = useCallback(() => {
    setActiveIndex((cur) => Math.max(0, cur - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((cur) => Math.min(total - 1, cur + 1));
  }, [total]);

  // Rehearsal timer tick (async interval callback — React 19 ESLint clean)
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(total - 1);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setShowNotes((v) => !v);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setRehearsalMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, total]);

  const timerDisplay = useMemo(() => {
    if (targetSeconds === 0) {
      return {
        clock: formatClock(elapsedSeconds),
        state: "normal" as const,
        pct: Math.min(100, Math.round(((safeIndex + 1) / total) * 100)),
        hint: "自由正计时模式",
      };
    }
    const remaining = targetSeconds - elapsedSeconds;
    const pct = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100));
    const perSlideSec = Math.max(15, Math.round(targetSeconds / total));
    if (remaining < 0) {
      return {
        clock: formatClock(remaining),
        state: "overtime" as const,
        pct: 100,
        hint: `已超时 ${formatClock(Math.abs(remaining))} · 建议收束总结`,
      };
    }
    if (remaining <= targetSeconds * 0.2) {
      return {
        clock: formatClock(remaining),
        state: "warning" as const,
        pct,
        hint: `剩余不足 20% · 均页约 ${perSlideSec} 秒`,
      };
    }
    return {
      clock: formatClock(remaining),
      state: "normal" as const,
      pct,
      hint: `目标 ${Math.round(targetSeconds / 60)} 分钟 · 均页配时约 ${perSlideSec} 秒`,
    };
  }, [targetSeconds, elapsedSeconds, safeIndex, total]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (delta < -48) goNext();
    if (delta > 48) goPrev();
  };

  const handleExportHtml = () => {
    const html = exportStandaloneHtmlDeck({
      title: deck.title,
      subtitle: deck.subtitle,
      audience: deck.audience,
      styleName: deck.promptTitle,
      spec: deck.visualSpec,
      slides: deck.slides,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.slice(0, 32) || "pptgod-deck"}-interactive.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("已导出离线交互 .html 演示文件", "success");
  };

  const handleExportPptx = async () => {
    if (exportingPptx) return;
    setExportingPptx(true);
    try {
      const res = await fetch("/api/export/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deck.title,
          subtitle: deck.subtitle,
          audience: deck.audience,
          styleName: deck.promptTitle,
          visualSpec: deck.visualSpec,
          slides: deck.slides,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "导出 .pptx 失败", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.title.slice(0, 32) || "pptgod-deck"}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("已生成并下载原生 16:9 .pptx 文件", "success");
    } catch {
      showToast("导出 .pptx 网络异常", "error");
    } finally {
      setExportingPptx(false);
    }
  };

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      showToast("已复制演播分享链接", "success");
      window.setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      showToast("剪贴板权限受限，请直接复制地址栏链接", "error");
    }
  };

  return (
    <main className="pg-share-page" id="pg-deck-share-stage">
      {/* Theater Header Bar */}
      <header className="pg-share-topbar">
        <div className="pg-share-topbar-inner">
          <div className="pg-share-meta">
            <div className="pg-share-title-row">
              <h1 className="pg-share-title" id="pg-share-deck-title">
                {deck.title}
              </h1>
              <span
                className={`pg-share-badge ${deck.isPublic ? "" : "is-private"}`}
              >
                {deck.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                <span>{deck.isPublic ? "公开演播分享" : "私有作者预览"}</span>
              </span>
              <span className="pg-share-badge">
                {safeIndex + 1} / {total}
              </span>
            </div>
            <p className="pg-share-sub">
              母版风格：{deck.promptTitle}
              {deck.audience ? ` · 面向：${deck.audience}` : ""}
            </p>
          </div>

          <div className="pg-share-actions">
            <button
              type="button"
              id="pg-share-rehearsal-btn"
              className={`pg-share-btn ${rehearsalMode ? "is-active" : ""}`}
              onClick={() => setRehearsalMode((v) => !v)}
              title="开启演讲排练提词驾驶舱（快捷键 P）"
            >
              <Presentation size={14} />
              <span>排练提词 (P)</span>
            </button>

            <button
              type="button"
              id="pg-share-notes-btn"
              className={`pg-share-btn ${showNotes ? "is-active" : ""}`}
              onClick={() => setShowNotes((v) => !v)}
            >
              <MessageSquareText size={14} />
              <span>演讲备注 (N)</span>
            </button>

            <button
              type="button"
              id="pg-share-copy-btn"
              className="pg-share-btn"
              onClick={handleCopyShareUrl}
            >
              {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedUrl ? "已复制" : "复制链接"}</span>
            </button>

            <button
              type="button"
              id="pg-share-export-html-btn"
              className="pg-share-btn"
              onClick={handleExportHtml}
            >
              <FileCode2 size={14} />
              <span>.html</span>
            </button>

            <button
              type="button"
              id="pg-share-export-pptx-btn"
              className="pg-share-btn"
              onClick={handleExportPptx}
              disabled={exportingPptx}
            >
              <FileSpreadsheet size={14} />
              <span>{exportingPptx ? "导出中..." : ".pptx"}</span>
            </button>

            <Link
              href={`/generate?deck=${encodeURIComponent(deck.id)}`}
              id="pg-share-clone-btn"
              className="pg-share-btn pg-share-btn-primary"
            >
              <Sparkles size={14} />
              <span>克隆到工坊编辑</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main 16:9 Theater Canvas OR Split Presenter Rehearsal Cockpit */}
      <section
        className="pg-share-theater"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={
            rehearsalMode ? "pg-share-cockpit-grid" : "pg-share-stage-shell"
          }
        >
          <div className={rehearsalMode ? "pg-share-cockpit-main" : "pg-share-stage-row"}>
            <button
              type="button"
              id="pg-share-prev-btn"
              className="pg-share-nav-arrow"
              onClick={goPrev}
              disabled={safeIndex === 0}
              aria-label="上一页"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="pg-share-canvas-frame">
              {currentSlide && (
                <SlideCanvas
                  spec={deck.visualSpec}
                  slideType={currentSlide.slideType}
                  topic={deck.title}
                  subtitle={deck.subtitle}
                  audience={deck.audience}
                  slideCount={total}
                  slideData={currentSlide}
                  pageIndex={safeIndex}
                  totalPages={total}
                />
              )}
            </div>

            <button
              type="button"
              id="pg-share-next-btn"
              className="pg-share-nav-arrow"
              onClick={goNext}
              disabled={safeIndex >= total - 1}
              aria-label="下一页"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {rehearsalMode && (
            <aside
              className="pg-rehearsal-panel"
              id="pg-rehearsal-cockpit"
              aria-label="演讲排练提词驾驶舱"
            >
              {/* Timer & Pacing Card */}
              <div className="pg-rehearsal-card">
                <div className="pg-rehearsal-card-head">
                  <span className="pg-rehearsal-kicker">
                    <Clock size={12} />
                    <span>演讲计时与节奏控制</span>
                  </span>
                  <div className="pg-rehearsal-timer-actions">
                    <button
                      type="button"
                      id="pg-rehearsal-timer-toggle"
                      className="pg-share-btn pg-rehearsal-mini-btn"
                      onClick={() => setTimerRunning((r) => !r)}
                    >
                      {timerRunning ? <Pause size={12} /> : <Play size={12} />}
                      <span>{timerRunning ? "暂停" : "开始"}</span>
                    </button>
                    <button
                      type="button"
                      id="pg-rehearsal-timer-reset"
                      className="pg-share-btn pg-rehearsal-mini-btn"
                      onClick={() => {
                        setTimerRunning(false);
                        setElapsedSeconds(0);
                      }}
                      aria-label="重置计时器"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>

                <div
                  id="pg-rehearsal-clock"
                  className={`pg-rehearsal-clock is-${timerDisplay.state}`}
                >
                  {timerDisplay.clock}
                </div>

                <div className="pg-rehearsal-progress-track">
                  <div
                    className={`pg-rehearsal-progress-fill is-${timerDisplay.state}`}
                    style={{ width: `${timerDisplay.pct}%` }}
                  />
                </div>
                <p className="pg-rehearsal-hint">{timerDisplay.hint}</p>

                <div className="pg-rehearsal-presets" role="group" aria-label="计时目标预设">
                  {TIMER_PRESETS.map((preset) => (
                    <button
                      key={preset.seconds}
                      type="button"
                      data-timer-preset={preset.seconds}
                      className={`pg-rehearsal-preset-btn ${
                        targetSeconds === preset.seconds ? "is-active" : ""
                      }`}
                      onClick={() => {
                        setTargetSeconds(preset.seconds);
                        setElapsedSeconds(0);
                        setTimerRunning(false);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Teleprompter Notes Card */}
              <div className="pg-rehearsal-card pg-rehearsal-teleprompter">
                <div className="pg-rehearsal-card-head">
                  <span className="pg-rehearsal-kicker">
                    P{String(safeIndex + 1).padStart(2, "0")} 提词讲稿
                  </span>
                  <div className="pg-rehearsal-font-btns">
                    <button
                      type="button"
                      id="pg-teleprompter-font-dec"
                      className="pg-rehearsal-preset-btn"
                      onClick={() =>
                        setTeleprompterFontPx((v) => Math.max(13, v - 2))
                      }
                    >
                      A-
                    </button>
                    <button
                      type="button"
                      id="pg-teleprompter-font-inc"
                      className="pg-rehearsal-preset-btn"
                      onClick={() =>
                        setTeleprompterFontPx((v) => Math.min(26, v + 2))
                      }
                    >
                      A+
                    </button>
                  </div>
                </div>
                <p
                  id="pg-rehearsal-notes-text"
                  className="pg-rehearsal-notes-body"
                  style={{ fontSize: `${teleprompterFontPx}px` }}
                >
                  {currentSlide?.speakerNotes?.trim() ||
                    "本页尚未填写演讲者备注。建议在 /generate 工坊中点击「整套 PPT 智能体检 → 一键补齐讲稿」。"}
                </p>
              </div>

              {/* Next Slide Thumbnail Preview */}
              <div className="pg-rehearsal-card">
                <div className="pg-rehearsal-card-head">
                  <span className="pg-rehearsal-kicker">
                    {nextSlide
                      ? `下一页预告 · P${String(safeIndex + 2).padStart(2, "0")} ${
                          SLIDE_TYPE_LABELS[nextSlide.slideType]?.label || ""
                        }`
                      : "已到达尾页 · 准备收束与问答"}
                  </span>
                </div>
                {nextSlide ? (
                  <button
                    type="button"
                    id="pg-rehearsal-next-preview"
                    className="pg-rehearsal-next-canvas-btn"
                    onClick={goNext}
                    title="点击切换到下一页"
                  >
                    <div className="pg-rehearsal-next-canvas" aria-hidden="true">
                      <SlideCanvas
                        spec={deck.visualSpec}
                        slideType={nextSlide.slideType}
                        topic={deck.title}
                        subtitle={deck.subtitle}
                        audience={deck.audience}
                        slideCount={total}
                        slideData={nextSlide}
                        pageIndex={safeIndex + 1}
                        totalPages={total}
                      />
                    </div>
                  </button>
                ) : (
                  <p className="pg-rehearsal-hint" style={{ margin: "6px 0 0" }}>
                    本页为最后一页，讲完后可留出 2–3 分钟进入听众提问与互动环节。
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Collapsible Speaker Notes Drawer (when not in split Rehearsal mode) */}
        {showNotes && !rehearsalMode && (
          <aside className="pg-share-notes-drawer" id="pg-share-notes-drawer">
            <div className="pg-share-notes-head">
              <span>
                SPEAKER NOTES · P{String(safeIndex + 1).padStart(2, "0")} ·{" "}
                {currentSlide
                  ? SLIDE_TYPE_LABELS[currentSlide.slideType]?.label
                  : ""}
              </span>
              <span>按 N 隐藏</span>
            </div>
            <p className="pg-share-notes-body">
              {currentSlide?.speakerNotes?.trim() ||
                "本页未填写演讲者备注，可点击右上角「克隆到工坊编辑」补充讲稿。"}
            </p>
          </aside>
        )}

        {/* Bottom Filmstrip Jumper */}
        <div className="pg-share-footer-bar">
          <div className="pg-share-filmstrip" role="tablist" aria-label="幻灯片页码导航">
            {deck.slides.map((s, idx) => (
              <button
                key={s.id || idx}
                type="button"
                role="tab"
                aria-selected={idx === safeIndex}
                className={`pg-share-pill ${idx === safeIndex ? "is-active" : ""}`}
                onClick={() => setActiveIndex(idx)}
              >
                <span>{String(idx + 1).padStart(2, "0")}</span>
                <span>{SLIDE_TYPE_LABELS[s.slideType]?.label || s.slideType}</span>
              </button>
            ))}
          </div>
          <div className="pg-share-hint-row">
            <span>快捷键：← / → / Space 翻页 · P 排练提词驾驶舱 · N 演讲备注 · Home / End 首尾页</span>
            <span>PPTGod 纯净演播与排练台 · 只读分享不暴露编辑面板</span>
          </div>
        </div>
      </section>
    </main>
  );
}
