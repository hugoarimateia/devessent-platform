import { NextRequest } from "next/server";
import {
  authenticateScannerOwner,
  clearScannerSession,
  requireScannerOwner,
} from "@scanner/lib/auth";
import { getScannerServerConfig } from "@scanner/lib/env";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";

export async function GET() {
  try {
    const owner = await requireScannerOwner();
    const cfg = getScannerServerConfig();
    return jsonNoStore({
      ok: true,
      authenticated: true,
      owner: {
        userId: owner.userId,
        email: owner.email,
        fullName: owner.fullName,
      },
      environment: cfg.env,
      supabaseHost: cfg.supabaseHost,
      openLookupMode: cfg.openLookupMode,
    });
  } catch (err) {
    const cfgInfo = (() => {
      try {
        const cfg = getScannerServerConfig();
        return { environment: cfg.env, supabaseHost: cfg.supabaseHost };
      } catch {
        return { environment: "staging", supabaseHost: "unconfigured" };
      }
    })();
    if (err instanceof Error && err.name === "ScannerAuthError") {
      return jsonNoStore(
        {
          ok: true,
          authenticated: false,
          ...cfgInfo,
        },
        200
      );
    }
    return handleScannerApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return jsonNoStore({ ok: false, error: "Informe e-mail e senha." }, 400);
    }

    const owner = await authenticateScannerOwner(body.email, body.password);
    const cfg = getScannerServerConfig();
    return jsonNoStore({
      ok: true,
      authenticated: true,
      owner: {
        userId: owner.userId,
        email: owner.email,
        fullName: owner.fullName,
      },
      environment: cfg.env,
      supabaseHost: cfg.supabaseHost,
      openLookupMode: cfg.openLookupMode,
    });
  } catch (err) {
    return handleScannerApiError(err);
  }
}

export async function DELETE() {
  try {
    await clearScannerSession();
    return jsonNoStore({ ok: true, authenticated: false });
  } catch (err) {
    return handleScannerApiError(err);
  }
}
