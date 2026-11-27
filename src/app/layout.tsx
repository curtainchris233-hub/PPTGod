import type { Metadata } from "next";
import {
  Instrument_Serif,
  JetBrains_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
  Plus_Jakarta_Sans,
} from "next/font/google";
import AuthModal from "@/components/AuthModal";
import CompareDock from "@/components/CompareDock";
import AppShell from "@/components/layout/AppShell";
import { AppProvider } from "@/context/AppContext";
import { LayoutProvider } from "@/context/LayoutContext";
import { demoAccountEnabled, publicPreviewEnabled } from "@/lib/auth-config";
import "@/styles/glacier-tokens.css";
import "@/styles/glacier-layout.css";
import "@/styles/glacier-ui.css";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

const notoSansSc = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  preload: false,
  variable: "--font-cjk-sans",
  display: "swap",
});

const notoSerifSc = Noto_Serif_SC({
  weight: ["500", "600", "700"],
  preload: false,
  variable: "--font-cjk-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "PPTGod · AI 提示词包工作台与 PPT 风格参考库",
    template: "%s | PPTGod",
  },
  description:
    "从主题、文档与灵感到可编辑演示文稿的 AI 创作平台：实时 16:9 风格预览、智能大纲、在线编辑器、设计体检、演讲排练与原生 PPTX / 离线 HTML 导出。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicPreview = publicPreviewEnabled();

  return (
    <html
      lang="zh-CN"
      className={`${plusJakarta.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${notoSansSc.variable} ${notoSerifSc.variable}`}
    >
      <body>
        <AppProvider>
          <LayoutProvider>
            <AppShell publicPreview={publicPreview}>{children}</AppShell>
            <CompareDock />
            <AuthModal
              publicPreview={publicPreview}
              showDemoAccount={!publicPreview && process.env.NODE_ENV !== "production" && demoAccountEnabled()}
            />
          </LayoutProvider>
        </AppProvider>
      </body>
    </html>
  );
}
