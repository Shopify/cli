---
name: shopify
description: 'Any Shopify or commerce task; start here. Admin/Storefront/Customer/Partner/Payments GraphQL, metafields, Functions, Hydrogen, Liquid themes, Polaris, admin/checkout/customer-account/POS extensions, CLI, onboarding, UCP, App Store review, dev docs.'
---

# Shopify

Umbrella skill for building on and selling with Shopify. It spans every surface: Admin, Storefront, Customer Account, Partner, and Payments Apps GraphQL APIs, custom data, Functions, Hydrogen storefronts, Liquid themes, Polaris App Home, Admin/Checkout/Customer Account/POS UI extensions, developer and merchant onboarding, CLI operations, UCP commerce, and App Store review. Do the work from your own knowledge first, then **validate the outcome** — validation is the mandatory ground-truth gate, and you search the docs only when it fails. (The sole exception: an outcome with no `shopify validate` surface, where you ground in a doc search up front instead.) Match liberally: if a request touches Shopify at all, use this skill.

## Principle

Attempt the task from your current knowledge, then prove it with the validator. A passing validator means your knowledge was current — no doc search was needed, and a forced up-front search would have been wasted work. A *failing* validator is the signal that your training data for this surface is stale: Shopify APIs, schemas, extension targets, and CLI config change every release, so recalled details go out of date. That failure — and only that failure — is when you ground the work in current documentation and correct it. Skipping validation is a defect, even for a change that "looks obvious."

The exception is an outcome with no `shopify validate` surface (guidance you give, a read-only analysis you report, a flow you run, a bare documentation answer). With no validator to catch stale knowledge, those are the cases — and the only cases — where you ground in a doc search *up front*.

## Pattern

Every `shopify` command is discoverable and self-documenting — never guess a command name or a flag. List the full command tree with `shopify commands` (add `--tree` for a nested view), and append `--help` at any level for a description of a command, its subcommands, and its flags:

```bash
shopify commands          # every available command
shopify app --help        # a topic's subcommands
shopify validate --help   # one command's flags and topics
```

Use this to confirm the exact surface of any command in this skill — including whether `shopify validate` and its topics exist in the installed version — before you run it.

### 1) Do the work from your own knowledge

Identify the family the task falls into (see the table), then build the query, mutation, component, config, or scaffold directly from what you know. Scaffold new apps, themes, or extensions through the CLI generators (for example `shopify app generate extension`, `shopify theme init`) rather than hand-writing boilerplate. Follow this repo's conventions: named exports, side-effect-free modules, and existing patterns first — look for a helper in `@shopify/cli` before writing your own. Leave no TODOs, FIXMEs, or placeholders. Do not search the docs yet — the validator, next, decides whether you need to.

