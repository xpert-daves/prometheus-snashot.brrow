"use client";

import { useState } from "react";
import { ArrowRight, Check, Clock3, Mail, MessageSquare } from "lucide-react";
import Container from "@/components/Container";
import StaticServiceAreaMap from "@/components/StaticServiceAreaMap";
import { EMAIL, PHONE_DISPLAY, PHONE_NUMBER } from "@/lib/contact";
import { trackEvent } from "@/lib/analytics";
import type { ServiceAreaMapLocation } from "@/lib/serviceAreaRegistry";

type Status = {
  type: "idle" | "success" | "error";
  message?: string;
};

export default function ContactPageClient({
  locations,
}: {
  locations?: readonly ServiceAreaMapLocation[];
}) {
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ type: "success", message: `${label} copied to clipboard.` });
      trackEvent("contact_copy", { label });
      setTimeout(() => setStatus({ type: "idle" }), 2000);
    } catch {
      setStatus({ type: "error", message: `Could not copy ${label}.` });
      setTimeout(() => setStatus({ type: "idle" }), 2500);
    }
  };

  return (
    <section id="contact" className="interior-page py-10 text-white sm:py-14 lg:py-18">
      <Container>
        <div className="interior-hero mb-8 px-6 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-14">
          <div className="relative z-10 grid gap-9 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
            <div>
              <p className="interior-kicker">San Antonio shed builders</p>
              <h1 className="brand-heading mb-0 mt-5 max-w-3xl text-4xl text-white sm:text-5xl lg:text-6xl">
                Let&apos;s Plan Your <span className="text-[var(--accent-light)]">Shed.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                Need a fast quote, help comparing options, or a quick check on site prep?
                Call, text, or email us directly and we will help with the next step.
              </p>
            </div>
            <div className="interior-card-soft p-5 sm:p-6">
              <Clock3 className="h-6 w-6 text-[var(--accent-light)]" aria-hidden="true" />
              <p className="motif-spec mt-5 text-[0.64rem] text-white/60">Typical response</p>
              <p className="brand-subheading mt-2 text-xl text-white">Within 1 business day</p>
              <p className="mt-2 text-sm text-white/52">Monday-Friday · Central Time</p>
            </div>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {status.type !== "idle" ? status.message : ""}
        </p>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="interior-card p-5 sm:p-6">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/12 text-[var(--accent-light)]">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="brand-label text-xs text-white/60">Call or text</p>
            <p className="brand-subheading mt-2 text-2xl text-[var(--accent-light)]">
              {PHONE_DISPLAY}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${PHONE_NUMBER}`}
                onClick={() => trackEvent("phone_click", { location: "contact_page" })}
                className="brand-button inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-xs text-white/90 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label={`Call us at ${PHONE_DISPLAY}`}
              >
                Call
              </a>
              <a
                href={`sms:${PHONE_NUMBER}`}
                onClick={() => trackEvent("text_click", { location: "contact_page" })}
                className="brand-button inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-xs text-white/90 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label={`Text us at ${PHONE_DISPLAY}`}
              >
                Text
              </a>
              <button
                type="button"
                onClick={() => copy(PHONE_NUMBER, "Phone")}
                className="brand-button min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-white/70 hover:border-white/20 hover:text-white"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="interior-card p-5 sm:p-6">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/12 text-[var(--accent-light)]">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="brand-label text-xs text-white/60">Email</p>
            <a
              href={`mailto:${EMAIL}`}
              className="brand-subheading mt-2 block break-all text-xl text-[var(--accent-light)] hover:text-white"
              onClick={() => trackEvent("email_click")}
            >
              {EMAIL}
            </a>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => copy(EMAIL, "Email")}
                className="brand-button rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="interior-card flex flex-col p-5 sm:p-6">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/12 text-[var(--accent-light)]">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="brand-label text-xs text-white/60">Best first step</p>
            <p className="brand-subheading mt-2 text-xl">Start with the instant quote</p>
            <a href="/quote" className="brand-button mt-auto inline-flex items-center gap-2 pt-5 text-xs text-[var(--accent-light)] hover:text-white">
              Build your quote <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="grid items-start gap-8 md:grid-cols-2">
          <aside>
            <div className="interior-card p-6 sm:p-7">
              <p className="interior-kicker">Simple process</p>
              <h2 className="brand-subheading mb-0 mt-4 text-xl">What happens next?</h2>
              <ol className="mt-5 space-y-4 text-white/68">
                {[
                  "We review your shed size, style, and site details.",
                  "We confirm build timing and any access constraints.",
                  "You get clear next steps for quote approval and build scheduling.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="motif-spec grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400 text-[0.6rem] text-black">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="interior-card mt-6 p-6 sm:p-7">
              <h2 className="brand-subheading mb-0 text-xl">Best ways to reach us</h2>
              <ul className="mt-4 space-y-3 text-white/65">
                <li>Call if you want to talk through layout, access, or pricing live.</li>
                <li>Text if you want the quickest response on timing or simple questions.</li>
                <li>Email if you want to send photos, lot details, or a longer project brief.</li>
              </ul>
            </div>

            <div className="interior-card mt-6 p-6 sm:p-7">
              <h2 className="brand-subheading mb-0 text-xl">Shed project FAQs</h2>
              <FAQ q="Do you help with permit or HOA questions?" a="Yes. We can point you to local permit and HOA requirements before build day." />
              <FAQ q="How fast can my shed be built?" a="Most projects are completed on-site in one day once scope and scheduling are confirmed." />
              <FAQ q="What areas do you serve?" a="We serve San Antonio and surrounding communities throughout the 35-mile area shown on the map. Confirm the build address for final availability." />
            </div>
          </aside>

          <div className="grid gap-6">
            <div className="interior-card p-6 sm:p-7">
              <h2 className="brand-subheading mb-0 text-xl">Before you contact us</h2>
              <ul className="mt-4 space-y-3 text-white/65">
                {[
                  "Have your preferred shed size or a couple of options in mind.",
                  "Know whether your yard has gates, slopes, or tight access points.",
                  "Bring any HOA or permit questions so we can point you in the right direction.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-light)]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)]">
              <StaticServiceAreaMap locations={locations} showCityLinks />
            </div>

            <div className="interior-card p-6 sm:p-7">
              <h2 className="brand-subheading mb-0 text-xl">Service area overview</h2>
              <p className="mt-3 leading-7 text-white/65">
                Use the service area preview to confirm coverage, then call or text if you
                want help planning access or placement details.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="mt-4 border-t border-white/8 pt-4">
      <p className="brand-subheading text-white">{q}</p>
      <p className="mt-1 text-sm leading-6 text-white/52">{a}</p>
    </div>
  );
}
