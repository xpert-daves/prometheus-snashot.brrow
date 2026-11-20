import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/contact";
import { DEFAULT_OG_IMAGE, getSiteUrl } from "@/lib/seo";
import Header from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingCTAGate from "@/components/FloatingCTAGate";
import DeferredVercelInsights from "@/components/DeferredVercelInsights";
import GoogleTag from "@/components/GoogleTag";
import MicrosoftClarity from "@/components/MicrosoftClarity";
import WebsiteMeasurementProvider from "@/components/WebsiteMeasurementProvider";
import { alfaSlab, inter, oswald, plexMono } from "@/lib/fonts";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Custom Sheds in San Antonio | Shed210",
    template: "%s | Shed210",
  },
  description:
    "Custom sheds built on-site in one day for homeowners across San Antonio and nearby Texas communities.",
  // No root canonical: pages set their own, and an inherited "/" would point
  // any page that forgets one at the homepage.
  verification: {
    other: {
      "msvalidate.01": "8009622D80F9581A1C04F50F9FC80DB7",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: "Custom Sheds in San Antonio | Shed210",
    description:
      "Custom sheds built on-site in one day for homeowners across San Antonio and nearby Texas communities.",
    url: "/",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        alt: "Custom backyard shed built by Shed210 in San Antonio.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Sheds in San Antonio | Shed210",
    description:
      "Custom sheds built on-site in one day for homeowners across San Antonio and nearby Texas communities.",
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: [
      {
        url: "/icons/favicon-shed210-512x512-transparent.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: [
      {
        url: "/icons/favicon-shed210-512x512-transparent.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/app-icon-shed210-1024x1024-transparent.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
    other: [
      {
        rel: "android-chrome",
        url: "/icons/app-icon-shed210-1024x1024-transparent.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Both third-party tags load only on the production deployment, never on localhost or Vercel previews.
  const productionAnalyticsEnabled = process.env.VERCEL_ENV === "production";

  return (
    <html lang="en">
      <head>
        <GoogleTag enabled={productionAnalyticsEnabled} />
        <MicrosoftClarity enabled={productionAnalyticsEnabled} />
      </head>
      <body className={`${oswald.variable} ${inter.variable} ${alfaSlab.variable} ${plexMono.variable} antialiased`}>
        <WebsiteMeasurementProvider />
        <Header />
        {children}
        <Footer />
        <FloatingCTAGate />
        <DeferredVercelInsights />
      </body>
    </html>
  );
}
