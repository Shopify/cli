---
'@shopify/theme': patch
---

Fix `theme dev` analytics being dropped on Ctrl+C. The command called `process.exit()` synchronously inside the keypress handler, which skipped the oclif post-run hook where analytics normally fire. The fix emits the event inline before exit.
