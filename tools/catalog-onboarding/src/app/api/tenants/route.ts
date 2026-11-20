import { requireScannerOwner } from "@scanner/lib/auth";
import { createScannerPrivilegedClient } from "@scanner/lib/supabase";
import { listActiveTenantsAndStores } from "@scanner/lib/retail-importer";
import { handleScannerApiError, jsonNoStore } from "@scanner/lib/api-helpers";

export async function GET() {
  try {
    await requireScannerOwner();
    const supabase = createScannerPrivilegedClient();
    const tenants = await listActiveTenantsAndStores(supabase);
    return jsonNoStore({ ok: true, tenants });
  } catch (err) {
    return handleScannerApiError(err);
  }
}
