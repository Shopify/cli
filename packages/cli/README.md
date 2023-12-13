# Commands
<!-- commands -->
* [`shopify app build`](#shopify-app-build)
* [`shopify app config link`](#shopify-app-config-link)
* [`shopify app config push`](#shopify-app-config-push)
* [`shopify app config use [CONFIG]`](#shopify-app-config-use-config)
* [`shopify app deploy`](#shopify-app-deploy)
* [`shopify app dev`](#shopify-app-dev)
* [`shopify app env pull`](#shopify-app-env-pull)
* [`shopify app env show`](#shopify-app-env-show)
* [`shopify app function build`](#shopify-app-function-build)
* [`shopify app function run`](#shopify-app-function-run)
* [`shopify app function schema`](#shopify-app-function-schema)
* [`shopify app function typegen`](#shopify-app-function-typegen)
* [`shopify app generate extension [FILE]`](#shopify-app-generate-extension-file)
* [`shopify app generate schema`](#shopify-app-generate-schema)
* [`shopify app import-flow-legacy-extensions`](#shopify-app-import-flow-legacy-extensions)
* [`shopify app info`](#shopify-app-info)
* [`shopify app release`](#shopify-app-release)
* [`shopify app update-url`](#shopify-app-update-url)
* [`shopify app versions list [FILE]`](#shopify-app-versions-list-file)
* [`shopify auth logout`](#shopify-auth-logout)
* [`shopify commands`](#shopify-commands)
* [`shopify config autocorrect off`](#shopify-config-autocorrect-off)
* [`shopify config autocorrect on`](#shopify-config-autocorrect-on)
* [`shopify config autocorrect status`](#shopify-config-autocorrect-status)
* [`shopify help [COMMANDS]`](#shopify-help-commands)
* [`shopify kitchen-sink async`](#shopify-kitchen-sink-async)
* [`shopify kitchen-sink prompts`](#shopify-kitchen-sink-prompts)
* [`shopify kitchen-sink static`](#shopify-kitchen-sink-static)
* [`shopify plugins:install PLUGIN...`](#shopify-pluginsinstall-plugin)
* [`shopify plugins:inspect PLUGIN...`](#shopify-pluginsinspect-plugin)
* [`shopify plugins:install PLUGIN...`](#shopify-pluginsinstall-plugin-1)
* [`shopify plugins:link PLUGIN`](#shopify-pluginslink-plugin)
* [`shopify plugins:uninstall PLUGIN...`](#shopify-pluginsuninstall-plugin)
* [`shopify plugins:uninstall PLUGIN...`](#shopify-pluginsuninstall-plugin-1)
* [`shopify plugins:uninstall PLUGIN...`](#shopify-pluginsuninstall-plugin-2)
* [`shopify plugins update`](#shopify-plugins-update)
* [`shopify search [QUERY]`](#shopify-search-query)
* [`shopify theme check`](#shopify-theme-check)
* [`shopify theme console`](#shopify-theme-console)
* [`shopify theme delete`](#shopify-theme-delete)
* [`shopify theme dev`](#shopify-theme-dev)
* [`shopify theme info`](#shopify-theme-info)
* [`shopify theme init [NAME]`](#shopify-theme-init-name)
* [`shopify theme language-server`](#shopify-theme-language-server)
* [`shopify theme list`](#shopify-theme-list)
* [`shopify theme open`](#shopify-theme-open)
* [`shopify theme package`](#shopify-theme-package)
* [`shopify theme publish`](#shopify-theme-publish)
* [`shopify theme pull`](#shopify-theme-pull)
* [`shopify theme push`](#shopify-theme-push)
* [`shopify theme share`](#shopify-theme-share)
* [`shopify upgrade`](#shopify-upgrade)
* [`shopify version`](#shopify-version)
* [`shopify webhook trigger`](#shopify-webhook-trigger)

## `shopify app build`

Build the app.

```
USAGE
  $ shopify app build [--no-color] [--verbose] [--path <value>] [--skip-dependencies-installation] [--client-id
    <value> | -c <value>]

FLAGS
  -c, --config=<value>              The name of the app configuration.
  --client-id=<value>               Application's Client ID that will be exposed at build time.
  --no-color                        Disable color output.
  --path=<value>                    [default: .] The path to your app directory.
  --skip-dependencies-installation  Skips the installation of dependencies. Deprecated, use workspaces instead.
  --verbose                         Increase the verbosity of the logs.

DESCRIPTION
  Build the app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/build.js)_

## `shopify app config link`

Fetch your app configuration from the Partner Dashboard.

```
USAGE
  $ shopify app config link [--no-color] [--verbose] [--path <value>] [-c <value>] [--client-id <value>]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --client-id=<value>   The Client ID of your app.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Fetch your app configuration from the Partner Dashboard.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/config/link.js)_

## `shopify app config push`

Push your app configuration to the Partner Dashboard.

```
USAGE
  $ shopify app config push [--no-color] [--verbose] [--path <value>] [-c <value>] [-f]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  -f, --force           Push configuration without asking for confirmation.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Push your app configuration to the Partner Dashboard.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/config/push.js)_

## `shopify app config use [CONFIG]`

Activate an app configuration.

```
USAGE
  $ shopify app config use [CONFIG] [--no-color] [--verbose] [--path <value>] [--reset]

ARGUMENTS
  CONFIG  The name of the app configuration. Can be 'shopify.app.staging.toml' or simply 'staging'.

FLAGS
  --no-color      Disable color output.
  --path=<value>  [default: .] The path to your app directory.
  --reset         Reset current configuration.
  --verbose       Increase the verbosity of the logs.

DESCRIPTION
  Activate an app configuration.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/config/use.js)_

## `shopify app deploy`

Deploy your Shopify app.

```
USAGE
  $ shopify app deploy [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c <value>] [--reset | ]
    [-f] [--no-release] [--message <value>] [--version <value>] [--source-control-url <value>]

FLAGS
  -c, --config=<value>          The name of the app configuration.
  -f, --force                   Deploy without asking for confirmation.
  --client-id=<value>           The Client ID of your app.
  --message=<value>             Optional message that will be associated with this version. This is for internal use
                                only and won't be available externally.
  --no-color                    Disable color output.
  --no-release                  Creates a version but doesn't release it - it's not made available to merchants.
  --path=<value>                [default: .] The path to your app directory.
  --reset                       Reset all your settings.
  --source-control-url=<value>  URL associated with the new app version.
  --verbose                     Increase the verbosity of the logs.
  --version=<value>             Optional version tag that will be associated with this app version. If not provided, an
                                auto-generated identifier will be generated for this app version.

DESCRIPTION
  Deploy your Shopify app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/deploy.js)_

## `shopify app dev`

Run the app.

```
USAGE
  $ shopify app dev [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c <value>] [-s <value>]
    [--reset | ] [--skip-dependencies-installation] [--no-update] [--subscription-product-url <value>]
    [--checkout-cart-url <value>] [--tunnel-url <value> |  | ] [-t <value>] [--theme-app-extension-port <value>]
    [--notify <value>]

FLAGS
  -c, --config=<value>                The name of the app configuration.
  -s, --store=<value>                 Store URL. Must be an existing development or Shopify Plus sandbox store.
  -t, --theme=<value>                 Theme ID or name of the theme app extension host theme.
  --checkout-cart-url=<value>         Resource URL for checkout UI extension. Format:
                                      "/cart/{productVariantID}:{productQuantity}"
  --client-id=<value>                 The Client ID of your app.
  --no-color                          Disable color output.
  --no-update                         Skips the Partners Dashboard URL update step.
  --notify=<value>                    The file path or URL. The file path is to a file that you want updated on idle.
                                      The URL path is where you want a webhook posted to report on file changes.
  --path=<value>                      [default: .] The path to your app directory.
  --reset                             Reset all your settings.
  --skip-dependencies-installation    Skips the installation of dependencies. Deprecated, use workspaces instead.
  --subscription-product-url=<value>  Resource URL for subscription UI extension. Format: "/products/{productId}"
  --theme-app-extension-port=<value>  Local port of the theme app extension development server.
  --tunnel-url=<value>                Use a custom tunnel, it must be running before executing dev. Format:
                                      "https://my-tunnel-url:port".
  --verbose                           Increase the verbosity of the logs.

DESCRIPTION
  Run the app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/dev.js)_

## `shopify app env pull`

Pull app and extensions environment variables.

```
USAGE
  $ shopify app env pull [--no-color] [--verbose] [--path <value>] [-c <value>] [--env-file <value>]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --env-file=<value>    Specify an environment file to update if the update flag is set
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Pull app and extensions environment variables.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/env/pull.js)_

## `shopify app env show`

Display app and extensions environment variables.

```
USAGE
  $ shopify app env show [--no-color] [--verbose] [--path <value>] [-c <value>]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Display app and extensions environment variables.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/env/show.js)_

## `shopify app function build`

Compile a function to wasm.

```
USAGE
  $ shopify app function build [--no-color] [--verbose] [--path <value>] [-c <value>]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your function directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Compile a function to wasm.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/function/build.js)_

## `shopify app function run`

Run a function locally for testing.

```
USAGE
  $ shopify app function run [--no-color] [--verbose] [--path <value>] [-c <value>] [-i <value>] [-e <value>] [-j]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  -e, --export=<value>  [default: _start] Name of the wasm export to invoke.
  -i, --input=<value>   The input JSON to pass to the function. If omitted, standard input is used.
  -j, --json            Log the run result as a JSON object.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your function directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Run a function locally for testing.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/function/run.js)_

## `shopify app function schema`

Fetch the latest GraphQL schema for a function.

```
USAGE
  $ shopify app function schema [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c <value>] [--stdout]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --client-id=<value>   The Client ID to fetch the schema with.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your function directory.
  --stdout              Output the schema to stdout instead of writing to a file.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Fetch the latest GraphQL schema for a function.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/function/schema.js)_

## `shopify app function typegen`

Generate GraphQL types for a JavaScript function.

```
USAGE
  $ shopify app function typegen [--no-color] [--verbose] [--path <value>] [-c <value>]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your function directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Generate GraphQL types for a JavaScript function.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/function/typegen.js)_

## `shopify app generate extension [FILE]`

Scaffold an Extension.

```
USAGE
  $ shopify app generate extension [FILE] [--no-color] [--verbose] [--path <value>] [-t <value>] [-t <value>] [-n <value>]
    [--flavor vanilla-js|react|typescript|typescript-react|wasm|rust] [--reset | -c <value>] [--client-id <value> | ]

FLAGS
  -c, --config=<value>    The name of the app configuration.
  -n, --name=<value>      name of your Extension
  -t, --template=<value>  Extension template
  -t, --type=<value>      Deprecated. Please use --template
  --client-id=<value>     The Client ID of your app.
  --flavor=<option>       Choose a starting template for your extension, where applicable
                          <options: vanilla-js|react|typescript|typescript-react|wasm|rust>
  --no-color              Disable color output.
  --path=<value>          [default: .] The path to your app directory.
  --reset                 Reset all your settings.
  --verbose               Increase the verbosity of the logs.

DESCRIPTION
  Scaffold an Extension.

EXAMPLES
  $ shopify app generate extension
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/generate/extension.js)_

## `shopify app generate schema`

Fetch the latest GraphQL schema for a function.

```
USAGE
  $ shopify app generate schema [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c <value>] [--stdout]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --client-id=<value>   The Client ID to fetch the schema with.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your function directory.
  --stdout              Output the schema to stdout instead of writing to a file.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Fetch the latest GraphQL schema for a function.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/generate/schema.js)_

## `shopify app import-flow-legacy-extensions`

Import dashboard-managed flow extensions into your app.

```
USAGE
  $ shopify app import-flow-legacy-extensions [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c
  <value>]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --client-id=<value>   The Client ID of your app.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  Import dashboard-managed flow extensions into your app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/import-flow-legacy-extensions.js)_

## `shopify app info`

Print basic information about your app and extensions.

```
USAGE
  $ shopify app info [--no-color] [--verbose] [--path <value>] [-c <value>] [--json] [--web-env]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --json                format output as JSON
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --verbose             Increase the verbosity of the logs.
  --web-env             Outputs environment variables necessary for running and deploying web/.

DESCRIPTION
  Print basic information about your app and extensions.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/info.js)_

## `shopify app release`

Release an app version.

```
USAGE
  $ shopify app release --version <value> [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c
    <value>] [--reset] [-f]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  -f, --force           Release without asking for confirmation.
  --client-id=<value>   The Client ID of your app.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --reset               Reset all your settings.
  --verbose             Increase the verbosity of the logs.
  --version=<value>     (required) The name of the app version to release.

DESCRIPTION
  Release an app version.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/release.js)_

## `shopify app update-url`

Update your app and redirect URLs in the Partners Dashboard.

```
USAGE
  $ shopify app update-url [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c <value>] [--app-url
    <value>] [--redirect-urls <value>]

FLAGS
  -c, --config=<value>     The name of the app configuration.
  --app-url=<value>        URL through which merchants will access your app.
  --client-id=<value>      The Client ID of your app.
  --no-color               Disable color output.
  --path=<value>           [default: .] The path to your app directory.
  --redirect-urls=<value>  Comma separated list of allowed URLs where merchants are redirected after the app is
                           installed
  --verbose                Increase the verbosity of the logs.

DESCRIPTION
  Update your app and redirect URLs in the Partners Dashboard.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/update-url.js)_

## `shopify app versions list [FILE]`

List deployed versions of your app.

```
USAGE
  $ shopify app versions list [FILE] [--no-color] [--verbose] [--path <value>] [--client-id <value> | -c <value>]
    [--json]

FLAGS
  -c, --config=<value>  The name of the app configuration.
  --client-id=<value>   The Client ID to fetch versions for.
  --json                Output the versions list as JSON.
  --no-color            Disable color output.
  --path=<value>        [default: .] The path to your app directory.
  --verbose             Increase the verbosity of the logs.

DESCRIPTION
  List deployed versions of your app.

EXAMPLES
  $ shopify app versions list
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/app/versions/list.js)_

## `shopify auth logout`

Logout from Shopify.

```
USAGE
  $ shopify auth logout

DESCRIPTION
  Logout from Shopify.
```

_See code: [dist/cli/commands/auth/logout.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.52.0/dist/cli/commands/auth/logout.js)_

## `shopify commands`

list all the commands

```
USAGE
  $ shopify commands [--json] [-h] [--hidden] [--tree] [--columns <value> | -x] [--sort <value>] [--filter
    <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]

FLAGS
  -h, --help         Show CLI help.
  -x, --extended     show extra columns
  --columns=<value>  only show provided columns (comma-separated)
  --csv              output is csv format [alias: --output=csv]
  --filter=<value>   filter property by partial string matching, ex: name=foo
  --hidden           show hidden commands
  --no-header        hide table header from output
  --no-truncate      do not truncate output to fit screen
  --output=<option>  output in a more machine friendly format
                     <options: csv|json|yaml>
  --sort=<value>     property to sort by (prepend '-' for descending)
  --tree             show tree of commands

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  list all the commands
```

_See code: [@oclif/plugin-commands](https://github.com/oclif/plugin-commands/blob/v2.2.24/src/commands/commands.ts)_

## `shopify config autocorrect off`

Disable autocorrect.

```
USAGE
  $ shopify config autocorrect off

DESCRIPTION
  Disable autocorrect.
```

## `shopify config autocorrect on`

Enable autocorrect.

```
USAGE
  $ shopify config autocorrect on

DESCRIPTION
  Enable autocorrect.
```

## `shopify config autocorrect status`

Check autocorrect current status.

```
USAGE
  $ shopify config autocorrect status

DESCRIPTION
  Check autocorrect current status.
```

## `shopify help [COMMANDS]`

Display help for shopify.

```
USAGE
  $ shopify help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for shopify.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.18/src/commands/help.ts)_

## `shopify kitchen-sink async`

View the UI kit components that process async tasks

```
USAGE
  $ shopify kitchen-sink async

DESCRIPTION
  View the UI kit components that process async tasks
```

_See code: [dist/cli/commands/kitchen-sink/async.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.52.0/dist/cli/commands/kitchen-sink/async.js)_

## `shopify kitchen-sink prompts`

View the UI kit components prompts

```
USAGE
  $ shopify kitchen-sink prompts

DESCRIPTION
  View the UI kit components prompts
```

_See code: [dist/cli/commands/kitchen-sink/prompts.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.52.0/dist/cli/commands/kitchen-sink/prompts.js)_

## `shopify kitchen-sink static`

View the UI kit components that display static output

```
USAGE
  $ shopify kitchen-sink static

DESCRIPTION
  View the UI kit components that display static output
```

_See code: [dist/cli/commands/kitchen-sink/static.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.52.0/dist/cli/commands/kitchen-sink/static.js)_

## `shopify plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ shopify plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ shopify plugins add

EXAMPLES
  $ shopify plugins:install myplugin 

  $ shopify plugins:install https://github.com/someuser/someplugin

  $ shopify plugins:install someuser/someplugin
```

## `shopify plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ shopify plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ shopify plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.1.8/src/commands/plugins/inspect.ts)_

## `shopify plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ shopify plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ shopify plugins add

EXAMPLES
  $ shopify plugins:install myplugin 

  $ shopify plugins:install https://github.com/someuser/someplugin

  $ shopify plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.1.8/src/commands/plugins/install.ts)_

## `shopify plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ shopify plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ shopify plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.1.8/src/commands/plugins/link.ts)_

## `shopify plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ shopify plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ shopify plugins unlink
  $ shopify plugins remove
```

## `shopify plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ shopify plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ shopify plugins unlink
  $ shopify plugins remove
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.1.8/src/commands/plugins/uninstall.ts)_

## `shopify plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ shopify plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ shopify plugins unlink
  $ shopify plugins remove
```

## `shopify plugins update`

Update installed plugins.

```
USAGE
  $ shopify plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v3.1.8/src/commands/plugins/update.ts)_

## `shopify search [QUERY]`

Starts a search on shopify.dev.

```
USAGE
  $ shopify search [QUERY]

DESCRIPTION
  Starts a search on shopify.dev.
```

_See code: [dist/cli/commands/search.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.52.0/dist/cli/commands/search.js)_

## `shopify theme check`

Validate the theme.

```
USAGE
  $ shopify theme check [--no-color] [--verbose] [--dev-preview] [--path <value>] [-a] [-c <value>] [-C <value>]
    [-x <value>] [--fail-level crash|error|suggestion|style|warning|info] [--update-docs] [--init] [--list] [-o
    text|json] [--print] [-v] [-e <value>]

FLAGS
  -C, --config=<value>            Use the config provided, overriding .theme-check.yml if present
                                  Supports all theme-check: config values, e.g., theme-check:theme-app-extension,
                                  theme-check:recommended, theme-check:all
                                  For backwards compatibility, :theme_app_extension is also supported
  -a, --auto-correct              Automatically fix offenses
  -c, --category=<value>          Only run this category of checks
                                  Runs checks matching all categories when specified more than once
  -e, --environment=<value>       The environment to apply to the current command.
  -o, --output=<option>           [default: text] The output format to use
                                  <options: text|json>
  -v, --version                   Print Theme Check version
  -x, --exclude-category=<value>  Exclude this category of checks
                                  Excludes checks matching any category when specified more than once
  --dev-preview                   Use the dev preview version of theme check
                                  Applies the typescript implementation of theme check to the theme
  --fail-level=<option>           [default: error] Minimum severity for exit with error code
                                  <options: crash|error|suggestion|style|warning|info>
  --init                          Generate a .theme-check.yml file
  --list                          List enabled checks
  --no-color                      Disable color output.
  --path=<value>                  [default: .] The path to your theme directory.
  --print                         Output active config to STDOUT
  --update-docs                   Update Theme Check docs (objects, filters, and tags)
  --verbose                       Increase the verbosity of the logs.

DESCRIPTION
  Validate the theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/check.js)_

## `shopify theme console`

Shopify Liquid REPL (read-eval-print loop) tool

```
USAGE
  $ shopify theme console [--no-color] [--verbose] [-s <value>] [--password <value>] [-e <value>] [--url <value>]
    [--port <value>]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command.
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --port=<value>             [default: 9293] Local port to serve authentication service.
  --url=<value>              [default: /] The url to be used as context
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Shopify Liquid REPL (read-eval-print loop) tool
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/console.js)_

## `shopify theme delete`

Delete remote themes from the connected store. This command can't be undone.

```
USAGE
  $ shopify theme delete [--no-color] [--verbose] [--password <value>] [-d] [-a] [-f] [-t <value>] [-s <value>]
    [-e <value>]

FLAGS
  -a, --show-all             Include others development themes in theme list.
  -d, --development          Delete your development theme.
  -e, --environment=<value>  The environment to apply to the current command.
  -f, --force                Skip confirmation.
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  -t, --theme=<value>...     Theme ID or name of the remote theme.
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Delete remote themes from the connected store. This command can't be undone.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/delete.js)_

## `shopify theme dev`

Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.

```
USAGE
  $ shopify theme dev [--no-color] [--verbose] [--path <value>] [--host <value>] [--live-reload
    hot-reload|full-page|off] [--poll] [--theme-editor-sync] [--port <value>] [-s <value>] [-t <value>] [-o <value>] [-x
    <value>] [--password <value>] [-e <value>] [--notify <value>] [--open]

FLAGS
  -e, --environment=<value>
      The environment to apply to the current command.

  -o, --only=<value>...
      Hot reload only files that match the specified pattern.

  -s, --store=<value>
      Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL (johns-apparel.myshopify.com,
      https://johns-apparel.myshopify.com).

  -t, --theme=<value>
      Theme ID or name of the remote theme.

  -x, --ignore=<value>...
      Skip hot reloading any files that match the specified pattern.

  --host=<value>
      Set which network interface the web server listens on. The default value is 127.0.0.1.

  --live-reload=<option>
      [default: hot-reload] The live reload mode switches the server behavior when a file is modified:
      - hot-reload Hot reloads local changes to CSS and sections (default)
      - full-page  Always refreshes the entire page
      - off        Deactivate live reload
      <options: hot-reload|full-page|off>

  --no-color
      Disable color output.

  --notify=<value>
      The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a
      webhook posted to report on file changes.

  --open
      Automatically launch the theme preview in your default web browser.

  --password=<value>
      Password generated from the Theme Access app.

  --path=<value>
      [default: .] The path to your theme directory.

  --poll
      Force polling to detect file changes.

  --port=<value>
      Local port to serve theme preview from.

  --theme-editor-sync
      Synchronize Theme Editor updates in the local theme files.

  --verbose
      Increase the verbosity of the logs.

DESCRIPTION
  Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to
  your terminal. While running, changes will push to the store in real time.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/dev.js)_

## `shopify theme info`

Print basic information about your theme environment.

```
USAGE
  $ shopify theme info [--no-color] [--verbose]

FLAGS
  --no-color  Disable color output.
  --verbose   Increase the verbosity of the logs.

DESCRIPTION
  Print basic information about your theme environment.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/info.js)_

## `shopify theme init [NAME]`

Clones a Git repository to use as a starting point for building a new theme.

```
USAGE
  $ shopify theme init [NAME] [--no-color] [--verbose] [--path <value>] [-u <value>] [-l]

ARGUMENTS
  NAME  Name of the new theme

FLAGS
  -l, --latest             Downloads the latest release of the `clone-url`
  -u, --clone-url=<value>  [default: https://github.com/Shopify/dawn.git] The Git URL to clone from. Defaults to
                           Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git
  --no-color               Disable color output.
  --path=<value>           [default: .] The path to your theme directory.
  --verbose                Increase the verbosity of the logs.

DESCRIPTION
  Clones a Git repository to use as a starting point for building a new theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/init.js)_

## `shopify theme language-server`

Start a Language Server Protocol server.

```
USAGE
  $ shopify theme language-server [--no-color] [--verbose] [--dev-preview]

FLAGS
  --dev-preview  Use the dev preview version of theme check
                 Applies the typescript implementation of theme check to the theme
  --no-color     Disable color output.
  --verbose      Increase the verbosity of the logs.

DESCRIPTION
  Start a Language Server Protocol server.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/language-server.js)_

## `shopify theme list`

Lists your remote themes.

```
USAGE
  $ shopify theme list [--no-color] [--verbose] [--password <value>] [-s <value>] [--role
    live|unpublished|development] [--name <value>] [--id <value>] [--json] [-e <value>]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command.
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  --id=<value>               Only list theme with the given ID.
  --json                     Output the theme list as JSON.
  --name=<value>             Only list themes that contain the given name.
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --role=<option>            Only list themes with the given role.
                             <options: live|unpublished|development>
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Lists your remote themes.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/list.js)_

## `shopify theme open`

Opens the preview of your remote theme.

```
USAGE
  $ shopify theme open [--no-color] [--verbose] [--password <value>] [-d] [-E] [-l] [-t <value>] [-s <value>]
    [-e <value>]

FLAGS
  -E, --editor               Open the theme editor for the specified theme in the browser.
  -d, --development          Open your development theme.
  -e, --environment=<value>  The environment to apply to the current command.
  -l, --live                 Open your live (published) theme.
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  -t, --theme=<value>        Theme ID or name of the remote theme.
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Opens the preview of your remote theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/open.js)_

## `shopify theme package`

Package your theme into a .zip file, ready to upload to the Online Store.

```
USAGE
  $ shopify theme package [--no-color] [--verbose] [--path <value>]

FLAGS
  --no-color      Disable color output.
  --path=<value>  [default: .] The path to your theme directory.
  --verbose       Increase the verbosity of the logs.

DESCRIPTION
  Package your theme into a .zip file, ready to upload to the Online Store.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/package.js)_

## `shopify theme publish`

Set a remote theme as the live theme.

```
USAGE
  $ shopify theme publish [--no-color] [--verbose] [--password <value>] [-f] [-t <value>] [-s <value>] [-e <value>]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command.
  -f, --force                Skip confirmation.
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  -t, --theme=<value>        Theme ID or name of the remote theme.
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Set a remote theme as the live theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/publish.js)_

## `shopify theme pull`

Download your remote theme files locally.

```
USAGE
  $ shopify theme pull [--no-color] [--verbose] [--path <value>] [--password <value>] [-s <value>] [-e <value>]
    [-t <value>] [-d] [-l] [-n] [-o <value>] [-x <value>]

FLAGS
  -d, --development          Pull theme files from your remote development theme.
  -e, --environment=<value>  The environment to apply to the current command.
  -l, --live                 Pull theme files from your remote live theme.
  -n, --nodelete             Runs the pull command without deleting local files.
  -o, --only=<value>...      Download only the specified files (Multiple flags allowed).
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  -t, --theme=<value>        Theme ID or name of the remote theme.
  -x, --ignore=<value>...    Skip downloading the specified files (Multiple flags allowed).
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --path=<value>             [default: .] The path to your theme directory.
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Download your remote theme files locally.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/pull.js)_

## `shopify theme push`

Uploads your local theme files to the connected store, overwriting the remote version if specified.

```
USAGE
  $ shopify theme push [--no-color] [--verbose] [--path <value>] [--password <value>] [-s <value>] [-e <value>]
    [-t <value>] [-d] [-l] [-u] [-n] [-o <value>] [-x <value>] [-j] [-a] [-p]

FLAGS
  -a, --allow-live           Allow push to a live theme.
  -d, --development          Push theme files from your remote development theme.
  -e, --environment=<value>  The environment to apply to the current command.
  -j, --json                 Output JSON instead of a UI.
  -l, --live                 Push theme files from your remote live theme.
  -n, --nodelete             Runs the push command without deleting local files.
  -o, --only=<value>...      Download only the specified files (Multiple flags allowed).
  -p, --publish              Publish as the live theme after uploading.
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  -t, --theme=<value>        Theme ID or name of the remote theme.
  -u, --unpublished          Create a new unpublished theme and push to it.
  -x, --ignore=<value>...    Skip downloading the specified files (Multiple flags allowed).
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --path=<value>             [default: .] The path to your theme directory.
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Uploads your local theme files to the connected store, overwriting the remote version if specified.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/push.js)_

## `shopify theme share`

Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to `shopify theme push -u -t=RANDOMIZED_NAME`.

```
USAGE
  $ shopify theme share [--no-color] [--verbose] [--path <value>] [--password <value>] [-s <value>] [-e <value>]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command.
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
  --no-color                 Disable color output.
  --password=<value>         Password generated from the Theme Access app.
  --path=<value>             [default: .] The path to your theme directory.
  --verbose                  Increase the verbosity of the logs.

DESCRIPTION
  Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to
  `shopify theme push -u -t=RANDOMIZED_NAME`.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.52.0/dist/cli/commands/theme/share.js)_

## `shopify upgrade`

Upgrade the Shopify CLI.

```
USAGE
  $ shopify upgrade [--path <value>]

FLAGS
  --path=<value>  [default: .] The path to your project directory.

DESCRIPTION
  Upgrade the Shopify CLI.
```

_See code: [dist/cli/commands/upgrade.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.52.0/dist/cli/commands/upgrade.js)_

## `shopify version`

Shopify CLI version.

```
USAGE
  $ shopify version

DESCRIPTION
  Shopify CLI version.
```

_See code: [dist/cli/commands/version.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.52.0/dist/cli/commands/version.js)_

## `shopify webhook trigger`

Trigger delivery of a sample webhook topic payload to a designated address.

```
USAGE
  $ shopify webhook trigger [--help] [--topic <value>] [--api-version <value>] [--delivery-method
    http|google-pub-sub|event-bridge] [--shared-secret <value>] [--client-secret <value>] [--address <value>]

FLAGS
  --address=<value>
      The URL where the webhook payload should be sent.
      You will need a different address type for each delivery-method:
      · For remote HTTP testing, use a URL that starts with https://
      · For local HTTP testing, use http://localhost:{port}/{url-path}
      · For Google Pub/Sub, use pubsub://{project-id}:{topic-id}
      · For Amazon EventBridge, use an Amazon Resource Name (ARN) starting with arn:aws:events:

  --api-version=<value>
      The API Version of the webhook topic.

  --client-secret=<value>
      Your app's client secret. This secret allows us to return the X-Shopify-Hmac-SHA256 header that lets you validate
      the origin of the response that you receive.

  --delivery-method=<option>
      Method chosen to deliver the topic payload. If not passed, it's inferred from the address.
      <options: http|google-pub-sub|event-bridge>

  --help
      This help. When you run the trigger command the CLI will prompt you for any information that isn't passed using
      flags.

  --shared-secret=<value>
      Deprecated. Please use client-secret.

  --topic=<value>
      The requested webhook topic.

DESCRIPTION
  Trigger delivery of a sample webhook topic payload to a designated address.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.52.0/dist/cli/commands/webhook/trigger.js)_
<!-- commandsstop -->
