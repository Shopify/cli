---
name: manage-store-with-cli
description: 'Help a merchant use Shopify CLI to manage an existing Shopify store through the Admin API. Use when users say things like "I want to add products", "update inventory", "change prices", "tag products", "clean up sample products", "bulk edit my store", or ask how to use Shopify CLI with their store.'
---

# Manage Store With CLI

## Principle

Start from the merchant task, not from GraphQL.

Translate the merchant request into a small Admin API operation, verify store access with a safe query, then give the smallest `shopify store execute` command that solves the task.

Use this flow when the user already has a Shopify store and wants direct Admin API access without creating or linking an app.

## Typical asks

- "I want to add products to my store"
- "Can I update inventory with CLI?"
- "I need to change prices"
- "How do I tag products?"
- "I want to clean up sample products"
- "How do I use Shopify CLI with my store?"

## Failures this skill prevents

Without this skill, agents tend to:

- suggest app-based setup instead of store-scoped CLI usage
- start with GraphQL details instead of the merchant goal
- give a mutation before verifying store access
- forget `--allow-mutations` for write operations

## Pattern

1. Restate the merchant task in plain language, then map it to an Admin API action.
2. Confirm they already have a store and staff access.
3. Ensure Shopify CLI is available.
4. Verify access with `query { shop { name id } }`.
5. Explain auth in one sentence.
6. Give the smallest task-specific command.

If the merchant task is ambiguous, ask one clarifying question before giving commands.

## Decision table

| Merchant request | Likely Admin API action |
|---|---|
| Add products | `productCreate` |
| Change product details | `productUpdate` |
| Delete or archive products | `productDelete` or `productUpdate(status: ARCHIVED)` |
| Update inventory | inventory-related Admin API mutation; clarify location and item |
| Change prices | pricing mutation; clarify scope |
| Add tags | `tagsAdd` or object update |
| List products or orders | read-only query |

## Default commands

### Install Shopify CLI if needed

```bash
npm install -g @shopify/cli
shopify version
```

Optional macOS path:

```bash
brew tap shopify/shopify
brew install shopify-cli
shopify version
```

### Safe verification query

```bash
shopify store execute \
  --store example.myshopify.com \
  --query 'query { shop { name id } }'
```

### Small write example

```bash
shopify store execute \
  --store example.myshopify.com \
  --query 'mutation { productCreate(product: { title: "Sample product", status: DRAFT }) { product { id title status } userErrors { field message } } }' \
  --allow-mutations
```

### File and variables example

```bash
cat >/tmp/products.graphql <<'GRAPHQL'
query Products($first: Int!) {
  products(first: $first) {
    nodes {
      id
      title
      status
    }
  }
}
GRAPHQL

shopify store execute \
  --store example.myshopify.com \
  --query-file /tmp/products.graphql \
  --variables '{"first": 5}'
```

## Auth explanation

Use this sentence first:

> `shopify store execute` authenticates as the logged-in staff user against that store's Admin API.

Only add more if needed:

- it uses store-scoped user auth
- it does not require a linked app
- it is different from `shopify app execute`

## Guardrails

- Mirror the user's language first, then translate it into an API operation.
- Do not start with GraphQL jargon unless the user is already speaking in GraphQL terms.
- Use `shopify store execute`, not `shopify app execute`, when no app is involved.
- Start with the safe shop query before giving a mutation.
- Add `--allow-mutations` for any write operation.
- Use `--mock` only for demos, not as a real store operation.

## Success

The user leaves with:

1. Shopify CLI available in their terminal
2. one successful read-only Admin API call against their store
3. one task-specific command they can run next
4. a clear sense that Shopify CLI can help with their store task without requiring an app project
