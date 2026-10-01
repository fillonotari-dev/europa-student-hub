/**
 * Precompilazione di un contratto: un solo punto per la regola, usato da
 * ContrattoDialog e dalla bozza automatica creata all'assegnazione.
 * Le funzioni pure sono testate in src/test/precompila-contratto.test.ts.
 */
import { supabase } from '@/integrations/supabase/client';
import { imponibileDaLordo } from '@/lib/iva';
import { caricaAnaStudente } from '@/components/admin/contratti/anagraficaStudente';
import { payloadAnagrafica } from '@/components/admin/contratti/AnagraficaFatturazioneFields';

/** Motivo di esenzione provvisorio della bozza automatica: blocca l'attivazione. */
export const DEPOSITO_DA_DEFINIRE = 'Da definire alla verifica del contratto';
export const GIORNO_SCADENZA_PREDEFINITO = 15;
export const ALIQUOTA_PREDEFINITA = 10;

export const oggiIso = () => new Date().toISOString().slice(0, 10);

export type AssegnazioneLike = {
  id: string;
  data_inizio: string | null;
  data_fine: string | null;
  camere?: { tipo?: string | null; struttura_id?: string | null } | null;
};

/** Fra le assegnazioni attive: la prima non ancora conclusa, altrimenti la più recente. */
export function scegliAssegnazione<T extends AssegnazioneLike>(attive: T[], oggi = oggiIso()): T | null {
  return attive.find(a => !a.data_fine || a.data_fine >= oggi) ?? attive[0] ?? null;
}

export function campiDaAssegnazione(a: AssegnazioneLike) {
  return {
    assegnazioneId: a.id,
    dataInizio: a.data_inizio ?? '',
    dataFine: a.data_fine ?? '',
    strutturaId: a.camere?.struttura_id ?? '',
    tipoCamera: a.camere?.tipo ?? '',
  };
}

export type CandidaturaGarante = {
  garante_nome?: string | null; garante_relazione?: string | null;
  garante_telefono?: string | null; garante_email?: string | null;
};

export function garanteDaCandidatura(c: CandidaturaGarante | null | undefined) {
  return {
    nome: c?.garante_nome ?? '', relazione: c?.garante_relazione ?? '',
    telefono: c?.garante_telefono ?? '', email: c?.garante_email ?? '',
  };
}

/** Canone lordo proposto: dal listino, oppure 0 con il segnale di listino mancante. */
export function canoneDaListino(listino: { importo_mensile_lordo: number | string | null } | null | undefined) {
  const v = listino?.importo_mensile_lordo;
  if (v == null || !Number.isFinite(Number(v))) return { lordo: 0, listinoMancante: true };
  return { lordo: Number(v), listinoMancante: false };
}

/** Blocchi all'attivazione: canone 0 e deposito ancora da definire. */
export function bloccantiAttivazione(c: {
  canone_mensile: number | string | null;
  deposito_richiesto: boolean | null;
  deposito_motivo_esenzione: string | null;
}): string[] {
  const out: string[] = [];
  if (!(Number(c.canone_mensile) > 0)) out.push('inserisci il canone mensile');
  if (!c.deposito_richiesto && c.deposito_motivo_esenzione === DEPOSITO_DA_DEFINIRE)
    out.push('definisci il deposito (importo, oppure motivo di esenzione)');
  return out;
}

/** Motivo in italiano del fallimento della bozza automatica. */
export function motivoErroreBozza(e: unknown): string {
  const msg = String((e as any)?.message ?? e ?? '');
  if (msg.includes('contratti_durata_max_chk')) return 'il periodo dell\'assegnazione supera un anno: il contratto va creato a mano con un periodo più breve.';
  if (msg.includes('contratti_periodo_chk')) return 'la data di fine dell\'assegnazione non è successiva a quella di inizio.';
  if (msg.includes('senza_data_fine')) return 'l\'assegnazione non ha una data di fine: indicala creando il contratto a mano.';
  if (msg.includes('senza_struttura')) return 'non è stato possibile risalire alla sede della camera assegnata.';
  if (msg.includes('row-level security') || msg.includes('permission')) return 'permessi insufficienti per creare il contratto.';
  return msg ? `errore imprevisto (${msg.slice(0, 160)}).` : 'errore imprevisto.';
}

