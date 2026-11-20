import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import { EMAIL, PHONE_DISPLAY, PHONE_NUMBER, SITE_NAME } from "@/lib/contact";
import { SMS_TERMS_EFFECTIVE_DATE } from "@/lib/smsConsent";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions for using Shed210 services and communications.",
  alternates: { canonical: "/terms-and-conditions" },
};

function TermsSection({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="brand-subheading text-2xl text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsAndConditionsPage() {
  return (
    <main id="main" tabIndex={-1} className="interior-page py-10 text-white sm:py-14 lg:py-18">
      <Container>
        <article className="legal-copy mx-auto max-w-4xl space-y-5 text-white/68">
          <header className="interior-hero mb-8 px-6 py-8 sm:px-9 sm:py-10">
            <p className="interior-kicker">Legal · Working together</p>
            <h1 className="brand-heading mb-0 mt-5 text-4xl text-white sm:text-5xl">
              Shed210 Terms &amp; Conditions
            </h1>
            <p className="motif-spec mt-5 text-[0.62rem] text-white/60">
              Effective Date: {SMS_TERMS_EFFECTIVE_DATE}
            </p>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/62">
              These Terms &amp; Conditions govern your use of the Shed210 website,
              quote tools, communications, products, services, and related
              offerings. By using our website, requesting a quote, placing an
              order, scheduling an appointment, or communicating with Shed210, you
              agree to these Terms.
            </p>
          </header>

          <TermsSection title="1. Services">
            <p>
              Shed210 provides shed-related products and services, which may
              include shed quotes, sales, delivery coordination, installation
              coordination, customization discussions, appointment scheduling,
              customer support, and related services.
            </p>
            <p>
              Specific product details, pricing, availability, payment terms,
              delivery terms, installation terms, and service terms may be
              provided in a separate quote, invoice, order form, contract, or
              written communication.
            </p>
          </TermsSection>

          <TermsSection title="2. Quotes and Estimates">
            <p>
              Quotes, online estimates, configurator prices, website prices, or
              verbal estimates are for informational purposes unless confirmed in
              writing by Shed210.
            </p>
            <p>
              Final pricing may vary based on product selection, customization,
              dimensions, materials, availability, delivery location, site
              conditions, taxes, fees, financing terms, installation requirements,
              or other factors.
            </p>
          </TermsSection>

          <TermsSection title="3. Product Information">
            <p>
              We try to provide accurate product descriptions, images, dimensions,
              availability, and pricing. However, website content may contain
              errors, approximations, or outdated information.
            </p>
            <p>
              Images, colors, materials, dimensions, layouts, and finishes may
              vary from actual products.
            </p>
          </TermsSection>

          <TermsSection title="4. Orders and Payments">
            <p>
              Orders are subject to acceptance by Shed210. Payment terms, deposits,
              balances, financing terms, cancellation policies, and refund policies
              will be provided in the applicable quote, invoice, order form, or
              written agreement.
            </p>
            <p>
              Shed210 may refuse, cancel, or modify an order if information is
              inaccurate, a product is unavailable, payment is not completed, or
              there is a suspected error or issue.
            </p>
          </TermsSection>

          <TermsSection title="5. Delivery, Installation, and Site Access">
            <p>
              Customers are responsible for providing accurate delivery and
              installation information, including address, access details, site
              conditions, restrictions, gates, slopes, obstacles, utilities,
              permits, HOA rules, and other relevant information.
            </p>
            <p>
              Delivery or installation may be delayed, rescheduled, or subject to
              additional costs if the site is not accessible, safe, ready, or
              accurately described.
            </p>
          </TermsSection>

          <TermsSection title="6. Permits, HOA Rules, and Local Requirements">
            <p>
              Customers are responsible for checking and complying with applicable
              permits, zoning rules, HOA rules, neighborhood restrictions, utility
              requirements, and local regulations unless otherwise agreed in
              writing.
            </p>
            <p>
              Shed210 is not responsible for fines, removal orders, HOA disputes,
              permit denials, or legal issues caused by customer failure to confirm
              applicable requirements.
            </p>
          </TermsSection>

          <TermsSection title="7. Customer Information">
            <p>
              You agree to provide accurate information when requesting quotes,
              scheduling appointments, placing orders, or communicating with us.
              Shed210 is not responsible for delays or issues caused by inaccurate
              or incomplete customer information.
            </p>
          </TermsSection>

          <TermsSection id="sms-terms" title="8. SMS Terms & Messaging Policy">
            <p>
              To use the online quote tool, you must agree to receive text
              messages from Shed210 about your quote request, scheduling, and
              project updates. This agreement does not include marketing or
              promotional texts. Promotional messages require a separate recorded
              opt-in that covers those messages.
            </p>
            <p>
              Message frequency may vary. Message and data rates may apply. Reply
              STOP to opt out or HELP for help. See our{" "}
              <Link className="text-amber-300 underline" href="/privacy-policy">
                Privacy Policy
              </Link>{" "}
              for more information about how we collect and use information.
            </p>
            <p>
              We do not sell or share mobile opt-in information, mobile phone
              numbers, or text message consent with third parties or affiliates for
              marketing or promotional purposes. We may share information with
              service providers who help us operate our messaging program, such as
              SMS delivery providers, only as needed to provide those services.
            </p>
            <p>
              Text message consent is not a condition of purchase and is not
              required to purchase goods or services. If you prefer not to
              receive texts, call Shed210 at {PHONE_DISPLAY} for a quote instead
              of using the online quote tool.
            </p>
            <p>Mobile carriers are not liable for delayed or undelivered messages.</p>
          </TermsSection>

          <TermsSection title="9. Acceptable Use">
            <p>You agree not to use our website or services to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Submit false or misleading information.</li>
              <li>Violate laws or regulations.</li>
              <li>Attempt unauthorized access to systems.</li>
              <li>Send abusive, harassing, or unlawful communications.</li>
              <li>Interfere with website operation.</li>
              <li>Misuse quote tools, forms, or communication systems.</li>
            </ul>
          </TermsSection>

          <TermsSection title="10. Third-Party Services">
            <p>
              Shed210 may use third-party providers for payment processing,
              financing, scheduling, messaging, website hosting, analytics,
              delivery, installation, or other services. Third-party services are
              governed by their own terms and policies.
            </p>
            <p>
              This site may display business information, ratings, and reviews
              provided through Google Maps Platform and Google Places. Your use of
              that Google content is subject to the{' '}
              <a
                className="text-amber-300 underline"
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Terms of Service
              </a>{' '}
              and the{' '}
              <a
                className="text-amber-300 underline"
                href="https://maps.google.com/help/terms_maps/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Maps Additional Terms of Service
              </a>
              .
            </p>
          </TermsSection>

          <TermsSection title="11. Website Content">
            <p>
              Website content is provided for general informational purposes. We do
              not guarantee that all information is current, complete, accurate, or
              error-free.
            </p>
          </TermsSection>

          <TermsSection title="12. Disclaimer of Warranties">
            <p>
              To the fullest extent permitted by law, the Shed210 website and
              related online services are provided &quot;as is&quot; and
              &quot;as available.&quot; Product warranties, if any, will be
              provided separately by Shed210, the manufacturer, supplier, or
              applicable warranty provider.
            </p>
          </TermsSection>

          <TermsSection title="13. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, Shed210 will not be liable
              for indirect, incidental, special, consequential, punitive, or
              lost-profit damages.
            </p>
            <p>
              Shed210&apos;s total liability for any claim related to the website,
              quote, product, or service will not exceed the amount paid by the
              customer for the specific product or service giving rise to the claim,
              unless otherwise required by law.
            </p>
          </TermsSection>

          <TermsSection title="14. Indemnification">
            <p>
              You agree to indemnify and hold harmless Shed210 from claims,
              damages, liabilities, costs, and expenses arising from your misuse of
              the website, inaccurate information you provide, failure to comply
              with permits or HOA rules, violation of these Terms, or violation of
              laws or third-party rights.
            </p>
          </TermsSection>

          <TermsSection title="15. Governing Law">
            <p>
              These Terms are governed by the laws of the State of Texas, without
              regard to conflict of law principles.
            </p>
          </TermsSection>

          <TermsSection title="16. Changes to These Terms">
            <p>
              We may update these Terms from time to time. Updates will be posted
              on this page with a revised effective date.
            </p>
          </TermsSection>

          <TermsSection title="17. Contact">
            <p>
              {SITE_NAME}
              <br />
              Email:{" "}
              <a className="text-amber-300 underline" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
              <br />
              Phone:{" "}
              <a className="text-amber-300 underline" href={`tel:${PHONE_NUMBER}`}>
                {PHONE_DISPLAY}
              </a>
              <br />
              San Antonio, Texas
            </p>
          </TermsSection>
        </article>
      </Container>
    </main>
  );
}
