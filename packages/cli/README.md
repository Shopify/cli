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
* [`shopify theme rename`](#shopify-theme-rename)
* [`shopify theme share`](#shopify-theme-share)
* [`shopify upgrade`](#shopify-upgrade)
* [`shopify version`](#shopify-version)
* [`shopify webhook trigger`](#shopify-webhook-trigger)

## `shopify app build`

Build the app.

```
USAGE
  $ shopify app build [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--skip-dependencies-installation] [--verbose]

FLAGS
  -c, --config=<value>                  The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --client-id=<value>               Application's Client ID that will be exposed at build time. (Env:
                                        SHOPIFY_FLAG_CLIENT_ID)
      --no-color                        Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>                    The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --skip-dependencies-installation  Skips the installation of dependencies. Deprecated, use workspaces instead.
                                        (Env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION)
      --verbose                         Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Build the app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/build.js)_

## `shopify app config link`

Fetch your app configuration from the Partner Dashboard.

```
USAGE
  $ shopify app config link [--client-id <value>] [-c <value>] [--no-color] [--path <value>] [--verbose]

FLAGS
  -c, --config=<value>     The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --client-id=<value>  The Client ID of your app. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Fetch your app configuration from the Partner Dashboard.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/config/link.js)_

## `shopify app config push`

Push your app configuration to the Partner Dashboard.

```
USAGE
  $ shopify app config push [-c <value>] [-f] [--no-color] [--path <value>] [--verbose]

FLAGS
  -c, --config=<value>  The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
  -f, --force           Push configuration without asking for confirmation. (Env: SHOPIFY_FLAG_FORCE)
      --no-color        Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>    The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose         Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Push your app configuration to the Partner Dashboard.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/config/push.js)_

## `shopify app config use [CONFIG]`

Activate an app configuration.

```
USAGE
  $ shopify app config use [CONFIG] [--no-color] [--path <value>] [--reset] [--verbose]

ARGUMENTS
  CONFIG  The name of the app configuration. Can be 'shopify.app.staging.toml' or simply 'staging'.

FLAGS
  --no-color      Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>  The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --reset         Reset current configuration. (Env: SHOPIFY_FLAG_RESET)
      --verbose       Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Activate an app configuration.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/config/use.js)_

## `shopify app deploy`

Deploy your Shopify app.

```
USAGE
  $ shopify app deploy [--client-id <value> | -c <value>] [-f] [--message <value>] [--no-color] [--no-release]
    [--path <value>] [--reset | ] [--source-control-url <value>] [--verbose] [--version <value>]

FLAGS
  -c, --config=<value>              The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
  -f, --force                       Deploy without asking for confirmation. (Env: SHOPIFY_FLAG_FORCE)
      --client-id=<value>           The Client ID of your app. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --message=<value>             Optional message that will be associated with this version. This is for internal use
                                    only and won't be available externally. (Env: SHOPIFY_FLAG_MESSAGE)
      --no-color                    Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --no-release                  Creates a version but doesn't release it - it's not made available to merchants.
                                    (Env: SHOPIFY_FLAG_NO_RELEASE)
      --path=<value>                The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --reset                       Reset all your settings. (Env: SHOPIFY_FLAG_RESET)
      --source-control-url=<value>  URL associated with the new app version. (Env: SHOPIFY_FLAG_SOURCE_CONTROL_URL)
      --verbose                     Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)
      --version=<value>             Optional version tag that will be associated with this app version. If not provided,
                                    an auto-generated identifier will be generated for this app version. (Env:
                                    SHOPIFY_FLAG_VERSION)

DESCRIPTION
  Deploy your Shopify app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/deploy.js)_

## `shopify app dev`

Run the app.

```
USAGE
  $ shopify app dev [--checkout-cart-url <value>] [--client-id <value> | -c <value>] [--no-color]
    [--no-update] [--notify <value>] [--path <value>] [--reset | ] [--skip-dependencies-installation] [-s <value>]
    [--subscription-product-url <value>] [-t <value>] [--theme-app-extension-port <value>] [--tunnel-url <value> |  | ]
    [--verbose]

FLAGS
  -c, --config=<value>                    The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
  -s, --store=<value>                     Store URL. Must be an existing development or Shopify Plus sandbox store.
                                          (Env: SHOPIFY_FLAG_STORE)
  -t, --theme=<value>                     Theme ID or name of the theme app extension host theme. (Env:
                                          SHOPIFY_FLAG_THEME)
      --checkout-cart-url=<value>         Resource URL for checkout UI extension. Format:
                                          "/cart/{productVariantID}:{productQuantity}" (Env:
                                          SHOPIFY_FLAG_CHECKOUT_CART_URL)
      --client-id=<value>                 The Client ID of your app. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --no-color                          Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --no-update                         Skips the Partners Dashboard URL update step. (Env: SHOPIFY_FLAG_NO_UPDATE)
      --notify=<value>                    The file path or URL. The file path is to a file that you want updated on
                                          idle. The URL path is where you want a webhook posted to report on file
                                          changes. (Env: SHOPIFY_FLAG_NOTIFY)
      --path=<value>                      The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --reset                             Reset all your settings. (Env: SHOPIFY_FLAG_RESET)
      --skip-dependencies-installation    Skips the installation of dependencies. Deprecated, use workspaces instead.
                                          (Env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION)
      --subscription-product-url=<value>  Resource URL for subscription UI extension. Format: "/products/{productId}"
                                          (Env: SHOPIFY_FLAG_SUBSCRIPTION_PRODUCT_URL)
      --theme-app-extension-port=<value>  Local port of the theme app extension development server. (Env:
                                          SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT)
      --tunnel-url=<value>                Use a custom tunnel, it must be running before executing dev. Format:
                                          "https://my-tunnel-url:port". (Env: SHOPIFY_FLAG_TUNNEL_URL)
      --verbose                           Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Run the app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/dev.js)_

## `shopify app env pull`

Pull app and extensions environment variables.

```
USAGE
  $ shopify app env pull [-c <value>] [--env-file <value>] [--no-color] [--path <value>] [--verbose]

FLAGS
  -c, --config=<value>    The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --env-file=<value>  Specify an environment file to update if the update flag is set (Env: SHOPIFY_FLAG_ENV_FILE)
      --no-color          Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>      The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose           Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Pull app and extensions environment variables.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/env/pull.js)_

## `shopify app env show`

Display app and extensions environment variables.

```
USAGE
  $ shopify app env show [-c <value>] [--no-color] [--path <value>] [--verbose]

FLAGS
  -c, --config=<value>  The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --no-color        Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>    The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose         Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Display app and extensions environment variables.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/env/show.js)_

## `shopify app function build`

Compile a function to wasm.

```
USAGE
  $ shopify app function build [-c <value>] [--no-color] [--path <value>] [--verbose]

FLAGS
  -c, --config=<value>  The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --no-color        Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>    The path to your function directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose         Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Compile a function to wasm.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/function/build.js)_

## `shopify app function run`

Run a function locally for testing.

```
USAGE
  $ shopify app function run [-c <value>] [-e <value>] [-i <value>] [-j] [--no-color] [--path <value>] [--verbose]

FLAGS
  -c, --config=<value>  The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
  -e, --export=<value>  [default: _start] Name of the wasm export to invoke. (Env: SHOPIFY_FLAG_EXPORT)
  -i, --input=<value>   The input JSON to pass to the function. If omitted, standard input is used. (Env:
                        SHOPIFY_FLAG_INPUT)
  -j, --json            Log the run result as a JSON object. (Env: SHOPIFY_FLAG_JSON)
      --no-color        Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>    The path to your function directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose         Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Run a function locally for testing.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/function/run.js)_

