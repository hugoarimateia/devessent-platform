import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildSafeSku, computeGs1CheckDigit, validateGtin } from "@scanner/lib/barcode";
import {
  evaluateOwnerAuthorization,
  signScannerSessionToken,
  verifyScannerSessionToken,
} from "@scanner/lib/auth";
import {
  assertSafeAuthorizedImageUrl,
  validateImageBuffer,
} from "@scanner/lib/images";
import { parseOcrProductText } from "@scanner/lib/ocr";
import {
  applyColumnMapping,
  parseCsvBuffer,
  parseFlexiblePriceToCents,
  parseXlsxBuffer,
} from "@scanner/lib/importers";
import {
  createScannerBatchItem,
  evaluateItemReadiness,
  selectEligibleBatchItems,
} from "@scanner/lib/batch-store";
import { loadAuthorizedLocalSupplierCatalogs } from "@scanner/lib/lookup";
import type { ScannerBatch } from "@scanner/lib/types";

// Gera um PNG válido mínimo (100x80) com cabeçalho IHDR real
function buildMinimalValidPng(width = 100, height = 80): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from("IHDR", "ascii");
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  const padding = Buffer.alloc(48, 0x00);
  return Buffer.concat([sig, ihdrLen, ihdrType, ihdrData, padding]);
}

