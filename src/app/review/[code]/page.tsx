import type { Metadata } from 'next';
import ReviewGoogleHandoff from '@/components/review/ReviewGoogleHandoff';
import { normalizeReviewLinkCode } from '@/lib/reviewPage';

export const metadata: Metadata = {
  title: 'Review Your Build',
  description: 'Leave Shed210 a review on Google.',
  robots: { index: false, follow: false },
};

/**
 * Personal link from the CRM review text: straight to Google. The code ties
 * the open to the customer's lead; a mistyped code still goes to Google.
 */
export default async function PersonalReviewPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main id="main" tabIndex={-1}>
      <ReviewGoogleHandoff code={normalizeReviewLinkCode(code)} />
    </main>
  );
}
