import {
  ALL_SLIDE_TYPES,
  type DeckSlideBar,
  type DeckSlideFunnelStage,
  type DeckSlideImageSlot,
  type DeckSlideItem,
  type DeckSlideKpi,
  type DeckSlideStep,
  type DeckSlideSwot,
  type DeckSlideTeamMember,
  type OutlineDraftItem,
  type SlideType,
} from "@/types/prompt";
import { safeNumber, safeString } from "@/app/api/prompts/_validation";

export const VALID_IMAGE_DATA_URL_RE =
  /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i;
export const MAX_IMAGE_DATA_URL_CHARS = 650_000; // ~480 KB decoded binary cap
export const MAX_DECK_JSON_CHARS = 4_500_000; // <= 4.5 MB serialized deck cap

const VALID_SLIDE_TYPES = new Set<string>(ALL_SLIDE_TYPES);

const MIDDLE_FALLBACK_TYPES: SlideType[] = [
  "agenda",
  "image-split",
  "process",
  "data",
  "funnel-donut",
  "comparison",
  "swot",
  "timeline",
  "team-grid",
  "quote",
];

const SLIDE_TYPE_SYNONYMS: Record<string, SlideType> = {
  intro: "cover",
  title: "cover",
  toc: "agenda",
  outline: "agenda",
  visual: "image-split",
  image: "image-split",
  split: "image-split",
  media: "image-split",
  roadmap: "timeline",
  schedule: "timeline",
  milestone: "timeline",
  milestones: "timeline",
  architecture: "process",
  workflow: "process",
  method: "process",
  methodology: "process",
  chart: "data",
  metrics: "data",
  kpi: "data",
  kpis: "data",
  insight: "data",
  funnel: "funnel-donut",
  donut: "funnel-donut",
  pie: "funnel-donut",
  conversion: "funnel-donut",
  compare: "comparison",
  matrix: "comparison",
  versus: "comparison",
  strategy: "swot",
  quadrant: "swot",
  team: "team-grid",
  members: "team-grid",
  leadership: "team-grid",
  people: "team-grid",
  spotlight: "quote",
  testimonial: "quote",
  summary: "closing",
  conclusion: "closing",
  cta: "closing",
  ending: "closing",
};

export function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

export function isValidImageDataUrl(val: unknown): val is string {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > MAX_IMAGE_DATA_URL_CHARS) return false;
  return VALID_IMAGE_DATA_URL_RE.test(trimmed);
}

export function validateSlidesPayload(
  slides: unknown
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(slides) || slides.length === 0) {
    return { ok: false, error: "文稿标题或页面内容不能为空" };
  }
  if (slides.length > 50) {
    return { ok: false, error: "单份演示文稿最多支持 50 页" };
  }
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (!isPlainObject(s)) {
      return { ok: false, error: `第 ${i + 1} 页数据结构不合法` };
    }
    if (s.imageSlot !== undefined && s.imageSlot !== null) {
      if (!isPlainObject(s.imageSlot)) {
        return { ok: false, error: `第 ${i + 1} 页配图槽位格式不合法` };
      }
      const rawDataUrl = s.imageSlot.dataUrl;
      if (rawDataUrl !== undefined && rawDataUrl !== null && rawDataUrl !== "") {
        if (typeof rawDataUrl !== "string") {
          return { ok: false, error: `第 ${i + 1} 页图片数据格式不合法` };
        }
        const trimmed = rawDataUrl.trim();
        if (trimmed.length > MAX_IMAGE_DATA_URL_CHARS) {
          return {
            ok: false,
            error: `第 ${i + 1} 页上传的图片体积超限（请控制在 400KB 以内）`,
          };
        }
        if (!VALID_IMAGE_DATA_URL_RE.test(trimmed)) {
          return {
            ok: false,
            error: `第 ${i + 1} 页图片仅支持 PNG / JPEG / WebP Base64 Data URL`,
          };
        }
      }
    }
  }
  try {
    const serializedLen = JSON.stringify(slides).length;
    if (serializedLen > MAX_DECK_JSON_CHARS) {
      return {
        ok: false,
        error: "整套演示文稿总大小超过限制（4.5MB），请减少大图数量或压缩图片",
      };
    }
  } catch {
    return { ok: false, error: "页面数据序列化失败" };
  }
  return { ok: true };
}

