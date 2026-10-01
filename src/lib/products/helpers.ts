import type { Product, ProductDraft } from "./types";

const REQUIRED: { key: keyof ProductDraft; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "sku", label: "SKU" },
  { key: "gtin", label: "GTIN/EAN" },
  { key: "ncm", label: "NCM" },
  { key: "price", label: "Preço" },
  { key: "weightKg", label: "Peso" },
  { key: "images", label: "Foto" },
];

export function missingFields(p: ProductDraft): string[] {
  return REQUIRED.filter(({ key }) => {
    const v = p[key];
    if (Array.isArray(v)) return v.length === 0;
    return v === null || v === undefined || String(v).trim() === "";
  }).map((r) => r.label);
}

/** SKU from name initials + random suffix, e.g. "BAL-AZU-4F2K". */
export function generateSku(name: string, category = ""): string {
  const words = `${category} ${name}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const prefix = words.slice(0, 3).map((w) => w.slice(0, 3)).join("-") || "PRD";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/** Validates EAN-8/EAN-13/UPC-A/GTIN-14 check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export const brl = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function matches(p: Product, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [p.name, p.sku, p.gtin, p.brand, p.category, p.remoteId ?? ""].some((f) => f.toLowerCase().includes(s));
}
