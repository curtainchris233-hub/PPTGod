"use client";

import React, { useRef, useState } from "react";
import { Check, Copy, Image as ImageIcon, Sparkles, Upload } from "lucide-react";
import {
  pickDefaultArtworkForArchetype,
  SLIDE_ARTWORK_PRESETS,
} from "@/lib/slideArtworks";
import type { DeckSlideItem, LayoutArchetype } from "@/types/prompt";

interface ImageSlotManagerProps {
  currentSlide: DeckSlideItem;
  archetype: LayoutArchetype;
  generatingImg: boolean;
  imgModelName: string;
  imgPromptCopied: boolean;
  onChangeImgModelName: (val: string) => void;
  onUploadSlideImage: (file: File) => void;
  onCopySlideImagePrompt: () => void;
  onGenerateAiSlideImage: () => void;
  onUpdateSlide: (patch: Partial<DeckSlideItem>, groupText?: boolean) => void;
}

export default function ImageSlotManager({
  currentSlide,
  archetype,
  generatingImg,
  imgModelName,
  imgPromptCopied,
  onChangeImgModelName,
  onUploadSlideImage,
  onCopySlideImagePrompt,
  onGenerateAiSlideImage,
  onUpdateSlide,
}: ImageSlotManagerProps) {
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const [imgTab, setImgTab] = useState<"svg" | "upload" | "ai">("svg");

  const activePresetId =
    currentSlide.imageSlot?.presetId ||
    pickDefaultArtworkForArchetype(archetype);

  return (
    <div className="pg-gen-subcard">
      <div className="pg-gen-subcard-head">
        <span className="pg-gen-subcard-title">
          <ImageIcon
            size={12}
            style={{ verticalAlign: "-2px", marginRight: "4px" }}
          />
          三合一智能配图槽位
        </span>
        <div className="pg-segmented" style={{ width: "auto" }}>
          <button
            type="button"
            className={`pg-seg-btn ${
              (currentSlide.imageSlot?.layout || "left") === "left"
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              onUpdateSlide(
                {
                  imageSlot: {
                    kind: currentSlide.imageSlot?.kind || "svg-preset",
                    ...currentSlide.imageSlot,
                    layout: "left",
                  },
                },
                false
              )
            }
          >
            左图右文
          </button>
          <button
            type="button"
            className={`pg-seg-btn ${
              currentSlide.imageSlot?.layout === "right" ? "is-active" : ""
            }`}
            onClick={() =>
              onUpdateSlide(
                {
                  imageSlot: {
                    kind: currentSlide.imageSlot?.kind || "svg-preset",
                    ...currentSlide.imageSlot,
                    layout: "right",
                  },
                },
                false
              )
            }
          >
            右图左文
          </button>
        </div>
      </div>

      <div className="pg-img-tabs" role="tablist" aria-label="配图来源方式">
        <button
          type="button"
          role="tab"
          aria-selected={imgTab === "svg"}
          className={`pg-img-tab ${imgTab === "svg" ? "is-active" : ""}`}
          onClick={() => setImgTab("svg")}
        >
          12套矢量图
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={imgTab === "upload"}
          className={`pg-img-tab ${imgTab === "upload" ? "is-active" : ""}`}
          onClick={() => setImgTab("upload")}
        >
          本地上传
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={imgTab === "ai"}
          className={`pg-img-tab ${imgTab === "ai" ? "is-active" : ""}`}
          onClick={() => setImgTab("ai")}
        >
          AI 生图/词
        </button>
      </div>

      {imgTab === "svg" && (
        <div className="pg-artwork-grid">
          {SLIDE_ARTWORK_PRESETS.map((preset) => {
            const selected =
              (currentSlide.imageSlot?.kind || "svg-preset") === "svg-preset" &&
              activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`pg-artwork-btn ${selected ? "is-active" : ""}`}
                onClick={() =>
                  onUpdateSlide(
                    {
                      imageSlot: {
                        ...currentSlide.imageSlot,
                        kind: "svg-preset",
                        presetId: preset.id,
                        dataUrl: undefined,
                      },
                    },
                    false
                  )
                }
              >
                <strong>{preset.label}</strong>
                <span>{preset.category}</span>
              </button>
            );
          })}
        </div>
      )}

      {imgTab === "upload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            ref={imgInputRef}
            id="pg-slide-img-upload-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="pg-upload-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadSlideImage(f);
              e.target.value = "";
            }}
          />
          {currentSlide.imageSlot?.kind === "data-url" &&
            currentSlide.imageSlot.dataUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentSlide.imageSlot.dataUrl}
                alt="已上传预览"
                className="pg-img-preview-thumb"
              />
            )}
          <div className="pg-btn-group">
            <button
              type="button"
              className="pg-btn pg-btn-secondary pg-btn-xs"
              onClick={() => imgInputRef.current?.click()}
              id="pg-slide-img-upload-btn"
            >
              <Upload size={12} />
              <span>上传本地图片（自动压缩 ≤400KB）</span>
            </button>
            {currentSlide.imageSlot?.kind === "data-url" && (
              <button
                type="button"
                className="pg-btn pg-btn-ghost pg-btn-xs"
                onClick={() =>
                  onUpdateSlide(
                    {
                      imageSlot: {
                        ...currentSlide.imageSlot,
                        kind: "svg-preset",
                        presetId: pickDefaultArtworkForArchetype(archetype),
                        dataUrl: undefined,
                      },
                    },
                    false
                  )
                }
              >
                恢复矢量图
              </button>
            )}
          </div>
        </div>
      )}

      {imgTab === "ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          <input
            type="text"
            value={currentSlide.imageSlot?.promptHint || ""}
            placeholder="描述希望生成的画面主题（如：极简云原生架构图）"
            onChange={(e) =>
              onUpdateSlide({
                imageSlot: {
                  kind: currentSlide.imageSlot?.kind || "svg-preset",
                  ...currentSlide.imageSlot,
                  promptHint: e.target.value,
                },
              })
            }
          />
          <button
            type="button"
            className="pg-btn pg-btn-secondary pg-btn-xs"
            onClick={onCopySlideImagePrompt}
            id="pg-copy-img-prompt-btn"
          >
            {imgPromptCopied ? <Check size={12} /> : <Copy size={12} />}
            <span>
              {imgPromptCopied
                ? "已复制配图美术提示词"
                : "一键复制即梦 / Midjourney 配图词"}
            </span>
          </button>
          <div className="pg-form-2col">
            <input
              type="text"
              value={imgModelName}
              onChange={(e) => onChangeImgModelName(e.target.value)}
              placeholder="dall-e-3 / gpt-image-1"
              aria-label="AI 生图模型"
            />
            <button
              type="button"
              className="pg-btn pg-btn-ink pg-btn-xs"
              disabled={generatingImg}
              onClick={onGenerateAiSlideImage}
              id="pg-gen-ai-img-btn"
            >
              <Sparkles size={12} />
              <span>{generatingImg ? "生图中..." : "BYOK 生图"}</span>
            </button>
          </div>
        </div>
      )}

      <input
        type="text"
        value={currentSlide.imageSlot?.caption || ""}
        placeholder="配图底部说明文字..."
        onChange={(e) =>
          onUpdateSlide({
            imageSlot: {
              kind: currentSlide.imageSlot?.kind || "svg-preset",
              ...currentSlide.imageSlot,
              caption: e.target.value,
            },
          })
        }
      />
    </div>
  );
}
