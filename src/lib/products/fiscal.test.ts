import { describe, expect, it } from "vitest";
import { normalizeFiscalCode, normalizeFiscalInput } from "./fiscal";

describe("fiscal codes received from Bling or pasted into the form", () => {
  it("accepts display punctuation and keeps leading zeros", () => {
    expect(normalizeFiscalCode("9505.90.00")).toBe("95059000");
    expect(normalizeFiscalCode("01.001.00")).toBe("0100100");
    expect(normalizeFiscalCode(" 0101.21.00 ")).toBe("01012100");
  });
  it("leaves invalid characters and excess digits visible to validation", () => {
    expect(normalizeFiscalCode("9505.A0.00")).toBe("9505A000");
    expect(normalizeFiscalCode("123456789")).toBe("123456789");
  });
  it("does not mutate the product or its other fields", () => {
    const input = { ncm: "9505.90.00", cest: "01.001.00", name: "Produto" };
    expect(normalizeFiscalInput(input)).toEqual({ ...input, ncm: "95059000", cest: "0100100" });
    expect(input.ncm).toBe("9505.90.00");
  });
});
