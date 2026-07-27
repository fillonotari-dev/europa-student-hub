// TEMPORANEA — utility di migrazione one-shot da eliminare dopo
// che tutti i path 'pending/...' nella tabella documenti sono stati
// spostati a 'candidature/...'. Non fa parte del sistema runtime.
//
// Uso: POST /functions/v1/migrate-pending-docs
//   Header:  Authorization: Bearer <ACCESS_TOKEN admin>
//   Query:   ?dry_run=true    conta senza spostare
//            ?limit=N         batch size (default 500)
// Ritorna un resoconto JSON con scanned/moved/skipped_missing/skipped_conflict/failed.
// Idempotente: rieseguire finché moved > 0.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "documenti_studenti";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "true";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "500", 10) || 500, 1), 2000);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verifica autenticazione + ruolo admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) return json({ error: "Forbidden" }, 403);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Carica righe da migrare.
    const { data: rows, error: qErr } = await supabase
      .from("documenti")
      .select("id, candidatura_id, tipo, url")
      .like("url", "pending/%")
      .not("candidatura_id", "is", null)
      .limit(limit);
    if (qErr) throw qErr;

    const result = {
      dry_run: dryRun,
      scanned: rows?.length ?? 0,
      moved: 0,
      skipped_missing: 0,
      skipped_conflict: 0,
      failed: 0,
      errors: [] as Array<{ id: string; reason: string }>,
    };

    for (const row of rows ?? []) {
      const tempPath: string = row.url;
      const filename = tempPath.split("/").pop() ?? "";
      if (!filename || !row.tipo || !row.candidatura_id) {
        result.failed++;
        result.errors.push({ id: row.id, reason: "campo_mancante" });
        continue;
      }
      const finalPath = `candidature/${row.candidatura_id}/${row.tipo}/${filename}`;

      if (tempPath === finalPath) {
        // Riga già corretta ma matcha il LIKE solo se qualcuno ha inserito
        // manualmente un path 'pending/...' identico: aggiorna solo la riga
        // (no-op qui perché non è possibile). Skip.
        continue;
      }

      // Verifica esistenza del sorgente con list sul prefisso.
      const lastSlash = tempPath.lastIndexOf("/");
      const dir = tempPath.substring(0, lastSlash);
      const base = tempPath.substring(lastSlash + 1);
      const { data: listData, error: listErr } = await supabase.storage.from(BUCKET).list(dir, {
        limit: 1000,
        search: base,
      });
      if (listErr) {
        result.failed++;
        result.errors.push({ id: row.id, reason: `list_error: ${listErr.message}` });
        continue;
      }
      const exists = (listData ?? []).some((f: any) => f.name === base);
      if (!exists) {
        result.skipped_missing++;
        continue;
      }

      if (dryRun) {
        result.moved++;
        continue;
      }

      const { error: mvErr } = await supabase.storage.from(BUCKET).move(tempPath, finalPath);
      if (mvErr) {
        const msg = mvErr.message ?? String(mvErr);
        if (/exist|duplicate|already/i.test(msg)) {
          result.skipped_conflict++;
          result.errors.push({ id: row.id, reason: `conflict: ${msg}` });
        } else {
          result.failed++;
          result.errors.push({ id: row.id, reason: `move_error: ${msg}` });
        }
        continue;
      }

      const { error: updErr } = await supabase
        .from("documenti")
        .update({ url: finalPath })
        .eq("id", row.id);
      if (updErr) {
        result.failed++;
        result.errors.push({ id: row.id, reason: `db_update_error: ${updErr.message}` });
        continue;
      }
      result.moved++;
    }

    return json(result);
  } catch (e) {
    console.error("migrate-pending-docs error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});