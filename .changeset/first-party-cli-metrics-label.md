---
'@shopify/cli-kit': patch
---

Add an `is_first_party` label to the CLI command metrics (`cli_commands_total`, `cli_commands_duration_ms`, `cli_commands_wall_clock_elapsed_ms`) so first-party (1P) Shopify developer usage can be distinguished from third-party usage in observability dashboards. The label is keyed off the 1P dev path (`SHOPIFY_CLI_1P_DEV`), the same signal that sets the `X-Shopify-Cli-Employee` header.
