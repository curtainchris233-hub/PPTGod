"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  FileText,
  KeyRound,
  Keyboard,
  Layers,
  LogOut,
  Search,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { Button, Dialog, TextInput } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useLayout } from "@/context/LayoutContext";
import {
  clearByokSessionKey,
  readByokPrefs,
  subscribeByokPrefs,
  writeByokPrefs,
  type ByokLocalPrefs,
} from "@/lib/byokLocalStore";
import type { UserPublic } from "@/types/prompt";
import MobileNavDrawer from "./MobileNavDrawer";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/* All 6 swatches verified >= 4.5:1 WCAG AA contrast against #FFFFFF */
const AVATAR_SWATCHES = [
  "#2563EB",
  "#0369A1",
  "#0F766E",
  "#4F46E5",
  "#C84B31",
  "#14243C",
] as const;

function GlacierHelpDialog() {
  const { helpModalOpen, closeHelpModal } = useLayout();
  const [faqQuery, setFaqQuery] = useState("");
  const q = faqQuery.trim().toLowerCase();

  const matches = (keywords: string) =>
    !q || keywords.toLowerCase().includes(q);

  const showUpload = matches(
    "文档导入解析规格 pdf docx pptx md txt 10mb 10 mb 扫描 ocr 上传"
  );
  const showEngine = matches(
    "免 key 智能引擎 byok 隐私 api key 多语言 大模型 sqlite"
  );
  const showExport = matches(
    "多格式导出能力 pptx html marp markdown 提示词 16:9 演讲备注"
  );
  const showShortcuts = matches(
    "常用键盘快捷键 esc ctrl z shift 翻页 演播 备注 排练 驾驶舱"
  );
  const hasAny = showUpload || showEngine || showExport || showShortcuts;

  return (
    <Dialog
      open={helpModalOpen}
      onClose={closeHelpModal}
      title="帮助中心与使用指南"
      description="PPTGod 真实支持的能力边界、导出格式与快捷键参考"
      size="md"
      id="gl-help-dialog"
      footer={
        <>
          <Link
            href="/tools"
            className="gl-btn gl-btn--secondary gl-btn--sm"
            onClick={closeHelpModal}
          >
            打开效率工具箱
          </Link>
          <Button variant="primary" size="sm" onClick={closeHelpModal}>
            关闭
          </Button>
        </>
      }
    >
      <div className="gl-modal-sections">
        <TextInput
          id="gl-help-search-input"
          type="search"
          size="sm"
          label="搜索帮助主题"
          hideLabel
          leftIcon={<Search size={15} />}
          placeholder="搜索常见问题、格式限制（如 10 MB）、BYOK 或快捷键…"
          value={faqQuery}
          onChange={(e) => setFaqQuery(e.target.value)}
        />

        {showUpload && (
          <section className="gl-modal-section">
            <div className="gl-modal-section-head">
              <FileText size={16} strokeWidth={2} aria-hidden="true" />
              <h3>文档导入与解析规格</h3>
            </div>
            <p className="gl-modal-section-text">
              支持 <strong>.pdf</strong>、<strong>.docx</strong>、
              <strong>.pptx</strong>、<strong>.md</strong>、<strong>.txt</strong>{" "}
              共 5 种文档格式，单文件体积上限 <strong>10 MB</strong>。暂不支持旧版
              .doc 二进制文件与图片 OCR 识别（纯扫描 PDF 建议先提取文字后粘贴）。
            </p>
          </section>
        )}

        {showEngine && (
          <section className="gl-modal-section">
            <div className="gl-modal-section-head">
              <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
              <h3>免 Key 智能引擎与 BYOK 隐私</h3>
            </div>
            <p className="gl-modal-section-text">
              开箱即用内置结构化智能排版引擎；如需更强语言润色与多语言生成，可在创作工坊开启
              BYOK 自定义模型。你的 API Key 仅保留在当前浏览器会话中，绝不写入服务端
              SQLite 数据库或日志。
            </p>
          </section>
        )}

        {showExport && (
          <section className="gl-modal-section">
            <div className="gl-modal-section-head">
              <Layers size={16} strokeWidth={2} aria-hidden="true" />
              <h3>多格式真实导出能力</h3>
            </div>
            <p className="gl-modal-section-text">
              支持原生 16:9 <strong>.pptx</strong>（含 SlideMaster、原生图表/表格与演讲备注）、离线独立{" "}
              <strong>.html</strong> 演示页、Marp Markdown、来源核验清单，以及适配 6
              大 AI 演示工具的结构化提示词编译。
            </p>
          </section>
        )}

        {showShortcuts && (
          <section className="gl-modal-section">
            <div className="gl-modal-section-head">
              <Keyboard size={16} strokeWidth={2} aria-hidden="true" />
              <h3>常用键盘快捷键</h3>
            </div>
            <ul className="gl-shortcut-list">
              <li>
                <span>关闭弹窗 / 抽屉</span>
                <kbd>Esc</kbd>
              </li>
              <li>
                <span>编辑器撤销 / 重做</span>
                <span>
                  <kbd>Ctrl / ⌘ + Z</kbd> / <kbd>Shift + Z</kbd>
                </span>
              </li>
              <li>
                <span>演播模式翻页</span>
                <span>
                  <kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd>
                </span>
              </li>
              <li>
                <span>演播备注 / 演讲排练驾驶舱</span>
                <span>
                  <kbd>N</kbd> / <kbd>P</kbd>
                </span>
              </li>
            </ul>
          </section>
        )}

        {!hasAny && (
          <p className="gl-modal-section-text" style={{ textAlign: "center", padding: "12px 0" }}>
            未找到与「{faqQuery}」匹配的帮助条目，请尝试搜索「10 MB」「BYOK」「导出」或「快捷键」。
          </p>
        )}
      </div>
    </Dialog>
  );
}

