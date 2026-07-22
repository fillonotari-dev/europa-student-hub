/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  lang: 'it' | 'en'
  nome?: string
  siteName: string
}

const COPY = {
  it: {
    preview: (s: string) => `Abbiamo ricevuto la tua candidatura per ${s}`,
    heading: 'Candidatura ricevuta',
    hi: (n?: string) => (n ? `Ciao ${n},` : 'Ciao,'),
    p1: (s: string) => `abbiamo ricevuto correttamente la tua candidatura per un posto letto presso ${s}.`,
    p2: 'Il nostro team esaminerà la tua richiesta e ti contatterà entro pochi giorni con l\'esito del pre-screening. Se il tuo profilo passerà questa prima fase, ti invieremo un link per completare la candidatura con le informazioni aggiuntive.',
    footer: 'Questa è un\'email automatica, non serve rispondere. Per qualsiasi dubbio puoi contattare la Direzione.',
  },
  en: {
    preview: (s: string) => `We received your application for ${s}`,
    heading: 'Application received',
    hi: (n?: string) => (n ? `Hi ${n},` : 'Hi,'),
    p1: (s: string) => `we have received your application for a room at ${s}.`,
    p2: 'Our team will review your request and get back to you within a few days with the outcome of the pre-screening. If your profile moves forward, we will send you a link to complete the application with the additional information.',
    footer: 'This is an automated email, no reply is needed. For any question please contact the Direction.',
  },
} as const

export const CandidaturaRicevutaEmail = ({ lang, nome, siteName }: Props) => {
  const c = COPY[lang] ?? COPY.it
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
          <Text style={footer}>{c.footer}</Text>
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