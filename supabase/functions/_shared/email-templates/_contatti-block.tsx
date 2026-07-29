/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Hr, Link, Text } from 'npm:@react-email/components@0.0.22'
import { whatsappUrl, type Contatti } from '../contatti.ts'

interface Props {
  lang: 'it' | 'en'
  contatti?: Partial<Contatti>
}

const LABELS = {
  it: { title: 'Contatti', email: 'Email', tel: 'Telefono', wa: 'WhatsApp', orari: 'Orari' },
  en: { title: 'Get in touch', email: 'Email', tel: 'Phone', wa: 'WhatsApp', orari: 'Hours' },
} as const

export const ContattiBlock = ({ lang, contatti }: Props) => {
  const c = contatti ?? {}
  const email = (c.contatto_email || '').trim()
  const tel = (c.contatto_telefono || '').trim()
  const wa = (c.contatto_whatsapp || '').trim()
  const orari = (c.contatto_orari || '').trim()
  if (!email && !tel && !wa && !orari) return null
  const L = LABELS[lang] ?? LABELS.it
  const waHref = whatsappUrl(wa)
  return (
    <>
      <Hr style={hr} />
      <Text style={title}>{L.title}</Text>
      {email ? (
        <Text style={row}><strong>{L.email}:</strong> <Link href={`mailto:${email}`} style={link}>{email}</Link></Text>
      ) : null}
      {tel ? (
        <Text style={row}><strong>{L.tel}:</strong> <Link href={`tel:${tel.replace(/[^+\d]/g, '')}`} style={link}>{tel}</Link></Text>
      ) : null}
      {waHref ? (
        <Text style={row}><strong>{L.wa}:</strong> <Link href={waHref} style={link}>{wa}</Link></Text>
      ) : null}
      {orari ? (
        <Text style={row}><strong>{L.orari}:</strong> {orari}</Text>
      ) : null}
    </>
  )
}

export default ContattiBlock

const hr = { borderColor: '#eaeaea', margin: '24px 0' }
const title = { fontSize: '13px', fontWeight: 'bold' as const, color: '#003b6b', margin: '0 0 8px' }
const row = { fontSize: '13px', color: '#4a4a4a', lineHeight: '1.5', margin: '0 0 6px' }
const link = { color: '#003b6b', textDecoration: 'underline' }