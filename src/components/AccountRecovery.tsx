"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, GlacierPanel, TextInput } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { postAuth, RESET_PASSWORD_PATH } from "@/lib/auth-client";

export function EmailVerification({ failed }: { failed: boolean }) {
  const { openAuthModal } = useApp();

  return (
    <GlacierPanel as="section" padding="lg" className="gl-account-page gl-auth-content">
      <h1>{failed ? "验证链接已失效" : "邮箱验证"}</h1>
      <p>
        {failed
          ? "请重新发送验证邮件，然后打开最新收到的链接。"
          : "如果你刚从验证邮件打开此页，现在可以返回登录。"}
      </p>
      {failed ? (
        <Button onClick={() => openAuthModal("verify")}>重新发送验证邮件</Button>
      ) : (
        <Button onClick={() => openAuthModal("login")}>返回登录</Button>
      )}
    </GlacierPanel>
  );
}

export function PasswordReset({ token }: { token: string | null }) {
  const { openAuthModal, refreshAuth } = useApp();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [invalidToken, setInvalidToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || submitting) return;
    if (password !== confirmation) {
      setError("两次输入的密码不一致。");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const { response, data } = await postAuth("reset-password", {
        newPassword: password,
        token,
      });
      if (response.ok) {
        setPassword("");
        setConfirmation("");
        setCompleted(true);
        window.history.replaceState(null, "", RESET_PASSWORD_PATH);
        void refreshAuth();
      } else if (data.code === "INVALID_TOKEN") {
        setInvalidToken(true);
      } else if (response.status === 429) {
        setError("尝试次数过多，请稍后重试。");
      } else {
        setError("暂时无法更新密码，请稍后重试。");
      }
    } catch {
      setError("网络连接异常，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <GlacierPanel as="section" padding="lg" className="gl-account-page gl-auth-content">
        <h1>密码已更新</h1>
        <p>请使用新密码登录。</p>
        <Button onClick={() => openAuthModal("login")}>返回登录</Button>
      </GlacierPanel>
    );
  }

  if (!token || invalidToken) {
    return (
      <GlacierPanel as="section" padding="lg" className="gl-account-page gl-auth-content">
        <h1>重设密码链接已失效</h1>
        <p>请重新申请重设链接，然后打开最新收到的邮件。</p>
        <Button onClick={() => openAuthModal("forgot")}>重新申请链接</Button>
      </GlacierPanel>
    );
  }

  return (
    <GlacierPanel as="section" padding="lg" className="gl-account-page gl-auth-content">
      <h1>设置新密码</h1>
      <form onSubmit={handleSubmit} className="gl-auth-form">
        <TextInput
          id="pg-reset-password"
          label="新密码"
          name="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          helperText="至少 8 个字符"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextInput
          id="pg-reset-confirm-password"
          label="确认新密码"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {error && (
          <div className="gl-auth-error" role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <Button type="submit" size="lg" loading={submitting} loadingText="保存中…">
          保存新密码
        </Button>
      </form>
    </GlacierPanel>
  );
}
