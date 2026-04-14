# Commands
<!-- commands -->
* [`shopify auth login`](#shopify-auth-login)
* [`shopify auth logout`](#shopify-auth-logout)
* [`shopify help [command] [flags]`](#shopify-help-command-flags)
* [`shopify search [query]`](#shopify-search-query)
* [`shopify upgrade`](#shopify-upgrade)
* [`shopify version`](#shopify-version)

## `shopify auth login`

Logs you in to your Shopify account.

```
USAGE
  $ shopify auth login [--alias <value>]

FLAGS
  --alias=<value>  [env: SHOPIFY_FLAG_AUTH_ALIAS] Alias of the session you want to login to.

DESCRIPTION
  Logs you in to your Shopify account.
```

_See code: [dist/commands/auth/login.js](https://github.com/Shopify/cli/blob/v3.92.0/dist/commands/auth/login.js)_

## `shopify auth logout`

Logs you out of the Shopify account or Partner account and store.

```
USAGE
  $ shopify auth logout

DESCRIPTION
  Logs you out of the Shopify account or Partner account and store.
```

_See code: [dist/commands/auth/logout.js](https://github.com/Shopify/cli/blob/v3.92.0/dist/commands/auth/logout.js)_

## `shopify help [command] [flags]`

Display help for Shopify CLI

```
USAGE
  $ shopify help [command] [flags]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  [env: SHOPIFY_FLAG_CLI_NESTED_COMMANDS] Include all nested commands in the output.

DESCRIPTION
  Display help for Shopify CLI
```

_See code: [dist/commands/help.js](https://github.com/Shopify/cli/blob/v3.92.0/dist/commands/help.js)_

## `shopify search [query]`

Starts a search on shopify.dev.

```
USAGE
  $ shopify search [query]

DESCRIPTION
  Starts a search on shopify.dev.

EXAMPLES
  # open the search modal on Shopify.dev
      shopify search
      # search for a term on Shopify.dev
      shopify search <query>
      # search for a phrase on Shopify.dev
      shopify search "<a search query separated by spaces>"
```

_See code: [dist/commands/search.js](https://github.com/Shopify/cli/blob/v3.92.0/dist/commands/search.js)_

## `shopify upgrade`

Shows details on how to upgrade Shopify CLI.

```
USAGE
  $ shopify upgrade

DESCRIPTION
  Shows details on how to upgrade Shopify CLI.

  Shows details on how to upgrade Shopify CLI.
```

_See code: [dist/commands/upgrade.js](https://github.com/Shopify/cli/blob/v3.92.0/dist/commands/upgrade.js)_

## `shopify version`

Shopify CLI version currently installed.

```
USAGE
  $ shopify version

DESCRIPTION
  Shopify CLI version currently installed.
```

_See code: [dist/commands/version.js](https://github.com/Shopify/cli/blob/v3.92.0/dist/commands/version.js)_
<!-- commandsstop -->
