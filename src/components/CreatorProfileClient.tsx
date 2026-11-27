"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Plus } from "lucide-react";
import StyleCard from "@/components/presentation/StyleCard";
import StyleDetailDrawer from "@/components/presentation/StyleDetailDrawer";
import { useApp } from "@/context/AppContext";
import type { PromptItem, UserPublic } from "@/types/prompt";
import "@/styles/gallery.css";
import "@/styles/community.css";

interface CreatorProfileClientProps {
  creator: UserPublic;
  initialPrompts: PromptItem[];
  impact: {
    publishedCount: number;
    totalLikes: number;
    totalSaves: number;
    totalCopies: number;
  };
  privateCount: number;
  isSelf: boolean;
}

export default function CreatorProfileClient({
  creator,
  initialPrompts,
  impact,
  privateCount,
  isSelf,
}: CreatorProfileClientProps) {
  const { globalTopic, setGlobalTopic } = useApp();
  const [prompts, setPrompts] = useState<PromptItem[]>(initialPrompts);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialPrompts[0]?.slug ?? ""
  );
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  const previewPrompt = useMemo(
    () => prompts.find((p) => p.slug === previewSlug) ?? null,
    [prompts, previewSlug]
  );

  const handleUpdate = (updated: PromptItem) => {
    setPrompts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  return (
    <main className="pg-page">
      <div className="pg-container">
        <div className="pg-studio-topbar" style={{ paddingBottom: 0 }}>
          <Link href="/gallery" className="pg-back-link">
            <ArrowLeft size={15} />
            <span>返回风格画廊</span>
          </Link>
        </div>

        <section className="pg-creator-hero" id="pg-creator-hero">
          <div className="pg-creator-hero-top">
            <div className="pg-creator-identity">
              <span
                className="pg-creator-avatar-lg"
                style={{ background: creator.avatarColor }}
              >
                {creator.displayName.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h1 className="pg-creator-name">{creator.displayName}</h1>
                <div className="pg-creator-handle">@{creator.username}</div>
                <p className="pg-creator-bio">
                  {creator.bio || "PPTGod 社区视觉提示词创作者"}
                </p>
              </div>
            </div>

            {isSelf && (
              <div className="pg-subpage-actions">
                {privateCount > 0 && (
                  <Link
                    href="/collections?tab=mine"
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    id="pg-creator-private-link"
                  >
                    <Lock size={14} />
                    <span>管理 {privateCount} 套私有风格</span>
                  </Link>
                )}
                <Link
                  href="/create"
                  className="pg-btn pg-btn-primary pg-btn-sm"
                >
                  <Plus size={14} />
                  <span>发布新风格</span>
                </Link>
              </div>
            )}
          </div>

          <div className="pg-impact-grid" id="pg-creator-impact">
            <div className="pg-impact-card">
              <span className="pg-impact-label">公开发布风格</span>
              <span className="pg-impact-value">{impact.publishedCount}</span>
            </div>
            <div className="pg-impact-card">
              <span className="pg-impact-label">累计获赞</span>
              <span className="pg-impact-value">
                {impact.totalLikes.toLocaleString()}
              </span>
            </div>
            <div className="pg-impact-card">
              <span className="pg-impact-label">累计被收藏</span>
              <span className="pg-impact-value">
                {impact.totalSaves.toLocaleString()}
              </span>
            </div>
            <div className="pg-impact-card">
              <span className="pg-impact-label">累计提示词复制</span>
              <span className="pg-impact-value">
                {impact.totalCopies.toLocaleString()}
              </span>
            </div>
          </div>
        </section>

        <section aria-label="创作者公开作品集">
          <div className="pg-panel-head" style={{ marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "17px" }}>
              公开视觉提示词作品集（{prompts.length}）
            </h2>
          </div>

          {prompts.length > 0 ? (
            <div className="gl-gallery-grid">
              {prompts.map((prompt) => (
                <StyleCard
                  key={prompt.id}
                  prompt={prompt}
                  liveTopic={globalTopic}
                  selected={selectedSlug === prompt.slug}
                  onSelect={(slug) => setSelectedSlug(slug)}
                  onPreview={(p) => setPreviewSlug(p.slug)}
                  onUpdatePrompt={handleUpdate}
                />
              ))}
            </div>
          ) : (
            <div className="pg-empty-state">
              <h2>暂未公开发布风格作品</h2>
              <p>该创作者目前还没有公开上架的 PPT 视觉提示词模板。</p>
            </div>
          )}
        </section>
      </div>

      <StyleDetailDrawer
        prompt={previewPrompt}
        liveTopic={globalTopic}
        onLiveTopicChange={setGlobalTopic}
        onClose={() => setPreviewSlug(null)}
        onUpdatePrompt={handleUpdate}
      />
    </main>
  );
}
