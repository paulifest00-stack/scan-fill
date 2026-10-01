import { emptyDraft, type Product, type ProductDraft } from "./types";

/**
 * Data source contract. The ERP adapter will implement this same interface,
 * so screens never depend on where products come from.
 */
export interface ProductRepository {
  list(): Promise<Product[]>;
  get(id: string): Promise<Product | undefined>;
  findByGtin(gtin: string): Promise<Product | undefined>;
  create(d: ProductDraft): Promise<Product>;
  update(id: string, d: ProductDraft): Promise<Product>;
}

const KEY = "catalogo.products.v1";

const seed: Product[] = [
  { ...emptyDraft(), id: "p1", remoteId: "16001", name: "Balão Látex Azul Nº 9 — 50 un", sku: "BAL-LAT-AZU9", gtin: "7891234567895", ncm: "95059000", category: "Balões", brand: "São Roque", price: 14.9, cost: 7.2, stock: 120, weightKg: 0.12, syncStatus: "synced", updatedAt: new Date().toISOString() },
  { ...emptyDraft(), id: "p2", remoteId: "16002", name: "Vela de Aniversário Número 5 Dourada", sku: "VEL-NUM-5DO", gtin: "7896543210982", ncm: "", category: "Velas", brand: "Regina", price: 6.5, cost: 2.9, stock: 48, weightKg: null, syncStatus: "synced", updatedAt: new Date().toISOString() },
  { ...emptyDraft(), id: "p3", remoteId: "16003", name: "Prato Descartável Festa Unicórnio — 8 un", sku: "PRA-DES-UNI", gtin: "", ncm: "48236100", category: "Descartáveis", brand: "Cromus", price: 9.9, cost: 4.1, stock: 0, weightKg: 0.2, syncStatus: "synced", updatedAt: new Date().toISOString() },
];

function read(): Product[] {
  if (typeof window === "undefined") return seed;
  const raw = localStorage.getItem(KEY);
  if (!raw) { localStorage.setItem(KEY, JSON.stringify(seed)); return seed; }
  return JSON.parse(raw) as Product[];
}
const write = (items: Product[]) => localStorage.setItem(KEY, JSON.stringify(items));

export const localRepository: ProductRepository = {
  async list() { return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
  async get(id) { return read().find((p) => p.id === id); },
  async findByGtin(gtin) { return read().find((p) => p.gtin === gtin); },
  async create(d) {
    const p: Product = { ...d, id: crypto.randomUUID(), syncStatus: "pending", updatedAt: new Date().toISOString() };
    write([p, ...read()]);
    return p;
  },
  async update(id, d) {
    const items = read();
    const i = items.findIndex((p) => p.id === id);
    if (i < 0) throw new Error("Produto não encontrado");
    items[i] = { ...items[i], ...d, syncStatus: "pending", updatedAt: new Date().toISOString() };
    write(items);
    return items[i];
  },
};

export const repo: ProductRepository = localRepository;
