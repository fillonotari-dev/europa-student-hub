/// <reference types="npm:@types/react@18.3.1" />

import type * as React from 'npm:react@18.3.1'

import { CandidaturaRicevutaEmail } from '../email-templates/candidatura-ricevuta.tsx'
import { CandidaturaLinkCompletamentoEmail } from '../email-templates/candidatura-link-completamento.tsx'
import { CandidaturaEsitoApprovataEmail } from '../email-templates/candidatura-esito-approvata.tsx'
import { CandidaturaEsitoRifiutataEmail } from '../email-templates/candidatura-esito-rifiutata.tsx'
import { CandidaturaNuovaAdminEmail } from '../email-templates/candidatura-nuova-admin.tsx'
import { CandidaturaCompletataAdminEmail } from '../email-templates/candidatura-completata-admin.tsx'

// Registry entry contract used by send-transactional-email and
// preview-transactional-email. Each template file continues to live under
// _shared/email-templates/ (shared with the enqueue helper); this registry
// exposes them to the Lovable "App emails" panel.
export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

const SITE = 'Studentato Europa'

const CONTATTI_PREVIEW = {
  contatto_email: 'info@studentatoeuropa.it',
  contatto_telefono: '+39 059 000 0000',
  contatto_whatsapp: '+39 340 000 0000',
  contatto_orari: 'Lun–Ven 9:00–18:00',
  notifica_email: 'studentatoeuropa@gmail.com',
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'candidatura-ricevuta': {
    component: CandidaturaRicevutaEmail,
    subject: (d) =>
      d?.lang === 'en'
        ? `We received your application for ${d?.siteName ?? SITE}`
        : `Abbiamo ricevuto la tua candidatura per ${d?.siteName ?? SITE}`,
    displayName: 'Candidato — Candidatura ricevuta (fase 1)',
    previewData: { lang: 'it', nome: 'Mario', siteName: SITE, contatti: CONTATTI_PREVIEW },
  },
  'candidatura-link-completamento': {
    component: CandidaturaLinkCompletamentoEmail,
    subject: (d) => (d?.lang === 'en' ? 'Complete your application' : 'Completa la tua candidatura'),
    displayName: 'Candidato — Link di completamento (fase 2)',
    previewData: {
      lang: 'it',
      nome: 'Mario',
      siteName: SITE,
      completionUrl: 'https://app.studentatoeuropa.it/candidatura/completa?token=preview',
      scadeIlIso: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString(),
      contatti: CONTATTI_PREVIEW,
    },
  },
  'candidatura-esito-approvata': {
    component: CandidaturaEsitoApprovataEmail,
    subject: (d) =>
      d?.lang === 'en' ? 'Your application has been approved' : 'La tua candidatura è stata approvata',
    displayName: 'Candidato — Esito approvata',
    previewData: {
      lang: 'it',
      nome: 'Mario',
      siteName: SITE,
      notaAdmin: 'Ti aspettiamo per il colloquio la prossima settimana.',
      contatti: CONTATTI_PREVIEW,
    },
  },
  'candidatura-esito-rifiutata': {
    component: CandidaturaEsitoRifiutataEmail,
    subject: (d) =>
      d?.lang === 'en' ? 'Update about your application' : 'Aggiornamento sulla tua candidatura',
    displayName: 'Candidato — Esito non accolta',
    previewData: {
      lang: 'it',
      nome: 'Mario',
      siteName: SITE,
      contatti: CONTATTI_PREVIEW,
    },
  },
  'candidatura-nuova-admin': {
    component: CandidaturaNuovaAdminEmail,
    subject: (d) => `Nuova candidatura — ${d?.nome ?? ''} ${d?.cognome ?? ''}`.trim(),
    displayName: 'Admin — Nuova candidatura',
    previewData: {
      nome: 'Mario',
      cognome: 'Rossi',
      sedePreferita: 'Sede Modena Centro',
      tipoCamera: 'Singola',
      periodoInizio: '2026-09-01',
      periodoFine: '2027-07-31',
      dataInvioIso: new Date().toISOString(),
      studenteId: '00000000-0000-0000-0000-000000000000',
    },
  },
  'candidatura-completata-admin': {
    component: CandidaturaCompletataAdminEmail,
    subject: (d) => `Candidatura completata — ${d?.nome ?? ''} ${d?.cognome ?? ''}`.trim(),
    displayName: 'Admin — Candidatura completata',
    previewData: {
      nome: 'Mario',
      cognome: 'Rossi',
      sedePreferita: 'Sede Modena Centro',
      tipoCamera: 'Singola',
      periodoInizio: '2026-09-01',
      periodoFine: '2027-07-31',
      dataInvioIso: new Date().toISOString(),
      studenteId: '00000000-0000-0000-0000-000000000000',
    },
  },
}