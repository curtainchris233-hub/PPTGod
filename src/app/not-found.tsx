import Link from "next/link";

export default function NotFound() {
  return (
    <main className="pg-page">
      <div className="pg-container" style={{ paddingTop: "64px" }}>
        <div className="pg-empty-state">
          <p className="pg-kicker">404 · NOT FOUND</p>
          <h2>没有找到对应的 PPT 视觉风格</h2>
          <p>该模板可能已被创作者删除，或链接地址有误。</p>
          <div className="pg-empty-actions">
            <Link href="/" className="pg-btn pg-btn-primary">
              返回视觉画廊
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
