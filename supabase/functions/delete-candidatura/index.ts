import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Eliminazione hard di una candidatura con pulizia completa dei documenti nello
 * storage. Deve girare come service-role: il client non deve poter esporre
 * l'anon-role a cascate del genere. Ordine intenzionale, con abort esplicito se
 * la pulizia storage lascia file orfani — i documenti d'identità sono
 * sensibili, non possiamo lasciare artefatti scollegati dal database.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "unauthorized" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth gate: JWT valido + ruolo admin.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) return json(401, { error: "unauthorized" });
    const userId = claimsRes.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    if (roleErr || !isAdmin) return json(403, { error: "forbidden" });

    const body = await req.json().catch(() => null);
    const candidaturaId: unknown = body?.candidatura_id;
    if (typeof candidaturaId !== "string" || candidaturaId.length < 10) {
      return json(400, { error: "candidatura_id_mancante" });
    }

    // 1. leggi candidatura → studente_id
    const { data: cand, error: candErr } = await admin
      .from("candidature").select("id, studente_id").eq("id", candidaturaId).maybeSingle();
    if (candErr) throw candErr;
    if (!cand) return json(404, { error: "candidatura_non_trovata" });
    const studenteId = cand.studente_id as string;

    // 2. gate: nessuna assegnazione collegata (di qualsiasi stato)
    const { count: assegnCount, error: countErr } = await admin
      .from("assegnazioni").select("id", { count: "exact", head: true })
      .eq("candidatura_id", candidaturaId);
    if (countErr) throw countErr;
    if ((assegnCount ?? 0) > 0) return json(409, { error: "assegnazione_collegata" });

    // 3. leggi documenti; documenti.url è già bucket-relative
    const { data: docs, error: docsErr } = await admin
      .from("documenti").select("id, url").eq("candidatura_id", candidaturaId);
    if (docsErr) throw docsErr;

    const validPaths: string[] = [];
    const skippedRows: string[] = [];
    for (const d of docs ?? []) {
      const url = String((d as any).url ?? "");
      // Sanity: rifiuta valori che sembrino URL completi o path che escano dal bucket
      if (!url || url.includes("://") || url.startsWith("/") || url.includes("..")) {
        skippedRows.push(url);
        continue;
      }
      validPaths.push(url);
    }
    if (skippedRows.length > 0) {
      console.warn("delete-candidatura: skipping malformed document paths", { candidaturaId, skippedRows });
      // Interrompo qui: non voglio cancellare righe DB lasciando i file
      return json(500, { error: "storage_cleanup_failed", paths: skippedRows });
    }

    // 4. remove dai bucket
    if (validPaths.length > 0) {
      const { data: removed, error: rmErr } = await admin.storage
        .from("documenti_studenti").remove(validPaths);
      if (rmErr) {
        console.error("delete-candidatura: storage.remove error", rmErr);
        return json(500, { error: "storage_cleanup_failed", details: rmErr.message });
      }
      const removedSet = new Set((removed ?? []).map((r: any) => r.name ?? r));
      const notReported = validPaths.filter((p) => !removedSet.has(p));
      if (notReported.length > 0) {
        console.warn("delete-candidatura: some paths not reported removed", { notReported });
      }

      // 5. verifica bucket post-delete: list() + search per confermare l'assenza
      const stillPresent: string[] = [];
      for (const p of validPaths) {
        const slash = p.lastIndexOf("/");
        const prefix = slash >= 0 ? p.slice(0, slash) : "";
        const filename = slash >= 0 ? p.slice(slash + 1) : p;
        const { data: listData, error: listErr } = await admin.storage
          .from("documenti_studenti").list(prefix, { search: filename, limit: 20 });
        if (listErr) {
          console.error("delete-candidatura: verify list error", listErr, { p });
          stillPresent.push(p);
          continue;
        }
        if ((listData ?? []).some((f: any) => f.name === filename)) {
          stillPresent.push(p);
        }
      }
      if (stillPresent.length > 0) {
        console.error("delete-candidatura: files still present after remove", { stillPresent });
        return json(500, { error: "storage_cleanup_failed", paths: stillPresent });
      }
    }

    // 6-8. pulizia DB in cascata manuale (nessuna ON DELETE CASCADE su queste FK)
    const { error: delDocsErr } = await admin.from("documenti").delete().eq("candidatura_id", candidaturaId);
    if (delDocsErr) throw delDocsErr;
    const { error: delLogErr } = await admin.from("log_stato_candidature").delete().eq("candidatura_id", candidaturaId);
    if (delLogErr) throw delLogErr;
    const { error: delCandErr } = await admin.from("candidature").delete().eq("id", candidaturaId);
    if (delCandErr) throw delCandErr;

    // 9. studente residuale: elimina solo se orfano di candidature e assegnazioni
    let studenteEliminato = false;
    if (studenteId) {
      const [cCount, aCount] = await Promise.all([
        admin.from("candidature").select("id", { count: "exact", head: true }).eq("studente_id", studenteId),
        admin.from("assegnazioni").select("id", { count: "exact", head: true }).eq("studente_id", studenteId),
      ]);
      if ((cCount.count ?? 0) === 0 && (aCount.count ?? 0) === 0) {
        const { error: delStErr } = await admin.from("studenti").delete().eq("id", studenteId);
        if (delStErr) {
          console.error("delete-candidatura: delete studente failed", delStErr);
        } else {
          studenteEliminato = true;
        }
      }
    }

    return json(200, { ok: true, studente_eliminato: studenteEliminato });
  } catch (e: any) {
    console.error("delete-candidatura: unexpected error", e);
    return json(500, { error: "errore_interno", details: e?.message });
  }
});