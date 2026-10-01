/** Field provenance: confirmed by user / read from barcode, or only suggested (e.g. by AI). */
export type FieldOrigin = "confirmed" | "suggested";

export interface Product {
  id: string;
  /** Id in the ERP once synced; undefined while local-only. */
  remoteId?: string | undefined;
  name: string;
  sku: string;
  gtin: string;
  ncm: string;
  category: string;
  unit: string;
  price: number | null;
  cost: number | null;
  stock: number | null;
  weightKg: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  brand: string;
  description: string;
  images: string[];
  origins: Partial<Record<keyof Product, FieldOrigin>>;
  syncStatus: "synced" | "pending" | "error";
  updatedAt: string;
}

export type ProductDraft = Omit<Product, "id" | "updatedAt" | "syncStatus"> & { id?: string };

export const emptyDraft = (): ProductDraft => ({
  name: "", sku: "", gtin: "", ncm: "", category: "", unit: "UN",
  price: null, cost: null, stock: null, weightKg: null,
  widthCm: null, heightCm: null, depthCm: null,
  brand: "", description: "", images: [], origins: {},
});
