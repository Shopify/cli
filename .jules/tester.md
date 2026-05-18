## 2026-05-18 - [Replace FS mocks with real temp dirs in bundle-ui-step.test.ts]
**Gap:** The test was using `vi.mock('@shopify/cli-kit/node/fs')`, which prevents verifying actual filesystem side effects and can lead to implementation-coupled tests.
**Learning:** Functions like `resolvePath` and `dirname` behave differently on real paths compared to mocked strings, especially when dealing with relative segments like `./`. Using real temp dirs caught these nuances.
**Action:** Always prefer `inTemporaryDirectory` and real FS utilities (`mkdir`, `writeFile`, `fileExists`) over global FS mocks.
