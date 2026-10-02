export interface Store {
  id: string;
  name: string;
  type: string;
}
export interface CategoryOption {
  id: string;
  name: string;
}
export interface CategoryLink {
  id: string;
  categoryId: string;
  code: string;
  name: string;
}
const aliases: Record<string, string> = {
  baloes: "balao",
  balloons: "balao",
  balloon: "balao",
  candles: "vela",
  candle: "vela",
  plates: "prato",
  plate: "prato",
  cups: "copo",
  cup: "copo",
  napkins: "guardanapo",
  napkin: "guardanapo",
  decorations: "decoracao",
  decoration: "decoracao",
  descartaveis: "descartavel",
  birthday: "aniversario",
  party: "festa",
};
const tokens = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(
      (t) => t.length > 2 && !["para", "com", "sem", "uma", "the", "and", "dos", "das"].includes(t),
    )
    .map((t) => aliases[t] ?? (t.endsWith("s") ? t.slice(0, -1) : t));
/** Suggestions are limited to real account categories; never invent taxonomy IDs. */
export function suggestCategories(name: string, options: CategoryOption[]) {
  const words = new Set(tokens(name));
  if (!words.size) return [];
  return options
    .map((option) => {
      const parts = option.name.split("›");
      const leaf = tokens(parts.at(-1) ?? "");
      const all = new Set(tokens(option.name));
      const matches = [...words].filter((w) => all.has(w));
      const score = matches.length + leaf.filter((w) => words.has(w)).length * 2;
      return { ...option, score };
    })
    .filter((c) => c.score >= 3)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 3);
}
export function shopeeMissing(p: {
  name: string;
  sku: string;
  price: number | null;
  grossWeightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  description: string;
  images: unknown[];
  category: string;
}) {
  const issues: string[] = [];
  if (!p.name.trim()) issues.push("Nome");
  if (!p.sku.trim()) issues.push("SKU");
  if (!(p.price !== null && p.price > 0)) issues.push("Preço");
  if (!(p.grossWeightKg !== null && p.grossWeightKg > 0)) issues.push("Peso bruto");
  if ([p.widthCm, p.heightCm, p.depthCm].some((v) => v === null || v <= 0 || v > 70))
    issues.push("Dimensões entre 0 e 70 cm");
  if (p.description.trim().length < 10 || p.description.length > 5000)
    issues.push("Descrição de 10 a 5.000 caracteres");
  if (!p.images.length) issues.push("Foto");
  if (!p.category) issues.push("Categoria interna");
  return issues;
}
