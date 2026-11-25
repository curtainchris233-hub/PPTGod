import React from "react";
import { ANATOMY_META } from "@/types/prompt";
import type { SlideRenderContext } from "./types";

export function renderAnatomyOverlay(ctx: SlideRenderContext) {
  const {
    palette,
    typography,
    layout,
    highlightDimension,
    monoFont,
    padX,
    padY,
    radius,
  } = ctx;
  if (!highlightDimension) return null;
  const meta = ANATOMY_META[highlightDimension];

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "14px",
          left: "50%",
          transform: "translateX(-50%)",
          background: meta.color,
          color: "#FFFFFF",
          fontFamily: monoFont,
          fontSize: "12px",
          fontWeight: 600,
          padding: "5px 14px",
          borderRadius: "999px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          whiteSpace: "nowrap",
        }}
      >
        <span>● {meta.label}</span>
        <span style={{ opacity: 0.78 }}>{meta.visualHint}</span>
      </div>

      {highlightDimension === "layout" && (
        <svg
          viewBox="0 0 960 540"
          style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
        >
          <rect
            x={padX}
            y={padY}
            width={960 - padX * 2}
            height={540 - padY * 2}
            fill="none"
            stroke={meta.color}
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const innerW = 960 - padX * 2;
            const colW = (innerW - 11 * 12) / 12;
            const x = padX + i * (colW + 12);
            return (
              <rect
                key={i}
                x={x}
                y={padY}
                width={colW}
                height={540 - padY * 2}
                fill={meta.color}
                opacity="0.09"
              />
            );
          })}
          <rect
            x={padX + 8}
            y={540 - padY - 26}
            width="255"
            height="20"
            rx="4"
            fill={meta.color}
          />
          <text
            x={padX + 16}
            y={540 - padY - 12}
            fill="#FFFFFF"
            fontSize="11"
            fontFamily={monoFont}
          >
            MARGIN {padX}px · RADIUS {radius}px · {layout.density.toUpperCase()}
          </text>
        </svg>
      )}

      {highlightDimension === "palette" && (
        <div
          style={{
            position: "absolute",
            bottom: "22px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "10px",
            background: "rgba(18, 18, 20, 0.92)",
            padding: "10px 16px",
            borderRadius: "10px",
            border: `1.5px solid ${meta.color}`,
            boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
          }}
        >
          {[
            { name: "BG", hex: palette.bg },
            { name: "SURFACE", hex: palette.surface },
            { name: "TEXT", hex: palette.text },
            { name: "ACCENT", hex: palette.accent },
          ].map((sw) => (
            <div
              key={sw.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                color: "#FFF",
                fontFamily: monoFont,
                fontSize: "11px",
              }}
            >
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                  background: sw.hex,
                  border: "1px solid rgba(255,255,255,0.35)",
                }}
              />
              <span>
                {sw.name} {sw.hex}
              </span>
            </div>
          ))}
        </div>
      )}

      {highlightDimension === "typography" && (
        <div
          style={{
            position: "absolute",
            left: `${padX}px`,
            right: `${padX}px`,
            top: "120px",
            border: `2px dashed ${meta.color}`,
            background: `${meta.color}12`,
            padding: "12px 16px",
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: "11px",
              color: meta.color,
              fontWeight: 700,
            }}
          >
            HEADING: {typography.headingFontLabel} · WEIGHT{" "}
            {typography.titleWeight} · TRACKING {typography.titleTracking} |
            BODY: {typography.bodyFontLabel}
          </div>
        </div>
      )}

      {highlightDimension === "style" && (
        <div
          style={{
            position: "absolute",
            inset: "10px",
            border: `2.5px solid ${meta.color}`,
            borderRadius: `${radius}px`,
            boxShadow: `inset 0 0 0 6px ${meta.color}1A`,
          }}
        />
      )}

      {highlightDimension === "content" && (
        <div
          style={{
            position: "absolute",
            left: `${padX - 6}px`,
            right: `${padX - 6}px`,
            bottom: `${padY - 6}px`,
            top: "110px",
            border: `2px solid ${meta.color}`,
            background: `${meta.color}0E`,
            borderRadius: "8px",
          }}
        />
      )}
    </div>
  );
}
