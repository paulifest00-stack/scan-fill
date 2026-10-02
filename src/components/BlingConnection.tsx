import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  disconnect,
  finishConnection,
  gatewayRequest,
  gatewayUrl,
  hasPairing,
  setGatewayUrl,
  startConnection,
} from "@/lib/bling/session";
import { friendlyMessage } from "@/lib/products/errors";

export function BlingConnection() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setUrl(gatewayUrl());
    setConfigured(!!gatewayUrl());
    setPairing(hasPairing());
    if (gatewayUrl())
      void gatewayRequest<{ connected: boolean }>("/integrations/bling/status")
        .then((s) => setConnected(s.connected))
        .catch(() => {});
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!connected) return;
    let revision: string | undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void gatewayRequest<{ revision: string }>("/mobile/revision")
        .then((result) => {
          if (revision !== undefined && revision !== result.revision)
            void qc.invalidateQueries({ queryKey: ["products"] });
          revision = result.revision;
        })
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [connected, qc]);
  return (
    <section className="rounded-md bg-card p-3 text-[13px]" aria-label="Conexão Bling">
      <p className="font-semibold">
        {connected
          ? "Conectado ao Bling"
          : configured
            ? "Bling · aguardando conexão"
            : "Modo local · sem conexão com o Bling"}
      </p>
      {!configured && (
        <div className="mt-2 flex gap-2">
          <input
            aria-label="URL do Gateway"
            placeholder="https://seu-gateway..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="min-w-0 flex-1 rounded border p-2"
          />
          <button
            disabled={busy}
            className="rounded bg-secondary px-2"
            onClick={() =>
              void run(async () => {
                setGatewayUrl(url);
                setConfigured(true);
                qc.clear();
              })
            }
          >
            Configurar
          </button>
        </div>
      )}
      {configured && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!connected && (
            <button
              disabled={busy}
              className="ios-btn-tinted h-9 px-3 text-[13px]"
              onClick={() =>
                void run(async () => {
                  const authorization = await startConnection();
                  setPairing(true);
                  window.location.assign(authorization);
                })
              }
            >
              Conectar ao Bling
            </button>
          )}
          {!connected && pairing && (
            <button
              disabled={busy}
              className="ios-btn-tinted h-9 px-3 text-[13px]"
              onClick={() =>
                void run(async () => {
                  await finishConnection();
                  setConnected(true);
                  setPairing(false);
                  qc.clear();
                })
              }
            >
              Já autorizei · concluir
            </button>
          )}
          {connected && (
            <button
              disabled={busy}
              className="ios-btn-tinted h-9 px-3 text-[13px]"
              onClick={() => void qc.invalidateQueries({ queryKey: ["products"] })}
            >
              Atualizar catálogo
            </button>
          )}
          {connected && (
            <button
              disabled={busy}
              className="h-9 px-2"
              onClick={() =>
                void run(async () => {
                  await disconnect();
                  setConnected(false);
                  qc.clear();
                })
              }
            >
              Desconectar
            </button>
          )}
          <button disabled={busy} className="h-9 px-2" onClick={() => setConfigured(false)}>
            Alterar Gateway
          </button>
        </div>
      )}
      {pairing && !connected && (
        <p className="mt-2">
          Após autorizar no Bling, volte a este app pelo botão Voltar do navegador e toque em
          concluir.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
