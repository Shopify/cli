# Shopify CLI authentication

Shopify CLI authenticates developers with Shopify through a device-code OAuth flow. This flow is designed to work in terminals, remote development environments, and agent-driven workflows.

## Supported flow

Shopify CLI currently supports user-driven device authentication:

1. Run a command that requires authentication, or run `shopify auth login` directly.
2. Shopify CLI prints a verification URL and user code, or opens the verification URL in your browser.
3. The user completes login in the browser.
4. Keep the CLI process running. It polls for completion and continues automatically after authentication succeeds.

Agents should show the verification URL and user code to the user, ask the user to complete authentication in the browser, and wait for the CLI command to finish.

## Commands

- `shopify auth login`: Start an interactive Shopify account login.
- `shopify auth logout`: Clear the stored Shopify CLI session.
- Commands that need authentication may start the same login flow automatically.

## Non-interactive environments

In CI or fully non-interactive environments, use credentials provided through the supported environment variables for the command you are running. Do not start an interactive browser login from CI.

## Scopes

Shopify CLI requests the scopes needed for CLI workflows, including access to Shopify Admin, Partners, Storefront Renderer, Business Platform, and App Management APIs. Individual commands may request additional scopes for the task being performed.

## Support

For issues with Shopify CLI authentication, see https://shopify.dev/docs/api/shopify-cli or contact Shopify support at https://help.shopify.com.