## `shopify app function schema`

Fetch the latest GraphQL schema for a function.

```
USAGE
  $ shopify app function schema [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--stdout] [--verbose]

FLAGS
  -c, --config=<value>     The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --client-id=<value>  The Client ID to fetch the schema with. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your function directory. (Env: SHOPIFY_FLAG_PATH)
      --stdout             Output the schema to stdout instead of writing to a file. (Env: SHOPIFY_FLAG_STDOUT)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Fetch the latest GraphQL schema for a function.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/function/schema.js)_

## `shopify app function typegen`

Generate GraphQL types for a JavaScript function.

```
USAGE
  $ shopify app function typegen [-c <value>] [--no-color] [--path <value>] [--verbose]

FLAGS
  -c, --config=<value>  The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --no-color        Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>    The path to your function directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose         Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Generate GraphQL types for a JavaScript function.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/function/typegen.js)_

## `shopify app generate extension [FILE]`

Scaffold an Extension.

```
USAGE
  $ shopify app generate extension [FILE] [--client-id <value> | -c <value>] [--flavor
    vanilla-js|react|typescript|typescript-react|wasm|rust] [-n <value>] [--no-color] [--path <value>] [--reset | ] [-t
    <value>] [-t <value>] [--verbose]

FLAGS
  -c, --config=<value>     The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
  -n, --name=<value>       name of your Extension (Env: SHOPIFY_FLAG_NAME)
  -t, --template=<value>   Extension template (Env: SHOPIFY_FLAG_EXTENSION_TEMPLATE)
  -t, --type=<value>       Deprecated. Please use --template (Env: SHOPIFY_FLAG_EXTENSION_TYPE)
      --client-id=<value>  The Client ID of your app. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --flavor=<option>    Choose a starting template for your extension, where applicable
                           <options: vanilla-js|react|typescript|typescript-react|wasm|rust> (Env: SHOPIFY_FLAG_FLAVOR)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --reset              Reset all your settings. (Env: SHOPIFY_FLAG_RESET)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Scaffold an Extension.

EXAMPLES
  $ shopify app generate extension
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/generate/extension.js)_

## `shopify app generate schema`

Fetch the latest GraphQL schema for a function.

```
USAGE
  $ shopify app generate schema [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--stdout] [--verbose]

