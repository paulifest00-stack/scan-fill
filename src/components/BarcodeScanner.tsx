import { useEffect, useRef, useState } from "react";
import { X, Flashlight } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
}

/** Full-screen camera sheet that reads EAN/UPC/Code128/QR barcodes. */
export function BarcodeScanner({ open, onClose, onDetected, title = "Escanear código" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);

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
              onDetected(result.getText());
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
    return () => { done = true; stop(); trackRef.current = null; setTorch(false); };
  }, [open, onDetected]);

  const toggleTorch = async () => {
    const t = trackRef.current;
    if (!t) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch { /* torch unsupported */ }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground text-primary-foreground animate-in fade-in">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3">
        <button aria-label="Fechar" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-card/15"><X className="size-5" /></button>
        <span className="text-[17px] font-semibold">{title}</span>
        <button aria-label="Lanterna" onClick={toggleTorch} className={`grid size-11 place-items-center rounded-full ${torch ? "bg-warning text-foreground" : "bg-card/15"}`}><Flashlight className="size-5" /></button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative h-44 w-[78%] max-w-sm rounded-xl border-2 border-primary-foreground/90 shadow-[0_0_0_9999px_var(--color-scrim)]">
            <div className="scan-line absolute inset-x-4 top-1/2 h-0.5 bg-destructive shadow-[0_0_12px_var(--color-destructive)]" />
          </div>
        </div>
      </div>
      <p className="px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)] text-center text-[15px] text-primary-foreground/80">
        {error ?? "Aponte para o código de barras. A leitura é automática."}
      </p>
    </div>
  );
}
