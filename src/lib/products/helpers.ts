import type { Product, ProductInput, ProductSummary } from "./types";

/** Fields considered necessary for a "complete" product. */
const REQUIRED: { key: keyof ProductInput; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "sku", label: "SKU" },
  { key: "gtin", label: "GTIN/EAN" },
  { key: "ncm", label: "NCM" },
  { key: "price", label: "Preço" },
  { key: "grossWeightKg", label: "Peso" },
  { key: "images", label: "Foto" },
];

export function missingFields(p: ProductInput): string[] {
  return REQUIRED.filter(({ key }) => {
    const v = p[key];
    if (Array.isArray(v)) return v.length === 0;
    return v === null || v === undefined || String(v).trim() === "";
  }).map((r) => r.label);
}

/** SKU from category/name initials + random suffix, e.g. "BAL-LAT-4F2K". */
export function generateSku(name: string, category = ""): string {
  const words = `${category} ${name}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const prefix = words.slice(0, 3).map((w) => w.slice(0, 3)).join("-") || "PRD";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/** Validates EAN-8 / UPC-A / EAN-13 / GTIN-14 check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export const looksLikeBarcode = (s: string) => /^\d{8,14}$/.test(s.trim());

export const brl = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Accepts "12,50", "1.234,50", "12.5". Returns null for empty/invalid. */
export function parseDecimal(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function toSummary(p: Product): ProductSummary {
  return {
    id: p.id, name: p.name, sku: p.sku, gtin: p.gtin, price: p.price, stock: p.stock,
    status: p.status, syncStatus: p.syncStatus, updatedAt: p.updatedAt,
    thumbnail: p.images[0]?.url, missingCount: missingFields(p).length,
  };
}
