---
name: shed210-prod-pipeline
description: Verify Shed210 preview-to-production readiness for deploys, Vercel Preview or Production changes, Convex env and deploy work, quote alert SMS/email QA, schema changes, data migrations, and migration history questions.
---

# Shed210 Production Pipeline

Use this skill when work can affect preview or production deploy safety for the
Shed210 site, its Convex quote backend, quote alert SMS/email, schema, or data.
Admin, leads, and CRM messaging live in the separate Frontier Pixel CRM; this
repo does not serve `/admin`.

## Start With Repo Truth

Before making rollout claims or issuing deploy commands, inspect the current
repo state. At minimum read:

- `vercel.json`
- `package.json`
- `AGENTS.md`
- `.env.local.example`
- `docs/quotes-table.md`
- `docs/convex-migrations.md`
- `convex/migrations.ts`

When touching Convex code, read `convex/_generated/ai/guidelines.md` first and
follow its repo-local rules over model memory.

## Pipeline Facts

- `vercel.json` uses `VERCEL_ENV` to choose the build path.
- Vercel Preview and Production run `pnpm exec convex deploy --cmd 'pnpm build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`.
- With Convex deploy, the command passed through `--cmd` runs first with the target Convex URL available in `NEXT_PUBLIC_CONVEX_URL`. In this repo that means `pnpm build` runs the explicit TypeScript check and then the standard Next.js production build against the target backend URL.
- After that command succeeds, Convex typechecks, bundles, and pushes Convex functions and schema for the target deployment before the Vercel build command succeeds.
- Local and Vercel development builds run plain `pnpm build`.
- Vercel Preview must use a Convex Preview Deploy Key in `CONVEX_DEPLOY_KEY`. It should not share the Convex dev deployment.
- Vercel Production must use the production Convex deploy key and production-scoped env vars. Never print or commit secret values.

## Release Checklist

For work that can reach production:

1. Confirm the branch is not `main` unless the user explicitly wants direct production work.
2. Validate locally against Convex dev or an integrated Convex target before opening a PR.
3. Use local Jest mocks where applicable for Twilio, Zoho, and Convex clients.
4. Run `pnpm lint`, `pnpm test`, and `pnpm run typecheck`.
5. Run `pnpm build` for config, build, backend, Convex, or env-sensitive work.
6. Open or update a PR so Vercel creates a Preview deployment.
7. Confirm Vercel Preview has a Convex Preview Deploy Key and preview-safe runtime env vars.
8. QA the Vercel Preview before production promotion.
9. Merge only after Preview QA and required checks are acceptable.
10. Let Vercel Production deploy with production env vars and the production Convex deploy key.
11. Verify production behavior and logs after rollout.

Docs-only and skill-only changes do not require app `pnpm` checks unless they
touch app, Convex, Vercel, package, or config code.

## Preview QA

On the PR Preview, verify the user-facing and operational paths affected by the
change. For quote or notification changes, include:

- The quote flow end to end, including the 3D preview and the `/api/quote`
  submission.
- Quote alert SMS and email behavior using preview-safe credentials or mocks.
- CRM quote sync outbox behavior when `SHED_CRM_SYNC_ENABLED` is relevant.
- `/admin` paths fall through to the normal site 404.
- Convex logs for expected successes and failures.

Preview data and accounts are temporary. Do not assume they exist in dev or
production.

## Production Verify

After production deploy, verify only what the rollout needs, but do not skip
backend-sensitive smoke checks when Convex, Twilio, Zoho, or schema changed:

- A production quote submission stores and alerts as expected.
- `/admin` paths return the site 404.
- Convex and Twilio logs show expected events and no new repeating errors.
- Production Convex env names exist for the deployed feature. Check names only; never reveal values.
- Existing production data still matches the deployed schema and no unexpected breakage appears in recent records.

## Migration Rules

Classify every schema or data change before rollout:

- Additive or compatible: optional fields, new tables, indexes, and enum widening that existing documents can still validate against.
- Breaking: required fields on existing tables, field type changes, field removals, table splits or merges, and any code path that cannot tolerate old and new shapes at the same time.

For breaking changes, use widen-migrate-narrow:

1. Widen schema and code so old and new data are both valid.
2. Deploy the widened code and schema.
3. Define data migrations in `convex/migrations.ts` with `@convex-dev/migrations`.
4. Check migration component status before running.
5. Dry-run before production data changes and review the output with the user.
6. Run the migration only after the user explicitly approves it, then monitor status until complete.
7. Verify all target documents are migrated.
8. Narrow schema and code in a later deploy.
9. Re-check migration component status after completion.

Update `docs/convex-migrations.md` for every schema or data rollout. Additive
schema changes still need a history entry that says no data migration was
required. Do not invent migration history entries for unrelated skill or docs
maintenance.

## Useful Commands

Run the repo checks:

```bash
pnpm lint
pnpm test
pnpm run typecheck
pnpm build
```

Check migration component status:

```bash
pnpm exec convex run --component migrations lib:getStatus
pnpm exec convex run --prod --component migrations lib:getStatus
```

Dry-run and run a migration on dev:

```bash
pnpm exec convex run migrations:run '{"fn":"migrations:<migrationName>","dryRun":true}'
pnpm exec convex run migrations:run '{"fn":"migrations:<migrationName>"}'
```

For production, follow "Changing Production Data" in
`docs/convex-migrations.md`: dry-run first, and run the real migration only
after the user approves it.

Inspect production Convex env names without values:

```bash
pnpm exec convex env list --prod | sed 's/=.*//' | sort
```
