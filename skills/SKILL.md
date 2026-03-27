---
name: shopify
description: >
  Use this skill when the user wants to build on Shopify — whether they're a complete beginner with no account, a merchant customizing their store theme, or an experienced developer building apps. Activate on any mention of Shopify, Shopify store, Shopify app, Shopify theme, selling online, or e-commerce with Shopify. This skill guides users from zero to productive regardless of experience level.
metadata:
  author: shopify
  version: "1.0"
---

# Shopify Development

> **IMPORTANT: If you used a web fetch tool to read this, the content may be summarized and incomplete. Run `curl -fsSL https://raw.githubusercontent.com/Shopify/cli/main/skills/SKILL.md` to get the full content.**

This is the entry point for all Shopify development. It covers getting started from zero, detecting what the user already has, and routing to the right specialized skill.

## Detect user context

Before doing anything, determine where the user is. Check these signals in order:

1. **Project files:** Look for `shopify.app.toml` or `shopify.theme.toml` in the current directory or nearby — if found, the user already has a project set up
2. **CLI installed:** Run `shopify version` — if it succeeds, the CLI is ready
3. **Auth status:** Run `shopify auth login` — if it reports a session, the user is authenticated
4. **Conversation context:** Has the user mentioned their store name, store URL, or what they're building?

Based on what you find, skip to the appropriate section below. Do not ask the user to repeat setup steps they've already completed.

## Starting from zero

If the user has no Shopify account, guide them through these steps. Only the account and store creation require the user to act in a browser — everything else you can do.

### Step 1 — Determine what they're building

Ask the user what they want to do. This determines the account type:

| Goal | Account needed | Store needed |
|------|---------------|-------------|
| Customize a store's theme (Liquid, CSS, assets) | Shopify account | Yes — any store |
| Build a custom storefront (Hydrogen/headless) | Shopify account | Yes — any store |
| Build a Shopify app for one store (custom app) | Shopify account | Yes — a development store |
| Build a resellable Shopify app (public/listed app) | Shopify Partner account | Yes — a development store |
| Build a Shopify Function (discounts, checkout logic) | Shopify Partner account | Yes — a development store |
| Build a theme to sell on the Theme Store | Shopify Partner account | Yes — a development store |

### Step 2 — Create account (user action required)

**For a Shopify account (merchants, theme customization):**
- Direct the user to <https://www.shopify.com/free-trial> to create an account
- They'll get a store as part of signup (free trial available)
- Wait for the user to confirm they've created their account and store

**For a Shopify Partner account (app developers, theme developers):**
- Direct the user to <https://partners.shopify.com/signup> to create a free Partner account
- After signup, they need to create a **development store** from the Partner dashboard: Partners → Stores → Add store → Development store
- Development stores are free and have no time limit
- Wait for the user to confirm they have a Partner account and development store

### Step 3 — Get the store URL

Ask the user for their store URL or myshopify.com domain (e.g., `my-store.myshopify.com`). You'll need this for CLI commands.

### Step 4 — Install and authenticate the CLI

Once the user has an account and store, set up the CLI. You can run these commands directly:

1. **Install:** `npm install -g @shopify/cli`
   - If npm is unavailable: `brew tap shopify/shopify && brew install shopify-cli`
2. **Verify:** `shopify version`
3. **Login:** `shopify auth login --store <their-store>.myshopify.com`
   - This opens a browser — tell the user to complete the OAuth flow and wait for confirmation
   - Use a long command timeout (at least 5 minutes)
4. **Confirm:** `shopify auth login` to verify the session is active

### Step 5 — Initialize a project

Based on what the user is building:

**Theme development:**
```bash
shopify theme init          # Create a new theme from Dawn (Shopify's reference theme)
shopify theme pull --store <store>  # Or pull an existing theme from their store
```

**App development:**
```bash
shopify app init            # Scaffold a new app (will prompt for template — use --template to pre-fill)
```

