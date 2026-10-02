import { useQuery } from "@tanstack/react-query";
import { repo } from "@/lib/products/repository";
import { toRepoError } from "@/lib/products/errors";
import type { ProductInput } from "@/lib/products/types";
export function ProductAttributes({
  product,
  onChange,
}: {
  product: ProductInput;
  onChange: (fields: NonNullable<ProductInput["customFields"]>) => void;
}) {
  const fields = useQuery({
    queryKey: ["bling", "category-fields", product.category],
    queryFn: () => repo.categoryFields!(product.category),
    enabled: !!product.category,
    staleTime: 60000,
    retry: false,
  });
  const change = (id: string, value: string, option = false) => {
    const existing = product.customFields ?? [];
    const next = { id, value: option ? "" : value, item: option ? value : "" };
    onChange([...existing.filter((f) => f.id !== id), next]);
  };
  if (!product.category) return null;
  return (
    <details className="ios-card mx-4 mt-3 p-4 text-[14px] group">
      <summary className="cursor-pointer font-semibold text-foreground flex items-center justify-between select-none">
        <span>Atributos da categoria {fields.data?.length ? `· ${fields.data.length}` : ""}</span>
        <span className="text-[12px] text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
      </summary>
      {fields.isLoading && <p className="mt-3 text-muted-foreground">Carregando campos do Bling…</p>}
      {fields.error && (
        <p role="alert" className="mt-2 text-destructive">
          {toRepoError(fields.error).message}{" "}
          <button type="button" className="underline font-semibold" onClick={() => void fields.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {fields.data?.length === 0 && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Nenhum campo customizado retornado para esta categoria. A loja pode exigir atributos ainda
          não configurados no Bling.
        </p>
      )}
      {fields.data?.map((f) => {
        const value = product.customFields?.find((v) => v.id === f.id);
        return (
          <label key={f.id} className="mt-3 block">
            <span className="text-[13px] font-medium text-foreground">
              {f.name}
              {f.required ? " *" : ""}
            </span>
            {f.options.length ? (
              <select
                className="ios-field mt-1 w-full rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-[15px] outline-none"
                value={value?.item || value?.value || ""}
                onChange={(e) => change(f.id, e.target.value, true)}
              >
                <option value="">Escolha</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="ios-field mt-1 w-full rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-[15px] outline-none"
                value={value?.value ?? ""}
                maxLength={5000}
                onChange={(e) => change(f.id, e.target.value)}
              />
            )}
          </label>
        );
      })}
      <p className="mt-3 text-[12px] text-muted-foreground border-t border-black/[0.06] pt-2">
        Campos configurados no Bling. Preencha os obrigatórios e confira o vínculo destes atributos
        com a Shopee antes de exportar.
      </p>
    </details>
  );
}
