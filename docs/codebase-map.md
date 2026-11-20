# Codebase Map

This document is meant to answer one question quickly: "where does that live?"

## Primary Routes

- `src/app/page.tsx`: home page composition and home page JSON-LD
- `src/app/quote/page.tsx`: quote calculator entry point
- `src/app/api/quote/route.ts`: quote submission API
- `src/app/news/page.tsx`: article index
- `src/app/news/[slug]/page.tsx`: article detail rendering
- `src/app/contact/page.tsx`: contact page
- `src/app/our-work/page.tsx`: portfolio/work page
- `src/app/service-area/page.tsx` and `src/app/service-area/[city]/page.tsx`: service-area pages

This repo no longer serves `/admin/*`; those paths should fall through to the
normal site 404. Access Frontier Pixel CRM directly for admin work.

## High-Risk Areas

- `src/components/QuotePageClient.tsx`: quote page shell that composes the quote flow hook, 3-step UI, result panel, and post-quote next steps (Ready to schedule action and compare another option)
- `src/components/StructurePreview.tsx`: interactive 3D shed preview using `three`, `@react-three/fiber`, and `@react-three/drei`
- `src/app/api/quote/route.ts`: input normalization, validation, pricing, and persistence
- `src/lib/pricing/calculateQuote.ts`: source of pricing behavior
- `src/lib/pricing/pricingData.ts`: pricing constants and add-on definitions

## Shared Library Modules

- `src/lib/articles.ts`: compatibility export surface for article repository helpers
- `src/lib/articleRepository.ts`: cached article repository for slug list, metadata, and prepared article page data
- `src/lib/articleContent.ts`: article content preparation, safe anchor rewriting, and heading extraction
- `src/lib/seo.ts`: canonical URL and OG helpers
- `src/lib/contact.ts`: business constants like phone, email, and service areas
- `src/lib/quotePersistence.ts`: persists validated quote submissions to Convex
- `src/lib/analytics.ts`: thin wrapper around Vercel analytics
- `src/lib/useQuoteFlow.ts`: quote orchestration hook for draft state, persistence, delivery prefill, submission, and result/next-step state
- `convex/`: quote-only Convex schema, quote storage mutation, quote pricing read, Twilio SMS alerts, and Zoho email alerts labeled by lead history (`quoteLeadHistory.ts`)

## Tests

- `src/app/api/quote/__tests__`: quote route and validation coverage
- `src/app/news/__tests__`: article index/detail rendering coverage
- `src/app/quote/__tests__`: quote page flow coverage
- `src/components/__tests__`: component smoke/behavior tests
- `src/lib/**/__tests__`: utility and business-logic coverage

## Supporting Docs

- `docs/pricing-rules.md`: pricing behavior contract
- `docs/quotes-table.md`: Convex quote storage and SMS/email notification setup
- `docs/authoring.md`: article authoring workflow
- `docs/quote-flow-architecture.md`: quote flow state, result, and next-step architecture notes
- `docs/quote-sms-consent.md`: required quote SMS consent behavior, recorded proof, and cached-client handling
- `docs/home-hero-video.md`: optional MP4 background setup for the home hero
