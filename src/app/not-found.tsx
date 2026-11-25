import Link from "next/link";
import { Compass } from "lucide-react";
import { GlacierPanel } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="gl-page gl-notfound-page">
      <GlacierPanel
        variant="solid"
        radius="xl"
        padding="none"
        className="gl-notfound-card"
      >
        <div className="gl-notfound-badge" aria-hidden="true">
          <Compass size={26} strokeWidth={1.75} />
        </div>
        <p className="gl-notfound-kicker">404 · 页面未找到</p>
        <h1 className="gl-notfound-title">没有找到对应的页面或风格</h1>
        <p className="gl-notfound-desc">
          该页面、演示文稿或视觉风格可能已被删除、设为私有，或链接地址有误。
        </p>
        <div className="gl-notfound-actions">
          <Link href="/" className="gl-btn gl-btn--primary gl-btn--md">
            返回首页工作台
          </Link>
          {/* Enabled once M2 introduces /gallery/page.tsx */}
          <Link
            href="/gallery"
            prefetch={false}
            className="gl-btn gl-btn--secondary gl-btn--md"
          >
            浏览风格画廊
          </Link>
        </div>
      </GlacierPanel>
    </main>
  );
}
