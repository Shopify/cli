# Shopify CLI Authentication

Shopify CLI authenticates developers with Shopify through a device-code OAuth flow. This works in local terminals, remote development environments, and agent-driven workflows where a browser might not be available to the CLI process.

## Recommended Flow

1. Check whether a session is already available with `shopify auth status` or `shopify auth status --json`.
2. If a session is available, continue with the command that needs authentication.
3. If no session is available, run `shopify auth login`.
4. Shopify CLI prints a verification URL and user code, or opens the verification URL in your browser.
5. The user completes login in the browser.
6. Complete the CLI flow:
   - In an interactive terminal, keep the command running. It polls and continues automatically after authentication succeeds.
   - In a non-TTY environment, run `shopify auth login --resume` after the user authorizes.

Agents should show the verification URL and user code to the user, ask the user to complete authentication in the browser, and then either wait for the interactive command to finish or run `shopify auth login --resume` for a non-TTY login.

## Commands

- `shopify auth status`: Check whether Shopify CLI has a usable Shopify account session. Use `--json` for stable machine-readable output.
- `shopify auth login`: Log in to a Shopify account. In a non-TTY environment, this starts the device-code flow, prints the verification URL and code, stashes the device code, and exits without waiting.
- `shopify auth login --resume`: Resume a pending non-TTY login after the user has authorized in the browser. On success, Shopify CLI exchanges the stashed device code for tokens and stores the session.
- `shopify auth login --new`: Start a new login instead of reusing or choosing from existing sessions.
- `shopify auth logout`: Clear the stored Shopify CLI session.
- Commands that need authentication may start the same login flow automatically when no usable session exists in an interactive terminal.

## Non-TTY Behavior

When `shopify auth login` runs without a TTY:

1. Shopify CLI checks for an existing usable session.
2. If a session exists, Shopify CLI prints the current account and exits without starting a new login.
3. If no session exists, Shopify CLI starts device authorization, prints the verification URL and user code, stores the pending device code, and exits immediately.
4. After the user authorizes in the browser, run `shopify auth login --resume`.

Use `shopify auth login --new` to skip the existing-session check and start a new device authorization flow.

## CI

Do not start browser-based login from CI. Use credentials provided through the supported environment variables for the command you are running.

## Scopes

Shopify CLI requests the scopes needed for CLI workflows, including access to Shopify Admin, Partners, Storefront Renderer, Business Platform, and App Management APIs. Individual commands may request additional scopes for the task being performed.

## Support

For issues with Shopify CLI authentication, see https://shopify.dev/docs/api/shopify-cli or contact Shopify support at https://help.shopify.com.