interface SettingsProfileFormProps {
  user: UserPublic;
  onSaved: () => void;
  onLogout: () => void;
  onNavigateProfile: () => void;
}

function SettingsProfileForm({
  user,
  onSaved,
  onLogout,
  onNavigateProfile,
}: SettingsProfileFormProps) {
  const { setAuthData, showToast } = useApp();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || "");
  const [avatarColor, setAvatarColor] = useState(
    user.avatarColor || AVATAR_SWATCHES[0]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 32) {
      setError("昵称长度需在 2 到 32 个字符之间");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: trimmedName,
          bio: bio.trim().slice(0, 140),
          avatarColor,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "保存资料失败，请稍后重试");
        return;
      }
      setAuthData(data.user, data.stats);
      showToast("已保存个人资料", "success");
      onSaved();
    } catch {
      setError("网络连接异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="gl-settings-form" onSubmit={handleSubmit}>
      <TextInput
        id="gl-settings-display-name"
        label="创作者昵称"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        required
        minLength={2}
        maxLength={32}
        showCount
        placeholder="2–32 个字符"
      />

      <TextInput
        id="gl-settings-bio"
        label="个人简介"
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        maxLength={140}
        showCount
        placeholder="一句话介绍你的演示风格与擅长领域"
      />

      <div className="gl-field">
        <span className="gl-field-label">头像底色</span>
        <div className="gl-swatch-row" role="radiogroup" aria-label="选择头像底色">
          {AVATAR_SWATCHES.map((hex) => {
            const selected = avatarColor.toUpperCase() === hex.toUpperCase();
            return (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`头像颜色 ${hex}`}
                className={`gl-swatch-btn ${selected ? "is-selected" : ""}`}
                style={{ background: hex }}
                onClick={() => setAvatarColor(hex)}
              >
                {selected && <Check size={14} strokeWidth={2.6} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="gl-field-error" role="alert">
          {error}
        </p>
      )}

      <div className="gl-settings-form-actions">
        <div className="gl-settings-account-links">
          <Link
            href={`/creator/${user.username}`}
            className="gl-btn gl-btn--ghost gl-btn--sm"
            onClick={onNavigateProfile}
          >
            查看创作者主页
          </Link>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LogOut size={14} />}
            onClick={onLogout}
          >
            退出登录
          </Button>
        </div>

        <Button type="submit" variant="primary" size="sm" loading={saving}>
          保存资料
        </Button>
      </div>
    </form>
  );
}

function SettingsByokForm() {
  const { showToast } = useApp();
  const [prefs, setPrefs] = useState<ByokLocalPrefs>(() => readByokPrefs());

  useEffect(() => {
    return subscribeByokPrefs((next) => {
      setPrefs(next);
    });
  }, []);

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = writeByokPrefs({
      engineMode: prefs.engineMode,
      apiBase: prefs.apiBase.trim() || "https://api.openai.com/v1",
      modelName: prefs.modelName.trim() || "gpt-4o-mini",
      imgModelName: prefs.imgModelName.trim() || "dall-e-3",
      apiKey: prefs.apiKey.trim(),
    });
    setPrefs(saved);
    showToast("本地 BYOK 模型配置已同步至工坊与编辑器", "success");
  };

  const handleClearKey = () => {
    const cleared = clearByokSessionKey();
    setPrefs(cleared);
    showToast("已清除当前浏览器会话的 API Key", "default");
  };

  const hasKey = prefs.apiKey.trim().length > 0;

  return (
    <form className="gl-settings-form" onSubmit={handleSave}>
      <div className="gl-byok-header-row">
        <div className="gl-byok-engine-seg" role="group" aria-label="默认生成引擎">
          <button
            type="button"
            id="gl-settings-byok-smart"
            className={`gl-byok-seg-btn ${prefs.engineMode === "smart" ? "is-active" : ""}`}
            onClick={() => {
              const next = writeByokPrefs({ engineMode: "smart" });
              setPrefs(next);
            }}
          >
            内置引擎（免 Key）
          </button>
          <button
            type="button"
            id="gl-settings-byok-llm"
            className={`gl-byok-seg-btn ${prefs.engineMode === "llm" ? "is-active" : ""}`}
            onClick={() => {
              const next = writeByokPrefs({ engineMode: "llm" });
              setPrefs(next);
            }}
          >
            BYOK 大模型
          </button>
        </div>

        <span
          className={`gl-byok-status-pill ${hasKey ? "is-ready" : ""}`}
          id="gl-settings-byok-status"
        >
          <KeyRound size={12} aria-hidden="true" />
          <span>{hasKey ? "会话 Key 已就绪" : "未配置 Key"}</span>
        </span>
      </div>

      <TextInput
        id="gl-settings-byok-base"
        label="API Base URL（OpenAI / DeepSeek 兼容）"
        value={prefs.apiBase}
        onChange={(event) =>
          setPrefs((prev) => ({ ...prev, apiBase: event.target.value }))
        }
        placeholder="https://api.openai.com/v1"
      />

      <div className="gl-byok-two-col">
        <TextInput
          id="gl-settings-byok-model"
          label="文本模型名称"
          value={prefs.modelName}
          onChange={(event) =>
            setPrefs((prev) => ({ ...prev, modelName: event.target.value }))
          }
          placeholder="gpt-4o-mini / deepseek-chat"
        />
        <TextInput
          id="gl-settings-byok-img-model"
          label="配图生图模型"
          value={prefs.imgModelName}
          onChange={(event) =>
            setPrefs((prev) => ({ ...prev, imgModelName: event.target.value }))
          }
          placeholder="dall-e-3 / gpt-image-1"
        />
      </div>

      <TextInput
        id="gl-settings-byok-key"
        label="会话 API Key（仅存 sessionStorage，关闭标签页自动清除）"
        type="password"
        autoComplete="off"
        value={prefs.apiKey}
        onChange={(event) =>
          setPrefs((prev) => ({ ...prev, apiKey: event.target.value }))
        }
        placeholder="sk-..."
      />

      <div className="gl-settings-form-actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          id="gl-settings-byok-clear-btn"
          disabled={!hasKey}
          leftIcon={<Trash2 size={13} />}
          onClick={handleClearKey}
        >
          清除会话 Key
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          id="gl-settings-byok-save-btn"
        >
          保存本地配置
        </Button>
      </div>
    </form>
  );
}

