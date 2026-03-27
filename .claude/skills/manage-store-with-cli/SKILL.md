---
name: manage-store-with-cli
description: 'Help a merchant use Shopify CLI to manage an existing Shopify store through the Admin API. Use when users say things like "I want to add products", "update inventory", "change prices", "tag products", "clean up sample products", "bulk edit my store", or ask how to use Shopify CLI with their store. CRITICAL: before writing any Shopify API call other than the auth command itself, use Shopify Dev MCP to learn about the relevant APIs; do not write Shopify API calls from memory when Dev MCP is available. Then use `pnpm run shopify store auth` first, then `pnpm run shopify store execute`; do not use `pnpm run shopify app execute`.'
---

# Manage Store With CLI

## Principle

Start from the merchant task, not from GraphQL.

Use Shopify Dev MCP to learn about Shopify APIs before writing any Shopify API call after auth when it is available. Do not rely on memory for Shopify API details if MCP is available.

Treat auth as setup, not the main event. Keep it brief unless the user asks for auth details.

Assume the demo app auth setup is already in place for the store.

Use `pnpm run shopify ...` commands.

Internal demo assumption: use `/tmp/shopify-store-client-secret.txt` as the standard client secret file path, but do not call attention to it unless the user asks or troubleshooting requires it.

Translate the merchant request into a small Admin API operation, then follow this exact CLI flow:

1. `pnpm run shopify store auth`
2. `pnpm run shopify store execute` with a safe shop query
3. `pnpm run shopify store execute --allow-mutations` for the task-specific write

For this merchant-store workflow, do not switch to `pnpm run shopify app execute`.

Use this flow when the user already has a Shopify store and wants Admin API access through Shopify CLI without needing to build a local app project in the current repo.

## Required flow

For merchant store-management requests, give commands in this order:

1. Confirm the merchant goal.
2. Before writing any Shopify API call after auth, use Shopify Dev MCP when available to learn about the relevant APIs and follow its guidance.
3. Collect the two user-specific inputs before giving commands:
   - store domain
   - minimum required scopes

4. Run this exact auth step:

   ```bash
   pnpm run shopify store auth \
     --store example.myshopify.com \
     --scopes read_products,write_products \
     --client-secret-file /tmp/shopify-store-client-secret.txt
   ```

5. Verify access with a safe read-only `pnpm run shopify store execute` query.
6. Only then give the task-specific `pnpm run shopify store execute` command.
7. Add `--allow-mutations` if the task writes data.
8. If auth is missing, expired, or underscoped, send the user back to step 4.

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
pnpm run shopify version
```

### Authenticate the app against the store

```bash
pnpm run shopify store auth \
  --store example.myshopify.com \
  --scopes read_products,write_products \
  --client-secret-file /tmp/shopify-store-client-secret.txt
```

### Safe verification query

```bash
pnpm run shopify store execute \
  --store example.myshopify.com \
  --query 'query { shop { name id } }'
```

### Small write example

```bash
pnpm run shopify store execute \
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

pnpm run shopify store execute \
  --store example.myshopify.com \
  --query-file /tmp/products.graphql \
  --variables '{"first": 5}'
```

## Guardrails

- Mirror the user's language first, then translate it into an API operation.
- Do not start with GraphQL jargon unless the user is already speaking in GraphQL terms.
- Before writing any Shopify API call after auth, use Shopify Dev MCP when available and follow its rules for learning about the relevant APIs.
- Do not write Shopify API calls from memory when Dev MCP is available, even for simple product or order reads.
- Still give explicit `pnpm run shopify ...` commands in the final answer for this branch, even if Dev MCP was used to design the API call.
- Before giving commands, collect the store domain and required scopes.
- Default to `pnpm run shopify store auth` before `pnpm run shopify store execute` unless valid store auth is already established for the needed scopes.
- If `pnpm run shopify store execute` would fail because auth is missing, expired, or underscoped, tell the user to re-run `pnpm run shopify store auth` with the right scopes.
- Keep auth commentary minimal. Do not explain OAuth, tokens, client IDs, client secrets, or callback URLs unless the user asks or troubleshooting requires it.
- Use `/tmp/shopify-store-client-secret.txt` as the standard demo secret path.
- Do not call attention to the client secret file path outside the command itself unless troubleshooting requires it.
- For this workflow, do not use `pnpm run shopify app execute`.
- Always present the commands as an explicit sequence: auth, verify, then task command.
- Start with the safe shop query before giving a mutation.
- Add `--allow-mutations` for any write operation.
- Use `--mock` only for demos, not as a real store operation.

