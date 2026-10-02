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
  Plus,
  Image as ImageIcon,
  DollarSign,
  Package,
  Layers,
  FileText,
  Truck,
  Building,
  Check,
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
import { toast } from "sonner";

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
  | "price"
  | "cost"
  | "stock"
  | "netWeightKg"
  | "grossWeightKg"
  | "widthCm"
  | "heightCm"
  | "depthCm";

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
    const clean = code.replace(/\D/g, "");
    setText("gtin", clean);
    toast.success("Código escaneado: " + clean);
    void checkGtinOwner(clean);
  };

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    try {
      const urls = await Promise.all(Array.from(files).map((f) => compressImage(f)));
      setD((p) => ({
        ...p,
        images: [...p.images, ...urls.map((url) => ({ url, local: true }))],
      }));
      toast.success(`${urls.length} foto(s) adicionada(s)`);
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
      const filtered = sanitizeSuggestions(raw, d);
      setSuggestions(filtered);
      if (filtered.length > 0) {
        toast.success(`${filtered.length} sugestão(ões) encontrada(s) pela IA!`);
      } else {
        toast.info("Nenhum dado legível identificado com certeza nas fotos.");
      }
    } catch {
      setSuggestions([]);
      toast.error("Falha ao analisar fotos com IA");
    } finally {
      setAnalyzing(false);
    }
  };

  const applySuggestion = (s: FieldSuggestion) => {
    setD((p) => ({ ...p, [s.field]: s.value, origins: { ...p.origins, [s.field]: "suggested" } }));
    setSuggestions((l) => l?.filter((x) => x !== s) ?? null);
    toast.info(`Aplicado: ${LABELS[s.field] ?? s.field}`);
  };

  const applyAllSuggestions = () => {
    if (!suggestions?.length) return;
    setD((p) => {
      let next = { ...p };
      const nextOrigins = { ...p.origins };
      for (const s of suggestions) {
        next = { ...next, [s.field]: s.value };
        nextOrigins[s.field] = "suggested";
      }
      return { ...next, origins: nextOrigins };
    });
    toast.success(`Todas as ${suggestions.length} sugestões foram aplicadas!`);
    setSuggestions([]);
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
            `Confira o valor numérico em ${
              field === "stock"
                ? "Estoque"
                : field === "cost"
                  ? "Custo"
                  : field === "price"
                    ? "Preço"
                    : "Peso/dimensões"
            }.`,
          );
      }
      await onSubmit(normalizeFiscalInput({ ...d, name: d.name.trim(), sku: d.sku.trim().toUpperCase() }));
      savedRef.current = true;
      toast.success("Produto salvo com sucesso!");
      onSaved?.();
    } catch (e) {
      const error = toRepoError(e);
      setSaveError(error);
      toast.error(error.message);
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
      className="pb-44 select-none"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset disabled={saving} className="contents">
        {/* Photo Gallery & Hero */}
        <section className="px-4 pt-3" aria-label="Galeria de fotos">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fotos do Produto
            </span>
            <span className="text-[12px] font-medium text-muted-foreground">
              {d.images.length} adicionada(s)
            </span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-none">
            {/* Take / Upload Photo Button */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="ios-press flex size-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 active:scale-95"
            >
              {photoBusy ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : (
                <Camera className="size-6 text-primary" />
              )}
              <span className="text-[12px] font-semibold">Tirar Foto</span>
            </button>

            {/* Photos Strip */}
            {d.images.map((img, i) => (
              <div
                key={img.url.slice(-40) + i}
                className="group relative size-24 shrink-0 rounded-2xl overflow-hidden border border-black/10 shadow-xs"
              >
                <img
                  src={img.url}
                  alt={`Foto ${i + 1}`}
                  className="size-full object-cover"
                  loading="lazy"
                />
                {i === 0 ? (
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                    Capa
                  </span>
                ) : (
                  <button
                    type="button"
                    title="Definir como foto de capa"
                    onClick={() => {
                      const reordered = [img, ...d.images.filter((_, j) => j !== i)];
                      setD((p) => ({ ...p, images: reordered }));
                      toast.info("Foto definida como capa principal");
                    }}
                    className="absolute bottom-1.5 left-1.5 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-md"
                  >
                    Tornar capa
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Remover foto"
                  onClick={() =>
                    setD((p) => ({ ...p, images: p.images.filter((_, j) => j !== i) }))
                  }
                  className="ios-press absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
                >
                  <X className="size-3.5" />
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

          {/* Quick Barcode Scan & AI Assistant Card */}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="ios-btn-tinted h-11 w-full text-[14px]"
            >
              <ScanLine className="size-4" />
              <span>{d.gtin ? "Escanear Novamente" : "Ler Código de Barras"}</span>
            </button>

            {d.images.length > 0 && (
              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={analyzing || !analyzer.available}
                className="ios-btn h-11 w-full bg-purple-500/10 text-purple-700 border border-purple-500/20 text-[14px] hover:bg-purple-500/15"
              >
                {analyzing ? (
                  <Loader2 className="size-4 animate-spin text-purple-600" />
                ) : (
                  <Sparkles className="size-4 text-purple-600" />
                )}
                <span>
                  {analyzing ? "Analisando fotos com IA…" : "Sugerir Dados pelas Fotos"}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* AI Suggestions Card */}
        {suggestions && (
          <section className="mx-4 mt-3 rounded-2xl border border-purple-500/25 bg-gradient-to-b from-purple-500/5 to-card p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2">
              <p className="flex items-center gap-1.5 text-[14px] font-bold text-purple-900">
                <Sparkles className="size-4 text-purple-600" />
                <span>Sugestões da IA Paulifest</span>
              </p>
              {suggestions.length > 0 && (
                <button
                  type="button"
                  onClick={applyAllSuggestions}
                  className="rounded-full bg-purple-600 px-3 py-1 text-[12px] font-semibold text-white shadow-xs hover:bg-purple-700"
                >
                  Usar Todas
                </button>
              )}
            </div>

            {suggestions.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">
                Não foi possível extrair novos dados confiáveis das fotos.
              </p>
            ) : (
              <div className="divide-y divide-purple-500/10">
                {suggestions.map((s) => (
                  <div key={s.field} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold uppercase text-purple-700">
                          {LABELS[s.field] ?? s.field}
                        </span>
                        <span className="rounded-full bg-purple-500/10 px-1.5 py-0.2 text-[10px] text-purple-800">
                          {s.kind === "read" ? "embalagem" : "inferido"}
                        </span>
                        {CRITICAL_FIELDS.has(s.field) && (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-medium text-amber-800">
                            confirme
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[15px] font-medium text-foreground">
                        {String(s.value)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="ios-press rounded-full bg-purple-600/10 px-3.5 py-1 text-[13px] font-semibold text-purple-700 hover:bg-purple-600/20"
                    >
                      Usar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 1: Identificação */}
        <div className="ios-section-label">Identificação</div>
        <div className="ios-list mx-4">
          <Row label="Nome" origin={d.origins.name} required>
            <input
              className="ios-field font-medium"
              placeholder="Obrigatório"
              value={d.name}
              enterKeyHint="next"
              onChange={(e) => setText("name", e.target.value)}
            />
          </Row>

          <Row label="GTIN/EAN" origin={d.origins.gtin}>
            <input
              className={`ios-field font-mono ${gtinOk ? "" : "text-destructive font-semibold"}`}
              inputMode="numeric"
              placeholder="Digite ou escaneie"
              value={d.gtin}
              onChange={(e) => setText("gtin", e.target.value.replace(/\D/g, ""))}
              onBlur={() => void checkGtinOwner(d.gtin)}
            />
            <IconBtn label="Ler código com a câmera" onClick={() => setScanning(true)}>
              <ScanLine className="size-5 text-primary" />
            </IconBtn>
          </Row>

          <Row label="SKU" origin={d.origins.sku} required>
            <input
              className="ios-field font-mono uppercase font-semibold text-[15px]"
              placeholder="Obrigatório"
              autoCapitalize="characters"
              value={d.sku}
              onChange={(e) => setText("sku", e.target.value.toUpperCase())}
            />
            <IconBtn
              label="Gerar SKU com IA"
              onClick={() => {
                const generated = generateSku(d.name, d.category);
                setText("sku", generated);
                toast.info("SKU gerado: " + generated);
              }}
            >
              <Wand2 className="size-4.5 text-primary" />
            </IconBtn>
          </Row>

          <Row label="Marca" origin={d.origins.brand}>
            <input
              className="ios-field"
              placeholder="Opcional"
              value={d.brand}
              onChange={(e) => setText("brand", e.target.value)}
            />
          </Row>

          <Row label="Categoria Bling" origin={d.origins.category}>
            {isRemote() ? (
              <select
                className="ios-field appearance-none bg-transparent"
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
                placeholder="Ex: Utilidades"
                value={d.category}
                onChange={(e) => setText("category", e.target.value)}
              />
            )}
          </Row>

          <div className="ios-row justify-between">
            <span className="text-[15px] font-medium text-foreground">Produto Ativo no Catálogo</span>
            <input
              type="checkbox"
              className="ios-switch"
              checked={d.status === "active"}
              onChange={(e) =>
                setD((p) => ({ ...p, status: e.target.checked ? "active" : "inactive" }))
              }
            />
          </div>
        </div>

        {!gtinOk && (
          <Hint tone="destructive">Dígito verificador do GTIN/EAN inválido — confira o número.</Hint>
        )}

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

        {/* SECTION 2: Preço e Estoque */}
        <div className="ios-section-label">Preço e Estoque</div>
        <div className="ios-list mx-4">
          <NumRow
            label="Preço de Venda (R$)"
            value={numValue("price")}
            onChange={(v) => setNum("price", v)}
            origin={d.origins.price}
            highlight
          />
          <NumRow
            label="Custo (R$)"
            value={numValue("cost")}
            onChange={(v) => setNum("cost", v)}
            origin={d.origins.cost}
          />
          <NumRow
            label="Estoque Atual"
            value={numValue("stock")}
            onChange={(v) => setNum("stock", v)}
            int
            origin={d.origins.stock}
          />
          <Row label="Unidade">
            <input
              className="ios-field font-mono uppercase"
              placeholder="UN"
              value={d.unit}
              maxLength={6}
              onChange={(e) => setText("unit", e.target.value.toUpperCase())}
            />
          </Row>
        </div>

        {isRemote() && (
          <div className="mx-4 mt-2 rounded-xl bg-black/[0.03] p-3 text-[13px] text-muted-foreground border border-black/[0.04]">
            <p>Informe o saldo final desejado. A entrada ou saída é calculada pelo Bling.</p>
            {d.stock !== null && d.stock !== (initial.stock ?? 0) && (
              <span className="mt-1 block font-semibold text-primary">
                {d.stock - (initial.stock ?? 0) > 0 ? "Entrada" : "Saída"} de{" "}
                {Math.abs(d.stock - (initial.stock ?? 0))} unidade(s): {initial.stock ?? 0} →{" "}
                {d.stock}.
              </span>
            )}
          </div>
        )}

        {/* Remote Stores Categories & Attributes */}
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

        {/* SECTION 3: Peso e Dimensões */}
        <div className="ios-section-label">Logística e Dimensões</div>
        <div className="ios-list mx-4">
          <NumRow
            label="Peso Líquido (kg)"
            value={numValue("netWeightKg")}
            onChange={(v) => setNum("netWeightKg", v)}
            origin={d.origins.netWeightKg}
          />
          <NumRow
            label="Peso Bruto (kg)"
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

        {/* SECTION 4: Fiscal */}
        <div className="ios-section-label">Fiscal e Tributário</div>
        <div className="ios-list mx-4">
          <Row label="NCM" origin={d.origins.ncm}>
            <input
              className="ios-field font-mono"
              inputMode="numeric"
              placeholder="8 dígitos"
              value={d.ncm}
              onChange={(e) => setText("ncm", normalizeFiscalCode(e.target.value))}
            />
          </Row>
          <Row label="CEST" origin={d.origins.cest}>
            <input
              className="ios-field font-mono"
              inputMode="numeric"
              placeholder="7 dígitos"
              value={d.cest}
              onChange={(e) => setText("cest", normalizeFiscalCode(e.target.value))}
            />
          </Row>
          <Row label="Origem" origin={d.origins.taxOrigin}>
            <select
              className="ios-field appearance-none bg-transparent"
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
          <Row label="GTIN da Embalagem" origin={d.origins.gtinPackage}>
            <input
              className="ios-field font-mono"
              inputMode="numeric"
              placeholder="Opcional"
              value={d.gtinPackage}
              onChange={(e) => setText("gtinPackage", e.target.value.replace(/\D/g, ""))}
            />
          </Row>
        </div>
        {d.ncm !== "" && d.ncm.length !== 8 && (
          <Hint tone="warning">O código NCM deve conter exatamente 8 dígitos.</Hint>
        )}

        {/* SECTION 5: Descrição */}
        <div className="ios-section-label">Descrição Comercial</div>
        <div className="mx-4 mb-2">
          <button
            type="button"
            className="ios-btn-tinted h-11 w-full text-[14px]"
            disabled={descriptionBusy || !d.name.trim() || saving}
            onClick={async () => {
              setDescriptionBusy(true);
              setDescriptionError(null);
              try {
                const res = await repo.generateDescription!(d);
                setDescriptionDraft(res.description);
                toast.success("Descrição gerada pela IA!");
              } catch (error) {
                setDescriptionError(toRepoError(error).message);
                toast.error("Falha ao gerar descrição");
              } finally {
                setDescriptionBusy(false);
              }
            }}
          >
            {descriptionBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-primary" />
            )}
            <span>{descriptionBusy ? "Gerando descrição comercial…" : "Gerar Descrição com IA"}</span>
          </button>

          {descriptionError && (
            <p role="alert" className="mt-2 text-[13px] text-destructive">
              {descriptionError}
            </p>
          )}

          {descriptionDraft && (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm animate-in fade-in">
              <p className="text-[13px] font-semibold text-primary">Revise a sugestão gerada pela IA:</p>
              <p className="my-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
                {descriptionDraft}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="ios-btn-primary flex-1 h-10 text-[14px]"
                  onClick={() => {
                    setText("description", descriptionDraft);
                    setDescriptionDraft(null);
                    toast.success("Descrição aplicada!");
                  }}
                >
                  Usar Esta Descrição
                </button>
                <button
                  type="button"
                  className="ios-btn flex-1 bg-secondary text-foreground h-10 text-[14px]"
                  onClick={() => setDescriptionDraft(null)}
                >
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ios-list mx-4">
          <textarea
            rows={4}
            className="w-full resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-tertiary"
            placeholder="Descrição para exportar para lojas e marketplaces…"
            maxLength={5000}
            value={d.description}
            onChange={(e) => setText("description", e.target.value)}
          />
        </div>

        {/* Pending Suggestions confirmation */}
        {pendingSuggested.length > 0 && (
          <div className="mx-4 mt-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 shadow-2xs">
            <p className="text-[13px] font-semibold text-purple-900">
              Campos preenchidos por IA — confirme antes de salvar:
            </p>
            <div className="mt-2 space-y-1.5">
              {pendingSuggested.map((field) => (
                <button
                  key={field}
                  type="button"
                  className="ios-press flex w-full items-center justify-between rounded-xl bg-card p-2.5 text-left border border-black/5 shadow-2xs"
                  onClick={() =>
                    setD((p) => ({ ...p, origins: { ...p.origins, [field]: "confirmed" } }))
                  }
                >
                  <span className="text-[13px] text-muted-foreground">
                    Confirmar {LABELS[field] ?? field}:{" "}
                    <strong className="text-foreground">{String(d[field])}</strong>
                  </span>
                  <Check className="size-4 text-emerald-600" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sticky iOS Glass Footer Action Bar */}
        <div className="ios-glass-dock fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
          <div className="mx-auto max-w-xl">
            {saveError ? (
              <div
                role="alert"
                className="mb-2.5 flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-[13px] text-destructive border border-destructive/20"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="flex-1">
                  {saveError.message}{" "}
                  {saveError.code === "duplicate" && saveError.details?.existingId && (
                    <Link
                      to="/produto/$id"
                      params={{ id: saveError.details.existingId }}
                      className="font-bold underline ml-1"
                    >
                      Abrir produto existente
                    </Link>
                  )}
                  {saveError.code === "conflict" && onReload && (
                    <button
                      type="button"
                      onClick={onReload}
                      className="inline-flex items-center gap-1 font-bold underline ml-1"
                    >
                      <RotateCw className="size-3" />
                      Recarregar
                    </button>
                  )}
                </span>
              </div>
            ) : (
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <div
                  className={`flex items-center gap-1.5 font-medium ${
                    missing.length ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {missing.length ? (
                    <AlertCircle className="size-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="size-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {missing.length ? `Falta: ${missing.join(", ")}` : "Todos os dados essenciais preenchidos"}
                  </span>
                </div>
                {pendingSuggested.length > 0 && (
                  <span className="shrink-0 text-[11px] font-semibold text-purple-700 bg-purple-500/10 px-2 py-0.5 rounded-full">
                    {pendingSuggested.length} IA
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || photoBusy || !d.name.trim() || !d.sku.trim() || !gtinOk}
              className="ios-btn-primary w-full shadow-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>Salvando no catálogo…</span>
                </>
              ) : (
                <span>{submitLabel}</span>
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
      className={`px-6 pt-1.5 text-[13px] ${
        tone === "warning" ? "text-amber-700" : "text-destructive"
      }`}
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
      className="ios-press -my-2 -mr-2 grid size-10 shrink-0 place-items-center rounded-full active:bg-secondary"
    >
      {children}
    </button>
  );
}

function Row({
  label,
  origin,
  required,
  children,
}: {
  label: string;
  origin?: "confirmed" | "suggested" | undefined;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`ios-row ${origin === "suggested" ? "bg-purple-500/[0.04]" : ""}`}>
      <span className="flex shrink-0 items-center gap-1 text-[15px] font-medium text-foreground">
        {label}
        {required && <span className="text-primary text-[14px]">*</span>}
        {origin === "suggested" && (
          <Sparkles
            className="size-3.5 text-purple-600"
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
  highlight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  int?: boolean;
  origin?: "confirmed" | "suggested" | undefined;
  highlight?: boolean;
}) {
  return (
    <Row label={label} origin={origin}>
      <input
        className={`ios-field font-mono ${highlight ? "font-bold text-foreground text-[16px]" : ""}`}
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

