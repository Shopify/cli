# Content and UI guidelines

Use consistent content and visual patterns so developers can focus on their work. Use the [CLI UI Kit](./readme.md) for rendering and [Designing for CLI](../../cli/designing-for-cli.md) for command and flow decisions.

## General content guidelines

- Use contractions, such as "can't" instead of "cannot", to sound human.
- Use "we" to refer to Shopify. Make it clear what Shopify does and what the developer controls.
- State what is happening and what the developer can do next. Do not hide consequential decisions behind automatic guesses.

## Use color and emphasis with purpose

Use grayscale text for neutral information. Use brighter foreground text for emphasis. Reserve color for semantic meaning, such as success, warnings, and errors, or to connect related log entries, such as entries from the same extension.

Use UI Kit's semantic tokens for commands, user input, and other styled text. Use its standard banner types rather than assigning your own colors. The [token system](./readme.md#the-token-system) keeps these meanings consistent without requiring commands to manage a palette.

Developers can customize their terminal colors. A terminal mockup can start with a 16-color palette, but do not depend on exact hues. Keep the standard associations of red with errors, yellow with warnings, and green with success. Always communicate the meaning through text as well as color.

Use emojis sparingly to draw attention or clarify meaning, not as decoration. Keep neutral output quiet. An active indicator, such as UI Kit's animated progress bar, should distinguish running work from completed or failed work.

## Prompting user inputs with selection and text prompts

Use prompts to request information during an interactive session:

| Prompt | Use |
| --- | --- |
| Text entry | A value such as an app name or version name. Offer an editable default when it helps the developer continue. |
| Single select | A list of choices. Group related choices when that makes the list easier to scan. |
| Confirmation | A high-risk choice. Use sparingly, such as before deploying an app version that removes an extension. |

An editable default lets the developer press Enter to accept a suggested name or type their own. Show the choice rather than making an unexplained inference. See the [prompt APIs](./readme.md#prompts) for supported defaults and grouping.

Use one of these forms:

- An explicit question: "Which existing app is this for?" or "Have you installed your app on your dev store?"
- A short question in the context of the flow: "Release a new version of this app?"
- A text prompt with a noun and colon: "App name:"
- A selection prompt followed by a colon: "Select extension type:"

Do not require an interactive prompt for automated use. Follow the [JSON output contracts](../../cli/json-output.md#preserve-compatibility) for the independent roles of output format and interactivity.

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

Use grayscale for neutral events that do not require action. Reserve semantic color for errors, warnings, and successes. Stable labels and consistent per-extension colors can connect related entries across a development session. Keep the labels understandable without color.

Make an error in development-session logs easy to scan: use a heading with an error indicator, then a second line with the problem and the developer's next action. A tree marker can connect the two lines. For example:

```text
❌ Error
└ Can't connect to the Storefront API. Check your connection and try again.
```

This is an illustrative layout, not the exact output of a command. For finite machine-readable output, keep diagnostics and progress separate from the final result as specified by the [JSON output contracts](../../cli/json-output.md).
