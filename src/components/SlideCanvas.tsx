"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderAnatomyOverlay } from "@/components/slide-canvas/SlideAnatomyOverlay";
import { renderDecorativeMotif } from "@/components/slide-canvas/SlideChrome";
import {
  renderAgenda,
  renderClosing,
  renderComparison,
  renderData,
  renderProcess,
  renderQuote,
  renderTimeline,
} from "@/components/slide-canvas/SlideCoreLayouts";
import { renderCover } from "@/components/slide-canvas/SlideCover";
import {
  renderFunnelDonut,
  renderImageSplit,
  renderSwot,
  renderTeamGrid,
} from "@/components/slide-canvas/SlideV3Layouts";
import {
  buildSlideRenderContext,
  type SlideCanvasProps,
} from "@/components/slide-canvas/types";

export type { SlideCanvasProps } from "@/components/slide-canvas/types";

function SlideCanvasInner(props: SlideCanvasProps) {
  const { slideType, className = "" } = props;
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const updateScale = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / 960);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ctx = useMemo(
    () => buildSlideRenderContext(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.spec,
      props.slideType,
      props.topic,
      props.subtitle,
      props.audience,
      props.slideCount,
      props.englishTitle,
      props.scenario,
      props.highlightDimension,
      props.slideData,
      props.pageIndex,
      props.totalPages,
    ]
  );

  const { palette, bodyFont, padX, padY } = ctx;

  return (
    <div
      ref={outerRef}
      className={`pg-slide-outer ${className}`}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        background: palette.bg,
      }}
    >
      <div
        className="pg-slide-stage"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "960px",
          height: "540px",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: palette.bg,
          color: palette.text,
          fontFamily: bodyFont,
          padding: `${padY}px ${padX}px`,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        {renderDecorativeMotif(ctx)}
        {slideType === "cover" && renderCover(ctx)}
        {slideType === "agenda" && renderAgenda(ctx)}
        {slideType === "process" && renderProcess(ctx)}
        {slideType === "image-split" && renderImageSplit(ctx)}
        {slideType === "data" && renderData(ctx)}
        {slideType === "funnel-donut" && renderFunnelDonut(ctx)}
        {slideType === "comparison" && renderComparison(ctx)}
        {slideType === "swot" && renderSwot(ctx)}
        {slideType === "timeline" && renderTimeline(ctx)}
        {slideType === "team-grid" && renderTeamGrid(ctx)}
        {slideType === "quote" && renderQuote(ctx)}
        {slideType === "closing" && renderClosing(ctx)}
        {renderAnatomyOverlay(ctx)}
      </div>
    </div>
  );
}

const SlideCanvas = React.memo(SlideCanvasInner);
SlideCanvas.displayName = "SlideCanvas";

export default SlideCanvas;
