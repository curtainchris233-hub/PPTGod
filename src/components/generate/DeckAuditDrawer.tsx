"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { auditDeckQuality, type DeckLintIssue } from "@/lib/deckLinter";
import type { DeckSlideItem, VisualSpec } from "@/types/prompt";

interface DeckAuditDrawerProps {
  slides: DeckSlideItem[];
  spec: VisualSpec;
  topic: string;
  audience: string;
  onJumpToSlide: (slideIndex: number) => void;
  onAutoFixContrast: () => void;
  onAutoFillNotes: () => void;
}

export default function DeckAuditDrawer({
  slides,
  spec,
  topic,
  audience,
  onJumpToSlide,
  onAutoFixContrast,
  onAutoFillNotes,
}: DeckAuditDrawerProps) {
  const [open, setOpen] = useState(false);

  const report = useMemo(
    () => auditDeckQuality(slides, spec, { topic, audience }),
    [slides, spec, topic, audience]
  );

  const handleAction = (issue: DeckLintIssue) => {
    if (issue.fixAction === "autofix-contrast") {
      onAutoFixContrast();
      return;
    }
    if (issue.fixAction === "autofix-notes") {
      onAutoFillNotes();
      return;
    }
    if (issue.fixAction === "jump-slide" && typeof issue.slideIndex === "number") {
      onJumpToSlide(issue.slideIndex);
    }
  };

  const scoreTone =
    report.score >= 90
      ? "is-good"
      : report.score >= 72
      ? "is-warn"
      : "is-bad";

  return (
    <div className="pg-audit-bar" id="pg-deck-audit-bar">
      <div className="pg-audit-bar-head">
        <button
          type="button"
          id="pg-deck-audit-toggle"
          className={`pg-btn pg-btn-ghost pg-btn-xs ${open ? "is-open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title="展开整套 PPT 智能体检与一键修复"
        >
          <ShieldCheck size={13} />
          <span>智能体检</span>
        </button>

        <div className="pg-audit-bar-metrics">
          <span
            id="pg-deck-audit-score"
            className={`pg-audit-score-pill ${scoreTone}`}
            data-score={report.score}
          >
            {report.score} 分 ({report.grade})
          </span>
          <span className="pg-audit-meta-chip" title="按中文 210 字/分钟估算演示时长">
            <Clock size={12} />
            <span>{report.estimatedMinutes}m</span>
          </span>
          {report.issues.length > 0 && (
            <span className="pg-audit-meta-chip">
              {report.issues.length} 项待优化
            </span>
          )}
        </div>
      </div>

      {open && (
        <div className="pg-audit-panel" id="pg-deck-audit-panel">
          <div className="pg-audit-summary-row">
            <div className="pg-audit-wcag-mini">
              <span>
                正文/底色对比度：<strong>{report.contrast.textBgRatio.toFixed(1)}:1</strong>（WCAG{" "}
                {report.contrast.textGrade}）
              </span>
              <span>
                强调色对比度：<strong>{report.contrast.accentBgRatio.toFixed(1)}:1</strong>
              </span>
              <span>
                缺失讲稿页数：<strong>{report.missingNotesCount} 页</strong>
              </span>
            </div>

            <div className="pg-btn-group">
              {report.contrast.overallGrade === "WARN" && (
                <button
                  type="button"
                  id="pg-audit-autofix-contrast-btn"
                  className="pg-btn pg-btn-primary pg-btn-xs"
                  onClick={onAutoFixContrast}
                >
                  <Wrench size={12} />
                  <span>一键校正对比度</span>
                </button>
              )}
              {report.missingNotesCount > 0 && (
                <button
                  type="button"
                  id="pg-audit-autofix-notes-btn"
                  className="pg-btn pg-btn-secondary pg-btn-xs"
                  onClick={onAutoFillNotes}
                >
                  <Sparkles size={12} />
                  <span>一键补齐 {report.missingNotesCount} 页讲稿</span>
                </button>
              )}
            </div>
          </div>

          {report.issues.length > 0 && (
            <ul className="pg-audit-issue-list" id="pg-deck-audit-issues">
              {report.issues.map((issue) => (
                <li
                  key={issue.id}
                  className={`pg-audit-issue pg-audit-issue--${issue.severity}`}
                >
                  <div className="pg-audit-issue-copy">
                    <div className="pg-audit-issue-title">
                      <AlertTriangle size={13} />
                      <strong>{issue.title}</strong>
                    </div>
                    <p>{issue.detail}</p>
                  </div>
                  <button
                    type="button"
                    className="pg-btn pg-btn-secondary pg-btn-xs"
                    onClick={() => handleAction(issue)}
                  >
                    {issue.fixLabel}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {report.passedChecks.length > 0 && (
            <div className="pg-audit-passed-row">
              {report.passedChecks.map((item) => (
                <span key={item} className="pg-audit-passed-pill">
                  <CheckCircle2 size={12} />
                  <span>{item}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
