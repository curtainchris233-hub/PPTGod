"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  Palette,
  Plus,
  Presentation,
  Trash2,
  Type,
} from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import { Button } from "@/components/ui";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  DESIGN_DIRECTIONS,
  PACK_LAYOUTS,
  PACK_TOOLS,
  directionToStyle,
  getDesignDirection,
  newPackSlideId,
  packLayoutLabel,
  packSlideToCanvas,
  packStyleToVisualSpec,
  pickPreviewSlides,
  renderMasterPrompt,
  type PackLanguage,
  type PackLayout,
  type PackSlide,
  type PackTool,
  type PromptPack,
} from "@/lib/promptPack";

/* ------------------------------------------------------------------ style */

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
    if (id === style.directionId) return;
    const d = getDesignDirection(id);
    onChange({
      ...pack,
      style: directionToStyle(
        d,
        `已切换为「${d.name}」：${d.keywords.slice(0, 3).join("、")}。内容与逐页大纲保持不变。`
      ),
    });
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
      </header>

      <p className="gl-pack-rationale">{style.rationale}</p>

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
            {style.dos.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="gl-pack-rules-col is-dont">
          <p>避免</p>
          <ul>
            {style.donts.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- preview */

export function PackPreviewStrip({ pack }: { pack: PromptPack }) {
  const spec = useMemo(() => packStyleToVisualSpec(pack.style), [pack.style]);
  const picks = useMemo(() => pickPreviewSlides(pack.slides), [pack.slides]);
  return (
    <section className="gl-pack-card gl-pack-preview" id="pg-pack-preview" aria-label="风格效果预览">
      <header className="gl-pack-card-head is-compact">
        <p className="gl-pack-eyebrow">
          <Presentation size={14} aria-hidden="true" /> 风格示意（站内渲染，外部工具成品会有差异）
        </p>
      </header>
      <div className="gl-pack-preview-grid">
        {picks.map((s) => {
          const index = pack.slides.indexOf(s);
          const { slideType, slideData } = packSlideToCanvas(s, pack.insight);
          return (
            <figure key={s.id} className="gl-pack-preview-item">
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
}: {
  pack: PromptPack;
  onChange: (next: PromptPack) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
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
          return (
            <li key={s.id} className={`gl-pack-slide ${open ? "is-open" : ""}`} data-layout={s.layout}>
              <div className="gl-pack-slide-row">
                <span className="gl-pack-slide-no">{String(i + 1).padStart(2, "0")}</span>
                <span className={`gl-pack-layout-tag is-${s.layout}`}>{packLayoutLabel(s.layout)}</span>
                <button
                  type="button"
                  className="gl-pack-slide-title"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : s.id)}
                >
                  <strong>{s.title}</strong>
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
                    <span>标题</span>
                    <input value={s.title} maxLength={60} onChange={(e) => patch(s.id, { title: e.target.value })} />
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
                  <label className="is-wide">
                    <span>视觉建议</span>
                    <input value={s.visual} maxLength={200} onChange={(e) => patch(s.id, { visual: e.target.value })} />
                  </label>
                  {s.data.length ? (
                    <p className="gl-pack-slide-data is-wide">
                      数据（来自资料）：{s.data.map((d) => `${d.label} ${d.value}`).join("；")}
                    </p>
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
  onToolChange,
  onToast,
  onSendToGenerate,
}: {
  pack: PromptPack;
  tool: PackTool;
  language: PackLanguage;
  onToolChange: (t: PackTool) => void;
  onToast: (msg: string, tone?: "default" | "success" | "error") => void;
  onSendToGenerate: () => void;
}) {
  const prompt = useMemo(() => renderMasterPrompt(pack, tool, language), [pack, tool, language]);
  const meta = PACK_TOOLS.find((t) => t.id === tool) ?? PACK_TOOLS[0];
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const ok = await copyTextToClipboard(prompt);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      onToast(`已复制 ${meta.label} 提示词（${prompt.length.toLocaleString("zh-CN")} 字）`, "success");
    } else {
      onToast("复制失败，请在预览框中手动全选复制", "error");
    }
  };

  const download = () => {
    const blob = new Blob([prompt], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(pack.insight.topic)}-${tool}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="gl-pack-card gl-pack-export" id="pg-pack-export" aria-labelledby="pg-pack-export-title">
      <header className="gl-pack-card-head">
        <div>
          <p className="gl-pack-eyebrow">导出总提示词</p>
          <h2 className="gl-pack-h2" id="pg-pack-export-title">
            选择你要用的 AI 工具
          </h2>
        </div>
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
      <p className="gl-pack-tool-hint">{meta.hint}</p>
      <pre className="gl-pack-prompt" id="pg-pack-prompt-preview" tabIndex={0} aria-label="提示词预览">
        {prompt}
      </pre>
      <div className="gl-pack-export-actions">
        <Button
          variant="primary"
          leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}
          onClick={copy}
          id="pg-pack-copy-btn"
        >
          {copied ? "已复制" : "复制提示词"}
        </Button>
        <Button variant="secondary" leftIcon={<Download size={16} />} onClick={download} id="pg-pack-download-btn">
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
        <span className="gl-pack-export-spacer" />
        <button type="button" className="gl-pack-textlink" onClick={onSendToGenerate} id="pg-pack-to-generate-btn">
          或在站内直接生成 .pptx →
        </button>
      </div>
    </section>
  );
}
