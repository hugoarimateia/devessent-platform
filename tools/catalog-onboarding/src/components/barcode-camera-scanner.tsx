"use client";

import * as React from "react";
import {
  Camera,
  CameraOff,
  ImageUp,
  Keyboard,
  ScanBarcode,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CaptureMethod } from "@scanner/lib/types";

interface BarcodeCameraScannerProps {
  capturedCount: number;
  duplicateScanPolicy: "ignore" | "increment_stock" | "add_variant";
  onChangeDuplicatePolicy: (policy: "ignore" | "increment_stock" | "add_variant") => void;
  onCodeCaptured: (code: string, method: CaptureMethod) => Promise<void>;
}

function playBeep(success: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = success ? 960 : 320;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.11 : 0.22));
  } catch {
    // áudio opcional
  }
}

export function BarcodeCameraScanner({
  capturedCount,
  duplicateScanPolicy,
  onChangeDuplicatePolicy,
  onCodeCaptured,
}: BarcodeCameraScannerProps) {
  const [cameraActive, setCameraActive] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [usbModeEnabled, setUsbModeEnabled] = React.useState(true);
  const [manualCode, setManualCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const stopCameraRef = React.useRef<(() => void) | null>(null);
  const lastScanRef = React.useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const usbBufferRef = React.useRef<{ text: string; lastKeyAt: number }>({
    text: "",
    lastKeyAt: 0,
  });

  const dispatchCode = React.useCallback(
    async (rawCode: string, method: CaptureMethod) => {
      const clean = rawCode.trim();
      if (!clean) return;
      const now = Date.now();
      // Debounce contínuo para evitar leituras duplicadas acidentais em sequência rápida (2.5s)
      if (
        method === "barcode_camera" &&
        lastScanRef.current.code === clean &&
        now - lastScanRef.current.at < 2500
      ) {
        return;
      }
      lastScanRef.current = { code: clean, at: now };

      setBusy(true);
      setError(null);
      try {
        await onCodeCaptured(clean, method);
        if (soundEnabled) playBeep(true);
        setStatusMessage(`Código ${clean} capturado (${method.replace("barcode_", "")}).`);
      } catch (err) {
        if (soundEnabled) playBeep(false);
        setError(err instanceof Error ? err.message : "Falha ao processar código.");
      } finally {
        setBusy(false);
      }
    },
    [onCodeCaptured, soundEnabled]
  );

  // Listener global para leitor USB (keyboard wedge): captura rajadas rápidas terminadas em Enter
  React.useEffect(() => {
    if (!usbModeEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if (isInputFocused) return;

      const now = Date.now();
      if (now - usbBufferRef.current.lastKeyAt > 120) {
        usbBufferRef.current.text = "";
      }

      if (e.key === "Enter") {
        const candidate = usbBufferRef.current.text.trim();
        usbBufferRef.current.text = "";
        if (/^\d{8,14}$/.test(candidate)) {
          e.preventDefault();
          void dispatchCode(candidate, "barcode_usb");
        }
        return;
      }

      if (/^\d$/.test(e.key)) {
        usbBufferRef.current.text += e.key;
        usbBufferRef.current.lastKeyAt = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [usbModeEnabled, dispatchCode]);

  const stopCamera = React.useCallback(() => {
    if (stopCameraRef.current) {
      stopCameraRef.current();
      stopCameraRef.current = null;
    }
    setCameraActive(false);
  }, []);

  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    setError(null);
    setStatusMessage("Inicializando câmera para leitura contínua EAN/UPC...");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      setCameraActive(true);

      // Aguardar mount do <video>
      await new Promise((r) => setTimeout(r, 80));
      if (!videoRef.current) {
        setCameraActive(false);
        setError("Elemento de vídeo indisponível.");
        return;
      }

      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
          },
        },
        videoRef.current,
        (result) => {
          if (result) {
            const text = result.getText();
            if (text) {
              void dispatchCode(text, "barcode_camera");
            }
          }
        }
      );

      stopCameraRef.current = () => controls.stop();
      setStatusMessage("Câmera ativa · aponte para códigos EAN-13, EAN-8 ou UPC-A.");
    } catch (err) {
      setCameraActive(false);
      setError(
        err instanceof Error
          ? `Não foi possível ativar a câmera: ${err.message}. Use leitor USB, digitação manual ou envio de imagem.`
          : "Câmera indisponível neste dispositivo/origem."
      );
    }
  };

  const handleBarcodeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      const code = result.getText();
      await dispatchCode(code, "barcode_image");
    } catch {
      setError(
        "Não foi possível decodificar um código de barras nítido nesta imagem. Tente o Scanner por Fotografia + OCR ou digite o código manualmente."
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await dispatchCode(manualCode.trim(), "barcode_manual");
    setManualCode("");
  };

  return (
    <div className="space-y-5">
      {/* Barra de controles do scanner contínuo */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {!cameraActive ? (
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Ativar Câmera Contínua</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30 font-semibold text-xs transition-colors cursor-pointer"
            >
              <CameraOff className="w-4 h-4" />
              <span>Parar Câmera</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Som {soundEnabled ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={() => setUsbModeEnabled((u) => !u)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs cursor-pointer ${
              usbModeEnabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 bg-slate-950 text-slate-400"
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Leitor USB {usbModeEnabled ? "Escutando" : "Pausado"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="dup-scan-policy" className="text-slate-400">
              Repetição:
            </label>
            <select
              id="dup-scan-policy"
              value={duplicateScanPolicy}
              onChange={(e) =>
                onChangeDuplicatePolicy(
                  e.target.value as "ignore" | "increment_stock" | "add_variant"
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
            >
              <option value="ignore">Ignorar código repetido</option>
              <option value="increment_stock">Incrementar contagem (+1)</option>
              <option value="add_variant">Criar variante no item</option>
            </select>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300">
            Fila: <strong>{capturedCount}</strong>
          </div>
        </div>
      </div>

      {/* Preview da câmera quando ativa */}
      {cameraActive && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-black aspect-video max-h-72 flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-10 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
        </div>
      )}

      {/* Entrada manual / USB + Upload de imagem com código de barras */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form
          onSubmit={handleManualSubmit}
          className="lg:col-span-2 flex flex-col sm:flex-row gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <div className="flex-1">
            <label htmlFor="manual-gtin-input" className="sr-only">
              Código EAN / GTIN
            </label>
            <input
              id="manual-gtin-input"
              type="text"
              inputMode="numeric"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Digite ou bipe um código EAN-13, EAN-8 ou UPC-A (ex.: 7891000100103)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !manualCode.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>{busy ? "Consultando..." : "Identificar GTIN"}</span>
          </button>
        </form>

        <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 hover:border-emerald-500/50 hover:bg-slate-900 p-4 text-xs text-slate-300 cursor-pointer transition-colors">
          <ImageUp className="w-4 h-4 text-emerald-400" />
          <span>Ler código de barras em imagem</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleBarcodeImageUpload}
          />
        </label>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
          {statusMessage}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}
