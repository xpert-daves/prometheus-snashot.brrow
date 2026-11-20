import type { Metadata } from 'next';
import ReviewGoogleHandoff from '@/components/review/ReviewGoogleHandoff';

export const metadata: Metadata = {
  title: 'Review Your Build',
  description: 'Leave Shed210 a review on Google.',
  robots: { index: false, follow: false },
};

/**
 * Generic entry (cards, QR codes, old texts): straight to Google, the same as
 * a personal link, so no one is steered by the rating they would give.
 */
export default function ReviewPage() {
  return (
    <main id="main" tabIndex={-1}>
      <ReviewGoogleHandoff code={null} />
    </main>
  );
}
