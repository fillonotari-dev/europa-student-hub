// Shared helper to render a React Email template and enqueue it on the
// `transactional_emails` pgmq queue via the existing `enqueue_email` RPC.
// Mirrors the pattern used in `auth-email-hook`.

/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'

export const SITE_NAME = 'Studentato Europa'
export const SENDER_DOMAIN = 'updates.app.studentatoeuropa.it'
export const FROM_DOMAIN = 'app.studentatoeuropa.it'

export interface EnqueueArgs {
  component: React.ComponentType<any>
  props: Record<string, unknown>
  subject: string
  to: string
  label: string // used as template_name in email_send_log
}

export async function enqueueTransactional(args: EnqueueArgs): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const html = await renderAsync(React.createElement(args.component, args.props))
    const text = await renderAsync(React.createElement(args.component, args.props), { plainText: true })

    const messageId = crypto.randomUUID()

    // Ensure an unsubscribe token exists for this recipient. The email API
    // requires it for all transactional sends.
    let unsubscribeToken: string | null = null
    const { data: existingToken } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', args.to)
      .maybeSingle()
    if (existingToken?.token) {
      unsubscribeToken = existingToken.token
    } else {
      const newToken = crypto.randomUUID()
      const { data: inserted, error: insErr } = await supabase
        .from('email_unsubscribe_tokens')
        .insert({ email: args.to, token: newToken })
        .select('token')
        .maybeSingle()
      if (insErr) {
        // Race: another concurrent insert may have created it — re-read.
        const { data: retry } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token')
          .eq('email', args.to)
          .maybeSingle()
        unsubscribeToken = retry?.token ?? null
      } else {
        unsubscribeToken = inserted?.token ?? newToken
      }
    }

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: args.label,
      recipient_email: args.to,
      status: 'pending',
    })

    const { error } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        to: args.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: args.subject,
        html,
        text,
        purpose: 'transactional',
        label: args.label,
        queued_at: new Date().toISOString(),
      },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, messageId }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? 'enqueue failed' }
  }
}