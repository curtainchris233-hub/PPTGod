import type { DocumentAnalysisResult, OutlineDraftItem } from "@/types/prompt";

const DOC_INTAKE_KEY = "pptgod_doc_intake_v1";
const DOC_INTAKE_MAX_AGE_MS = 30 * 60 * 1000;

export interface DocIntakePayload {
  fileName: string;
  fileType: string;
  charCount: number;
  text: string;
  topic: string;
  subtitle: string;
  audience: string;
  slideCount: number;
  styleSlug: string;
  autoGenerate: boolean;
  parsedOutline?: OutlineDraftItem[];
  analysis?: DocumentAnalysisResult;
  savedAt: number;
}

export function saveDocIntakeHandoff(
  payload: Omit<DocIntakePayload, "savedAt">
): void {
  if (typeof window === "undefined") return;
  try {
    const safePayload: DocIntakePayload = {
      ...payload,
      text: (payload.text || "").slice(0, 16000),
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(DOC_INTAKE_KEY, JSON.stringify(safePayload));
  } catch {
    // Graceful degradation under private mode / storage quota restrictions
  }
}

export function readDocIntakeHandoff(): DocIntakePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DOC_INTAKE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DocIntakePayload>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.savedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.savedAt > DOC_INTAKE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(DOC_INTAKE_KEY);
      return null;
    }
    if (typeof parsed.topic !== "string" || typeof parsed.styleSlug !== "string") {
      return null;
    }
    return parsed as DocIntakePayload;
  } catch {
    return null;
  }
}

export function clearDocIntakeHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DOC_INTAKE_KEY);
  } catch {
    // Ignore
  }
}
