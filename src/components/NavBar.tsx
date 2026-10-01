import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function NavBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="ios-glass sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center border-b px-2 pt-[max(env(safe-area-inset-top),8px)] pb-1">
      <Link to="/" className="flex h-11 items-center text-[17px] text-primary"><ChevronLeft className="size-7" />Produtos</Link>
      <h1 className="text-[17px] font-semibold">{title}</h1>
      <div className="flex justify-end">{right}</div>
    </header>
  );
}
