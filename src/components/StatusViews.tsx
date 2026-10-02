import { WifiOff, AlertTriangle, SearchX, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { toRepoError } from "@/lib/products/errors";
import { useOnline } from "@/hooks/use-online";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-[13px] font-semibold text-amber-950 shadow-xs"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>Modo Offline — sem conexão à internet. Alterações serão salvas localmente.</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = toRepoError(error);
  const Icon = e.code === "offline" ? WifiOff : e.code === "not_found" ? SearchX : AlertTriangle;
  return (
    <EmptyState icon={<Icon className="size-10 text-primary" />} title={e.message}>
      {onRetry && e.code !== "not_found" && (
        <button type="button" onClick={onRetry} className="ios-btn-tinted h-11 text-[15px] gap-2 mt-2">
          <RotateCcw className="size-4" />
          <span>Tentar Novamente</span>
        </button>
      )}
    </EmptyState>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="ios-card flex flex-col items-center gap-3.5 px-6 py-16 text-center mx-4 my-6">
      <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-[17px] font-semibold tracking-tight text-foreground">{title}</p>
      {children}
    </div>
  );
}

