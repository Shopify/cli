---
'@shopify/store': minor
---

Add a `kind` discriminator (`'standard' | 'preview'`) and optional `preview` metadata to stored store auth sessions, plus a recovery dispatcher that surfaces a preview-specific error when a placeholder-owned session can no longer be reached. Internal scaffolding for the upcoming `shopify store create preview` command — no user-visible change yet. Sessions written before this field existed continue to read back as `'standard'`.
