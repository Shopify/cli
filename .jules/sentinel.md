# Sentinel Learnings

## Command Injection in Windows `taskkill`
**Vulnerability:** Use of `child_process.exec` with user-controlled (or improperly validated) input for `taskkill` on Windows allowed potential command injection.
**Learning:** `child_process.exec` spawns a shell, making it susceptible to shell injection. `Number.isNaN()` does not perform type coercion on strings, so `Number.isNaN("abc")` is `false`, failing as a numeric validator.
**Prevention:** Always use `child_process.spawn` with an arguments array to avoid shell interpretation. Use strict regex like `/^\d+$/` for numeric validation of strings. Always handle the `'error'` event on `spawn` to prevent process crashes.
