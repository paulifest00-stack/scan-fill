import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Search, ScanLine, Plus, ChevronRight, Package, CircleAlert } from "lucide-react";
import { repo } from "@/lib/products/repository";
import { brl } from "@/lib/products/helpers";
import { productListQuery } from "@/lib/products/queries";
import { ErrorState, OfflineBanner } from "@/components/StatusViews";
import { friendlyMessage } from "@/lib/products/errors";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Produtos — Paulifest Catálogo" },
      { name: "description", content: "Pesquise, escaneie e edite os produtos da Paulifest pelo celular." },
      { property: "og:title", content: "Produtos — Paulifest Catálogo" },
      { property: "og:description", content: "Pesquise, escaneie e edite os produtos da Paulifest pelo celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [q, setQ] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();
  const [scanError, setScanError] = useState<string | null>(null);
  const { data, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(productListQuery({ query: q, incompleteOnly: onlyIncomplete }));
  const list = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const onDetected = useCallback(async (code: string) => {
    setScanning(false);
    setScanError(null);
    try {
    const found = await repo.findByCode(code);
    if (found) navigate({ to: "/produto/$id", params: { id: found.id } });
    else navigate({ to: "/novo", search: { gtin: code } });
    } catch (e) { setScanError(friendlyMessage(e)); }
  }, [navigate]);

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-28">
      <header className="ios-glass sticky top-0 z-20 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <OfflineBanner />
        <p className="text-[13px] text-muted-foreground">Modo local · ainda sem conexão com o Bling</p>
        <h1 className="pt-2 text-[34px] font-bold leading-tight tracking-tight">Produtos</h1>
        <div className="mt-2 flex gap-2">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-md bg-secondary px-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, SKU ou EAN"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
          </div>
          <button aria-label="Escanear código de barras" onClick={() => setScanning(true)}
            className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground active:opacity-80">
            <ScanLine className="size-5" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 rounded-md bg-secondary p-0.5 text-[13px] font-medium">
          {[false, true].map((v) => (
            <button key={String(v)} onClick={() => setOnlyIncomplete(v)}
              className={`h-8 rounded-[7px] transition ${onlyIncomplete === v ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              {v ? "Incompletos" : "Todos"}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 pt-3">
        {scanError && <p role="alert" className="mb-3 text-destructive">{scanError}</p>}
        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : isLoading ? (
          <div className="ios-list">{[0, 1, 2, 3].map((i) => (
            <div key={i} className="ios-row"><div className="skeleton size-12" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/3" /></div></div>
          ))}</div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
            <Package className="size-12 text-tertiary" />
            <p className="text-[17px]">{q ? `Nada encontrado para “${q}”` : "Nenhum produto"}</p>
            <Link to="/novo" search={{ gtin: /^\d{8,14}$/.test(q) ? q : undefined }} className="ios-btn-tinted h-11 text-[15px]">Cadastrar novo</Link>
          </div>
        ) : (
          <div className="ios-list">
            {list.map((p) => {
              const miss = p.missingCount;
              return (
                <Link key={p.id} to="/produto/$id" params={{ id: p.id }} className="ios-row active:bg-secondary">
                  {p.thumbnail
                    ? <img src={p.thumbnail} alt="" className="size-12 shrink-0 rounded-sm object-cover" />
                    : <div className="grid size-12 shrink-0 place-items-center rounded-sm bg-secondary"><Package className="size-5 text-tertiary" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-medium">{p.name}</p>
                    <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <span className="font-mono">{p.sku || "sem SKU"}</span>·<span>{brl(p.price)}</span>
                      {p.syncStatus === "pending" && <span className="text-warning">· pendente</span>}
                    </p>
                  </div>
                  {miss > 0 && <span className="flex items-center gap-0.5 text-[13px] text-warning"><CircleAlert className="size-4" />{miss}</span>}
                  <ChevronRight className="size-5 text-tertiary" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {hasNextPage && <button className="ios-btn-tinted mx-auto mt-4 flex" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>{isFetchingNextPage ? "Carregando…" : "Carregar mais"}</button>}

      <Link to="/novo" search={{}} aria-label="Novo produto"
        className="fixed right-5 bottom-[max(env(safe-area-inset-bottom),20px)] z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95">
        <Plus className="size-7" />
      </Link>

      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={onDetected} title="Buscar por código" />
    </div>
  );
}
