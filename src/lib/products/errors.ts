/** Errors every repository implementation must translate into, so screens can react uniformly. */
export type RepoErrorCode =
  | "offline"        // no connection / request never reached the server
  | "not_found"      // product does not exist (anymore)
  | "duplicate"      // GTIN or SKU already used by another product
  | "conflict"       // product changed elsewhere since it was loaded
  | "validation"     // data rejected by the source
  | "unauthorized"   // session/integration expired
  | "unknown";

export class RepoError extends Error {
  constructor(
    public code: RepoErrorCode,
    message: string,
    public details?: { field?: string; existingId?: string; existingName?: string },
  ) {
    super(message);
    this.name = "RepoError";
  }
}

export function toRepoError(e: unknown): RepoError {
  if (e instanceof RepoError) return e;
  if (typeof navigator !== "undefined" && !navigator.onLine) return new RepoError("offline", "Sem conexão com a internet.");
  return new RepoError("unknown", "Algo deu errado. Tente novamente.");
}

export function friendlyMessage(e: unknown): string {
  return toRepoError(e).message;
}
