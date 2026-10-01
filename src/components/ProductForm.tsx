import { useRef, useState, type ReactNode } from "react";
import { Camera, ScanLine, Sparkles, Wand2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { BarcodeScanner } from "./BarcodeScanner";
import { generateSku, isValidGtin, missingFields } from "@/lib/products/helpers";
import type { ProductDraft } from "@/lib/products/types";

interface Props {
  initial: ProductDraft;
  saving: boolean;
  submitLabel: string;
  onSubmit: (d: ProductDraft) => void;
}

type NumKey = "price" | "cost" | "stock" | "weightKg" | "widthCm" | "heightCm" | "depthCm";
type TextKey = "name" | "sku" | "gtin" | "ncm" | "category" | "unit" | "brand" | "description";

export function ProductForm({ initial, saving, submitLabel, onSubmit }: Props) {
  const [d, setD] = useState<ProductDraft>(initial);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setText = (k: TextKey, v: string) =>
    setD((p) => ({ ...p, [k]: v, origins: { ...p.origins, [k]: "confirmed" } }));
  const setNum = (k: NumKey, v: string) =>
    setD((p) => ({ ...p, [k]: v === "" ? null : Number(v.replace(",", ".")), origins: { ...p.origins, [k]: "confirmed" } }));

  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          const s = Math.min(1, 1200 / Math.max(img.width, img.height));
          c.width = img.width * s; c.height = img.height * s;
          c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
          const url = c.toDataURL("image/jpeg", 0.82);
          setD((p) => ({ ...p, images: [...p.images, url] }));
        };
        img.src = r.result as string;
      };
      r.readAsDataURL(f);
    });
  };

  const gtinOk = d.gtin === "" || isValidGtin(d.gtin);
  const missing = missingFields(d);

  return (
    <form
      className="pb-32"
      onSubmit={(e) => { e.preventDefault(); onSubmit(d); }}
    >
      {/* Photos */}
      <div className="flex gap-3 overflow-x-auto px-4 pt-2 pb-1">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="grid size-24 shrink-0 place-items-center rounded-lg border-2 border-dashed border-primary/40 bg-card text-primary">
          <span className="flex flex-col items-center gap-1 text-[13px] font-medium"><Camera className="size-6" />Foto</span>
        </button>
        {d.images.map((src, i) => (
          <div key={i} className="relative size-24 shrink-0">
            <img src={src} alt="" className="size-full rounded-lg object-cover" />
            <button type="button" aria-label="Remover foto"
              onClick={() => setD((p) => ({ ...p, images: p.images.filter((_, j) => j !== i) }))}
              className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-foreground text-card"><X className="size-3.5" /></button>
          </div>
        ))}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onPhotos(e.target.files)} />
      </div>

      {/* Barcode – primary quick action */}
      <div className="px-4 pt-4">
        <button type="button" onClick={() => setScanning(true)} className="ios-btn-tinted w-full">
          <ScanLine className="size-5" /> {d.gtin ? "Escanear novamente" : "Escanear código de barras"}
        </button>
      </div>

      <div className="ios-section-label">Identificação</div>
      <div className="ios-list mx-4">
        <Row label="Nome" origin={d.origins.name}>
          <input className="ios-field" placeholder="Obrigatório" value={d.name} onChange={(e) => setText("name", e.target.value)} />
        </Row>
        <Row label="GTIN/EAN" origin={d.origins.gtin}>
          <input className={`ios-field ${gtinOk ? "" : "text-destructive"}`} inputMode="numeric" placeholder="Digite ou escaneie"
            value={d.gtin} onChange={(e) => setText("gtin", e.target.value.replace(/\D/g, ""))} />
          <button type="button" aria-label="Ler código com a câmera" onClick={() => setScanning(true)}
            className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-primary active:bg-secondary">
            <ScanLine className="size-[22px]" />
          </button>
        </Row>
        <Row label="SKU" origin={d.origins.sku}>
          <input className="ios-field font-mono text-[16px]" placeholder="Obrigatório" value={d.sku} onChange={(e) => setText("sku", e.target.value.toUpperCase())} />
          <button type="button" aria-label="Gerar SKU" onClick={() => setText("sku", generateSku(d.name, d.category))}
            className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-primary active:bg-secondary">
            <Wand2 className="size-[20px]" />
          </button>
        </Row>
        <Row label="Marca"><input className="ios-field" value={d.brand} onChange={(e) => setText("brand", e.target.value)} /></Row>
        <Row label="Categoria"><input className="ios-field" value={d.category} onChange={(e) => setText("category", e.target.value)} /></Row>
      </div>
      {!gtinOk && <p className="px-8 pt-1.5 text-[13px] text-destructive">Dígito verificador inválido — confira o código.</p>}

      <div className="ios-section-label">Preço e estoque</div>
      <div className="ios-list mx-4">
        <NumRow label="Preço (R$)" value={d.price} onChange={(v) => setNum("price", v)} />
        <NumRow label="Custo (R$)" value={d.cost} onChange={(v) => setNum("cost", v)} />
        <NumRow label="Estoque" value={d.stock} onChange={(v) => setNum("stock", v)} int />
        <Row label="Unidade"><input className="ios-field" value={d.unit} onChange={(e) => setText("unit", e.target.value.toUpperCase())} /></Row>
      </div>

      <div className="ios-section-label">Fiscal</div>
      <div className="ios-list mx-4">
        <Row label="NCM" origin={d.origins.ncm}>
          <input className="ios-field" inputMode="numeric" placeholder="8 dígitos" maxLength={8} value={d.ncm} onChange={(e) => setText("ncm", e.target.value.replace(/\D/g, ""))} />
        </Row>
      </div>

      <div className="ios-section-label">Peso e dimensões</div>
      <div className="ios-list mx-4">
        <NumRow label="Peso (kg)" value={d.weightKg} onChange={(v) => setNum("weightKg", v)} />
        <NumRow label="Largura (cm)" value={d.widthCm} onChange={(v) => setNum("widthCm", v)} />
        <NumRow label="Altura (cm)" value={d.heightCm} onChange={(v) => setNum("heightCm", v)} />
        <NumRow label="Profundidade (cm)" value={d.depthCm} onChange={(v) => setNum("depthCm", v)} />
      </div>

      <div className="ios-section-label">Descrição</div>
      <div className="ios-list mx-4">
        <textarea rows={4} className="w-full resize-none bg-transparent px-4 py-3 outline-none placeholder:text-tertiary" placeholder="Descrição do produto"
          value={d.description} onChange={(e) => setText("description", e.target.value)} />
      </div>

      {/* Sticky footer */}
      <div className="ios-glass fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="mx-auto max-w-xl">
          <p className={`mb-2 flex items-center gap-1.5 text-[13px] ${missing.length ? "text-warning" : "text-success"}`}>
            {missing.length ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {missing.length ? `Pendente: ${missing.join(", ")}` : "Cadastro completo"}
          </p>
          <button type="submit" disabled={saving || !d.name.trim()} className="ios-btn-primary w-full">{saving ? "Salvando…" : submitLabel}</button>
        </div>
      </div>

      <BarcodeScanner
        open={scanning}
        onClose={() => setScanning(false)}
        onDetected={(code) => { setScanning(false); setD((p) => ({ ...p, gtin: code, origins: { ...p.origins, gtin: "confirmed" } })); }}
        title="Ler GTIN/EAN"
      />
    </form>
  );
}

function Row({ label, origin, children }: { label: string; origin?: "confirmed" | "suggested"; children: ReactNode }) {
  return (
    <label className="ios-row">
      <span className="flex shrink-0 items-center gap-1">
        {label}
        {origin === "suggested" && <Sparkles className="size-3.5 text-ai" aria-label="Sugerido por IA" />}
      </span>
      {children}
    </label>
  );
}

function NumRow({ label, value, onChange, int }: { label: string; value: number | null; onChange: (v: string) => void; int?: boolean }) {
  return (
    <Row label={label}>
      <input className="ios-field" inputMode={int ? "numeric" : "decimal"} placeholder="—"
        value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </Row>
  );
}
