"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  FileJson,
  ImagePlus,
  Palette,
  Plus,
  Presentation,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  X,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { Button } from "@/components/ui";
import { copyTextToClipboard } from "@/lib/clipboard";
import { exportStandaloneHtmlDeck } from "@/lib/htmlExporter";
import { extractStyleFromImageData } from "@/lib/paletteExtractor";
import {
  DESIGN_DIRECTIONS,
  PACK_LAYOUTS,
  PACK_TOOLS,
  autoFixPackStyleContrast,
  directionToStyle,
  evaluatePackStyleContrast,
  extractedPaletteToPackStyle,
  getDesignDirection,
  isWeakTopicTitle,
  newPackSlideId,
  packLayoutLabel,
  packSlideToCanvas,
  packStyleToVisualSpec,
  packToDeckSlides,
  pickPreviewSlides,
  renderChatgptTwoStep,
  renderGammaParts,
  renderMasterPrompt,
  renderOutlineOnlyPrompt,
  renderStyleOnlyPrompt,
  serializePackJson,
  type ChatgptExportMode,
  type PackDatum,
  type PackDensity,
  type PackLanguage,
  type PackLayout,
  type PackSlide,
  type PackTool,
  type PromptPack,
} from "@/lib/promptPack";

/* ------------------------------------------------------------------ style */

const HEX6_RE = /^#[0-9a-fA-F]{6}$/;