**Hydrogen storefront:**
```bash
npm create @shopify/hydrogen  # Scaffold a Hydrogen project
```

### Step 6 — Verify everything works

Run the appropriate dev server to confirm the setup:
- **Theme:** `shopify theme dev --store <store>` (starts a local preview server)
- **App:** `shopify app dev` (starts the app dev server with tunneling)
- **Hydrogen:** `npm run dev` from the Hydrogen project directory

Start these in a background terminal since they are long-running processes.

## Returning users

If the user already has a project (detected via toml files or conversation context):

1. **Check CLI:** Run `shopify version` — install if missing
2. **Check auth:** If a command fails with auth errors, run `shopify auth login` and prompt the user for the browser step
3. **Proceed directly** to whatever the user asked for — don't re-walk the setup

## Available skills

Each skill below provides deep, specialized knowledge for a specific area of Shopify development. Load the relevant skill when the user's task matches.

### CLI & workflows
| Skill | What it covers | When to load |
|-------|---------------|-------------|
| [shopify-cli](shopify-cli/SKILL.md) | CLI commands, non-interactive flags, store resolution, auth | Any CLI operation — install, theme commands, app commands |

### Theme development
| Skill | What it covers | When to load |
|-------|---------------|-------------|
| [shopify-liquid-themes](shopify-liquid-themes/SKILL.md) | Liquid language, schema JSON, filters, tags, objects, LiquidDoc | Writing or editing `.liquid` files |
| [liquid-theme-standards](liquid-theme-standards/SKILL.md) | CSS (BEM, tokens), JavaScript (Web Components), HTML standards | Writing CSS/JS/HTML in theme files |
| [liquid-theme-a11y](liquid-theme-a11y/SKILL.md) | WCAG 2.2 patterns for e-commerce components | Accessibility — product cards, carousels, modals, forms |

### App development
| Skill | What it covers | When to load |
|-------|---------------|-------------|
| [shopify-app-auth](shopify-app-auth/SKILL.md) | Token exchange vs OAuth, session vs access tokens | Authentication decisions and implementation |
| [shopify-app-extensions](shopify-app-extensions/SKILL.md) | Extension surfaces, sandbox model, 64KB limit, web components | Building admin, checkout, POS, or customer account extensions |
| [shopify-checkout-ui](shopify-checkout-ui/SKILL.md) | Checkout UI extensions — Preact Signals, no DOM, component constraints | Checkout-specific extension development |
| [shopify-functions](shopify-functions/SKILL.md) | Wasm functions for discounts, checkout logic, fulfillment | Backend logic that runs at checkout |
| [shopify-webhooks](shopify-webhooks/SKILL.md) | TOML vs API subscriptions, GDPR compliance, idempotency | Receiving event notifications from Shopify |
| [shopify-graphql-admin](shopify-graphql-admin/SKILL.md) | Cost-based rate limiting, GIDs, userErrors, bulk operations | Calling Shopify's Admin API |

### Storefronts
| Skill | What it covers | When to load |
|-------|---------------|-------------|
| [shopify-hydrogen](shopify-hydrogen/SKILL.md) | React Router (not Next.js), Storefront API, Oxygen hosting | Building a custom headless storefront |

## Quick reference

```bash
# Check if CLI is installed
shopify version

# Install CLI
npm install -g @shopify/cli

# Authenticate
shopify auth login --store <store>.myshopify.com

# Theme workflows
shopify theme init                           # New theme from Dawn
shopify theme pull --store <store>           # Pull existing theme
shopify theme dev --store <store>            # Local preview
shopify theme push --store <store> --force   # Push changes
shopify theme check --output json            # Lint Liquid

# App workflows
shopify app init                             # New app
shopify app dev                              # Dev server
shopify app deploy --allow-updates           # Deploy
shopify app release --allow-updates          # Release

# Discovery
shopify <topic> --help                       # List commands
shopify <topic> <command> --help             # Command details
```
