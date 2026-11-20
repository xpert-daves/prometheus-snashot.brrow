import 'server-only';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import type { ReviewFeedbackEvent, ReviewLinkDevice } from '@/lib/reviewPage';

export type ReviewFeedbackResult = 'recorded' | 'not_found' | 'unavailable';

export async function forwardReviewFeedback(args: {
  linkCode: string;
  event: ReviewFeedbackEvent;
  rating: number | null;
  comment: string | null;
  device?: ReviewLinkDevice;
}): Promise<ReviewFeedbackResult> {
  const writeKey = process.env.CONVEX_QUOTE_WRITE_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!writeKey || !url) return 'unavailable';
  return new ConvexHttpClient(url).action(api.reviewFeedback.forward, {
    writeKey,
    ...args,
    occurredAt: Date.now(),
  });
}
