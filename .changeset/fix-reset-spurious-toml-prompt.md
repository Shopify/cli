---
'@shopify/app': patch
---

Fix `--reset` flag regression: skip spurious TOML file selection prompt before the link flow

When running `shopify app dev --reset`, `getAppConfigurationState()` was called unconditionally before checking `forceRelink`. If the cached config file didn't exist on disk, this would prompt the user to select a TOML file — only to immediately discard the result when `link()` runs. This was a regression from #6612 which merged the `forceRelink` and `!isLinked` branches back together, undoing the fix from #5676.

The fix separates the two paths again: when `forceRelink` is true, we call `link()` directly without loading config state first.
