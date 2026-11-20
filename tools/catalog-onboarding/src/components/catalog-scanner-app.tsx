"use client";

import * as React from "react";
import {
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Layers,
  LogOut,
  Pause,
  Play,
  PlusCircle,
  RefreshCw,
  Rocket,
  ScanBarcode,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type {
  CaptureMethod,
  ScannerBatch,
  TenantStoreOption,
} from "@scanner/lib/types";
import type { CanonicalColumnKey } from "@scanner/lib/importers";
import type { BatchDryRunPreview } from "@scanner/lib/retail-importer";
import { LoginGate } from "./login-gate";
import { BarcodeCameraScanner } from "./barcode-camera-scanner";
import { ReviewStation } from "./review-station";

type ScreenStep = 1 | 2 | 3 | 4 | 5 | 6;
type CaptureTab = "barcode" | "photo_ocr" | "spreadsheet" | "manual";

interface BatchListSummary {
  id: string;
  label: string;
  environment: string;
  tenantId: string;
  tenantName: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  status: string;
  itemCount: number;
  approvedCount: number;
  importedCount: number;
  updatedAt: string;
}

interface TabularPreviewResponse {
  sourceType: "csv" | "xlsx" | "pdf";
  fileName: string;
  headers: string[];
  suggestedMapping: Partial<Record<CanonicalColumnKey, string>>;
  sampleRows: Array<Record<string, string>>;
  totalRows: number;
  pdfMeta?: {
    pageCount: number;
    hasExtractableText: boolean;
    needsOcrFallback: boolean;
    warnings: string[];
  };
}

const STEP_LABELS: Array<{ step: ScreenStep; title: string }> = [
  { step: 1, title: "1. Cliente" },
  { step: 2, title: "2. Método" },
  { step: 3, title: "3. Capturar" },
  { step: 4, title: "4. Revisar" },
  { step: 5, title: "5. Implantar" },
  { step: 6, title: "6. Resultado" },
];

export function CatalogScannerApp() {
  const [authState, setAuthState] = React.useState<{
    loading: boolean;
    authenticated: boolean;
    owner: { userId: string; email: string; fullName: string } | null;
    environment: string;
    supabaseHost: string;
  }>({
    loading: true,
    authenticated: false,
    owner: null,
    environment: "staging",
    supabaseHost: "auebnppzxcvtaaqqlbts.supabase.co",
  });

  const [step, setStep] = React.useState<ScreenStep>(1);
  const [captureTab, setCaptureTab] = React.useState<CaptureTab>("barcode");

  const [tenants, setTenants] = React.useState<TenantStoreOption[]>([]);
  const [savedBatches, setSavedBatches] = React.useState<BatchListSummary[]>([]);
  const [activeBatch, setActiveBatch] = React.useState<ScannerBatch | null>(null);
  const [batchLabelInput, setBatchLabelInput] = React.useState("");
  const [selectedTenantId, setSelectedTenantId] = React.useState("");

  // Photo + OCR state
  const [ocrBusy, setOcrBusy] = React.useState(false);
  const [ocrFeedback, setOcrFeedback] = React.useState<string | null>(null);

  // Spreadsheet / PDF state
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [filePreview, setFilePreview] = React.useState<TabularPreviewResponse | null>(null);
  const [columnMapping, setColumnMapping] = React.useState<
    Partial<Record<CanonicalColumnKey, string>>
  >({});
  const [confirmSheetPrices, setConfirmSheetPrices] = React.useState(true);
  const [confirmSheetStock, setConfirmSheetStock] = React.useState(true);
  const [fileBusy, setFileBusy] = React.useState(false);
  const [fileFeedback, setFileFeedback] = React.useState<string | null>(null);

  // Manual product without barcode state
  const [manualName, setManualName] = React.useState("");
  const [manualSku, setManualSku] = React.useState("");
  const [manualCategory, setManualCategory] = React.useState("");
  const [manualPrice, setManualPrice] = React.useState("");
  const [manualStock, setManualStock] = React.useState("");

  // Deploy / Preview state
  const [deployPreview, setDeployPreview] = React.useState<BatchDryRunPreview | null>(null);
  const [deployConfirmChecked, setDeployConfirmChecked] = React.useState(false);
  const [deploying, setDeploying] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);

  const loadBootstrapData = React.useCallback(async () => {
    const [tRes, bRes] = await Promise.all([fetch("/api/tenants"), fetch("/api/batches")]);
    if (tRes.ok) {
      const td = (await tRes.json()) as { tenants?: TenantStoreOption[] };
      setTenants(td.tenants || []);
      if (td.tenants && td.tenants.length > 0) {
        setSelectedTenantId((prev) => prev || td.tenants![0].tenantId);
      }
    }
    if (bRes.ok) {
      const bd = (await bRes.json()) as { batches?: BatchListSummary[] };
      setSavedBatches(bd.batches || []);
    }
  }, []);

  React.useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: {
        authenticated?: boolean;
        owner?: { userId: string; email: string; fullName: string };
        environment?: string;
        supabaseHost?: string;
      }) => {
        setAuthState({
          loading: false,
          authenticated: Boolean(d.authenticated),
          owner: d.owner ?? null,
          environment: d.environment || "staging",
          supabaseHost: d.supabaseHost || "auebnppzxcvtaaqqlbts.supabase.co",
        });
        if (d.authenticated) {
          void loadBootstrapData();
        }
      })
      .catch(() => {
        setAuthState((prev) => ({ ...prev, loading: false, authenticated: false }));
      });
  }, [loadBootstrapData]);

  const activeTenantStore = React.useMemo(
    () => tenants.find((t) => t.tenantId === activeBatch?.tenantId) || null,
    [tenants, activeBatch]
  );

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setActiveBatch(null);
    setStep(1);
    setAuthState((prev) => ({ ...prev, authenticated: false, owner: null }));
  };

  const handleCreateBatch = async () => {
    const chosen = tenants.find((t) => t.tenantId === selectedTenantId);
    if (!chosen) return;
    setGlobalError(null);

    const res = await fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: chosen.tenantId,
        storeId: chosen.storeId,
        label: batchLabelInput.trim() || `Implantação ${chosen.tenantName}`,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; batch?: ScannerBatch; error?: string };
    if (!res.ok || !data.ok || !data.batch) {
      setGlobalError(data.error || "Não foi possível inicializar o lote.");
      return;
    }
    setActiveBatch(data.batch);
    setBatchLabelInput("");
    setStep(2);
    void loadBootstrapData();
  };

  const handleResumeBatch = async (batchId: string) => {
    setGlobalError(null);
    const res = await fetch(`/api/batches/${batchId}`);
    const data = (await res.json()) as { ok?: boolean; batch?: ScannerBatch; error?: string };
    if (!res.ok || !data.ok || !data.batch) {
      setGlobalError(data.error || "Não foi possível abrir o lote.");
      return;
    }
    setActiveBatch(data.batch);
    setStep(data.batch.items.length > 0 ? 4 : 2);
  };

  const handleBarcodeCaptured = async (code: string, method: CaptureMethod) => {
    if (!activeBatch) return;
    const res = await fetch(`/api/batches/${activeBatch.id}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, captureMethod: method }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      batch?: ScannerBatch;
    };
    if (!res.ok || !data.ok || !data.batch) {
      throw new Error(data.error || "Falha ao identificar código.");
    }
    setActiveBatch(data.batch);
  };

  const handleUpdateDuplicatePolicy = async (
    policy: "ignore" | "increment_stock" | "add_variant"
  ) => {
    if (!activeBatch) return;
    const res = await fetch(`/api/batches/${activeBatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateScanPolicy: policy }),
    });
    const data = (await res.json()) as { ok?: boolean; batch?: ScannerBatch };
    if (res.ok && data.batch) setActiveBatch(data.batch);
  };

  const handlePhotoOcrUpload = async (file: File, skipOcr = false) => {
    if (!activeBatch) return;
    setOcrBusy(true);
    setOcrFeedback(null);
    setGlobalError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("attachAsProductPhoto", "true");
      form.append("skipOcr", String(skipOcr));
      const res = await fetch(`/api/batches/${activeBatch.id}/ocr`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        batch?: ScannerBatch;
        ocr?: { confidence: number; suggestedName: string | null; gtin: string | null; notes: string[] };
      };
      if (!res.ok || !data.ok || !data.batch) {
        setGlobalError(data.error || "Falha ao processar fotografia.");
        return;
      }
      setActiveBatch(data.batch);
      setOcrFeedback(
        skipOcr
          ? "Foto anexada ao novo item para preenchimento manual na Revisão."
          : `OCR concluído (confiança ${data.ocr?.confidence ?? 0}%): ${
              data.ocr?.suggestedName || "nome pendente"
            }${data.ocr?.gtin ? ` · GTIN ${data.ocr.gtin}` : ""}. Item enviado para a fila de revisão.`
      );
    } catch {
      setGlobalError("Erro ao executar OCR local.");
    } finally {
      setOcrBusy(false);
    }
  };

  const handleSpreadsheetSelect = async (file: File) => {
    if (!activeBatch) return;
    setPendingFile(file);
    setFileBusy(true);
    setFileFeedback(null);
    setGlobalError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", "preview");
      const res = await fetch(`/api/batches/${activeBatch.id}/import-file`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        preview?: TabularPreviewResponse;
      };
      if (!res.ok || !data.ok || !data.preview) {
        setGlobalError(data.error || "Falha ao ler arquivo.");
        return;
      }
      setFilePreview(data.preview);
      setColumnMapping(data.preview.suggestedMapping);
    } catch {
      setGlobalError("Erro ao analisar arquivo de catálogo.");
    } finally {
      setFileBusy(false);
    }
  };

  const handleSpreadsheetCommit = async () => {
    if (!activeBatch || !pendingFile) return;
    setFileBusy(true);
    setGlobalError(null);
    try {
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("mode", "commit");
      form.append("mapping", JSON.stringify(columnMapping));
      form.append("confirmMerchantPrices", String(confirmSheetPrices));
      form.append("confirmMerchantStock", String(confirmSheetStock));
      const res = await fetch(`/api/batches/${activeBatch.id}/import-file`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        addedCount?: number;
        skippedIntraBatch?: number;
        batch?: ScannerBatch;
      };
      if (!res.ok || !data.ok || !data.batch) {
        setGlobalError(data.error || "Falha ao adicionar itens do arquivo à fila.");
        return;
      }
      setActiveBatch(data.batch);
      setFileFeedback(
        `${data.addedCount ?? 0} produto(s) carregado(s) para revisão${
          data.skippedIntraBatch ? ` (${data.skippedIntraBatch} repetido(s) no lote ignorado(s))` : ""
        }.`
      );
      setPendingFile(null);
      setFilePreview(null);
    } catch {
      setGlobalError("Erro ao importar planilha para a estação de revisão.");
    } finally {
      setFileBusy(false);
    }
  };

  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch || !manualName.trim()) return;
    setGlobalError(null);
    const res = await fetch(`/api/batches/${activeBatch.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_manual",
        manualItem: {
          name: manualName.trim(),
          sku: manualSku.trim() || undefined,
          categoryName: manualCategory.trim() || undefined,
          priceCents: manualPrice ? Math.round(Number(manualPrice) * 100) : null,
          stockQuantity: manualStock !== "" ? Math.max(0, Math.floor(Number(manualStock))) : null,
        },
      }),
    });
    const data = (await res.json()) as { ok?: boolean; batch?: ScannerBatch; error?: string };
    if (!res.ok || !data.ok || !data.batch) {
      setGlobalError(data.error || "Erro ao adicionar item manual.");
      return;
    }
    setActiveBatch(data.batch);
    setManualName("");
    setManualSku("");
    setManualCategory("");
    setManualPrice("");
    setManualStock("");
  };

  const loadDeployPreview = React.useCallback(async (batchId: string) => {
    setGlobalError(null);
    const res = await fetch(`/api/batches/${batchId}/execute`);
    const data = (await res.json()) as {
      ok?: boolean;
      preview?: BatchDryRunPreview;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.preview) {
      setGlobalError(data.error || "Erro ao calcular prévia de implantação.");
      return;
    }
    setDeployPreview(data.preview);
  }, []);

  React.useEffect(() => {
    if (step === 5 && activeBatch) {
      setDeployConfirmChecked(false);
      void loadDeployPreview(activeBatch.id);
    }
  }, [step, activeBatch, loadDeployPreview]);

  const handleExecuteImport = async (onlyFailedOrPending = false) => {
    if (!activeBatch || !deployConfirmChecked) return;
    setDeploying(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/batches/${activeBatch.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmTenantId: activeBatch.tenantId,
          confirmStoreId: activeBatch.storeId,
          confirmApproved: true,
          onlyFailedOrPending,
          concurrency: 2,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        batch?: ScannerBatch;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.batch) {
        setGlobalError(data.error || "Falha durante a implantação do lote.");
        return;
      }
      setActiveBatch(data.batch);
      void loadBootstrapData();
      setStep(6);
    } catch {
      setGlobalError("Erro de rede durante a implantação.");
    } finally {
      setDeploying(false);
    }
  };

  const handleRequestPause = async () => {
    if (!activeBatch) return;
    await fetch(`/api/batches/${activeBatch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pauseRequested: true }),
    });
  };

  const downloadReportJson = () => {
    if (!activeBatch) return;
    const blob = new Blob([JSON.stringify(activeBatch, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeBatch.id}-relatorio.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-400 font-mono">
        Verificando sessão privativa DevEssent Catalog Scanner...
      </div>
    );
  }

  if (!authState.authenticated || !authState.owner) {
    return (
      <LoginGate
        supabaseHost={authState.supabaseHost}
        environment={authState.environment}
        onAuthenticated={(owner) => {
          setAuthState((prev) => ({ ...prev, authenticated: true, owner }));
          void loadBootstrapData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header privativo */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 flex items-center justify-center">
              <ScanBarcode className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm sm:text-base text-white">
                  DevEssent Catalog Scanner
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-[10px] uppercase">
                  {authState.environment} · Privativo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {authState.owner.email} · {authState.supabaseHost}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Banner Travado de Empresa + Loja + Lote (§8) */}
        {activeBatch && (
          <div className="border-t border-emerald-500/25 bg-emerald-950/35">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3 font-mono">
                <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  DESTINO TRAVADO:
                </span>
                <span className="text-white font-semibold">{activeBatch.tenantName}</span>
                <span className="text-slate-400">· Loja /loja/{activeBatch.storeSlug}</span>
                <span className="text-slate-400">· Lote {activeBatch.id}</span>
              </div>
              <div className="font-mono text-emerald-200">
                {activeBatch.items.length} na fila ·{" "}
                {activeBatch.items.filter((i) => i.approved).length} aprovados ·{" "}
                {activeBatch.items.filter((i) => i.status === "imported" || i.status === "updated").length}{" "}
                implantados
              </div>
            </div>
          </div>
        )}

        {/* Stepper das 6 Telas (§12) */}
        <nav
          aria-label="Etapas do Catalog Scanner"
          className="border-t border-slate-800/80 bg-slate-900/60"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto">
            {STEP_LABELS.map((s) => {
              const disabled = s.step > 1 && !activeBatch;
              const isCurrent = step === s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  disabled={disabled}
                  onClick={() => setStep(s.step)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isCurrent
                      ? "bg-emerald-500 text-slate-950 font-semibold"
                      : disabled
                      ? "text-slate-600 cursor-not-allowed"
                      : "text-slate-300 hover:bg-slate-800 cursor-pointer"
                  }`}
                >
                  {s.title}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {globalError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200"
          >
            {globalError}
          </div>
        )}

        {/* ================================================================ */}
        {/* TELA 1 — SELECIONAR CLIENTE                                      */}
        {/* ================================================================ */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  <span>Tela 1 — Selecionar Empresa e Loja de Destino</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Escolha explicitamente o estabelecimento que receberá os produtos. O destino fica travado durante todo o lote.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tenants.map((t) => {
                  const chosen = selectedTenantId === t.tenantId;
                  return (
                    <button
                      key={t.tenantId}
                      type="button"
                      onClick={() => setSelectedTenantId(t.tenantId)}
                      className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${
                        chosen
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-white">{t.tenantName}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {t.storeTemplate}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-emerald-300 mt-1">
                        /loja/{t.storeSlug}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {t.productCount} produto(s) · {t.categoryCount} categoria(s) · estoque{" "}
                        {t.inventoryMode}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  value={batchLabelInput}
                  onChange={(e) => setBatchLabelInput(e.target.value)}
                  placeholder="Identificador do lote (ex.: Implantação Coleção Outono 500 itens)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  disabled={!selectedTenantId}
                  onClick={handleCreateBatch}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm disabled:opacity-40 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Iniciar Novo Lote</span>
                </button>
              </div>
            </section>

            {/* Retomar lotes persistidos (§11) */}
            <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                <span>Retomar Lote Anterior</span>
              </h3>
              {savedBatches.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum lote salvo localmente ainda.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {savedBatches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleResumeBatch(b.id)}
                      className="w-full text-left rounded-xl border border-slate-800 bg-slate-950/70 hover:border-emerald-500/40 p-3 space-y-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">{b.label}</span>
                        <span className="font-mono text-[10px] text-amber-300">{b.status}</span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-400">
                        {b.tenantName} · {b.itemCount} itens ({b.importedCount} imp.)
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ================================================================ */}
        {/* TELA 2 — ESCOLHER MÉTODO                                         */}
        {/* ================================================================ */}
        {step === 2 && activeBatch && (
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Tela 2 — Escolher Método de Digitalização
              </h2>
              <p className="text-xs text-slate-400">
                Você pode combinar múltiplos métodos no mesmo lote (ex.: importar planilha + completar itens físicos com scanner ou foto).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  tab: "barcode" as CaptureTab,
                  icon: ScanBarcode,
                  title: "Scanner de Código de Barras",
                  desc: "Webcam, câmera do celular, leitor USB (teclado), digitação manual EAN-13/EAN-8/UPC-A ou imagem com código de barras.",
                },
                {
                  tab: "photo_ocr" as CaptureTab,
                  icon: Camera,
                  title: "Scanner por Fotografia + OCR Local",
                  desc: "Fotografe produto, embalagem ou etiqueta. OCR local (Tesseract) extrai texto, GTIN, cor, tamanho e volume sem custo recorrente.",
                },
                {
                  tab: "spreadsheet" as CaptureTab,
                  icon: FileSpreadsheet,
                  title: "Planilhas Excel, CSV e Catálogos PDF",
                  desc: "Detecção automática de colunas, mapeamento assistido de SKU, GTIN, preços, estoque, categorias e variantes em lote.",
                },
                {
                  tab: "manual" as CaptureTab,
                  icon: Layers,
                  title: "Cadastro Rápido sem Código de Barras",
                  desc: "Para produtos artesanais, peças exclusivas ou itens sem etiqueta EAN.",
                },
              ].map((card) => (
                <button
                  key={card.tab}
                  type="button"
                  onClick={() => {
                    setCaptureTab(card.tab);
                    setStep(3);
                  }}
                  className="text-left rounded-2xl border border-slate-800 bg-slate-900/75 hover:border-emerald-500/50 hover:bg-slate-900 p-5 space-y-2 transition-all cursor-pointer"
                >
                  <card.icon className="w-6 h-6 text-emerald-400" />
                  <h3 className="font-display text-base font-bold text-white">{card.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* TELA 3 — CAPTURAR PRODUTOS                                       */}
        {/* ================================================================ */}
        {step === 3 && activeBatch && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["barcode", "Código de Barras"],
                    ["photo_ocr", "Fotografia + OCR"],
                    ["spreadsheet", "CSV / Excel / PDF"],
                    ["manual", "Sem Código (Manual)"],
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setCaptureTab(tabKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      captureTab === tabKey
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25 text-xs font-semibold cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Ir para Revisão ({activeBatch.items.length} itens) →</span>
              </button>
            </div>

            {captureTab === "barcode" && (
              <BarcodeCameraScanner
                capturedCount={activeBatch.items.length}
                duplicateScanPolicy={activeBatch.duplicateScanPolicy}
                onChangeDuplicatePolicy={handleUpdateDuplicatePolicy}
                onCodeCaptured={handleBarcodeCaptured}
              />
            )}

            {captureTab === "photo_ocr" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-white">
                  Scanner por Fotografia & OCR Local (Tesseract `por+eng`, custo zero)
                </h3>
                <p className="text-xs text-slate-400">
                  Envie foto da embalagem, etiqueta ou produto. O sistema valida a assinatura da imagem, extrai apenas texto efetivamente visível e sinaliza ambiguidades para revisão humana.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/60 p-8 text-center cursor-pointer">
                    <Camera className="w-7 h-7 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">
                      {ocrBusy ? "Executando OCR local..." : "Fotografar / Enviar Etiqueta com OCR"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      PNG, JPEG ou WebP (máx. 5 MB)
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      capture="environment"
                      disabled={ocrBusy}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void handlePhotoOcrUpload(f, false);
                      }}
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-800 hover:border-slate-600 bg-slate-950/40 p-8 text-center cursor-pointer">
                    <Upload className="w-7 h-7 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-200">
                      Apenas Foto do Produto (sem OCR)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Cria rascunho já com a fotografia validada para preenchimento rápido
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={ocrBusy}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void handlePhotoOcrUpload(f, true);
                      }}
                    />
                  </label>
                </div>
                {ocrFeedback && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                    {ocrFeedback}
                  </div>
                )}
              </div>
            )}

            {captureTab === "spreadsheet" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-white">
                  Importação de Planilhas (.csv, .xlsx) e Catálogos (.pdf)
                </h3>
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/60 p-7 text-center cursor-pointer">
                  <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">
                    {fileBusy
                      ? "Analisando arquivo..."
                      : "Selecionar arquivo .csv, .xlsx ou .pdf"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Detecção automática de delimitador, preços brasileiros, SKU, GTIN, estoque, categorias e variantes
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.pdf"
                    disabled={fileBusy}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void handleSpreadsheetSelect(f);
                    }}
                  />
                </label>

                {filePreview && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        <strong className="text-white">{filePreview.fileName}</strong>{" "}
                        <span className="text-slate-400 font-mono">
                          · {filePreview.totalRows} linha(s) · {filePreview.sourceType.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {filePreview.pdfMeta?.warnings.map((w, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 text-xs text-amber-200"
                      >
                        {w}
                      </div>
                    ))}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(
                        [
                          ["name", "Nome *"],
                          ["sku", "SKU"],
                          ["gtin", "GTIN / EAN"],
                          ["category", "Categoria"],
                          ["price", "Preço"],
                          ["stock", "Estoque"],
                          ["variantName", "Variante"],
                          ["size", "Tamanho"],
                          ["color", "Cor"],
                          ["brand", "Marca"],
                          ["description", "Descrição"],
                          ["imageUrl", "URL/Ref Imagem"],
                        ] as Array<[CanonicalColumnKey, string]>
                      ).map(([fieldKey, label]) => (
                        <div key={fieldKey}>
                          <label className="block text-[10px] text-slate-400 mb-1">{label}</label>
                          <select
                            value={columnMapping[fieldKey] || ""}
                            onChange={(e) =>
                              setColumnMapping((prev) => ({
                                ...prev,
                                [fieldKey]: e.target.value || undefined,
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          >
                            <option value="">— Não mapear —</option>
                            {filePreview.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {filePreview.sourceType !== "pdf" && (
                      <div className="flex flex-wrap gap-4 text-xs text-slate-200">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmSheetPrices}
                            onChange={(e) => setConfirmSheetPrices(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          <span>Preços desta planilha foram fornecidos pelo estabelecimento</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmSheetStock}
                            onChange={(e) => setConfirmSheetStock(e.target.checked)}
                            className="accent-emerald-500"
                          />
                          <span>Estoques desta planilha foram fornecidos pelo estabelecimento</span>
                        </label>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={fileBusy || filePreview.totalRows === 0}
                        onClick={handleSpreadsheetCommit}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs disabled:opacity-40 cursor-pointer"
                      >
                        Carregar {filePreview.totalRows} Linha(s) na Estação de Revisão
                      </button>
                    </div>
                  </div>
                )}

                {fileFeedback && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                    {fileFeedback}
                  </div>
                )}
              </div>
            )}

            {captureTab === "manual" && (
              <form
                onSubmit={handleAddManualItem}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4"
              >
                <h3 className="font-display text-base font-bold text-white">
                  Adicionar Produto sem Código de Barras
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <input
                    type="text"
                    required
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Nome comercial *"
                    className="lg:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value)}
                    placeholder="SKU (opcional)"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Preço R$ (lojista)"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                  <input
                    type="number"
                    min="0"
                    value={manualStock}
                    onChange={(e) => setManualStock(e.target.value)}
                    placeholder="Estoque"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-white"
                  />
                  <input
                    type="text"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    placeholder="Categoria"
                    className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
                  >
                    Adicionar à Fila
                  </button>
                </div>
              </form>
            )}

            {/* Prévia rápida dos últimos itens capturados */}
            {activeBatch.items.length > 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Últimos itens capturados neste lote ({activeBatch.items.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-emerald-300 hover:underline cursor-pointer"
                  >
                    Abrir Estação de Revisão →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeBatch.items.slice(0, 6).map((it) => (
                    <div
                      key={it.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">
                          {it.name || `(GTIN ${it.gtin || "sem código"} — pendente)`}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {it.gtin || it.variants[0]?.sku} · {it.lookupStatus}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-amber-300 shrink-0">
                        {it.pendingReasons.length === 0 ? "Pronto" : `${it.pendingReasons.length} pend.`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ================================================================ */}
        {/* TELA 4 — REVISAR                                                 */}
        {/* ================================================================ */}
        {step === 4 && activeBatch && (
          <ReviewStation
            batch={activeBatch}
            tenantStore={activeTenantStore}
            onBatchUpdated={setActiveBatch}
            onProceedToDeploy={() => setStep(5)}
          />
        )}

        {/* ================================================================ */}
        {/* TELA 5 — IMPLANTAR CATÁLOGO                                      */}
        {/* ================================================================ */}
        {step === 5 && activeBatch && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-emerald-400" />
                  <span>Tela 5 — Prévia e Implantação Controlada no Retail</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Todos os novos produtos serão criados em estado <strong>rascunho (draft)</strong> usando exclusivamente os serviços oficiais do Retail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadDeployPreview(activeBatch.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Prévia</span>
              </button>
            </div>

            {deployPreview && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  ["Novos Rascunhos", deployPreview.willCreateDraftCount, "text-emerald-300"],
                  ["Atualizações", deployPreview.willUpdateCount, "text-sky-300"],
                  ["Novas Variantes", deployPreview.willCreateVariantCount, "text-violet-300"],
                  ["Duplicados Ignorados", deployPreview.willSkipDuplicateCount, "text-amber-300"],
                  ["Novas Categorias", deployPreview.newCategoriesToCreate.length, "text-teal-300"],
                  ["Imagens p/ Storage", deployPreview.imagesToUploadCount, "text-slate-100"],
                ].map(([label, val, cls]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
                  >
                    <div className="text-[11px] text-slate-400">{label}</div>
                    <div className={`font-mono text-2xl font-bold mt-1 ${cls}`}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {deployPreview && deployPreview.newCategoriesToCreate.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs">
                <span className="text-slate-400">Categorias novas a criar via RetailCategoryService: </span>
                <span className="font-mono text-emerald-300">
                  {deployPreview.newCategoriesToCreate.join(", ")}
                </span>
              </div>
            )}

            <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-4 space-y-3">
              <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deployConfirmChecked}
                  onChange={(e) => setDeployConfirmChecked(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  Confirmo explicitamente implantar os itens aprovados deste lote (
                  <strong className="font-mono">{activeBatch.id}</strong>) no estabelecimento{" "}
                  <strong>{activeBatch.tenantName}</strong> (loja{" "}
                  <strong className="font-mono">/loja/{activeBatch.storeSlug}</strong>) em{" "}
                  <strong>Supabase Staging</strong> como rascunhos (draft).
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!deployConfirmChecked || deploying}
                  onClick={() => handleExecuteImport(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm disabled:opacity-40 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>
                    {deploying
                      ? "Implantando lote (concorrência controlada)..."
                      : "Aprovar e Implantar no Supabase Staging"}
                  </span>
                </button>

                {deploying && (
                  <button
                    type="button"
                    onClick={handleRequestPause}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-200 text-xs font-semibold cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Solicitar Pausa Segura</span>
                  </button>
                )}

                {activeBatch.items.some(
                  (i) => i.status === "failed" || i.status === "partial_image_failed"
                ) && (
                  <button
                    type="button"
                    disabled={!deployConfirmChecked || deploying}
                    onClick={() => handleExecuteImport(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/15 text-sky-200 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reprocessar Apenas Falhos / Parciais</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* TELA 6 — RESULTADO                                               */}
        {/* ================================================================ */}
        {step === 6 && activeBatch && (
          <section className="space-y-5">
            <div className="rounded-2xl border border-emerald-500/35 bg-slate-900/80 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Tela 6 — Relatório de Implantação do Lote</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    {activeBatch.tenantName} · /loja/{activeBatch.storeSlug} · {activeBatch.id}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadReportJson}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Relatório JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs cursor-pointer"
                  >
                    Voltar para Revisão / Retomar
                  </button>
                </div>
              </div>

              {activeBatch.lastImportSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                  {[
                    ["Importados (Draft)", activeBatch.lastImportSummary.importedCount, "text-emerald-300"],
                    ["Atualizados", activeBatch.lastImportSummary.updatedCount, "text-sky-300"],
                    ["Duplicados Evitados", activeBatch.lastImportSummary.duplicatesAvoidedCount, "text-amber-300"],
                    ["Imagens Storage", activeBatch.lastImportSummary.imagesUploadedCount, "text-teal-300"],
                    ["Categorias Criadas", activeBatch.lastImportSummary.categoriesCreatedCount, "text-violet-300"],
                    ["Parciais (Img)", activeBatch.lastImportSummary.partialImageFailedCount, "text-orange-300"],
                    ["Falhos", activeBatch.lastImportSummary.failedCount, "text-rose-300"],
                    ["Tempo Total", `${(activeBatch.lastImportSummary.durationMs / 1000).toFixed(1)}s`, "text-slate-100"],
                  ].map(([lbl, val, cls]) => (
                    <div
                      key={String(lbl)}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <div className="text-[10px] text-slate-400">{lbl}</div>
                      <div className={`font-mono text-lg font-bold mt-1 ${cls}`}>{val}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px]">
                    <tr>
                      <th className="px-3 py-2.5">Produto</th>
                      <th className="px-3 py-2.5">SKU / GTIN</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">ID Retail / Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {activeBatch.items.map((it) => (
                      <tr key={it.id} className="bg-slate-900/40">
                        <td className="px-3 py-2 text-white font-medium">
                          {it.name || "(Sem nome)"}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {it.variants[0]?.sku || "—"} {it.gtin ? `· ${it.gtin}` : ""}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span
                            className={
                              it.status === "imported" || it.status === "updated"
                                ? "text-emerald-300"
                                : it.status === "skipped"
                                ? "text-amber-300"
                                : it.status === "failed" || it.status === "partial_image_failed"
                                ? "text-rose-300"
                                : "text-slate-400"
                            }
                          >
                            {it.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                          {it.lastError || it.importedProductId || "Aguardando aprovação"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
