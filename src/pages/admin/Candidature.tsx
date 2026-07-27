import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { ExportButton } from '@/components/admin/ExportButton';
import { fmtDate } from '@/lib/exportXlsx';
import {
  Search, FileText, Download, ArrowUp, ArrowDown, ArrowUpDown,
  MailCheck,
} from 'lucide-react';
import { useStrutturaFilter } from '@/hooks/useStrutturaFilter';
import { STATO_LABELS, STATO_COLORS, formatStato } from '@/lib/statoCandidatura';
import { useCandidaturaActions, CandidaturaActionsContext } from '@/hooks/useCandidaturaActions';
import { CandidaturaActions } from '@/components/admin/CandidaturaActions';

const STATI = ['ricevuta', 'in_completamento', 'completata', 'approvata', 'rifiutata', 'ritirata'] as const;
const STATO_ORDER: Record<string, number> = {
  ricevuta: 0, in_completamento: 1, completata: 2,
  approvata: 3, rifiutata: 4, ritirata: 5, sostituita: 6,
};
const TIPO_STUDENTE_LABELS: Record<string, string> = {
  universitario: 'Corso di laurea', erasmus: 'Erasmus o scambio', master: 'Master o dottorato', altro: 'Altro',
};
const COME_CONOSCIUTO_LABELS: Record<string, string> = {
  instagram: 'Instagram', google: 'Google', universita: 'Università', esn: 'ESN',
  amici: 'Amici', sito: 'Sito web', altro: 'Altro',
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
const PAGE_SIZE = 15;
type SortKey = 'studente' | 'struttura' | 'anno' | 'stato' | 'data';

export default function Candidature() {
  const { strutturaId, isAll } = useStrutturaFilter();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tutto lo stato della lista vive nell'URL: reload e tasto indietro lo ripristinano.
  const search = searchParams.get('q') ?? '';
  const filterStato = searchParams.get('stato') ?? 'tutti';
  const sortKey = ((searchParams.get('sk') as SortKey) ?? 'data');
  const sortDir = ((searchParams.get('sd') as 'asc' | 'desc') ?? 'desc');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const esitoFilter = searchParams.get('esito_da_inviare') === '1';

  const patchParams = (patch: Record<string, string | null>, opts: { resetPage?: boolean } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    if (opts.resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const { data: candidature } = useQuery({
    queryKey: ['candidature', filterStato, strutturaId],
    queryFn: async () => {
      let query = supabase
        .from('candidature')
        .select('*, studenti(nome, cognome, email, telefono, nazionalita, data_nascita, codice_fiscale), strutture(nome)')
        .order('created_at', { ascending: false });
      if (filterStato !== 'tutti') query = query.eq('stato', filterStato);
      if (!isAll) query = query.eq('struttura_preferita_id', strutturaId);
      const { data } = await query;
      return data ?? [];
    },
  });

  // Set di candidature con assegnazione attiva (per warning sui cambi stato).
  const { data: candidatureConAssegnazione } = useQuery({
    queryKey: ['candidature-con-assegnazione-attiva'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assegnazioni')
        .select('candidatura_id')
        .eq('stato', 'attiva');
      return new Set((data ?? []).map((a: any) => a.candidatura_id));
    },
  });

  const actions = useCandidaturaActions({
    candidatureConAssegnazione: candidatureConAssegnazione ?? null,
  });

  const filtered = (candidature ?? [])
    .filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.studenti?.nome?.toLowerCase().includes(s) || c.studenti?.cognome?.toLowerCase().includes(s) || c.studenti?.email?.toLowerCase().includes(s);
    })
    .filter(c => !esitoFilter || c.esito_email_stato === 'da_inviare')
    .sort((a: any, b: any) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'studente':
          return dir * `${a.studenti?.cognome ?? ''} ${a.studenti?.nome ?? ''}`.localeCompare(`${b.studenti?.cognome ?? ''} ${b.studenti?.nome ?? ''}`);
        case 'struttura':
          return dir * (a.strutture?.nome ?? '').localeCompare(b.strutture?.nome ?? '');
        case 'anno':
          return dir * String(a.anno_accademico ?? '').localeCompare(String(b.anno_accademico ?? ''));
        case 'stato':
          return dir * ((STATO_ORDER[a.stato] ?? 99) - (STATO_ORDER[b.stato] ?? 99));
        case 'data':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const setPage = (p: number | ((prev: number) => number)) => {
    const val = typeof p === 'function' ? p(currentPage) : p;
    patchParams({ page: val > 1 ? String(val) : null });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      patchParams({ sd: sortDir === 'asc' ? 'desc' : 'asc' }, { resetPage: true });
    } else {
      patchParams({ sk: key, sd: key === 'data' ? 'desc' : 'asc' }, { resetPage: true });
    }
  };

  const openScheda = (c: any) => {
    const qs = searchParams.toString();
    const suffix = qs ? `&${qs}` : '';
    navigate(`/admin/studenti/${c.studente_id}?candidatura=${c.id}&from=candidature${suffix}`);
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th className="text-left px-4 py-3 font-semibold">
        <button type="button" onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}>
          {label}
          <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
      </th>
    );
  };

  return (
    <CandidaturaActionsContext.Provider value={actions.ctxValue}>
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca per nome o email..." value={search}
            onChange={e => patchParams({ q: e.target.value || null }, { resetPage: true })} className="pl-9" />
        </div>
        <Select value={filterStato} onValueChange={(v) => patchParams({ stato: v === 'tutti' ? null : v }, { resetPage: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI.map(s => <SelectItem key={s} value={s}>{STATO_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        {esitoFilter && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => patchParams({ esito_da_inviare: null }, { resetPage: true })}
          >
            <MailCheck className="w-4 h-4 mr-2" /> Solo esiti da comunicare · Rimuovi
          </Button>
        )}
        <ExportButton
          filename="candidature"
          getRows={() => filtered.map((c: any) => {
            const base: Record<string, any> = {
              'Nome': c.studenti?.nome ?? '',
              'Cognome': c.studenti?.cognome ?? '',
              'Email': c.studenti?.email ?? '',
              'Telefono': c.studenti?.telefono ?? '',
              'Nazionalità': c.studenti?.nazionalita ?? '',
              'Data di nascita': fmtDate(c.studenti?.data_nascita),
              'Codice fiscale': c.studenti?.codice_fiscale ?? '',
              'Indirizzo residenza': c.indirizzo_residenza ?? '',
              'N. documento identità': c.documento_identita_n ?? '',
              'Struttura preferita': c.strutture?.nome ?? '',
              'Università': c.universita_snapshot ?? '',
              'Corso': c.corso_snapshot ?? '',
              'Anno corso': c.anno_corso_snapshot ?? '',
              'Matricola': c.matricola_snapshot ?? '',
              'Tipo studente': c.tipo_studente === 'altro' ? (c.tipo_studente_altro ?? 'Altro') : (TIPO_STUDENTE_LABELS[c.tipo_studente] ?? c.tipo_studente ?? ''),
              'Stato': formatStato(c.stato),
              'Versione form': c.versione_form === 'completa' ? 'Completa' : 'Pre-screening',
              'Anno accademico': c.anno_accademico ?? '',
              'Periodo inizio': fmtDate(c.periodo_inizio),
              'Periodo fine': fmtDate(c.periodo_fine),
              'Data arrivo prevista': fmtDate(c.data_arrivo_prevista),
              'Come conosciuto': c.come_conosciuto === 'altro' ? (c.come_conosciuto_altro ?? 'Altro') : (COME_CONOSCIUTO_LABELS[c.come_conosciuto] ?? c.come_conosciuto ?? ''),
              'Note preferenze': c.preferenze_note ?? '',
              'Lingue parlate': c.lingue_parlate ?? '',
              'Orari': ORARI_LABELS[c.orari] ?? c.orari ?? '',
              'Personalità': c.personalita === 'altro' ? (c.personalita_altro ?? 'Altro') : (PERSONALITA_LABELS[c.personalita] ?? c.personalita ?? ''),
              'Ordine/pulizia': ORDINE_LABELS[c.ordine_pulizia] ?? c.ordine_pulizia ?? '',
              'Fumatore': c.fumatore === true ? 'Sì' : c.fumatore === false ? 'No' : '',
              'Presentazione': c.presentazione ?? '',
              'Garante nome': c.garante_nome ?? '',
              'Garante relazione': c.garante_relazione ?? '',
              'Garante telefono': c.garante_telefono ?? '',
              'Garante email': c.garante_email ?? '',
              'Data candidatura': fmtDate(c.created_at),
              'Completata il': fmtDate(c.completata_il),
            };
            return base;
          })}
        />
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
                <SortHeader k="studente" label="Studente" />
                <SortHeader k="struttura" label="Struttura" />
                <SortHeader k="anno" label="Anno" />
                <SortHeader k="stato" label="Stato" />
                <SortHeader k="data" label="Data" />
                <th className="px-4 py-3 text-right font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c: any, i: number) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => openScheda(c)}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{c.studenti?.nome} {c.studenti?.cognome}</p>
                    <p className="text-[11px] text-muted-foreground">{c.studenti?.email}</p>
                    {c.versione_form === 'completa' && (
                      <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success">
                        Form completo
                      </span>
                    )}
                    {c.versione_form !== 'completa' && c.token_scade_il && new Date(c.token_scade_il) > new Date() && (
                      <span className="inline-block mt-1 ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/20 text-foreground">
                        Link attivo · scade {new Date(c.token_scade_il).toLocaleDateString('it-IT')}
                      </span>
                    )}
                    {c.versione_form !== 'completa' && c.token_scade_il && new Date(c.token_scade_il) <= new Date() && (
                      <span className="inline-block mt-1 ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        Link scaduto
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{c.strutture?.nome || '-'}</td>
                  <td className="px-4 py-3 text-sm">{c.anno_accademico}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATO_COLORS[c.stato] ?? 'bg-muted text-muted-foreground'}`}>
                      {formatStato(c.stato)}
                    </span>
                    {(c.stato === 'approvata' || c.stato === 'rifiutata') && c.esito_email_stato === 'da_inviare' && (
                      <span className="block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                        Esito da comunicare
                      </span>
                    )}
                    {(c.stato === 'approvata' || c.stato === 'rifiutata') && c.esito_email_stato === 'inviata' && (
                      <span className="block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success">
                        Esito inviato
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString('it-IT')}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <CandidaturaActions.Menu candidatura={c} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nessuna candidatura trovata</p>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} di {filtered.length}</span>
          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink href="#" isActive={currentPage === i + 1}
                      onClick={(e) => { e.preventDefault(); setPage(i + 1); }}>{i + 1}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {actions.dialogs}
    </div>
    </CandidaturaActionsContext.Provider>
  );
}