FLAGS
  -c, --config=<value>     The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --client-id=<value>  The Client ID to fetch the schema with. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your function directory. (Env: SHOPIFY_FLAG_PATH)
      --stdout             Output the schema to stdout instead of writing to a file. (Env: SHOPIFY_FLAG_STDOUT)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Fetch the latest GraphQL schema for a function.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/generate/schema.js)_

## `shopify app import-flow-legacy-extensions`

Import dashboard-managed flow extensions into your app.

```
USAGE
  $ shopify app import-flow-legacy-extensions [--client-id <value> | -c <value>] [--no-color] [--path <value>]
  [--verbose]

FLAGS
  -c, --config=<value>     The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --client-id=<value>  The Client ID of your app. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Import dashboard-managed flow extensions into your app.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/import-flow-legacy-extensions.js)_

## `shopify app info`

Print basic information about your app and extensions.

```
USAGE
  $ shopify app info [-c <value>] [--json] [--no-color] [--path <value>] [--verbose] [--web-env]

FLAGS
  -c, --config=<value>  The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --json            format output as JSON (Env: SHOPIFY_FLAG_JSON)
      --no-color        Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>    The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose         Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)
      --web-env         Outputs environment variables necessary for running and deploying web/. (Env:
                        SHOPIFY_FLAG_OUTPUT_WEB_ENV)

DESCRIPTION
  Print basic information about your app and extensions.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/info.js)_

## `shopify app release`

Release an app version.

