import { NextRequest, NextResponse } from "next/server";
import { requireScannerOwner } from "@scanner/lib/auth";
import { detectImageSignature, readStagedImageFile } from "@scanner/lib/images";
import { handleScannerApiError } from "@scanner/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string; path: string[] }> }
) {
  try {
    await requireScannerOwner();
    const { batchId, path: segments } = await context.params;
    const safeBatch = batchId.replace(/[^a-zA-Z0-9_-]/g, "");
    const rel = `${safeBatch}/${segments.join("/")}`;
    const buf = readStagedImageFile(rel);
    const sig = detectImageSignature(buf);
    if (!sig) {
      return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
    }
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": sig.mimeType,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (err) {
    return handleScannerApiError(err);
  }
}
