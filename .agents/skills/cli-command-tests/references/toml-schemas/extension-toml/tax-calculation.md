# `tax_calculation`

## Current full locally visible schema

```text
TaxCalculation := Base & {
  name?: string
  type?: "tax_calculation"
  handle?: Handle
  uid?: UID
  api_version?: string
  production_api_base_url: string
  benchmark_api_base_url?: string
  calculate_taxes_api_endpoint: string
  input?: {
    metafield_identifiers?: {
      namespace: string
      key: string
    }
  }
  metafields?: Array<{ namespace: string, key: string }>
  cart_line_properties?: Array<{ key: string }>
}
```

## Structural versions

- **TX0 — prototype (2023-02-04):** standalone endpoint configuration.
- **TX1 — metafields (2023-03-31):** added root `[[metafields]]`.
- **TX2 — API version (2023-08-03):** added `api_version`.
- **TX3 — input metafield identifier (2023-10-06):** added `[input.metafield_identifiers]`.
- **TX4 — marketplace fields (2024-04-19):** historical schema added `is_marketplace`, `use_shopify_tax`, and `marketplace_registrations`. The current local schema and template omit them. Preserve fixtures to check whether the runtime contract still accepts them.
- **TX5 — UID (2024-05-21):** generated template gained UID.
- **TX6 — cart line properties (2026-02-10):** added repeated cart-line property keys.

The template later returned to a deliberately small standalone envelope.

## E2E fixtures

Cover:

- TX0
- every additive version
- TX4 against a fetched contract
- unified and standalone envelopes
- missing and empty endpoint strings
- multiple metafields
- multiple cart line property keys

## Sources

- `packages/app/src/cli/models/extensions/specifications/tax_calculation.ts`
- `tax-calculation/shopify.extension.toml.liquid`
