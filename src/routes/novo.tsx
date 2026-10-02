import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { repo } from "@/lib/products/repository";
import { emptyInput, toInput } from "@/lib/products/types";
import { ProductForm } from "@/components/ProductForm";
import { productQuery, productKeys } from "@/lib/products/queries";
import { ErrorState, OfflineBanner } from "@/components/StatusViews";
import { NavBar } from "@/components/NavBar";

export const Route = createFileRoute("/novo")({
  validateSearch: z.object({ gtin: z.string().optional(), from: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Novo produto — Paulifest Catálogo" },
      { name: "description", content: "Cadastre um produto com foto e leitura de código de barras." },
      { property: "og:title", content: "Novo produto — Paulifest Catálogo" },
      { property: "og:description", content: "Cadastre um produto com foto e leitura de código de barras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewProduct,
});

function NewProduct() {
  const { gtin, from } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = useQuery({ ...productQuery(from ?? ""), enabled: !!from });
  const save = useMutation({ mutationFn: (input: Parameters<typeof repo.create>[0]) => repo.create(input) });
  if (from && base.isLoading) return <NavBar title="Duplicar" />;
  if (from && base.error) return <><NavBar title="Duplicar" /><ErrorState error={base.error} onRetry={() => void base.refetch()} /></>;
  const initial = base.data
    ? { ...toInput(base.data), version: undefined, sku: "", gtin: "", gtinPackage: "", images: [], origins: {}, name: `${base.data.name} (cópia)` }
    : { ...emptyInput(), gtin: gtin ?? "", origins: gtin ? { gtin: "confirmed" as const } : {} };
  return (
    <div className="mx-auto min-h-screen max-w-xl">
      <NavBar title={from ? "Duplicar produto" : "Novo produto"} />
      <OfflineBanner />
      <ProductForm key={from ?? gtin ?? "new"} initial={initial} submitLabel="Cadastrar no aparelho" onSubmit={async (d) => {
        await save.mutateAsync(d);
        await qc.invalidateQueries({ queryKey: productKeys.all });
      }} onSaved={() => { void navigate({ to: "/" }); }} />
    </div>
  );
}
