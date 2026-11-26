"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Image from "next/image";
import { AlertCircle, Mail, Sparkles } from "lucide-react";
import { Button, Dialog, Tabs, TextInput } from "@/components/ui";
import { useApp, type AuthView } from "@/context/AppContext";
import { postAuth } from "@/lib/auth-client";

const VIEWS = {
  login: {
    title: "登录 PPTGod",
    description: "登录后可保存演示文稿、同步收藏并发布你的风格。",
    submit: "立即登录",
  },
  register: {
    title: "创建账号",
    description: "注册后即可在不同设备上继续创作。",
    submit: "注册账号",
  },
  forgot: {
    title: "找回密码",
    description: "输入注册时使用的邮箱，获取重设密码的链接。",
    submit: "发送重设链接",
  },
  verify: {
    title: "验证邮箱",
    description: "打开验证邮件中的链接，即可使用邮箱和密码登录。",
    submit: "重新发送验证邮件",
  },
} satisfies Record<AuthView, { title: string; description: string; submit: string }>;

interface AuthFormDialogProps {
  initialView: AuthView;
  onClose: () => void;
  showDemoAccount: boolean;
}

function AuthFormDialog({ initialView, onClose, showDemoAccount }: AuthFormDialogProps) {
  const { setAuthData, showToast } = useApp();
  const [view, setView] = useState(initialView);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCredentialForm = view === "login" || view === "register";
  const { title, description, submit } = VIEWS[view];

  function changeView(next: AuthView) {
    setView(next);
    setPassword("");
    setError("");
    setNotice("");
  }

  async function submitCredentials(emailAddress: string, suppliedPassword: string) {
    const registering = view === "register";
    if (registering && displayName.trim().length < 2) {
      setError("昵称至少需要 2 个字符。");
      return;
    }

    const { response, data } = await postAuth(registering ? "register" : "login", {
      email: emailAddress,
      password: suppliedPassword,
      ...(registering ? { displayName: displayName.trim(), bio: bio.trim() } : {}),
    });

    if (data.code === "EMAIL_NOT_VERIFIED") {
      changeView("verify");
      setNotice("此邮箱尚未验证。你可以打开之前收到的邮件，或重新发送验证邮件。");
      return;
    }
    if (!response.ok) {
      setError(data.error || "暂时无法继续，请稍后重试。");
      return;
    }
    if (data.verificationRequired) {
      changeView("verify");
      setNotice("如果该邮箱尚未验证，验证链接将发送到你的邮箱。请查收，也可以检查垃圾邮件文件夹。");
      return;
    }
    if (!data.user) {
      setError("暂时无法加载账户，请稍后重试。");
      return;
    }

    setAuthData(data.user, data.stats ?? null);
    showToast(registering ? "注册成功，欢迎加入 PPTGod！" : `欢迎回来，${data.user.displayName}`, "success");
    onClose();
  }

  async function sendAccountEmail(emailAddress: string) {
    const requestingReset = view === "forgot";
    const { response } = await postAuth(
      requestingReset ? "request-password-reset" : "send-verification-email",
      { email: emailAddress },
    );

    if (!response.ok) {
      setError(response.status === 429 ? "发送过于频繁，请稍后再试。" : "暂时无法发送邮件，请稍后再试。");
      return;
    }

    setNotice(
      requestingReset
        ? "如果该邮箱已注册，重设密码链接将发送到你的邮箱。请查收，也可以检查垃圾邮件文件夹。"
        : "如果该邮箱已注册且尚未验证，验证链接将发送到你的邮箱。请查收，也可以检查垃圾邮件文件夹。",
    );
  }

  async function runSubmission(submitAction: () => Promise<void>) {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await submitAction();
    } catch {
      setError("网络连接异常，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const emailAddress = email.trim();
    void runSubmission(() =>
      isCredentialForm
        ? submitCredentials(emailAddress, password)
        : sendAccountEmail(emailAddress),
    );
  }

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
            className="gl-auth-logo"
          />
          <span>{title}</span>
        </span>
      }
      description={description}
    >
      <div className="gl-auth-content">
        {isCredentialForm && (
          <Tabs
            variant="segment"
            size="sm"
            fullWidth
            ariaLabel="登录或注册"
            value={view}
            onChange={(id) => changeView(id === "register" ? "register" : "login")}
            items={[
              { id: "login", label: "账号登录", htmlId: "pg-auth-tab-login", disabled: submitting },
              { id: "register", label: "注册新账号", htmlId: "pg-auth-tab-register", disabled: submitting },
            ]}
          />
        )}

        {view === "login" && showDemoAccount && (
          <button
            type="button"
            className="gl-auth-demo-btn"
            onClick={() => void runSubmission(() => submitCredentials("demo@pptgod.studio", "demo1234"))}
            disabled={submitting}
            id="pg-demo-login-btn"
          >
            <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
            一键登录本地体验账号
          </button>
        )}

        <form onSubmit={handleSubmit} className="gl-auth-form">
          {view === "register" && (
            <TextInput
              id="pg-auth-name"
              name="displayName"
              label="创作者昵称"
              required
              minLength={2}
              maxLength={32}
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          )}

          <TextInput
            id="pg-auth-email"
            name="email"
            label="邮箱地址"
            type="email"
            required
            autoComplete={view === "login" ? "username" : "email"}
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {isCredentialForm && (
            <TextInput
              id="pg-auth-password"
              name="password"
              label="密码"
              type="password"
              required
              minLength={view === "register" ? 8 : undefined}
              maxLength={128}
              autoComplete={view === "login" ? "current-password" : "new-password"}
              helperText={view === "register" ? "至少 8 个字符" : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}

          {view === "register" && (
            <TextInput
              id="pg-auth-bio"
              name="bio"
              label="一句话简介（选填）"
              maxLength={100}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          )}

          {notice && (
            <div className="gl-auth-notice" role="status">
              <Mail size={16} aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div id="pg-auth-error" className="gl-auth-error" role="alert">
              <AlertCircle size={15} strokeWidth={2} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submitting}
            loadingText="处理中…"
            id="pg-auth-submit-btn"
          >
            {submit}
          </Button>
        </form>

        {view !== "register" && (
          <div className="gl-auth-actions">
            {view === "login" ? (
              <>
                <Button variant="ghost" size="sm" disabled={submitting} onClick={() => changeView("forgot")}>
                  忘记密码
                </Button>
                <Button variant="ghost" size="sm" disabled={submitting} onClick={() => changeView("verify")}>
                  重发验证邮件
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" disabled={submitting} onClick={() => changeView("login")}>
                返回登录
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default function AuthModal({ showDemoAccount }: { showDemoAccount: boolean }) {
  const { authModalOpen, authModalTab, closeAuthModal } = useApp();

  if (!authModalOpen) return null;

  return (
    <AuthFormDialog
      key={authModalTab}
      initialView={authModalTab}
      onClose={closeAuthModal}
      showDemoAccount={showDemoAccount}
    />
  );
}
