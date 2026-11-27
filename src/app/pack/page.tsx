import type { Metadata } from "next";
import PromptPackWorkbench from "@/components/pack/PromptPackWorkbench";

export const metadata: Metadata = {
  title: "提示词包 · 资料一键变成可直接用的 PPT 提示词",
  description:
    "上传论文、课本或报告，PPTGod 自动提炼定制风格（色板 HEX / 字体 / 版式语法）与逐页大纲，生成适配 ChatGPT、Gamma、Kimi、Claude 的总提示词，数据只取自你的资料。",
};

export default function PackPage() {
  return <PromptPackWorkbench />;
}
