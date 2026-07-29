/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface Props {
  nome: string
  cognome: string
  studenteId: string
  appBaseUrl?: string
}

export const CandidaturaNuovaAdminEmail = ({
  nome, cognome, studenteId,
  appBaseUrl = 'https://app.studentatoeuropa.it',
}: Props) => {
  const url = `${appBaseUrl}/admin/studenti/${studenteId}`
  return (
    <Html lang="it" dir="ltr">
      <Head />
      <Preview>{`Nuova candidatura — ${nome} ${cognome}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nuova candidatura</Heading>
          <Text style={text}>È arrivata una nuova candidatura da valutare.</Text>
          <Text style={row}><strong>Nome:</strong> {nome} {cognome}</Text>
          <Button style={button} href={url}>Apri scheda nel gestionale</Button>
        </Container>
      </Body>
    </Html>
  )
}

export default CandidaturaNuovaAdminEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 16px' }
const row = { fontSize: '14px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 8px' }
const button = { backgroundColor: '#003b6b', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '6px', padding: '12px 20px', textDecoration: 'none', marginTop: '20px', display: 'inline-block' }