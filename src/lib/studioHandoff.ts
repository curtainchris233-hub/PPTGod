import type { VisualSpec } from "@/types/prompt";

const STORAGE_KEY = "pptgod_studio_handoff_v4";
const HANDOFF_TTL_MS = 15 * 60 * 1000;

export interface StudioHandoffPayload {
  slug: string;
  visualSpec: VisualSpec;
  topic: string;
  subtitle: string;
  audience: string;
  slideCount: number;
  savedAt: number;
}

export function saveStudioHandoff(
  payload: Omit<StudioHandoffPayload, "savedAt">
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: StudioHandoffPayload = {
      ...payload,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage quota or private-browsing exceptions
  }
}

export function readStudioHandoff(
  expectedSlug?: string | null
): StudioHandoffPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudioHandoffPayload>;
    if (
      !parsed ||
      typeof parsed.slug !== "string" ||
      !parsed.visualSpec ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > HANDOFF_TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (expectedSlug && parsed.slug !== expectedSlug) {
      return null;
    }
    return {
      slug: parsed.slug,
      visualSpec: parsed.visualSpec,
      topic: typeof parsed.topic === "string" ? parsed.topic : "",
      subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : "",
      audience: typeof parsed.audience === "string" ? parsed.audience : "",
      slideCount:
        typeof parsed.slideCount === "number" && Number.isFinite(parsed.slideCount)
          ? Math.max(5, Math.min(20, Math.round(parsed.slideCount)))
          : 12,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearStudioHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
