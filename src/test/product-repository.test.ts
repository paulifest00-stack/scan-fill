import { beforeEach, describe, expect, it } from "vitest";
import { localRepository as repo } from "@/lib/products/repository";
import { emptyInput, toInput } from "@/lib/products/types";
import { isValidGtin } from "@/lib/products/helpers";

beforeEach(() => localStorage.clear());
const input = () => ({ ...emptyInput(), name: "Produto novo", sku: "NOVO-1" });

describe("Local product contract", () => {
  it("paginates summaries without requiring full products", async () => {
    const first = await repo.list({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.items[0]).toHaveProperty("missingCount");
    const next = await repo.list({ limit: 2, cursor: first.nextCursor! });
    expect(next.items).toHaveLength(1);
    expect(next.nextCursor).toBeUndefined();
  });
  it("preserves local photo status and rejects stale updates", async () => {
    const created = await repo.create({ ...input(), images: [{ url: "data:image/png;base64,AA", local: true }] });
    expect(created.syncStatus).toBe("pending");
    expect(created.images[0]?.local).toBe(true);
    const edited = await repo.update(created.id, { ...toInput(created), name: "Alterado" });
    expect(edited.version).toBe("2");
    await expect(repo.update(created.id, toInput(created))).rejects.toMatchObject({ code: "conflict" });
  });
  it("rejects duplicate packaging GTIN and SKU", async () => {
    await repo.create({ ...input(), gtin: "4006381333931" });
    await expect(repo.create({ ...input(), sku: "NOVO-2", gtinPackage: "4006381333931" })).rejects.toMatchObject({ code: "duplicate" });
    await expect(repo.create(input())).rejects.toMatchObject({ code: "duplicate" });
  });
  it("rejects invalid data and unconfirmed critical suggestions", async () => {
    expect(isValidGtin("000000000000")).toBe(true);
    expect(isValidGtin("0000000000000")).toBe(true);
    expect(isValidGtin("00000000000000")).toBe(true);
    expect(isValidGtin("1234567890123")).toBe(false);
    await expect(repo.create({ ...input(), ncm: "123" })).rejects.toMatchObject({ code: "validation" });
    await expect(repo.create({ ...input(), price: 10, origins: { price: "suggested" } })).rejects.toMatchObject({ code: "validation" });
  });
});
