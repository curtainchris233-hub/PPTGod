"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — matches /api/parse-document
export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "csv",
  "md",
  "txt",
] as const;
export type AllowedUploadExtension = (typeof ALLOWED_UPLOAD_EXTENSIONS)[number];
export const UPLOAD_ACCEPT_ATTR = ".pdf,.docx,.pptx,.xlsx,.csv,.md,.txt";

const ALLOWED_EXT_SET = new Set<string>(ALLOWED_UPLOAD_EXTENSIONS);
const IMAGE_EXTENSIONS = new Set<string>([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "svg",
  "heic",
  "heif",
  "tiff",
]);

export type UploadValidationErrorCode =
  | "legacy-doc"
  | "legacy-xls"
  | "unsupported-image"
  | "unsupported-ext"
  | "empty"
  | "too-large";

export interface UploadValidationError {
  fileName: string;
  fileSize: number;
  code: UploadValidationErrorCode;
  message: string;
}

export type UploadFileStatus = "idle" | "parsing" | "success" | "error";

export interface UploadFileItem {
  id: string;
  name: string;
  size: number;
  ext?: string;
  status: UploadFileStatus;
  /** Optional concise status note, e.g. "已提取 3,420 字 · 商务汇报" */
  statusText?: string;
  /** Non-fatal warning, e.g. scanned PDF with <30 extracted chars */
  warning?: string;
  /** Error message when status === "error" */
  error?: string;
}

export function getFileExtension(fileName: string): string {
  const clean = fileName.trim();
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx < 0 || dotIdx === clean.length - 1) return "";
  return clean.slice(dotIdx + 1).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

export function validateUploadFile(
  file: File,
  maxSizeBytes: number = MAX_UPLOAD_BYTES
):
  | { ok: true; ext: AllowedUploadExtension }
  | { ok: false; error: UploadValidationError } {
  const ext = getFileExtension(file.name);

  if (ext === "doc") {
    return {
      ok: false,
      error: {
        fileName: file.name,
        fileSize: file.size,
        code: "legacy-doc",
        message:
          "检测到旧版二进制 .doc 格式，请先在 Word / WPS 中另存为标准 .docx 格式后再上传",
      },
    };
  }

  if (ext === "xls") {
    return {
      ok: false,
      error: {
        fileName: file.name,
        fileSize: file.size,
        code: "legacy-xls",
        message:
          "检测到旧版二进制 .xls 格式，请先在 Excel / WPS 中另存为标准 .xlsx 或 .csv 格式后再上传",
      },
    };
  }

  if (IMAGE_EXTENSIONS.has(ext) || file.type.startsWith("image/")) {
    return {
      ok: false,
      error: {
        fileName: file.name,
        fileSize: file.size,
        code: "unsupported-image",
        message:
          "暂不支持图片文件 OCR 解析，请上传 .pdf、.docx、.pptx、.xlsx、.csv、.md、.txt 文档（或先提取文字后粘贴）",
      },
    };
  }

  if (!ALLOWED_EXT_SET.has(ext)) {
    return {
      ok: false,
      error: {
        fileName: file.name,
        fileSize: file.size,
        code: "unsupported-ext",
        message: `不支持的文件类型「.${ext || "未知"}」，仅支持 .pdf、.docx、.pptx、.xlsx、.csv、.md、.txt 文档`,
      },
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: {
        fileName: file.name,
        fileSize: file.size,
        code: "empty",
        message: "上传的文档内容为空（0 字节），请选择有效文件",
      },
    };
  }

  if (file.size > maxSizeBytes) {
    const limitLabel = formatFileSize(maxSizeBytes);
    return {
      ok: false,
      error: {
        fileName: file.name,
        fileSize: file.size,
        code: "too-large",
        message: `「${file.name}」体积（${formatFileSize(file.size)}）超过 ${limitLabel} 上限，请精简后再上传`,
      },
    };
  }

  return { ok: true, ext: ext as AllowedUploadExtension };
}

