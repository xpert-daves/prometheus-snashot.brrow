'use client'

import Link from 'next/link'
import { useId, useState, type FormEvent } from 'react'
import { PHONE_DISPLAY, PHONE_NUMBER } from '@/lib/contact'
import { EMAIL_PATTERN } from '@/lib/emailPattern'
import { formatUSForDisplay, normalizeUS } from '@/lib/phone'
import {
  SMS_CHAT_CONSENT_BODY_TEXT,
  SMS_CHAT_CONSENT_TEXT,
  SMS_CHAT_CONSENT_TEXT_VERSION,
} from '@/lib/smsConsent'
import type { ChatContact } from '@/lib/webChatClient'

const fieldClass =
  'w-full rounded-lg border border-white/12 bg-[#0d0e10] px-3 py-2.5 text-base text-white placeholder:text-white/35 outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 md:text-sm'

function toE164(phone: string): string | null {
  try {
    return normalizeUS(phone)
  } catch {
    return null
  }
}

/**
 * Asks the visitor for a name plus a phone or email so the chat can become a
 * lead. The SMS box starts unticked and `smsConsent` is only sent when ticked,
 * with the exact text shown in the label.
 */
export default function ContactCard({
  onSubmit,
  onDismiss,
}: {
  onSubmit: (contact: ChatContact) => Promise<boolean>
  onDismiss: () => void
}) {
  const consentTextId = useId()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const normalizedPhone = phone.trim() ? toE164(phone) : null

    if (!trimmedName) return setProblem('Add your name.')
    if (phone.trim() && !normalizedPhone) return setProblem('Enter a 10-digit US phone number.')
    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) return setProblem('Check your email address.')
    if (!normalizedPhone && !trimmedEmail) return setProblem('Add a phone number or an email.')
    if (smsOptIn && !normalizedPhone) return setProblem('Add a phone number to get texts.')

    setProblem(null)
    setSubmitting(true)
    const ok = await onSubmit({
      name: trimmedName.slice(0, 120),
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
      ...(smsOptIn && normalizedPhone
        ? { smsConsent: { text: SMS_CHAT_CONSENT_TEXT, version: SMS_CHAT_CONSENT_TEXT_VERSION } }
        : {}),
    })
    setSubmitting(false)
    if (!ok) setProblem('That did not go through. Check your details and try again.')
  }

  return (
    <form
      aria-label="Share your contact info"
      onSubmit={handleSubmit}
      noValidate
      className="rounded-xl border border-white/10 bg-[#17181a] p-3.5 text-sm text-white/80"
    >
      <p className="m-0 font-[family-name:var(--font-heading)] text-base uppercase tracking-wide text-white">
        How can we reach you?
      </p>
      <p className="m-0 mt-1 text-xs text-white/55">
        So the team can follow up if you step away.
      </p>
      <div className="mt-3 grid gap-2">
        <label className="grid gap-1">
          <span className="text-xs text-white/65">Name</span>
          <input
            className={fieldClass}
            name="name"
            autoComplete="name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-white/65">Phone</span>
          <input
            className={fieldClass}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={phone}
            onChange={(event) => setPhone(formatUSForDisplay(event.target.value))}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-white/65">Email</span>
          <input
            className={fieldClass}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mt-1 flex items-start gap-2.5 text-[11px] leading-snug text-white/60">
          <input
            type="checkbox"
            name="smsConsent"
            checked={smsOptIn}
            onChange={(event) => setSmsOptIn(event.target.checked)}
            aria-describedby={consentTextId}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          {/* textContent must equal SMS_CHAT_CONSENT_TEXT; it is recorded as displayed. */}
          <span id={consentTextId}>
            {SMS_CHAT_CONSENT_BODY_TEXT} See our{' '}
            <Link
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Privacy Policy (opens in a new tab)"
              className="text-[var(--accent-light)] underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            {' '}and{' '}
            <Link
              href="/terms-and-conditions#sms-terms"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Terms & SMS Policy (opens in a new tab)"
              className="text-[var(--accent-light)] underline underline-offset-2"
            >
              Terms &amp; SMS Policy
            </Link>
            . Prefer not to receive texts? Call{' '}
            <a
              href={`tel:${PHONE_NUMBER}`}
              className="text-[var(--accent-light)] underline underline-offset-2"
            >
              {PHONE_DISPLAY}
            </a>
            {' '}instead.
          </span>
        </label>
      </div>
      {problem ? (
        <p role="alert" className="m-0 mt-2 text-xs text-[#ff9b8a]">
          {problem}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={submitting} className="btn btn-primary btn-sm flex-1">
          {submitting ? 'Sending…' : 'Share'}
        </button>
        <button type="button" onClick={onDismiss} className="btn btn-outline btn-sm">
          Not now
        </button>
      </div>
    </form>
  )
}
