import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  ScanLine,
  Plus,
  ChevronRight,
  Package,
  AlertCircle,
  X,
  Sparkles,
  Barcode,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { BlingConnection } from "@/components/BlingConnection";
import { repo } from "@/lib/products/repository";
import { brl } from "@/lib/products/helpers";
import { productListQuery } from "@/lib/products/queries";
import { ErrorState, OfflineBanner } from "@/components/StatusViews";
import { friendlyMessage } from "@/lib/products/errors";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Produtos — Paulifest Catálogo" },
      {
        name: "description",
        content: "Pesquise, escaneie e edite os produtos da Paulifest pelo celular.",
      },
      { property: "og:title", content: "Produtos — Paulifest Catálogo" },
      {
        property: "og:description",
        content: "Pesquise, escaneie e edite os produtos da Paulifest pelo celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();
  const [scanError, setScanError] = useState<string | null>(null);

  const { data, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery(productListQuery({ query, incompleteOnly: onlyIncomplete }));
  const list = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const incompleteCount = useMemo(() => {
    return list.filter((p) => p.missingCount > 0).length;
  }, [list]);

  const onDetected = useCallback(
    async (code: string) => {
      setScanning(false);
      setScanError(null);
      toast.info(`Código lido: ${code}`);
      try {
        const found = await repo.findByCode(code);
        if (found) {
          navigate({ to: "/produto/$id", params: { id: found.id } });
        } else {
          toast("Produto novo", {
            description: "Código não encontrado. Abrindo cadastro.",
          });
          navigate({ to: "/novo", search: { gtin: code } });
        }
      } catch (e) {
        setScanError(friendlyMessage(e));
        toast.error("Erro na busca por código");
      }
    },
    [navigate],
  );

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-36">
      {/* Sticky iOS Liquid Glass Header */}
      <header className="ios-glass sticky top-0 z-20 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 select-none">
        <OfflineBanner />

        {/* Top App Bar with Branding & Bling Pill */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold tracking-wide text-foreground/70 uppercase">
              Paulifest
            </span>
            <span className="size-1 rounded-full bg-primary/40" />
            <span className="text-[13px] text-muted-foreground">Catálogo</span>
          </div>
          <BlingConnection />
        </div>

        {/* Large Title */}
        <div className="flex items-baseline justify-between pt-1">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-foreground">
            Produtos
          </h1>
          <span className="text-[13px] font-medium text-muted-foreground">
            {isLoading ? "Carregando…" : `${list.length} item(s)`}
          </span>
        </div>

        {/* Apple-style Search Bar */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="relative flex h-10 flex-1 items-center rounded-xl bg-black/[0.05] px-3 transition focus-within:bg-black/[0.08] focus-within:ring-2 focus-within:ring-primary/30">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, SKU ou código"
              className="ml-2 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setQ("")}
                className="grid size-6 place-items-center rounded-full bg-muted-foreground/20 text-foreground/70 active:opacity-70"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-label="Escanear código de barras"
            onClick={() => setScanning(true)}
            className="ios-press grid size-10 place-items-center rounded-xl bg-primary text-white shadow-xs active:scale-95"
          >
            <ScanLine className="size-5" />
          </button>
        </div>

        {/* iOS 18 Segmented Control */}
        <div className="mt-3 grid grid-cols-2 rounded-xl bg-black/[0.06] p-1 text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => setOnlyIncomplete(false)}
            className={`flex h-7 items-center justify-center gap-1.5 rounded-[9px] transition-all ${
              !onlyIncomplete
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Todos</span>
            <span className="rounded-full bg-black/[0.06] px-1.5 py-0.2 text-[11px] font-medium text-foreground/70">
              {list.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOnlyIncomplete(true)}
            className={`flex h-7 items-center justify-center gap-1.5 rounded-[9px] transition-all ${
              onlyIncomplete
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Incompletos</span>
            {incompleteCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[11px] font-semibold text-amber-800">
                {incompleteCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="px-4 pt-4">
        {scanError && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-[14px] text-destructive border border-destructive/20"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}

        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="ios-list divide-y divide-black/[0.05]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="ios-row">
                <div className="skeleton size-13 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="skeleton h-4 w-4/5 rounded-md" />
                  <div className="skeleton h-3.5 w-1/2 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="ios-card flex flex-col items-center gap-3.5 px-6 py-16 text-center">
            <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Package className="size-8" />
            </div>
            <div>
              <p className="text-[17px] font-semibold text-foreground">
                {q ? `Nenhum resultado para “${q}”` : "Nenhum produto cadastrado"}
              </p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                {q
                  ? "Tente verificar a digitação ou cadastrar um novo produto com esse termo."
                  : "Comece escaneando uma embalagem ou digitando os dados manualmente."}
              </p>
            </div>
            <Link
              to="/novo"
              search={{ gtin: /^\d{8,14}$/.test(q) ? q : undefined }}
              className="ios-btn-primary mt-2 h-11 text-[15px]"
            >
              <Plus className="size-4" />
              <span>Cadastrar Novo Produto</span>
            </Link>
          </div>
        ) : (
          <div className="ios-list divide-y divide-black/[0.05]">
            {list.map((p) => {
              const miss = p.missingCount;
              return (
                <Link
                  key={p.id}
                  to="/produto/$id"
                  params={{ id: p.id }}
                  className="ios-row group active:bg-secondary/60 cursor-pointer"
                >
                  {/* Thumbnail / Visual Avatar */}
                  {p.thumbnail ? (
                    <img
                      src={p.thumbnail}
                      alt={p.name}
                      className="size-13 shrink-0 rounded-xl object-cover border border-black/[0.06] shadow-2xs"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid size-13 shrink-0 place-items-center rounded-xl bg-secondary/80 border border-black/[0.05] text-muted-foreground">
                      <Package className="size-6 text-tertiary" />
                    </div>
                  )}

                  {/* Product Details */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold tracking-tight text-foreground">
                      {p.name}
                    </p>

                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px]">
                      {p.sku ? (
                        <span className="font-mono text-[11px] font-semibold bg-black/[0.05] text-foreground/80 px-1.5 py-0.5 rounded-md">
                          {p.sku}
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground italic">sem SKU</span>
                      )}

                      <span className="text-tertiary">·</span>

                      <span className="font-semibold text-foreground text-[14px]">
                        {brl(p.price)}
                      </span>

                      {p.stock !== null && (
                        <>
                          <span className="text-tertiary">·</span>
                          <span className="text-muted-foreground text-[12px]">
                            {p.stock} un
                          </span>
                        </>
                      )}

                      {p.syncStatus === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.2 text-[11px] font-semibold text-amber-700">
                          pendente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Incomplete warning tag */}
                  {miss > 0 && (
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-[12px] font-semibold text-amber-800">
                      <AlertCircle className="size-3.5" />
                      <span>{miss}</span>
                    </div>
                  )}

                  <ChevronRight className="size-5 shrink-0 text-tertiary group-active:text-foreground transition-colors" />
                </Link>
              );
            })}
          </div>
        )}

        {hasNextPage && (
          <div className="pt-4 pb-2 text-center">
            <button
              type="button"
              className="ios-btn-tinted h-11 text-[15px]"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? "Carregando mais produtos…" : "Carregar Mais"}
            </button>
          </div>
        )}
      </main>

      {/* Floating Apple-style Bottom Action Dock */}
      <aside
        className="ios-glass-dock fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)] select-none"
        aria-label="Ações rápidas"
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-[13px] text-muted-foreground font-medium pl-1">
            <Layers className="size-4 text-primary" />
            <span>{list.length} no catálogo</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="ios-btn-tinted h-11 px-4 text-[14px] font-semibold gap-1.5 shadow-xs"
            >
              <ScanLine className="size-4" />
              <span>Escanear</span>
            </button>

            <Link
              to="/novo"
              search={{}}
              className="ios-btn-primary h-11 px-4 text-[14px] font-semibold gap-1.5 shadow-md"
            >
              <Plus className="size-4" />
              <span>Novo Produto</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Fullscreen Barcode Scanner Modal */}
      <BarcodeScanner
        open={scanning}
        onClose={() => setScanning(false)}
        onDetected={onDetected}
        title="Buscar por código"
      />
    </div>
  );
}

