import React from "react";

interface AiAmbientAccentProps {
  variant: "hero-neural" | "panel-corner" | "footer-stream";
}

/**
 * Subtle, localized AI decorative accents (flowing data-stream curves,
 * minimalist neural network nodes, and soft luminous light particles).
 * Strictly non-interactive (pointer-events: none) and whisper-quiet so
 * glassmorphic surfaces stay clean, legible, and uncluttered.
 */
export default function AiAmbientAccent({ variant }: AiAmbientAccentProps) {
  if (variant === "hero-neural") {
    return (
      <div
        className="pg-ai-ambient pg-ai-ambient--hero"
        aria-hidden="true"
      >
        <svg
          className="pg-ai-svg"
          viewBox="0 0 1440 360"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="pgAiFlowA" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
              <stop offset="28%" stopColor="#3b82f6" stopOpacity="0.32" />
              <stop offset="68%" stopColor="#06b6d4" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pgAiFlowB" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
              <stop offset="45%" stopColor="#6366f1" stopOpacity="0.24" />
              <stop offset="80%" stopColor="#14b8a6" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="pgAiOrbSky" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.24" />
              <stop offset="60%" stopColor="#93c5fd" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pgAiOrbTeal" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.22" />
              <stop offset="65%" stopColor="#99f6e4" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#99f6e4" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft translucent ambient glow orbs behind glass panels */}
          <circle cx="1140" cy="145" r="210" fill="url(#pgAiOrbSky)" />
          <circle cx="810" cy="245" r="175" fill="url(#pgAiOrbTeal)" />
          <circle cx="220" cy="60" r="150" fill="url(#pgAiOrbSky)" opacity="0.65" />

          {/* Graceful hairline data-flow streams */}
          <path
            d="M 520 42 C 720 12, 860 156, 1085 112 C 1220 86, 1320 46, 1430 78"
            stroke="url(#pgAiFlowA)"
            strokeWidth="1.25"
          />
          <path
            d="M 520 42 C 720 12, 860 156, 1085 112 C 1220 86, 1320 46, 1430 78"
            stroke="url(#pgAiFlowA)"
            strokeWidth="2"
            strokeLinecap="round"
            className="pg-ai-flow-pulse"
          />
          <path
            d="M 610 292 C 790 250, 945 170, 1150 205 C 1280 227, 1365 182, 1440 152"
            stroke="url(#pgAiFlowB)"
            strokeWidth="1.15"
          />
          <path
            d="M 610 292 C 790 250, 945 170, 1150 205 C 1280 227, 1365 182, 1440 152"
            stroke="url(#pgAiFlowB)"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="pg-ai-flow-pulse pg-ai-flow-pulse--slow"
          />
          <path
            d="M -10 288 C 125 268, 220 298, 360 278"
            stroke="url(#pgAiFlowA)"
            strokeWidth="1"
            opacity="0.55"
          />

          {/* Minimalist neural constellation edges (perimeter localized) */}
          <g stroke="#3b82f6" strokeOpacity="0.16" strokeWidth="0.85">
            <line x1="1268" y1="54" x2="1348" y2="92" />
            <line x1="1348" y1="92" x2="1392" y2="42" />
            <line x1="1268" y1="54" x2="1312" y2="150" />
            <line x1="1348" y1="92" x2="1312" y2="150" />
            <line x1="1312" y1="150" x2="1394" y2="188" />
            <line x1="652" y1="42" x2="718" y2="74" />
            <line x1="718" y1="74" x2="684" y2="128" />
          </g>

          {/* Neural network nodes (delicate halo + crisp core) */}
          <g>
            <circle cx="1268" cy="54" r="7" fill="#3b82f6" fillOpacity="0.10" />
            <circle cx="1268" cy="54" r="2.6" fill="#2563eb" fillOpacity="0.55" />

            <circle cx="1348" cy="92" r="9" fill="#06b6d4" fillOpacity="0.12" />
            <circle cx="1348" cy="92" r="3" fill="#0891b2" fillOpacity="0.62" />

            <circle cx="1392" cy="42" r="6" fill="#6366f1" fillOpacity="0.11" />
            <circle cx="1392" cy="42" r="2.2" fill="#4f46e5" fillOpacity="0.52" />

            <circle cx="1312" cy="150" r="7.5" fill="#3b82f6" fillOpacity="0.10" />
            <circle cx="1312" cy="150" r="2.4" fill="#2563eb" fillOpacity="0.50" />

            <circle cx="1394" cy="188" r="6" fill="#14b8a6" fillOpacity="0.12" />
            <circle cx="1394" cy="188" r="2.2" fill="#0d9488" fillOpacity="0.52" />

            <circle cx="652" cy="42" r="6" fill="#3b82f6" fillOpacity="0.10" />
            <circle cx="652" cy="42" r="2.2" fill="#2563eb" fillOpacity="0.48" />

            <circle cx="718" cy="74" r="8" fill="#06b6d4" fillOpacity="0.10" />
            <circle cx="718" cy="74" r="2.5" fill="#0891b2" fillOpacity="0.52" />

            <circle cx="684" cy="128" r="5.5" fill="#6366f1" fillOpacity="0.09" />
            <circle cx="684" cy="128" r="2" fill="#4f46e5" fillOpacity="0.44" />
          </g>

          {/* Soft luminous micro-particles */}
          <g className="pg-ai-particles">
            <circle cx="584" cy="64" r="1.8" fill="#3b82f6" className="pg-ai-particle" />
            <circle cx="792" cy="34" r="1.5" fill="#06b6d4" className="pg-ai-particle pg-ai-particle--d2" />
            <circle cx="1012" cy="48" r="2.1" fill="#6366f1" className="pg-ai-particle pg-ai-particle--d3" />
            <circle cx="1218" cy="28" r="1.6" fill="#0ea5e9" className="pg-ai-particle" />
            <circle cx="1408" cy="128" r="2" fill="#14b8a6" className="pg-ai-particle pg-ai-particle--d2" />
            <circle cx="1238" cy="276" r="1.8" fill="#3b82f6" className="pg-ai-particle pg-ai-particle--d3" />
            <circle cx="642" cy="252" r="1.6" fill="#06b6d4" className="pg-ai-particle" />
            <circle cx="96" cy="276" r="1.8" fill="#3b82f6" className="pg-ai-particle pg-ai-particle--d2" />
            <circle cx="294" cy="288" r="1.5" fill="#06b6d4" className="pg-ai-particle pg-ai-particle--d3" />
          </g>
        </svg>
      </div>
    );
  }

  if (variant === "panel-corner") {
    return (
      <div
        className="pg-ai-ambient pg-ai-ambient--corner"
        aria-hidden="true"
      >
        <svg
          className="pg-ai-svg"
          viewBox="0 0 220 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="pgAiCornerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
              <stop offset="55%" stopColor="#2563eb" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.34" />
            </linearGradient>
          </defs>
          <path
            d="M 24 12 C 88 8, 128 52, 212 36"
            stroke="url(#pgAiCornerGrad)"
            strokeWidth="1.1"
          />
          <path
            d="M 78 4 C 134 24, 152 68, 216 74"
            stroke="url(#pgAiCornerGrad)"
            strokeWidth="0.9"
            strokeOpacity="0.7"
          />
          <g stroke="#2563eb" strokeOpacity="0.18" strokeWidth="0.75">
            <line x1="146" y1="26" x2="184" y2="44" />
            <line x1="184" y1="44" x2="202" y2="18" />
            <line x1="184" y1="44" x2="176" y2="76" />
          </g>
          <circle cx="146" cy="26" r="5" fill="#3b82f6" fillOpacity="0.10" />
          <circle cx="146" cy="26" r="2" fill="#2563eb" fillOpacity="0.52" />
          <circle cx="184" cy="44" r="6.5" fill="#06b6d4" fillOpacity="0.12" />
          <circle cx="184" cy="44" r="2.2" fill="#0891b2" fillOpacity="0.60" />
          <circle cx="202" cy="18" r="4.5" fill="#6366f1" fillOpacity="0.12" />
          <circle cx="202" cy="18" r="1.8" fill="#4f46e5" fillOpacity="0.50" />
          <circle cx="176" cy="76" r="4.5" fill="#14b8a6" fillOpacity="0.12" />
          <circle cx="176" cy="76" r="1.7" fill="#0d9488" fillOpacity="0.48" />
          <circle cx="118" cy="18" r="1.3" fill="#3b82f6" className="pg-ai-particle" />
          <circle cx="206" cy="60" r="1.4" fill="#06b6d4" className="pg-ai-particle pg-ai-particle--d2" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="pg-ai-ambient pg-ai-ambient--footer"
      aria-hidden="true"
    >
      <svg
        className="pg-ai-svg"
        viewBox="0 0 1200 24"
        fill="none"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pgAiFooterLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="22%" stopColor="#3b82f6" stopOpacity="0.28" />
            <stop offset="52%" stopColor="#06b6d4" stopOpacity="0.34" />
            <stop offset="82%" stopColor="#6366f1" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 0 12 Q 300 4, 600 12 T 1200 12"
          stroke="url(#pgAiFooterLine)"
          strokeWidth="1.2"
        />
        <path
          d="M 0 12 Q 300 4, 600 12 T 1200 12"
          stroke="url(#pgAiFooterLine)"
          strokeWidth="2"
          strokeLinecap="round"
          className="pg-ai-flow-pulse"
        />
        <circle cx="240" cy="9" r="2.2" fill="#3b82f6" fillOpacity="0.45" />
        <circle cx="480" cy="10" r="2.5" fill="#06b6d4" fillOpacity="0.52" />
        <circle cx="720" cy="14" r="2.2" fill="#6366f1" fillOpacity="0.45" />
        <circle cx="960" cy="13" r="2" fill="#0d9488" fillOpacity="0.42" />
      </svg>
    </div>
  );
}