There are exactly four `shopify validate` topics — `theme`, `graphql`, `functions`, and `components` (`graphql`, `functions`, and `components` take an `--api` flag; `theme` does not). Run `shopify validate --help` to confirm. The table maps each family to the topic that gates it — or marks families that have no validator — plus the doc-search scope to reach for *if* validation fails (or up front, when the outcome can't be validated).

| Family | Covers | `shopify validate` topic | Doc search on failure (`--query` / `--api-name`) |
|---|---|---|---|
| GraphQL APIs | Admin, Storefront, Customer Account, Partner, Payments Apps queries & mutations; apps/integrations extending the admin | `graphql --api admin\|storefront\|customer\|partner\|payments-apps` | `--query "create product" --api-name admin` |
| Custom data | Metafields & metaobjects definitions/schemas extending products, customers, etc. | `graphql --api admin` | `--query "metaobject definition" --api-name admin` |
| Functions | Discount, cart/checkout validation, cart transform, delivery & payment customization, order routing location rule, fulfillment constraints, pickup/local delivery option generators | `functions --api functions_*` | `--query "product discount function" --api-name functions` |
| Storefronts | Hydrogen recipes (B2B, bundles, combined listings, custom cart method, metaobjects, markets, subscriptions, infinite scroll, GTM, Partytown, third-party caching) and Storefront GraphQL cart operations | `graphql --api storefront` for Storefront GraphQL; Hydrogen recipe code has no validator | `--query "cart lines add" --api-name hydrogen` |
| Themes | Liquid sections, blocks, snippets, and theme schemas | `theme` | `--query "section schema settings" --api-name liquid` |
| Admin & extension UI | Polaris App Home embedded admin UI, plus Admin, Checkout, Customer Account, and POS UI extensions (scaffold via CLI) | `components --api <surface>` (e.g. `app-home`, `checkout-ui-extensions`, `pos-ui-extensions`) | `--query "checkout ui extension targets"` |
| Onboarding | Developer setup (scaffold app/theme/project, create a dev store, set up a Partner account) and merchant setup (start selling, try before an account, `shopify store create preview`) | — no validator (merchant guidance; ground up front) | `--query "scaffold app dev store"` |
| CLI operations | Validate config on disk (`shopify.app.toml`, `shopify.extension.toml`); run store workflows (`shopify store auth`/`execute`); store-scoped reads/writes by handle/SKU/location on a named myshopify.com domain | — no `shopify validate` topic (config: `shopify app config validate`) | `--query "app configuration toml"` |
| Commerce (UCP) | UCP CLI: find/compare/buy/track products, `ucp profile init`, `ucp doctor`, carts, checkout, orders, merchant-hosted handoff fallback | — no validator (a buy/track flow; ground up front) | `--query "ucp checkout order"` |
| App Store review | Pre-submission compliance check of an app's codebase; surface likely review issues before submitting | — no validator (read-only analysis; ground up front) | `--query "app store review requirements"` |

### 2) Validate the outcome — mandatory, always

Validation is always required and is the gate that decides whether your knowledge held. *What* you validate depends on the outcome you produced. Identify which outcome it is, then apply the matching rule. Use the topic that matches the surface you worked on — there are exactly four: `shopify validate theme`, `shopify validate graphql`, `shopify validate functions`, and `shopify validate components` (`graphql`, `functions`, and `components` take `--api`; run `shopify validate --help` to confirm).

**Outcome A — a chat reply containing an example (nothing written to disk).**
The example you show the user must be a *complete, fully valid* artifact — never a fragment and never placeholder syntax:

- No elisions or placeholders: no `...`, `// rest here`, `<your-value>`, `YOUR_TOKEN`, `TODO`, or omitted required fields. Every id, import, field, and closing brace is real and present.
- It must stand alone: the user could copy it verbatim and it would parse and run as-is.
- Prove it before sending. Write the example to a temporary file, run the appropriate `shopify validate [topic]` against that file, resolve anything it reports, then delete the temp file. Do not present an example you have not validated this way.

**Outcome B — a change on the filesystem (files created or modified).**
Validate *every* file you touched, each with the validation appropriate to that file's surface:

- Run `shopify validate [topic]` for every surface your change spans — if you touched a Function and a theme file, validate both `functions` and `theme`. Validating one and stopping is not enough.
- Do not validate only the "main" file while skipping the config, manifest, or generated files the same change modified.

If validation passes clean, the task is done — your knowledge was current and no doc search is needed. If it reports anything, go to step 3.

### 3) On validation failure — search the docs, fix, re-validate

A validation finding means your recalled details are stale for this surface. Now — and only now — ground the work in current documentation:

```bash
shopify doc search --query "<what you are building>" [--api-name admin|storefront|customer|partner|payments-apps|functions|hydrogen|liquid|...] [--api-version latest|2025-10|...]
```

- It queries the shopify.dev vector store and prints the most relevant documentation chunks as JSON.
- Pass `--api-name` to scope to a surface; omit it to search across ALL APIs — that omission is the intended generic discovery / fallback path. The valid API names are `admin`, `admin-extensions`, `checkout-ui-extensions`, `customer-account-ui-extensions`, `pos-ui-extensions`, `app-home`, `storefront`, `partner`, `customer`, `payments-apps`, `hydrogen`, `liquid`, `storefront-web-components`, and `functions`.
- Pass `--api-version latest` unless the task pins a version (for example `2025-10`); match the version between search and output, or you get subtly wrong fields.
- Refine the query and re-run until the returned chunks genuinely cover the finding. Thin or off-topic results mean you are not ready to correct the artifact yet.

If the ranked chunks aren't enough, you can pull a full page verbatim as Markdown — but sparingly: `doc fetch` returns the *entire* document, so only reach for it when a full page is genuinely needed and fetching it once is cheaper than a few more targeted `shopify doc search` queries.

```bash
shopify doc fetch --url <shopify.dev url> [--output <file>]
```

Correct the artifact against the retrieved docs, then **re-run `shopify validate [topic]`**. Read everything it reports, resolve every finding, and loop — fixing from the docs and re-validating — until it passes clean. Do not present the task as finished while validation reports outstanding issues; an unresolved finding means the task is not done. `shopify doc search` is the remediation path for ANY Shopify topic, including surfaces not in the table above.

**When the outcome cannot be validated.** Some outcomes produce nothing `shopify validate` can gate — merchant onboarding guidance, App Store review's read-only analysis, a UCP buy/track flow, Hydrogen recipe code, or a bare documentation question. With no validator to catch stale recall, ground these in `shopify doc search` / `shopify doc fetch` *up front* and answer from the retrieved chunks. This is the narrow exception the missing safety net demands — not a general rule to search before answering when a validator does exist.

## Gotchas

- Validation is the gate, not best effort. The task is complete only when `shopify validate [topic]` is clean — or, for an outcome with nothing to validate, grounded in a fresh doc search. Don't skip the gate because a change looks trivial.
- Don't guess command names or flags. The command surface changes between versions — `shopify commands` lists what exists and `<command> --help` documents its flags. Confirm there before running, especially for `shopify validate`.
- A code example in a chat reply is an outcome too. A snippet with `...` or placeholder values is not "done" — write it to a temp file and validate it exactly like a committed file before you show it.
- On a failed validation, `--api-name` narrows recall; if results look thin or miss the point, drop the flag and search across all APIs.
- Prefer `shopify doc search` over `shopify doc fetch`. Search returns only the ranked, relevant chunks; `doc fetch` pulls the whole document and is token-expensive. Reach for it only when you genuinely need a page verbatim and fetching it once is cheaper than several follow-up `shopify doc search` queries — otherwise refine the search instead.
- "Polaris" alone means **App Home** (the embedded admin app UI); treat it as an extension only when the task names Admin, Checkout, Customer Account, or POS.
- Developer onboarding (scaffold app/theme/project, create a dev store, Partner account) is not merchant onboarding (start selling online, first store, `shopify store create preview`) — the former scaffolds validatable config; the latter is guidance you ground with an up-front search.
- App Store review is read-only analysis of the codebase — report likely blockers; do not silently rewrite the app.
- Store-scoped CLI reads/writes (`shopify store auth`/`execute`, reads/writes by handle/SKU/location on a named myshopify.com domain) act on real store data — confirm the target domain before running them.

## Examples

- "Write an Admin mutation to create a metafield definition." → write the mutation from knowledge, then `shopify validate graphql --api admin`. If it flags a field, `shopify doc search --query "metafield definition create mutation" --api-name admin`, fix against the docs, and re-validate until clean.
- "Add a discount Function." → implement `run` from knowledge, then `shopify validate functions --api functions_discount`. On a failure, `shopify doc search --query "product discount function" --api-name functions`, correct the input query/return shape, and re-validate.
- "Fetch orders in the customer account." → build the query, then `shopify validate graphql --api customer`. If it reports stale fields, `shopify doc search --query "customer account api orders"` (no `--api-name` unless you confirm a valid one), fix, and re-validate.
- "Scaffold a checkout UI extension." → generate via the CLI and implement the target from knowledge, then `shopify validate components --api checkout-ui-extensions`. On a failure, search checkout extension targets, fix, and re-validate.
- "Help me start selling on Shopify." → merchant onboarding guidance has no validator, so ground up front: `shopify doc search --query "start selling create preview store"` (no `--api-name`), then guide the preview/first store setup from the retrieved docs.
- "Is my app ready to submit to the App Store?" → read-only analysis, no validator: `shopify doc search --query "app store review requirements"` up front, inspect the codebase, and report likely blockers without rewriting the app.
- "Buy this product with UCP." → a runtime flow, nothing to validate: `shopify doc search --query "ucp checkout"` up front, then run the flow.
