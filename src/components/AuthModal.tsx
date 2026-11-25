"use client";

import React, { useState } from "react";
import Image from "next/image";
import { AlertCircle, Sparkles } from "lucide-react";
import { Button, Dialog, Tabs, TextInput } from "@/components/ui";
import { useApp } from "@/context/AppContext";

interface AuthFormDialogProps {
  initialTab: "login" | "register";
  onClose: () => void;
}

function AuthFormDialog({ initialTab, onClose }: AuthFormDialogProps) {
  const { setAuthData, showToast } = useApp();

  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          : "注册成功，欢迎加入 PPTGod！",
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
    <Dialog
      open
      onClose={onClose}
      size="sm"
      titleId="pg-auth-title"
      className="gl-auth-dialog"
      title={
        <span className="gl-auth-title-row">
          <Image
            src="/brand/pptgod-logo.svg"
            alt=""
            width={26}
            height={26}
            unoptimized
            aria-hidden="true"
            className="gl-auth-logo"
          />
          <span>
            {tab === "login" ? "登录 PPTGod 社区" : "创建你的创作者账号"}
          </span>
        </span>
      }
      description={
        tab === "login"
          ? "云端同步收藏夹、演示文稿项目并发布你的原创 PPT 视觉提示词"
          : "加入视觉提示词社区，自由构建并分享高颜值 PPT 风格"
      }
    >
      <div className="gl-auth-content">
        <Tabs
          variant="segment"
          size="sm"
          fullWidth
          ariaLabel="登录或注册模式切换"
          value={tab}
          onChange={(nextId) => {
            setTab(nextId === "register" ? "register" : "login");
            setError("");
          }}
          items={[
            { id: "login", label: "账号登录", htmlId: "pg-auth-tab-login" },
            {
              id: "register",
              label: "注册新账号",
              htmlId: "pg-auth-tab-register",
            },
          ]}
        />

        {tab === "login" && (
          <button
            type="button"
            className="gl-auth-demo-btn"
            onClick={handleDemoLogin}
            disabled={submitting}
            id="pg-demo-login-btn"
          >
            <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
            <span>一键登录体验演示账号（林屿 · demo@pptgod.studio）</span>
          </button>
        )}

        <form onSubmit={handleSubmit} className="gl-auth-form">
          {tab === "register" && (
            <TextInput
              id="pg-auth-name"
              label="创作者昵称"
              type="text"
              required
              autoComplete="nickname"
              placeholder="例如：阿泽 · 产品设计师"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "pg-auth-error" : undefined}
            />
          )}

          <TextInput
            id="pg-auth-email"
            label="邮箱地址"
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "pg-auth-error" : undefined}
          />

          <TextInput
            id="pg-auth-password"
            label="密码"
            type="password"
            required
            minLength={6}
            autoComplete={
              tab === "login" ? "current-password" : "new-password"
            }
            placeholder="至少 6 位字符"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "pg-auth-error" : undefined}
          />

          {tab === "register" && (
            <TextInput
              id="pg-auth-bio"
              label="一句话简介（选填）"
              type="text"
              maxLength={100}
              placeholder="例如：擅长商业路演与极简信息图设计"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          )}

          {error && (
            <div id="pg-auth-error" className="gl-auth-error" role="alert">
              <AlertCircle size={15} strokeWidth={2} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            loadingText="处理中..."
            id="pg-auth-submit-btn"
          >
            {tab === "login" ? "立即登录" : "完成注册并登录"}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}

export default function AuthModal() {
  const { authModalOpen, authModalTab, closeAuthModal } = useApp();

  if (!authModalOpen) {
    return null;
  }

  return (
    <AuthFormDialog
      key={authModalTab}
      initialTab={authModalTab}
      onClose={closeAuthModal}
    />
  );
}
