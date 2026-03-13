# @shopify/mcp

MCP server for the Shopify Admin API. Connects AI coding agents (Claude, Cursor, etc.) to your Shopify store via the [Model Context Protocol](https://modelcontextprotocol.io).

## Setup

```bash
claude mcp add shopify -- npx -y -p @shopify/mcp
```

Optionally set a default store so you don't have to pass it with every request:

```bash
export SHOPIFY_FLAG_STORE=my-store.myshopify.com
```

## Tools

### `shopify_auth_login`

Authenticate with a Shopify store. Returns a URL the user must visit to complete login via device auth. After approval, subsequent `shopify_graphql` calls will use the session automatically.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `store` | string | No | Store domain. Defaults to `SHOPIFY_FLAG_STORE` env var. |

### `shopify_graphql`

Execute a GraphQL query or mutation against the Shopify Admin API. Uses the latest supported API version.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | GraphQL query or mutation string |
| `variables` | object | No | GraphQL variables |
| `store` | string | No | Store domain override. Defaults to `SHOPIFY_FLAG_STORE` env var. |
| `allowMutations` | boolean | No | Must be `true` to execute mutations. Safety measure to prevent unintended changes. |

## Example

```
Agent: "List my products"

→ shopify_auth_login(store: "my-store.myshopify.com")
← "Open this URL to authenticate: https://accounts.shopify.com/activate?user_code=ABCD-EFGH"

[user approves in browser]

→ shopify_graphql(query: "{ products(first: 5) { edges { node { title } } } }")
← { "products": { "edges": [{ "node": { "title": "T-Shirt" } }, ...] } }
```
