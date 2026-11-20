export function stripPII<T extends Record<string, unknown>>(data: T): T {
  const copy = { ...data }
  delete (copy as Record<string, unknown>).name
  delete (copy as Record<string, unknown>).email
  delete (copy as Record<string, unknown>).phone
  delete (copy as Record<string, unknown>).deliveryAddress
  delete (copy as Record<string, unknown>).website
  delete (copy as Record<string, unknown>).smsUnifiedConsentOptIn
  delete (copy as Record<string, unknown>).smsConsentOptIn
  delete (copy as Record<string, unknown>).smsMarketingConsentOptIn
  return copy
}
