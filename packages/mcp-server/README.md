# @shopify/mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets AI assistants interact with the [Shopify CLI](https://shopify.dev/docs/api/shopify-cli). Works with any MCP client — Claude Code, Claude Desktop, Cursor, Windsurf, and others.

The server wraps the `shopify` CLI binary as a subprocess. It doesn't depend on CLI internals, so it works with any installed version of Shopify CLI.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.10
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) installed and available on your `PATH`:

```sh
npm install -g @shopify/cli
shopify version
```

## Setup

### Claude Code

```sh
claude mcp add shopify-cli -- npx @shopify/mcp-server
```

To set a default store:

```sh
claude mcp add shopify-cli -e SHOPIFY_FLAG_STORE=my-store.myshopify.com -- npx @shopify/mcp-server
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shopify-cli": {
      "command": "npx",
      "args": ["@shopify/mcp-server"],
      "env": {
        "SHOPIFY_FLAG_STORE": "my-store.myshopify.com"
      }
    }
  }
}
```

### Cursor / Windsurf / Other MCP Clients

Add to your MCP configuration (exact location varies by client):

```json
{
  "mcpServers": {
    "shopify-cli": {
      "command": "npx",
      "args": ["@shopify/mcp-server"]
    }
  }
}
```

## Tools

The server exposes three tools:

### `shopify_cli_run`

Run any Shopify CLI command.

```
shopify_cli_run({ command: "theme list --json" })
shopify_cli_run({ command: "theme push --force --json" })
shopify_cli_run({ command: "app deploy --force" })
```

The server automatically:

- Appends `--no-color` to all commands
- Injects store, auth token, and path from environment config
- Detects authentication errors and suggests using `shopify_auth_login`
- Auto-detects and pretty-prints JSON output

### `shopify_cli_help`

Get help for any CLI command. Returns the CLI's own help text plus tips for non-interactive usage.

```
shopify_cli_help({})                          # All top-level commands
shopify_cli_help({ command: "theme" })        # All theme subcommands
shopify_cli_help({ command: "theme push" })   # Flags for theme push
shopify_cli_help({ command: "app deploy" })   # Flags for app deploy
```

### `shopify_auth_login`

Log in to your Shopify account. Opens a browser for OAuth authentication with a 5-minute timeout.

```
shopify_auth_login({})                                      # Login (uses configured store)
shopify_auth_login({ store: "my-store.myshopify.com" })     # Login to a specific store
```

## Authentication

The Shopify CLI caches OAuth sessions to disk. Once you log in, subsequent commands reuse the cached session automatically — no token management needed.

**First-time setup:** When you (or the AI) run a command before logging in, the server detects the auth error and suggests using the `shopify_auth_login` tool, which opens your browser for OAuth.

**Headless / CI environments:** Set `SHOPIFY_CLI_THEME_TOKEN` to a token from the [Theme Access app](https://shopify.dev/docs/themes/tools/theme-access) or an Admin API token to skip browser-based login entirely.

## Configuration

All configuration is through environment variables. Set them in your MCP client config's `env` block.

| Variable | Description | Default |
|----------|-------------|---------|
| `SHOPIFY_FLAG_STORE` | Default store URL (e.g. `my-store.myshopify.com`) | — |
| `SHOPIFY_CLI_THEME_TOKEN` | Theme Access / Admin API token for headless auth | — |
| `SHOPIFY_FLAG_PATH` | Default project directory | — |
| `SHOPIFY_CLI_PATH` | Path to the `shopify` binary | `shopify` |
| `SHOPIFY_MCP_TIMEOUT` | Command timeout in milliseconds | `120000` |

These are injected as environment variables into the CLI subprocess, where the CLI reads them as default values. Flags passed explicitly in a command (e.g. `--store other-store.myshopify.com`) take precedence.

## Examples

**List themes in a store:**
> "Show me all the themes in my store"
>
> → `shopify_cli_run({ command: "theme list --json" })`

**Push theme changes:**
> "Push my local theme changes"
>
> → `shopify_cli_run({ command: "theme push --force --json" })`

**Check theme quality:**
> "Run theme check on my code"
>
> → `shopify_cli_run({ command: "theme check --output json" })`

**Deploy an app:**
> "Deploy my app to production"
>
> → `shopify_cli_run({ command: "app deploy --force" })`

**Discover available commands:**
> "What app commands are available?"
>
> → `shopify_cli_help({ command: "app" })`

**Log in to a store:**
> "Log in to my-store.myshopify.com"
>
> → `shopify_auth_login({ store: "my-store.myshopify.com" })`

## Development

```sh
# From the monorepo root
pnpm install
cd packages/mcp-server

# Run tests
pnpm vitest run

# Build
pnpm build

# Type-check
pnpm type-check

# Lint
pnpm lint

# Test the server manually
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}},"id":1}' | node bin/mcp-server.js
```

## Security

This MCP server can execute any Shopify CLI command on behalf of the connected AI agent. By installing and configuring it, you trust the MCP client to run CLI commands with your authenticated session.

**What's safe by design:**

- The CLI requires authentication (OAuth or token) — the MCP server cannot bypass this
- `execa` does not use a shell, preventing shell injection
- Long-running commands (`theme dev`, `app dev`) are detected and blocked with a helpful message

**What to be aware of:**

- Destructive commands (`theme delete`, `theme publish`, `app deploy`) can be executed if the agent passes `--force`.
- If using `SHOPIFY_CLI_THEME_TOKEN`, scope the token appropriately (e.g., theme-only access, not full admin).

## License

MIT
