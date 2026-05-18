## Sentinel's Journal

## 2026-05-18 - Locale-sensitive header redaction
**Vulnerability:** Redaction of sensitive headers (like AUTHORIZATION) could be bypassed on systems with certain locales (e.g., Turkish) because `toLocaleLowerCase()` is non-deterministic for ASCII characters like 'I' (which becomes 'ı' in Turkish).
**Learning:** Standard string methods like `toLocaleLowerCase()` can introduce security bypasses when used for protocol-level or security-sensitive key matching if the environment's locale differs from the expected ASCII behavior.
**Prevention:** Always use locale-independent methods like `toLowerCase()` (or `toUpperCase()`) for matching keys, headers, or parameters that follow ASCII or fixed-format standards.
