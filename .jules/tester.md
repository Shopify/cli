## 2025-05-14 - [Gap] Pervasive filesystem mocking in CLI asset services
**Gap:** Critical services like `copyByPattern` relied on global `vi.mock('@shopify/cli-kit/node/fs')`, which masked potential issues with path resolution, boundary checks, and actual disk interaction.
**Learning:** Mocking the filesystem in CLI tools often leads to tests that verify the mock configuration rather than the actual contract. For example, the `assertPathWithinAppDir` security check relies on `fileRealPath`, which behaves differently on real disks vs. mocks.
**Action:** Always prefer `inTemporaryDirectory` with real `mkdir` and `writeFile` for any service that manipulates paths or moves files.
