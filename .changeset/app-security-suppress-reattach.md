---
'@shopify/app': patch
'@shopify/cli': patch
---

`app security check` and `app security review` name the likely finding of a stale suppression after an edit to its code, and `app security review --suppress` re-attaches the entry to it, keeping its kind and reason. A line with a redacted secret gets no likely finding, because redaction hides the only text that tells two credentials apart.
