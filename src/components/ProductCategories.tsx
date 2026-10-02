import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/products/repository";
import { suggestCategories, shopeeMissing, type CategoryOption } from "@/lib/products/categories";
import { toRepoError } from "@/lib/products/errors";
import type { ProductInput } from "@/lib/products/types";

export function ProductCategories({
  product,
  categories,
  onSelect,
}: {
  product: ProductInput;
  categories: CategoryOption[];
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const stores = useQuery({
    queryKey: ["bling", "stores"],
    queryFn: () => repo.stores!(),
    staleTime: 60000,
    retry: false,
  });
  const [selectedStore, setStore] = useState("");
  const storeId =
    selectedStore ||
    stores.data?.find((s) => s.type.toLowerCase() === "shopee")?.id ||
    stores.data?.[0]?.id ||
    "";
  const store = stores.data?.find((s) => s.id === storeId);
  const links = useQuery({
    queryKey: ["bling", "category-links", storeId],
    queryFn: () => repo.categoryLinks!(storeId),
    enabled: !!storeId,
    staleTime: 60000,
    retry: false,
  });
  const suggestions = suggestCategories(product.name, categories);
  const linked = links.data?.filter((l) => l.categoryId === product.category) ?? [];
  const linkedSuggestions = suggestCategories(
    product.name,
    links.data?.map((l) => ({ id: l.categoryId, name: l.name })) ?? [],
  );
  const [browsing, setBrowsing] = useState(false);
  const [path, setPath] = useState<CategoryOption[]>([]);
  const parent = path.at(-1)?.id;
  const tree = useQuery({
    queryKey: ["bling", "tree", storeId, parent],
    queryFn: () => repo.marketplaceCategories!(storeId, parent),
    enabled: browsing && !!storeId,
    retry: false,
    staleTime: 60000,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setPath([]);
    setBrowsing(false);
    setError("");
  }, [storeId]);
  const missing = shopeeMissing(product);
  return (
    <div className="mx-4 mt-3 rounded-xl bg-card p-3 text-sm">
      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 font-medium">Sugestões pelo nome</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                className="rounded-lg bg-primary/10 px-3 py-2 text-primary"
                onClick={() => onSelect(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Confira a sugestão. A categoria atual só muda quando você escolhe.
          </p>
        </div>
      )}
      <div className="mt-3">
        <label className="font-medium" htmlFor="category-store">
          Categoria na loja
        </label>
        <select
          id="category-store"
          className="ios-field mt-1 w-full"
          value={storeId}
          onChange={(e) => setStore(e.target.value)}
        >
          {!stores.data?.length && (
            <option value="">
              {stores.isLoading ? "Carregando lojas…" : "Nenhuma loja disponível"}
            </option>
          )}
          {stores.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.type}
            </option>
          ))}
        </select>
        {(stores.error || links.error) && (
          <p role="alert" className="mt-2 text-destructive">
            {toRepoError(stores.error ?? links.error).message}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                void stores.refetch();
                void links.refetch();
              }}
            >
              Tentar novamente
            </button>
          </p>
        )}
        {links.isLoading && <p className="mt-2 text-muted-foreground">Consultando vínculos…</p>}
        {linked.length > 0 ? (
          <p className="mt-2">
            Vinculada: <strong>{linked.map((l) => l.name).join(", ")}</strong>
            <span className="block text-xs text-muted-foreground">
              Vínculo existente no Bling. Atributos e vigência da categoria ainda precisam ser
              conferidos na loja.
            </span>
          </p>
        ) : (
          !!storeId &&
          !links.isLoading &&
          !links.error && (
            <p className="mt-2 text-amber-700">
              {product.category
                ? "Esta categoria interna ainda não está vinculada à loja."
                : "Escolha uma categoria interna para vincular à loja."}
            </p>
          )
        )}
        {linkedSuggestions.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">
              Categorias já vinculadas que combinam com o nome:
            </p>
            {linkedSuggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                className="mt-1 block text-left text-primary underline"
                onClick={() => onSelect(c.id)}
              >
                {categories.find((x) => x.id === c.id)?.name ?? c.name} → {c.name}
              </button>
            ))}
          </div>
        )}
        {!browsing && !!storeId && !linked.length && (
          <button
            type="button"
            className="ios-btn-tinted mt-3 w-full"
            disabled={!product.category || !!links.error || links.isLoading}
            onClick={() => {
              setPath([]);
              setBrowsing(true);
            }}
          >
            Vincular categoria da loja
          </button>
        )}
        {browsing && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">Selecione até o último nível.</p>
            <p className="my-2 font-medium">
              {path.map((c) => c.name).join(" › ") || "Categorias da loja"}
            </p>
            {path.length > 0 && (
              <button
                type="button"
                className="mb-2 text-primary underline"
                onClick={() => setPath((p) => p.slice(0, -1))}
              >
                Voltar um nível
              </button>
            )}
            {tree.isLoading && <p>Carregando categorias…</p>}
            {tree.error && (
              <p role="alert" className="text-destructive">
                {toRepoError(tree.error).message} O Bling pode não disponibilizar a árvore para esta
                integração; nesse caso, faça o primeiro vínculo em Categorias de Produtos no Bling e
                atualize aqui.
              </p>
            )}
            {tree.data?.map((c) => (
              <button
                key={c.id}
                type="button"
                className="mb-1 block w-full rounded-lg border p-2 text-left"
                onClick={() => setPath((p) => [...p, c])}
              >
                {c.name} ›
              </button>
            ))}
            {path.length > 0 && tree.data?.length === 0 && !tree.isFetching && (
              <button
                type="button"
                className="ios-btn-tinted w-full"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Vincular “${categories.find((c) => c.id === product.category)?.name}” a “${path.map((c) => c.name).join(" › ")}” em ${store?.name}? Esse vínculo vale para todos os produtos dessa categoria interna.`,
                    )
                  )
                    return;
                  setBusy(true);
                  setError("");
                  try {
                    await repo.linkCategory!(
                      storeId,
                      product.category,
                      path.map((c) => c.id),
                    );
                    await qc.invalidateQueries({ queryKey: ["bling", "category-links", storeId] });
                    setBrowsing(false);
                  } catch (e) {
                    setError(toRepoError(e).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Vinculando…" : "Confirmar vínculo da categoria"}
              </button>
            )}
            {error && (
              <p role="alert" className="mt-2 text-destructive">
                {error}
              </p>
            )}
            <button
              type="button"
              className="mt-2 text-muted-foreground underline"
              onClick={() => setBrowsing(false)}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
      {store?.type.toLowerCase() === "shopee" && (
        <details className="mt-3 border-t pt-2">
          <summary className="cursor-pointer">
            Revisão Shopee ·{" "}
            {missing.length ? `${missing.length} pendência(s)` : "dados gerais preenchidos"}
          </summary>
          <p className="mt-2 text-xs">
            {missing.length
              ? missing.join(" · ")
              : "Nome, SKU, preço, foto, descrição, peso e dimensões preenchidos."}{" "}
            {!linked.length && "Falta o vínculo da categoria."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Confira também os atributos obrigatórios da categoria no Bling. Esta revisão não garante
            a aprovação da Shopee.
          </p>
        </details>
      )}
    </div>
  );
}
