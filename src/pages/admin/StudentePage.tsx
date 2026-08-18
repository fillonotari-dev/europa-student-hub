import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePageTitle, usePageBack } from '@/hooks/usePageTitle';
import { useCandidaturaActions, CandidaturaActionsContext } from '@/hooks/useCandidaturaActions';
import { CandidaturaActions } from '@/components/admin/CandidaturaActions';
import { CandidaturaDetail } from '@/components/admin/candidatura/CandidaturaDetail';
import { DocumentoRow } from '@/components/admin/candidatura/DocumentoRow';
import { ContrattoDialog } from '@/components/admin/contratti/ContrattoDialog';
import { formatStatoCandidatura, formatStadio, STADIO_COLORS } from '@/lib/statoCandidatura';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { DateOfBirthPicker } from '@/components/candidatura/DateOfBirthPicker';
import { NATIONALITIES } from '@/lib/nationalities';
import { validateCodiceFiscale } from '@shared/codice-fiscale';
import { PROVINCE } from '@shared/province';
import { COUNTRIES } from '@shared/countries';
import {
  User, ArrowLeft, ArrowRight, Pencil, X as XIcon, Check,
  ChevronsUpDown, MessageSquare, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// -------------------- Utility di formato --------------------
const fmtIt = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('it-IT') : '';
const INF = 8.64e15;
const dayMs = (v: string | null | undefined) => v ? new Date(v + 'T00:00:00').getTime() : null;
function periodOverlaps(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null) {
  const as = dayMs(aStart)!;
  const ae = dayMs(aEnd) ?? INF;
  const bs = dayMs(bStart)!;
  const be = dayMs(bEnd) ?? INF;
  return as <= be && bs <= ae;
}
function statoTemporale(dataInizio: string, dataFine: string | null): 'futura' | 'in_corso' {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(dataInizio + 'T00:00:00');
  if (today < start) return 'futura';
  return 'in_corso';
}
function nomeIndirizzoCompatto(s: any): string | null {
  if (!s) return null;
  const via = [s.indirizzo_via, s.indirizzo_civico].filter(Boolean).join(' ');
  const cityLine = [
    s.indirizzo_cap,
    s.indirizzo_comune,
    s.indirizzo_provincia ? `(${s.indirizzo_provincia})` : null,
  ].filter(Boolean).join(' ');
  const parts = [via, cityLine].filter(Boolean);
  if (s.indirizzo_nazione && s.indirizzo_nazione !== 'IT') {
    const c = COUNTRIES.find(c => c.code === s.indirizzo_nazione);
    parts.push(c ? c.it : s.indirizzo_nazione);
  }
  return parts.join(' — ') || null;
}

// -------------------- Etichette per i campi --------------------
const TIPO_STUDENTE_LABELS: Record<string, string> = {
  universitario: 'Corso di laurea', erasmus: 'Erasmus o scambio', master: 'Master o dottorato', altro: 'Altro',
};
const ORARI_LABELS: Record<string, string> = {
  mattiniero: 'Si sveglia presto', serale: 'Fa tardi la sera', variabile: 'Dipende dai giorni',
};
const PERSONALITA_LABELS: Record<string, string> = {
  tranquilla: 'Persona tranquilla', socievole: 'Persona socievole', riservata: 'Persona riservata', altro: 'Altro',
};
const ORDINE_LABELS: Record<string, string> = {
  molto: 'Rimette tutto a posto subito', abbastanza: 'Rimette a posto, ma non sempre subito', poco: 'Tende a lasciare le cose in giro',
};

// -------------------- Pagina --------------------
export default function StudentePage() {
  const { id: studenteId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const qc = useQueryClient();
  const navigateTo = useNavigate();
  const [openContratto, setOpenContratto] = useState(false);

  const backTo = useMemo(() => {
    const base = from === 'residenti' ? '/admin/residenti' : '/admin/candidature';
    const params = new URLSearchParams();
    searchParams.forEach((v, k) => { if (k !== 'candidatura' && k !== 'from') params.set(k, v); });
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [from, searchParams]);

  const { data: studente, isLoading: loadingStudente } = useQuery({
    queryKey: ['studente', studenteId],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase.from('studenti').select('*').eq('id', studenteId).maybeSingle();
      return data;
    },
  });

  usePageTitle(studente ? `${studente.cognome ?? ''} ${studente.nome ?? ''}`.trim() : null);
  usePageBack(backTo);

  const { data: stadioRow } = useQuery({
    queryKey: ['studente-stadio', studenteId],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from('v_studenti_stadio')
        .select('stadio, candidatura_id')
        .eq('studente_id', studenteId)
        .maybeSingle();
      return data;
    },
  });

  const { data: candidature } = useQuery({
    queryKey: ['studente-candidature', studenteId, stadioRow?.candidatura_id ?? null, stadioRow?.stadio ?? null],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from('candidature')
        .select('*, strutture(nome)')
        .eq('studente_id', studenteId)
        .order('created_at', { ascending: false });
      return (data ?? []).map((c: any) => ({
        ...c,
        studenti: studente ?? null,
        stadio: stadioRow?.candidatura_id === c.id ? stadioRow?.stadio : (c.stato ?? null),
      }));
    },
  });

  const { data: assegnazioni } = useQuery({
    queryKey: ['studente-assegnazioni', studenteId],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('id, candidatura_id, camera_id, posto, data_inizio, data_fine, stato, motivo_chiusura, camere(numero, posti, strutture(nome))')
        .eq('studente_id', studenteId)
        .order('data_inizio', { ascending: false });
      return data ?? [];
    },
  });

  // Set globali per gate azioni (identici a Candidature/Residenti).
  const { data: studentiHaAssegnazioneAttiva } = useQuery({
    queryKey: ['candidature-con-assegnazione-attiva'],
    queryFn: async () => {
      const { data } = await supabase.from('assegnazioni').select('candidatura_id').eq('stato', 'attiva');
      return new Set((data ?? []).map((a: any) => a.candidatura_id));
    },
  });
  const { data: studentiHaAvutoAssegnazione } = useQuery({
    queryKey: ['candidature-con-assegnazione-any'],
    queryFn: async () => {
      const { data } = await supabase.from('assegnazioni').select('candidatura_id');
      return new Set((data ?? []).map((a: any) => a.candidatura_id));
    },
  });

  // Candidatura di riferimento (stadio persona) e altre.
  const candRif = useMemo(() => {
    if (!candidature) return null;
    const byId = stadioRow?.candidatura_id
      ? candidature.find((c: any) => c.id === stadioRow.candidatura_id)
      : null;
    return byId ?? candidature[0] ?? null;
  }, [candidature, stadioRow]);

  const altre = useMemo(
    () => (candidature ?? []).filter((c: any) => candRif && c.id !== candRif.id),
    [candidature, candRif],
  );

  // Decoro candRif con i dati dell'assegnazione attiva (per abilitare
  // trasferisci / concludi_soggiorno nelle azioni globali).
  const candRifDecorata = useMemo(() => {
    if (!candRif) return null;
    const attiva = (assegnazioni ?? []).find((a: any) => a.stato === 'attiva' && a.candidatura_id === candRif.id);
    if (!attiva) return candRif;
    return {
      ...candRif,
      assegnazione_id: attiva.id,
      camera_id_corrente: attiva.camera_id,
      camera_numero_corrente: attiva.camere?.numero ?? null,
      struttura_nome_corrente: attiva.camere?.strutture?.nome ?? null,
      data_fine_corrente: attiva.data_fine ?? null,
    };
  }, [candRif, assegnazioni]);

  const actions = useCandidaturaActions({
    studentiHaAssegnazioneAttiva: studentiHaAssegnazioneAttiva ?? null,
    studentiHaAvutoAssegnazione: studentiHaAvutoAssegnazione ?? null,
    extraInvalidateKeys: [
      ['studente', studenteId],
      ['studente-candidature', studenteId],
      ['studente-stadio', studenteId],
      ['studente-assegnazioni', studenteId],
    ],
  });

  // Log per la candidatura di riferimento (§Cronologia).
  const { data: log } = useQuery({
    queryKey: ['studente-log', studenteId, candRif?.id ?? null],
    enabled: !!candRif?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('log_stato_candidature')
        .select('*')
        .eq('candidatura_id', candRif!.id)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
  });

  // Documenti della candidatura di riferimento.
  const { data: documenti } = useQuery({
    queryKey: ['studente-documenti-rif', studenteId, candRif?.id ?? null],
    enabled: !!candRif?.id,
    queryFn: async () => {
      const { data } = await supabase.from('documenti').select('*').eq('candidatura_id', candRif!.id);
      return data ?? [];
    },
  });

  // Contratti della persona: la scheda deve mostrare anche il lato economico.
  const { data: contratti } = useQuery({
    queryKey: ['studente-contratti', studenteId],
    enabled: !!studenteId,
    queryFn: async () => {
      const { data } = await supabase
        .from('contratti')
        .select('id, stato, data_inizio, data_fine, canone_mensile, strutture(nome)')
        .eq('studente_id', studenteId)
        .order('data_inizio', { ascending: false });
      return data ?? [];
    },
  });
  const contrattoAttivo = (contratti ?? []).some((k: any) => k.stato === 'attivo');
  const TIPO_DOC_LABELS: Record<string, string> = {
    documento_identita: 'Documento di identità',
    certificato_iscrizione: 'Certificato di iscrizione',
    documento_garante: 'Documento garante',
    documento_aggiuntivo: 'Documento aggiuntivo',
  };
  const TIPO_DOC_ORDER = [
    'documento_identita',
    'certificato_iscrizione',
    'documento_garante',
    'documento_aggiuntivo',
  ];
  const documentiOrdinati = (documenti ?? []).slice().sort((a: any, b: any) => {
    const ia = TIPO_DOC_ORDER.indexOf(a.tipo);
    const ib = TIPO_DOC_ORDER.indexOf(b.tipo);
    const na = ia === -1 ? 999 : ia;
    const nb = ib === -1 ? 999 : ib;
    if (na !== nb) return na - nb;
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  });


  // Compagno di stanza — UNA sola query, sovrapposizione calcolata in JS.
  const attive = useMemo(
    () => (assegnazioni ?? []).filter((a: any) => a.stato === 'attiva'),
    [assegnazioni],
  );
  const concluse = useMemo(
    () => (assegnazioni ?? []).filter((a: any) => a.stato !== 'attiva'),
    [assegnazioni],
  );
  const cameraIdsAttive = useMemo(
    () => Array.from(new Set(attive.map((a: any) => a.camera_id))),
    [attive],
  );
  const { data: compagniRaw } = useQuery({
    queryKey: ['studente-compagni', studenteId, cameraIdsAttive.slice().sort().join(',')],
    enabled: cameraIdsAttive.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('id, camera_id, data_inizio, data_fine, studente_id, studenti(id, nome, cognome)')
        .in('camera_id', cameraIdsAttive)
        .eq('stato', 'attiva')
        .neq('studente_id', studenteId);
      return data ?? [];
    },
  });
  const compagniPerAssegnazione = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of attive) {
      const list = (compagniRaw ?? []).filter((x: any) =>
        x.camera_id === a.camera_id &&
        periodOverlaps(a.data_inizio, a.data_fine ?? null, x.data_inizio, x.data_fine ?? null),
      );
      map.set(a.id, list);
    }
    return map;
  }, [attive, compagniRaw]);

  // ---------------- Modifica anagrafica ----------------
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<null | { old: string; nuova: string }>(null);

  useEffect(() => {
    if (edit && studente && !form) {
      setForm({
        nome: studente.nome ?? '',
        cognome: studente.cognome ?? '',
        email: studente.email ?? '',
        telefono: studente.telefono ?? '',
        data_nascita: studente.data_nascita ?? '',
        nazionalita: studente.nazionalita ?? '',
        codice_fiscale: studente.codice_fiscale ?? '',
        cf_non_disponibile: !!studente.cf_non_disponibile,
        indirizzo_via: studente.indirizzo_via ?? '',
        indirizzo_civico: studente.indirizzo_civico ?? '',
        indirizzo_cap: studente.indirizzo_cap ?? '',
        indirizzo_comune: studente.indirizzo_comune ?? '',
        indirizzo_provincia: studente.indirizzo_provincia ?? '',
        indirizzo_nazione: studente.indirizzo_nazione ?? 'IT',
        documento_identita_n: candRif?.documento_identita_n ?? '',
      });
      setErrors({});
    }
  }, [edit, studente, candRif, form]);

  function annullaEdit() {
    setEdit(false);
    setForm(null);
    setErrors({});
  }

  function valida(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.nome?.trim()) e.nome = 'Obbligatorio';
    if (!form.cognome?.trim()) e.cognome = 'Obbligatorio';
    if (!form.email?.trim()) e.email = 'Obbligatorio';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Email non valida';
    if (!form.cf_non_disponibile) {
      if (!form.codice_fiscale?.trim()) e.codice_fiscale = 'Obbligatorio';
      else {
        const cf = validateCodiceFiscale(form.codice_fiscale);
        if (!cf.ok) e.codice_fiscale = 'Codice fiscale non valido';
      }
    }
    if (form.indirizzo_nazione === 'IT') {
      if (!/^\d{5}$/.test(form.indirizzo_cap || '')) e.indirizzo_cap = 'CAP a 5 cifre';
      if (!form.indirizzo_provincia) e.indirizzo_provincia = 'Provincia obbligatoria';
    }
    if (!form.indirizzo_via?.trim()) e.indirizzo_via = 'Obbligatorio';
    if (!form.indirizzo_civico?.trim()) e.indirizzo_civico = 'Obbligatorio';
    if (!form.indirizzo_comune?.trim()) e.indirizzo_comune = 'Obbligatorio';
    if (!form.indirizzo_nazione) e.indirizzo_nazione = 'Obbligatorio';
    return e;
  }

  async function eseguiSalvataggio() {
    if (!form || !studente) return;
    setSaving(true);
    try {
      // Normalizza CF a maiuscolo se presente.
      const cfNorm = form.cf_non_disponibile
        ? null
        : (validateCodiceFiscale(form.codice_fiscale).normalized || form.codice_fiscale.trim().toUpperCase());

      const updStud: any = {
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        email: form.email.trim(),
        telefono: form.telefono?.trim() || null,
        data_nascita: form.data_nascita || null,
        nazionalita: form.nazionalita || null,
        codice_fiscale: cfNorm,
        cf_non_disponibile: !!form.cf_non_disponibile,
        indirizzo_via: form.indirizzo_via.trim(),
        indirizzo_civico: form.indirizzo_civico.trim(),
        indirizzo_cap: form.indirizzo_cap?.trim() || null,
        indirizzo_comune: form.indirizzo_comune.trim(),
        indirizzo_provincia: form.indirizzo_provincia || null,
        indirizzo_nazione: form.indirizzo_nazione,
      };

      const { error: errStud } = await supabase.from('studenti').update(updStud).eq('id', studente.id);
      if (errStud) {
        if ((errStud as any).code === '23505' && /email/i.test(errStud.message || '')) {
          toast.error(`L'indirizzo ${form.email.trim()} è già usato da un'altra persona.`);
        } else {
          toast.error(errStud.message || 'Errore nel salvataggio dei dati anagrafici.');
        }
        return;
      }

      // Solo ora, se cambiato, aggiorno documento_identita_n sulla candidatura di riferimento.
      const nuovoDoc = form.documento_identita_n?.trim() || null;
      const vecchioDoc = candRif?.documento_identita_n ?? null;
      if (candRif && nuovoDoc !== vecchioDoc) {
        const { error: errCand } = await supabase
          .from('candidature')
          .update({ documento_identita_n: nuovoDoc })
          .eq('id', candRif.id);
        if (errCand) {
          toast.error(`Anagrafica salvata, numero documento non aggiornato: ${errCand.message}`);
          // manteniamo l'edit mode per permettere una nuova prova sul solo documento
          await qc.invalidateQueries({ queryKey: ['studente', studenteId] });
          await qc.invalidateQueries({ queryKey: ['studente-candidature', studenteId] });
          return;
        }
      }

      toast.success('Dati aggiornati');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['studente', studenteId] }),
        qc.invalidateQueries({ queryKey: ['studente-candidature', studenteId] }),
        qc.invalidateQueries({ queryKey: ['studente-stadio', studenteId] }),
        qc.invalidateQueries({ queryKey: ['candidature'] }),
      ]);
      setEdit(false);
      setForm(null);
    } finally {
      setSaving(false);
    }
  }

  function onSalva() {
    if (!form || !studente) return;
    const e = valida();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error('Correggi i campi evidenziati');
      return;
    }
    const emailCambiata = (form.email.trim().toLowerCase()) !== (studente.email ?? '').toLowerCase();
    if (emailCambiata) {
      setConfirmEmail({ old: studente.email ?? '', nuova: form.email.trim() });
      return;
    }
    void eseguiSalvataggio();
  }

  // ---------------- Render ----------------
  if (loadingStudente) return <p className="text-muted-foreground">Caricamento...</p>;
  if (!studente) {
    return (
      <div className="py-16 text-center">
        <User className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-[13px] text-muted-foreground">Persona non trovata</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/admin/candidature"><ArrowLeft className="w-4 h-4 mr-1" /> Torna alle candidature</Link>
        </Button>
      </div>
    );
  }

  const stadio = stadioRow?.stadio ?? candRif?.stato ?? null;
  const c = candRif;

  // Avvisi coerenza date (dentro Preferenze).
  const avvisiDate: string[] = [];
  if (c?.periodo_inizio && c?.periodo_fine && dayMs(c.periodo_fine)! <= dayMs(c.periodo_inizio)!) {
    avvisiDate.push('La data di fine periodo non è successiva alla data di inizio.');
  }
  if (c?.periodo_inizio && c?.periodo_fine && c?.data_arrivo_prevista) {
    const s = dayMs(c.periodo_inizio)!;
    const e = dayMs(c.periodo_fine)!;
    const a = dayMs(c.data_arrivo_prevista)!;
    if (a < s || a > e) avvisiDate.push('La data di arrivo prevista è fuori dal periodo indicato.');
  }

  return (
    <CandidaturaActionsContext.Provider value={actions.ctxValue}>
      <div className="space-y-6">
        {/* --- 1. Intestazione (nessuna card) --- */}
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border/60 pb-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground truncate">
              {studente.cognome} {studente.nome}
            </h1>
            {stadio && (
              <span className={cn(
                'inline-block mt-2 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded',
                STADIO_COLORS[stadio] ?? 'bg-muted text-muted-foreground',
              )}>{formatStadio(stadio)}</span>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {(stadio === 'assegnato' || stadio === 'in_casa') && (
              <Button variant={contrattoAttivo ? 'ghost' : 'outline'} size="sm" onClick={() => setOpenContratto(true)}>
                Crea contratto
              </Button>
            )}
            {candRifDecorata && (
              <CandidaturaActions.PrimaryWithMenu candidatura={candRifDecorata as any} />
            )}
          </div>
        </div>

        <ContrattoDialog
          open={openContratto}
          onOpenChange={setOpenContratto}
          studenteId={studenteId}
          onCreated={(id) => navigateTo(`/admin/contratti/${id}`)}
        />

        {/* --- 2. Soggiorno (banda, non card) --- */}
        {attive.length > 0 && (
          <div className="space-y-2">
            {[...attive]
              .sort((a, b) => (a.data_inizio || '').localeCompare(b.data_inizio || ''))
              .map((a: any) => {
                const stato = statoTemporale(a.data_inizio, a.data_fine ?? null);
                const compagni = compagniPerAssegnazione.get(a.id) ?? [];
                const parts = [
                  a.camere?.strutture?.nome,
                  `Camera ${a.camere?.numero ?? '—'}`,
                  `posto ${a.posto}`,
                  `${fmtIt(a.data_inizio)} → ${a.data_fine ? fmtIt(a.data_fine) : '—'}`,
                  stato === 'in_corso' ? 'In corso' : 'Non ancora iniziato',
                ].filter(Boolean);
                return (
                  <div key={a.id} className="bg-muted/40 rounded-lg px-5 py-4">
                    <p className="text-sm">{parts.join(' · ')}</p>
                    {compagni.length > 0 && (
                      <p className="text-[13px] text-muted-foreground mt-1">
                        Con {compagni.map((cp: any, i: number) => (
                          <span key={cp.id}>
                            {i > 0 && ', '}
                            {cp.studenti ? (
                              <Link
                                to={`/admin/studenti/${cp.studenti.id}?from=residenti`}
                                className="text-primary hover:underline"
                              >
                                {cp.studenti.cognome} {cp.studenti.nome}
                              </Link>
                            ) : '—'}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* --- 3. Informazioni personali (larghezza piena, 3 colonne) --- */}
        <section className="bg-card border border-border/50 rounded-lg p-5">
          <header className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold">Informazioni personali</h2>
            {!edit && (
              <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>
                <Pencil className="w-4 h-4 mr-1" /> Modifica
              </Button>
            )}
          </header>
          {!edit || !form ? (
            <InfoPersonaliRead
              studente={studente}
              docIdN={c?.documento_identita_n}
            />
          ) : (
            <EditAnagrafica
              form={form} setForm={setForm} errors={errors}
              onSalva={onSalva} onAnnulla={annullaEdit} saving={saving}
            />
          )}
        </section>

        {documentiOrdinati.length > 0 && (
          <section className="bg-card border border-border/50 rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4">Documenti</h2>
            <div className="space-y-2">
              {documentiOrdinati.map((d: any) => <DocumentoRow key={d.id} doc={d} />)}
            </div>
          </section>
        )}

        {(contratti ?? []).length > 0 && (
          <section className="bg-card border border-border/50 rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-3">Contratti</h2>
            <ul className="divide-y divide-border/50">
              {(contratti ?? []).map((k: any) => (
                <li key={k.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">
                    {[
                      k.strutture?.nome,
                      `${fmtIt(k.data_inizio)} → ${fmtIt(k.data_fine)}`,
                      `${Number(k.canone_mensile).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}/mese`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.stato}</span>
                    <Link to={`/admin/contratti/${k.id}`} className="text-primary hover:underline">Apri</Link>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* --- 4. Griglia 2×2 (allineata in alto) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <DataCard
            title="Dati accademici"
            items={[
              ['Università', c?.universita_snapshot],
              ['Corso', c?.corso_snapshot],
              ['Anno', c?.anno_corso_snapshot],
              ['Tipo studente', c?.tipo_studente === 'altro'
                ? (c?.tipo_studente_altro || 'Altro')
                : (TIPO_STUDENTE_LABELS[c?.tipo_studente] || c?.tipo_studente)],
            ]}
          />
          <DataCard
            title="Preferenze"
            items={[
              ['Struttura', c?.strutture?.nome],
              ['Tipo camera', c?.tipo_camera_preferito],
              ['Periodo', (c?.periodo_inizio || c?.periodo_fine)
                ? `${fmtIt(c?.periodo_inizio) || '—'} → ${fmtIt(c?.periodo_fine) || '—'}` : null],
              ['Arrivo previsto', fmtIt(c?.data_arrivo_prevista)],
              ['Note preferenze', c?.preferenze_note],
            ]}
            footer={avvisiDate.length > 0 ? (
              <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 space-y-1">
                {avvisiDate.map((m, i) => (
                  <p key={i} className="text-[12px] text-warning">{m}</p>
                ))}
              </div>
            ) : null}
          />
          <DataCard
            title="Caratteristiche"
            items={c?.versione_form === 'completa' ? [
              ['Lingue parlate', c?.lingue_parlate],
              ['Orari', ORARI_LABELS[c?.orari] || c?.orari],
              ['Personalità', c?.personalita === 'altro'
                ? (c?.personalita_altro || 'Altro')
                : (PERSONALITA_LABELS[c?.personalita] || c?.personalita)],
              ['Ordine/pulizia', ORDINE_LABELS[c?.ordine_pulizia] || c?.ordine_pulizia],
              ['Fumatore', c?.fumatore === true ? 'Sì' : c?.fumatore === false ? 'No' : null],
              ['Presentazione', c?.presentazione],
            ] : []}
          />
          <DataCard
            title="Garante"
            items={[
              ['Nome', c?.garante_nome],
              ['Relazione', c?.garante_relazione],
              ['Telefono', c?.garante_telefono],
              ['Email', c?.garante_email],
            ]}
            footer={null}
          />
        </div>

        {/* --- 5. Cronologia + Note admin (2 col), poi soggiorni conclusi --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <section className="bg-card border border-border/50 rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4">Cronologia</h2>
            <Cronologia log={log ?? []} />
          </section>
          <section className="bg-card border border-border/50 rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4">Note admin</h2>
            <NoteAdmin candidaturaId={c?.id ?? null} initial={c?.note_admin ?? ''} studenteId={studenteId} />
          </section>
        </div>

        {concluse.length > 0 && (
          <section className="bg-card border border-border/50 rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-3">Soggiorni conclusi</h2>
            <ul className="space-y-1.5">
              {concluse.map((a: any) => {
                const bits = [
                  a.camere?.strutture?.nome,
                  `Camera ${a.camere?.numero ?? '—'}`,
                  `${fmtIt(a.data_inizio)} → ${a.data_fine ? fmtIt(a.data_fine) : '—'}`,
                  a.motivo_chiusura,
                ].filter(Boolean);
                return (
                  <li key={a.id} className="text-[13px] text-muted-foreground">
                    {bits.join(' · ')}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Altre candidature (raro) — sotto tutto, in sola lettura */}
        {altre.length > 0 && <AltreCandidature items={altre} studenteId={studenteId} />}

        {actions.dialogs}

        <AlertDialog open={!!confirmEmail} onOpenChange={(o) => { if (!o) setConfirmEmail(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confermi la modifica dell'email?</AlertDialogTitle>
              <AlertDialogDescription>
                Stai cambiando l'indirizzo di riferimento per le comunicazioni con questa persona.<br />
                Da <strong>{confirmEmail?.old || '—'}</strong> a <strong>{confirmEmail?.nuova}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={() => { const cur = confirmEmail; setConfirmEmail(null); if (cur) void eseguiSalvataggio(); }}>
                Conferma
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CandidaturaActionsContext.Provider>
  );
}

// -------------------- Componenti locali --------------------

function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function DataCard({ title, items, footer }: {
  title: string;
  items: Array<[string, any]>;
  footer?: React.ReactNode;
}) {
  const filtered = items.filter(([, v]) => !isEmpty(v));
  return (
    <section className="bg-card border border-border/50 rounded-lg p-5">
      <h2 className="text-sm font-semibold mb-4">{title}</h2>
      {filtered.length === 0 && !footer ? (
        <p className="text-[13px] text-muted-foreground">Non ancora compilato</p>
      ) : (
        <div className="space-y-4">
          {filtered.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="text-sm mt-0.5 break-words whitespace-pre-wrap">{value}</div>
            </div>
          ))}
        </div>
      )}
      {footer}
    </section>
  );
}

function InfoPersonaliRead({ studente, docIdN }: {
  studente: any; docIdN: string | null | undefined;
}) {
  const items: Array<[string, any, boolean?]> = [
    ['Email', studente.email],
    ['Telefono', studente.telefono],
    ['Data di nascita', fmtIt(studente.data_nascita)],
    ['Cittadinanza', studente.nazionalita],
    ['Codice fiscale', studente.cf_non_disponibile ? 'Non disponibile' : studente.codice_fiscale],
    ['N. documento identità', docIdN],
    ['Residenza', nomeIndirizzoCompatto(studente), true /* wide */],
  ];
  const filtered = items.filter(([, v]) => !isEmpty(v));
  if (filtered.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Non ancora compilato</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
      {filtered.map(([label, value, wide]) => (
        <div key={label} className={cn('min-w-0', wide && 'md:col-span-3')}>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-sm mt-0.5 break-words">{value}</div>
        </div>
      ))}
    </div>
  );
}

function NoteAdmin({ candidaturaId, initial, studenteId }: {
  candidaturaId: string | null; initial: string; studenteId: string;
}) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  if (!candidaturaId) {
    return <p className="text-[13px] text-muted-foreground">Nessuna candidatura di riferimento.</p>;
  }
  return (
    <div className="space-y-2">
      <Textarea
        defaultValue={initial}
        placeholder="Note interne su questa persona…"
        className="min-h-[120px]"
        onBlur={async (e) => {
          const val = e.target.value;
          if (val === (initial || '')) return;
          const { error } = await supabase.from('candidature').update({ note_admin: val }).eq('id', candidaturaId);
          if (error) {
            toast.error('Nota non salvata');
          } else {
            await qc.invalidateQueries({ queryKey: ['studente-candidature', studenteId] });
            await qc.invalidateQueries({ queryKey: ['candidature'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
          }
        }}
      />
      {saved && <p className="text-[11px] text-success">Salvato</p>}
    </div>
  );
}

function Cronologia({ log }: { log: any[] }) {
  const [showAll, setShowAll] = useState(false);
  if (!log || log.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Nessun cambio di stato registrato</p>;
  }
  const visible = showAll ? log : log.slice(-5);
  return (
    <div>
      <ol className="relative border-l border-border/60 pl-4 space-y-3">
        {visible.map((l: any) => {
          const isTransition = !!l.stato_precedente && l.stato_precedente !== l.stato_nuovo;
          const hasNote = !!(l.note && String(l.note).trim());
          const Icon = isTransition ? ArrowRight : MessageSquare;
          return (
            <li key={l.id} className="relative">
              <span className={cn(
                'absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background',
                isTransition ? 'bg-primary/60' : 'bg-accent',
              )} />
              <div className="text-[13px] flex items-start gap-2">
                <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', isTransition ? 'text-primary' : 'text-accent-foreground/70')} />
                <div className="min-w-0">
                  {isTransition ? (
                    <span>
                      Stato passato da <strong>{formatStatoCandidatura(l.stato_precedente)}</strong>{' '}
                      a <strong>{formatStatoCandidatura(l.stato_nuovo)}</strong>
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">
                      {hasNote ? l.note : 'Evento registrato'}
                    </span>
                  )}
                  {isTransition && hasNote && (
                    <div className="mt-1 text-[12px] text-muted-foreground whitespace-pre-wrap">{l.note}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(l.created_at).toLocaleString('it-IT')}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {log.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-[12px] text-primary hover:underline"
        >
          {showAll ? 'Mostra solo le ultime 5' : `Mostra tutto (${log.length})`}
        </button>
      )}
    </div>
  );
}

function AltreCandidature({ items, studenteId }: { items: any[]; studenteId: string }) {
  const [open, setOpen] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpenIds(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-[13px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Altre {items.length} {items.length === 1 ? 'candidatura' : 'candidature'}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {items.map((c: any) => (
            <CandidaturaDetail
              key={c.id} candidatura={c} studenteId={studenteId}
              open={openIds.has(c.id)} onToggle={() => toggle(c.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// -------------------- Editor anagrafica --------------------
function EditAnagrafica({ form, setForm, errors, onSalva, onAnnulla, saving }: {
  form: any;
  setForm: (f: any) => void;
  errors: Record<string, string>;
  onSalva: () => void;
  onAnnulla: () => void;
  saving: boolean;
}) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const isIT = form.indirizzo_nazione === 'IT';
  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <FormField label="Nome" required error={errors.nome}>
          <Input value={form.nome} onChange={e => set('nome', e.target.value)} />
        </FormField>
        <FormField label="Cognome" required error={errors.cognome}>
          <Input value={form.cognome} onChange={e => set('cognome', e.target.value)} />
        </FormField>
        <FormField label="Email" required error={errors.email}>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </FormField>
        <FormField label="Telefono">
          <Input value={form.telefono} onChange={e => set('telefono', e.target.value)} />
        </FormField>
        <div>
          <DateOfBirthPicker
            lang="it"
            label="Data di nascita"
            value={form.data_nascita || ''}
            onChange={v => set('data_nascita', v)}
          />
        </div>
        <div>
          <NazionalitaCombobox
            value={form.nazionalita}
            onChange={v => set('nazionalita', v)}
          />
        </div>
        <FormField label="Codice fiscale" error={errors.codice_fiscale}>
          <Input
            value={form.codice_fiscale}
            disabled={form.cf_non_disponibile}
            onChange={e => set('codice_fiscale', e.target.value.toUpperCase())}
          />
          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Checkbox
              checked={form.cf_non_disponibile}
              onCheckedChange={v => setForm((f: any) => ({ ...f, cf_non_disponibile: !!v, codice_fiscale: v ? '' : f.codice_fiscale }))}
            />
            Codice fiscale non disponibile
          </label>
        </FormField>
        <FormField label="N. documento identità">
          <Input value={form.documento_identita_n} onChange={e => set('documento_identita_n', e.target.value)} />
        </FormField>
      </div>

      <div>
        <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">Residenza</p>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <FormField label="Via" required error={errors.indirizzo_via}>
            <Input value={form.indirizzo_via} onChange={e => set('indirizzo_via', e.target.value)} />
          </FormField>
          <FormField label="Civico" required error={errors.indirizzo_civico}>
            <Input value={form.indirizzo_civico} onChange={e => set('indirizzo_civico', e.target.value)} />
          </FormField>
          <FormField label="CAP" required={isIT} error={errors.indirizzo_cap}>
            <Input value={form.indirizzo_cap} onChange={e => set('indirizzo_cap', e.target.value)} />
          </FormField>
          <FormField label="Comune" required error={errors.indirizzo_comune}>
            <Input value={form.indirizzo_comune} onChange={e => set('indirizzo_comune', e.target.value)} />
          </FormField>
          <div>
            <ProvinciaCombobox
              value={form.indirizzo_provincia}
              disabled={!isIT}
              onChange={v => set('indirizzo_provincia', v)}
              error={errors.indirizzo_provincia}
            />
          </div>
          <div>
            <NazioneCombobox
              value={form.indirizzo_nazione}
              onChange={v => setForm((f: any) => ({
                ...f, indirizzo_nazione: v, indirizzo_provincia: v === 'IT' ? f.indirizzo_provincia : '',
              }))}
              error={errors.indirizzo_nazione}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
        <Button variant="outline" size="sm" onClick={onAnnulla} disabled={saving}>
          <XIcon className="w-4 h-4 mr-1" /> Annulla
        </Button>
        <Button size="sm" onClick={onSalva} disabled={saving}>
          <Check className="w-4 h-4 mr-1" /> {saving ? 'Salvataggio…' : 'Salva'}
        </Button>
      </div>
    </div>
  );
}

function FormField({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[12px]">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
    </div>
  );
}

// Combobox riusati (identici pattern a Candidatura.tsx).
function NazionalitaCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Label className="text-[12px]">Nazionalità</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className={cn('mt-1.5 w-full justify-between font-normal', !value && 'text-muted-foreground')}>
            {value || 'Seleziona…'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Cerca…" />
            <CommandList>
              <CommandEmpty>Nessun risultato</CommandEmpty>
              <CommandGroup>
                {NATIONALITIES.map(n => (
                  <CommandItem key={n.code} value={`${n.it} ${n.en}`} onSelect={() => { onChange(n.it); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === n.it ? 'opacity-100' : 'opacity-0')} />
                    {n.it}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

function ProvinciaCombobox({ value, disabled, onChange, error }: {
  value: string; disabled?: boolean; onChange: (v: string) => void; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = PROVINCE.find(p => p.sigla === value);
  return (
    <>
      <Label className="text-[12px]">Provincia{!disabled && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" disabled={disabled}
            className={cn('mt-1.5 w-full justify-between font-normal', !value && 'text-muted-foreground')}>
            <span className="truncate">{selected ? `${selected.sigla} — ${selected.nome}` : 'Seleziona…'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onCloseAutoFocus={e => e.preventDefault()}>
          <Command key={open ? 'open' : 'closed'}>
            <CommandInput placeholder="Cerca provincia…" />
            <CommandList>
              <CommandEmpty>Nessun risultato</CommandEmpty>
              <CommandGroup>
                {PROVINCE.map(p => (
                  <CommandItem key={p.sigla} value={`${p.sigla} ${p.nome}`} onSelect={() => { onChange(p.sigla); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === p.sigla ? 'opacity-100' : 'opacity-0')} />
                    {p.sigla} — {p.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
    </>
  );
}

function NazioneCombobox({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find(c => c.code === value);
  return (
    <>
      <Label className="text-[12px]">Nazione<span className="text-destructive ml-0.5">*</span></Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox"
            className={cn('mt-1.5 w-full justify-between font-normal', !value && 'text-muted-foreground')}>
            <span className="truncate">{selected ? selected.it : 'Seleziona…'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onCloseAutoFocus={e => e.preventDefault()}>
          <Command key={open ? 'open' : 'closed'}>
            <CommandInput placeholder="Cerca nazione…" />
            <CommandList>
              <CommandEmpty>Nessun risultato</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map(c => (
                  <CommandItem key={c.code} value={`${c.it} ${c.en}`} onSelect={() => { onChange(c.code); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === c.code ? 'opacity-100' : 'opacity-0')} />
                    {c.it}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
    </>
  );
}