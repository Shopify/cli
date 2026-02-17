# Sidekick CLI - Local Testing Setup

This documents how to run the `shopify sidekick` CLI command against a local development environment with full OAuth auth and client-side tool execution.

## Repos & Branches

| Repo | Branch | What it does |
|------|--------|-------------|
| `Shopify/cli` | `ac/sidekick-cli` | CLI sidekick command with Ink UI, MCP tools, client-side tool execution |
| `Shopify/sidekick-server` | `ac/sidekick-cli-oauth` | `SidekickCLI` scenario, `merchant/cli` features, client-side tool definitions |
| `Shopify/identity` | `ac/sidekick-cli-oauth` | Token exchange config allowing CLI to get sidekick-server tokens |

## Step-by-Step Setup

### 1. Identity (OAuth token exchange)

Identity needs to know that `shopify-cli-development` can exchange tokens for `sidekick-server-development`.

```bash
cd ~/src/github.com/Shopify/identity
git checkout ac/sidekick-cli-oauth
dev up && dev s
```

After `dev up` seeds the database, the config changes should take effect. If not (or if the branch can't be pushed due to repo rules), apply manually via Rails console:

```bash
dev console
```

In the console:
1. Add `shopify-cli-development` as an allowed token exchange source for `sidekick-server-development`
2. Ensure `https://api.shopify.com/auth/sidekick.message` is in the `shopify-development` OAuth app's scopes

### 2. Sidekick Server

```bash
cd ~/src/github.com/Shopify/sidekick-server
git checkout ac/sidekick-cli-oauth
dev up && dev s
```

This branch provides:
- **`SidekickCLI` scenario** with `merchant/cli` features
- **Client-side tools**: `execute_shell_command`, `execute_mcp_tool`, `confirm_graphql_mutation`, `execute_admin_graphql_mutation`
- **CLI-specific prompt**: Strips UI-specific instructions (SKL, navigation, forms) and adds CLI-appropriate instructions
- **Identity authorization**: `shopify-cli-development` in the authorized clients list

### 3. Shopify Core (backend services for GraphQL)

```bash
devx rig up apps-platform
```

This provides the admin GraphQL API that sidekick-server calls when executing mutations/queries on behalf of the merchant.

### 4. CLI

```bash
cd ~/src/github.com/Shopify/cli
git checkout ac/sidekick-cli
```

#### Running with OAuth (standard mode)

```bash
export SHOPIFY_SERVICE_ENV=local
export SHOPIFY_CLI_NEVER_USE_PARTNERS_API=1

pnpm shopify sidekick --store <your-store>.my.shop.dev
```

- `SHOPIFY_SERVICE_ENV=local` points identity to local `identity.shop.dev` and sidekick API to `sidekick-server.shop.dev`
- `SHOPIFY_CLI_NEVER_USE_PARTNERS_API=1` prevents the CLI from trying to use Partners API
- First run will trigger the OAuth device auth flow in your browser

#### Running with dev token (bypass OAuth)

If you have a JWT token from sidekick-server's playground or internal tools:

```bash
export SIDEKICK_TOKEN=<your-jwt-token>
export SIDEKICK_API_ENDPOINT=https://sidekick-server.shop.dev

pnpm shopify sidekick "hello"
```

#### CLI Flags

| Flag | Description |
|------|-------------|
| `--store <store>` | Store FQDN (required for OAuth mode) |
| `--format <fmt>` | Output format: `text`, `json`, `csv`, `md` (default: `text`) |
| `--yolo` | Auto-approve all tool operations (no permission prompts) |
| `--path <dir>` | Working directory for file operations (default: cwd) |

#### Modes

- **Interactive** (TTY, no prompt arg): Opens the rich Ink-based terminal UI with chat input
- **One-shot** (prompt arg provided): Sends a single prompt, prints the response, and exits

```bash
# Interactive mode
pnpm shopify sidekick --store mystore.my.shop.dev

# One-shot mode
pnpm shopify sidekick --store mystore.my.shop.dev "list my products"

# One-shot with piped input
echo "some context" | pnpm shopify sidekick --store mystore.my.shop.dev "analyze this"
```

## Architecture Overview

```
CLI (ac/sidekick-cli)
  ├── OAuth flow via ensureAuthenticatedSidekick()
  │     └── Identity token exchange: CLI → Identity → sidekick-server token
  ├── SidekickClient (SSE streaming to sidekick-server)
  │     ├── scenario: 'SidekickCLI'
  │     ├── features: ['merchant/cli']
  │     └── context: buildContext() with tool descriptions + MCP tools XML
  ├── TerminalSession (tool execution)
  │     ├── execute_shell_command → local shell (child_process.exec)
  │     ├── execute_mcp_tool → local MCP servers (filesystem, shopify_dev)
  │     └── confirm_graphql_mutation → permission prompt → server execution
  └── Ink UI (SidekickApp)
        ├── SessionHeader, WelcomeScreen
        ├── ChatInput → UserMessage → StreamingResponse
        ├── ToolCallCard (visual progress for tool calls)
        └── PermissionPrompt (approve/deny tool operations)

Sidekick Server (ac/sidekick-cli-oauth)
  ├── merchant/cli features → loads cli_tools.yaml + cli prompt
  ├── Client tools (forwarded to CLI for execution):
  │     ├── execute_shell_command
  │     ├── execute_mcp_tool
  │     └── confirm_graphql_mutation
  └── Server tools (executed server-side):
        ├── fetch_help_documents
        ├── execute_admin_graphql_query
        ├── execute_admin_graphql_mutation
        └── ...

Identity (ac/sidekick-cli-oauth)
  └── Token exchange: shopify-cli-development → sidekick-server-development
        with scopes: sidekick.message, graphql
```

## Troubleshooting

- **"The --store flag is required"**: You're in OAuth mode (no `SIDEKICK_TOKEN` env var) and didn't pass `--store`
- **401 from sidekick API**: Token exchange not working. Check identity has the CLI in its allowed exchange list
- **"I don't have access to MCP tools"**: The `buildContext()` in terminal.ts may have been modified. Ensure it includes the MCP tools XML block and tool descriptions
- **Tools not showing visual progress**: The `tool_call_start` SSE event must be emitted by the server for the ToolCallCard UI to appear
