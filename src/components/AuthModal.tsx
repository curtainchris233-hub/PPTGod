"use client";

import React, { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useApp } from "@/context/AppContext";

interface AuthFormBodyProps {
  initialTab: "login" | "register";
  onClose: () => void;
}

function AuthFormBody({ initialTab, onClose }: AuthFormBodyProps) {
  const { setAuthData, showToast } = useApp();

  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const endpoint =
        tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        tab === "login"
          ? { email, password }
          : { displayName, email, password, bio };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "操作失败，请检查输入");
        return;
      }

      setAuthData(data.user, data.stats);
      showToast(
        tab === "login"
          ? `欢迎回来，${data.user.displayName}`
          : `注册成功，欢迎加入 PPTGod！`,
        "success"
      );
      onClose();
    } catch {
      setError("网络连接异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "demo@pptgod.studio",
          password: "demo1234",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "演示账号登录失败");
        return;
      }
      setAuthData(data.user, data.stats);
      showToast(`已使用体验账号登录：${data.user.displayName}`, "success");
      onClose();
    } catch {
      setError("网络连接异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pg-modal">
      <div className="pg-modal-head">
        <div>
          <h2 id="pg-auth-title" className="pg-modal-title">
            {tab === "login" ? "登录 PPTGod 社区" : "创建你的创作者账号"}
          </h2>
          <p className="pg-modal-sub">
            {tab === "login"
              ? "云端同步收藏夹、点赞支持并发布你的原创 PPT 视觉提示词"
              : "加入视觉提示词社区，自由构建并分享高颜值 PPT 风格"}
          </p>
        </div>
        <button
          type="button"
          className="pg-icon-btn"
          onClick={onClose}
          aria-label="关闭窗口"
        >
          <X size={18} />
        </button>
      </div>

      <div className="pg-segmented">
        <button
          type="button"
          className={`pg-seg-btn ${tab === "login" ? "is-active" : ""}`}
          onClick={() => {
            setTab("login");
            setError("");
          }}
          id="pg-auth-tab-login"
        >
          账号登录
        </button>
        <button
          type="button"
          className={`pg-seg-btn ${tab === "register" ? "is-active" : ""}`}
          onClick={() => {
            setTab("register");
            setError("");
          }}
          id="pg-auth-tab-register"
        >
          注册新账号
        </button>
      </div>

      {tab === "login" && (
        <button
          type="button"
          className="pg-demo-banner"
          onClick={handleDemoLogin}
          disabled={submitting}
          id="pg-demo-login-btn"
        >
          <Sparkles size={15} />
          <span>一键登录体验演示账号（林屿 · demo@pptgod.studio）</span>
        </button>
      )}

      <form onSubmit={handleSubmit} className="pg-form">
        {tab === "register" && (
          <div className="pg-field">
            <label htmlFor="pg-auth-name">创作者昵称</label>
            <input
              id="pg-auth-name"
              type="text"
              required
              placeholder="例如：阿泽 · 产品设计师"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        )}

        <div className="pg-field">
          <label htmlFor="pg-auth-email">邮箱地址</label>
          <input
            id="pg-auth-email"
            type="email"
            required
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="pg-field">
          <label htmlFor="pg-auth-password">密码</label>
          <input
            id="pg-auth-password"
            type="password"
            required
            minLength={6}
            placeholder="至少 6 位字符"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {tab === "register" && (
          <div className="pg-field">
            <label htmlFor="pg-auth-bio">一句话简介（选填）</label>
            <input
              id="pg-auth-bio"
              type="text"
              maxLength={100}
              placeholder="例如：擅长商业路演与极简信息图设计"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        )}

        {error && <div className="pg-form-error">{error}</div>}

        <button
          type="submit"
          className="pg-btn pg-btn-primary pg-btn-full"
          disabled={submitting}
          id="pg-auth-submit-btn"
        >
          {submitting
            ? "处理中..."
            : tab === "login"
            ? "立即登录"
            : "完成注册并登录"}
        </button>
      </form>
    </div>
  );
}

export default function AuthModal() {
  const { authModalOpen, authModalTab, closeAuthModal } = useApp();

  React.useEffect(() => {
    if (!authModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuthModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  return (
    <div
      className="pg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pg-auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <AuthFormBody
        key={authModalTab}
        initialTab={authModalTab}
        onClose={closeAuthModal}
      />
    </div>
  );
}
