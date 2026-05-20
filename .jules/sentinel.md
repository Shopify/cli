## 2026-05-20 - Protocol validation in system openers
**Vulnerability:** The `openURL` function allowed any URL protocol to be passed to the system's default opener (via the `open` library). This could allow execution of dangerous protocols like `javascript:` or `data:` if an attacker could influence the URL passed to this function.
**Learning:** System openers often handle a wide variety of protocols beyond `http:` and `https:`. In a CLI context where some URLs might be constructed from external data (e.g., from a CDN or API), it's important to restrict allowed protocols at the trust boundary.
**Prevention:** Implement strict allowlists for URL protocols in functions that trigger external actions like opening a browser or executing a command.
