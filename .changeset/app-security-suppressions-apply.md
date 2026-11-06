---
'@shopify/app': minor
'@shopify/cli': minor
---

`app security check` and `app security review` apply the suppressions in `shopify.app-security.json` to deterministic and agent findings. Findings that an entry suppresses don't count for `--blocking`, and `review --json` reports them with `disposition: "suppressed"`, deterministic findings included. An invalid `shopify.app-security.json` stops both commands with the `suppressions-file-invalid` error.