export function normalizeSlideType(
  rawType: unknown,
  idx: number,
  total: number
): SlideType {
  if (typeof rawType === "string") {
    const normalized = rawType.trim().toLowerCase();
    if (VALID_SLIDE_TYPES.has(normalized)) {
      return normalized as SlideType;
    }
    if (Object.prototype.hasOwnProperty.call(SLIDE_TYPE_SYNONYMS, normalized)) {
      return SLIDE_TYPE_SYNONYMS[normalized];
    }
  }
  if (idx === 0) return "cover";
  if (idx === total - 1 && total > 1) return "closing";
  return MIDDLE_FALLBACK_TYPES[(idx - 1) % MIDDLE_FALLBACK_TYPES.length];
}

const BLOCKED_METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "instance-data",
  "100.100.100.200",
]);

function isBlockedPrivateOrMetadataHost(rawHostname: string): boolean {
  const host = rawHostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (BLOCKED_METADATA_HOSTS.has(host)) return true;

  // Reject IPv6 link-local (fe80::), ULA (fc00::/fd00::), unspecified (::)
  if (host.includes(":")) {
    if (
      host === "::" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("::ffff:169.254.") ||
      host.startsWith("::ffff:10.") ||
      host.startsWith("::ffff:192.168.") ||
      host.startsWith("::ffff:0.")
    ) {
      return true;
    }
    if (
      process.env.STRICT_PUBLIC_BYOK_ONLY === "true" &&
      (host === "::1" || host.startsWith("::ffff:127."))
    ) {
      return true;
    }
    return false;
  }

  // Standard dotted-quad IPv4 checks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    // 0.0.0.0/8, 169.254.0.0/16 (cloud metadata), 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10
    if (
      a === 0 ||
      (a === 169 && b === 254) ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return true;
    }
    if (process.env.STRICT_PUBLIC_BYOK_ONLY === "true" && a === 127) {
      return true;
    }
  }

  // Block integer/hex obfuscated IPv4 hostnames (e.g. 2852039166 or 0xa9fea9fe)
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(host)) {
    return true;
  }

  if (
    process.env.STRICT_PUBLIC_BYOK_ONLY === "true" &&
    (host === "localhost" || host.endsWith(".localhost"))
  ) {
    return true;
  }

  return false;
}

export function validateByokApiBase(
  rawApiBase: string
): { ok: true; endpointRoot: string } | { ok: false; error: string } {
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(rawApiBase);
  } catch {
    return {
      ok: false,
      error: "API Base URL 格式不合法，请输入有效的 http(s) 地址",
    };
  }
  if (
    (parsedBaseUrl.protocol !== "https:" &&
      parsedBaseUrl.protocol !== "http:") ||
    parsedBaseUrl.username ||
    parsedBaseUrl.password
  ) {
    return {
      ok: false,
      error: "API Base URL 仅支持不含内嵌凭据的 http:// 或 https:// 地址",
    };
  }
  if (isBlockedPrivateOrMetadataHost(parsedBaseUrl.hostname)) {
    return {
      ok: false,
      error:
        "出于安全限制，API Base URL 禁止指向云元数据地址或受保护内网段（如 169.254.x.x / 10.x.x.x / 192.168.x.x）",
    };
  }
  const normalizedPath = parsedBaseUrl.pathname.replace(/\/+$/, "");
  return {
    ok: true,
    endpointRoot: `${parsedBaseUrl.origin}${normalizedPath}`,
  };
}

export function scrubUpstreamError(rawText: string, apiKey: string): string {
  let scrubbed = rawText;
  if (apiKey) {
    scrubbed = scrubbed.replaceAll(apiKey, "[REDACTED]");
  }
  scrubbed = scrubbed.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
  return scrubbed.slice(0, 140);
}

function toSafeString(val: unknown): string | undefined {
  const s = safeString(val).trim();
  return s.length > 0 ? s : undefined;
}

