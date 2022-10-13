# Errors

**Errors can and will happen**, and handling them gracefully is essential to provide a first-class developer experience.

When designing code, you can leverage tools to **minimize the likelihood of errors happening**. For example, you can leverage Typescript to prevent invalid states from entering the system. It requires additional time to figure out how to model the state, but the investment pays off significantly. If an external state enters the system, for example, a project in the file system, **validate it and return early** if the shape is invalid. It is similar to what web servers do with incoming HTTP requests. We also recommend modeling business logic as a combination of pure functions that are predictable. Functions with the freedom to mutate input state might get mutations introduced in the future that breaks the contract with callers of the function.

Moreover, you should think about scenarios other than the happy path and build for them. There are infinite of those, especially considering that the CLI runs in environments we don't control, so it's essential that you focus on the most obvious ones and don't get too obsessed with trying to anticipate every possible error. **Excellent error management is an iterative process** using unhandled errors as input to inform the improvements.

## Aborting the execution using errors

If your logic needs to abort the execution, throw instantiating any of the errors exported by `@shopify/cli-kit`:

```js
import {
  AbortError,
  AbortSilentError,
  BugError,
  BugSilentError
} from "@shopify/cli-kit/node/errors"

throw new AbortError(
  "The project doesn't exist",
  "Make sure the command is executed from a project's directory"
)
```

- **AbortError:** This error is used to terminate the execution of the CLI process and output a message and next steps to the user.
- **BugError:** This error behaves as `AbortError` and it gets reported to the error tracking platform.
- **AbortSilentError** and **BugSilentError:** Are versions of the above errors that don't output anything to the user. This is useful in cases where the thrower of the error wants to control the formatting.

Please, **don't** use the global `process.exit` and `process.abort` APIs.
