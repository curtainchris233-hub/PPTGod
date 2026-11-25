"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Compass, Sparkles, X } from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import type { PromptItem } from "@/types/prompt";
import "@/styles/matcher.css";

interface StyleMatcherModalProps {
  open: boolean;
  onClose: () => void;
  prompts: PromptItem[];
  liveTopic?: string;
}

type AudienceGoal =
  | "exec-consulting"
  | "product-launch"
  | "academic-tech"
  | "brand-culture"
  | "training-review";

type VenueLighting = "bright-room" | "dark-stage" | "screen-read";
type DensityPref = "airy" | "balanced" | "dense";

const GOAL_OPTIONS: {
  id: AudienceGoal;
  title: string;
  desc: string;
  scenarios: string[];
}[] = [
  {
    id: "exec-consulting",
    title: "高管决策 / 商业路演",
    desc: "董事会汇报、战略复盘、机构融资 BP",
    scenarios: ["咨询汇报", "商业路演"],
  },
  {
    id: "product-launch",
    title: "产品发布 / 科技宣讲",
    desc: "新品发布会、AI 产品卖点、硬科技展示",
    scenarios: ["产品发布", "技术分享"],
  },
  {
    id: "academic-tech",
    title: "学术答辩 / 研发评审",
    desc: "硕博论文答辩、临床医药、技术架构",
    scenarios: ["学术答辩", "技术分享"],
  },
  {
    id: "brand-culture",
    title: "品牌全案 / 文化策展",
    desc: "美学零售、时尚高定、东方文创提案",
    scenarios: ["品牌提案", "文化创意"],
  },
  {
    id: "training-review",
    title: "企业内训 / 年度总结",
    desc: "公开课课件、团队复盘与人文叙事",
    scenarios: ["教育培训", "年度总结"],
  },
];

const VENUE_OPTIONS: {
  id: VenueLighting;
  title: string;
  desc: string;
}[] = [
  {
    id: "bright-room",
    title: "明亮会议室 / 投影仪",
    desc: "优先浅色纸感高对比，防投影发灰",
  },
  {
    id: "dark-stage",
    title: "暗场 LED 大屏 / 路演厅",
    desc: "深邃暗色系，大屏聚光高级不刺眼",
  },
  {
    id: "screen-read",
    title: "线上会议 / PDF 阅读",
    desc: "兼顾屏幕护眼、温润暖调与层次感",
  },
];

const DENSITY_OPTIONS: {
  id: DensityPref;
  title: string;
  desc: string;
}[] = [
  { id: "airy", title: "极简高留白", desc: "少字大图、强调视觉呼吸与口头演讲" },
  { id: "balanced", title: "均衡模块化", desc: "观点与图表平衡，最通用的黄金节奏" },
  { id: "dense", title: "高信息密度", desc: "数据图表饱满、适合咨询研报与论文" },
];

