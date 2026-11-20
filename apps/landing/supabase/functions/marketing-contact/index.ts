import { createClient } from "npm:@supabase/supabase-js@2";
import {
  handleMarketingContactRequest,
  type LeadRepository,
} from "./handler.ts";

function parseListEnv(name: string, fallback: string[]): string[] {
  const raw = Deno.env.get(name)?.trim();
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

Deno.serve(async (request: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Configuração do servidor incompleta.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const repo: LeadRepository = {
    async countRecentByIpHash(ipHash: string, sinceIso: string) {
      const { count, error } = await supabaseAdmin
        .from("marketing_leads")
        .select("id", { count: "exact", head: true })
        .eq("client_ip_hash", ipHash)
        .gte("created_at", sinceIso);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async hasRecentDuplicate(dedupeHash: string, sinceIso: string) {
      const { data, error } = await supabaseAdmin
        .from("marketing_leads")
        .select("id")
        .eq("dedupe_hash", dedupeHash)
        .gte("created_at", sinceIso)
        .limit(1);
      if (error) throw new Error(error.message);
      return Boolean(data && data.length > 0);
    },

    async insertLead(record) {
      const { data, error } = await supabaseAdmin
        .from("marketing_leads")
        .insert(record)
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(error?.message || "lead_insert_failed");
      }
      return { id: data.id as string };
    },
  };

  try {
    return await handleMarketingContactRequest(request, repo, {
      allowedOrigins: parseListEnv("MARKETING_ALLOWED_ORIGINS", [
        "https://devessent-landing.pages.dev",
      ]),
      allowedTurnstileHostnames: parseListEnv(
        "TURNSTILE_ALLOWED_HOSTNAMES",
        ["devessent-landing.pages.dev"]
      ),
      expectedTurnstileAction:
        Deno.env.get("TURNSTILE_EXPECTED_ACTION") || "marketing_contact",
      turnstileSecretKey: Deno.env.get("TURNSTILE_SECRET_KEY") || "",
      requireTurnstile:
        (Deno.env.get("TURNSTILE_REQUIRED") ?? "true").toLowerCase() !== "false",
      logger: (event) => console.log(JSON.stringify(event)),
    });
  } catch {
    console.error(
      JSON.stringify({ event: "marketing_contact_unhandled_error" })
    );
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Erro interno ao processar a solicitação.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
});
