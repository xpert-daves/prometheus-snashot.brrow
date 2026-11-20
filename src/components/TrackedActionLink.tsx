"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { trackEvent, type EventProperties } from "@/lib/analytics";
import { resumeQuoteFromLink } from "@/lib/quoteNavigation";

type TrackedActionLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
  eventName: string;
  eventProperties?: EventProperties;
};

export default function TrackedActionLink({
  href,
  eventName,
  eventProperties,
  onClick,
  children,
  ...props
}: TrackedActionLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    trackEvent(eventName, eventProperties);
    onClick?.(event);
    resumeQuoteFromLink(event, href);
  };

  if (href.startsWith("/")) {
    return (
      <Link href={href} onClick={handleClick} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
