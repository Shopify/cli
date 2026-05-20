## 2025-02-12 - Callback false-passes from fs mocks
**Gap:** In `execute-operation.test.ts`, the filesystem was globally mocked via `vi.mock('@shopify/cli-kit/node/fs')`.
**Learning:** Functions that take callbacks (like `inTemporaryDirectory`) are often used to wrap logic that interacts with the disk. If these functions are automocked, Vitest provides a mock that does nothing and returns `undefined`, meaning the callback (which contains the actual test logic) is never executed. This results in "false passes" where the test appears to succeed but verifies nothing.
**Action:** Never mock `@shopify/cli-kit/node/fs` globally. Use real temporary directories and check the physical disk state to verify behavior.