export default function StyleMatcherModal({
  open,
  onClose,
  prompts,
  liveTopic,
}: StyleMatcherModalProps) {
  const [goal, setGoal] = useState<AudienceGoal>("product-launch");
  const [venue, setVenue] = useState<VenueLighting>("bright-room");
  const [density, setDensity] = useState<DensityPref>("balanced");

  const recommendations = useMemo(() => {
    const goalDef = GOAL_OPTIONS.find((g) => g.id === goal)!;
    const publicPool = prompts.filter((p) => p.isPublic !== false);

    const scored = publicPool.map((p) => {
      let score = 52;
      const reasons: string[] = [];

      if (goalDef.scenarios.includes(p.scenario)) {
        score += 24;
        reasons.push(`高度契合「${p.scenario}」场景`);
      }

      if (venue === "dark-stage" && p.colorFamily === "dark") {
        score += 14;
        reasons.push("深邃暗调适配大屏聚光");
      } else if (
        venue === "bright-room" &&
        (p.colorFamily === "light" || p.colorFamily === "earth")
      ) {
        score += 14;
        reasons.push("高对比浅底不怕投影偏色");
      } else if (
        venue === "screen-read" &&
        (p.colorFamily === "warm" || p.colorFamily === "light")
      ) {
        score += 12;
        reasons.push("屏幕长时间阅读舒适护眼");
      } else if (venue === "dark-stage" && p.colorFamily === "vivid") {
        score += 8;
        reasons.push("强撞色舞台辨识度高");
      }

      if (p.visualSpec.layout.density === density) {
        score += 10;
        reasons.push(
          density === "airy"
            ? "充沛留白节奏"
            : density === "dense"
            ? "严谨高信息承载"
            : "均衡模块化版式"
        );
      }

      const popularityBoost = Math.min(4, Math.floor(p.likesCount / 180));
      score = Math.min(99, score + popularityBoost);

      return {
        prompt: p,
        score,
        reason: reasons.join(" · ") || `${p.styleCategory}高口碑设计系统`,
      };
    });

    return scored
      .sort(
        (a, b) =>
          b.score - a.score || b.prompt.likesCount - a.prompt.likesCount
      )
      .slice(0, 3);
  }, [prompts, goal, venue, density]);

  if (!open) return null;

  return (
    <div
      className="pg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pg-matcher-title"
      id="pg-style-matcher-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pg-matcher-modal">
        <div className="pg-modal-head">
          <div>
            <p className="pg-kicker" style={{ marginBottom: "4px" }}>
              30-SECOND SMART STYLE ADVISOR
            </p>
            <h2 id="pg-matcher-title" className="pg-modal-title">
              30 秒智能选词顾问
            </h2>
            <p className="pg-modal-sub">
              选择你的汇报目标、展示光线与信息密度，系统即时计算匹配度并推荐 Top 3 视觉提示词风格。
            </p>
          </div>
          <button
            type="button"
            className="pg-icon-btn"
            onClick={onClose}
            aria-label="关闭选词顾问"
            id="pg-matcher-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="pg-matcher-steps">
          <div className="pg-matcher-block">
            <div className="pg-matcher-step-label">
              <span className="pg-matcher-step-num">1</span>
              <span>汇报对象与场景</span>
            </div>
            <div className="pg-matcher-options">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pg-matcher-opt ${
                    goal === opt.id ? "is-active" : ""
                  }`}
                  onClick={() => setGoal(opt.id)}
                >
                  <strong>{opt.title}</strong>
                  <span>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pg-matcher-block">
            <div className="pg-matcher-step-label">
              <span className="pg-matcher-step-num">2</span>
              <span>演示环境与光线</span>
            </div>
            <div className="pg-matcher-options">
              {VENUE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pg-matcher-opt ${
                    venue === opt.id ? "is-active" : ""
                  }`}
                  onClick={() => setVenue(opt.id)}
                >
                  <strong>{opt.title}</strong>
                  <span>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pg-matcher-block">
            <div className="pg-matcher-step-label">
              <span className="pg-matcher-step-num">3</span>
              <span>内容信息密度偏好</span>
            </div>
            <div className="pg-matcher-options">
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pg-matcher-opt ${
                    density === opt.id ? "is-active" : ""
                  }`}
                  onClick={() => setDensity(opt.id)}
                >
                  <strong>{opt.title}</strong>
                  <span>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pg-matcher-results-head">
          <h3>
            <Compass
              size={15}
              style={{ verticalAlign: "-2px", marginRight: "6px" }}
            />
            为你精准匹配的 Top 3 PPT 视觉体系
          </h3>
          <span className="pg-meta-author">基于 {prompts.length} 套公开设计系统实时计算</span>
        </div>

        <div className="pg-matcher-results-grid" id="pg-matcher-results">
          {recommendations.map(({ prompt, score, reason }, idx) => {
            const genHref = liveTopic?.trim()
              ? `/generate?style=${encodeURIComponent(
                  prompt.slug
                )}&topic=${encodeURIComponent(liveTopic.trim())}`
              : `/generate?style=${encodeURIComponent(prompt.slug)}`;
            return (
              <div key={prompt.id} className="pg-matcher-rec-card">
                <div className="pg-matcher-rec-top">
                  <span className="pg-tag pg-tag-scenario">
                    TOP {idx + 1} · {prompt.scenario}
                  </span>
                  <span className="pg-matcher-score">匹配度 {score}%</span>
                </div>

                <div className="pg-matcher-rec-canvas">
                  <SlideCanvas
                    spec={prompt.visualSpec}
                    slideType="cover"
                    topic={liveTopic?.trim() || prompt.sampleTopic}
                    subtitle={prompt.sampleSubtitle}
                    englishTitle={prompt.englishTitle}
                    scenario={prompt.scenario}
                  />
                </div>

                <h4 className="pg-matcher-rec-title">{prompt.title}</h4>
                <p className="pg-matcher-rec-reason">{reason}</p>

                <div className="pg-matcher-rec-actions">
                  <Link
                    href={`/studio/${prompt.slug}`}
                    className="pg-btn pg-btn-ink pg-btn-xs pg-btn-flex"
                    onClick={onClose}
                  >
                    <span>进工作室</span>
                    <ArrowUpRight size={13} />
                  </Link>
                  <Link
                    href={genHref}
                    className="pg-btn pg-btn-primary pg-btn-xs pg-btn-flex"
                    onClick={onClose}
                  >
                    <Sparkles size={12} />
                    <span>生成 PPT</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