export interface UploadDropzoneProps {
  variant?: "dashboard" | "compact";
  files?: UploadFileItem[];
  onFilesAccepted: (files: File[]) => void;
  onValidationErrors?: (errors: UploadValidationError[]) => void;
  onRemoveFile?: (id: string) => void;
  onCancel?: () => void;
  multiple?: boolean;
  maxSizeBytes?: number;
  accept?: string;
  uploading?: boolean;
  disabled?: boolean;
  title?: string;
  hint?: string;
  buttonLabel?: string;
  /** External server/network error banner */
  error?: string | null;
  /** Optional stable DOM IDs for E2E hooks (#pg-doc-upload-input, #pg-hero-doc-input, #pg-doc-upload-btn) */
  inputId?: string;
  buttonId?: string;
  className?: string;
}

function getExtBadgeTone(ext: string): string {
  switch (ext) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "pptx":
      return "pptx";
    case "xlsx":
    case "csv":
      return "xlsx";
    default:
      return "doc";
  }
}

export function UploadDropzone({
  variant = "dashboard",
  files = [],
  onFilesAccepted,
  onValidationErrors,
  onRemoveFile,
  onCancel,
  multiple = false,
  maxSizeBytes = MAX_UPLOAD_BYTES,
  accept = UPLOAD_ACCEPT_ATTR,
  uploading = false,
  disabled = false,
  title,
  hint = "支持 PDF、Word (.docx)、PPT (.pptx)、Excel (.xlsx)、CSV、Markdown、TXT（单文件 ≤ 10 MB）",
  buttonLabel = "选择文件",
  error,
  inputId,
  buttonId,
  className,
}: UploadDropzoneProps) {
  const autoId = useId();
  const resolvedInputId = inputId ?? `${autoId}-file-input`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const [isDragOver, setIsDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    UploadValidationError[]
  >([]);

  const isDisabled = Boolean(disabled || uploading);
  const resolvedTitle =
    title ?? (variant === "dashboard" ? "上传资料，一键生成 PPT" : "上传资料");

  const processFileList = (rawList: FileList | null) => {
    if (!rawList || rawList.length === 0 || isDisabled) return;
    const candidates = multiple
      ? Array.from(rawList)
      : [rawList[0]].filter(Boolean);

    const validFiles: File[] = [];
    const errors: UploadValidationError[] = [];

    for (const file of candidates) {
      const check = validateUploadFile(file, maxSizeBytes);
      if (check.ok) {
        validFiles.push(file);
      } else {
        errors.push(check.error);
      }
    }

    setValidationErrors(errors);
    if (errors.length > 0) {
      onValidationErrors?.(errors);
    }
    if (validFiles.length > 0) {
      onFilesAccepted(validFiles);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFileList(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const handleTriggerClick = () => {
    if (isDisabled) return;
    fileInputRef.current?.click();
  };

  const handleZoneClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input")) return;
    fileInputRef.current?.click();
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled) return;
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isDisabled ? "none" : "copy";
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    if (isDisabled) return;
    processFileList(event.dataTransfer.files);
  };

  const hasAlerts = Boolean(error) || validationErrors.length > 0;
  const isCompactSplit = variant === "compact" && files.length > 0;

  const fileListNode = files.length > 0 && (
    <ul className="gl-upload-file-list" aria-label="已上传文档列表">
      {files.map((item) => {
        const ext = (item.ext || getFileExtension(item.name) || "DOC").toLowerCase();
        const badgeTone = getExtBadgeTone(ext);
        const isParsing = item.status === "parsing";

        return (
          <li
            key={item.id}
            className={`gl-upload-file-card gl-upload-file-card--${item.status}`}
          >
            <span
              className={`gl-upload-ext-badge gl-upload-ext-badge--${badgeTone}`}
              aria-hidden="true"
            >
              {ext.slice(0, 4).toUpperCase()}
            </span>
            <div className="gl-upload-file-info">
              <div className="gl-upload-file-head">
                <span className="gl-upload-file-name" title={item.name}>
                  {item.name}
                </span>
                <span className="gl-upload-file-size">
                  {formatFileSize(item.size)}
                </span>
              </div>
              <div className={`gl-upload-file-status is-${item.status}`}>
                {item.status === "parsing" && (
                  <>
                    <Loader2 size={13} className="gl-spin" aria-hidden="true" />
                    <span>{item.statusText ?? "正在解析文档内容…"}</span>
                  </>
                )}
                {item.status === "success" && (
                  <>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <span>{item.statusText ?? "解析完成"}</span>
                  </>
                )}
                {item.status === "error" && (
                  <>
                    <AlertCircle size={13} aria-hidden="true" />
                    <span>{item.error ?? "解析失败，请重试"}</span>
                  </>
                )}
                {item.status === "idle" && (
                  <span>{item.statusText ?? "等待解析"}</span>
                )}
              </div>
              {item.warning && (
                <p className="gl-upload-file-warning" role="status">
                  <AlertTriangle size={13} aria-hidden="true" />
                  <span>{item.warning}</span>
                </p>
              )}
            </div>
            {onRemoveFile && (
              <IconButton
                icon={<X size={14} />}
                ariaLabel={`移除 ${item.name}`}
                size="sm"
                variant="ghost"
                disabled={uploading && isParsing}
                onClick={() => onRemoveFile(item.id)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className={[
        "gl-dropzone-root",
        `gl-dropzone-root--${variant}`,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        ref={fileInputRef}
        id={resolvedInputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={isDisabled}
        onChange={handleInputChange}
        className="gl-sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className={isCompactSplit ? "gl-dropzone-split" : "gl-dropzone-stack"}>
        <div
          className={[
            "gl-dropzone",
            `gl-dropzone--${variant}`,
            isDragOver ? "is-dragover" : "",
            isDisabled ? "is-disabled" : "",
            hasAlerts ? "is-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={handleZoneClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-busy={uploading || undefined}
        >
          {variant === "dashboard" && (
            <svg
              className="gl-dropzone-corner-badge"
              width="38"
              height="38"
              viewBox="0 0 38 38"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="11"
                y="4"
                width="20"
                height="26"
                rx="4.5"
                transform="rotate(7 11 4)"
                fill="#DBEAFE"
                stroke="#93C5FD"
                strokeWidth="1.2"
              />
              <rect
                x="6"
                y="7"
                width="20"
                height="26"
                rx="4.5"
                fill="#EFF6FF"
                stroke="#93C5FD"
                strokeWidth="1.2"
              />
              <line
                x1="10.5"
                y1="14.5"
                x2="21.5"
                y2="14.5"
                stroke="#60A5FA"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="10.5"
                y1="19"
                x2="19"
                y2="19"
                stroke="#93C5FD"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="10.5"
                y1="23.5"
                x2="17"
                y2="23.5"
                stroke="#BFDBFE"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}

          <div className="gl-dropzone-icon-wrap" aria-hidden="true">
            {uploading ? (
              <Loader2 size={variant === "dashboard" ? 32 : 28} className="gl-spin" />
            ) : (
              <UploadCloud
                size={variant === "dashboard" ? 36 : 30}
                strokeWidth={1.75}
              />
            )}
          </div>

          <p className="gl-dropzone-title">
            {uploading ? "正在解析上传文档…" : resolvedTitle}
          </p>
          <p className="gl-dropzone-hint">{hint}</p>

          <div className="gl-dropzone-actions">
            <Button
              id={buttonId}
              variant="secondary"
              size="sm"
              loading={uploading}
              loadingText="解析中…"
              disabled={disabled}
              leftIcon={
                variant === "compact" ? (
                  <FolderOpen size={15} strokeWidth={1.9} />
                ) : undefined
              }
              onClick={handleTriggerClick}
            >
              {buttonLabel}
            </Button>
            {uploading && onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                取消
              </Button>
            )}
          </div>
        </div>

        {fileListNode}
      </div>

      {hasAlerts && (
        <div
          className="gl-dropzone-alerts"
          role="alert"
          aria-live="polite"
        >
          {error && (
            <div className="gl-dropzone-alert-item">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {validationErrors.map((err, index) => (
            <div
              key={`${err.fileName}-${err.code}-${index}`}
              className="gl-dropzone-alert-item"
            >
              <AlertCircle size={15} aria-hidden="true" />
              <span>{err.message}</span>
            </div>
          ))}
          {validationErrors.length > 0 && (
            <button
              type="button"
              className="gl-dropzone-alert-dismiss"
              onClick={() => setValidationErrors([])}
              aria-label="关闭上传提示"
            >
              知道了
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadDropzone;
