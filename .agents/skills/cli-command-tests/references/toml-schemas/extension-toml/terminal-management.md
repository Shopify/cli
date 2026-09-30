# `terminal_management`

A runtime contract validates this type. The current template defines:

```text
TerminalManagement := {
  api_version: string
  name: string
  type: "terminal_management"
  terminals_url: URL
  terminal_details_url: URL
  terminal_diagnostic_page_url: URL
  terminal_encryption_settings_url: URL
  location_mappings_url: URL
}
```

The current generated template uses the standalone envelope without a handle or UID.

## Structural versions

- **TM0 — introduced 2025-05-07:** endpoint set for terminal listing, details, diagnostics, encryption settings, and location mappings.
- **TM1 — 2025-06-05:** template history changed endpoint naming/coverage; compare fixtures from commit `1721adc6b5` with TM0.
- **TM2 — 2025-09-23:** current field set and API-version sample.

The CLI gets this schema only from a runtime contract, and the public extension index does not link a terminal-management reference. Capture exact requiredness from the contract fetched by each release.

## E2E fixtures

Cover:

- one fixture from each template commit
- all endpoints present
- each endpoint missing in turn
- a non-URL value
- the standalone envelope
- behavior with an unexpected unified envelope

## Sources

- `terminal-management/shopify.extension.toml.liquid`
- Template commits `284c3041ad`, `1721adc6b5`, and `5eb46acf91`
