import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      nome, cognome, email, telefono, data_nascita, nazionalita, codice_fiscale,
      universita, corso_di_studi, anno_di_corso, matricola,
      struttura_preferita_id, tipo_camera_preferito, periodo_inizio, periodo_fine,
      anno_accademico, messaggio, documenti
    } = body;

    // Validate required fields
    if (!nome || !cognome || !email || !universita || !corso_di_studi || !anno_di_corso || !matricola || !anno_accademico) {
      return new Response(JSON.stringify({ error: "Campi obbligatori mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if student exists by email
    const { data: existingStudent } = await supabase
      .from("studenti")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let studenteId: string;

    if (existingStudent) {
      // Update existing student data
      studenteId = existingStudent.id;
      await supabase.from("studenti").update({
        nome, cognome, telefono, data_nascita, nazionalita, codice_fiscale,
        universita, corso_di_studi, anno_di_corso, matricola,
      }).eq("id", studenteId);
    } else {
      // Create new student
      const { data: newStudent, error: studentError } = await supabase
        .from("studenti")
        .insert({
          nome, cognome, email, telefono, data_nascita, nazionalita, codice_fiscale,
          universita, corso_di_studi, anno_di_corso, matricola,
        })
        .select("id")
        .single();

      if (studentError) throw studentError;
      studenteId = newStudent.id;
    }

    // Check for existing active candidatura for same anno_accademico
    const { data: existingCandidatura } = await supabase
      .from("candidature")
      .select("id")
      .eq("studente_id", studenteId)
      .eq("anno_accademico", anno_accademico)
      .not("stato", "in", '("sostituita","ritirata","rifiutata")')
      .maybeSingle();

    if (existingCandidatura) {
      // Mark old candidatura as "sostituita"
      await supabase.from("candidature").update({ stato: "sostituita" }).eq("id", existingCandidatura.id);
      await supabase.from("log_stato_candidature").insert({
        candidatura_id: existingCandidatura.id,
        stato_precedente: "ricevuta",
        stato_nuovo: "sostituita",
        note: "Sostituita da nuova candidatura",
      });
    }

    // Create new candidatura
    const { data: candidatura, error: candidaturaError } = await supabase
      .from("candidature")
      .insert({
        studente_id: studenteId,
        stato: "ricevuta",
        struttura_preferita_id: struttura_preferita_id || null,
        tipo_camera_preferito: tipo_camera_preferito || null,
        periodo_inizio, periodo_fine, anno_accademico, messaggio,
        universita_snapshot: universita,
        corso_snapshot: corso_di_studi,
        anno_corso_snapshot: anno_di_corso,
        matricola_snapshot: matricola,
      })
      .select("id")
      .single();

    if (candidaturaError) throw candidaturaError;

    // Log initial state
    await supabase.from("log_stato_candidature").insert({
      candidatura_id: candidatura.id,
      stato_nuovo: "ricevuta",
    });

    // Register documents if any
    if (documenti && Array.isArray(documenti)) {
      for (const doc of documenti) {
        await supabase.from("documenti").insert({
          studente_id: studenteId,
          candidatura_id: candidatura.id,
          tipo: doc.tipo,
          nome_file: doc.nome_file,
          url: doc.url,
          caricato_da: "studente",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      candidatura_id: candidatura.id,
      studente_id: studenteId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
