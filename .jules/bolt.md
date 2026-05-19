## 2026-05-19 - Memoize platformAndArch and optimize platform detection
**Learning:** Utility functions like `platformAndArch` that are called frequently with default arguments (`process.platform`, `process.arch`) can be memoized to avoid redundant logic. Additionally, simple string operations like `startsWith` are more efficient than regex matches for basic prefix checks.
**Action:** Implement memoization in `platformAndArch` for default arguments and replace `platform.match(/^win.+/)` with `platform.startsWith('win')`.
