import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Radio,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unplug,
  Loader2,
  ChevronRight,
} from "lucide-react";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { toast } from "sonner";

export function BlingConnection() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

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

  const statusLabel = connected
    ? "Bling Conectado"
    : configured
      ? "Bling · Aguardando"
      : "Modo Local";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="ios-press inline-flex h-8 items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 text-[12px] font-medium backdrop-blur-md shadow-xs transition hover:bg-white active:scale-95"
          aria-label="Status da Conexão Bling"
        >
          <span className="relative flex size-2">
            {connected ? (
              <>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </>
            ) : configured ? (
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            ) : (
              <span className="relative inline-flex size-2 rounded-full bg-slate-400" />
            )}
          </span>
          <span className="font-medium tracking-tight text-foreground">{statusLabel}</span>
          <Sliders className="size-3 text-muted-foreground ml-0.5" />
        </button>
      </DrawerTrigger>

      <DrawerContent className="ios-glass-card border-t border-black/10 px-4 pb-8 max-w-xl mx-auto">
        <DrawerHeader className="text-left px-0 pb-2 pt-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-[19px] font-bold tracking-tight">
              Sincronização & Bling
            </DrawerTitle>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                connected
                  ? "bg-emerald-500/10 text-emerald-700"
                  : configured
                    ? "bg-amber-500/10 text-amber-700"
                    : "bg-slate-500/10 text-slate-700"
              }`}
            >
              {connected ? "Online" : configured ? "Pendente" : "Local"}
            </div>
          </div>
          <DrawerDescription className="text-[14px] text-muted-foreground">
            Gerencie o gateway de integração do Bling ERP e atualize os produtos.
          </DrawerDescription>
        </DrawerHeader>

        <section className="mt-2 space-y-4" aria-label="Conexão Bling">
          {/* Main Status Card */}
          <div className="ios-card divide-y divide-black/[0.06] overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <div
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  connected
                    ? "bg-emerald-500/15 text-emerald-600"
                    : configured
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {connected ? (
                  <CheckCircle2 className="size-5" />
                ) : configured ? (
                  <Radio className="size-5 animate-pulse" />
                ) : (
                  <Unplug className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-foreground">
                  {connected
                    ? "Conectado ao Bling ERP"
                    : configured
                      ? "Aguardando autorização no Bling"
                      : "Modo Local Ativo"}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {connected
                    ? "Produtos e alterações são sincronizados diretamente."
                    : configured
                      ? "Autorize o aplicativo no Bling para iniciar."
                      : "Dados salvos com segurança na memória deste celular."}
                </p>
              </div>
            </div>

            {configured && (
              <div className="flex items-center justify-between p-3.5 bg-secondary/30 text-[13px]">
                <span className="text-muted-foreground">Gateway:</span>
                <span className="font-mono text-[12px] truncate max-w-[240px] text-foreground">
                  {url || "Padrão"}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {!configured ? (
              <div className="space-y-2 pt-1">
                <label className="text-[13px] font-medium text-foreground block">
                  URL do Gateway de Integração
                </label>
                <div className="flex gap-2">
                  <input
                    aria-label="URL do Gateway"
                    placeholder="https://seu-gateway..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-11 flex-1 rounded-xl border border-black/10 bg-card px-3.5 text-[15px] outline-none placeholder:text-tertiary focus:border-primary"
                  />
                  <button
                    disabled={busy || !url.trim()}
                    className="ios-btn-primary h-11 px-4 text-[14px]"
                    onClick={() =>
                      void run(async () => {
                        setGatewayUrl(url);
                        setConfigured(true);
                        qc.clear();
                        toast.success("Gateway configurado com sucesso");
                      })
                    }
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                {!connected && (
                  <button
                    disabled={busy}
                    className="ios-btn-primary h-12 w-full text-[15px]"
                    onClick={() =>
                      void run(async () => {
                        const authorization = await startConnection();
                        setPairing(true);
                        window.location.assign(authorization);
                      })
                    }
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                    Conectar ao Bling
                  </button>
                )}

                {!connected && pairing && (
                  <button
                    disabled={busy}
                    className="ios-btn-primary h-12 w-full bg-emerald-600 hover:bg-emerald-700 text-[15px]"
                    onClick={() =>
                      void run(async () => {
                        await finishConnection();
                        setConnected(true);
                        setPairing(false);
                        qc.clear();
                        toast.success("Conexão com Bling finalizada!");
                        setOpen(false);
                      })
                    }
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Já autorizei no Bling · Concluir
                  </button>
                )}

                {connected && (
                  <button
                    disabled={busy}
                    className="ios-btn-tinted h-12 w-full text-[15px]"
                    onClick={() => {
                      void qc.invalidateQueries({ queryKey: ["products"] });
                      toast.success("Atualizando lista de produtos...");
                    }}
                  >
                    <RefreshCw className="size-4" />
                    Atualizar Catálogo do Bling
                  </button>
                )}

                <div className="flex gap-2 pt-1">
                  {connected && (
                    <button
                      disabled={busy}
                      className="ios-btn flex-1 bg-destructive/10 text-destructive text-[14px] h-10 hover:bg-destructive/15"
                      onClick={() =>
                        void run(async () => {
                          await disconnect();
                          setConnected(false);
                          qc.clear();
                          toast.info("Desconectado do Bling");
                        })
                      }
                    >
                      Desconectar
                    </button>
                  )}
                  <button
                    disabled={busy}
                    className="ios-btn flex-1 bg-secondary text-foreground text-[14px] h-10 hover:bg-secondary/80"
                    onClick={() => setConfigured(false)}
                  >
                    Alterar Gateway
                  </button>
                </div>
              </div>
            )}
          </div>

          {pairing && !connected && (
            <div className="rounded-xl bg-amber-500/10 p-3 text-[13px] text-amber-900 border border-amber-500/20">
              Após autorizar no Bling, retorne a esta tela e toque no botão verde acima para concluir
              a vinculação.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-[13px] text-destructive border border-destructive/20"
            >
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>
      </DrawerContent>
    </Drawer>
  );
}

