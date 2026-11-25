import type { Metadata } from "next";
import Link from "next/link";
import {
  Instrument_Serif,
  JetBrains_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
  Plus_Jakarta_Sans,
} from "next/font/google";
import AiAmbientAccent from "@/components/AiAmbientAccent";
import AuthModal from "@/components/AuthModal";
import CompareDock from "@/components/CompareDock";
import Navbar from "@/components/Navbar";
import { AppProvider } from "@/context/AppContext";
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
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "PPTGod · 可视化 PPT 提示词视觉画廊与工作台",
    template: "%s | PPTGod",
  },
  description:
    "实时可视化渲染每一套 PPT 提示词的 16:9 封面、目录、数据图表、双栏对比与结尾页视觉效果，一键定制并导出适配 Claude HTML、Gamma、Kimi、NotebookLM 与 AI 生图的专业提示词。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${plusJakarta.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${notoSansSc.variable} ${notoSerifSc.variable}`}
    >
      <body>
        <AppProvider>
          <div className="pg-shell">
            <Navbar />
            {children}
            <footer className="pg-footer">
              <AiAmbientAccent variant="footer-stream" />
              <div className="pg-container pg-footer-inner">
                <div className="pg-footer-brand">
                  <strong>PPTGod</strong>
                  <span> · 视觉驱动的 PPT 提示词与生成实验室</span>
                </div>
                <div className="pg-footer-meta pg-footer-links">
                  <Link href="/tools" id="pg-footer-tools-link" className="pg-footer-link">
                    PPT 效率工具箱
                  </Link>
                  <span>·</span>
                  <span>6 大 AI 工具编译</span>
                  <span>·</span>
                  <span>原生 .pptx / .html</span>
                </div>
              </div>
            </footer>
            <CompareDock />
            <AuthModal />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
