// --- Stato di candidatura (colonna candidature.stato) --------------------
// Usato nella cronologia (log_stato_candidature) e per marcature legate
// all'esito email. La lista dei valori resta a sei elementi.

export const STATO_CANDIDATURA_LABELS: Record<string, string> = {
  da_valutare: 'Da valutare',
  in_attesa_studente: 'In attesa dello studente',
  da_decidere: 'Da decidere',
  accolta: 'Accolta',
  in_attesa_posto: 'In attesa di posto',
  rifiutata: 'Rifiutata',
};

export const STATO_CANDIDATURA_COLORS: Record<string, string> = {
  da_valutare: 'bg-primary/10 text-primary',
  in_attesa_studente: 'bg-accent/20 text-foreground',
  da_decidere: 'bg-warning/10 text-warning',
  accolta: 'bg-success/10 text-success',
  in_attesa_posto: 'bg-accent/20 text-foreground',
  rifiutata: 'bg-destructive/10 text-destructive',
};

export function formatStatoCandidatura(value: string | null | undefined): string {
  if (!value) return '—';
  if (STATO_CANDIDATURA_LABELS[value]) return STATO_CANDIDATURA_LABELS[value];
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// --- Stadio (vista v_studenti_stadio) ------------------------------------
// Sette valori reali della vista. È ciò che le liste della scheda persona
// mostrano — non lo stato candidatura.

export type Stadio =
  | 'da_valutare'
  | 'in_attesa_studente'
  | 'da_decidere'
  | 'in_attesa_posto'
  | 'assegnato'
  | 'in_casa'
  | 'archiviato';

export const STADIO_LABELS: Record<string, string> = {
  da_valutare: 'Da valutare',
  in_attesa_studente: 'In attesa dello studente',
  da_decidere: 'Da decidere',
  in_attesa_posto: 'In attesa di posto',
  assegnato: 'Assegnato',
  in_casa: 'In casa',
  archiviato: 'Archiviato',
};

export const STADIO_COLORS: Record<string, string> = {
  da_valutare: 'bg-primary/10 text-primary',
  in_attesa_studente: 'bg-accent/20 text-foreground',
  da_decidere: 'bg-warning/10 text-warning',
  in_attesa_posto: 'bg-accent/20 text-foreground',
  assegnato: 'bg-success/10 text-success',
  in_casa: 'bg-success/15 text-success',
  archiviato: 'bg-muted text-muted-foreground',
};

export function formatStadio(value: string | null | undefined): string {
  if (!value) return '—';
  if (STADIO_LABELS[value]) return STADIO_LABELS[value];
  const spaced = value.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const STADI_CANDIDATURE: Stadio[] = [
  'da_valutare', 'in_attesa_studente', 'da_decidere', 'in_attesa_posto',
];
export const STADI_RESIDENTI: Stadio[] = ['assegnato', 'in_casa'];