import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

export const DISCUSSION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function quoteDiscussionsEnabled() {
  return process.env.QUOTE_DISCUSSIONS_ENABLED?.trim().toLowerCase() === 'true';
}

export function hashDiscussionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createDiscussionCapability() {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    hash: hashDiscussionToken(token),
    expiresAt: Date.now() + DISCUSSION_TOKEN_LIFETIME_MS,
  };
}

export async function saveQuoteDiscussion(args: {
  tenantSlug: string;
  quoteId: string;
  actionToken: string;
}) {
  const writeKey = process.env.CONVEX_QUOTE_WRITE_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!writeKey || !url) throw new Error('Quote discussion storage unavailable');
  return new ConvexHttpClient(url).mutation(api.quoteDiscussions.requestDiscussion, {
    writeKey,
    tenantSlug: args.tenantSlug,
    publicId: args.quoteId,
    tokenHash: hashDiscussionToken(args.actionToken),
  });
}
