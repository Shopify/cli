---
name: shopify
description: 'Any Shopify or commerce task; start here. Admin/Storefront/Customer/Partner/Payments GraphQL, metafields, Functions, Hydrogen, Liquid themes, Polaris, admin/checkout/customer-account/POS extensions, CLI, onboarding, UCP, App Store review, dev docs.'
---

# Shopify

Umbrella skill for building on and selling with Shopify. It spans every surface: Admin, Storefront, Customer Account, Partner, and Payments Apps GraphQL APIs, custom data, Functions, Hydrogen storefronts, Liquid themes, Polaris App Home, Admin/Checkout/Customer Account/POS UI extensions, developer and merchant onboarding, CLI operations, UCP commerce, and App Store review. Two steps are mandatory on every task and must never be skipped: **search the docs first**, **validate the outcome last**. Match liberally: if a request touches Shopify at all, use this skill.

## Principle

Never answer from memory or write Shopify code from assumption. Shopify APIs, schemas, extension targets, and CLI config change every release, so recalled details are frequently stale. Ground the work in current documentation, then prove the result with the validator. Skipping either bracket is a defect, even for a change that "looks obvious."

## Pattern

Every `shopify` command is discoverable and self-documenting — never guess a command name or a flag. List the full command tree with `shopify commands` (add `--tree` for a nested view), and append `--help` at any level for a description of a command, its subcommands, and its flags:

```bash
shopify commands          # every available command
shopify app --help        # a topic's subcommands
shopify doc search --help # one command's flags
```

Use this to confirm the exact surface of any command in this skill — including whether `shopify validate` and its topics exist in the installed version — before you run it.

### 1) Search the docs first — mandatory, non-skippable

Before producing any answer, query, mutation, component, config, or scaffold, search shopify.dev:

```bash
shopify doc search --query "<what you are building>" [--api-name admin|storefront|customer|partner|payments-apps|functions|hydrogen|liquid|...] [--api-version latest|2025-10|...]
```

- It queries the shopify.dev vector store and prints the most relevant documentation chunks as JSON.
- Pass `--api-name` to scope to a surface; omit it to search across ALL APIs — that omission is the intended generic discovery / fallback path. The valid API names are `admin`, `admin-extensions`, `checkout-ui-extensions`, `customer-account-ui-extensions`, `pos-ui-extensions`, `app-home`, `storefront`, `partner`, `customer`, `payments-apps`, `hydrogen`, `liquid`, `storefront-web-components`, and `functions`.
- Pass `--api-version latest` unless the task pins a version (for example `2025-10`).
- Refine the query and re-run until the returned chunks genuinely cover the task. Thin or off-topic results mean you are not ready to answer yet.

To read a full referenced page verbatim, pull it as Markdown:

```bash
shopify doc fetch --url <shopify.dev url> [--output <file>]
```

`shopify doc search` is the default discovery path and the fallback for ANY Shopify topic, including surfaces not in the table below. When unsure which family applies, search first, then decide.

### 2) Do the work for the matching family

Pick the family the task falls into, build to the docs you just retrieved, and scaffold new apps, themes, or extensions through the CLI generators (for example `shopify app generate extension`, `shopify theme init`) rather than hand-writing boilerplate. Follow this repo's conventions: named exports, side-effect-free modules, and existing patterns first — look for a helper in `@shopify/cli` before writing your own. Leave no TODOs, FIXMEs, or placeholders.

| Family | Covers | Representative doc-search query | Validate topic (illustrative) |
|---|---|---|---|
| GraphQL APIs | Admin, Storefront, Customer Account, Partner, Payments Apps queries & mutations; apps/integrations extending the admin | `--query "create product" --api-name admin` | `admin` / `storefront` / `customer` / `partner` / `payments` |
| Custom data | Metafields & metaobjects definitions/schemas extending products, customers, etc. | `--query "metaobject definition" --api-name admin` | `custom-data` |
| Functions | Discount, cart/checkout validation, cart transform, delivery & payment customization, order routing location rule, fulfillment constraints, pickup/local delivery option generators | `--query "product discount function" --api-name functions` | `functions` |
| Storefronts | Hydrogen recipes (B2B, bundles, combined listings, custom cart method, metaobjects, markets, subscriptions, infinite scroll, GTM, Partytown, third-party caching) and Storefront GraphQL cart operations | `--query "cart lines add" --api-name hydrogen` | `hydrogen` / `storefront` |
| Themes | Liquid sections, blocks, snippets, and theme schemas | `--query "section schema settings" --api-name liquid` | `theme` |
| Admin & extension UI | Polaris App Home embedded admin UI, plus Admin, Checkout, Customer Account, and POS UI extensions (scaffold via CLI) | `--query "checkout ui extension targets"` | `polaris` / `admin-extension` / `checkout-extension` / `customer-account-extension` / `pos-ui` |
| Onboarding | Developer setup (scaffold app/theme/project, create a dev store, set up a Partner account) and merchant setup (start selling, try before an account, `shopify store create preview`) | `--query "scaffold app dev store"` | `onboarding` |
| CLI operations | Validate config on disk (`shopify.app.toml`, `shopify.extension.toml`); run store workflows (`shopify store auth`/`execute`); store-scoped reads/writes by handle/SKU/location on a named myshopify.com domain | `--query "app configuration toml"` | `config` |
| Commerce (UCP) | UCP CLI: find/compare/buy/track products, `ucp profile init`, `ucp doctor`, carts, checkout, orders, merchant-hosted handoff fallback | `--query "ucp checkout order"` | `ucp` |
| App Store review | Pre-submission compliance check of an app's codebase; surface likely review issues before submitting | `--query "app store review requirements"` | `app-store-review` |

