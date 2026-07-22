/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  lang: 'it' | 'en'
  nome?: string
  siteName: string
  completionUrl: string
  scadeIlIso?: string
}

function formatDate(iso: string | undefined, lang: 'it' | 'en'): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return '' }
}

const COPY = {
  it: {
    preview: 'Completa la tua candidatura',
    heading: 'Passa alla fase successiva',
    hi: (n?: string) => (n ? `Ciao ${n},` : 'Ciao,'),
    p1: (s: string) => `hai superato il pre-screening per ${s}. Per procedere ti chiediamo di compilare la parte finale della candidatura con alcune informazioni aggiuntive (stile di vita, dati del garante, documenti integrativi).`,
    cta: 'Completa la candidatura',
    expiry: (d: string) => `Il link è valido fino al ${d}.`,
    footer: 'Se non ti aspettavi questa email puoi ignorarla. Per qualsiasi dubbio puoi contattare la Direzione.',
  },
  en: {
    preview: 'Complete your application',
    heading: 'Move to the next step',
    hi: (n?: string) => (n ? `Hi ${n},` : 'Hi,'),
    p1: (s: string) => `you passed the pre-screening for ${s}. To proceed please fill in the final part of the application with some additional information (lifestyle, guarantor details, extra documents).`,
    cta: 'Complete the application',
    expiry: (d: string) => `This link is valid until ${d}.`,
    footer: 'If you were not expecting this email you can ignore it. For any question please contact the Direction.',
  },
} as const

export const CandidaturaLinkCompletamentoEmail = ({ lang, nome, siteName, completionUrl, scadeIlIso }: Props) => {
  const c = COPY[lang] ?? COPY.it
  const scad = formatDate(scadeIlIso, lang)
  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{c.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{c.heading}</Heading>
          <Text style={text}>{c.hi(nome)}</Text>
          <Text style={text}>{c.p1(siteName)}</Text>
          <Button style={button} href={completionUrl}>{c.cta}</Button>
          {scad ? <Text style={{ ...text, marginTop: '20px' }}>{c.expiry(scad)}</Text> : null}
          <Text style={footer}>{c.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default CandidaturaLinkCompletamentoEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 16px' }
const button = { backgroundColor: '#003b6b', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '6px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }