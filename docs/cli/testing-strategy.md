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

Tests can be run with `pnpm test` for the Vitest suite, `pnpm test:watch` for watch mode, or `pnpm test:e2e` for the Playwright end-to-end suite. If you want to run a single unit test, pass the path to the file as argument:

```
pnpm test path/to/my.test.ts
```

### Filesystem I/O and temporary directories
If the subject under testing does a filesystem I/O operation, we recommend not stubbing that behavior instead of hitting the filesystem. Create a temporary directory whose lifecycle is tied to the lifecycle of the test:

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
> If inside your tests you call asynchronous functions and forget to `await` you might end up with false positives. Therefore we recommend that after writing your tests that you always make it fail.

> :exclamation: **Vitest is in beta**
>
> Vitest is still in beta, so you might encounter issues while using it. If you come across any, check out [our troubleshooting page](/contributors/troubleshooting) or the [list of issues](https://github.com/vitest-dev/vitest/issues) on the project's repository.

### Resources
- [Vitest API](https://vitest.dev/api/)
- [Examples](https://vitest.dev/guide/#examples)

## E2E tests

End-to-end tests live under `packages/e2e` and are implemented using [Playwright](https://playwright.dev/). They test full user journeys by invoking the CLI and verifying outputs. Run them with `pnpm test:e2e`.

## Github Actions
Before being able to marge a PR, it must pass all CI checks executed in Github Actions.

The jobs will detect what packages have changed in that PR and execute the tests only for those.
If you want to execute all the tests for all the packages you can manually schedule a workflow through `Actions -> shopify-cli -> Run workflow`

There you can choose the branch and a custom command to send to `nx`, by default the command is `affected` which means only affected packages will be run. You can use `run-many --all` to run all packages instead.
