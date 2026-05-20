## 2026-05-20 - False passes from filesystem mocks
**Gap:** Tests using `inTemporaryDirectory` were passing even with failing assertions inside the callback because the filesystem was mocked.
**Learning:** In Vitest, automocking a function that takes a callback (like `inTemporaryDirectory`) often results in the callback never being executed, leading to "false pass" tests that verify nothing.
**Action:** Always prefer real temporary directories over filesystem mocks, especially for functions that manage lifecycle through callbacks.
