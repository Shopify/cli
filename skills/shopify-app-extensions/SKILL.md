---
name: shopify-app-extensions
description: "Mental models and gotchas for building Shopify app extensions across admin, checkout, POS, and customer account surfaces"
metadata:
  author: shopify
  version: "1.0"
---

# Shopify App Extensions

## The #1 Mistake: This Is NOT React DOM

Extensions render in an **isolated sandbox** via Remote DOM. There is no `document`, no `window`, no CSS, no arbitrary HTML. You cannot use `<div>`, `<span>`, `<iframe>`, or `<script>` tags.

**What you write** looks like JSX (Preact by default), but **what renders** are Shopify web components (`<s-button>`, `<s-banner>`, `<s-stack>`, etc.). These components inherit merchant brand settings. You cannot override or inject CSS.

```tsx
// WRONG - agents generate this constantly
import React from 'react';
export default function MyExtension() {
  return <div className="my-class"><button onClick={handleClick}>Click</button></div>;
}

// RIGHT - Shopify UI components only
import { AdminAction, Button, Text } from '@shopify/ui-extensions-react/admin';
export default function MyExtension() {
  return (
    <AdminAction title="My Action">
      <Text>Hello</Text>
      <Button onPress={handlePress}>Click</Button>
    </AdminAction>
  );
}
```

Key corrections:
- `onClick` -> `onPress` (Shopify component API)
- No `className`, no `style` props
- No HTML elements — only Shopify components from `@shopify/ui-extensions-react/{surface}`
- Preact is the default scaffolding, not React. The React-like API is a compatibility layer.

## Extension Surfaces — Decision Guide

| Surface | Use When | Target Prefix |
|---------|----------|---------------|
| **Admin** | CRUD workflows, resource management, merchant tools | `admin.` |
| **Checkout** | Cart modifications, upsells, custom fields, payment logic | `purchase.checkout.` |
| **Customer Accounts** | Post-purchase, order management, account self-service | `customer-account.` |
| **POS** | In-store workflows, receipt customization | `pos.` |
| **Online Store** | Theme app extensions (different model — Liquid blocks, not JS sandbox) | N/A (app blocks) |

Admin sub-types:
- **Admin Action**: Modal triggered from resource pages (orders, products, customers). Use for transactional workflows.
- **Admin Block**: Persistent card on resource pages. Use for contextual info display.
- **Admin Print Action**: Document generation with preview/print APIs.

> Full target catalog: https://shopify.dev/docs/api/admin-extensions
> Checkout targets: https://shopify.dev/docs/api/checkout-ui-extensions

## Hard Limits & Gotchas

### Bundle Size: 64KB Compressed
The compiled extension bundle must be under **64KB compressed**. The CLI generates `.metafile.json` (esbuild) to help analyze what's eating your budget. Heavy libraries will blow this limit instantly.

### All Extensions Deploy Together
`shopify app deploy` creates a single app version containing ALL extensions. You cannot deploy one extension independently. Removing an extension from the codebase does NOT auto-remove it from the app — explicit removal is required.

### Extension-Only Apps Use Custom Distribution Only
Apps with no web server (extension-only) cannot be listed on the Shopify App Store. They must use custom distribution (direct install links).

### Some Extensions Require Review
Certain extension types require Shopify review before release. You cannot deploy an app version containing reviewable extensions until approved.

### No Direct Network Access in Some Surfaces
Checkout extensions cannot make arbitrary fetch calls. Use the `fetch` API provided by the extension API, which is proxied and restricted.

## Configuration: shopify.extension.toml

Every extension has a `shopify.extension.toml` in its directory. This defines the extension type, targets, metafields access, and capabilities.

```toml
# Example: extensions/my-action/shopify.extension.toml
api_version = "2025-01"
[[targeting]]
  module = "./src/ActionExtension.tsx"
  target = "admin.product-details.action.render"
```

> Per-type TOML schemas: https://shopify.dev/docs/apps/build/app-extensions

## CLI Workflow

```bash
# Scaffold a new extension (interactive — picks type and surface)
shopify app generate extension

# Start dev server with hot reload
shopify app dev

# Deploy all extensions as a new app version
shopify app deploy
```

The CLI knows about these extension types (from source `specifications/`):
`ui_extension`, `checkout_ui_extension`, `checkout_post_purchase`, `pos_ui_extension`, `function`, `theme`, `web_pixel_extension`, `flow_action`, `flow_trigger`, `flow_template`, `payments_app_extension`, `product_subscription`, `tax_calculation`, `editor_extension_collection`

## Documentation Pointers

- Extensions overview: https://shopify.dev/docs/apps/build/app-extensions
- Admin extensions: https://shopify.dev/docs/apps/build/admin
- Admin components API: https://shopify.dev/docs/api/admin-extensions/components
- Checkout extensions: https://shopify.dev/docs/api/checkout-ui-extensions
- Functions (backend logic): https://shopify.dev/docs/apps/build/functions
- Extension TOML config: https://shopify.dev/docs/apps/build/app-extensions/configuration