function toSafeStringList(val: unknown, maxLen = 8): string[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const list = val
    .map((item) => safeString(item).trim())
    .filter(Boolean)
    .slice(0, maxLen);
  return list.length > 0 ? list : undefined;
}

function toSafeNum(val: unknown): number {
  const n = safeNumber(val);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function sanitizeOutlineItems(
  rawList: unknown,
  fallbackTopic: string
): OutlineDraftItem[] {
  if (!Array.isArray(rawList)) return [];
  const objs = rawList.filter(isPlainObject).slice(0, 20);
  const total = objs.length;
  return objs.map((item, idx) => {
    const slideType = normalizeSlideType(item.slideType, idx, total);
    const id = toSafeString(item.id) || `outline_${idx + 1}`;
    const sectionTag =
      toSafeString(item.sectionTag) ||
      (idx === 0
        ? "EXECUTIVE DECK"
        : `${String(idx).padStart(2, "0")} / ${slideType.toUpperCase()}`);
    const title = toSafeString(item.title) || `${fallbackTopic} · 第 ${idx + 1} 页`;
    const summary = toSafeString(item.summary) || "";
    const audienceQuestion = toSafeString(item.audienceQuestion);
    const contentRelation = toSafeString(item.contentRelation);
    const rawStatus = toSafeString(item.sourceStatus);
    const validStatuses = new Set([
      "source-material",
      "derived-calc",
      "placeholder",
      "needs-verify",
    ]);
    return {
      id,
      slideType,
      sectionTag,
      title,
      summary,
      ...(audienceQuestion ? { audienceQuestion } : {}),
      ...(contentRelation ? { contentRelation } : {}),
      ...(rawStatus && validStatuses.has(rawStatus)
        ? { sourceStatus: rawStatus as OutlineDraftItem["sourceStatus"] }
        : {}),
    };
  });
}

export function sanitizeLlmSlide(
  raw: Record<string, unknown>,
  idx: number,
  total: number,
  fallbackTopic: string
): DeckSlideItem {
  const slideType = normalizeSlideType(raw.slideType, idx, total);
  const id = toSafeString(raw.id) || `llm_slide_${idx + 1}`;
  const sectionTag =
    toSafeString(raw.sectionTag) ||
    (idx === 0
      ? "PRESENTATION"
      : `${String(idx).padStart(2, "0")} / ${slideType.toUpperCase()}`);
  const title = toSafeString(raw.title) || fallbackTopic;

  const slide: DeckSlideItem = {
    id,
    slideType,
    sectionTag,
    title,
  };

  const subtitle = toSafeString(raw.subtitle);
  if (subtitle) slide.subtitle = subtitle;

  const quoteText = toSafeString(raw.quoteText);
  if (quoteText) slide.quoteText = quoteText;

  const quoteAuthor = toSafeString(raw.quoteAuthor);
  if (quoteAuthor) slide.quoteAuthor = quoteAuthor;

  const leftTitle = toSafeString(raw.leftTitle);
  if (leftTitle) slide.leftTitle = leftTitle;

  const rightTitle = toSafeString(raw.rightTitle);
  if (rightTitle) slide.rightTitle = rightTitle;

  const leftPoints = toSafeStringList(raw.leftPoints, 6);
  if (leftPoints) slide.leftPoints = leftPoints;

  const rightPoints = toSafeStringList(raw.rightPoints, 6);
  if (rightPoints) slide.rightPoints = rightPoints;

  const bullets = toSafeStringList(raw.bullets, 8);
  if (bullets) slide.bullets = bullets;

  if (Array.isArray(raw.steps)) {
    const steps: DeckSlideStep[] = raw.steps
      .filter(isPlainObject)
      .slice(0, 6)
      .map((st, sIdx) => ({
        code: toSafeString(st.code) || String(sIdx + 1).padStart(2, "0"),
        title: toSafeString(st.title) || `步骤 ${sIdx + 1}`,
        desc: toSafeString(st.desc) || "",
      }));
    if (steps.length > 0) slide.steps = steps;
  }

  if (Array.isArray(raw.kpis)) {
    const kpis: DeckSlideKpi[] = raw.kpis
      .filter(isPlainObject)
      .slice(0, 4)
      .map((k, kIdx) => ({
        label: toSafeString(k.label) || `指标 ${kIdx + 1}`,
        value: toSafeString(k.value) || "—",
        note: toSafeString(k.note) || "",
      }));
    if (kpis.length > 0) slide.kpis = kpis;
  }

  if (Array.isArray(raw.bars)) {
    const bars: DeckSlideBar[] = raw.bars
      .filter(isPlainObject)
      .slice(0, 12)
      .map((b, bIdx) => ({
        label: toSafeString(b.label) || `项 ${bIdx + 1}`,
        v1: toSafeNum(b.v1),
        v2: toSafeNum(b.v2),
      }));
    if (bars.length > 0) slide.bars = bars;
  }

  if (isPlainObject(raw.swot)) {
    const swot: DeckSlideSwot = {
      strengths: toSafeStringList(raw.swot.strengths, 4) || ["核心能力与架构领先"],
      weaknesses: toSafeStringList(raw.swot.weaknesses, 4) || ["局部渠道覆盖待扩充"],
      opportunities: toSafeStringList(raw.swot.opportunities, 4) || ["行业数字化转型窗口期"],
      threats: toSafeStringList(raw.swot.threats, 4) || ["竞品价格竞争加剧"],
    };
    slide.swot = swot;
  }

  if (raw.chartMode === "funnel" || raw.chartMode === "donut") {
    slide.chartMode = raw.chartMode;
  }

  if (Array.isArray(raw.funnelStages)) {
    const stages: DeckSlideFunnelStage[] = raw.funnelStages
      .filter(isPlainObject)
      .slice(0, 6)
      .map((st, sIdx) => ({
        label: toSafeString(st.label) || `阶段 ${sIdx + 1}`,
        value: toSafeNum(st.value),
        unit: toSafeString(st.unit),
        note: toSafeString(st.note),
      }));
    if (stages.length > 0) slide.funnelStages = stages;
  }

  if (Array.isArray(raw.teamMembers)) {
    const members: DeckSlideTeamMember[] = raw.teamMembers
      .filter(isPlainObject)
      .slice(0, 4)
      .map((m, mIdx) => ({
        name: toSafeString(m.name) || `成员 ${mIdx + 1}`,
        role: toSafeString(m.role) || "核心负责人",
        bio: toSafeString(m.bio) || "",
        badge: toSafeString(m.badge),
      }));
    if (members.length > 0) slide.teamMembers = members;
  }

  if (isPlainObject(raw.imageSlot)) {
    const slot: DeckSlideImageSlot = {
      kind:
        raw.imageSlot.kind === "data-url" &&
        isValidImageDataUrl(raw.imageSlot.dataUrl)
          ? "data-url"
          : "svg-preset",
      presetId: toSafeString(raw.imageSlot.presetId) || "swiss-geometry",
      caption: toSafeString(raw.imageSlot.caption),
      layout: raw.imageSlot.layout === "right" ? "right" : "left",
      promptHint: toSafeString(raw.imageSlot.promptHint),
    };
    if (slot.kind === "data-url" && isValidImageDataUrl(raw.imageSlot.dataUrl)) {
      slot.dataUrl = raw.imageSlot.dataUrl.trim();
    }
    slide.imageSlot = slot;
  }

  const speakerNotes = toSafeString(raw.speakerNotes);
  if (speakerNotes) slide.speakerNotes = speakerNotes;

  const audienceQuestion = toSafeString(raw.audienceQuestion);
  if (audienceQuestion) slide.audienceQuestion = audienceQuestion;

  const contentRelation = toSafeString(raw.contentRelation);
  if (contentRelation) slide.contentRelation = contentRelation;

  const sourceNote = toSafeString(raw.sourceNote);
  if (sourceNote) slide.sourceNote = sourceNote;

  const rawStatus = toSafeString(raw.sourceStatus);
  if (
    rawStatus === "source-material" ||
    rawStatus === "derived-calc" ||
    rawStatus === "placeholder" ||
    rawStatus === "needs-verify"
  ) {
    slide.sourceStatus = rawStatus;
  }

  return slide;
}
