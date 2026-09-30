# `payments_extension`

Payments has one TOML `type` and a target-discriminated union. Its single `targeting` entry selects the schema branch.

## Shared current schema

Every branch has these fields:

```text
PaymentBase := Base & {
  name?: string
  type?: "payments_extension"
  handle?: Handle
  uid?: UID
  api_version: string

  payment_session_url: URL
  refund_session_url?: URL
  capture_session_url?: URL
  void_session_url?: URL
  supported_countries: string[]
  supported_payment_methods: string[]
  test_mode_available: boolean
  merchant_label: string(max 50)

  input?: {
    metafield_identifiers?: { namespace: string, key: string }
  }

  buyer_label?: string(max 50)
  buyer_label_translations?: Array<{ locale: string, label: string }>
  supported_buyer_contexts?: Array<{
    currency: string
    countries?: nonempty string[]
  }>
}
```

Combine `PaymentBase` with exactly one branch below. Every `supported_buyer_contexts` entry must use the same form: currency only, or currency with countries. Mixing the forms is invalid.

### Offsite

```text
PaymentBase & {
  targeting: [{ target: "payments.offsite.render" }]
  supports_installments?: boolean
  supports_deferred_payments?: boolean
  confirmation_callback_url?: URL
  supports_3ds?: boolean
  multiple_capture?: boolean
  supports_oversell_protection?: boolean
}
```

Invariants:

- `supports_installments === supports_deferred_payments`;
- `supports_oversell_protection: true` requires `confirmation_callback_url`.

### Credit card

```text
PaymentBase & {
  refund_session_url: URL
  capture_session_url: URL
  void_session_url: URL
  targeting: [{ target: "payments.credit-card.render" }]
  supports_installments?: boolean
  supports_deferred_payments?: boolean
  confirmation_callback_url?: URL
  supports_3ds: boolean
  multiple_capture?: boolean
  verification_session_url?: URL
  ui_extension_handle?: string
  supports_moto: boolean
  encryption_certificate_fingerprint: string
  checkout_payment_method_fields?: PaymentField[0..7]
}
```

`supports_3ds: true` requires `confirmation_callback_url`; installment and deferred flags must match.

### Custom credit card

```text
PaymentBase & {
  refund_session_url: URL
  capture_session_url: URL
  void_session_url: URL
  targeting: [{ target: "payments.custom-credit-card.render" }]
  confirmation_callback_url?: URL
  supports_3ds: boolean
  multiple_capture: boolean
  checkout_hosted_fields?: string[]
  ui_extension_handle?: string
  encryption_certificate_fingerprint: string
  checkout_payment_method_fields?: PaymentField[0..7]
}
```

### Custom onsite

```text
PaymentBase & {
  targeting: [{ target: "payments.custom-onsite.render" }]
  supports_installments?: boolean
  supports_deferred_payments?: boolean
  confirmation_callback_url?: URL
  supports_3ds?: boolean
  update_payment_session_url?: URL
  multiple_capture?: boolean
  supports_oversell_protection?: boolean
  modal_payment_method_fields?: object[]
  ui_extension_handle?: string
  start_verification_session_url?: URL
  checkout_payment_method_fields?: PaymentField[0..7]
}
```

Installment and deferred flags must match.

### Redeemable

```text
PaymentBase & {
  targeting: [{ target: "payments.redeemable.render" }]
  balance_url: URL
  ui_extension_handle?: string
  checkout_payment_method_fields?: PaymentField[]
}
```

The deploy transform derives `redeemable_type = "gift_card"` only when the first supported payment method is `gift-card`.

### Card present

```text
PaymentBase & {
  refund_session_url: URL
  capture_session_url: URL
  void_session_url: URL
  targeting: [{ target: "payments.card-present.render" }]
  sync_terminal_transaction_result_url?: URL
}
```

```text
PaymentField := {
  type: "string" | "number" | "boolean"
  required: boolean
  key: string
}
```

## TOML-to-wire transformations

These deployment transforms are not TOML schema versions:

- `payment_session_url` → `start_payment_session_url`
- `refund_session_url` → `start_refund_session_url`
- `capture_session_url` → `start_capture_session_url`
- `void_session_url` → `start_void_session_url`
- `buyer_label` → `default_buyer_label`
- `buyer_label_translations` → `buyer_label_to_locale`
- `verification_session_url` → `start_verification_session_url` (credit card)
- The CLI can resolve `ui_extension_handle` from or to a remote registration UUID.

A schema migration must not replace local field names with wire names.

## Structural versions

### P0 — initial offsite schema (2023-12-13)

This was the first local union branch. It used a payment target field before the common `targeting` notation stabilized.

### P1 — target-discriminated family (2024-01-16 to 2024-01-23)

- 2024-01-16: adopted `targeting = [{target = ...}]`.
- 2024-01-18/19: added credit card, custom onsite, custom credit card, and redeemable branches.
- 2024-01-23: extracted common base fields.

P1 is the first useful canonical baseline for every current payment type.

### P2 — UI extension linkage (2024-02-07 to 2024-04-11)

This version introduced `ui_extension_handle`. The CLI removed the earlier `ui_extension_uuid` form on 2024-04-09 and standardized serialization on handles on 2024-04-11.

### P3 — field limits and buyer contexts (2024-04-29 to 2024-06-21)

- `checkout_payment_method_fields` capped at seven for credit-card, custom-credit-card, and custom-onsite branches.
- `supported_buyer_contexts` added on 2024-05-09.
- strict object keys and the no-mixed-context-forms invariant added on 2024-06-21.

### P4 — buyer labels and MOTO (2024-09-12 to 2024-12-05)

- buyer-label translations added to custom credit card (the shared mixin now supports applicable branches);
- Credit card added `supports_moto`; current local Zod requires it.

### P5 — card present (2025-05-08)

Added the sixth branch, `payments.card-present.render`.

### P6 — verification URL and handle validation (2025-09 to 2025-10)

- stronger `ui_extension_handle` validation through the runtime specification;
- custom onsite added `start_verification_session_url` on 2025-10-07;
- Generated templates removed card-present `sync_terminal_transaction_result_url` on 2025-09-23, and a branch removed it on 2025-10-23. The checked-out local schema still marks it optional because of branch history. Snapshot the release branch contract when building fixtures.

### P7 — capability fields optional (2026-07-22)

Several boolean capability fields became optional in local schemas for compatibility. Public docs may still describe them as required platform configuration.

## Cross-source differences

- Public docs require `ui_extension_handle` and checkout field definitions for UI-rendered payment methods. Local Zod marks them optional.
- Public docs list `supports_3ds`, `supports_installments`, and `supports_deferred_payments` as required common properties. Local Zod varies requiredness by branch.
- Templates added fields later than the local schemas and often omitted buyer labels, contexts, callback URLs, and UI fields.
- Public docs no longer list card-present in the target table. The CLI and template repository still contain it.

## E2E fixtures

Cover:

- one minimal and one full fixture for each target
- branch fields paired with the wrong target
- zero and two targets
- seven and eight payment fields
- both buyer-context forms and an invalid mixed form
- 3DS without a callback
- oversell protection without a callback
- mismatched installment flags
- legacy UUID linkage
- card-present callbacks before and after removal

## Sources

- `packages/app/src/cli/models/extensions/specifications/payments_app_extension.ts`
- `packages/app/src/cli/models/extensions/specifications/payments_app_extension_schemas/`
- [Payments configuration](https://shopify.dev/docs/apps/build/payments/configuration)
- `payments-app-extension-*` templates