function GlacierSettingsDialog() {
  const { user, openAuthModal, logout } = useApp();
  const {
    settingsModalOpen,
    closeSettingsModal,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useLayout();

  return (
    <Dialog
      open={settingsModalOpen}
      onClose={closeSettingsModal}
      title="工作台与账户设置"
      description="管理界面偏好、本地 BYOK 模型配置与个人资料"
      size="md"
      id="gl-settings-dialog"
    >
      <div className="gl-modal-sections">
        <section className="gl-modal-section">
          <h3 className="gl-settings-section-title">界面偏好</h3>
          <label className="gl-toggle-row" htmlFor="gl-pref-sidebar-collapsed">
            <span className="gl-toggle-copy">
              <strong>默认收起左侧导航栏</strong>
              <span>启用后桌面端侧边栏收起为 64px 紧凑图标栏，释放更多画布宽度</span>
            </span>
            <input
              id="gl-pref-sidebar-collapsed"
              type="checkbox"
              className="gl-toggle-checkbox"
              checked={sidebarCollapsed}
              onChange={(event) => setSidebarCollapsed(event.target.checked)}
            />
          </label>
        </section>

        <section className="gl-modal-section">
          <h3 className="gl-settings-section-title">账户资料</h3>
          {user ? (
            <SettingsProfileForm
              key={`${user.id}:${user.displayName}:${user.bio}:${user.avatarColor}`}
              user={user}
              onSaved={closeSettingsModal}
              onNavigateProfile={closeSettingsModal}
              onLogout={() => {
                closeSettingsModal();
                void logout();
              }}
            />
          ) : (
            <div className="gl-settings-guest-box">
              <div className="gl-settings-guest-copy">
                <UserIcon size={18} strokeWidth={1.9} aria-hidden="true" />
                <div>
                  <strong>当前为访客模式</strong>
                  <p>
                    登录后即可云端保存演示文稿项目、同步风格收藏夹与自定义创作者资料。
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  closeSettingsModal();
                  openAuthModal("login");
                }}
              >
                立即登录 / 注册
              </Button>
            </div>
          )}
        </section>

        <section className="gl-modal-section" aria-label="本地 BYOK 模型配置">
          <h3 className="gl-settings-section-title">
            本地 BYOK 模型配置（工坊与编辑器通用）
          </h3>
          {settingsModalOpen && <SettingsByokForm key="open" />}
        </section>

        <section className="gl-modal-section gl-modal-section--subtle">
          <div className="gl-modal-section-head">
            <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
            <h3>安全与隐私说明</h3>
          </div>
          <p className="gl-modal-section-text">
            BYOK 自定义模型 API Key 仅存储在本地浏览器当前标签页会话（sessionStorage）中，绝不会发送给账户接口或持久化至服务端数据库。
          </p>
        </section>
      </div>
    </Dialog>
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const { sidebarCollapsed, editorFullBleed, openHelpModal } = useLayout();

  const isTheaterRoute = pathname.startsWith("/deck/");
  const isFullBleed = editorFullBleed || isTheaterRoute;
  const hideDesktopSidebar = isFullBleed;

  return (
    <div
      className={[
        "gl-shell",
        isFullBleed ? "is-fullbleed" : "",
        sidebarCollapsed && !hideDesktopSidebar ? "is-sidebar-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <a href="#main-content" className="gl-skip-link">
        跳至主内容
      </a>

      <Topbar showMenuOnDesktop={hideDesktopSidebar} />

      <div className="gl-shell-body">
        {!hideDesktopSidebar && <Sidebar />}

        <div
          id="main-content"
          tabIndex={-1}
          className={`gl-main ${isFullBleed ? "gl-main--fullbleed" : ""}`}
        >
          <div
            className={
              isFullBleed ? "gl-main-inner--fullbleed" : "gl-main-inner"
            }
          >
            {children}
          </div>

          {!isFullBleed && (
            <footer className="gl-shell-footer">
              <div className="gl-shell-footer-inner">
                <div className="gl-shell-footer-brand">
                  <strong>PPTGod</strong>
                  <span> · Glacier UI 2.0 演示文稿创作平台</span>
                </div>
                <div className="gl-shell-footer-links">
                  <Link
                    href="/tools"
                    id="pg-footer-tools-link"
                    className="gl-shell-footer-link"
                  >
                    效率工具箱
                  </Link>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="gl-shell-footer-btn"
                    onClick={openHelpModal}
                  >
                    帮助中心
                  </button>
                  <span aria-hidden="true">·</span>
                  <span>原生 .pptx / 离线 .html</span>
                </div>
              </div>
            </footer>
          )}
        </div>
      </div>

      <MobileNavDrawer allowDesktopDrawer={hideDesktopSidebar} />
      <GlacierHelpDialog />
      <GlacierSettingsDialog />
    </div>
  );
}
