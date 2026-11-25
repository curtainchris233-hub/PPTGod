import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPromptBySlugOrId } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "PPTGod Visual Presentation Prompt Specimen";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const ASCII_PRINTABLE_RE = /^[\x20-\x7E]+$/;

function safeAscii(value: string | undefined, fallback: string): string {
  const trimmed = (value || "").trim();
  if (trimmed && ASCII_PRINTABLE_RE.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Pass viewerId=undefined so private prompts NEVER leak in OpenGraph social cards
  const prompt = getPromptBySlugOrId(slug, undefined);

  if (!prompt || !prompt.isPublic) {
    notFound();
  }

  const { palette, typography, layout } = prompt.visualSpec;
  const swatches = [
    { label: "BG", hex: palette.bg },
    { label: "SURFACE", hex: palette.surface },
    { label: "INK", hex: palette.text },
    { label: "ACCENT", hex: palette.accent },
  ];

  const heroTitle = safeAscii(
    prompt.englishTitle,
    prompt.slug.replace(/-/g, " ").toUpperCase()
  );
  const fontBadge = safeAscii(typography.headingFontLabel, typography.mood.toUpperCase());
  const archetypeBadge = layout.archetype.toUpperCase();
  const motifBadge = layout.decorativeMotif.toUpperCase();
  const chartColors = palette.chartColors || [
    palette.accent,
    palette.text,
    palette.muted,
    palette.border,
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: palette.bg,
          color: palette.text,
          padding: "56px 64px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Top Accent Strip */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "10px",
            backgroundColor: palette.accent,
            display: "flex",
          }}
        />

        {/* Top Bar: Brand + Archetype Specs */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "6px",
                backgroundColor: palette.accent,
                color: palette.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "18px",
              }}
            >
              P
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: palette.text,
                }}
              >
                PPTGOD STUDIO
              </span>
              <span
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  color: palette.muted,
                }}
              >
                VISUAL PPT PROMPT SPECIMEN
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                padding: "8px 14px",
                borderRadius: "999px",
                backgroundColor: palette.surface,
                border: `1px solid ${palette.border}`,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: palette.text,
              }}
            >
              {archetypeBadge}
            </div>
            <div
              style={{
                display: "flex",
                padding: "8px 14px",
                borderRadius: "999px",
                backgroundColor: palette.accent,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#FFFFFF",
              }}
            >
              12 SLIDE TYPES
            </div>
          </div>
        </div>

        {/* Center Hero Composition: Title + Miniature Chart Card */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "44px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: palette.accent,
                textTransform: "uppercase",
              }}
            >
              {`DESIGN SYSTEM · ${motifBadge} · R${layout.cornerRadius}PX`}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "58px",
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                color: palette.text,
              }}
            >
              {heroTitle}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "20px",
                color: palette.muted,
                lineHeight: 1.4,
              }}
            >
              {`16:9 Live Preview · Native .PPTX & Offline .HTML · ${fontBadge}`}
            </div>
          </div>

          {/* Miniature Visual Specimen Preview Card */}
          <div
            style={{
              width: "340px",
              height: "220px",
              backgroundColor: palette.surface,
              border: `2px solid ${palette.border}`,
              borderRadius: `${Math.min(20, Math.max(4, layout.cornerRadius))}px`,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "96px",
                  height: "10px",
                  borderRadius: "4px",
                  backgroundColor: palette.accent,
                  display: "flex",
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: palette.muted,
                }}
              >
                16 : 9
              </span>
            </div>

            {/* Mini Bar Chart Specimen */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "16px",
                height: "110px",
                paddingTop: "12px",
              }}
            >
              {[54, 78, 96, 68].map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}px`,
                    borderRadius: `${Math.min(8, Math.max(2, Math.round(layout.cornerRadius / 2)))}px`,
                    backgroundColor: chartColors[i] || palette.accent,
                    display: "flex",
                  }}
                />
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                fontWeight: 700,
                color: palette.muted,
                letterSpacing: "0.08em",
              }}
            >
              <span>{`DENSITY: ${layout.density.toUpperCase()}`}</span>
              <span>{`W${typography.titleWeight}`}</span>
            </div>
          </div>
        </div>

        {/* Bottom Palette Token Swatch Strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${palette.border}`,
            paddingTop: "22px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            {swatches.map((sw) => (
              <div
                key={sw.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    backgroundColor: sw.hex,
                    border: `1px solid ${palette.border}`,
                    display: "flex",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: palette.muted,
                    }}
                  >
                    {sw.label}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: palette.text,
                    }}
                  >
                    {sw.hex.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "14px",
              fontWeight: 700,
              color: palette.muted,
              letterSpacing: "0.06em",
            }}
          >
            {`/studio/${prompt.slug}`}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