```
USAGE
  $ shopify app release --version <value> [--client-id <value> | -c <value>] [-f] [--no-color] [--path <value>]
    [--reset] [--verbose]

FLAGS
  -c, --config=<value>     The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
  -f, --force              Release without asking for confirmation. (Env: SHOPIFY_FLAG_FORCE)
      --client-id=<value>  The Client ID of your app. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --reset              Reset all your settings. (Env: SHOPIFY_FLAG_RESET)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)
      --version=<value>    (required) The name of the app version to release. (Env: SHOPIFY_FLAG_VERSION)

DESCRIPTION
  Release an app version.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/release.js)_

## `shopify app update-url`

Update your app and redirect URLs in the Partners Dashboard.

```
USAGE
  $ shopify app update-url [--app-url <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--redirect-urls <value>] [--verbose]

FLAGS
  -c, --config=<value>         The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --app-url=<value>        URL through which merchants will access your app. (Env: SHOPIFY_FLAG_APP_URL)
      --client-id=<value>      The Client ID of your app. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --no-color               Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>           The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --redirect-urls=<value>  Comma separated list of allowed URLs where merchants are redirected after the app is
                               installed (Env: SHOPIFY_FLAG_REDIRECT_URLS)
      --verbose                Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Update your app and redirect URLs in the Partners Dashboard.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/update-url.js)_

## `shopify app versions list [FILE]`

List deployed versions of your app.

```
USAGE
  $ shopify app versions list [FILE] [--client-id <value> | -c <value>] [--json] [--no-color] [--path <value>]
    [--verbose]

FLAGS
  -c, --config=<value>     The name of the app configuration. (Env: SHOPIFY_FLAG_APP_CONFIG)
      --client-id=<value>  The Client ID to fetch versions for. (Env: SHOPIFY_FLAG_CLIENT_ID)
      --json               Output the versions list as JSON. (Env: SHOPIFY_FLAG_JSON)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your app directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  List deployed versions of your app.

EXAMPLES
  $ shopify app versions list
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/app/versions/list.js)_

## `shopify auth logout`

Logout from Shopify.

```
USAGE
  $ shopify auth logout

DESCRIPTION
  Logout from Shopify.
```

_See code: [dist/cli/commands/auth/logout.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.55.0/dist/cli/commands/auth/logout.js)_

## `shopify commands`

list all the commands

```
USAGE
  $ shopify commands [--json] [-h] [--hidden] [--tree] [--columns <value> | -x] [--sort <value>] [--filter
    <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ]

FLAGS
  -h, --help             Show CLI help.
  -x, --extended         show extra columns
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

## `shopify plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ shopify plugins add plugins:install PLUGIN...

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
  $ shopify plugins inspect PLUGIN...

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
  $ shopify plugins install PLUGIN...

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
  $ shopify plugins link PLUGIN

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
  $ shopify plugins remove plugins:uninstall PLUGIN...

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
  $ shopify plugins uninstall PLUGIN...

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
  $ shopify plugins unlink plugins:uninstall PLUGIN...

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

_See code: [dist/cli/commands/search.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.55.0/dist/cli/commands/search.js)_

## `shopify theme check`

Validate the theme.

