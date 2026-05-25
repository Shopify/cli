## 2025-05-15 - Remove filesystem mocks in execute-command-helpers.test.ts

**Gap**: Tests for `prepareExecuteContext` were using `vi.mock('@shopify/cli-kit/node/fs')` to mock `readFile` and `fileExists`, which only verifies that the functions were called with expected arguments rather than verifying the actual behavior of reading and validating GraphQL query files.

**Learning**: Using `inTemporaryDirectory` and `writeFile` from `@shopify/cli-kit/node/fs` allows for more robust testing of logic that depends on the filesystem. It also prevents "false pass" scenarios where the mock might not perfectly reflect real filesystem behavior (e.g., handling of empty files or whitespace).

**Action**: Refactored `packages/app/src/cli/utilities/execute-command-helpers.test.ts` to remove the global `fs` mock and use real temporary directories.
