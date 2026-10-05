# Testing strategy

**Non-tested code has no space in this project.**
There's a lot of literature around why testing is necessary for software projects.
Still, we'd like to call out why we consider it essential in the context of the CLI:

- **Ensure the code does what's expected:** This is perhaps the most obvious one, but it allows automating those checks through CI automation.
- **Ship code with confidence:** Contributors can feel more confident because they manifest as failing CI builds when they introduce regressions.
- **Detect breaking changes:** Tests help surface breaking changes, so we don't need humans to spot them. As the project gets more significant and a public interface to users, detecting those becomes a challenge for humans.

In the following sections, we'll talk about the testing strategy we embrace in this project. Note it's not the goal of this page to instruct you on how to write good tests. However, we'll provide some best practices that we recommend following.

## Unit tests ✅

Code that represents a business logic unit must be unit-tested, for example, services or utilities.
The test files have the same name as the file they are writing the tests for but with the `.test.ts` extension.
We use [Vitest](https://vitest.dev/) as a test framework, including the test runner, APIs, and mocking tools.

```ts
// app.test.ts
import { describe, test, expect } from "vitest"
import {load} from "./app"

test("loads the app", async () => {
  // Given/When
  const got = await load()

  // Then
  expect(app.name).toEqual("my-app")
})
```

- `pnpm test`: run the Vitest suite.
- `pnpm exec vitest`: run Vitest in watch mode.
- `pnpm test:e2e`: run the Playwright end-to-end suite.

To run one unit test, pass its file path:

```
pnpm test path/to/my.test.ts
```

### Test the behavior that can fail

A regression test must fail when the bug is present. Use input that reproduces the bug. Check the result that matters to the user or caller.

- Run the code path affected by the change. Mocks must not replace the behavior the test needs to check.
- Keep tests that check command parsing and how commands call services.
- For encoded data, use an independent expected value when a shared encoder could hide a bug.
- Check that secrets or unwanted actions are absent when that is part of the requirement.

If a test must wait for async work, use a readiness or completion signal. Clean up tasks, listeners, and temporary resources after the test. Use a short, bounded delay only when no signal is available.

Confirm that the test fails when the fix is removed or the faulty behavior is restored. Use checks that fit the risk of the change. No mutation-testing framework or complete test matrix is required.

See [JSON output tests](json-output.md#test-a-new-command) and [UI tests](../cli-kit/ui-kit/contributing.md#testing-components).

### Filesystem I/O and temporary directories

For filesystem tests, use real files in a temporary directory. The test must delete the directory after use, including when it fails:

```ts
import {file, path} from "@shopify/cli-kit"

test("writes", async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
    // Given
    const outputPath = path.join(tmpDir, "output")

    // When
    await file.write(outputPath, "content")

    // Then
    const exists = await file.exists(outputPath)
    expect(exists).toBe(true)
  })
})
```

> :bulb: **Given/When/Then**
>
> We recommend grouping the test steps following [Gherkin](https://cucumber.io/docs/gherkin/reference/)'s blocks, given, when, and using code comments. That makes the code test easier to parse visually.

> :exclamation: **Tests and promises**
>
> Await the async operation that your assertion depends on. Otherwise, the assertion can run before the operation completes.

For Vitest problems, see [our troubleshooting page](troubleshooting.md) or the [Vitest issues](https://github.com/vitest-dev/vitest/issues).

### Resources
- [Vitest API](https://vitest.dev/api/)
- [Examples](https://vitest.dev/guide/#examples)

## E2E tests

End-to-end tests live under `packages/e2e` and are implemented using [Playwright](https://playwright.dev/). They test full user journeys by invoking the CLI and verifying outputs. Run them with `pnpm test:e2e`.

## GitHub Actions

Use [the PR workflow](../../.github/workflows/tests-pr.yml) and [CLI pre-submit CI guide](../../.agents/skills/cli-pre-submit-ci/SKILL.md) to choose local checks and generated files. Follow the check requirements of the active automation task.

Repository settings determine which checks block a merge. A passing job proves only what that job checked. Jobs with `continue-on-error` can fail without failing the workflow.
