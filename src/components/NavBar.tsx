import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function NavBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="ios-glass sticky top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center px-2 pt-[max(env(safe-area-inset-top),10px)] pb-2 select-none">
      <Link
        to="/"
        className="ios-press -ml-1 inline-flex h-10 items-center gap-0.5 text-[17px] font-normal text-primary hover:opacity-85"
      >
        <ChevronLeft className="size-6 -mr-1" strokeWidth={2.5} />
        <span>Produtos</span>
      </Link>
      <h1 className="max-w-[200px] truncate text-center text-[17px] font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <div className="flex items-center justify-end">{right}</div>
    </header>
  );
}

