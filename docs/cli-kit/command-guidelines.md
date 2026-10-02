# Command guidelines

Use [Designing for CLI](../cli/designing-for-cli.md) to choose the command's outcome and flow. These guidelines cover its public syntax and help. Check the [reserved command and flag names](../cli/naming-conventions.md) before you add a name.

## General command structure

Commands move from a broad domain to a specific action:

| CLI | Topic | Command | Subcommand | Flag and value |
| --- | --- | --- | --- | --- |
| `shopify` | `app` | `deploy` | | |
| `shopify` | `app` | `generate` | `extension` | |
| `shopify` | `theme` | `dev` | | `--live-reload full-page` |

If a verb applies to more than one object, put the verb before the object: `shopify app generate extension`. Here, `extension` is a subcommand, not a positional argument. Add further subcommands only when they are necessary for clarity. Separate command words with spaces, not hyphens.

A global installation is available across projects. A local installation belongs to one project or directory. For a project-local installation, use that project's package-manager invocation. For example, a project with a local Shopify CLI can use:

```sh
npm exec -- shopify app generate extension
```

The command hierarchy stays the same when the CLI is installed globally:

```sh
shopify app generate extension
```

### Topics

Create a topic only when you add an entirely new domain to the CLI. Get maintainer input before you add one. Domain topics include `app` and `theme`. Hydrogen commands are supplied by a separate plugin; see the [architecture guide](../cli/architecture.md).

Commands that apply across domains do not need a domain topic. Examples include `shopify help`, `shopify version`, and `shopify upgrade`.

## Flags

Use flags, rather than positional arguments, to modify command behavior. Named flags make the choice explicit, do not depend on argument order, and are easier to extend without ambiguity.

A flag must mean the same thing within a topic and across the main CLI package. It can have a pre-set value. Prefer clarity over brevity, especially in scripts and CI environments where a descriptive name documents the developer's intent.

For example, these names explain both choices:

```sh
shopify theme dev --theme-editor-sync --live-reload full-page
```

Do not shorten them to `--sync` and `--reload`: those names remove context. They are not supported alternatives for this command.

### Aliases / shortcuts for flags

Use a full name with two hyphens, such as `--store`. As a general rule, do not add a short alias. Add a single-letter alias only for a flag used frequently or repeatedly in daily interactive development.

Short aliases use one hyphen and can omit context already supplied by the topic. Preserve the reserved meanings of common aliases, such as `-s` for `--store`, and existing topic-specific aliases, such as `-t` for `--theme` in theme commands.

### Booleans

For a boolean with a supported negated form, `--OPTION` enables the behavior and `--no-OPTION` disables it. In general, make the enabled behavior the default when it is safe and useful for most developers. Do not apply this rule to safety controls or other documented opt-in modes. For example, `shopify theme dev --allow-live` must remain an explicit choice.

Preserve each existing command's documented defaults and supported flag forms. Do not assume that every boolean automatically supports a `--no-` form.

### Options

A flag can accept specific values, called options. Accept a space or an equals sign between a flag and its value:

```sh
shopify theme dev --live-reload full-page
shopify theme dev --live-reload=full-page
```

For new multi-word option values, use hyphens by default and accept underscore aliases where appropriate. Define and document those aliases explicitly. Existing commands' accepted-value contracts remain authoritative: do not assume an underscore spelling works for every existing option.

Use a space between the flag and value in documentation. If the value contains spaces, use an equals sign and quote the value so the shell passes it as one value.

## Help

Give every command, flag, and accepted option a description in command help. For a command, write a sentence fragment in the third-person singular, as if it starts with "This command...". For example, describe `shopify app generate extension` as "Generates a new app extension."

Explain what the command does, not its internal implementation. Keep help, accepted values, and examples consistent with the command definition. Follow the [JSON output contracts](../cli/json-output.md) for result schema documentation.
