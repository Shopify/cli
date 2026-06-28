# 2026-06-28-002 — Ship `--country` flag as a draft PR without the BP schema wiring

## Context
The `--country` flag for `store create dev` (see 2026-06-25-001) was tophatted locally
against a local Business Platform (`~/world/trees/pool-2`) whose `createAppDevelopmentStore`
mutation was patched to accept an optional `country: String` argument (Ariel's PR
`shop/world#671185`). The tophat involved three `TOPHAT ONLY` manual overrides that wired
`country` onto the GraphQL operation and into the mutation variables:
- `packages/store/src/cli/api/graphql/business-platform-organizations/mutations/create_app_development_store.graphql`
- `packages/store/src/cli/api/graphql/business-platform-organizations/generated/create_app_development_store.ts`
- `packages/store/src/cli/services/store/create/dev.ts`

The tophat was verified working end-to-end locally after restarting the BP web process
(`overmind restart web` in `core/shopify`) to reload the memoized GraphQL-Ruby schema, and
attaching an `ApiClient` to the `shopify-cli` ServiceApp in the local DB.

`shop/world#671185` is NOT yet merged to `main`. The CLI's `pnpm graphql-codegen` fetches
the published schema from `shop/world` `main`, and CI enforces a graphql-codegen freshness
check.

## Decision
Open the CLI change as a **draft PR without the GraphQL schema wiring**:
1. Reverted all three `TOPHAT ONLY` overrides so the `.graphql` operation and generated
   `.ts` are byte-identical to `HEAD` (passes the codegen freshness check).
2. Kept the full flag scaffolding: `--country` flag, shared `countryFlag` /
   `isCountryCode` / `invalidCountryCodeMessage`, `devStoreFlags.country`, plumbing into
   `createDevStore` options, and `country` in JSON/success output.
3. The service no longer sends `country` to BP; replaced the tophat comment with a NOTE
   marking the single insertion point for when the backend lands.
4. No changeset: the command is `hidden` and `country` is not functional end-to-end.

## Rationale
- A single CI-green PR cannot send `country` on the wire until the published schema has
  the argument; keeping the tophat edits would leave CI red until the BP PR merges.
- Shipping the flag scaffolding now (green) gets the shareable validation/flag logic
  reviewed and landed, decoupled from the backend timeline.
- The wiring is a trivial follow-up once `shop/world#671185` merges to `main`.

## Follow-up (once shop/world#671185 merges to main)
1. `pnpm graphql-codegen:get-graphql-schemas && pnpm graphql-codegen`
2. Add `$country: String` to `create_app_development_store.graphql` and the
   `createAppDevelopmentStore(country: $country)` argument.
3. Replace the NOTE in `services/store/create/dev.ts` with `country: options.country`.
4. Add a changeset and unhide the command when the broader feature is ready.

## Alternatives rejected
- **Single stacked/draft PR keeping the `TOPHAT ONLY` edits** (Option A): accurately
  communicates the dependency but leaves CI red on the codegen freshness check until the
  BP PR merges. Rejected in favor of a green draft per Ariel's preference.
- **Keeping `country: options.country` in the service while reverting the generated
  variables type**: TypeScript error — the object literal would reference a property the
  reverted `CreateAppDevelopmentStoreMutationVariables` type no longer declares.
