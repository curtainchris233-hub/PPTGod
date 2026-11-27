"use client";

import React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import SlideCanvas from "@/components/SlideCanvas";
import ExportPromptModal from "@/components/generate/ExportPromptModal";
import PresentationEditorView from "@/components/generate/PresentationEditorView";
import WorkshopWizardView from "@/components/generate/WorkshopWizardView";
import { useDeckWorkshop } from "@/hooks/useDeckWorkshop";
import {
  SLIDE_TYPE_LABELS,
  type PromptItem,
  type SavedDeck,
} from "@/types/prompt";
import "@/styles/generate.css";
import "@/styles/workshop.css";

interface GenerateClientProps {
  styles: PromptItem[];
  initialStyleSlug: string;
  initialTopic: string;
  initialDeck: SavedDeck | null;
  deckForbidden: boolean;
  initialHandoff?: boolean;
  initialIntake?: boolean;
  /** Deep-linked panel to open on arrival (`/generate?panel=audit`). */
  initialPanel?: "audit";
  /** Explicit view mode from `/generate?mode=create|editor`. */
  initialMode?: "workshop" | "editor";
}

export default function GenerateClient({
  styles,
  initialStyleSlug,
  initialTopic,
  initialDeck,
  deckForbidden,
  initialHandoff = false,
  initialIntake = false,
  initialPanel,
  initialMode,
}: GenerateClientProps) {
  const ws = useDeckWorkshop({
    styles,
    initialStyleSlug,
    initialTopic,
    initialDeck,
    initialHandoff,
    initialIntake,
    initialPanel,
    initialMode,
  });

  if (!ws.activeStyle || !ws.currentSlide || !ws.deckSpec) {
    return (
      <main className="gl-ws">
        <p>暂无可用视觉风格</p>
      </main>
    );
  }

  return (
    <main className={ws.mode === "editor" ? "gl-ed-root" : "gl-ws-root"}>
      {ws.mode === "workshop" ? (
        <WorkshopWizardView
          styles={styles}
          activeStyle={ws.activeStyle}
          deckSpec={ws.deckSpec}
          topic={ws.topic}
          subtitle={ws.subtitle}
          audience={ws.audience}
          slideCount={ws.slideCount}
          sourceText={ws.sourceText}
          evidenceDensity={ws.evidenceDensity}
          routeMode={ws.routeMode}
          engineMode={ws.engineMode}
          apiBase={ws.apiBase}
          apiKey={ws.apiKey}
          modelName={ws.modelName}
          parsingDoc={ws.parsingDoc}
          uploadedFiles={ws.uploadedFiles}
          uploadError={ws.uploadError}
          docAnalysis={ws.docAnalysis}
          outlineDraft={ws.outlineDraft}
          generatingOutline={ws.generatingOutline}
          generating={ws.generating}
          genError={ws.genError}
          slides={ws.slides}
          pendingDraft={
            ws.pendingDraft
              ? {
                  topic: ws.pendingDraft.topic,
                  slidesCount: ws.pendingDraft.slides.length,
                }
              : null
          }
          deckForbidden={deckForbidden}
          onTopicChange={ws.handleTopicChange}
          onSubtitleChange={ws.handleSubtitleChange}
          onAudienceChange={ws.handleAudienceChange}
          onSlideCountChange={ws.setSlideCount}
          onSourceTextChange={ws.setSourceText}
          onEvidenceDensityChange={ws.setEvidenceDensity}
          onRouteModeChange={ws.setRouteMode}
          onEngineModeChange={ws.handleEngineModeChange}
          onApiBaseChange={ws.handleApiBaseChange}
          onApiKeyChange={ws.handleApiKeyChange}
          onModelNameChange={ws.handleModelNameChange}
          onSelectStyle={ws.handleSelectStyle}
          onUploadFile={ws.handleDocumentFile}
          onRemoveUploadedFile={ws.handleRemoveUploadedFile}
          onBuildOutline={ws.handleBuildOutline}
          onChangeOutline={ws.setOutlineDraft}
          onCloseOutline={() => ws.setOutlineDraft(null)}
          onGenerate={ws.handleGenerate}
          onOpenEditor={() => ws.setMode("editor")}
          onOpenExportModal={() => ws.setExportModalOpen(true)}
          onOpenFullscreenPreview={() => ws.setFullscreen(true)}
          onRestoreDraft={ws.handleRestoreDraft}
          onDismissDraft={ws.handleDismissDraft}
        />
      ) : (
        <PresentationEditorView
          styles={styles}
          activeStyle={ws.activeStyle}
          deckSpec={ws.deckSpec}
          handoffApplied={ws.handoffApplied}
          topic={ws.topic}
          title={ws.title}
          subtitle={ws.subtitle}
          audience={ws.audience}
          slides={ws.slides}
          safeIndex={ws.safeIndex}
          currentSlide={ws.currentSlide}
          newSlideType={ws.newSlideType}
          pastCount={ws.pastCount}
          futureCount={ws.futureCount}
          savedDeckId={ws.savedDeckId}
          hasUnsavedChanges={ws.hasUnsavedChanges}
          isPublic={ws.isPublic}
          isViewingForeignSharedDeck={ws.isViewingForeignSharedDeck}
          saving={ws.saving}
          exportingPptx={ws.exportingPptx}
          linkCopied={ws.linkCopied}
          auditOpen={ws.auditOpen}
          generatingImg={ws.generatingImg}
          imgModelName={ws.imgModelName}
          imgPromptCopied={ws.imgPromptCopied}
          engineMode={ws.engineMode}
          byokReady={ws.byokReady}
          polishingAction={ws.polishingAction}
          pendingPolish={ws.pendingPolish}
          onBackToWorkshop={ws.handleBackToWorkshop}
          onOpenByokSettings={ws.openSettingsModal}
          onTitleChange={ws.handleTopicChange}
          onSelectStyle={ws.handleSelectStyle}
          onChangeSpec={ws.handleChangeSpec}
          onResetSpec={ws.handleResetSpec}
          onAuditOpenChange={ws.setAuditOpen}
          onAutoFixContrast={ws.handleAutoFixContrast}
          onAutoFillNotes={ws.handleAutoFillNotes}
          onUndo={ws.handleUndo}
          onRedo={ws.handleRedo}
          onSaveCloudDeck={() => ws.handleSaveCloudDeck()}
          onToggleVisibility={ws.handleToggleVisibility}
          onCopyShareLink={ws.handleCopyShareLink}
          onExportPptx={ws.handleExportPptx}
          onExportHtml={ws.handleExportHtml}
          onOpenExportModal={() => ws.setExportModalOpen(true)}
          onOpenFullscreen={() => ws.setFullscreen(true)}
          onChangeNewSlideType={ws.setNewSlideType}
          onSelectSlide={ws.handleSelectSlide}
          onDuplicateSlide={ws.handleDuplicateSlide}
          onMoveSlide={ws.handleMoveSlide}
          onDeleteSlide={ws.handleDeleteSlide}
          onDropReorder={ws.handleDropReorder}
          onAddSlide={ws.handleAddSlide}
          onUpdateSlide={ws.updateCurrentSlide}
          onChangeImgModelName={ws.handleImgModelNameChange}
          onUploadSlideImage={ws.handleUploadSlideImage}
          onCopySlideImagePrompt={ws.handleCopySlideImagePrompt}
          onGenerateAiSlideImage={ws.handleGenerateAiSlideImage}
          onRequestPolish={ws.handleRequestPolish}
          onConfirmPolish={ws.handleConfirmPolish}
          onDiscardPolish={ws.handleDiscardPolish}
        />
      )}

      {/* Real-Deck Marp Markdown / Claude & Gamma Prompt Export Modal */}
      <ExportPromptModal
        open={ws.exportModalOpen}
        onClose={() => ws.setExportModalOpen(false)}
        title={ws.title}
        subtitle={ws.subtitle}
        audience={ws.audience}
        styleName={ws.activeStyle.title}
        spec={ws.deckSpec}
        slides={ws.slides}
        onNotify={ws.showToast}
      />

      {/* Fullscreen Presenter Overlay */}
      {ws.fullscreen && (
        <div
          className="pg-presenter-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="全屏演播播放"
        >
          <div className="pg-presenter-bar">
            <div className="pg-presenter-info">
              <span>{ws.title}</span>
              <span className="pg-presenter-counter">
                {ws.safeIndex + 1} / {ws.slides.length} ·{" "}
                {SLIDE_TYPE_LABELS[ws.currentSlide.slideType].label}
              </span>
            </div>
            <div className="pg-presenter-controls">
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() =>
                  ws.setActiveIndex(
                    (ws.safeIndex - 1 + ws.slides.length) % ws.slides.length
                  )
                }
                aria-label="上一页"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() =>
                  ws.setActiveIndex((ws.safeIndex + 1) % ws.slides.length)
                }
                aria-label="下一页"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                className="pg-presenter-btn"
                onClick={() => ws.setFullscreen(false)}
                aria-label="退出全屏"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="pg-presenter-stage">
            <SlideCanvas
              spec={ws.deckSpec}
              slideType={ws.currentSlide.slideType}
              topic={ws.title}
              subtitle={ws.subtitle}
              audience={ws.audience}
              slideData={ws.currentSlide}
              pageIndex={ws.safeIndex}
              totalPages={ws.slides.length}
              englishTitle={ws.activeStyle.englishTitle}
              scenario={ws.activeStyle.scenario}
            />
          </div>
          {ws.currentSlide.speakerNotes && (
            <p
              className="pg-presenter-hint"
              style={{ maxWidth: "820px", textAlign: "center" }}
            >
              讲稿备注：{ws.currentSlide.speakerNotes}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
