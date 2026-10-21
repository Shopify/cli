---
'@shopify/cli-kit': minor
---

`keypress` accepts a `keys` option: only those keys end the wait, and other keys are ignored. `keypress` now sets raw mode back to its earlier state, and it also detects Ctrl+C when an Ink renderer has set the stdin encoding.
