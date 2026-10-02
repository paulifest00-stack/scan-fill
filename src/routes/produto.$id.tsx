import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { repo, isRemote } from "@/lib/products/repository";
import { ProductForm } from "@/components/ProductForm";
import { productQuery, productKeys } from "@/lib/products/queries";
import { toInput } from "@/lib/products/types";
import { ErrorState, OfflineBanner } from "@/components/StatusViews";
import { NavBar } from "@/components/NavBar";

export const Route = createFileRoute("/produto/$id")({
  head: () => ({
    meta: [
      { title: "Editar produto — Paulifest Catálogo" },
      { name: "description", content: "Edite a ficha do produto e salve as alterações." },
      { property: "og:title", content: "Editar produto — Paulifest Catálogo" },
      { property: "og:description", content: "Edite a ficha do produto e salve as alterações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery(productQuery(id));
  const save = useMutation({
    mutationFn: (d: Parameters<typeof repo.update>[1]) => repo.update(id, d),
  });

  const dup = (
    <Link
      to="/novo"
      search={{ from: id }}
      aria-label="Duplicar"
      className="ios-press grid size-9 place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary/15 active:scale-90 transition-all"
    >
      <Copy className="size-4.5" />
    </Link>
  );

  return (
    <div className="mx-auto min-h-screen max-w-xl">
      <NavBar title="Editar Produto" right={data ? dup : undefined} />
      <OfflineBanner />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="space-y-4 p-4">
          <div className="skeleton h-24 w-24 rounded-2xl" />
          <div className="skeleton h-12 w-full rounded-2xl" />
          <div className="skeleton h-48 w-full rounded-2xl" />
        </div>
      ) : !data ? (
        <div className="p-12 text-center text-muted-foreground">
          <p className="text-[17px] font-semibold text-foreground">Produto não encontrado</p>
          <p className="mt-1 text-[14px]">O produto pode ter sido removido ou não sincronizado.</p>
        </div>
      ) : (
        <ProductForm
          key={`${data.id}:${data.version}`}
          selfId={id}
          initial={toInput(data)}
          submitLabel={isRemote() ? "Salvar no Bling" : "Salvar no aparelho"}
          onReload={() => {
            if (window.confirm("Recarregar e descartar suas alterações?")) void refetch();
          }}
          onSubmit={async (d) => {
            await save.mutateAsync(d);
            await qc.invalidateQueries({ queryKey: productKeys.all });
          }}
          onSaved={() => {
            void navigate({ to: "/" });
          }}
        />
      )}
    </div>
  );
}
