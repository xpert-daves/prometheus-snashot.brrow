# Repo Guidelines

Shed210 is the public website for a San Antonio custom shed builder: marketing
pages, portfolio and service-area pages, MD/MDX news, and a multi-step quote
calculator with a 3D structure preview. The separate Frontier Pixel CRM owns
admin, leads, and messaging; this repo does not serve `/admin`.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict mode (versions are pinned
  in `package.json`; check it rather than assuming)
- Tailwind CSS v4
- Convex for quote storage, pricing settings, quote alert SMS/email, and the
  CRM quote sync outbox
- Jest and React Testing Library for tests
- React Three Fiber and Three.js for the quote structure preview
- Sentry and Vercel Analytics for monitoring

## Working Rules

- Use `pnpm` as the default package manager for this repo. Core commands are `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm new:article`.
- Application code lives in `src/`:
  - `src/app` for App Router routes, metadata, and API handlers
  - `src/components` for UI components (`src/components/quote` for the quote flow)
  - `src/lib` for business logic and shared utilities
  - `src/articles` for Markdown/MDX content
- Unit and component tests live alongside source files under `src/**/__tests__` and `convex/__tests__`.
- After modifying application code, run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and ensure they pass before committing. CI (`.github/workflows/ci.yml`) also runs `pnpm check:project-images` and `pnpm build`.
- Use `pnpm lint --fix` when it can automatically resolve style issues.
- Documentation lives in `docs/`. Update docs when behavior changes, especially for quote flow, pricing, schema, or authoring changes. `docs/codebase-map.md` is the short orientation doc.
- Run `pnpm build` if you modify Next.js configuration, TypeScript configuration, Convex code, or other build-time behavior. `pnpm build` runs `pnpm typecheck` first.
- `.env.local.example` lists the env var names for Next.js and Convex. Never print or commit secret values, and never expose server keys as `NEXT_PUBLIC_*`.
- Keep commit messages short and descriptive, mentioning the main module or feature touched.

## Convex Quote Backend

- Quote submissions POST to `src/app/api/quote/route.ts`, are server-priced in `src/lib/pricing/calculateQuote.ts`, and persist to Convex through `src/lib/quotePersistence.ts`.
- The Next.js API route calls Convex with `ConvexHttpClient` from `convex/browser`. Do not switch back to `convex/nextjs` helpers without checking the production route bundle; earlier builds generated invalid server JavaScript from that helper's env inlining.
- `CONVEX_QUOTE_WRITE_KEY` must match between Vercel and the target Convex deployment. This guards the public Convex mutation from direct writes.
- Convex SMS and email fan-out is scheduled by `convex/quoteRequests.ts` and sent by `convex/notifications.ts`. SMS copy is built in `convex/notificationText.ts`; email copy and CRM handoff links are built in `convex/quoteEmailNotifications.ts`.
- SMS recipients live in the Convex `notificationRecipients` table. They must have `active: true`, `phone` in E.164 format, and a readable `label`.
- Quote email recipients are read from `QUOTE_NOTIFICATION_EMAIL_RECIPIENTS`; Zoho send env vars and `FRONTIER_PIXEL_CRM_ADMIN_URL` must be configured in Convex so email alerts can include CRM handoff links.
- This repo no longer serves `/admin/*`; those paths should fall through to the normal site 404. Frontier Pixel CRM remains the admin system and should be accessed directly. This repo no longer owns admin auth, CRM leads, inbound SMS/voice/email webhooks, browser push, or CRM replies.
- Quote intake picks its tenant from the server-only `QUOTE_TENANT_SLUG` (default `shed210`), never from the request. The `/api/quote` request/response contract should stay stable unless the frontend quote flow changes with it.
- Data migrations are tracked with `@convex-dev/migrations`. Define migration functions in `convex/migrations.ts` and record each one in `docs/convex-migrations.md`. Production data changes follow the procedure below.
- Active recipients can be checked without sending SMS:

