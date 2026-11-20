import { NextResponse } from "next/server";
import { ScannerAuthError } from "./auth";

export function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      Vary: "Cookie",
    },
  });
}

export function handleScannerApiError(err: unknown): NextResponse {
  if (err instanceof ScannerAuthError) {
    return jsonNoStore({ ok: false, error: err.message }, err.statusCode);
  }
  const message =
    err instanceof Error ? err.message : "Erro inesperado no DevEssent Catalog Scanner.";
  const status =
    message.includes("não encontrado") || message.includes("não localizado")
      ? 404
      : message.includes("BLOQUEIO") || message.includes("Acesso negado")
      ? 403
      : message.includes("inválid") || message.includes("obrigat") || message.includes("excede")
      ? 400
      : 500;
  return jsonNoStore({ ok: false, error: message }, status);
}