For a bare docs question that fits no family, answer straight from `shopify doc search` / `shopify doc fetch` results.

### 3) Validate the outcome last — mandatory, non-skippable

Validation is always required, but *what* you validate depends on the outcome you produced. Identify which outcome it is, then apply the matching rule. In both cases use the topic that matches the surface you worked on (for example `shopify validate functions`, `shopify validate theme`, `shopify validate config`); the topics in the table are illustrative — run `shopify validate --help` for the current list.

**Outcome A — a chat reply containing an example (nothing written to disk).**
The example you show the user must be a *complete, fully valid* artifact — never a fragment and never placeholder syntax:

- No elisions or placeholders: no `...`, `// rest here`, `<your-value>`, `YOUR_TOKEN`, `TODO`, or omitted required fields. Every id, import, field, and closing brace is real and present.
- It must stand alone: the user could copy it verbatim and it would parse and run as-is.
- Prove it before sending. Write the example to a temporary file, run the appropriate `shopify validate [topic]` against that file, resolve anything it reports, then delete the temp file. Do not present an example you have not validated this way.

**Outcome B — a change on the filesystem (files created or modified).**
Validate *every* file you touched, each with the validation appropriate to that file's surface:

- Run `shopify validate [topic]` for every surface your change spans — if you touched a Function and a theme file, validate both `functions` and `theme`. Validating one and stopping is not enough.
- Do not validate only the "main" file while skipping the config, manifest, or generated files the same change modified.

For either outcome:

- Read everything validation reports, **resolve every finding**, and re-run until it passes clean.
- Do not present the task as finished while validation reports outstanding issues. An unresolved finding means the task is not done.
- Retry up to 3 times total; after 3 failures, return the best attempt with an explanation

## Gotchas

- Both brackets are required. Skipping the doc search is the most common failure — do it first, every time, even for questions that look trivial. Validation is not "best effort"; the task is complete only when `shopify validate [topic]` is clean.
- Don't guess command names or flags. The command surface changes between versions — `shopify commands` lists what exists and `<command> --help` documents its flags. Confirm there before running, especially for `shopify validate`.
- A code example in a chat reply is an outcome too. A snippet with `...` or placeholder values is not "done" — write it to a temp file and validate it exactly like a committed file before you show it.
- `--api-name` narrows recall; if results look thin or miss the point, drop the flag and search across all APIs.
- `shopify doc search` returns ranked chunks, not a full page. When a chunk points at a page you need in full, follow up with `shopify doc fetch --url`.
- Match the API version between search and output; mixing versions produces subtly wrong fields.
- "Polaris" alone means **App Home** (the embedded admin app UI); treat it as an extension only when the task names Admin, Checkout, Customer Account, or POS.
- Developer onboarding (scaffold app/theme/project, create a dev store, Partner account) is not merchant onboarding (start selling online, first store, `shopify store create preview`) — search for the one the user actually means.
- App Store review is read-only analysis of the codebase — report likely blockers; do not silently rewrite the app.
- Store-scoped CLI reads/writes (`shopify store auth`/`execute`, reads/writes by handle/SKU/location on a named myshopify.com domain) act on real store data — confirm the target domain before running them.

## Examples

- "Write an Admin mutation to create a metafield definition." → `shopify doc search --query "metafield definition create mutation" --api-name admin`, write the mutation, then `shopify validate admin` and resolve any findings.
- "Add a discount Function." → `shopify doc search --query "product discount function" --api-name functions`, implement `run` against the retrieved input query, then `shopify validate functions`.
- "Fetch orders in the customer account." → `shopify doc search --query "customer account api orders"` (no `--api-name` unless you confirm a valid one), build the query, then `shopify validate customer`.
- "Scaffold a checkout UI extension." → search checkout extension targets, generate via the CLI, implement the target, then `shopify validate checkout-extension`.
- "Help me start selling on Shopify." → merchant onboarding: search `--query "start selling create preview store"` (no `--api-name`), guide the preview/first store setup, then validate the store setup.
- "Is my app ready to submit to the App Store?" → search app store review requirements, inspect the codebase, then `shopify validate app-store-review`.
- "Buy this product with UCP." → search `--query "ucp checkout"`, run the flow, then `shopify validate ucp`.