```bash
pnpm exec convex run --prod --inline-query 'const recipients = await ctx.db.query("notificationRecipients").withIndex("by_active", q => q.eq("active", true)).take(20); return recipients.map(({label, phone, active}) => ({label, phone, active, normalizedPhoneLooksValid: /^\+1\d{10}$/.test(phone)}));'
```

## Production Data

This repo has no gated production-data script (the CRM's `scripts/prod-data.mjs`
does not exist here), so follow this procedure by hand. The full steps are in
`docs/convex-migrations.md`.

- Every production write is a `migrations.define(...)` in `convex/migrations.ts`, covered by a test in `convex/__tests__`, reviewed, and merged. Merging deploys the code; it does not run it.
- Never write to production with an ad-hoc mutation through `convex run --prod`, `convex import`, or dashboard edits. The reviewed operator runbooks already in the repo (CRM dead-letter replay in `README.md`, `docs/crm-quote-historical-backfill.md`) are the exception: follow their steps, and run their production writes only with the user's explicit approval.
- Check status and dry-run first. Only run the real (non-dry-run) production migration after the user has reviewed the dry-run output and explicitly approved that run.
- Reads stay read-only and out of customer data where possible: prefer counts and summaries, and keep any exported records outside the repo.

## Deployments

- Current Convex dev deployment: `formal-frog-518`.
- Current Convex prod deployment: `handsome-pigeon-985`, served at `https://handsome-pigeon-985.convex.cloud` and `https://handsome-pigeon-985.convex.site`.
- Vercel Production has `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_QUOTE_WRITE_KEY`, and a production `CONVEX_DEPLOY_KEY` configured. Do not print or commit their values.
- Vercel Preview should have `CONVEX_DEPLOY_KEY` set to a Convex Preview Deploy Key, plus preview-safe runtime env vars such as `CONVEX_QUOTE_WRITE_KEY`. Preview builds create Convex preview deployments instead of sharing the Convex dev deployment.
- Before PR preview or production rollout work, use the repo skill at `.agents/skills/shed210-prod-pipeline/` to check local validation, Vercel Preview, Convex deploy/env behavior, quote alert QA, `/admin` 404 QA, and migration history.
- `vercel.json` runs `pnpm exec convex deploy --cmd 'pnpm build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` when `VERCEL_ENV=production` or `VERCEL_ENV=preview`; local/development builds run `pnpm build`. For the Convex deploy path, `pnpm build` runs first with the target Convex URL available as `NEXT_PUBLIC_CONVEX_URL`, then Convex typechecks, bundles, and pushes functions/schema before the Vercel build command succeeds.
- For future backend changes, test against Convex dev and Vercel Preview first. After merging to the production branch, Vercel Production should run the Convex deploy path with the production deploy key and production env vars.
- `npx convex deploy` from a local terminal targets the production deployment for the project and may prompt for confirmation. Use it intentionally.
- Do not assume dev Convex data or env vars copy to prod. Prod env vars and prod table data are separate.
- When promoting Convex dev changes to prod from a local shell, explicitly target prod so a local `.env.local` pointing at dev cannot intercept the deploy:

```bash
CONVEX_DEPLOYMENT=prod:handsome-pigeon-985 pnpm exec convex deploy --typecheck enable --cmd 'pnpm build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --message '<short deploy note>'
```

- Keep prod Convex env names in parity with the features being deployed. Check names only; never print secret values:

```bash
pnpm exec convex env list --prod | sed 's/=.*//' | sort
```

- To inspect production quote notifications:

```bash
pnpm exec convex data quoteRequests --prod --limit 5 --order desc --format jsonArray
pnpm exec convex data notificationAttempts --prod --limit 5 --order desc --format jsonArray
```

## Pricing Notes

- When pricing changes, update `src/lib/pricing/__tests__/calculateQuote.test.ts` and `docs/pricing-rules.md`.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
