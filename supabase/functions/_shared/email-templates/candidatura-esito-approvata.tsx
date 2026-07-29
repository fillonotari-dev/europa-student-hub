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
    preview: 'La tua candidatura è stata approvata',
    heading: 'Candidatura approvata',
    hi: (n?: string) => (n ? `Ciao ${n},` : 'Ciao,'),
    p1: (s: string) => `siamo felici di comunicarti che la tua candidatura per ${s} è stata approvata.`,
    p2: 'A breve la Direzione ti contatterà con i prossimi passi (assegnazione della camera, documenti finali e modalità di ingresso).',
    notaTitle: 'Nota dalla Direzione',
    footer: 'Per qualsiasi dubbio puoi rispondere direttamente alla Direzione.',
  },
  en: {
    preview: 'Your application has been approved',
    heading: 'Application approved',
    hi: (n?: string) => (n ? `Hi ${n},` : 'Hi,'),
    p1: (s: string) => `we are glad to inform you that your application for ${s} has been approved.`,
    p2: 'The Direction will contact you shortly with the next steps (room assignment, final documents and move-in details).',
    notaTitle: 'Note from the Direction',
    footer: 'For any question you can reply directly to the Direction.',
  },
} as const

export const CandidaturaEsitoApprovataEmail = ({ lang, nome, siteName, notaAdmin, contatti }: Props) => {
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

export default CandidaturaEsitoApprovataEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 16px' }
const hr = { borderColor: '#eaeaea', margin: '24px 0' }
const notaTitle = { fontSize: '13px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 8px' }
const notaText = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 16px', whiteSpace: 'pre-wrap' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }