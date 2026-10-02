import { describe, it, expect } from "vitest";
import { suggestCategories, shopeeMissing } from "./categories";
import { emptyInput } from "./types";
describe("category suggestions from real categories", () => {
  it("matches accents, plurals and mapped English names", () => {
    const options = [
      { id: "1", name: "Festas › Balões" },
      { id: "2", name: "Festas › Velas" },
    ];
    expect(suggestCategories("Balão azul número 9", options)[0]?.id).toBe("1");
    expect(suggestCategories("Vela aniversário", options)[0]?.id).toBe("2");
    expect(suggestCategories("Balão azul", [{ id: "10", name: "Party › Balloons" }])[0]?.id).toBe(
      "10",
    );
  });
  it("does not propose unrelated categories", () => {
    expect(suggestCategories("Celular Android", [{ id: "1", name: "Balões" }])).toEqual([]);
  });
  it("checks Shopee description and dimension limits", () => {
    const p = {
      ...emptyInput(),
      name: "Produto",
      sku: "A",
      price: 2,
      grossWeightKg: 0.1,
      widthCm: 10,
      heightCm: 10,
      depthCm: 71,
      description: "Descrição adequada",
      images: [{ url: "https://example.com/a" }],
      category: "1",
    };
    expect(shopeeMissing(p)).toEqual(["Dimensões entre 0 e 70 cm"]);
    expect(shopeeMissing({ ...p, depthCm: 10 })).toEqual([]);
  });
});