describe("DevEssent Catalog Scanner — GTIN, Segurança, Imagens, OCR e Importadores", () => {
  it("valida EAN-13, EAN-8, UPC-A e rejeita dígitos verificadores incorretos ou zeros", () => {
    expect(computeGs1CheckDigit("789100010010")).toBe(3);
    expect(validateGtin("7891000100103")).toMatchObject({
      valid: true,
      format: "EAN-13",
      normalized: "7891000100103",
    });
    expect(validateGtin("78910003")).toMatchObject({ valid: true, format: "EAN-8" });
    expect(validateGtin("012345678905")).toMatchObject({ valid: true, format: "UPC-A" });

    // Verifica que 100% dos GTINs no catálogo autorizado de demonstração têm dígito verificador GS1 válido
    const localCatalog = loadAuthorizedLocalSupplierCatalogs(true);
    expect(localCatalog.size).toBeGreaterThanOrEqual(10);
    for (const [gtin] of localCatalog.entries()) {
      expect(validateGtin(gtin).valid, `GTIN inválido no catálogo autorizado: ${gtin}`).toBe(true);
    }

    // Dígito verificador adulterado
    expect(validateGtin("7891000100104").valid).toBe(false);
    // Zeros degenerados
    expect(validateGtin("0000000000000").valid).toBe(false);
    // Comprimento inválido
    expect(validateGtin("12345").valid).toBe(false);

    expect(buildSafeSku({ explicitSku: "Blazer Linho #01!" })).toBe("BLAZER-LINHO-01");
  });

  it("impõe dupla autorização estrita (bloqueia platform_admin fora da allowlist e qualquer tenant role)", () => {
    const ownerUuid = "0e638015-ecc4-40ba-b8a5-d97a8a0e6fe2";
    const otherAdminUuid = "11111111-1111-4111-8111-111111111111";
    const config = {
      allowedUserIds: [ownerUuid],
      allowedEmails: ["admin.staging@devessent-demo.com"],
    };

    // Proprietário autorizado na allowlist + platform_admin
    expect(
      evaluateOwnerAuthorization({
        userId: ownerUuid,
        email: "admin.staging@devessent-demo.com",
        isPlatformAdmin: true,
        config,
      }).authorized
    ).toBe(true);

    // Outro platform_admin NÃO listado na allowlist -> BLOQUEADO (§2)
    expect(
      evaluateOwnerAuthorization({
        userId: otherAdminUuid,
        email: "outro.admin@devessent-demo.com",
        isPlatformAdmin: true,
        config,
      }).authorized
    ).toBe(false);

    // Owner/manager/staff de tenant (isPlatformAdmin=false) -> BLOQUEADO mesmo que UUID coincidisse (§2)
    expect(
      evaluateOwnerAuthorization({
        userId: ownerUuid,
        email: "admin.staging@devessent-demo.com",
        isPlatformAdmin: false,
        config,
      }).authorized
    ).toBe(false);

    // Assinatura HMAC do cookie de sessão
    const secret = "scanner-test-secret-key-with-at-least-32-chars";
    const token = signScannerSessionToken(
      {
        uid: ownerUuid,
        email: "admin.staging@devessent-demo.com",
        fullName: "Admin",
        at: "jwt-sample",
        exp: Date.now() + 60_000,
      },
      secret
    );
    expect(verifyScannerSessionToken(token, secret)?.uid).toBe(ownerUuid);
    expect(verifyScannerSessionToken(`${token}x`, secret)).toBeNull();
  });

  it("valida assinatura binária/dimensões de imagens e bloqueia SSRF em URLs remotas (§10)", () => {
    const validPng = buildMinimalValidPng(640, 480);
    const checked = validateImageBuffer(validPng, "Etiqueta Produto 01.png", "image/png");
    expect(checked.mimeType).toBe("image/png");
    expect(checked.width).toBe(640);
    expect(checked.height).toBe(480);
    expect(checked.sha256).toHaveLength(64);

    // Arquivo texto disfarçado de .png -> rejeitado por magic bytes
    expect(() =>
      validateImageBuffer(Buffer.from("<html>fake image payload</html>".repeat(4)), "evil.png", "image/png")
    ).toThrow(/assinatura binária/i);

    // Anti-SSRF
    expect(() =>
      assertSafeAuthorizedImageUrl("http://cdn.fornecedor.com/a.jpg", ["cdn.fornecedor.com"])
    ).toThrow(/HTTPS/i);
    expect(() =>
      assertSafeAuthorizedImageUrl("https://169.254.169.254/latest/meta-data", ["169.254.169.254"])
    ).toThrow(/ANTI-SSRF/i);
    expect(() =>
      assertSafeAuthorizedImageUrl("https://127.0.0.1/internal.png", ["127.0.0.1"])
    ).toThrow(/ANTI-SSRF/i);
    expect(() =>
      assertSafeAuthorizedImageUrl("https://evil.example.com/a.jpg", ["cdn.fornecedor.com"])
    ).toThrow(/não está na lista/i);
    expect(
      assertSafeAuthorizedImageUrl("https://cdn.fornecedor.com/produtos/a.jpg", ["cdn.fornecedor.com"])
        .hostname
    ).toBe("cdn.fornecedor.com");
  });

  it("extrai apenas dados presentes no texto OCR e marca preço de etiqueta como não confirmado (§5)", () => {
    const sampleLabel = [
      "Difusor de Ambiente Alecrim",
      "Marca: Casa Essenza",
      "REF: DIF-ALE-250",
      "250ml · Cor: Verde · Tam: UN",
      "7891000100608",
      "R$ 129,90",
    ].join("\n");

    const parsed = parseOcrProductText(sampleLabel, 88);
    expect(parsed.suggestedName).toBe("Difusor de Ambiente Alecrim");
    expect(parsed.brand).toBe("Casa Essenza");
    expect(parsed.skuCandidate).toBe("DIF-ALE-250");
    expect(parsed.gtin).toBe("7891000100608");
    expect(parsed.presentation).toBe("250ml");
    expect(parsed.color).toBe("Verde");
    expect(parsed.unconfirmedPriceCents).toBe(12990);
    expect(parsed.ambiguous).toBe(false);

    const lowConf = parseOcrProductText("...", 32);
    expect(lowConf.suggestedName).toBeNull();
    expect(lowConf.ambiguous).toBe(true);
  });

  it("importa CSV brasileiro (; + BOM + R$) e planilha Excel .xlsx real via exceljs (§6)", async () => {
    expect(parseFlexiblePriceToCents("R$ 1.259,90")).toBe(125990);
    expect(parseFlexiblePriceToCents("89,50")).toBe(8950);

    const csv =
      "\uFEFFProduto;SKU;EAN;Categoria;Preço;Estoque;Tamanho;Cor\n" +
      '"Camisa Linho Cru";CAM-001;7891000100103;Camisaria;"R$ 249,90";12;M;Cru\n' +
      '"Camisa Linho Cru";CAM-002;;Camisaria;"R$ 249,90";8;G;Cru\n';
    const csvPreview = parseCsvBuffer(Buffer.from(csv, "utf-8"), "cliente.csv");
    expect(csvPreview.totalRows).toBe(2);
    expect(csvPreview.suggestedMapping.name).toBe("Produto");
    expect(csvPreview.suggestedMapping.price).toBe("Preço");
    const mappedCsv = applyColumnMapping(csvPreview.allRows, csvPreview.suggestedMapping, "cliente.csv");
    expect(mappedCsv[0].priceCents).toBe(24990);
    expect(mappedCsv[0].stockQuantity).toBe(12);
    expect(mappedCsv[0].optionsSummary).toEqual({ Cor: "Cru", Tamanho: "M" });

    // Gerar .xlsx real em memória
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Catalogo");
    ws.addRow(["Nome", "SKU", "GTIN", "Categoria", "Valor", "Qtd"]);
    ws.addRow(["Vela Figo 190g", "VEL-01", "7891000100509", "Casa & Aromas", 89.9, 25]);
    const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer());
    const xlsxPreview = await parseXlsxBuffer(xlsxBuf, "catalogo.xlsx");
    expect(xlsxPreview.totalRows).toBe(1);
    const mappedXlsx = applyColumnMapping(
      xlsxPreview.allRows,
      xlsxPreview.suggestedMapping,
      "catalogo.xlsx"
    );
    expect(mappedXlsx[0].name).toBe("Vela Figo 190g");
    expect(mappedXlsx[0].priceCents).toBe(8990);
    expect(mappedXlsx[0].stockQuantity).toBe(25);
  });

  it("bloqueia aprovação sem confirmação comercial de preço/estoque e protege duplicados contra sobrescrita (§7, §9)", () => {
    const dummyBatch: ScannerBatch = {
      id: "lote-test",
      label: "Teste",
      environment: "staging",
      tenantId: "00000000-0000-4000-8000-000000000001",
      tenantName: "Ateliê Demonstrativo",
      tenantSlug: "atelie-demonstrativo",
      storeId: "00000000-0000-4000-8000-000000000002",
      storeName: "Ateliê",
      storeSlug: "atelie-demonstrativo",
      defaultCategoryId: null,
      defaultCategoryName: null,
      duplicateScanPolicy: "ignore",
      createdByUserId: "00000000-0000-4000-8000-000000000003",
      createdByEmail: "admin@devessent.test",
      status: "open",
      pauseRequested: false,
      items: [],
      lastImportSummary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const item = createScannerBatchItem({
      batch: dummyBatch,
      captureMethod: "barcode_manual",
      gtin: "7891000100103",
      name: "Camisa Linho",
      priceConfirmedByMerchant: false,
      stockConfirmedByMerchant: false,
    });
    item.variants[0].priceCents = 19900;
    item.variants[0].stockQuantity = 10;

    // Sem confirmação explícita do lojista -> bloqueado!
    expect(evaluateItemReadiness(item).canApprove).toBe(false);

    // Após confirmação explícita -> liberado!
    item.priceConfirmedByMerchant = true;
    item.stockConfirmedByMerchant = true;
    expect(evaluateItemReadiness(item).canApprove).toBe(true);

    // Se for duplicado em modo update_selected tentando atualizar preço sem allowOverwritePrice -> bloqueado!
    item.duplicateMatch = {
      matchType: "sku",
      existingProductId: "p1",
      existingProductName: "Camisa Linho",
      existingSlug: "camisa-linho",
      existingStatus: "published",
      matchedSku: "EAN-7891000100103",
      matchedVariantId: "v1",
      existingPriceCents: 18900,
      existingStockQuantity: 5,
    };
    item.duplicateResolution = "update_selected";
    item.updateFields = ["price"];
    item.allowOverwritePrice = false;
    expect(evaluateItemReadiness(item).canApprove).toBe(false);

    item.allowOverwritePrice = true;
    expect(evaluateItemReadiness(item).canApprove).toBe(true);
  });

  it("preserva idempotência na retomada de lote ignorando imported, updated e skipped (mesmo com importedProductId)", () => {
    const dummyBatch: ScannerBatch = {
      id: "lote-idempotencia",
      label: "Idempotência",
      environment: "staging",
      tenantId: "00000000-0000-4000-8000-000000000001",
      tenantName: "Ateliê Demonstrativo",
      tenantSlug: "atelie-demonstrativo",
      storeId: "00000000-0000-4000-8000-000000000002",
      storeName: "Ateliê",
      storeSlug: "atelie-demonstrativo",
      defaultCategoryId: null,
      defaultCategoryName: null,
      duplicateScanPolicy: "ignore",
      createdByUserId: "00000000-0000-4000-8000-000000000003",
      createdByEmail: "admin@devessent.test",
      status: "completed_with_errors",
      pauseRequested: false,
      items: [],
      lastImportSummary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mk = (
      name: string,
      status: ScannerBatch["items"][number]["status"],
      approved = true,
      importedProductId: string | null = null
    ) => {
      const it = createScannerBatchItem({
        batch: dummyBatch,
        captureMethod: "barcode_manual",
        name,
        priceConfirmedByMerchant: true,
        stockConfirmedByMerchant: true,
      });
      it.status = status;
      it.approved = approved;
      it.importedProductId = importedProductId;
      return it;
    };

    const items = [
      mk("Já Importado", "imported", true, "prod-1"),
      mk("Já Atualizado", "updated", true, "prod-2"),
      mk("Duplicado Ignorado", "skipped", true, "prod-existing"),
      mk("Falha de Imagem", "partial_image_failed", true, "prod-3"),
      mk("Falha Geral", "failed", true, null),
      mk("Novo Aprovado", "approved", true, null),
      mk("Pendente Não Aprovado", "captured", false, null),
    ];

    const fullResume = selectEligibleBatchItems(items, false);
    expect(fullResume.map((x) => x.name)).toEqual([
      "Falha de Imagem",
      "Falha Geral",
      "Novo Aprovado",
    ]);

    const retryFailedOnly = selectEligibleBatchItems(items, true);
    expect(retryFailedOnly.map((x) => x.name)).toEqual(["Falha de Imagem", "Falha Geral"]);
  });
});
