import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { ValidationError } from "@/core/errors/app-error";
import { assertXamppRuntimeAllowed } from "./db";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function getXamppStorageRoot(): string {
  assertXamppRuntimeAllowed();
  const dir = process.env.XAMPP_STORAGE_DIR || "local-test/xampp/storage";
  return path.resolve(process.cwd(), dir);
}

export function resolveSafeStoragePath(relativePath: string): string {
  const root = getXamppStorageRoot();
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.resolve(root, normalized);

  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) {
    throw new ValidationError("Caminho de arquivo inválido ou fora do diretório autorizado.");
  }

  return fullPath;
}

export class XamppStorageAdapter {
  public static async saveProductImage(params: {
    tenantId: string;
    productId: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<{ storagePath: string; publicUrl: string }> {
    assertXamppRuntimeAllowed();

    const ext = ALLOWED_MIME_TO_EXT[params.mimeType];
    if (!ext) {
      throw new ValidationError(
        "Formato de imagem não permitido. Use apenas JPEG, PNG ou WebP."
      );
    }

    if (params.buffer.byteLength === 0 || params.buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError("Arquivo deve ter entre 1 byte e 5 MB.");
    }

    const safeTenant = params.tenantId.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeProduct = params.productId.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${randomUUID()}.${ext}`;
    const relativePath = `${safeTenant}/${safeProduct}/${fileName}`;
    const fullPath = resolveSafeStoragePath(relativePath);

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, params.buffer);

    return {
      storagePath: relativePath,
      publicUrl: `/api/xampp-media/${relativePath}`,
    };
  }

  public static async deleteProductImage(relativePath: string): Promise<void> {
    assertXamppRuntimeAllowed();
    const fullPath = resolveSafeStoragePath(relativePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }
}

