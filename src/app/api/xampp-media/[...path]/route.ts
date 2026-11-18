import { NextResponse, type NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { isXamppTestMode } from "@/lib/environment/backend-mode";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env.NODE_ENV === "production" || !isXamppTestMode()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relPath = segments.join("/");
  if (relPath.includes("..") || relPath.includes("\0")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { resolveSafeStoragePath } = await import("@/infrastructure/xampp-test/storage");

  try {
    const fullPath = resolveSafeStoragePath(relPath);
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : null;

    if (!contentType) {
      return NextResponse.json({ error: "Forbidden format" }, { status: 403 });
    }

    const data = await fs.promises.readFile(fullPath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

