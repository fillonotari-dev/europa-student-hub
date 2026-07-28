import {
  STATO_CANDIDATURA_COLORS, formatStatoCandidatura,
  STADIO_COLORS, formatStadio,
} from '@/lib/statoCandidatura';

/** Badge dello stadio persona (vista v_studenti_stadio). Sette valori. */
export function StadioBadge({ stadio }: { stadio: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STADIO_COLORS[stadio] ?? 'bg-muted text-muted-foreground'}`}>
      {formatStadio(stadio)}
    </span>
  );
}

/** Badge dello stato candidatura (colonna candidature.stato). Sei valori.
 *  Usato nella cronologia stati candidatura, non nelle liste. */
export function StatoCandidaturaBadge({ stato }: { stato: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATO_CANDIDATURA_COLORS[stato] ?? 'bg-muted text-muted-foreground'}`}>
      {formatStatoCandidatura(stato)}
    </span>
  );
}

export function CandidaturaBadges({ c }: { c: any }) {
  const linkAttivo = c.versione_form !== 'completa' && c.token_scade_il && new Date(c.token_scade_il) > new Date();
  const linkScaduto = c.versione_form !== 'completa' && c.token_scade_il && new Date(c.token_scade_il) <= new Date();
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <StatoCandidaturaBadge stato={c.stato} />
      {c.versione_form === 'completa' && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success">Form completo</span>
      )}
      {linkAttivo && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/20 text-foreground">
          Link attivo · scade {new Date(c.token_scade_il).toLocaleDateString('it-IT')}
        </span>
      )}
      {linkScaduto && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
          Link scaduto
        </span>
      )}
      {(c.stato === 'accolta' || c.stato === 'rifiutata') && !c.esito_email_inviata_il && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
          Esito da comunicare
        </span>
      )}
      {(c.stato === 'accolta' || c.stato === 'rifiutata') && !!c.esito_email_inviata_il && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success">
          Esito inviato{c.esito_email_inviata_il ? ` · ${new Date(c.esito_email_inviata_il).toLocaleDateString('it-IT')}` : ''}
        </span>
      )}
    </div>
  );
}