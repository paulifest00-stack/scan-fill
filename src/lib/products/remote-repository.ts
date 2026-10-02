import { gatewayRequest } from "../bling/session";
import type { ProductRepository } from "./repository";
import type { Product, ProductInput, ProductImage } from "./types";
const params = (input: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(input)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
let operation: { fingerprint: string; id: string } | undefined;
const uploaded = new Map<string, ProductImage>();
async function save(input: ProductInput, id?: string) {
  const fingerprint = JSON.stringify({ id, input });
  if (operation?.fingerprint !== fingerprint) operation = { fingerprint, id: crypto.randomUUID() };
  const requestId = operation.id;
  const images = await Promise.all(
    input.images.map(async (image) => {
      if (!image.url.startsWith("data:")) return image;
      if (uploaded.has(image.url)) return uploaded.get(image.url)!;
      const result = await gatewayRequest<ProductImage>("/mobile/images", {
        method: "POST",
        body: { data: image.url },
      });
      uploaded.set(image.url, result);
      return result;
    }),
  );
  const result = await gatewayRequest<Product>(
    id ? `/mobile/products/${encodeURIComponent(id)}` : "/mobile/products",
    { method: id ? "PATCH" : "POST", body: { requestId, input: { ...input, images } } },
  );
  operation = undefined;
  return result;
}
export const remoteRepository: ProductRepository = {
  generateDescription: (input) =>
    gatewayRequest("/mobile/description", {
      method: "POST",
      body: {
        input: {
          name: input.name,
          brand: input.brand,
          unit: input.unit,
          description: input.description,
        },
      },
    }),
  list: (input) =>
    gatewayRequest(`/mobile/products?${params({ ...input, limit: input.limit ?? 20 })}`),
  get: (id) => gatewayRequest(`/mobile/products/${encodeURIComponent(id)}`),
  findByCode: (code) => gatewayRequest(`/mobile/find?${params({ code: code.trim() })}`),
  create: (input) => save(input),
  update: (id, input) => save(input, id),
  contacts: (query) => gatewayRequest(`/mobile/contacts?${params({ query })}`),
  categories: () => gatewayRequest("/mobile/categories"),
  deposits: async () => {
    const rows = await gatewayRequest<Array<{ id: number; descricao: string }>>("/mobile/deposits");
    return rows.map((r) => ({ id: String(r.id), name: r.descricao }));
  },
};