```
USAGE
  $ shopify theme check [-a] [-C <value>] [-e <value>] [--fail-level crash|error|suggestion|style|warning|info]
    [--init] [--list] [--no-color] [-o text|json] [--path <value>] [--print] [--verbose] [-v]

FLAGS
  -C, --config=<value>       Use the config provided, overriding .theme-check.yml if present
                             Supports all theme-check: config values, e.g., theme-check:theme-app-extension,
                             theme-check:recommended, theme-check:all
                             For backwards compatibility, :theme_app_extension is also supported  (Env:
                             SHOPIFY_FLAG_CONFIG)
  -a, --auto-correct         Automatically fix offenses (Env: SHOPIFY_FLAG_AUTO_CORRECT)
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -o, --output=<option>      [default: text] The output format to use
                             <options: text|json> (Env: SHOPIFY_FLAG_OUTPUT)
  -v, --version              Print Theme Check version (Env: SHOPIFY_FLAG_VERSION)
      --fail-level=<option>  [default: error] Minimum severity for exit with error code
                             <options: crash|error|suggestion|style|warning|info> (Env: SHOPIFY_FLAG_FAIL_LEVEL)
      --init                 Generate a .theme-check.yml file (Env: SHOPIFY_FLAG_INIT)
      --list                 List enabled checks (Env: SHOPIFY_FLAG_LIST)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>         The path to your theme directory. (Env: SHOPIFY_FLAG_PATH)
      --print                Output active config to STDOUT (Env: SHOPIFY_FLAG_PRINT)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Validate the theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/check.js)_

## `shopify theme console`

Shopify Liquid REPL (read-eval-print loop) tool

```
USAGE
  $ shopify theme console [-e <value>] [--no-color] [--password <value>] [--port <value>] [-s <value>] [--url
    <value>] [--verbose]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --port=<value>         [default: 9293] Local port to serve authentication service. (Env: SHOPIFY_FLAG_PORT)
      --url=<value>          [default: /] The url to be used as context (Env: SHOPIFY_FLAG_URL)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Shopify Liquid REPL (read-eval-print loop) tool
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/console.js)_

## `shopify theme delete`

Delete remote themes from the connected store. This command can't be undone.

```
USAGE
  $ shopify theme delete [-d] [-e <value>] [-f] [--no-color] [--password <value>] [-a] [-s <value>] [-t <value>]
    [--verbose]

FLAGS
  -a, --show-all             Include others development themes in theme list. (Env: SHOPIFY_FLAG_SHOW_ALL)
  -d, --development          Delete your development theme. (Env: SHOPIFY_FLAG_DEVELOPMENT)
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -f, --force                Skip confirmation. (Env: SHOPIFY_FLAG_FORCE)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
  -t, --theme=<value>...     Theme ID or name of the remote theme. (Env: SHOPIFY_FLAG_THEME_ID)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Delete remote themes from the connected store. This command can't be undone.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/delete.js)_

## `shopify theme dev`

Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.

```
USAGE
  $ shopify theme dev [-e <value>] [--host <value>] [-x <value>] [--live-reload hot-reload|full-page|off]
    [--no-color] [-n] [--notify <value>] [-o <value>] [--open] [--password <value>] [--path <value>] [--poll] [--port
    <value>] [-s <value>] [-t <value>] [--theme-editor-sync] [--verbose]

FLAGS
  -e, --environment=<value>
      The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)

  -n, --nodelete
      Runs the dev command without deleting local files. (Env: SHOPIFY_FLAG_NODELETE)

  -o, --only=<value>...
      Hot reload only files that match the specified pattern. (Env: SHOPIFY_FLAG_ONLY)

  -s, --store=<value>
      Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL (johns-apparel.myshopify.com,
      https://johns-apparel.myshopify.com). (Env: SHOPIFY_FLAG_STORE)

  -t, --theme=<value>
      Theme ID or name of the remote theme. (Env: SHOPIFY_FLAG_THEME_ID)

  -x, --ignore=<value>...
      Skip hot reloading any files that match the specified pattern. (Env: SHOPIFY_FLAG_IGNORE)

  --host=<value>
      Set which network interface the web server listens on. The default value is 127.0.0.1. (Env: SHOPIFY_FLAG_HOST)

  --live-reload=<option>
      [default: hot-reload] The live reload mode switches the server behavior when a file is modified:
      - hot-reload Hot reloads local changes to CSS and sections (default)
      - full-page  Always refreshes the entire page
      - off        Deactivate live reload
      <options: hot-reload|full-page|off> (Env: SHOPIFY_FLAG_LIVE_RELOAD)

  --no-color
      Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)

  --notify=<value>
      The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a
      webhook posted to report on file changes. (Env: SHOPIFY_FLAG_NOTIFY)

  --open
      Automatically launch the theme preview in your default web browser. (Env: SHOPIFY_FLAG_OPEN)

  --password=<value>
      Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)

  --path=<value>
      The path to your theme directory. (Env: SHOPIFY_FLAG_PATH)

  --poll
      Force polling to detect file changes. (Env: SHOPIFY_FLAG_POLL)

  --port=<value>
      Local port to serve theme preview from. (Env: SHOPIFY_FLAG_PORT)

  --theme-editor-sync
      Synchronize Theme Editor updates in the local theme files. (Env: SHOPIFY_FLAG_THEME_EDITOR_SYNC)

  --verbose
      Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to
  your terminal. While running, changes will push to the store in real time.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/dev.js)_