export function PackStyleCard({
  pack,
  onChange,
  onToast,
}: {
  pack: PromptPack;
  onChange: (next: PromptPack) => void;
  onToast: (msg: string, tone?: "default" | "success" | "error") => void;
}) {
  const { style } = pack;
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const imgInputRef = useRef<HTMLInputElement | null>(null);

  const contrast = useMemo(() => evaluatePackStyleContrast(style), [style]);

  const copyHex = async (value: string) => {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      setCopied(value);
      window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 1400);
    } else {
      onToast("复制失败，请手动选择色值", "error");
    }
  };

  const restyle = (id: string) => {
    if (id === style.directionId && !style.referenceSlug) return;
    const d = getDesignDirection(id);
    onChange({
      ...pack,
      style: directionToStyle(
        d,
        `已切换为「${d.name}」：${d.keywords.slice(0, 3).join("、")}。内容与逐页大纲保持不变。`
      ),
    });
  };

  const updateColor = (index: number, nextHex: string) => {
    const cleaned = nextHex.trim().toUpperCase();
    const colors = style.colors.map((c, i) => (i === index ? { ...c, hex: cleaned } : c));
    const chartColors =
      index === 4 && HEX6_RE.test(cleaned)
        ? [cleaned, ...style.chartColors.slice(1)]
        : index === 5 && HEX6_RE.test(cleaned)
          ? [style.chartColors[0] ?? cleaned, cleaned, ...style.chartColors.slice(2)]
          : style.chartColors;
    onChange({ ...pack, style: { ...style, colors, chartColors } });
  };

  const handleAutoFixContrast = () => {
    onChange({ ...pack, style: autoFixPackStyleContrast(style) });
    onToast("已按 WCAG 标准自动优化文字与主色对比度", "success");
  };

  const handleReferenceImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onToast("请选择 PNG / JPG / WebP 图片文件", "error");
      return;
    }
    setExtracting(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const maxSide = 160;
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(16, Math.round(img.width * scale));
          const h = Math.max(16, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas unavailable");
          ctx.drawImage(img, 0, 0, w, h);
          const pixels = ctx.getImageData(0, 0, w, h).data;
          const extracted = extractStyleFromImageData(pixels, w, h);
          const nextStyle = extractedPaletteToPackStyle(extracted, style, file.name);
          onChange({ ...pack, style: nextStyle });
          onToast("已从参考图本地提取 6 色色板（未上传图片）", "success");
        } catch {
          onToast("图片吸色失败，请换一张清晰截图或海报", "error");
        } finally {
          setExtracting(false);
        }
      };
      img.onerror = () => {
        setExtracting(false);
        onToast("无法读取图片内容，请检查文件是否损坏", "error");
      };
      img.src = String(reader.result || "");
    };
    reader.onerror = () => {
      setExtracting(false);
      onToast("读取图片失败，请重试", "error");
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="gl-pack-card gl-pack-style" id="pg-pack-style" aria-labelledby="pg-pack-style-title">
      <header className="gl-pack-card-head">
        <div>
          <p className="gl-pack-eyebrow">
            <Palette size={14} aria-hidden="true" /> 定制风格
          </p>
          <h2 className="gl-pack-style-name" id="pg-pack-style-title">
            {style.name}
          </h2>
          <p className="gl-pack-style-ref">参考：{style.reference}</p>
        </div>
        <div className="gl-pack-style-controls">
          <div className="gl-pack-style-mini-btns">
            <input
              ref={imgInputRef}
              id="pg-pack-image-palette-input"
              type="file"
              accept="image/*"
              className="gl-sr-only"
              onChange={handleReferenceImage}
            />
            <button
              type="button"
              id="pg-pack-image-palette-btn"
              className="gl-pack-mini-btn"
              disabled={extracting}
              onClick={() => imgInputRef.current?.click()}
              title="在浏览器本地从参考图/PPT 截图提取 6 色色板（不上传图片）"
            >
              <ImagePlus size={13} aria-hidden="true" />
              {extracting ? "吸色中…" : "参考图吸色"}
            </button>
            <button
              type="button"
              id="pg-pack-style-edit-toggle"
              aria-expanded={editing}
              className={`gl-pack-mini-btn ${editing ? "is-active" : ""}`}
              onClick={() => setEditing((v) => !v)}
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
              {editing ? "收起微调" : "微调风格"}
            </button>
          </div>
          <label className="gl-pack-restyle">
            <span>换一种风格</span>
            <select
              id="pg-pack-restyle-select"
              value={style.directionId}
              onChange={(e) => restyle(e.target.value)}
            >
              {DESIGN_DIRECTIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <p className="gl-pack-rationale">{style.rationale}</p>

      {editing ? (
        <div className="gl-pack-style-editor" id="pg-pack-style-editor">
          <div className="gl-pack-contrast-bar">
            <span className={`gl-pack-contrast-badge is-${contrast.overallGrade.toLowerCase()}`}>
              <ShieldCheck size={13} aria-hidden="true" />
              WCAG {contrast.overallGrade} · 正文 {contrast.textBgRatio}:1 · 主色 {contrast.accentBgRatio}:1
            </span>
            {contrast.overallGrade !== "AAA" ? (
              <button
                type="button"
                id="pg-pack-contrast-fix-btn"
                className="gl-pack-mini-btn"
                onClick={handleAutoFixContrast}
              >
                一键修复对比度
              </button>
            ) : null}
          </div>

          <div className="gl-pack-color-editor-grid">
            {style.colors.map((c, idx) => (
              <label key={c.role} className="gl-pack-color-edit-item">
                <span>{c.role}</span>
                <div className="gl-pack-color-edit-inputs">
                  <input
                    type="color"
                    value={HEX6_RE.test(c.hex) ? c.hex : "#2563EB"}
                    aria-label={`${c.role}取色器`}
                    onChange={(e) => updateColor(idx, e.target.value)}
                  />
                  <input
                    type="text"
                    id={`pg-pack-color-input-${idx}`}
                    value={c.hex}
                    maxLength={7}
                    aria-label={`${c.role} HEX`}
                    onChange={(e) => updateColor(idx, e.target.value)}
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="gl-pack-font-editor-grid">
            <label>
              <span>标题字体</span>
              <input
                id="pg-pack-heading-font"
                value={style.headingFont}
                maxLength={80}
                onChange={(e) => onChange({ ...pack, style: { ...style, headingFont: e.target.value } })}
              />
            </label>
            <label>
              <span>正文字体</span>
              <input
                id="pg-pack-body-font"
                value={style.bodyFont}
                maxLength={80}
                onChange={(e) => onChange({ ...pack, style: { ...style, bodyFont: e.target.value } })}
              />
            </label>
            <label>
              <span>必须遵守（每行一条）</span>
              <textarea
                rows={3}
                value={style.dos.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...pack,
                    style: {
                      ...style,
                      dos: e.target.value
                        .split("\n")
                        .map((l) => l.slice(0, 60))
                        .slice(0, 5),
                    },
                  })
                }
              />
            </label>
            <label>
              <span>必须避免（每行一条）</span>
              <textarea
                rows={3}
                value={style.donts.join("\n")}
                onChange={(e) =>
                  onChange({
                    ...pack,
                    style: {
                      ...style,
                      donts: e.target.value
                        .split("\n")
                        .map((l) => l.slice(0, 60))
                        .slice(0, 5),
                    },
                  })
                }
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="gl-pack-style-grid">
        <div>
          <p className="gl-pack-label">色板 · 点击复制</p>
          <ul className="gl-pack-swatches" aria-label="色板">
            {style.colors.map((c) => (
              <li key={c.role}>
                <button
                  type="button"
                  className="gl-pack-swatch"
                  onClick={() => copyHex(c.hex)}
                  aria-label={`复制${c.role} ${c.hex}`}
                >
                  <span className="gl-pack-swatch-chip" style={{ background: c.hex }}>
                    {copied === c.hex ? <Check size={14} aria-hidden="true" /> : null}
                  </span>
                  <span className="gl-pack-swatch-role">{c.role}</span>
                  <code className="gl-pack-swatch-hex">{c.hex}</code>
                </button>
              </li>
            ))}
          </ul>
          <div className="gl-pack-chartbar" aria-label="图表色序列">
            {style.chartColors.map((c, i) => (
              <span key={`${c}-${i}`} style={{ background: c }} title={c} />
            ))}
            <em>图表色</em>
          </div>
        </div>
        <div className="gl-pack-type">
          <p className="gl-pack-label">
            <Type size={13} aria-hidden="true" /> 字体
          </p>
          <dl>
            <div>
              <dt>标题</dt>
              <dd>{style.headingFont}</dd>
            </div>
            <div>
              <dt>正文</dt>
              <dd>{style.bodyFont}</dd>
            </div>
            <div>
              <dt>数字</dt>
              <dd>{style.numberFont}</dd>
            </div>
          </dl>
          <ul className="gl-pack-keywords">
            {style.keywords.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="gl-pack-rules">
        <div className="gl-pack-rules-col is-do">
          <p>必须</p>
          <ul>
            {style.dos.filter(Boolean).map((d, i) => (
              <li key={`${d}-${i}`}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="gl-pack-rules-col is-dont">
          <p>避免</p>
          <ul>
            {style.donts.filter(Boolean).map((d, i) => (
              <li key={`${d}-${i}`}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- preview */

export function PackPreviewStrip({
  pack,
  activeSlideId,
  onClearActive,
}: {
  pack: PromptPack;
  activeSlideId?: string | null;
  onClearActive?: () => void;
}) {
  const spec = useMemo(() => packStyleToVisualSpec(pack.style), [pack.style]);
  const picks = useMemo(
    () => pickPreviewSlides(pack.slides, activeSlideId),
    [pack.slides, activeSlideId]
  );
  const focusedIdx = activeSlideId
    ? pack.slides.findIndex((s) => s.id === activeSlideId)
    : -1;

  return (
    <section className="gl-pack-card gl-pack-preview" id="pg-pack-preview" aria-label="风格效果预览">
      <header className="gl-pack-card-head is-compact">
        <p className="gl-pack-eyebrow">
          <Presentation size={14} aria-hidden="true" /> 风格示意（站内渲染，外部工具成品会有差异）
        </p>
        {focusedIdx >= 0 && onClearActive ? (
          <button
            type="button"
            className="gl-pack-mini-btn"
            onClick={onClearActive}
          >
            正在预览第 {focusedIdx + 1} 页 <X size={12} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <div className="gl-pack-preview-grid">
        {picks.map((s) => {
          const index = pack.slides.indexOf(s);
          const isFocused = Boolean(activeSlideId && s.id === activeSlideId);
          const { slideType, slideData } = packSlideToCanvas(s, pack.insight);
          return (
            <figure
              key={s.id}
              className={`gl-pack-preview-item ${isFocused ? "is-focused" : ""}`}
            >
              <div className="gl-pack-preview-frame">
                <SlideCanvas
                  spec={spec}
                  slideType={slideType}
                  topic={s.title}
                  subtitle={s.points[0] ?? ""}
                  slideData={slideData}
                  pageIndex={index}
                  totalPages={pack.slides.length}
                />
              </div>
              <figcaption>
                <span>{String(index + 1).padStart(2, "0")}</span> {packLayoutLabel(s.layout)}
                {isFocused ? <em className="gl-pack-preview-pin">已选中</em> : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- outline */

export function PackOutlineEditor({
  pack,
  onChange,
  activeSlideId,
  onPreviewSlide,
  hasByok,
  refiningSlideId,
  undoMap,
  onRefineSlide,
  onUndoRefine,
}: {
  pack: PromptPack;
  onChange: (next: PromptPack) => void;
  activeSlideId?: string | null;
  onPreviewSlide?: (id: string) => void;
  hasByok?: boolean;
  refiningSlideId?: string | null;
  undoMap?: Record<string, PackSlide>;
  onRefineSlide?: (slide: PackSlide, instruction: string) => void;
  onUndoRefine?: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [refineHint, setRefineHint] = useState("");
  const update = (slides: PackSlide[]) =>
    onChange({ ...pack, slides, insight: { ...pack.insight, slideCount: slides.length } });
  const patch = (id: string, p: Partial<PackSlide>) =>
    update(pack.slides.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= pack.slides.length) return;
    const next = [...pack.slides];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const remove = (id: string) => {
    if (pack.slides.length <= 3) return;
    update(pack.slides.filter((s) => s.id !== id));
  };
  const add = () => {
    const slide: PackSlide = {
      id: newPackSlideId(),
      layout: "image-text",
      title: "新的一页",
      points: ["[待补充]"],
      data: [],
      visual: "",
      note: "",
      source: "手动添加",
    };
    const next = [...pack.slides];
    next.splice(Math.max(1, next.length - 1), 0, slide);
    update(next);
    setOpenId(slide.id);
    onPreviewSlide?.(slide.id);
  };

  const updateDatum = (slide: PackSlide, idx: number, field: keyof PackDatum, val: string) => {
    const nextData = slide.data.map((d, i) => (i === idx ? { ...d, [field]: val.slice(0, 24) } : d));
    patch(slide.id, { data: nextData });
  };
  const addDatum = (slide: PackSlide) => {
    if (slide.data.length >= 6) return;
    patch(slide.id, { data: [...slide.data, { label: "指标", value: "" }] });
  };
  const removeDatum = (slide: PackSlide, idx: number) => {
    patch(slide.id, { data: slide.data.filter((_, i) => i !== idx) });
  };

  const layoutCounts = useMemo(() => new Set(pack.slides.map((s) => s.layout)).size, [pack.slides]);

  return (
    <section className="gl-pack-card gl-pack-outline" id="pg-pack-outline" aria-labelledby="pg-pack-outline-title">
      <header className="gl-pack-card-head">
        <div>
          <p className="gl-pack-eyebrow">逐页大纲 · 可编辑</p>
          <h2 className="gl-pack-h2" id="pg-pack-outline-title">
            {pack.slides.length} 页 · {layoutCounts} 种版式
          </h2>
        </div>
        <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={add} id="pg-pack-add-slide-btn">
          加一页
        </Button>
      </header>
      <ol className="gl-pack-slides">
        {pack.slides.map((s, i) => {
          const open = openId === s.id;
          const isPreviewed = activeSlideId === s.id;
          const isRefining = refiningSlideId === s.id;
          const canUndo = Boolean(undoMap?.[s.id]);
          const weakTitle = isWeakTopicTitle(s.title, s.layout);
          return (
            <li
              key={s.id}
              className={`gl-pack-slide ${open ? "is-open" : ""} ${isPreviewed ? "is-previewed" : ""}`}
              data-layout={s.layout}
            >
              <div className="gl-pack-slide-row">
                <span className="gl-pack-slide-no">{String(i + 1).padStart(2, "0")}</span>
                <span className={`gl-pack-layout-tag is-${s.layout}`}>{packLayoutLabel(s.layout)}</span>
                <button
                  type="button"
                  className="gl-pack-slide-title"
                  aria-expanded={open}
                  onClick={() => {
                    const nextOpen = open ? null : s.id;
                    setOpenId(nextOpen);
                    if (nextOpen) onPreviewSlide?.(s.id);
                  }}
                >
                  <strong>
                    {s.title}
                    {weakTitle ? <em className="gl-pack-weak-pill">建议写结论句</em> : null}
                  </strong>
                  <span>
                    {s.layout === "agenda"
                      ? s.points.join(" / ")
                      : s.data.length
                        ? s.data
                            .slice(0, 3)
                            .map((d) => `${d.label} ${d.value}`.trim())
                            .join(" · ")
                        : (s.points[0] ?? s.visual)}
                  </span>
                </button>
                <div className="gl-pack-slide-actions">
                  {onPreviewSlide ? (
                    <button
                      type="button"
                      className={isPreviewed ? "is-active" : ""}
                      onClick={() => onPreviewSlide(s.id)}
                      aria-label={`预览第 ${i + 1} 页`}
                      title="在上方风格示意中预览这一页"
                    >
                      <Eye size={14} />
                    </button>
                  ) : null}
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`上移第 ${i + 1} 页`}>
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === pack.slides.length - 1}
                    aria-label={`下移第 ${i + 1} 页`}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={pack.slides.length <= 3}
                    aria-label={`删除第 ${i + 1} 页`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {open ? (
                <div className="gl-pack-slide-edit">
                  <label>
                    <span>版式</span>
                    <select value={s.layout} onChange={(e) => patch(s.id, { layout: e.target.value as PackLayout })}>
                      {PACK_LAYOUTS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label} — {l.hint}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>标题（建议写一句核心结论）</span>
                    <input value={s.title} maxLength={60} onChange={(e) => patch(s.id, { title: e.target.value })} />
                    {weakTitle ? (
                      <small className="gl-pack-weak-tip">
                        提示：把「{s.title}」改成包含判断或数字的结论句，听众一眼就能抓住重点。
                      </small>
                    ) : null}
                  </label>
                  <label className="is-wide">
                    <span>要点（每行一条）</span>
                    <textarea
                      rows={Math.min(6, Math.max(3, s.points.length + 1))}
                      value={s.points.join("\n")}
                      onChange={(e) =>
                        patch(s.id, {
                          points: e.target.value
                            .split("\n")
                            .map((p) => p.slice(0, 120))
                            .slice(0, 6),
                        })
                      }
                    />
                  </label>

                  <div className="gl-pack-data-editor is-wide">
                    <div className="gl-pack-data-editor-head">
                      <span>关键数据（请确保来自你的资料）</span>
                      {s.data.length < 6 ? (
                        <button
                          type="button"
                          id="pg-pack-add-datum-btn"
                          className="gl-pack-mini-btn"
                          onClick={() => addDatum(s)}
                        >
                          <Plus size={12} aria-hidden="true" /> 添加数据
                        </button>
                      ) : null}
                    </div>
                    {s.data.length ? (
                      <div className="gl-pack-data-rows">
                        {s.data.map((d, dIdx) => (
                          <div key={dIdx} className="gl-pack-data-row">
                            <input
                              type="text"
                              value={d.label}
                              maxLength={24}
                              placeholder="指标名"
                              aria-label={`第 ${dIdx + 1} 条数据指标名`}
                              onChange={(e) => updateDatum(s, dIdx, "label", e.target.value)}
                            />
                            <input
                              type="text"
                              value={d.value}
                              maxLength={24}
                              placeholder="数值 + 单位"
                              aria-label={`第 ${dIdx + 1} 条数据数值`}
                              onChange={(e) => updateDatum(s, dIdx, "value", e.target.value)}
                            />
                            <button
                              type="button"
                              aria-label={`删除第 ${dIdx + 1} 条数据`}
                              onClick={() => removeDatum(s, dIdx)}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <label className="is-wide">
                    <span>视觉建议</span>
                    <input value={s.visual} maxLength={200} onChange={(e) => patch(s.id, { visual: e.target.value })} />
                  </label>

                  <label className="is-wide">
                    <span>演讲备注（导出到 PPT Notes）</span>
                    <textarea
                      id="pg-pack-slide-note-input"
                      rows={2}
                      maxLength={400}
                      value={s.note}
                      placeholder="这一页口头讲解的重点、过渡语或提问…"
                      onChange={(e) => patch(s.id, { note: e.target.value })}
                    />
                  </label>

                  {hasByok && onRefineSlide ? (
                    <div className="gl-pack-refine-bar is-wide">
                      <input
                        type="text"
                        value={refineHint}
                        maxLength={120}
                        placeholder="单页 AI 润色指令（可选，如：精简为 3 条、改成对比版式）"
                        onChange={(e) => setRefineHint(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        id="pg-pack-refine-slide-btn"
                        loading={isRefining}
                        loadingText="润色中…"
                        leftIcon={<Sparkles size={13} />}
                        onClick={() => onRefineSlide(s, refineHint)}
                      >
                        AI 润色本页
                      </Button>
                      {canUndo && onUndoRefine ? (
                        <button
                          type="button"
                          className="gl-pack-mini-btn"
                          onClick={() => onUndoRefine(s.id)}
                        >
                          <RotateCcw size={12} aria-hidden="true" /> 撤销
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {s.source ? <p className="gl-pack-slide-source is-wide">出处：{s.source}</p> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ----------------------------------------------------------------- export */

function slugify(name: string): string {
  return (name || "prompt-pack").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 40);
}

export function PackExportPanel({
  pack,
  tool,
  language,
  density,
  onToolChange,
  onToast,
  onSendToGenerate,
}: {
  pack: PromptPack;
  tool: PackTool;
  language: PackLanguage;
  density?: PackDensity;
  onToolChange: (t: PackTool) => void;
  onToast: (msg: string, tone?: "default" | "success" | "error") => void;
  onSendToGenerate: () => void;
}) {
  const [chatgptMode, setChatgptMode] = useState<ChatgptExportMode>("oneshot");
  const [exportingPptx, setExportingPptx] = useState(false);

  const prompt = useMemo(
    () => renderMasterPrompt(pack, tool, language, { chatgptMode, density }),
    [pack, tool, language, chatgptMode, density]
  );
  const gammaParts = useMemo(
    () => (tool === "gamma" ? renderGammaParts(pack, language, density) : null),
    [pack, tool, language, density]
  );
  const chatgptSteps = useMemo(
    () =>
      tool === "chatgpt" && chatgptMode === "twostep"
        ? renderChatgptTwoStep(pack, language, density)
        : null,
    [pack, tool, chatgptMode, language, density]
  );

  const meta = PACK_TOOLS.find((t) => t.id === tool) ?? PACK_TOOLS[0];
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyPayload = async (key: string, text: string, label: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1800);
      onToast(`已复制${label}（${text.length.toLocaleString("zh-CN")} 字）`, "success");
    } else {
      onToast("复制失败，请在预览框中手动全选复制", "error");
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    downloadBlob(new Blob([content], { type: mime }), filename);
  };

  const handleDownloadPptx = async () => {
    if (exportingPptx) return;
    setExportingPptx(true);
    try {
      const visualSpec = packStyleToVisualSpec(pack.style);
      const slides = packToDeckSlides(pack);
      const res = await fetch("/api/export/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pack.insight.topic,
          subtitle: pack.slides[0]?.points[0] || pack.insight.scenario,
          audience: pack.insight.audience,
          styleName: pack.style.name,
          visualSpec,
          slides,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onToast(err.error || "导出 .pptx 失败，请稍后重试", "error");
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, `${slugify(pack.insight.topic)}.pptx`);
      onToast(`已下载原生可编辑 ${pack.slides.length} 页 .pptx（含母版、原生图表与演讲备注）`, "success");
    } catch {
      onToast("网络异常，导出 .pptx 失败", "error");
    } finally {
      setExportingPptx(false);
    }
  };

  const handleDownloadHtml = () => {
    try {
      const html = exportStandaloneHtmlDeck({
        title: pack.insight.topic,
        subtitle: pack.slides[0]?.points[0] || pack.insight.scenario,
        audience: pack.insight.audience,
        styleName: pack.style.name,
        spec: packStyleToVisualSpec(pack.style),
        slides: packToDeckSlides(pack),
      });
      downloadFile(html, `${slugify(pack.insight.topic)}.html`, "text/html;charset=utf-8");
      onToast("已下载单文件离线 .html 演示稿（双击即可全屏翻页，支持打印为 PDF）", "success");
    } catch {
      onToast("导出离线 .html 失败，请重试", "error");
    }
  };

  return (
    <section className="gl-pack-card gl-pack-export" id="pg-pack-export" aria-labelledby="pg-pack-export-title">
      <header className="gl-pack-card-head">
        <div>
          <p className="gl-pack-eyebrow">导出总提示词 · 或免粘贴直出成品</p>
          <h2 className="gl-pack-h2" id="pg-pack-export-title">
            选择你要用的 AI 工具
          </h2>
        </div>
        {tool === "chatgpt" ? (
          <div className="gl-pack-mode-seg" role="group" aria-label="ChatGPT 提示词模式">
            <button
              type="button"
              id="pg-pack-chatgpt-oneshot"
              className={chatgptMode === "oneshot" ? "is-active" : ""}
              onClick={() => setChatgptMode("oneshot")}
            >
              单轮直出 .pptx
            </button>
            <button
              type="button"
              id="pg-pack-chatgpt-twostep"
              className={chatgptMode === "twostep" ? "is-active" : ""}
              onClick={() => setChatgptMode("twostep")}
            >
              两步精修
            </button>
          </div>
        ) : null}
      </header>

      <div className="gl-pack-tools" role="tablist" aria-label="目标工具">
        {PACK_TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`pg-pack-tool-${t.id}`}
            aria-selected={tool === t.id}
            className={`gl-pack-tool ${tool === t.id ? "is-active" : ""}`}
            onClick={() => onToolChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="gl-pack-tool-hint">
        {tool === "chatgpt" && chatgptMode === "twostep"
          ? "贴合「先定风格、再出 PPT」的习惯：先发第 1 轮确认风格，再发第 2 轮生成 .pptx"
          : meta.hint}
      </p>

      {gammaParts ? (
        <div className="gl-pack-split-copy" id="pg-pack-gamma-split">
          <div className="gl-pack-split-card">
            <div>
              <strong>① 风格额外指令</strong>
              <span>贴到 Gamma「Additional instructions」（{gammaParts.instructions.length} 字）</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              id="pg-pack-copy-gamma-style"
              leftIcon={copiedKey === "gamma-style" ? <Check size={14} /> : <Copy size={14} />}
              onClick={() => void copyPayload("gamma-style", gammaParts.instructions, " Gamma ① 风格指令")}
            >
              {copiedKey === "gamma-style" ? "已复制 ①" : "复制 ① 风格指令"}
            </Button>
          </div>
          <div className="gl-pack-split-card">
            <div>
              <strong>② 分卡大纲正文</strong>
              <span>贴到 Gamma「Paste in text」，选「按 --- 分卡」（{gammaParts.cards.length} 字）</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              id="pg-pack-copy-gamma-cards"
              leftIcon={copiedKey === "gamma-cards" ? <Check size={14} /> : <Copy size={14} />}
              onClick={() => void copyPayload("gamma-cards", gammaParts.cards, " Gamma ② 分卡正文")}
            >
              {copiedKey === "gamma-cards" ? "已复制 ②" : "复制 ② 分卡正文"}
            </Button>
          </div>
        </div>
      ) : null}

      {chatgptSteps ? (
        <div className="gl-pack-split-copy" id="pg-pack-chatgpt-split">
          <div className="gl-pack-split-card">
            <div>
              <strong>第 1 轮 · 风格规范</strong>
              <span>先让 ChatGPT 确认配色、字体与版式节奏（{chatgptSteps.step1.length} 字）</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              id="pg-pack-copy-step1"
              leftIcon={copiedKey === "step1" ? <Check size={14} /> : <Copy size={14} />}
              onClick={() => void copyPayload("step1", chatgptSteps.step1, "第 1 轮风格提示词")}
            >
              {copiedKey === "step1" ? "已复制第 1 轮" : "复制第 1 轮"}
            </Button>
          </div>
          <div className="gl-pack-split-card">
            <div>
              <strong>第 2 轮 · 逐页大纲</strong>
              <span>风格确认后发送，生成 16:9 .pptx 文件（{chatgptSteps.step2.length} 字）</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              id="pg-pack-copy-step2"
              leftIcon={copiedKey === "step2" ? <Check size={14} /> : <Copy size={14} />}
              onClick={() => void copyPayload("step2", chatgptSteps.step2, "第 2 轮大纲提示词")}
            >
              {copiedKey === "step2" ? "已复制第 2 轮" : "复制第 2 轮"}
            </Button>
          </div>
        </div>
      ) : null}

      <pre className="gl-pack-prompt" id="pg-pack-prompt-preview" tabIndex={0} aria-label="提示词预览">
        {prompt}
      </pre>

      <div className="gl-pack-export-actions">
        <Button
          variant="primary"
          leftIcon={copiedKey === "all" ? <Check size={16} /> : <Copy size={16} />}
          onClick={() => void copyPayload("all", prompt, ` ${meta.label} 提示词`)}
          id="pg-pack-copy-btn"
        >
          {copiedKey === "all" ? "已复制" : "复制提示词"}
        </Button>
        <Button
          variant="secondary"
          leftIcon={<Download size={16} />}
          onClick={() => downloadFile(prompt, `${slugify(pack.insight.topic)}-${tool}.md`, "text/markdown;charset=utf-8")}
          id="pg-pack-download-btn"
        >
          下载 .md
        </Button>
        {meta.launch ? (
          <a
            className="gl-pack-launch"
            href={meta.launch.url}
            target="_blank"
            rel="noopener noreferrer"
            id="pg-pack-launch-link"
          >
            {meta.launch.label} <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <div className="gl-pack-direct-deck" id="pg-pack-direct-deck">
        <div className="gl-pack-direct-deck-info">
          <strong>不想再复制去外部工具？直接导出当前成品</strong>
          <span>完整保留当前 6 色色板、原生可编辑图表、表格与演讲备注</span>
        </div>
        <div className="gl-pack-direct-deck-btns">
          <Button
            size="sm"
            variant="secondary"
            id="pg-pack-download-pptx-btn"
            loading={exportingPptx}
            loadingText="正在生成 .pptx…"
            leftIcon={<FileDown size={14} />}
            onClick={() => void handleDownloadPptx()}
          >
            直接下载 .pptx
          </Button>
          <Button
            size="sm"
            variant="ghost"
            id="pg-pack-download-html-btn"
            leftIcon={<Code2 size={14} />}
            onClick={handleDownloadHtml}
          >
            下载离线 .html
          </Button>
          <button type="button" className="gl-pack-textlink" onClick={onSendToGenerate} id="pg-pack-to-generate-btn">
            进全屏编辑器精修 →
          </button>
        </div>
      </div>

      <div className="gl-pack-export-subactions">
        <button
          type="button"
          id="pg-pack-copy-style-btn"
          className="gl-pack-mini-btn"
          onClick={() => void copyPayload("style-only", renderStyleOnlyPrompt(pack, language, density), "仅风格提示词")}
        >
          {copiedKey === "style-only" ? <Check size={12} /> : <Copy size={12} />}
          仅复制风格
        </button>
        <button
          type="button"
          id="pg-pack-copy-outline-btn"
          className="gl-pack-mini-btn"
          onClick={() => void copyPayload("outline-only", renderOutlineOnlyPrompt(pack, language, density), "仅逐页大纲")}
        >
          {copiedKey === "outline-only" ? <Check size={12} /> : <Copy size={12} />}
          仅复制大纲
        </button>
        <button
          type="button"
          id="pg-pack-export-json-btn"
          className="gl-pack-mini-btn"
          onClick={() => {
            downloadFile(
              serializePackJson(pack, tool, language),
              `${slugify(pack.insight.topic)}-prompt-pack.json`,
              "application/json;charset=utf-8"
            );
            onToast("已导出可复用的提示词包 JSON", "success");
          }}
        >
          <FileJson size={12} aria-hidden="true" />
          导出 .json
        </button>
      </div>
    </section>
  );
}
