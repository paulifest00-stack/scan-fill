import { RepoError } from "../products/errors";
export const DEFAULT_GATEWAY_URL = "https://paulifest-seller-copilot-gateway.onrender.com";
const CONFIG = "paulifest.gateway.url";
const SESSION = "paulifest.gateway.session";
const PAIRING = "paulifest.gateway.pairing";
type Session = { gatewaySessionToken: string; gatewayRefreshToken: string };
export function gatewayUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CONFIG) || import.meta.env["VITE_GATEWAY_URL"] || DEFAULT_GATEWAY_URL;
}
export function setGatewayUrl(value: string) {
  const url = new URL(value.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  )
    throw new RepoError("validation", "Informe a URL HTTPS do Gateway, sem caminho.");
  localStorage.setItem(CONFIG, url.origin);
  sessionStorage.removeItem(SESSION);
  sessionStorage.removeItem(PAIRING);
}
function session(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION) || "null");
  } catch {
    return null;
  }
}
let refreshing: Promise<Session> | undefined;
const errorCode = (code: string, status: number) =>
  ["offline", "not_found", "duplicate", "conflict", "validation", "unauthorized"].includes(code)
    ? (code as RepoError["code"])
    : status === 401
      ? "unauthorized"
      : status === 404
        ? "not_found"
        : status === 422
          ? "validation"
          : "unknown";
export async function gatewayRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; authenticated?: boolean } = {},
): Promise<T> {
  const base = gatewayUrl();
  if (!base) throw new RepoError("unauthorized", "Configure o Gateway para conectar ao Bling.");
  const auth = options.authenticated !== false;
  async function send(token?: string) {
    try {
      return await fetch(base + path, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(90000),
      });
    } catch {
      throw new RepoError(
        navigator.onLine ? "unknown" : "offline",
        options.method && options.method !== "GET"
          ? "Não foi possível confirmar a operação. Confira o Bling antes de repetir."
          : "Não foi possível acessar o Gateway.",
      );
    }
  }
  const s = auth ? session() : null;
  if (auth && !s) throw new RepoError("unauthorized", "Conecte sua conta Bling.");
  let response = await send(s?.gatewaySessionToken);
  if (response.status === 401 && auth && s) {
    refreshing ??= gatewayRequest<Session>("/auth/session/refresh", {
      method: "POST",
      authenticated: false,
      body: { gatewayRefreshToken: s.gatewayRefreshToken },
    })
      .then((next) => {
        sessionStorage.setItem(SESSION, JSON.stringify(next));
        return next;
      })
      .finally(() => {
        refreshing = undefined;
      });
    try {
      const next = await refreshing;
      response = await send(next.gatewaySessionToken);
    } catch {
      sessionStorage.removeItem(SESSION);
      throw new RepoError("unauthorized", "Sessão expirada. Conecte novamente ao Bling.");
    }
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false)
    throw new RepoError(
      errorCode(body?.error, response.status),
      body?.message || "Não foi possível concluir a operação.",
    );
  return (Object.hasOwn(body, "data") ? body.data : body) as T;
}
export async function startConnection() {
  const result = await gatewayRequest<{
    authorizationUrl: string;
    pairingId: string;
    pairingSecret: string;
    expiresInSeconds: number;
  }>("/auth/bling/start", {
    method: "POST",
    authenticated: false,
    body: { clientSessionId: crypto.randomUUID() },
  });
  const url = new URL(result.authorizationUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.bling.com.br")
    throw new RepoError("validation", "URL de autorização inválida.");
  sessionStorage.setItem(
    PAIRING,
    JSON.stringify({
      pairingId: result.pairingId,
      pairingSecret: result.pairingSecret,
      expiresAt: Date.now() + result.expiresInSeconds * 1000,
    }),
  );
  return result.authorizationUrl;
}
export async function finishConnection() {
  const pairing = JSON.parse(sessionStorage.getItem(PAIRING) || "null");
  if (!pairing || pairing.expiresAt < Date.now())
    throw new RepoError("unauthorized", "Inicie uma nova conexão.");
  const result = await gatewayRequest<Session>("/auth/bling/session", {
    method: "POST",
    authenticated: false,
    body: { pairingId: pairing.pairingId, pairingSecret: pairing.pairingSecret },
  });
  if (!result.gatewaySessionToken)
    throw new RepoError("unauthorized", "Conclua a autorização no Bling antes de confirmar.");
  sessionStorage.setItem(SESSION, JSON.stringify(result));
  sessionStorage.removeItem(PAIRING);
}
export async function disconnect() {
  await gatewayRequest("/integrations/bling", { method: "DELETE" });
  sessionStorage.removeItem(SESSION);
}
export const hasPairing = () => typeof window !== "undefined" && !!sessionStorage.getItem(PAIRING);
