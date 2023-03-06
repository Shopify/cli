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
