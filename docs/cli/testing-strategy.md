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
import { describe, it, expect } from "vitest"
import {load} from "./app"

it("loads the app", async () => {
  // Given/When
  const got = await load()

  // Then
  expect(app.name).toEqual("my-app")
})
```

Tests can be run with `yarn test` or `yarn test:watch` for the entire workspace or individual packages. `test:watch` keeps the process alive and runs tests as files are changed. If you want to run a single test, pass the path to the file as argument:

```
yarn test path/to/my.test.ts
```

### Filesystem I/O and temporary directories
If the subject under testing does a filesystem I/O operation, we recommend not stubbing that behavior instead of hitting the filesystem. Create a temporary directory whose lifecycle is tied to the lifecycle of the test:

```ts
import {file, path} from "@shopify/cli-kit"

it("writes", async () => {
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

## Acceptance tests 🥒

[Acceptance tests](https://en.wikipedia.org/wiki/Acceptance_testing) play an essential role in ensuring all the small pieces fit together to create user experiences.
They are defined as user stories which are a set of steps a user would take and the expectations they'd have while navigating through those steps.

```feature
Scenario: I create a new app with Yarn
  Given I have a working directory
  When I create an app named MyApp with yarn as dependency manager
  Then I have an app named MyApp with yarn as dependency manager
```
Acceptance tests live under `packages/features` and implemented using [Cucumber](https://cucumber.io/). We create a working directory for every test that isolates the test from the rest. Moreover, the CLIs are invoked, configuring them to store global states in those temporary directories. That way, we prevent the global state from leaking into other tests and making them fail.

Each `.feature` file under `features/` group of scenarios has something in common (e.g. all scenarios related to app development). Steps are declared in Typescript files under `steps`. All the files in that directory or sub-directories are automatically loaded. We recommend keeping parity between those files and the features to quickly locate the steps.

### How to implement an acceptance test

1. Describe the scenario in a `.feature` file. Create a new one if you can't find a feature file your scenario fits into.
2. Implement the steps of your scenario.
3. Run the scenario with `FEATURE=path/to/scenario.feature:line yarn test`.

**Note** that we don't need to test all the user scenarios. Unlike unit tests, acceptance tests are slow. Focus on the user journeys that are most common and prefer larger but fewer scenarios over smaller but more.

> :bulb: Try to make them as generic as possible by using regular expressions when defining steps. That way, your steps can easily be reused by other scenarios.

> :bulb: If your scenario relies on a global state, for example, storing a file in the user's environment, adjust the implementation to control the state's location from the acceptance tests. This is extremely important to prevent flakiness.

## Github Actions
Before being able to marge a PR, it must pass all CI checks executed in Github Actions.

The jobs will detect what packages have changed in that PR and execute the tests only for those.
If you want to execute all the tests for all the packages you can manually schedule a workflow through `Actions -> shopify-cli -> Run workflow`

There you can choose the branch and a custom command to send to `nx`, by default the command is `affected` which means only affected packages will be run. You can use `run-many --all` to run all packages instead.
