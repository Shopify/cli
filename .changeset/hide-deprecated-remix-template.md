---
'@shopify/app': patch
---

Hide the deprecated `remix` template from `shopify app init --template` help text and validation messages. The React Router template has replaced Remix as the supported choice. Passing `--template remix` continues to work for backwards compatibility.
