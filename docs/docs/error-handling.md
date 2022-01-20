---
id: error-handling
title: Error handling
slug: /errors-handling
---

Errors **can happen and will happen** and thus we need must design our code to handle them gracefully and present users with clear and actionable error messages.
Cryptic errors that expose internals of the CLI frustrate developers and increase the support toil.
To help with that,
`@shopify/cli-core` provides a set of errors that should be used according to the principles in the following sections.

### Raise an `AbortError` or `BugError` to terminate the execution

If you come across an scenario that needs aborting,
first explore if it's possible to change the execution path to avoid ending in that scenario.
If that's not possible, determine whether the scenario is a **bug** or an **abort**.
Bugs are errors that will get reported to the error tracking platform and the team will be notified about them.
Aborts don't get reported.

**Never** exit the execution by using the `process` APIs.

```ts
import { BugError } from "@shopify/cli-core"

export function authenticate() {
  // We found an abort scenario
  throw new BugError("We couldn't access the macOS Keychain to store your credentials.")
}
```

### Write clear and actionable errors

Errors that are not clear nor actionable are useless for users.
We developers usually optimize for the happy path and treat other scenarios as an after-thought,
which in many cases, ends up with users receiving a stacktraces or messages with internals of the CLI that are not relevant to users.
For example, the name of the class that represents the error internally.
Put yourself in the shoes of a user,
and think about the message you'd expect.
Also think about what steps you'd expect the CLI to tell you to try to fix or workaround the issue.
Then craft the error, and make sure we have [tests](/testing-strategy) in place to ensure there are no future regressions in that scenario.

### Don't catch `AbortError` and `BugError` errors

Those errors are designed to bubble up and reach the CLI's root where the error handler will output them to the user following a conventional formatting and report them to the error tracking platform.
If you have the need to raise errors that you expect the caller to catch,
for example a function that does an API call and would like the caller to implement retry logic in case of network errors,
define errors create a new error class that extends `Error` and add it at the top of the file where the error is being raised.

```ts
// api-client.ts

class ApiError extends Error {}

class ApiClient {
  function get() {
    throw ApiError(/** HTTP response metadata **/)
  }
}
```
