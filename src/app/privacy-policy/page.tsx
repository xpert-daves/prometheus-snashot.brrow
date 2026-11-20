import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import { EMAIL, PHONE_DISPLAY, PHONE_NUMBER, SITE_NAME } from "@/lib/contact";
import WebsiteMeasurementPreference from "@/components/WebsiteMeasurementPreference";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Shed210 quote requests and communications.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <main id="main" tabIndex={-1} className="interior-page py-10 text-white sm:py-14 lg:py-18">
      <Container>
        <article className="legal-copy mx-auto max-w-4xl space-y-5 text-white/68">
          <header className="interior-hero mb-8 px-6 py-8 sm:px-9 sm:py-10">
            <p className="interior-kicker">Legal · Your data</p>
            <h1 className="brand-heading mb-0 mt-5 text-4xl text-white sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/62">
              A plain-language overview of the information Shed210 collects, why we use it,
              and the choices available to you.
            </p>
            <p className="motif-spec mt-6 text-[0.62rem] text-white/60">
              Effective Date: September 28, 2026
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">Information We Collect</h2>
            <p>
              {SITE_NAME} collects information you provide when requesting a quote,
              contacting us, or working with us on a shed project. This may include
              your name, email address, phone number, project details, delivery
              location, and messages you send to us.
            </p>
            <p>
              If you use the chat on our website, we keep the messages you send,
              the page you were on, and any contact details you choose to share so
              our team and our AI assistant can answer you and follow up.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">How We Use Information</h2>
            <p>
              We use your information to respond to inquiries, prepare and manage
              quotes, coordinate orders, schedule delivery or installation, provide
              customer support, improve our website, and maintain internal business
              records.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">Website Analytics</h2>
            <p>
              We use Microsoft Clarity and other analytics tools on public website
              pages to understand how visitors use the site, including behavioral
              metrics such as page views, clicks, scrolling, navigation paths,
              device and browser details, approximate location, referrer
              information, and session interaction data.
            </p>
            <p>
              Microsoft Clarity may use cookies and other tracking technologies to
              provide heatmaps, session replay, and related analytics. We use this
              information for site optimization, troubleshooting, security review,
              and marketing measurement.
            </p>
            <p>
              Clarity is not intended for our admin pages, and sensitive content is
              masked by default so quote form details, passwords, payment
              information, and private admin records are not intentionally collected
              in recordings. Microsoft may process this information under its{" "}
              <a
                className="text-amber-300 underline"
                href="https://privacy.microsoft.com/privacystatement"
                target="_blank"
                rel="noopener noreferrer"
              >
                Microsoft Privacy Statement
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">First-Party Website Measurement</h2>
            <p>
              We also record page-group views, action clicks, and quote-form interactions in our CRM.
              These records use fixed page categories, a random browser-session identifier, broad
              referring-source categories, and short campaign labels. They do not contain your
              form answers, contact details, full referring URLs, or arbitrary URL query strings.
              Local storage keeps first and latest source details for up to 30 days; session storage
              holds the session identifier and a limited retry queue.
            </p>
            <p>
              Global Privacy Control, Do Not Track, or the preference below disable this browser
              measurement. Quotes still work. The CRM can separately count accepted quote records
              as part of operating the quote service; those records do not depend on this browser preference.
            </p>
            <WebsiteMeasurementPreference />
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">
              SMS and Mobile Messaging Privacy
            </h2>
            <p>
              The online quote tool requires your agreement to receive text
              messages from Shed210 about your quote request, scheduling, and
              project updates. This agreement does not include marketing or
              promotional texts. Promotional messages require a separate recorded
              opt-in that covers those messages.
            </p>
            <p>
              Message frequency varies. Message and data rates may apply. You may
              opt out at any time by replying STOP to any text message or by
              contacting us directly. For help, reply HELP or contact us using the
              information below.
            </p>
            <p>
              Text message consent is not a condition of purchase and is not
              required to purchase goods or services. If you prefer not to
              receive texts, call Shed210 at {PHONE_DISPLAY} for a quote instead
              of using the online quote tool.
            </p>
            <p>
              No mobile information will be shared with third parties or affiliates
              for marketing or promotional purposes. This includes mobile phone
              numbers, SMS opt-in data, and text message consent. We may share
              mobile information with service providers who help us deliver text
              messages, but only as necessary for them to provide services to us.
            </p>
            <p>
              See our{" "}
              <Link
                className="text-amber-300 underline"
                href="/terms-and-conditions#sms-terms"
              >
                Terms &amp; SMS Policy
              </Link>{" "}
              for additional messaging terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">Service Providers</h2>
            <p>
              We may work with vendors that help us host the website, store quote
              and lead records, send customer communications, measure website
              performance, and operate our business. These vendors may access
              information only as needed to provide their services to us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">Google Places and Reviews</h2>
            <p>
              We use Google Places to retrieve and display business information,
              ratings, reviews, and reviewer attribution from Google Maps. If you
              follow a link to Google Maps or otherwise interact with a Google
              service, Google may collect and process information under the{' '}
              <a
                className="text-amber-300 underline"
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Privacy Policy
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="brand-subheading text-2xl text-white">Contact</h2>
            <p>
              To request privacy help or SMS opt-out assistance, contact Shed210 at{" "}
              <a className="text-amber-300 underline" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>{" "}
              or{" "}
              <a className="text-amber-300 underline" href={`tel:${PHONE_NUMBER}`}>
                {PHONE_DISPLAY}
              </a>
              .
            </p>
          </section>
        </article>
      </Container>
    </main>
  );
}