export async function cercaListino(strutturaId: string, tipoCamera: string, oggi = oggiIso()) {
  const { data } = await supabase
    .from('listini')
    .select('importo_mensile_lordo, valido_dal')
    .eq('struttura_id', strutturaId)
    .eq('tipo_camera', tipoCamera)
    .lte('valido_dal', oggi)
    .or(`valido_al.is.null,valido_al.gte.${oggi}`)
    .order('valido_dal', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function caricaPrecompilazione(studenteId: string) {
  const [datiFatturazione, { data: assegnazioni }, { data: candidature }] = await Promise.all([
    caricaAnaStudente(studenteId).catch(() => null),
    supabase
      .from('assegnazioni')
      .select('id, data_inizio, data_fine, stato, camere(id, tipo, struttura_id)')
      .eq('studente_id', studenteId)
      .eq('stato', 'attiva')
      .order('data_inizio', { ascending: false }),
    supabase
      .from('candidature')
      .select('garante_nome, garante_relazione, garante_telefono, garante_email, created_at')
      .eq('studente_id', studenteId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  const ass = scegliAssegnazione((assegnazioni ?? []) as any[]);
  return {
    assegnazione: ass ? campiDaAssegnazione(ass) : null,
    garante: (candidature ?? [])[0] ? garanteDaCandidatura((candidature ?? [])[0]) : null,
    datiFatturazione,
  };
}

export type EsitoBozza =
  | { esito: 'creata'; contrattoId: string; listinoMancante: boolean }
  | { esito: 'esistente'; contrattoId: string }
  | { esito: 'errore'; motivo: string };

/**
 * Crea la bozza di contratto per un'assegnazione, se non ne esiste già una
 * (bozza o attivo). Mai attivazione: solo stato 'bozza'. Non solleva.
 */
export async function creaBozzaDaAssegnazione(assegnazioneId: string): Promise<EsitoBozza> {
  try {
    const { data: esistente } = await supabase
      .from('contratti').select('id')
      .eq('assegnazione_id', assegnazioneId).in('stato', ['bozza', 'attivo'])
      .limit(1).maybeSingle();
    if (esistente) return { esito: 'esistente', contrattoId: esistente.id };

    const { data: ass, error: errA } = await supabase
      .from('assegnazioni')
      .select('id, studente_id, candidatura_id, data_inizio, data_fine, camere(tipo, struttura_id)')
      .eq('id', assegnazioneId).single();
    if (errA) throw errA;
    const campi = campiDaAssegnazione(ass as any);
    if (!campi.dataFine) throw new Error('senza_data_fine');
    if (!campi.strutturaId) throw new Error('senza_struttura');

    const [{ data: cand }, listino, ana] = await Promise.all([
      supabase.from('candidature')
        .select('garante_nome, garante_relazione, garante_telefono, garante_email')
        .eq('studente_id', ass.studente_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      campi.tipoCamera ? cercaListino(campi.strutturaId, campi.tipoCamera) : Promise.resolve(null),
      caricaAnaStudente(ass.studente_id),
    ]);

    let anagraficaId = ana.id;
    if (!anagraficaId) {
      const { data, error } = await supabase.from('anagrafiche_fatturazione')
        .insert(payloadAnagrafica(ana.ana, 'studente', ass.studente_id)).select('id').single();
      if (error) throw error;
      anagraficaId = data.id;
    }

    const canone = canoneDaListino(listino);
    const g = garanteDaCandidatura(cand);
    const nz = (v: string) => (v.trim() === '' ? null : v.trim());
    const { data: c, error } = await supabase.from('contratti').insert({
      studente_id: ass.studente_id,
      struttura_id: campi.strutturaId,
      assegnazione_id: assegnazioneId,
      anagrafica_fatturazione_id: anagraficaId,
      data_inizio: campi.dataInizio,
      data_fine: campi.dataFine,
      giorno_scadenza: GIORNO_SCADENZA_PREDEFINITO,
      canone_mensile: imponibileDaLordo(canone.lordo, ALIQUOTA_PREDEFINITA),
      aliquota_iva: ALIQUOTA_PREDEFINITA,
      garante_nome: nz(g.nome), garante_relazione: nz(g.relazione),
      garante_telefono: nz(g.telefono), garante_email: nz(g.email),
      deposito_richiesto: false,
      deposito_importo: null,
      deposito_stato: null,
      deposito_motivo_esenzione: DEPOSITO_DA_DEFINIRE,
      stato: 'bozza',
    }).select('id').single();
    if (error) throw error;
    return { esito: 'creata', contrattoId: c.id, listinoMancante: canone.listinoMancante };
  } catch (e) {
    return { esito: 'errore', motivo: motivoErroreBozza(e) };
  }
}