## `shopify theme info`

Print basic information about your theme environment.

```
USAGE
  $ shopify theme info [--no-color] [--verbose]

FLAGS
  --no-color  Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --verbose   Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Print basic information about your theme environment.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/info.js)_

## `shopify theme init [NAME]`

Clones a Git repository to use as a starting point for building a new theme.

```
USAGE
  $ shopify theme init [NAME] [-u <value>] [-l] [--no-color] [--path <value>] [--verbose]

ARGUMENTS
  NAME  Name of the new theme

FLAGS
  -l, --latest             Downloads the latest release of the `clone-url` (Env: SHOPIFY_FLAG_LATEST)
  -u, --clone-url=<value>  [default: https://github.com/Shopify/dawn.git] The Git URL to clone from. Defaults to
                           Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git (Env:
                           SHOPIFY_FLAG_CLONE_URL)
      --no-color           Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>       The path to your theme directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose            Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Clones a Git repository to use as a starting point for building a new theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/init.js)_

## `shopify theme language-server`

Start a Language Server Protocol server.

```
USAGE
  $ shopify theme language-server [--no-color] [--verbose]

FLAGS
  --no-color  Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --verbose   Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Start a Language Server Protocol server.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/language-server.js)_

## `shopify theme list`

Lists your remote themes.

```
USAGE
  $ shopify theme list [-e <value>] [--id <value>] [--json] [--name <value>] [--no-color] [--password <value>]
    [--role live|unpublished|development] [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
      --id=<value>           Only list theme with the given ID. (Env: SHOPIFY_FLAG_ID)
      --json                 Output the theme list as JSON. (Env: SHOPIFY_FLAG_JSON)
      --name=<value>         Only list themes that contain the given name. (Env: SHOPIFY_FLAG_NAME)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --role=<option>        Only list themes with the given role.
                             <options: live|unpublished|development> (Env: SHOPIFY_FLAG_ROLE)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Lists your remote themes.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/list.js)_

## `shopify theme open`

Opens the preview of your remote theme.

```
USAGE
  $ shopify theme open [-d] [-E] [-e <value>] [-l] [--no-color] [--password <value>] [-s <value>] [-t <value>]
    [--verbose]

FLAGS
  -E, --editor               Open the theme editor for the specified theme in the browser. (Env: SHOPIFY_FLAG_EDITOR)
  -d, --development          Open your development theme. (Env: SHOPIFY_FLAG_DEVELOPMENT)
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -l, --live                 Open your live (published) theme. (Env: SHOPIFY_FLAG_LIVE)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
  -t, --theme=<value>        Theme ID or name of the remote theme. (Env: SHOPIFY_FLAG_THEME_ID)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Opens the preview of your remote theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/open.js)_

## `shopify theme package`

Package your theme into a .zip file, ready to upload to the Online Store.

```
USAGE
  $ shopify theme package [--no-color] [--path <value>] [--verbose]

FLAGS
  --no-color      Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --path=<value>  The path to your theme directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose       Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Package your theme into a .zip file, ready to upload to the Online Store.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/package.js)_

## `shopify theme publish`

Set a remote theme as the live theme.

