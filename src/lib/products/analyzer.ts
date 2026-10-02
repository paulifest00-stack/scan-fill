import type { EditableField, ProductInput } from "./types";

/**
 * Photo analysis contract (future AI via backend). The analyzer only *suggests*.
 * The form applies suggestions with origin "suggested"; the user confirms them.
 */
export interface FieldSuggestion {
  field: EditableField;
  value: string | number;
  /** 0–1. */
  confidence: number;
  /** "read" = text literally visible on the package; "inferred" = deduced. */
  kind: "read" | "inferred";
  /** Short evidence shown to the user, e.g. the text that was read. */
  evidence?: string | undefined;
}

export interface ProductAnalyzer {
  readonly available: boolean;
  analyze(images: string[]): Promise<FieldSuggestion[]>;
}

/**
 * Fields that must never be filled from inference. They may only be suggested
 * when literally read from the package, and always need explicit confirmation.
 */
export const CRITICAL_FIELDS: ReadonlySet<EditableField> = new Set([
  "gtin", "gtinPackage", "ncm", "cest", "taxOrigin", "price", "cost", "stock",
  "netWeightKg", "grossWeightKg", "widthCm", "heightCm", "depthCm", "sku",
]);

/** Enforces the safety rules regardless of what the model returns. */
export function sanitizeSuggestions(list: FieldSuggestion[], current: ProductInput): FieldSuggestion[] {
  return list.filter((s) => {
    if (CRITICAL_FIELDS.has(s.field) && s.kind !== "read") return false;
    if (s.confidence < 0.5) return false;
    const v = current[s.field];
    return v === null || v === "" || v !== s.value;
  });
}

/** Placeholder until the backend endpoint exists. */
export const unavailableAnalyzer: ProductAnalyzer = {
  available: false,
  async analyze() { return []; },
};

export const analyzer: ProductAnalyzer = unavailableAnalyzer;
