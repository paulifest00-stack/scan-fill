import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { repo } from "@/lib/products/repository";
import { emptyDraft } from "@/lib/products/types";
import { ProductForm } from "@/components/ProductForm";
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
  const base = useQuery({ queryKey: ["product", from], queryFn: () => repo.get(from!), enabled: !!from });
  const save = useMutation({
    mutationFn: repo.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); navigate({ to: "/" }); },
  });

  if (from && base.isLoading) return <NavBar title="Duplicar" />;

  const initial = base.data
    ? { ...base.data, remoteId: undefined, sku: "", gtin: "", images: [], name: `${base.data.name} (cópia)` }
    : { ...emptyDraft(), gtin: gtin ?? "", origins: gtin ? { gtin: "confirmed" as const } : {} };

  return (
    <div className="mx-auto min-h-screen max-w-xl">
      <NavBar title={from ? "Duplicar produto" : "Novo produto"} />
      <ProductForm key={from ?? gtin ?? "new"} initial={initial} saving={save.isPending} submitLabel="Cadastrar produto" onSubmit={(d) => save.mutate(d)} />
    </div>
  );
}
