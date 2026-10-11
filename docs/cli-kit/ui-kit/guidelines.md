# Content and UI guidelines

Use consistent content and visual patterns so developers can focus on their work. Use the [CLI UI Kit](./readme.md) for rendering and [Designing for CLI](../../cli/designing-for-cli.md) for command and flow decisions.

## General content guidelines

- Use contractions, such as "can't" instead of "cannot", to sound human.
- Use "we" to refer to Shopify. Make it clear what Shopify does and what the developer controls.
- State what is happening and what the developer can do next. Do not hide consequential decisions behind automatic guesses.

## Use color and emphasis with purpose

Use the default text style for most output. Use the `subdued` token as a gray accent that does not suggest highlighting, such as the row-title column of a table. Reserve color for semantic meaning, such as success, warnings, and errors, or to connect related log entries, such as entries from the same extension.

Use UI Kit's semantic tokens for commands, user input, and other styled text. Use its standard banner types rather than assigning your own colors. The [token system](./readme.md#the-token-system) keeps these meanings consistent without requiring commands to manage a palette.

Output must be completely understandable without color or text decoration. This supports accessibility, `--no-color`, and environments such as CI systems where color, bold, italic, or underline may not be available. Developers can also customize their terminal colors, so do not depend on exact hues. Keep the standard associations of red with errors, yellow with warnings, and green with success.

Do not use emojis: not every terminal and environment can display them. Use the limited set of symbols that `@shopify/cli-kit/node/figures` provides. Keep neutral output quiet. An active indicator, such as UI Kit's animated progress bar, should distinguish running work from completed or failed work.

## Prompting user inputs with selection and text prompts

Use prompts to request information during an interactive session:

| Prompt | Use |
| --- | --- |
| Text entry | A value such as an app name or version name. Offer a default when it helps the developer continue. |
| Single select | A list of choices. Group related choices when that makes the list easier to scan. |
| Confirmation | A yes-or-no choice before the command continues, such as "Release a new version of this app?" |
| Dangerous confirmation | A one-way door, such as irretrievably deleting information. For example, deploying an app version that removes an extension can permanently delete that extension's data. The developer types a confirmation value. Use sparingly. |

A text prompt shows its default as placeholder text in a blank input. The developer presses Tab to insert the default and edit it, presses Enter to accept it, or types another value. Show the choice rather than making an unexplained inference. See the [prompt APIs](./readme.md#prompts) for supported defaults and grouping.

Use one of these forms:

- An explicit question: "Which existing app is this for?" or "Have you installed your app on your dev store?"
- A short question in the context of the flow: "Release a new version of this app?"
- A text or selection prompt with a noun and colon: "App name:"

Anything that can require a prompt must also be specifiable with a flag, so non-interactive runs, such as CI and scripts, can supply it. Follow the [JSON output contracts](../../cli/json-output.md#conventions-and-changesets) for the independent roles of `--json` and `--no-input`.

## Communicating active and completed work

For an active progress indicator, describe the work with an *-ing* form, such as "Template downloading" or "App initializing". Put this text with the indicator so the developer knows what is running.

For completed work shown with dynamic checkmarks, use a noun and past participle: "Dependencies installed", "App initialized", or "App deployed". Do not label an active operation as complete.

Use the [async task APIs](./readme.md#async-tasks) for consistent progress rendering. If work fails part way through, identify what succeeded and what failed, and give a recovery step when one is known.

## Content in banners

Use a banner for information that is usually longer than one line. Choose a success, warning, info, or error banner to match the state. A banner can contain:

- An optional heading that describes the problem or success state.
- Body text with the details the developer needs.
- Optional **Next steps**: a bulleted list of actions, including specific commands where useful.
- Optional **References**: a list of relevant developer resources.

See the [static output APIs](./readme.md#static-output) for banner fields. Keep optional sections out when they add no information.

For info banners, use present perfect tense for a significant change: "The REST API has been deprecated".

For error headings, use present tense: "Can't connect to the Storefront API". If the recovery is known, give explicit next steps. For example, "View the complete error log at `path/to/file`". Use the Next steps section when there are several actions. Follow the [error handling principles](../../cli/error_handling.md) for the error type and recovery data.

## Logs

Logs describe work as it happens. Use present tense for active work, such as "Building GraphQL types…", and past tense for a completed state, such as "order-status successfully built".

Keep neutral events that do not require action in the default text style. Reserve semantic color for errors, warnings, and successes. Stable labels and consistent per-extension colors can connect related entries across a development session. Keep the labels understandable without color.

Make an error in development-session logs easy to scan: use a heading with an error symbol, then a second line with the problem and the developer's next action. A tree marker can connect the two lines. For example:

```text
✖ Error
└ Can't connect to the Storefront API. Check your connection and try again.
```

This is an illustrative layout, not the exact output of a command. For finite machine-readable output, keep diagnostics and progress separate from the final result as specified by the [JSON output contracts](../../cli/json-output.md).
