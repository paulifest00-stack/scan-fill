import { RepoError } from "./errors";
import { normalize, toSummary } from "./helpers";
import { emptyInput, type Product, type ProductInput, type ProductSummary } from "./types";

export interface ListParams {
  query?: string;
  incompleteOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export interface ListResult {
  items: ProductSummary[];
  /** Pass back to fetch the next page; undefined when there is no more. */
  nextCursor?: string | undefined;
}

/**
 * Data source contract used by every screen.
 * A remote adapter (backend gateway → ERP) implements the same interface.
 * All methods must reject with RepoError (see errors.ts).
 */
export interface ProductRepository {
  list(params: ListParams): Promise<ListResult>;
  /** Throws RepoError("not_found"). */
  get(id: string): Promise<Product>;
  /** Exact match on GTIN, packaging GTIN or SKU. Returns null when nothing matches. */
  findByCode(code: string): Promise<Product | null>;
  /** Throws RepoError("duplicate") when GTIN/SKU belongs to another product. */
  create(input: ProductInput): Promise<Product>;
  /** Throws "duplicate", "conflict" (input.version stale) or "not_found". */
  update(id: string, input: ProductInput): Promise<Product>;
}

/* ------------------------------------------------------------------ */
/* Local implementation (device storage). Simulates network behaviour */
/* so screens are exercised against latency, offline and conflicts.   */
/* ------------------------------------------------------------------ */

const KEY = "catalogo.products.v2";
const now = () => new Date().toISOString();

const seed = (): Product[] => [
  { ...emptyInput(), id: "16001", remoteId: "16001", version: "1", name: "Balão Látex Azul Nº 9 — 50 un", sku: "BAL-LAT-AZU9", gtin: "7891234567895", ncm: "95059000", category: "Balões", brand: "São Roque", price: 14.9, cost: 7.2, stock: 120, grossWeightKg: 0.12, syncStatus: "synced", updatedAt: now() },
  { ...emptyInput(), id: "16002", remoteId: "16002", version: "1", name: "Vela de Aniversário Número 5 Dourada", sku: "VEL-NUM-5DO", gtin: "7896543210982", category: "Velas", brand: "Regina", price: 6.5, cost: 2.9, stock: 48, syncStatus: "synced", updatedAt: now() },
  { ...emptyInput(), id: "16003", remoteId: "16003", version: "1", name: "Prato Descartável Festa Unicórnio — 8 un", sku: "PRA-DES-UNI", ncm: "48236100", category: "Descartáveis", brand: "Cromus", price: 9.9, cost: 4.1, stock: 0, grossWeightKg: 0.2, syncStatus: "synced", updatedAt: now() },
];

function read(): Product[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
  return JSON.parse(raw) as Product[];
}
function write(items: Product[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); }
  catch { throw new RepoError("validation", "Espaço do aparelho cheio. Remova algumas fotos e tente de novo."); }
}

async function network<T>(fn: () => T, ms = 250): Promise<T> {
  if (typeof window === "undefined") throw new RepoError("offline", "Indisponível no servidor.");
  await new Promise((r) => setTimeout(r, ms));
  if (!navigator.onLine) throw new RepoError("offline", "Sem conexão. Verifique a internet e tente de novo.");
  return fn();
}

function assertUnique(items: Product[], input: ProductInput, selfId?: string) {
  const others = items.filter((p) => p.id !== selfId);
  const checks: [string, string, (p: Product) => boolean][] = [
    ["gtin", "GTIN", (p) => !!input.gtin && (p.gtin === input.gtin || p.gtinPackage === input.gtin)],
    ["sku", "SKU", (p) => !!input.sku && p.sku.toUpperCase() === input.sku.toUpperCase()],
  ];
  for (const [field, label, hit] of checks) {
    const dup = others.find(hit);
    if (dup) throw new RepoError("duplicate", `${label} já usado em “${dup.name}”.`, { field, existingId: dup.id, existingName: dup.name });
  }
}

export const localRepository: ProductRepository = {
  list: ({ query = "", incompleteOnly = false, cursor, limit = 50 }) => network(() => {
    const q = normalize(query);
    const all = read()
      .filter((p) => !q || [p.name, p.sku, p.gtin, p.gtinPackage, p.brand, p.category, p.remoteId ?? ""].some((f) => normalize(f).includes(q)))
      .map(toSummary)
      .filter((s) => !incompleteOnly || s.missingCount > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const start = cursor ? Number(cursor) : 0;
    const items = all.slice(start, start + limit);
    return { items, nextCursor: start + limit < all.length ? String(start + limit) : undefined };
  }),
  get: (id) => network(() => {
    const p = read().find((x) => x.id === id);
    if (!p) throw new RepoError("not_found", "Produto não encontrado. Ele pode ter sido removido.");
    return p;
  }),
  findByCode: (code) => network(() => {
    const c = code.trim().toUpperCase();
    return read().find((p) => p.gtin === c || p.gtinPackage === c || p.sku.toUpperCase() === c) ?? null;
  }),
  create: (input) => network(() => {
    const items = read();
    assertUnique(items, input);
    const p: Product = {
      ...input, id: crypto.randomUUID(), version: "1",
      images: input.images.map((i) => ({ url: i.url })), syncStatus: "synced", updatedAt: now(),
    };
    write([p, ...items]);
    return p;
  }, 500),
  update: (id, input) => network(() => {
    const items = read();
    const i = items.findIndex((p) => p.id === id);
    const current = items[i];
    if (!current) throw new RepoError("not_found", "Produto não encontrado. Ele pode ter sido removido.");
    if (input.version && current.version && input.version !== current.version)
      throw new RepoError("conflict", "Este produto foi alterado em outro lugar. Recarregue para ver a versão atual.");
    assertUnique(items, input, id);
    const next: Product = {
      ...current, ...input, id,
      version: String(Number(current.version ?? "0") + 1),
      images: input.images.map((img) => ({ url: img.url })), syncStatus: "synced", updatedAt: now(),
    };
    items[i] = next;
    write(items);
    return next;
  }, 500),
};

/** Single switch point: replace with the remote adapter when the backend gateway exists. */
export const repo: ProductRepository = localRepository;
