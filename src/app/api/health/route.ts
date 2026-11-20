import { NextResponse } from "next/server";
import { getAppBackendMode, isXamppTestMode } from "@/lib/environment/backend-mode";

function resolveSafeDatabaseHost(): string {
  if (isXamppTestMode()) {
    return "mariadb-local";
  }
  try {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!rawUrl) return "unconfigured";
    return new URL(rawUrl).hostname;
  } catch {
    return "invalid-url";
  }
}

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "devessent-platform-core",
      version: "1.0.0",
      environment: process.env.NEXT_PUBLIC_APP_ENV || "development",
      backendMode: getAppBackendMode(),
      databaseHost: resolveSafeDatabaseHost(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

