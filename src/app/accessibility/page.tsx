import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import { EMAIL, PHONE_DISPLAY, PHONE_NUMBER, SITE_NAME } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "Shed210's accessibility commitment, technical standard, assistance options, and contact information.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="interior-page py-10 text-white sm:py-14 lg:py-18"
    >
      <Container>
        <article className="legal-copy mx-auto max-w-4xl space-y-5 text-white/70">
          <header className="interior-hero mb-8 px-6 py-8 sm:px-9 sm:py-10">
            <p className="interior-kicker">Access · Equal service</p>
            <h1 className="brand-heading mb-0 mt-5 text-4xl text-white sm:text-5xl">
              Accessibility
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              {SITE_NAME} wants every customer to be able to explore our work,
              request a shed quote, and contact our team.
            </p>
            <p className="motif-spec mt-6 text-[0.62rem] text-white/60">
              Last reviewed: <time dateTime="2026-07-27">July 27, 2026</time>
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">
              Our accessibility target
            </h2>
            <p>
              We use the Web Content Accessibility Guidelines (WCAG) 2.2 Level
              AA as our technical target. Accessibility is an ongoing process,
              and we continue reviewing the site through automated and manual
              testing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">
              Accessibility features
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Keyboard navigation, visible focus indicators, and a skip link.</li>
              <li>Page landmarks, structured headings, labels, and text alternatives.</li>
              <li>Controls to stop optional motion and support for reduced-motion settings.</li>
              <li>Form instructions, required-field identification, and clear error guidance.</li>
              <li>Responsive layouts designed to remain usable with browser zoom and text enlargement.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">
              Get help or report a barrier
            </h2>
            <p>
              If any part of this site is difficult to use, tell us what page or
              task caused trouble and what device, browser, or assistive
              technology you were using, if you are comfortable sharing it. We
              will review the issue and work to provide the information or
              service another way.
            </p>
            <p>
              Email{" "}
              <a href={`mailto:${EMAIL}`} className="text-amber-300 underline">
                {EMAIL}
              </a>{" "}
              or text{" "}
              <a href={`sms:${PHONE_NUMBER}`} className="text-amber-300 underline">
                {PHONE_DISPLAY}
              </a>
              . You can also use our{" "}
              <Link href="/contact" className="text-amber-300 underline">
                contact page
              </Link>
              .
            </p>
            <p>
              If the online quote tool does not work for you, contact us and we
              will help gather the same project information and discuss your
              options directly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">
              Third-party services
            </h2>
            <p>
              This site links to services such as Google Maps and Facebook.
              Those external sites are controlled by their respective
              providers. Please contact us if an external service prevents you
              from getting Shed210 information or assistance.
            </p>
          </section>
        </article>
      </Container>
    </main>
  );
}
