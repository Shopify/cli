# 2026-06-25-001 — `--country` flag for `store create dev` (country piece of shop/world#22968)

## Context
`shopify store create dev` needs a `--country` flag, mirroring `store create preview`,
which already accepts and validates a country code. The Business Platform
`createAppDevelopmentStore` mutation does not yet expose a `country` argument — that
backend change is an open (unmerged) PR in `shop/world`. The CLI fetches the published
BP schema from `shop/world` `main` via `bin/get-graphql-schemas`, and CI enforces a
graphql-codegen freshness check.

## Decision
1. Extract and share the country validation logic in `packages/store/src/cli/flags.ts`:
   - `countryFlag(env)` factory (already existed, now exported) builds a normalized
     (trim + uppercase) `--country` flag.
   - `isCountryCode(value)` (already existed) validates the two-letter shape.
   - New `invalidCountryCodeMessage` constant so every store-creation command emits the
     same error.
   - New `devStoreFlags.country` (env `SHOPIFY_FLAG_STORE_COUNTRY`), alongside
     `previewStoreFlags.country`.
2. Add `--country` to the `store create dev` command with shared validation, threaded
   into `createDevStore` options and surfaced in JSON/success output.
3. Do **not** wire `country` into the `createAppDevelopmentStore` mutation variables or
   the `.graphql` operation yet — left a code comment marking the single insertion point.
4. No changeset: the command is `hidden` and the flag is not yet functional end-to-end.

## Rationale
- The shareable validation/flag logic is mergeable now and unblocks the CLI side ahead
  of the backend.
- Adding `country` to the `.graphql` operation now would break the CI graphql-codegen
  freshness check, because the published schema (`shop/world` main) lacks the argument
  until the backend PR merges. Passing it in mutation `variables` would also be a
  TypeScript error against the generated variables type.
- Referencing the flag via `devStoreFlags.country` (member expression) instead of a
  direct `countryFlag(...)` call inside the command's `flags` block avoids a crash in the
  `@shopify/cli/command-flags-with-env` lint rule, matching the existing
  `previewStoreFlags.country` / `storeFlags['organization-id']` pattern.

## Alternatives rejected
- Hand-editing the generated `create_app_development_store.ts` to add `country`: would be
  reverted by `pnpm graphql-codegen` and fail the CI freshness check.
- Adding `country` to the `.graphql` operation now: breaks codegen against the live schema.
- Inlining the validation/error string per-command: duplicates logic the task asked to share.
