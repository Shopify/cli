# Changelog - @shopify/shopify-dev-tools

## 1.12.1

### Patch Changes

- e5ff2d4: Use the `values` shorthand for metaobject writes and Admin API reads in custom data instructions.
- 9777171: Fix generated GraphQL skills so standalone validation can load schema metadata.
- 31d8759: Move brand-new merchant preview-store onboarding onto `onboarding-merchant`, trim that skill down to preview creation plus merchant follow-up guidance, and stop treating preview-store creation as a primary `use-shopify-cli` workflow. Merchants now view a preview store with `shopify store open` rather than surfacing the raw storefront URL, and the `onboarding-merchant` routing description no longer advertises connecting an existing merchant-owned store. Tighten the focused preview-store evals around the new onboarding boundary and merchant-facing response contract.
- bbe8aea: Expose GraphQL directive metadata in generated skill inspection output.

## 1.12.0

### Minor Changes

- 1144363: Add a bundle-friendly `@shopify/shopify-dev-tools/validation/graphql` entry that validates GraphQL operations without importing the TypeScript-based component validator, a `SchemaSource` seam, and build-time embedded schemas (`@shopify/shopify-dev-tools/schema-embedded/*`) so a consumer can validate without filesystem access. Existing `./validation` and schema-operations APIs and the default on-disk loading are unchanged.

### Patch Changes

- b1a40b9: Use `log!` + `process::abort()` in the Functions `main.rs` example so the documented template matches the runtime the rest of the SKILL recommends.

## 1.11.0

### Minor Changes

- 0da06ce: store execute attribution: add an `m:<model>` tag to `SHOPIFY_CLI_AGENT_INFO`, give concrete per-field examples, disambiguate the version field, and add a "use `none` if unknown" rule so agent-run CLI commands stop reporting generic provider/version values and start capturing the actual model.

### Patch Changes

- 4d50229: App review now retrieves the requirements page with the Shopify CLI's `shopify doc fetch`, giving a cleaner, more predictable fetch of the canonical Markdown than ad-hoc browser or web-fetch retrieval.
- 5cf5a15: Fix invalid `s-badge tone="success"` examples in the checkout and customer-account extension instructions (their badge tone is `auto`/`neutral`/`critical`).
- 6897a17: Remove stale JS template-literal `\$` escapes from the Functions instructions so example GraphQL operations use valid `$variable` syntax.
- 3c60232: `validate_component_codeblocks` accepts a per-block `language` and, for `html` blocks, validates against the HTML-attribute contract: string-valued number/boolean props (e.g. `min="0"`) and native global attributes (`class`, `style`, `id`, `onclick`) are no longer reported as false positives. Enum mismatches, unknown props, and hyphenated-attribute issues still fail. TSX/JSX validation is unchanged.
- 33fe588: Expose component instance details from the component inspector for richer eval assertions.
- d93b097: `validate_components` for `polaris-app-home` no longer attributes TS2304 "Cannot find name" errors to a Shopify component when the missing identifier comes from a snippet referencing handlers defined elsewhere, and now resolves imports from `@shopify/app-bridge-react` (`TitleBar`, `NavMenu`, `Modal`, `SaveBar`) so legacy App Bridge React patterns validate correctly and are reported under `validatedComponents` rather than silently falling into the unvalidated bucket.
- 6a9e92d: Fix Functions GraphQL validation in JSON mode so consumers always receive parseable JSON output. This removes stray debug logs that could cause valid Function code to be reported as invalid, improving agent success in affected cases.
- 1541001: Default GraphQL introspection to the latest stable schema when no API version is provided.
- b222a16: Reduce false positives in theme validation by skipping single-codeblock checks that require co-resident files, including snippets/assets/blocks/locales.

  Treat `WARNING` and `INFO` theme-check findings as advice rather than failures across MCP and CLI theme validators, while still surfacing them in result detail.

- 87b0111: Reject duplicate theme codeblock paths instead of silently overwriting them, and document the `--context <theme|app>` flag in the stateless validation instructions.
- 87b0111: Reduce false failures in theme validation by supporting app-extension context and avoiding invalid profiles for snippet/block docs, JSON fragments, and non-section JSON files.

## 1.10.0

### Minor Changes

- 64d4b72: Capture the user's most recent prompt (verbatim, truncated to 2000 chars) in skill telemetry. Each skill ships exactly one user_prompt-capturing script: `validate.mjs` for skills with validation, or a new `log_skill_use.mjs` for skills without. The hook does not carry user_prompt — it identifies the activation and supplies dedup keys (`sessionId`, `toolUseId`). Honors `OPT_OUT_INSTRUMENTATION=true`.
- d1533d2: Add version-aware Shopify API context, search, validation, and generated skills.
- 84645c5: Inject a `hooks:` block into every generated `SKILL.md` so Claude Code emits `skill_invocation` telemetry when skills are installed standalone (e.g. `npx skills add Shopify/shopify-ai-toolkit`), not only when the plugin is installed. Events from the plugin-manifest and skill-frontmatter hooks are labeled with `hookSource` and carry the agent's `sessionId` + `toolUseId` inside the body's `parameters` object, so downstream consumers can dedup on `(sessionId, toolUseId)` when both surfaces fire for the same tool call.

