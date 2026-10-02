import { normalizeFiscalCode, normalizeFiscalInput } from "@/lib/products/fiscal";
import { ProductAttributes } from "./ProductAttributes";
import { ProductCategories } from "./ProductCategories";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import {
  Camera,
  ScanLine,
  Sparkles,
  Wand2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCw,
} from "lucide-react";
import { BarcodeScanner } from "./BarcodeScanner";
import { generateSku, isValidGtin, missingFields, parseDecimal } from "@/lib/products/helpers";
import { repo, isRemote } from "@/lib/products/repository";
import { toRepoError, RepoError } from "@/lib/products/errors";
import {
  analyzer,
  CRITICAL_FIELDS,
  sanitizeSuggestions,
  type FieldSuggestion,
} from "@/lib/products/analyzer";
import type { EditableField, ProductInput } from "@/lib/products/types";
import { compressImage } from "@/lib/image";

interface Props {
  initial: ProductInput;
  /** Id of the product being edited; used to ignore itself in duplicate checks. */
  selfId?: string | undefined;
  submitLabel: string;
  onSubmit: (d: ProductInput) => Promise<void>;
  onSaved?: (() => void) | undefined;
  onReload?: (() => void) | undefined;
}

type NumKey =
  "price" | "cost" | "stock" | "netWeightKg" | "grossWeightKg" | "widthCm" | "heightCm" | "depthCm";
type TextKey =
  | "name"
  | "sku"
  | "gtin"
  | "gtinPackage"
  | "ncm"
  | "cest"
  | "taxOrigin"
  | "category"
  | "unit"
  | "brand"
  | "description";

const LABELS: Partial<Record<EditableField, string>> = {
  name: "Nome",
  brand: "Marca",
  category: "Categoria",
  description: "Descrição",
  gtin: "GTIN/EAN",
  netWeightKg: "Peso líquido",
  grossWeightKg: "Peso bruto",
  ncm: "NCM",
  unit: "Unidade",
};

