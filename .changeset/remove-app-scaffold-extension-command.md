---
'@shopify/app': major
---

Remove the deprecated `shopify app scaffold extension` command. Use `shopify app generate extension` instead. (The command was already unregistered from the CLI command map but the file remained on disk; this change deletes the orphaned source file.)