### Patch Changes

- 19a9a93: Fix the skill-frontmatter telemetry hook to resolve its script via `$CLAUDE_PLUGIN_ROOT` so standalone Claude Code skill installs emit `skill_invocation` instead of failing with a no-such-file hook error.
- a137176: Pass the captured user prompt to skill telemetry as a base64 argument (`--user-prompt-base64`) instead of a shell heredoc, closing a shell-injection seam for prompts containing the heredoc delimiter.

## 1.9.1

### Patch Changes

- c14c77a: Update React Router dependencies to versions accepted by downstream security checks.
- 7c7c94d: `validate_components --json` now includes `componentValidationErrors`, `genericErrors`, and `validatedComponents` so callers can distinguish Polaris-shape failures from generic TS diagnostics and confirm a block actually validated a Shopify component (rather than just compiling cleanly).

## 1.9.0

### Minor Changes

- 716d22b: `shopify-app-store-review` skill now points the agent at the canonical shopify.dev requirements page (https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements) instead of carrying a hand-maintained inline copy, and adds 5.x category-specific requirements. Output format and status taxonomy are unchanged. (Retroactive changeset for #722, which merged without one.)
- b2e0788: Add a shippable experiments helper with explicit stable install-id lifecycle, opt-out short-circuiting, revocation support, and hardened Monorail error reporting.
- 08f0921: Add a releasable UCP topic that publishes the standalone `ucp` skill and learn_shopify_api instructions.
- 716d22b: Skill validate scripts (`validate_graphql`, `validate_components`, `validate_functions`, `validate_theme`) now emit the same markdown summary the MCP `validate_*_codeblocks` tools return, including artifact ID and revision lines. The id is auto-minted when not supplied and echoed back to the agent, matching the MCP behavior so retries can chain across revisions on either surface.

### Patch Changes

- e236bad: fix polaris skills to use camelCase not kebab-case
- d2545fd: Support eval-time instruction experiments. Drop a sibling
  `<api>.experiment.md` next to any `src/instructions/<api>.md` and run
  `pnpm --filter @shopify/ai-toolkit-evals run eval:experiment promptfoo/<topic>.yaml`
  to see baseline and experiment columns side-by-side, plus a `None`
  baseline (no instructions, no tools).

  Internals: the api-instructions and agent-skills generators are now
  callable as functions with `{ inputDir, outputDir, apiFilter }` (existing
  `tsx`-invoked behavior is unchanged). The dev-mcp loader honors a new
  `MCP_INSTRUCTIONS_OVERRIDE_DIR` env var that, when set, prepends an
  overlay directory to its candidate list — falls back to canonical for
  any api the overlay doesn't cover. Has no effect when the env var is
  unset.

- c2b8ff2: Update the Shopify CLI guidance topic to prefix `shopify` commands with `SHOPIFY_CLI_AGENT*` environment variables so agent-driven CLI executions can be attributed in Shopify CLI analytics.
- f8d1abd: Disclose default-on telemetry more clearly in mirrored plugin install surfaces and generated skill privacy notices, including the opt-out environment variable. Clarify that validation and search scripts report specific request data to `shopify.dev/mcp/usage`.
- 40cd7cd: Include the response body in `shopifyDevFetch` errors for 5xx responses, restoring the diagnostic detail previously surfaced by `search_docs.ts` and improving 5xx error messages for the MCP.
- 9add652: Quote the packed `SHOPIFY_CLI_AGENT_INFO` and `SHOPIFY_CLI_AGENT_IDS` values in the Shopify CLI topic so exact executed command examples remain valid shell commands. Tighten the matching eval to require both packed env vars, including ordered `s:` / `r:` / `i:` ID segments.
- 716d22b: Inject `--target` guidance into SKILL.md for extension-surface skills (Admin Extensions, Checkout Extensions, Customer Account Extensions, POS UI). The validate.mjs invocation example now includes `--target <extension-target>` plus a one-line note with a representative target value, since validation rejects extension-surface code without one. Non-extension skills are unchanged.
- c976654: Fix Experiments constructor to thread config.env through to install-ID resolution.
- 01d0288: Mirror the dual-mode pattern from `validate_graphql.ts` in
  `validate_functions.ts`: bundled per-skill builds inject a new
  `__BUNDLED__` esbuild define and resolve schemas via
  `__dirname/../assets` as before; running the script from source (e.g.
  via `tsx` for evals) now resolves the schema path through
  `loadAPISchema(apiName)` against `shopify-dev-tools/src/data/`. No
  change to bundled-mode behavior. Fixes evals that were failing with
  `ENOENT: scandir '.../src/agent-skills/assets'` because the source
  script was unconditionally looking for assets that only exist in the
  generated per-skill bundle.
- d2545fd: Add a runtime `--api <name>` flag to `validate_graphql.ts`. The bundled
  per-skill build still injects `__API_NAME__` and `__SCHEMA_FILE__` via
  esbuild defines and takes precedence; the new flag is the source-mode
  fallback (e.g. running the script directly via `tsx` for evals), where
  the schema path is resolved through `loadAPISchema(apiName)`. No change
  to bundled-mode behavior.

## 1.8.0

### Minor Changes

- ac6ca62: `shopify-onboarding-merchant` skill now contains the full merchant onboarding guidance (CLI + plugin install, store auth flow, 4-step setup, auth-scope reference, behavioral rules) directly in `instructions/onboarding-merchant.md`. Previously the skill was a 476-byte stub that pointed agents at `shopify.com/SKILL.md` via WebFetch — some agents refused that fetch as a suspected prompt-injection pattern. Loading the skill locally via `npx skills add Shopify/shopify-ai-toolkit --skill shopify-onboarding-merchant` removes that failure mode. The skill now also carries `maintainer: Shopify` in the published frontmatter as a trust signal. The corresponding `shopify.com/SKILL.md` URL is being shrunk to install instructions only (handled in a separate brochure PR).

## 1.7.0

### Minor Changes

- aab0a72: `shopify-app-store-review` skill now points the agent at the canonical shopify.dev requirements page (https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements) instead of carrying a hand-maintained inline copy, and adds 5.x category-specific requirements. Output format and status taxonomy are unchanged. (Retroactive changeset for #722, which merged without one.)

### Patch Changes

- e4d349f: Validate that hyphenated prop names on Polaris components are flagged as errors, since TypeScript silently accepts them on web components but they are not valid Polaris props. Adds `camelCase` suggestion in the error message.

## 1.6.0

### Minor Changes

- d7608c7: Changeset to force a new release

All notable changes to this package will be documented in this file.

## [1.5.0] - 2026-03-27

### Added

- Added `INTERNALLY_ACCESSIBLE_SHOPIFY_APIS` — a superset of public APIs including internal Shopify APIs, exposed via `shopify-dev-tools/internal` subtree (#461)
- Added structured outputs to component validation results — new fields in `types/index.ts` and updated `extractComponentValidations` (#483)

### Fixed

- Fixed function schema files not loading — 7 schemas had `_schema_` in filenames but `loadAPISchemas` expected `${apiKey}_${version}.json`; affected `introspect_graphql_schema` and `validate_graphql_codeblocks` for all function APIs since v1.4.0 (#506)
- Suppressed false-positive TypeScript strict-mode errors in `validate_component_codeblocks` (#503)
- Removed noisy `console.error` trace logging on every schema cache hit, file read, and HTTP request (#429)
- Fixed Zod v4 breaking changes in TypeScript types (#396)
- Fixed broken hydrogen dependency (#359)

### Dependencies

- Moved `zod` from `devDependencies` to `dependencies`; removed unused `env-paths` (#339)
- Bumped acorn, graphql, terser, zod, typescript, and other deps to latest (#354)

## [1.4.0] - 2026-01-13

### Added

- Added custom-data API to instruct LLM to use shopify.app.toml definitions
- Replace Zod Instructions for Extensions and Hydrogen APIs
- New tool: learn_extension_target_types to learn about components and APIs available for a extension target
- Extension target support for validate_component_codeblock tool. Flags unsupported components for a target
- Hydrogen now supported by MCP: Type Instructions and validation.
- Enforce Shopify components only for Extension APIs through validate_component_codeblock
- Inform state for deprecated gql fields through validate_component_codeblock
- Bump supported GQL versions to 2026-01

## [1.3.0] - 2025-11-17

### Added

- Added `api-mapping` and `api-types` as new exports from `@shopify/shopify-dev-tools`
- Added GraphQL function validation support
- Introduced memory cache for schemas to improve performance
- Added artifact ID support for tracking code validations

### Changed

- **MAJOR CHANGE**: Replaced Zod with TypeScript compilation for validation
  - Implements virtual TypeScript validation for better performance
  - Includes improved Windows path resolution
- Updated search to use POST method for longer queries
- Updated POS system instructions and keywords for pos-ui arg mapping

### Dependencies

- Moved zod to devDependencies (no longer used in runtime)
- Updated @shopify/polaris-types (previously @shopify/app-bridge-ui-types)