export function ProductForm({ initial, selfId, submitLabel, onSubmit, onReload, onSaved }: Props) {
  const categories = useQuery({
    queryKey: ["bling", "categories"],
    queryFn: () => repo.categories!(),
    enabled: isRemote(),
  });
  const [d, setD] = useState<ProductInput>(() => normalizeFiscalInput(initial));
  const [numText, setNumText] = useState<Partial<Record<NumKey, string>>>({});
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<RepoError | null>(null);
  const [gtinOwner, setGtinOwner] = useState<{ id: string; name: string } | null>(null);
  const [suggestions, setSuggestions] = useState<FieldSuggestion[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [descriptionBusy, setDescriptionBusy] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(normalizeFiscalInput(initial)), [d, initial]);
  useBlocker({
    shouldBlockFn: () =>
      dirty && !savedRef.current && !window.confirm("Descartar as alterações não salvas?"),
  });

  const touch = (k: EditableField) => (p: ProductInput) => ({
    ...p.origins,
    [k]: "confirmed" as const,
  });
  const setText = (k: TextKey, v: string) => {
    setSaveError(null);
    setD((p) => ({ ...p, [k]: v, origins: touch(k)(p) }));
  };
  const setNum = (k: NumKey, v: string) => {
    setSaveError(null);
    setNumText((t) => ({ ...t, [k]: v }));
    setD((p) => ({ ...p, [k]: parseDecimal(v), origins: touch(k)(p) }));
  };
  const numValue = (k: NumKey) =>
    numText[k] ?? (d[k] === null ? "" : String(d[k]).replace(".", ","));

  const checkGtinOwner = async (code: string) => {
    setGtinOwner(null);
    if (!code) return;
    try {
      const found = await repo.findByCode(code);
      if (found && found.id !== selfId) setGtinOwner({ id: found.id, name: found.name });
    } catch {
      /* checked again on save */
    }
  };

  const onScanned = (code: string) => {
    setScanning(false);
    setText("gtin", code.replace(/\D/g, ""));
    void checkGtinOwner(code);
  };

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    try {
      const urls = await Promise.all(Array.from(files).map((f) => compressImage(f)));
      setD((p) => ({ ...p, images: [...p.images, ...urls.map((url) => ({ url, local: true }))] }));
    } catch {
      setSaveError(
        new RepoError("validation", "Não foi possível abrir esta foto. Tente outra imagem."),
      );
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const raw = await analyzer.analyze(d.images.map((i) => i.url));
      setSuggestions(sanitizeSuggestions(raw, d));
    } catch {
      setSuggestions([]);
    } finally {
      setAnalyzing(false);
    }
  };

  const applySuggestion = (s: FieldSuggestion) => {
    setD((p) => ({ ...p, [s.field]: s.value, origins: { ...p.origins, [s.field]: "suggested" } }));
    setSuggestions((l) => l?.filter((x) => x !== s) ?? null);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      for (const [field, value] of Object.entries(numText)) {
        if (value.trim() && parseDecimal(value) === null)
          throw new RepoError(
            "validation",
            `Confira o valor numérico em ${field === "stock" ? "Estoque" : field === "cost" ? "Custo" : field === "price" ? "Preço" : "Peso/dimensões"}.`,
          );
      }
      await onSubmit(normalizeFiscalInput({ ...d, name: d.name.trim(), sku: d.sku.trim().toUpperCase() }));
      savedRef.current = true;
      onSaved?.();
    } catch (e) {
      setSaveError(toRepoError(e));
    } finally {
      setSaving(false);
    }
  };

  const gtinOk = d.gtin === "" || isValidGtin(d.gtin);
  const missing = missingFields(d);
  const pendingSuggested = (Object.entries(d.origins) as [EditableField, string][])
    .filter(([, o]) => o === "suggested")
    .map(([k]) => k);

  return (
    <form
      className="pb-40"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset disabled={saving} className="contents">
        {/* Photos */}
        <div className="flex gap-3 overflow-x-auto px-4 pt-3 pb-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            className="grid size-24 shrink-0 place-items-center rounded-lg border-2 border-dashed border-primary/40 bg-card text-primary active:opacity-70"
          >
            <span className="flex flex-col items-center gap-1 text-[13px] font-medium">
              {photoBusy ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Camera className="size-6" />
              )}
              Foto
            </span>
          </button>
          {d.images.map((img, i) => (
            <div key={img.url.slice(-40) + i} className="relative size-24 shrink-0">
              <img
                src={img.url}
                alt={`Foto ${i + 1}`}
                className="size-full rounded-lg object-cover"
              />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-foreground/70 px-1.5 text-[11px] text-card">
                  Capa
                </span>
              )}
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => setD((p) => ({ ...p, images: p.images.filter((_, j) => j !== i) }))}
                className="absolute -top-1.5 -right-1.5 grid size-7 place-items-center rounded-full bg-foreground text-card"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => void onPhotos(e.target.files)}
          />
        </div>

        {/* Quick actions */}
        <div className="grid gap-2 px-4 pt-4">
          <button type="button" onClick={() => setScanning(true)} className="ios-btn-tinted w-full">
            <ScanLine className="size-5" />{" "}
            {d.gtin ? "Escanear novamente" : "Escanear código de barras"}
          </button>
          {d.images.length > 0 && (
            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={analyzing || !analyzer.available}
              className="ios-btn h-11 w-full bg-ai/10 text-[15px] text-ai"
            >
              {analyzing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {analyzer.available
                ? "Sugerir dados pelas fotos"
                : "Sugestão por foto disponível após conectar a IA"}
            </button>
          )}
        </div>

        {suggestions && (
          <div className="mx-4 mt-3 rounded-md border border-ai/30 bg-card p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ai">
              <Sparkles className="size-4" />
              Sugestões — confira antes de usar
            </p>
            {suggestions.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Nada pôde ser lido com segurança.</p>
            ) : (
              suggestions.map((s) => (
                <div key={s.field} className="flex items-center gap-2 border-t py-2 first:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-muted-foreground">
                      {LABELS[s.field] ?? s.field} ·{" "}
                      {s.kind === "read" ? "lido na embalagem" : "inferido"}
                      {CRITICAL_FIELDS.has(s.field) ? " · confirme" : ""}
                    </p>
                    <p className="truncate text-[15px]">{String(s.value)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="h-9 rounded-full bg-ai/10 px-3 text-[15px] font-medium text-ai"
                  >
                    Usar
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="ios-section-label">Identificação</div>
        <div className="ios-list mx-4">
          <Row label="Nome" origin={d.origins.name}>
            <input
              className="ios-field"
              placeholder="Obrigatório"
              value={d.name}
              enterKeyHint="next"
              onChange={(e) => setText("name", e.target.value)}
            />
          </Row>
          <Row label="GTIN/EAN" origin={d.origins.gtin}>
            <input
              className={`ios-field ${gtinOk ? "" : "text-destructive"}`}
              inputMode="numeric"
              placeholder="Digite ou escaneie"
              value={d.gtin}
              onChange={(e) => setText("gtin", e.target.value.replace(/\D/g, ""))}
              onBlur={() => void checkGtinOwner(d.gtin)}
            />
            <IconBtn label="Ler código com a câmera" onClick={() => setScanning(true)}>
              <ScanLine className="size-[22px]" />
            </IconBtn>
          </Row>
          <Row label="SKU" origin={d.origins.sku}>
            <input
              className="ios-field font-mono text-[16px]"
              placeholder="Obrigatório"
              autoCapitalize="characters"
              value={d.sku}
              onChange={(e) => setText("sku", e.target.value.toUpperCase())}
            />
            <IconBtn
              label="Gerar SKU"
              onClick={() => setText("sku", generateSku(d.name, d.category))}
            >
              <Wand2 className="size-5" />
            </IconBtn>
          </Row>
          <Row label="Marca" origin={d.origins.brand}>
            <input
              className="ios-field"
              value={d.brand}
              onChange={(e) => setText("brand", e.target.value)}
            />
          </Row>
          <Row label="Categoria interna do Bling" origin={d.origins.category}>
            {isRemote() ? (
              <select
                className="ios-field"
                aria-label="Categoria"
                value={d.category}
                onChange={(e) => setText("category", e.target.value)}
              >
                <option value="">{categories.isLoading ? "Carregando…" : "Não informada"}</option>
                {d.category && !categories.data?.some((c) => c.id === d.category) && (
                  <option value={d.category}>Categoria {d.category}</option>
                )}
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="ios-field"
                value={d.category}
                onChange={(e) => setText("category", e.target.value)}
              />
            )}
          </Row>
          <label className="ios-row">
            <span className="flex-1">Ativo</span>
            <input
              type="checkbox"
              className="ios-switch"
              checked={d.status === "active"}
              onChange={(e) =>
                setD((p) => ({ ...p, status: e.target.checked ? "active" : "inactive" }))
              }
            />
          </label>
        </div>
        {isRemote() && (
          <ProductCategories
            product={d}
            categories={categories.data ?? []}
            onSelect={(id) => setText("category", id)}
          />
        )}
        {isRemote() && (
          <ProductAttributes
            product={d}
            onChange={(customFields) => setD((p) => ({ ...p, customFields }))}
          />
        )}
        {categories.error && (
          <p role="alert" className="mx-4 mt-2 text-sm text-destructive">
            {toRepoError(categories.error).message}
          </p>
        )}
        {!gtinOk && <Hint tone="destructive">Dígito verificador inválido — confira o código.</Hint>}
        {gtinOwner && (
          <Hint tone="warning">
            Este código já está em “{gtinOwner.name}”.{" "}
            <Link
              to="/produto/$id"
              params={{ id: gtinOwner.id }}
              className="font-semibold underline"
            >
              Abrir produto
            </Link>
          </Hint>
        )}

        <div className="ios-section-label">Preço e estoque</div>
        <div className="ios-list mx-4">
          <NumRow
            label="Preço (R$)"
            value={numValue("price")}
            onChange={(v) => setNum("price", v)}
            origin={d.origins.price}
          />
          <NumRow
            label="Custo (R$)"
            value={numValue("cost")}
            onChange={(v) => setNum("cost", v)}
            origin={d.origins.cost}
          />
          <NumRow
            label="Estoque"
            value={numValue("stock")}
            onChange={(v) => setNum("stock", v)}
            int
            origin={d.origins.stock}
          />
          <Row label="Unidade">
            <input
              className="ios-field"
              value={d.unit}
              maxLength={6}
              onChange={(e) => setText("unit", e.target.value.toUpperCase())}
            />
          </Row>
        </div>

        {isRemote() && (
          <p className="px-4 pt-2 text-[13px] text-muted-foreground">
            Informe o saldo final desejado. A entrada ou saída é calculada automaticamente.
            {d.stock !== null && d.stock !== (initial.stock ?? 0) && (
              <span className="block font-medium text-foreground">
                {d.stock - (initial.stock ?? 0) > 0 ? "Entrada" : "Saída"} de{" "}
                {Math.abs(d.stock - (initial.stock ?? 0))} unidade(s): {initial.stock ?? 0} →{" "}
                {d.stock}.
              </span>
            )}
            O custo é salvo no registro padrão do produto, sem escolher fornecedor.
          </p>
        )}
        <div className="ios-section-label">Fiscal</div>
        <div className="ios-list mx-4">
          <Row label="NCM" origin={d.origins.ncm}>
            <input
              className="ios-field"
              inputMode="numeric"
              placeholder="8 dígitos"
              value={d.ncm}
              onChange={(e) => setText("ncm", normalizeFiscalCode(e.target.value))}
            />
          </Row>
          <Row label="CEST" origin={d.origins.cest}>
            <input
              className="ios-field"
              inputMode="numeric"
              placeholder="7 dígitos"
              value={d.cest}
              onChange={(e) => setText("cest", normalizeFiscalCode(e.target.value))}
            />
          </Row>
          <Row label="Origem" origin={d.origins.taxOrigin}>
            <select
              className="ios-field appearance-none"
              value={d.taxOrigin}
              onChange={(e) => setText("taxOrigin", e.target.value)}
            >
              <option value="">Não informado</option>
              <option value="0">0 — Nacional</option>
              <option value="1">1 — Estrangeira (importação direta)</option>
              <option value="2">2 — Estrangeira (mercado interno)</option>
              {["3", "4", "5", "6", "7", "8"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Row>
          <Row label="GTIN embalagem" origin={d.origins.gtinPackage}>
            <input
              className="ios-field"
              inputMode="numeric"
              placeholder="Opcional"
              value={d.gtinPackage}
              onChange={(e) => setText("gtinPackage", e.target.value.replace(/\D/g, ""))}
            />
          </Row>
        </div>
        {d.ncm !== "" && d.ncm.length !== 8 && <Hint tone="warning">NCM deve ter 8 dígitos.</Hint>}

        <div className="ios-section-label">Peso e dimensões</div>
        <div className="ios-list mx-4">
          <NumRow
            label="Peso líquido (kg)"
            value={numValue("netWeightKg")}
            onChange={(v) => setNum("netWeightKg", v)}
            origin={d.origins.netWeightKg}
          />
          <NumRow
            label="Peso bruto (kg)"
            value={numValue("grossWeightKg")}
            onChange={(v) => setNum("grossWeightKg", v)}
            origin={d.origins.grossWeightKg}
          />
          <NumRow
            label="Largura (cm)"
            value={numValue("widthCm")}
            onChange={(v) => setNum("widthCm", v)}
          />
          <NumRow
            label="Altura (cm)"
            value={numValue("heightCm")}
            onChange={(v) => setNum("heightCm", v)}
          />
          <NumRow
            label="Profundidade (cm)"
            value={numValue("depthCm")}
            onChange={(v) => setNum("depthCm", v)}
          />
        </div>

        <div className="ios-section-label">Descrição</div>
        <div className="mx-4 mb-3">
          <button
            type="button"
            className="ios-btn-tinted w-full"
            disabled={descriptionBusy || !d.name.trim() || saving}
            onClick={async () => {
              setDescriptionBusy(true);
              setDescriptionError(null);
              try {
                setDescriptionDraft((await repo.generateDescription!(d)).description);
              } catch (error) {
                setDescriptionError(toRepoError(error).message);
              } finally {
                setDescriptionBusy(false);
              }
            }}
          >
            {descriptionBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {descriptionBusy ? "Gerando descrição…" : "Gerar descrição com IA"}
          </button>
          {descriptionError && (
            <p role="alert" className="mt-2 text-[13px] text-destructive">
              {descriptionError}
            </p>
          )}
          {descriptionDraft && (
            <div className="mt-3 rounded-xl bg-card p-3">
              <p className="text-[13px] font-medium">Revise a sugestão antes de usar</p>
              <p className="my-3 whitespace-pre-wrap text-sm">{descriptionDraft}</p>
              <button
                type="button"
                className="ios-btn-tinted w-full"
                onClick={() => {
                  setText("description", descriptionDraft);
                  setDescriptionDraft(null);
                }}
              >
                Usar esta descrição
              </button>
              <button
                type="button"
                className="mt-2 w-full text-sm text-muted-foreground"
                onClick={() => setDescriptionDraft(null)}
              >
                Descartar sugestão
              </button>
            </div>
          )}
        </div>
        <div className="ios-list mx-4">
          <textarea
            rows={4}
            className="w-full resize-none bg-transparent px-4 py-3 outline-none placeholder:text-tertiary"
            placeholder="Descrição para exportar às lojas"
            maxLength={5000}
            value={d.description}
            onChange={(e) => setText("description", e.target.value)}
          />
        </div>

        {pendingSuggested.length > 0 && (
          <div className="mx-4 mt-4 rounded-md bg-card p-3">
            <p className="text-[13px]">Confira as sugestões antes de confirmar.</p>
            {pendingSuggested.map((field) => (
              <button
                key={field}
                type="button"
                className="ios-btn-tinted mt-2 w-full"
                onClick={() =>
                  setD((p) => ({ ...p, origins: { ...p.origins, [field]: "confirmed" } }))
                }
              >
                Confirmar {LABELS[field] ?? field}: {String(d[field])}
              </button>
            ))}
          </div>
        )}
        {/* Sticky footer */}
        <div className="ios-glass fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <div className="mx-auto max-w-xl">
            {saveError ? (
              <div
                role="alert"
                className="mb-2 flex items-start gap-1.5 text-[13px] text-destructive"
              >
                <AlertCircle className="mt-px size-4 shrink-0" />
                <span className="flex-1">
                  {saveError.message}{" "}
                  {saveError.code === "duplicate" && saveError.details?.existingId && (
                    <Link
                      to="/produto/$id"
                      params={{ id: saveError.details.existingId }}
                      className="font-semibold underline"
                    >
                      Abrir
                    </Link>
                  )}
                  {saveError.code === "conflict" && onReload && (
                    <button
                      type="button"
                      onClick={onReload}
                      className="inline-flex items-center gap-1 font-semibold underline"
                    >
                      <RotateCw className="size-3" />
                      Recarregar
                    </button>
                  )}
                </span>
              </div>
            ) : (
              <p
                className={`mb-2 flex items-center gap-1.5 text-[13px] ${missing.length ? "text-warning" : "text-success"}`}
              >
                {missing.length ? (
                  <AlertCircle className="size-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0" />
                )}
                <span className="truncate">
                  {missing.length ? `Falta: ${missing.join(", ")}` : "Cadastro completo"}
                  {pendingSuggested.length > 0 &&
                    ` · ${pendingSuggested.length} sugerido(s) por IA`}
                </span>
              </p>
            )}
            <button
              type="submit"
              disabled={saving || photoBusy || !d.name.trim() || !d.sku.trim() || !gtinOk}
              className="ios-btn-primary w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Salvando…
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </div>
      </fieldset>
      <BarcodeScanner
        open={scanning}
        onClose={() => setScanning(false)}
        onDetected={onScanned}
        title="Ler GTIN/EAN"
      />
    </form>
  );
}

function Hint({ tone, children }: { tone: "warning" | "destructive"; children: ReactNode }) {
  return (
    <p
      className={`px-8 pt-1.5 text-[13px] ${tone === "warning" ? "text-warning" : "text-destructive"}`}
    >
      {children}
    </p>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-primary active:bg-secondary"
    >
      {children}
    </button>
  );
}

function Row({
  label,
  origin,
  children,
}: {
  label: string;
  origin?: "confirmed" | "suggested" | undefined;
  children: ReactNode;
}) {
  return (
    <label className={`ios-row ${origin === "suggested" ? "bg-ai/5" : ""}`}>
      <span className="flex shrink-0 items-center gap-1">
        {label}
        {origin === "suggested" && (
          <Sparkles
            className="size-3.5 text-ai"
            aria-label="Sugerido por IA — edite para confirmar"
          />
        )}
      </span>
      {children}
    </label>
  );
}

function NumRow({
  label,
  value,
  onChange,
  int,
  origin,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  int?: boolean;
  origin?: "confirmed" | "suggested" | undefined;
}) {
  return (
    <Row label={label} origin={origin}>
      <input
        className="ios-field"
        inputMode={int ? "numeric" : "decimal"}
        placeholder="—"
        value={value}
        onChange={(e) =>
          onChange(int ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^\d.,]/g, ""))
        }
      />
    </Row>
  );
}