```
USAGE
  $ shopify theme publish [-e <value>] [-f] [--no-color] [--password <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -f, --force                Skip confirmation. (Env: SHOPIFY_FLAG_FORCE)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
  -t, --theme=<value>        Theme ID or name of the remote theme. (Env: SHOPIFY_FLAG_THEME_ID)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Set a remote theme as the live theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/publish.js)_

## `shopify theme pull`

Download your remote theme files locally.

```
USAGE
  $ shopify theme pull [-d] [-e <value>] [-x <value>] [-l] [--no-color] [-n] [-o <value>] [--password <value>]
    [--path <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -d, --development          Pull theme files from your remote development theme. (Env: SHOPIFY_FLAG_DEVELOPMENT)
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -l, --live                 Pull theme files from your remote live theme. (Env: SHOPIFY_FLAG_LIVE)
  -n, --nodelete             Runs the pull command without deleting local files. (Env: SHOPIFY_FLAG_NODELETE)
  -o, --only=<value>...      Download only the specified files (Multiple flags allowed). (Env: SHOPIFY_FLAG_ONLY)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
  -t, --theme=<value>        Theme ID or name of the remote theme. (Env: SHOPIFY_FLAG_THEME_ID)
  -x, --ignore=<value>...    Skip downloading the specified files (Multiple flags allowed). (Env: SHOPIFY_FLAG_IGNORE)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --path=<value>         The path to your theme directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Download your remote theme files locally.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/pull.js)_

## `shopify theme push`

Uploads your local theme files to the connected store, overwriting the remote version if specified.

```
USAGE
  $ shopify theme push [-a] [-d] [-e <value>] [-x <value>] [-j] [-l] [--no-color] [-n] [-o <value>] [--password
    <value>] [--path <value>] [-p] [-s <value>] [-t <value>] [-u] [--verbose]

FLAGS
  -a, --allow-live           Allow push to a live theme. (Env: SHOPIFY_FLAG_ALLOW_LIVE)
  -d, --development          Push theme files from your remote development theme. (Env: SHOPIFY_FLAG_DEVELOPMENT)
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -j, --json                 Output JSON instead of a UI. (Env: SHOPIFY_FLAG_JSON)
  -l, --live                 Push theme files from your remote live theme. (Env: SHOPIFY_FLAG_LIVE)
  -n, --nodelete             Runs the push command without deleting local files. (Env: SHOPIFY_FLAG_NODELETE)
  -o, --only=<value>...      Download only the specified files (Multiple flags allowed). (Env: SHOPIFY_FLAG_ONLY)
  -p, --publish              Publish as the live theme after uploading. (Env: SHOPIFY_FLAG_PUBLISH)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
  -t, --theme=<value>        Theme ID or name of the remote theme. (Env: SHOPIFY_FLAG_THEME_ID)
  -u, --unpublished          Create a new unpublished theme and push to it. (Env: SHOPIFY_FLAG_UNPUBLISHED)
  -x, --ignore=<value>...    Skip downloading the specified files (Multiple flags allowed). (Env: SHOPIFY_FLAG_IGNORE)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --path=<value>         The path to your theme directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Uploads your local theme files to the connected store, overwriting the remote version if specified.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/push.js)_

## `shopify theme rename`

Renames an existing theme.

```
USAGE
  $ shopify theme rename -n <value> [-d] [-e <value>] [-l] [--no-color] [--password <value>] [-s <value>] [-t
    <value>] [--verbose]

FLAGS
  -d, --development          Rename your development theme. (Env: SHOPIFY_FLAG_DEVELOPMENT)
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -l, --live                 Rename your remote live theme. (Env: SHOPIFY_FLAG_LIVE)
  -n, --name=<value>         (required) The new name for the theme. (Env: SHOPIFY_FLAG_NEW_NAME)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
  -t, --theme=<value>        Theme ID or name of the remote theme. (Env: SHOPIFY_FLAG_THEME_ID)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Renames an existing theme.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/rename.js)_

## `shopify theme share`

Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to `shopify theme push -u -t=RANDOMIZED_NAME`.

