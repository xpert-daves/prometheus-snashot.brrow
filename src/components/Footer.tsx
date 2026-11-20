import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, MessageSquareText, Phone } from "lucide-react";

import {
  EMAIL,
  PHONE_DISPLAY,
  PHONE_NUMBER,
  SOCIAL_LINKS,
} from "@/lib/contact";

import Container from "./Container";
import { FacebookBadgeIcon, GoogleBadgeIcon } from "./BrandIcons";
import { GableProfile } from "./motif/diagrams";
import TrackedActionLink from "./TrackedActionLink";

const FOOTER_GROUPS = [
  {
    title: "Plan Your Building",
    links: [
      { href: "/buildings", label: "Buildings" },
      { href: "/quote", label: "Get Instant Price" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Real Work",
    links: [{ href: "/gallery", label: "Gallery" }],
  },
  {
    title: "Service Areas",
    links: [{ href: "/service-area", label: "All Service Areas" }],
  },
  {
    title: "Guides",
    links: [
      { href: "/news", label: "All Guides" },
      {
        href: "/news/san-antonio-shed-cost-guide",
        label: "Shed Cost Guide",
      },
      {
        href: "/news/sanantonio_shed_guide",
        label: "Permits & HOA Guide",
      },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/accessibility", label: "Accessibility" },
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/terms-and-conditions", label: "Terms & Conditions" },
      { href: "/terms-and-conditions#sms-terms", label: "SMS Terms" },
    ],
  },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      data-site-chrome="site"
      className="border-t border-white/10 bg-[var(--hi-bg-1)] py-10 text-sm text-white md:py-14"
    >
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)] lg:gap-16">
          <div className="space-y-5">
            <Link
              href="/"
              aria-label="Shed210 Home"
              className="inline-flex items-center gap-3"
            >
              <Image
                src="/logos/brand-logo-shed210-horizontal-no-tagline-transparent.png"
                alt="Shed210"
                width={1062}
                height={187}
                className="h-auto w-56 max-w-full object-contain sm:w-64"
              />
            </Link>
            <p className="max-w-xl text-neutral-200">
              Based in San Antonio, TX, we build custom sheds for homeowners
              across Bexar County and the Hill Country. Explore completed
              projects to compare sizes, finishes, and real build photos.
            </p>

            <ul className="space-y-3 text-neutral-200">
              <li>
                <TrackedActionLink
                  href={`tel:${PHONE_NUMBER}`}
                  eventName="phone_click"
                  eventProperties={{ location: "site_footer" }}
                  className="inline-flex items-center gap-2 rounded-md transition hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171412]"
                >
                  <Phone size={16} aria-hidden="true" />
                  <span className="brand-subheading text-sm">Call {PHONE_DISPLAY}</span>
                </TrackedActionLink>
              </li>
              <li>
                <TrackedActionLink
                  href={`sms:${PHONE_NUMBER}`}
                  eventName="text_click"
                  eventProperties={{ location: "site_footer" }}
                  className="inline-flex items-center gap-2 rounded-md transition hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171412]"
                >
                  <MessageSquareText size={16} aria-hidden="true" />
                  <span className="brand-subheading text-sm">
                    Text {PHONE_DISPLAY}
                  </span>
                </TrackedActionLink>
              </li>
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-md transition hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171412]"
                >
                  <Mail size={16} aria-hidden="true" />
                  <span>{EMAIL}</span>
                </a>
              </li>
              <li className="flex items-start gap-2 text-neutral-300">
                <MapPin size={16} aria-hidden="true" className="mt-1 shrink-0" />
                <span className="leading-relaxed">
                  San Antonio, Bexar County, and the Hill Country.{" "}
                  <Link
                    href="/service-area"
                    className="underline decoration-white/35 underline-offset-2 hover:text-amber-400"
                  >
                    See all service areas
                  </Link>
                  .
                </span>
              </li>
            </ul>

            <nav className="flex gap-3 text-xl" aria-label="Social links">
              <a
                href={SOCIAL_LINKS.google}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Google reviews"
                className="inline-flex items-center justify-center rounded-md bg-white/5 p-2 transition hover:bg-white/10 active:scale-95"
              >
                <GoogleBadgeIcon
                  className="h-5 w-5"
                  style={{ color: "#EA4335" }}
                />
              </a>
              <a
                href={SOCIAL_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex items-center justify-center rounded-md bg-white/5 p-2 transition hover:bg-white/10 active:scale-95"
              >
                <FacebookBadgeIcon
                  className="h-5 w-5"
                  style={{ color: "#1877F2" }}
                />
              </a>
            </nav>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
            {FOOTER_GROUPS.map((group) => (
              <nav
                key={group.title}
                aria-label={`${group.title} footer links`}
              >
                <p className="motif-spec text-[0.64rem] text-white/55">
                  {group.title}
                </p>
                <ul className="mt-4 space-y-3 text-neutral-300">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-6 items-center rounded-md text-sm leading-5 transition hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171412]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div
          className="mt-10 flex items-center gap-3 text-white/60"
          aria-hidden="true"
        >
          <GableProfile className="h-8 w-11 shrink-0" />
          <span className="motif-spec whitespace-nowrap text-[0.64rem] sm:text-[0.68rem]">
            <span className="sm:hidden">Shed210 · San Antonio, TX</span>
            <span className="hidden sm:inline">
              Shed210 · San Antonio, TX · Built for Texas. Built to last.
            </span>
          </span>
          <span className="h-px min-w-4 flex-1 bg-white/10" />
        </div>

        <div className="mt-6 border-t border-white/10 pt-6 text-xs text-neutral-300">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3 lg:max-w-3xl">
              <p>© {year} Shed210. All rights reserved.</p>
              <p className="leading-relaxed text-neutral-400">
                We use Microsoft Clarity to understand how visitors use this site,
                including clicks, scrolling, and session interactions, so we can
                improve Shed210&apos;s website, services, and marketing. By using this
                site, you agree that Shed210 and Microsoft can collect and use this
                data. See our{" "}
                <Link
                  href="/privacy-policy"
                  className="text-neutral-200 underline decoration-neutral-400 underline-offset-2 hover:text-amber-400"
                >
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-neutral-200 lg:justify-end">
              <span>Licensed &amp; insured Texas shed builders.</span>
              <TrackedActionLink
                href="https://www.frontierpixel.com/work/shed-210"
                eventName="frontier_pixel_credit_click"
                eventProperties={{ location: "site_footer" }}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 transition hover:text-amber-400"
              >
                Built by Frontier Pixel
              </TrackedActionLink>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

export { FOOTER_GROUPS };
