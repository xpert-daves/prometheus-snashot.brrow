import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { GableProfile } from '@/components/motif/diagrams';

/** Matches the loaded StructurePreview so the sticky aside does not jump. */
export const PREVIEW_PANEL_HEIGHT = 'h-64 sm:h-80 md:h-[28rem]';

type PreviewErrorBoundaryProps = { children: ReactNode; onError?: () => void };
type PreviewErrorBoundaryState = { failed: boolean };

/**
 * Keeps a failed 3D preview chunk or scene inside the preview box. Without it
 * the error reaches global-error and replaces the whole quote page. There is
 * deliberately no retry: React.lazy caches a rejected import, so remounting
 * the same preview would throw again.
 */
export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PreviewErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      tags: { area: 'quote-preview' },
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    });
    this.props.onError?.();
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div
        className={`flex w-full flex-col items-center justify-center gap-4 border border-white/10 bg-black/20 ${PREVIEW_PANEL_HEIGHT}`}
      >
        <GableProfile className="h-24 w-36 text-white/40" strokeWidth={1.1} />
        <p className="motif-spec px-4 text-center text-white/60">
          3D preview unavailable, your quote still works
        </p>
      </div>
    );
  }
}
