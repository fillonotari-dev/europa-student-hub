/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { ContattiBlock } from './_contatti-block.tsx'
import type { Contatti } from '../contatti.ts'

interface Props {
  lang: 'it' | 'en'
  nome?: string
  siteName: string
  contatti?: Partial<Contatti>
}

const COPY = {
  it: {
    preview: (s: string) => `Abbiamo ricevuto la tua candidatura per ${s}`,
    heading: 'Candidatura ricevuta',
    hi: (n?: string) => (n ? `Ciao ${n},` : 'Ciao,'),
    p1: (s: string) => `abbiamo ricevuto correttamente la tua candidatura per un posto letto presso ${s}.`,
    p2: 'Il nostro team esaminerà la tua richiesta e ti contatterà entro pochi giorni con l\'esito del pre-screening. Se il tuo profilo passerà questa prima fase, ti invieremo un link per completare la candidatura con le informazioni aggiuntive.',
    footerFallback: 'Per qualsiasi dubbio puoi contattare la Direzione.',
    footerEmailTel: (e: string, t: string) => `Per qualsiasi domanda scrivi a ${e} o chiama ${t}.`,
    footerEmail: (e: string) => `Per qualsiasi domanda scrivi a ${e}.`,
    footerTel: (t: string) => `Per qualsiasi domanda chiama ${t}.`,
  },
  en: {
    preview: (s: string) => `We received your application for ${s}`,
    heading: 'Application received',
    hi: (n?: string) => (n ? `Hi ${n},` : 'Hi,'),
    p1: (s: string) => `we have received your application for a room at ${s}.`,
    p2: 'Our team will review your request and get back to you within a few days with the outcome of the pre-screening. If your profile moves forward, we will send you a link to complete the application with the additional information.',
    footerFallback: 'For any question please contact the Direction.',
    footerEmailTel: (e: string, t: string) => `For any question write to ${e} or call ${t}.`,
    footerEmail: (e: string) => `For any question write to ${e}.`,
    footerTel: (t: string) => `For any question call ${t}.`,
  },
} as const

export const CandidaturaRicevutaEmail = ({ lang, nome, siteName, contatti }: Props) => {
  const c = COPY[lang] ?? COPY.it
  const email = (contatti?.contatto_email || '').trim()
  const tel = (contatti?.contatto_telefono || '').trim()
  const footerText = email && tel
    ? c.footerEmailTel(email, tel)
    : email
      ? c.footerEmail(email)
      : tel
        ? c.footerTel(tel)
        : c.footerFallback
  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{c.preview(siteName)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{c.heading}</Heading>
          <Text style={text}>{c.hi(nome)}</Text>
          <Text style={text}>{c.p1(siteName)}</Text>
          <Text style={text}>{c.p2}</Text>
          <ContattiBlock lang={lang} contatti={contatti} />
          <Text style={footer}>{footerText}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default CandidaturaRicevutaEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 16px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }