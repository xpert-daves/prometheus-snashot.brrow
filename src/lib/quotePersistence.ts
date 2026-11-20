import 'server-only'

import { randomUUID } from 'node:crypto'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type { QuoteParams, QuoteBreakdown } from './pricing/calculateQuote'
import type { QuotePricingConfigMetadata } from './quotePricingSettings'
import type { QuoteMeasurement } from './websiteMeasurement'
import { createDiscussionCapability, quoteDiscussionsEnabled } from './quoteDiscussion.server'
import {
  buildQuoteVisualPlacement,
  type QuoteVisualPlacement,
} from './quoteVisualPlacement'

export type QuoteSmsConsent = {
  status: 'opted_in' | 'not_opted_in'
  source: 'website_quote_form'
  consentText: string | null
  consentTextVersion: string | null
  pageUrl: string | null
  ipAddress: string | null
  userAgent: string | null
  recordedAt: number
}

export type DeliveryPricingStatus = 'pending_verification'

export type QuoteRecord = QuoteParams & {
  name: string
  email: string
  phone?: string
  smsConsent: QuoteSmsConsent
  smsMarketingConsent?: QuoteSmsConsent
  visualPlacement?: QuoteVisualPlacement
  sessionId?: string
  measurement?: QuoteMeasurement
  total: number
  breakdown: QuoteBreakdown
  deliveryPricingStatus?: DeliveryPricingStatus
  pricingConfig?: QuotePricingConfigMetadata
  tenantSlug?: string
}

type PersistedQuoteInputs = {
  structureType: QuoteParams['structureType']
  length: number
  width: number
  roofStyle?: NonNullable<QuoteParams['roofStyle']>
  wallHeight?: NonNullable<QuoteParams['wallHeight']>
  roofMaterial?: NonNullable<QuoteParams['roofMaterial']>
  frameGauge?: NonNullable<QuoteParams['frameGauge']>
  windowPackage?: string
  windowCount?: number
  ventilation?: boolean
  color?: string
  addOns: string[]
  foundation?: NonNullable<QuoteParams['foundation']>
  deliveryAddress?: string
  deliveryZip?: string
  door?: NonNullable<QuoteParams['door']>
  siding?: NonNullable<QuoteParams['siding']>
  deliveryRadius: number
  discountCode?: string
  visualPlacement?: QuoteVisualPlacement
}

function buildPersistedQuoteInputs(
  inputs: QuoteParams,
  visualPlacement?: QuoteVisualPlacement
): PersistedQuoteInputs {
  const persisted: PersistedQuoteInputs = {
    structureType: inputs.structureType,
    length: inputs.length,
    width: inputs.width,
    addOns: inputs.addOns ?? [],
    deliveryRadius: inputs.deliveryRadius,
  }

  if (inputs.roofStyle) persisted.roofStyle = inputs.roofStyle
  if (inputs.wallHeight) persisted.wallHeight = inputs.wallHeight
  if (inputs.roofMaterial) persisted.roofMaterial = inputs.roofMaterial
  if (inputs.frameGauge) persisted.frameGauge = inputs.frameGauge
  if (inputs.windowPackage) persisted.windowPackage = inputs.windowPackage
  if (typeof inputs.windowCount === 'number') {
    persisted.windowCount = inputs.windowCount
  }
  if (typeof inputs.ventilation === 'boolean') {
    persisted.ventilation = inputs.ventilation
  }
  if (inputs.color) persisted.color = inputs.color
  if (inputs.foundation) persisted.foundation = inputs.foundation
  if (inputs.deliveryAddress) persisted.deliveryAddress = inputs.deliveryAddress
  if (inputs.deliveryZip) persisted.deliveryZip = inputs.deliveryZip
  if (inputs.door) persisted.door = inputs.door
  if (inputs.siding) persisted.siding = inputs.siding
  if (inputs.discountCode) persisted.discountCode = inputs.discountCode
  persisted.visualPlacement = visualPlacement ?? buildQuoteVisualPlacement(inputs)

  return persisted
}

function getConvexQuoteWriteKey(): string {
  const key = process.env.CONVEX_QUOTE_WRITE_KEY?.trim()
  if (!key) {
    throw new Error('CONVEX_QUOTE_WRITE_KEY is not configured')
  }
  return key
}

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim()
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured')
  }
  return url
}

export async function saveQuote(data: QuoteRecord) {
  const {
    sessionId,
    measurement,
    total,
    breakdown,
    name,
    email,
    phone,
    smsConsent,
    smsMarketingConsent,
    visualPlacement,
    deliveryPricingStatus,
    pricingConfig,
    tenantSlug,
    ...rawInputs
  } = data
  const session_id = sessionId ?? randomUUID()
  const publicId = randomUUID()
  const discussion = quoteDiscussionsEnabled() && (tenantSlug ?? 'shed210') === 'shed210'
    ? createDiscussionCapability()
    : null
  const convex = new ConvexHttpClient(getConvexUrl())
  const pricing = {
    total,
    breakdown,
    ...(deliveryPricingStatus ? { deliveryPricingStatus } : {}),
    ...(pricingConfig ? { config: pricingConfig } : {}),
  }

  await convex.mutation(api.quoteRequests.create, {
    writeKey: getConvexQuoteWriteKey(),
    ...(tenantSlug ? { tenantSlug } : {}),
    publicId,
    sessionId: session_id,
    ...(discussion ? { discussionTokenHash: discussion.hash, discussionTokenExpiresAt: discussion.expiresAt } : {}),
    ...(measurement ? { measurement } : {}),
    contact: {
      name,
      email,
      phone: phone ?? null,
    },
    smsConsent,
    smsMarketingConsent,
    inputs: buildPersistedQuoteInputs(rawInputs as QuoteParams, visualPlacement),
    pricing,
  })

  return { id: publicId, session_id, ...(discussion ? { discussionToken: discussion.token } : {}) }
}