```
USAGE
  $ shopify theme share [-e <value>] [--no-color] [--password <value>] [--path <value>] [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>  The environment to apply to the current command. (Env: SHOPIFY_FLAG_ENVIRONMENT)
  -s, --store=<value>        Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL
                             (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com). (Env:
                             SHOPIFY_FLAG_STORE)
      --no-color             Disable color output. (Env: SHOPIFY_FLAG_NO_COLOR)
      --password=<value>     Password generated from the Theme Access app. (Env: SHOPIFY_CLI_THEME_TOKEN)
      --path=<value>         The path to your theme directory. (Env: SHOPIFY_FLAG_PATH)
      --verbose              Increase the verbosity of the logs. (Env: SHOPIFY_FLAG_VERBOSE)

DESCRIPTION
  Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to
  `shopify theme push -u -t=RANDOMIZED_NAME`.
```

_See code: [@shopify/theme](https://github.com/Shopify/cli/edit/main/packages/theme/blob/v3.55.0/dist/cli/commands/theme/share.js)_

## `shopify upgrade`

Upgrade the Shopify CLI.

```
USAGE
  $ shopify upgrade [--path <value>]

FLAGS
  --path=<value>  [default: .] The path to your project directory. (Env: SHOPIFY_FLAG_PATH)

DESCRIPTION
  Upgrade the Shopify CLI.
```

_See code: [dist/cli/commands/upgrade.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.55.0/dist/cli/commands/upgrade.js)_

## `shopify version`

Shopify CLI version.

```
USAGE
  $ shopify version

DESCRIPTION
  Shopify CLI version.
```

_See code: [dist/cli/commands/version.js](https://github.com/Shopify/cli/edit/main/packages/cli/blob/v3.55.0/dist/cli/commands/version.js)_

## `shopify webhook trigger`

Trigger delivery of a sample webhook topic payload to a designated address.

```
USAGE
  $ shopify webhook trigger [--address <value>] [--api-version <value>] [--client-secret <value>] [--delivery-method
    http|google-pub-sub|event-bridge] [--help] [--shared-secret <value>] [--topic <value>]

FLAGS
  --address=<value>
      The URL where the webhook payload should be sent.
      You will need a different address type for each delivery-method:
      · For remote HTTP testing, use a URL that starts with https://
      · For local HTTP testing, use http://localhost:{port}/{url-path}
      · For Google Pub/Sub, use pubsub://{project-id}:{topic-id}
      · For Amazon EventBridge, use an Amazon Resource Name (ARN) starting with arn:aws:events: (Env:
      SHOPIFY_FLAG_ADDRESS)

  --api-version=<value>
      The API Version of the webhook topic. (Env: SHOPIFY_FLAG_API_VERSION)

  --client-secret=<value>
      Your app's client secret. This secret allows us to return the X-Shopify-Hmac-SHA256 header that lets you validate
      the origin of the response that you receive. (Env: SHOPIFY_FLAG_CLIENT_SECRET)

  --delivery-method=<option>
      Method chosen to deliver the topic payload. If not passed, it's inferred from the address.
      <options: http|google-pub-sub|event-bridge> (Env: SHOPIFY_FLAG_DELIVERY_METHOD)

  --help
      This help. When you run the trigger command the CLI will prompt you for any information that isn't passed using
      flags. (Env: SHOPIFY_FLAG_HELP)

  --shared-secret=<value>
      Deprecated. Please use client-secret. (Env: SHOPIFY_FLAG_SHARED_SECRET)

  --topic=<value>
      The requested webhook topic. (Env: SHOPIFY_FLAG_TOPIC)

DESCRIPTION
  Trigger delivery of a sample webhook topic payload to a designated address.
```

_See code: [@shopify/app](https://github.com/Shopify/cli/edit/main/packages/app/blob/v3.55.0/dist/cli/commands/webhook/trigger.js)_
<!-- commandsstop -->
