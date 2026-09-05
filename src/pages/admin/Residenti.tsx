import { useMemo, useState } from 'react';
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
import { AggiungiPersonaDialog } from '@/components/admin/AggiungiPersonaDialog';
import { fmtDate } from '@/lib/exportXlsx';
import { Search, Users as UsersIcon, ArrowUp, ArrowDown, ArrowUpDown, UserPlus } from 'lucide-react';
import { STADI_RESIDENTI, formatStadio } from '@/lib/statoCandidatura';
import { StadioBadge } from '@/components/admin/candidatura/CandidaturaBadges';
import { fetchStadi, type StadioRow } from '@/lib/studentiQuery';
import { useCandidaturaActions, CandidaturaActionsContext } from '@/hooks/useCandidaturaActions';
import { CandidaturaActions } from '@/components/admin/CandidaturaActions';

const PAGE_SIZE = 15;
type SortKey = 'nome' | 'email' | 'camera' | 'struttura' | 'stadio';

export default function Residenti() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const search = searchParams.get('q') ?? '';
  const filterStadio = searchParams.get('stadio') ?? 'tutti';
  const filterStruttura = searchParams.get('sede') ?? 'tutti';
  const sortKey = ((searchParams.get('sk') as SortKey) ?? 'nome');
  const sortDir = ((searchParams.get('sd') as 'asc' | 'desc') ?? 'asc');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const patchParams = (patch: Record<string, string | null>, opts: { resetPage?: boolean } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    if (opts.resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };
  const setPage = (p: number | ((prev: number) => number)) => {
    const val = typeof p === 'function' ? p(page) : p;
    patchParams({ page: val > 1 ? String(val) : null });
  };

  const openScheda = (studenteId: string) => {
    const qs = searchParams.toString();
    const suffix = qs ? `&${qs}` : '';
    navigate(`/admin/studenti/${studenteId}?from=residenti${suffix}`);
  };

  const { data: rows } = useQuery({
    queryKey: ['stadio', 'residenti'],
    queryFn: () => fetchStadi([...STADI_RESIDENTI, 'archiviato']),
  });

  const { data: strutture } = useQuery({
    queryKey: ['strutture-tutte'],
    queryFn: async () => {
      const { data } = await supabase.from('strutture').select('id, nome').order('nome');
      return data ?? [];
    },
  });

  const { data: studentiHaAssegnazioneAttiva } = useQuery({
    queryKey: ['assegnazioni-attive', 'set'],
    queryFn: async () => {
      const { data } = await supabase.from('assegnazioni').select('candidatura_id').eq('stato', 'attiva');
      return new Set((data ?? []).map((a: any) => a.candidatura_id));
    },
  });

  const { data: studentiHaAvutoAssegnazione } = useQuery({
    queryKey: ['assegnazioni-any', 'set'],
    queryFn: async () => {
      const { data } = await supabase.from('assegnazioni').select('candidatura_id');
      return new Set((data ?? []).map((a: any) => a.candidatura_id));
    },
  });

  const actions = useCandidaturaActions({
    studentiHaAssegnazioneAttiva: studentiHaAssegnazioneAttiva ?? null,
    studentiHaAvutoAssegnazione: studentiHaAvutoAssegnazione ?? null,
  });

  const toCandidaturaLike = (r: StadioRow) => ({
    id: r.candidatura_id ?? r.studente_id,
    stato: r.candidatura_stato,
    stadio: r.stadio,
    versione_form: r.versione_form,
    origine: r.origine,
    esito_email_inviata_il: r.esito_email_inviata_il,
    token_scade_il: r.token_scade_il,
    completata_il: r.completata_il,
    studente_id: r.studente_id,
    studenti: { email: r.email, nome: r.nome, cognome: r.cognome },
    assegnazione_id: r.assegnazione_id,
    camera_id_corrente: r.camera_id,
    camera_numero_corrente: r.camera_numero,
    struttura_nome_corrente: r.struttura_nome,
    data_fine_corrente: r.data_fine,
  });

  const filtered = useMemo(() => {
    const list = (rows ?? []).filter(r =>
      filterStadio === 'tutti' ? r.stadio !== 'archiviato' : r.stadio === filterStadio,
    );
    return list
      .filter(r => filterStruttura === 'tutti' || r.struttura_id === filterStruttura)
      .filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.nome?.toLowerCase().includes(q) || r.cognome?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'nome':
            return dir * `${a.cognome ?? ''} ${a.nome ?? ''}`.localeCompare(`${b.cognome ?? ''} ${b.nome ?? ''}`);
          case 'email':
            return dir * (a.email ?? '').localeCompare(b.email ?? '');
          case 'camera':
            return dir * String(a.camera_numero ?? '').localeCompare(String(b.camera_numero ?? ''), undefined, { numeric: true });
          case 'struttura':
            return dir * (a.struttura_nome ?? '').localeCompare(b.struttura_nome ?? '');
          case 'stadio':
            return dir * a.stadio.localeCompare(b.stadio);
        }
      });
  }, [rows, filterStadio, filterStruttura, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) patchParams({ sd: sortDir === 'asc' ? 'desc' : 'asc' }, { resetPage: true });
    else patchParams({ sk: key, sd: 'asc' }, { resetPage: true });
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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca residente..." value={search}
            onChange={e => patchParams({ q: e.target.value || null }, { resetPage: true })} className="pl-9" />
        </div>
        <Select value={filterStadio} onValueChange={(v) => patchParams({ stadio: v === 'tutti' ? null : v }, { resetPage: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Attivi (assegnati + in casa)</SelectItem>
            <SelectItem value="assegnato">Assegnati (pre-arrivo)</SelectItem>
            <SelectItem value="in_casa">In casa</SelectItem>
            <SelectItem value="archiviato">Archiviati</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStruttura} onValueChange={(v) => patchParams({ sede: v === 'tutti' ? null : v }, { resetPage: true })}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le sedi</SelectItem>
            {(strutture ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Aggiungi persona
        </Button>
        <ExportButton
          filename="residenti"
          getRows={() => filtered.map(r => ({
            'Cognome': r.cognome ?? '',
            'Nome': r.nome ?? '',
            'Email': r.email ?? '',
            'Stadio': formatStadio(r.stadio),
            'Struttura': r.struttura_nome ?? '',
            'Camera': r.camera_numero ?? '',
            'Posto': r.posto ?? '',
            'Data inizio': fmtDate(r.data_inizio ?? undefined),
            'Data fine': fmtDate(r.data_fine ?? undefined),
          }))}
        />
      </div>

      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <SortHeader k="nome" label="Nome" />
              <SortHeader k="email" label="Email" />
              <SortHeader k="camera" label="Camera" />
              <SortHeader k="struttura" label="Struttura" />
              <SortHeader k="stadio" label="Stadio" />
              <th className="px-4 py-3 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r, i) => (
              <motion.tr key={`${r.studente_id}-${r.assegnazione_id ?? ''}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => openScheda(r.studente_id)}>
                <td className="px-4 py-3 text-sm font-medium">{r.cognome} {r.nome}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.email}</td>
                <td className="px-4 py-3 text-sm">{r.camera_numero || '—'}</td>
                <td className="px-4 py-3 text-sm">{r.struttura_nome || '—'}</td>
                <td className="px-4 py-3"><StadioBadge stadio={r.stadio} /></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <CandidaturaActions.Menu candidatura={toCandidaturaLike(r) as any} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <UsersIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Nessun residente trovato</p>
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
      <AggiungiPersonaDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
    </CandidaturaActionsContext.Provider>
  );
}