import { WifiOff, AlertTriangle, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { toRepoError } from "@/lib/products/errors";
import { useOnline } from "@/hooks/use-online";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-[13px] font-medium text-card">
      <WifiOff className="size-4" /> Sem conexão — alterações não podem ser salvas agora
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = toRepoError(error);
  const Icon = e.code === "offline" ? WifiOff : e.code === "not_found" ? SearchX : AlertTriangle;
  return (
    <EmptyState icon={<Icon className="size-12 text-tertiary" />} title={e.message}>
      {onRetry && e.code !== "not_found" && (
        <button onClick={onRetry} className="ios-btn-tinted h-11 text-[15px]">Tentar novamente</button>
      )}
    </EmptyState>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-20 text-center text-muted-foreground">
      {icon}
      <p className="text-[17px]">{title}</p>
      {children}
    </div>
  );
}
