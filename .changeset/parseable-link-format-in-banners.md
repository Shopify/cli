---
'@shopify/cli-kit': patch
---

Inside `Banner` / `Alert` / `FatalError`, plain-string children that contain CommonMark `[label](url)` or `<url>` markdown now render the URL via the existing `<Link>` component — clickable on OSC 8-capable terminals and footnoted outside the bordered box on terminals without hyperlink support, so the URL no longer wraps against `│` border characters and stays copy-paste safe. Bare URLs in plain prose are left untouched, so error messages that legitimately echo a user-supplied URL (e.g. tunnel-URL validation) are not turned into clickable escapes.
