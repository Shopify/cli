# Error handling principles for the CLI

* These follow from the [General Principles](https://vault.shopify.io/teams/734/pages/Error-Handling-Principles~zEv1.md) document.

## Global type and handler for fatal errors

You’ll see in the section below that the CLI currently makes an exception to some of the general principles presented in this doc. This may not be true forever since there are some upcoming projects that will change the tradeoffs.

### Leverage the `FatalError` hierarchy to short circuit the program and present a custom UX to the user

The CLI defines `FatalError` and several subtypes of `FatalError`. Within the CLI codebase, you can raise any of these errors at any time to **fully halt the program and present a specific UX to the user**.

**Principle**: choose the right error type if you need to abort the program and handle the situation in a specific way:

* Use `AbortError` for expected scenarios requiring user action
* Use `BugError` for programmer errors and invariant violations
* Use `AbortSilentError` for user-initiated cancellations
* Use `ExternalError` when external commands fail

#### AbortError

Represents expected user/environment issues that require user action

**Characteristics:**

* Most common error type in the CLI
* Provides UI guidance to users
* Reported as "expected\_error" to analytics (it’s a user problem, not a Shopify one)
* Sent to Bugsnag as "handled"

#### BugError

Represents unexpected issues that indicate CLI bugs

**Characteristics:**

* Always reported as "unexpected\_error" and sent to Bugsnag as "unhandled"
* Shows stack trace in development
* Should be used for invariant violations and programmer errors

#### AbortSilentError

Silent termination without any output

**Characteristics:**

* Used when user cancels operations (e.g., declining migrations)
* No message rendered to user
* Clean exit without error indicators

#### ExternalError

Errors from external command execution

**Characteristics:**

* Extends AbortError with command context
* Shows which external command failed
* Helps users understand issues with dependencies

### Divergence from general principles {#divergence-from-general-principles}

The CLI currently makes an exception to a few principles, notably:

- Model errors as part of your API at the same abstraction level
- Don’t use exceptions for control flow; model expected states explicitly

The CLI codebase generally assumes that all code is executing in context of a user’s terminal, and grants an affordance to any code in the repo where that code can immediately abort execution of the entire program and render a specific UI to the user. This is handled via `FatalError` and its descendents.

An example from the app loader (where the CLI loads the user’s app from their file system)

```
async function getConfigurationPath(appDirectory: string, configName: string | undefined) {
  const configurationFileName = getAppConfigurationFileName(configName)
  const configurationPath = joinPath(appDirectory, configurationFileName)

  if (await fileExists(configurationPath)) {
    return {configurationPath, configurationFileName}
  } else {
    throw new AbortError(outputContent`Couldn't find ${configurationFileName} in ${outputToken.path(appDirectory)}.`)
  }
}
```

Our general principles might lead us to code that looks like this, raising a domain-specific error and punting the handling of that to callers.

```
async function getConfigurationPath(appDirectory: string, configName: string | undefined) {
  const configurationFileName = getAppConfigurationFileName(configName)
  const configurationPath = joinPath(appDirectory, configurationFileName)

  if (await fileExists(configurationPath)) {
    return {configurationPath, configurationFileName}
  } else {
    throw new FileNotFoundError(configurationFileName, outputToken.path(appDirectory))
  }
}
```

Given the CLI’s existing architecture, there are some benefits to this approach.

| Solution | Pros | Cons |
| :---- | :---- | :---- |
| `FatalError` | Can rely on a central, global handler for FatalError (and children), providing consistent UX and handling for any kind of user-visible error. Very easy UX management \- raise FatalError subtype, define UI, and it works. | Assumes the user will be able to understand and take action against an error at the current level of abstraction (i.e. that the user will understand how to action a “file not found” error). This is often a safe assumption with the CLI. All CLI services become coupled to the UI layer, making portability and testability more difficult. |
| Domain-specific errors | Services code is not coupled to UI layer, which means code is more portable/testable. For service errors where the user may not be able to take action, allows delegation of handling to a higher level of abstraction where the user may be able to act more easily. | Requires more intention for handlers of domain specific errors, which could lead to UX fragmentation or inconsistent application of handling principles. |

Historically we have been able to make the assumption that everything running in the CLI repo is also running in context of a CLI in a user’s terminal. And since the CLI architecturally is a fairly simple app (commands \> services with a file system for state management), the case for `FatalError` has been strong and even though it violates the general principles, it has been the right approach for the CLI.

### In the future…

It’s very likely that much of the code running in the CLI will need to be made more portable to different operating environments, many of which will not be running inside of a shell on a user’s machine. See [App Dev SDK and Agentic App Dev Architecture](https://docs.google.com/document/u/0/d/142iy_NKDWlTpxvuUTtIreyMd2SIAazYiXNY52VQYsiE/edit)for more information.

The `FatalError` pattern will not work well in an architecture where app development activities are happening in multiple operating environments. The pros listed above will cease to be strong pros, and the cons will rear their heads. When pursuing the SDK project, we’ll likely need to address this.

However, until then, we get a lot of leverage in the CLI from `FatalError`, so it can continue to exist as a high leverage counter-example to some of our general principles.

## Environmental Issue Detection

The CLI has a unique pattern for classifying non-fatal errors as environment issues through `shouldReportErrorAsUnexpected` and `errorMessageImpliesEnvironmentIssue`.

### Environment Issues Are Expected Errors

Certain error messages indicate environment problems rather than CLI bugs. Since the CLI operates in a highly volatile environment and has many dependencies (on local software like git, on the file system, etc), it’s very easy for code to fail due to some environmental or dependency issue on the user’s machine.

**Principles:**

- If it’s an Error, treat as unexpected *unless* errorMessageImpliesEnvironmentIssue returns true.
- Rather than write extensive defensive code to catch all user system issues, we rely on a global backstop to classify environmental issues.

The global handler has a function called `errorMessageImpliesEnvironmentIssue` which looks at a `environmentIssueMessages` constant to determine whether a particular failure is related to an environment issue on the user’s machine. We qualify these errors at the global backstop instead of defensively in each area of the codebase (arguably this is another violation of the general principles that works in the CLI, with much the same tradeoffs [discussed above](#divergence-from-general-principles)).

```
const environmentIssueMessages = [
  'EPERM: operation not permitted, scandir',
  'EPERM: operation not permitted, rename',
  'EACCES: permission denied',
  'EPERM: operation not permitted, symlink',
  'This version of npm supports the following node versions',
  'EBUSY: resource busy or locked',
  'ENOTEMPTY: directory not empty',
  'getaddrinfo ENOTFOUND',
  'Client network socket disconnected before secure TLS connection was established',
  'spawn EPERM',
  'socket hang up',
]
```

#### When to Add to `errorMessageImpliesEnvironmentIssue`:

Examples:

* File System Permission Issues: Errors indicating the user lacks permissions
* Network Connectivity Issues: DNS failures, socket errors, connection timeouts
* Resource Contention: File locks, busy resources
* External Tool Version Mismatches: npm/node version incompatibilities
* Platform-Specific Issues: OS-level restrictions

**Principle:** Be conservative when adding to this list.

* Add only messages that are highly generic, cross-cutting, and clearly attributable to the user environment or transient OS/network—not to CLI logic.
* Ensure the string is stable across Node versions/platforms; avoid brittle substrings that drift.
* Prefer minimal, precise substrings that reduce false positives (e.g., include errno phrase and relevant operation).
* Consider platform variance (Windows vs POSIX errors) and add both where appropriate.
* Avoid domain-specific strings tied to Shopify APIs or business logic; those should be handled where they occur.
* When adding, include a short rationale and links to incident/bug reports validating the classification.
* Reassess entries that generate false negatives/positives using telemetry; prune aggressively if noisy.
