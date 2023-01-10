# Command guidelines

## General command structure

When the CLI is installed via an app package, then commands are structured like this:

| package manager | CLI (always Shopify) | Topic | Command | Argument | Flags (with or without options) |
| :------------- | :------------- | :------------- | :------------- |:------------- |:------------- |
| yarn | Shopify | app | generate | extension | --type checkout_ui

When the CLI is installed globally, then commands are structured like this:

|CLI (always Shopify) | Topic | Command | Argument | Flags (with or without options) |
| :------------- | :------------- | :------------- | :------------- | :------------- |
| shopify | hydrogen | add | eslint | _no flag_ |

Generic commands that cross domains don't have topics. Examples include help, version, upgrade, and logs:

| package manager | CLI (always Shopify) | Topic | Command | Argument | Flags (with or without options) |
| :------------- | :------------- | :------------- | :------------- | :------------- | :------------- |
| npm run | shopify | _no topic_ | help | extension | _no flag_ |

## Topics

A new topic should only be created when an entirely new domain is being added to the CLI. Today, topics include adds, themes, and hydrogen.

## Flags

Any given flag needs to be consistent not only within a topic, but also across the main CLI package. A flag always means the same thing, and it can be pre-set to a specific value.

Flags should be semantically meaningful. When in doubt, optimize for clarity, not brevity. This is particularly important in non-interactive or CI environments, where a command is likely to be a write-once, run-many situation. Verbose flags are better for self-documention.

| ✅ | Do:  | pnpm add <package> --ignore-workspace-root-check | This flag is long, but it accurately describes the choice the developer is making. |
| :------------- | :------------- | :------------- | :------------- |
|  ❌ | Don't: | rsync --owner | Because it’s unnecessarily terse, it’s ambiguous whether this flag means “preserve the current owner” or “assign ownership”.|

## Aliases / shortcuts for flags

As a general rule, don't create shortcuts for flags. Create single-letter short-form flag aliases only if the flag is frequently or repetitively used in day-to-day interactive development work.

Shortcuts can leave off the topic keyspace of the command.

## Booleans

A boolean flag takes the options of either true ('--OPTION') or false ('--no-OPTION'). In general, make the true option the default.  That is, `--OPTION` should be the same as not passing the flag at all. Ex: '--tunnel' / '--no-tunnel'.

## Options

A flag can accept specific values (called “options”). The CLI should accept either a space or an equals sign:
* generate extension --type checkout_ui
* generate extension --type=checkout_ui

By default, two-word options are formatted with hyphens but should also accept underscores.

## Help

Every command should have a corresponding description in the help directory. The help description should be a sentence fragment in the third-person singular, as if it's a sentence that starts with "This command...' For example: "Adds an extension to your app project" is the description for the command "shopify hydrogen info".

# UI patterns in the CLI

The vast majority of the UI, including CLI plugins, is to be built using our CLI design system. This ensures a familiar-feeling interction patterns and reduces the complexity behind-the-scenes. It also helps our teams work faster and rely on validation rules

Components include:

| Component  | Purpose |
| ------------- | ------------- |
| info banner  | Convey discrete information that's good to know, but not blocking the workflow at hand.  |
| success banner | Confirm that a major action has taken place and (optionally) suggest next steps. |
| error banner | Explain a blocking problem, then give suggestions for fixing it.
| warning banner | Alert the user to something that will likely become a blocking problem if not addressed. |
| external error intro | Frame external error messages from other tools so that the user understands where they're coming from. |
| selection prompt | Prompt the user to select one option from a list. |
| text prompt | Prompt the user to enter text, such as a project name. |
| dynamic checkmarks | Update the user about a set of processes running in the background, so that system processes don't feel like a black box. |
| shimmer bar | Communicate that a longer process — such as cloning a theme — is taking place.


# Content guidelines

## General content guidelines
- Use contractions (ex: can't instead of cannot). It's the easiest way to sound human.
- Use “we” to refer to Shopify. (This "we" framing acts as a trust signal. In the platform context, Shopify and the developer are building value together. We're not slippery; we're not hiding.)

## Prompting user inputs with selection and text prompts:
- A full-sentence question (“Have you installed your app on your dev store?”)
- A text prompt with simple noun followed by a colon (“App name:”)
- A list prompt followed by a colon: (“Select extension type:”)

## Communicating processes with dynamic checkmarks:
- Progress indicators should take this passive voice formula: “Dependencies installed”; “App initialized”; “App deployed”. In other words: 'noun' 'verb' (past participle).

## Content in banners:
- Each of the banner elements can support robust messaging with a next steps section and a reference section with links. The prompt components can also be customized with, for example, headings to group selection options.
- For info banners: Use present perfect tense to describe a significan display  (“The REST API has been deprecated").
- For error messages: Use the present tense to describe what’s happening in the error message context (“Can’t connect to the Storefront API”)
- More examples in the CLI example page. Run <PACKAGEMANAGER> shopify kitchen-sink
