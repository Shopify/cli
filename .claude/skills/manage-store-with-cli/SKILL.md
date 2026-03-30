---
name: manage-store-with-cli
description: 'Help a merchant use Shopify CLI to manage an existing Shopify store through the Admin API. Use when users say things like "I want to add products", "update inventory", "change prices", "tag products", "clean up sample products", "bulk edit my store", or ask how to use Shopify CLI with their store. Use `shopify store auth` first, then `shopify store execute`; do not use `shopify app execute`.'
---

# Manage Store With CLI

## Principle

Start from the merchant task, not from GraphQL.

Treat auth as setup, not the main event. Keep it brief unless the user asks for auth details.

Use `shopify ...` commands.

Internal demo assumption: use `/tmp/shopify-store-client-secret.txt` as the standard client secret file path, but do not call attention to it unless the user asks or troubleshooting requires it.

Translate the merchant request into a small Admin API operation, then follow this exact CLI flow:

1. `shopify store auth`
2. `shopify store execute` with a safe shop query
3. `shopify store execute --allow-mutations` for the task-specific write

For this merchant-store workflow, do not switch to `shopify app execute`.

Use this flow when the user already has a Shopify store and wants Admin API access through Shopify CLI without needing a local app project.

## Typical asks

- "I want to add products to my store"
- "Can I update inventory with CLI?"
- "I need to change prices"
- "How do I tag products?"
- "I want to clean up sample products"
- "How do I use Shopify CLI with my store?"

## Failures this skill prevents

Without this skill, agents tend to:

- skip app authentication and jump straight to `shopify store execute`
- start with GraphQL details instead of the merchant goal
- give a mutation before verifying store access
- forget `--allow-mutations` for write operations

## Required flow

For merchant store-management requests, give commands in this order:

1. Confirm the merchant goal.
2. Collect the two user-specific inputs before giving commands:
   - store domain
   - minimum required scopes

3. Run this exact auth step:

   ```bash
   shopify store auth \
     --store example.myshopify.com \
     --scopes read_products,write_products \
     --client-secret-file /tmp/shopify-store-client-secret.txt
   ```

4. Verify access with a safe read-only `shopify store execute` query.
5. Only then give the task-specific `shopify store execute` command.
6. Add `--allow-mutations` if the task writes data.
7. If auth is missing, expired, or underscoped, send the user back to step 3.

## Pattern

1. Restate the merchant task in plain language, then map it to an Admin API action.
2. Confirm they already have a store and staff access.
3. Ensure Shopify CLI is available.
4. Before giving commands, collect:
   - the store domain
   - the minimum scopes needed for the task
5. Treat `shopify store auth` as the normal first command unless you already know the store has valid app auth for the needed scopes.
6. Run `shopify store auth` using the standard demo secret path `/tmp/shopify-store-client-secret.txt`, without separately explaining that path unless needed.
7. Verify access with `query { shop { name id } }` using `shopify store execute`.
8. Mention auth in at most one short sentence, and only if it helps the user follow the steps.
9. Give the smallest task-specific command.

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

### Verify the local CLI repo command works

```bash
shopify version
```

### Authenticate the app against the store

```bash
shopify store auth \
  --store example.myshopify.com \
  --scopes read_products,write_products \
  --client-secret-file /tmp/shopify-store-client-secret.txt
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

Default behavior: do not volunteer auth details unless the user asks or the auth step is the only thing blocking progress.

If you need one sentence, use this:

> First run `shopify store auth`, then use `shopify store execute` for the actual store command.

Only add more if needed:

- if auth is missing or expired, re-run `shopify store auth`

## Guardrails

- Mirror the user's language first, then translate it into an API operation.
- Do not start with GraphQL jargon unless the user is already speaking in GraphQL terms.
- Before giving commands, collect the store domain and required scopes.
- Default to `shopify store auth` before `shopify store execute` unless valid store auth is already established for the needed scopes.
- If `shopify store execute` would fail because auth is missing, expired, or underscoped, tell the user to re-run `shopify store auth` with the right scopes.
- Keep auth commentary minimal. Do not explain OAuth, tokens, client IDs, client secrets, or callback URLs unless the user asks or troubleshooting requires it.
- Use `/tmp/shopify-store-client-secret.txt` as the standard demo secret path.
- Do not call attention to the client secret file path outside the command itself unless troubleshooting requires it.
- For this workflow, do not use `shopify app execute`.
- Always present the commands as an explicit sequence: auth, verify, then task command.
- Start with the safe shop query before giving a mutation.
- Add `--allow-mutations` for any write operation.
- Use `--mock` only for demos, not as a real store operation.

## Success

The user leaves with:

1. Shopify CLI available in their terminal
2. one successful read-only Admin API call against their store
3. one task-specific command they can run next
4. a clear sense that Shopify CLI can help with their store task without requiring an app project
