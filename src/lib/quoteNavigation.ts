import type { MouseEvent } from 'react';
import { BUILDING_CATALOG, type PublicBuildingType } from '@/lib/buildingCatalog';

export const QUOTE_RESUME_EVENT = 'shed210-resume-quote';

export function getRequestedQuoteStructureType(search: string): PublicBuildingType | null {
  const requested = new URLSearchParams(search).get('structureType');
  return BUILDING_CATALOG.find((building) => building.value === requested)?.value ?? null;
}

export function clearRequestedQuoteStructureType() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('structureType')) return;
  url.searchParams.delete('structureType');
  window.history.replaceState(window.history.state, '', url);
}

/** Keep an in-progress quote mounted when its own sticky CTA is clicked. */
export function resumeQuoteFromLink(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      href !== '/quote' || window.location.pathname !== '/quote' ||
      !document.getElementById('quote-active-step-form')) return;
  event.preventDefault();
  window.dispatchEvent(new Event(QUOTE_RESUME_EVENT));
}
