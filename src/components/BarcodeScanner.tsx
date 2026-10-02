import { useEffect, useRef, useState } from "react";
import { X, Flashlight, Camera, AlertTriangle, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
}

/** Full-screen camera sheet that reads EAN/UPC/Code128/QR barcodes with Apple iOS aesthetics. */
export function BarcodeScanner({ open, onClose, onDetected, title = "Escanear código" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [manual, setManual] = useState("");
  // Keep the latest callback without restarting the camera on every parent render.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return;
    setError(null);
    let stop = () => {};
    let done = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } } },
          videoRef.current!,
          (result) => {
            if (result && !done) {
              done = true;
              navigator.vibrate?.(60);
              controls.stop();
              onDetectedRef.current(result.getText().trim());
            }
          },
        );
        stop = () => controls.stop();
        const stream = videoRef.current?.srcObject as MediaStream | null;
        trackRef.current = stream?.getVideoTracks()[0] ?? null;
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError"
            ? "Permita o acesso à câmera nas configurações do navegador."
            : "Não foi possível abrir a câmera neste dispositivo.",
        );
      }
    })();
    return () => {
      done = true;
      stop();
      trackRef.current = null;
      setTorch(false);
    };
  }, [open]);

  const toggleTorch = async () => {
    const t = trackRef.current;
    if (!t) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      /* torch unsupported */
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white animate-in fade-in duration-200 select-none">
      {/* Top Glass Navigation */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="ios-press grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur-xl border border-white/20 text-white shadow-lg active:scale-90"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[17px] font-semibold tracking-tight text-white/95">{title}</span>
          <span className="text-[11px] font-medium text-white/60">Leitura automática</span>
        </div>

        <button
          type="button"
          aria-label="Lanterna"
          onClick={toggleTorch}
          className={`ios-press grid size-11 place-items-center rounded-full transition-all backdrop-blur-xl border ${
            torch
              ? "bg-amber-400 text-black border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
              : "bg-white/15 text-white border-white/20"
          }`}
        >
          <Flashlight className="size-5" />
        </button>
      </div>

      {/* Camera Viewport & Laser Reticle */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />

        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          {/* Target Reticle with Apple-style corner brackets */}
          <div className="relative h-48 w-[82%] max-w-xs rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.68)]">
            {/* Corner Brackets */}
            <div className="absolute -top-0.5 -left-0.5 size-7 border-t-3 border-l-3 border-[#0A84FF] rounded-tl-xl" />
            <div className="absolute -top-0.5 -right-0.5 size-7 border-t-3 border-r-3 border-[#0A84FF] rounded-tr-xl" />
            <div className="absolute -bottom-0.5 -left-0.5 size-7 border-b-3 border-l-3 border-[#0A84FF] rounded-bl-xl" />
            <div className="absolute -bottom-0.5 -right-0.5 size-7 border-b-3 border-r-3 border-[#0A84FF] rounded-br-xl" />

            {/* Glowing Laser Scan Line */}
            <div className="scan-line absolute inset-x-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#0A84FF] to-transparent shadow-[0_0_14px_#0A84FF]" />
          </div>
        </div>

        {/* Tip Badge */}
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-[13px] font-medium text-white/90 backdrop-blur-md border border-white/15 shadow-lg">
            <Camera className="size-3.5 text-blue-400" />
            <span>{error ? error : "Centralize o código de barras no quadrado"}</span>
          </div>
        </div>
      </div>

      {/* Manual Code Input Bar */}
      <div className="relative z-10 bg-black/70 backdrop-blur-2xl border-t border-white/10 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]">
        <form
          className="mx-auto flex w-full max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onDetectedRef.current(manual.trim());
            setManual("");
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\s/g, ""))}
            inputMode="numeric"
            placeholder="Digitar código manualmente…"
            className="h-12 flex-1 rounded-2xl bg-white/12 px-4 text-[15px] text-white outline-none placeholder:text-white/40 border border-white/15 focus:border-blue-400 focus:bg-white/18 transition-all"
          />
          <button
            type="submit"
            disabled={!manual.trim()}
            className="ios-btn-primary h-12 rounded-2xl px-5 text-[15px] font-semibold disabled:opacity-40"
          >
            <span>OK</span>
            <ArrowRight className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

