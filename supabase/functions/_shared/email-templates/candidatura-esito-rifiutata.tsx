/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { ContattiBlock } from './_contatti-block.tsx'
import type { Contatti } from '../contatti.ts'

interface Props {
  lang: 'it' | 'en'
  nome?: string
  siteName: string
  notaAdmin?: string
  contatti?: Partial<Contatti>
}

const COPY = {
  it: {
    preview: 'Aggiornamento sulla tua candidatura',
    heading: 'Esito della candidatura',
    hi: (n?: string) => (n ? `Ciao ${n},` : 'Ciao,'),
    p1: (s: string) => `ti ringraziamo per l'interesse verso ${s} e per il tempo dedicato alla candidatura.`,
    p2: 'Dopo un\'attenta valutazione, ci dispiace comunicarti che la tua candidatura non è stata accolta per questa selezione.',
    p3: 'Ti auguriamo il meglio per il tuo percorso di studi.',
    notaTitle: 'Nota dalla Direzione',
    footer: 'Per qualsiasi chiarimento puoi contattare la Direzione.',
  },
  en: {
    preview: 'Update about your application',
    heading: 'Application outcome',
    hi: (n?: string) => (n ? `Hi ${n},` : 'Hi,'),
    p1: (s: string) => `thank you for your interest in ${s} and for the time you invested in the application.`,
    p2: 'After careful evaluation, we are sorry to inform you that your application has not been accepted for this selection.',
    p3: 'We wish you all the best for your studies.',
    notaTitle: 'Note from the Direction',
    footer: 'For any clarification please contact the Direction.',
  },
} as const

export const CandidaturaEsitoRifiutataEmail = ({ lang, nome, siteName, notaAdmin, contatti }: Props) => {
  const c = COPY[lang] ?? COPY.it
  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{c.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{c.heading}</Heading>
          <Text style={text}>{c.hi(nome)}</Text>
          <Text style={text}>{c.p1(siteName)}</Text>
          <Text style={text}>{c.p2}</Text>
          <Text style={text}>{c.p3}</Text>
          {notaAdmin ? (
            <>
              <Hr style={hr} />
              <Text style={notaTitle}>{c.notaTitle}</Text>
              <Text style={notaText}>{notaAdmin}</Text>
            </>
          ) : null}
          <ContattiBlock lang={lang} contatti={contatti} />
          <Text style={footer}>{c.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default CandidaturaEsitoRifiutataEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 16px' }
const hr = { borderColor: '#eaeaea', margin: '24px 0' }
const notaTitle = { fontSize: '13px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 8px' }
const notaText = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 16px', whiteSpace: 'pre-wrap' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }