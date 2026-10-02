import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { remoteRepository } from "@/lib/products/remote-repository";
import { emptyInput } from "@/lib/products/types";
import { gatewayRequest, setGatewayUrl } from "@/lib/bling/session";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setGatewayUrl("https://gateway.example");
  sessionStorage.setItem(
    "paulifest.gateway.session",
    JSON.stringify({
      gatewaySessionToken: "gateway-token",
      gatewayRefreshToken: "gateway-refresh",
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
const reply = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), {
    headers: { "Content-Type": "application/json" },
  });
describe("Remote repository", () => {
  it("sends gateway session only and uses exact barcode lookup", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(null));
    vi.stubGlobal("fetch", fetch);
    expect(await remoteRepository.findByCode("4006381333931")).toBeNull();
    expect(fetch.mock.calls[0]?.[0]).toContain("/mobile/find?code=4006381333931");
    expect(fetch.mock.calls[0]?.[1].headers.Authorization).toBe("Bearer gateway-token");
  });
  it("uploads photos before creating and reuses operation key after uncertain result", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        reply({ url: "https://gateway.example/mobile/images/test", local: false }),
      )
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(reply({ id: "100" }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      ...emptyInput(),
      name: "Teste",
      sku: "PHOTO-TEST",
      images: [{ url: "data:image/jpeg;base64,AAAA", local: true }],
    };
    await expect(remoteRepository.create(input)).rejects.toThrow();
    await remoteRepository.create(input);
    const first = JSON.parse(fetch.mock.calls[1]?.[1].body);
    const second = JSON.parse(fetch.mock.calls[2]?.[1].body);
    expect(first.requestId).toBe(second.requestId);
    expect(second.input.images[0].url).toMatch(/^https:/);
  });
  it("refreshes concurrent expired gateway sessions once", async () => {
    const fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/session/refresh"))
        return reply({ gatewaySessionToken: "new-token", gatewayRefreshToken: "new-refresh" });
      if ((init.headers as Record<string, string>)["Authorization"] === "Bearer gateway-token")
        return new Response(JSON.stringify({ ok: false }), { status: 401 });
      return reply({ connected: true });
    });
    vi.stubGlobal("fetch", fetch);
    await Promise.all([
      gatewayRequest("/integrations/bling/status"),
      gatewayRequest("/integrations/bling/status"),
    ]);
    expect(fetch.mock.calls.filter((c) => c[0].endsWith("/auth/session/refresh"))).toHaveLength(1);
  });
  it("does not use local products if Bling is configured without an authorized session", async () => {
    sessionStorage.clear();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(remoteRepository.list({})).rejects.toMatchObject({ code: "unauthorized" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
