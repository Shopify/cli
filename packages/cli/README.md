# Commands
<!-- commands -->
* [`shopify app build`](#shopify-app-build)
* [`shopify app bulk cancel`](#shopify-app-bulk-cancel)
* [`shopify app bulk execute`](#shopify-app-bulk-execute)
* [`shopify app bulk status`](#shopify-app-bulk-status)
* [`shopify app config link`](#shopify-app-config-link)
* [`shopify app config pull`](#shopify-app-config-pull)
* [`shopify app config use [config] [flags]`](#shopify-app-config-use-config-flags)
* [`shopify app deploy`](#shopify-app-deploy)
* [`shopify app dev`](#shopify-app-dev)
* [`shopify app dev clean`](#shopify-app-dev-clean)
* [`shopify app env pull`](#shopify-app-env-pull)
* [`shopify app env show`](#shopify-app-env-show)
* [`shopify app execute`](#shopify-app-execute)
* [`shopify app function build`](#shopify-app-function-build)
* [`shopify app function info`](#shopify-app-function-info)
* [`shopify app function replay`](#shopify-app-function-replay)
* [`shopify app function run`](#shopify-app-function-run)
* [`shopify app function schema`](#shopify-app-function-schema)
* [`shopify app function typegen`](#shopify-app-function-typegen)
* [`shopify app generate extension`](#shopify-app-generate-extension)
* [`shopify app import-custom-data-definitions`](#shopify-app-import-custom-data-definitions)
* [`shopify app import-extensions`](#shopify-app-import-extensions)
* [`shopify app info`](#shopify-app-info)
* [`shopify app init`](#shopify-app-init)
* [`shopify app logs`](#shopify-app-logs)
* [`shopify app logs sources`](#shopify-app-logs-sources)
* [`shopify app release --version <version>`](#shopify-app-release---version-version)
* [`shopify app versions list`](#shopify-app-versions-list)
* [`shopify app webhook trigger`](#shopify-app-webhook-trigger)
* [`shopify auth login`](#shopify-auth-login)
* [`shopify auth logout`](#shopify-auth-logout)
* [`shopify commands`](#shopify-commands)
* [`shopify config autocorrect off`](#shopify-config-autocorrect-off)
* [`shopify config autocorrect on`](#shopify-config-autocorrect-on)
* [`shopify config autocorrect status`](#shopify-config-autocorrect-status)
* [`shopify help [command] [flags]`](#shopify-help-command-flags)
* [`shopify hydrogen build`](#shopify-hydrogen-build)
* [`shopify hydrogen check RESOURCE`](#shopify-hydrogen-check-resource)
* [`shopify hydrogen codegen`](#shopify-hydrogen-codegen)
* [`shopify hydrogen customer-account-push`](#shopify-hydrogen-customer-account-push)
* [`shopify hydrogen debug cpu`](#shopify-hydrogen-debug-cpu)
* [`shopify hydrogen deploy`](#shopify-hydrogen-deploy)
* [`shopify hydrogen dev`](#shopify-hydrogen-dev)
* [`shopify hydrogen env list`](#shopify-hydrogen-env-list)
* [`shopify hydrogen env pull`](#shopify-hydrogen-env-pull)
* [`shopify hydrogen env push`](#shopify-hydrogen-env-push)
* [`shopify hydrogen generate route ROUTENAME`](#shopify-hydrogen-generate-route-routename)
* [`shopify hydrogen generate routes`](#shopify-hydrogen-generate-routes)
* [`shopify hydrogen init`](#shopify-hydrogen-init)
* [`shopify hydrogen link`](#shopify-hydrogen-link)
* [`shopify hydrogen list`](#shopify-hydrogen-list)
* [`shopify hydrogen login`](#shopify-hydrogen-login)
* [`shopify hydrogen logout`](#shopify-hydrogen-logout)
* [`shopify hydrogen preview`](#shopify-hydrogen-preview)
* [`shopify hydrogen setup`](#shopify-hydrogen-setup)
* [`shopify hydrogen setup css [STRATEGY]`](#shopify-hydrogen-setup-css-strategy)
* [`shopify hydrogen setup markets [STRATEGY]`](#shopify-hydrogen-setup-markets-strategy)
* [`shopify hydrogen setup vite`](#shopify-hydrogen-setup-vite)
* [`shopify hydrogen shortcut`](#shopify-hydrogen-shortcut)
* [`shopify hydrogen unlink`](#shopify-hydrogen-unlink)
* [`shopify hydrogen upgrade`](#shopify-hydrogen-upgrade)
* [`shopify plugins add PLUGIN`](#shopify-plugins-add-plugin)
* [`shopify plugins:inspect PLUGIN...`](#shopify-pluginsinspect-plugin)
* [`shopify plugins install PLUGIN`](#shopify-plugins-install-plugin)
* [`shopify plugins link PATH`](#shopify-plugins-link-path)
* [`shopify plugins remove [PLUGIN]`](#shopify-plugins-remove-plugin)
* [`shopify plugins reset`](#shopify-plugins-reset)
* [`shopify plugins uninstall [PLUGIN]`](#shopify-plugins-uninstall-plugin)
* [`shopify plugins unlink [PLUGIN]`](#shopify-plugins-unlink-plugin)
* [`shopify plugins update`](#shopify-plugins-update)
* [`shopify search [query]`](#shopify-search-query)
* [`shopify theme check`](#shopify-theme-check)
* [`shopify theme console`](#shopify-theme-console)
* [`shopify theme delete`](#shopify-theme-delete)
* [`shopify theme dev`](#shopify-theme-dev)
* [`shopify theme duplicate`](#shopify-theme-duplicate)
* [`shopify theme info`](#shopify-theme-info)
* [`shopify theme init [name] [flags]`](#shopify-theme-init-name-flags)
* [`shopify theme language-server`](#shopify-theme-language-server)
* [`shopify theme list`](#shopify-theme-list)
* [`shopify theme metafields pull`](#shopify-theme-metafields-pull)
* [`shopify theme open`](#shopify-theme-open)
* [`shopify theme package`](#shopify-theme-package)
* [`shopify theme profile`](#shopify-theme-profile)
* [`shopify theme publish`](#shopify-theme-publish)
* [`shopify theme pull`](#shopify-theme-pull)
* [`shopify theme push`](#shopify-theme-push)
* [`shopify theme rename`](#shopify-theme-rename)
* [`shopify theme share`](#shopify-theme-share)
* [`shopify upgrade`](#shopify-upgrade)
* [`shopify version`](#shopify-version)

## `shopify app build`

Build the app, including extensions.

```
USAGE
  $ shopify app build [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ]
    [--skip-dependencies-installation] [--verbose]

FLAGS
  -c, --config=<value>                  [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>               [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color                        [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>                    [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset                           [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --skip-dependencies-installation  [env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION] Skips the installation of
                                        dependencies. Deprecated, use workspaces instead.
      --verbose                         [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Build the app, including extensions.

  This command executes the build script specified in the element's TOML file. You can specify a custom script in the
  file. To learn about configuration files in Shopify apps, refer to "App configuration"
  (https://shopify.dev/docs/apps/tools/cli/configuration).

  If you're building a "theme app extension" (https://shopify.dev/docs/apps/online-store/theme-app-extensions), then
  running the `build` command runs "Theme Check" (https://shopify.dev/docs/themes/tools/theme-check) against your
  extension to ensure that it's valid.
```

## `shopify app bulk cancel`

Cancel a bulk operation.

```
USAGE
  $ shopify app bulk cancel --id <value> [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset |
    ] [-s <value>] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -s, --store=<value>      [env: SHOPIFY_FLAG_STORE] The store domain. Must be an existing dev store.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --id=<value>         (required) [env: SHOPIFY_FLAG_ID] The bulk operation ID to cancel (numeric ID or full GID).
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Cancel a bulk operation.

  Cancels a running bulk operation by ID.
```

## `shopify app bulk execute`

Execute bulk operations.

```
USAGE
  $ shopify app bulk execute [--client-id <value> | -c <value>] [--no-color] [--output-file <value> --watch] [--path
    <value>] [-q <value>] [--query-file <value>] [--reset | ] [-s <value>] [--variable-file <value> | -v <value>...]
    [--verbose] [--version <value>]

FLAGS
  -c, --config=<value>         [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -q, --query=<value>          [env: SHOPIFY_FLAG_QUERY] The GraphQL query or mutation to run as a bulk operation.
  -s, --store=<value>          [env: SHOPIFY_FLAG_STORE] The store domain. Must be an existing dev store.
  -v, --variables=<value>...   [env: SHOPIFY_FLAG_VARIABLES] The values for any GraphQL variables in your mutation, in
                               JSON format. Can be specified multiple times.
      --client-id=<value>      [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color               [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --output-file=<value>    [env: SHOPIFY_FLAG_OUTPUT_FILE] The file path where results should be written if --watch
                               is specified. If not specified, results will be written to STDOUT.
      --path=<value>           [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --query-file=<value>     [env: SHOPIFY_FLAG_QUERY_FILE] Path to a file containing the GraphQL query or mutation.
                               Can't be used with --query.
      --reset                  [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --variable-file=<value>  [env: SHOPIFY_FLAG_VARIABLE_FILE] Path to a file containing GraphQL variables in JSONL
                               format (one JSON object per line). Can't be used with --variables.
      --verbose                [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.
      --version=<value>        [env: SHOPIFY_FLAG_VERSION] The API version to use for the bulk operation. If not
                               specified, uses the latest stable version.
      --watch                  [env: SHOPIFY_FLAG_WATCH] Wait for bulk operation results before exiting. Defaults to
                               false.

DESCRIPTION
  Execute bulk operations.

  Executes an Admin API GraphQL query or mutation on the specified store, as a bulk operation. Mutations are only
  allowed on dev stores.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about "bulk query operations"
  (https://shopify.dev/docs/api/usage/bulk-operations/queries) and "bulk mutation operations"
  (https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Use "`bulk status`" (https://shopify.dev/docs/api/shopify-cli/app/app-bulk-status) to check the status of your bulk
  operations.
```

## `shopify app bulk status`

Check the status of bulk operations.

```
USAGE
  $ shopify app bulk status [--client-id <value> | -c <value>] [--id <value>] [--no-color] [--path <value>] [--reset
    | ] [-s <value>] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -s, --store=<value>      [env: SHOPIFY_FLAG_STORE] The store domain. Must be an existing dev store.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --id=<value>         [env: SHOPIFY_FLAG_ID] The bulk operation ID (numeric ID or full GID). If not provided, lists
                           all bulk operations belonging to this app on this store in the last 7 days.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Check the status of bulk operations.

  Check the status of a specific bulk operation by ID, or list all bulk operations belonging to this app on this store
  in the last 7 days.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about "bulk query operations"
  (https://shopify.dev/docs/api/usage/bulk-operations/queries) and "bulk mutation operations"
  (https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Use "`bulk execute`" (https://shopify.dev/docs/api/shopify-cli/app/app-bulk-execute) to start a new bulk operation.
```

## `shopify app config link`

Fetch your app configuration from the Developer Dashboard.

```
USAGE
  $ shopify app config link [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Fetch your app configuration from the Developer Dashboard.

  Pulls app configuration from the Developer Dashboard and creates or overwrites a configuration file. You can create a
  new app with this command to start with a default configuration file.

  For more information on the format of the created TOML configuration file, refer to the "App configuration"
  (https://shopify.dev/docs/apps/tools/cli/configuration) page.
```

## `shopify app config pull`

Refresh an already-linked app configuration without prompts.

```
USAGE
  $ shopify app config pull [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Refresh an already-linked app configuration without prompts.

  Pulls the latest configuration from the already-linked Shopify app and updates the selected configuration file.

  This command reuses the existing linked app and organization and skips all interactive prompts. Use `--config` to
  target a specific configuration file, or omit it to use the default one.
```

## `shopify app config use [config] [flags]`

Activate an app configuration.

```
USAGE
  $ shopify app config use [config] [flags]

ARGUMENTS
  [CONFIG]  The name of the app configuration. Can be 'shopify.app.staging.toml' or simply 'staging'.

FLAGS
  --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
  --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
  --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
  --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
  --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Activate an app configuration.

  Sets default configuration when you run app-related CLI commands. If you omit the `config-name` parameter, then you'll
  be prompted to choose from the configuration files in your project.
```

## `shopify app deploy`

Deploy your Shopify app.

```
USAGE
  $ shopify app deploy [--client-id <value> | -c <value>] [-f] [--message <value>] [--no-build] [--no-color]
    [--no-release | --allow-updates | --allow-deletes] [--path <value>] [--reset | ] [--source-control-url <value>]
    [--verbose] [--version <value>]

FLAGS
  -c, --config=<value>              [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -f, --force                       [env: SHOPIFY_FLAG_FORCE] Deploy without asking for confirmation. Equivalent to
                                    --allow-updates --allow-deletes. For CI/CD environments, the recommended flag is
                                    --allow-updates.
      --allow-deletes               [env: SHOPIFY_FLAG_ALLOW_DELETES] Allows removing extensions and configuration
                                    without requiring user confirmation. For CI/CD environments, the recommended flag is
                                    --allow-updates.
      --allow-updates               [env: SHOPIFY_FLAG_ALLOW_UPDATES] Allows adding and updating extensions and
                                    configuration without requiring user confirmation. Recommended option for CI/CD
                                    environments.
      --client-id=<value>           [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --message=<value>             [env: SHOPIFY_FLAG_MESSAGE] Optional message that will be associated with this
                                    version. This is for internal use only and won't be available externally.
      --no-build                    [env: SHOPIFY_FLAG_NO_BUILD] Use with caution: Skips building any elements of the
                                    app that require building. You should ensure your app has been prepared in advance,
                                    such as by running `shopify app build` or by caching build artifacts.
      --no-color                    [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --no-release                  [env: SHOPIFY_FLAG_NO_RELEASE] Creates a version but doesn't release it - it's not
                                    made available to merchants. With this flag, a user confirmation is not required.
      --path=<value>                [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset                       [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --source-control-url=<value>  [env: SHOPIFY_FLAG_SOURCE_CONTROL_URL] URL associated with the new app version.
      --verbose                     [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.
      --version=<value>             [env: SHOPIFY_FLAG_VERSION] Optional version tag that will be associated with this
                                    app version. If not provided, an auto-generated identifier will be generated for
                                    this app version.

DESCRIPTION
  Deploy your Shopify app.

  "Builds the app" (https://shopify.dev/docs/api/shopify-cli/app/app-build), then deploys your app configuration and
  extensions.

  This command creates an app version, which is a snapshot of your app configuration and all extensions. This version is
  then released to users.

  This command doesn't deploy your "web app" (https://shopify.dev/docs/apps/tools/cli/structure#web-components). You
  need to "deploy your web app" (https://shopify.dev/docs/apps/deployment/web) to your own hosting solution.
```

## `shopify app dev`

Run the app.

```
USAGE
  $ shopify app dev [--checkout-cart-url <value>] [--client-id <value> | -c <value>] [--localhost-port
    <value>] [--no-color] [--no-update] [--notify <value>] [--path <value>] [--reset | ]
    [--skip-dependencies-installation] [-s <value>] [--subscription-product-url <value>] [-t <value>]
    [--theme-app-extension-port <value>] [--use-localhost | [--tunnel-url <value> | ]] [--verbose]

FLAGS
  -c, --config=<value>                    [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -s, --store=<value>                     [env: SHOPIFY_FLAG_STORE] Store URL. Must be an existing development or
                                          Shopify Plus sandbox store.
  -t, --theme=<value>                     [env: SHOPIFY_FLAG_THEME] Theme ID or name of the theme app extension host
                                          theme.
      --checkout-cart-url=<value>         [env: SHOPIFY_FLAG_CHECKOUT_CART_URL] Resource URL for checkout UI extension.
                                          Format: "/cart/{productVariantID}:{productQuantity}"
      --client-id=<value>                 [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --localhost-port=<value>            [env: SHOPIFY_FLAG_LOCALHOST_PORT] Port to use for localhost.
      --no-color                          [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --no-update                         [env: SHOPIFY_FLAG_NO_UPDATE] Uses the app URL from the toml file instead an
                                          autogenerated URL for dev.
      --notify=<value>                    [env: SHOPIFY_FLAG_NOTIFY] The file path or URL. The file path is to a file
                                          that you want updated on idle. The URL path is where you want a webhook posted
                                          to report on file changes.
      --path=<value>                      [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset                             [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --skip-dependencies-installation    [env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION] Skips the installation of
                                          dependencies. Deprecated, use workspaces instead.
      --subscription-product-url=<value>  [env: SHOPIFY_FLAG_SUBSCRIPTION_PRODUCT_URL] Resource URL for subscription UI
                                          extension. Format: "/products/{productId}"
      --theme-app-extension-port=<value>  [env: SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT] Local port of the theme app
                                          extension development server.
      --tunnel-url=<value>                [env: SHOPIFY_FLAG_TUNNEL_URL] Use a custom tunnel, it must be running before
                                          executing dev. Format: "https://my-tunnel-url:port".
      --use-localhost                     [env: SHOPIFY_FLAG_USE_LOCALHOST] Service entry point will listen to
                                          localhost. A tunnel won't be used. Will work for testing many app features,
                                          but not those that directly invoke your app (E.g: Webhooks)
      --verbose                           [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Run the app.

  Builds and previews your app on a dev store, and watches for changes. "Read more about testing apps locally"
  (https://shopify.dev/docs/apps/build/cli-for-apps/test-apps-locally).
```

## `shopify app dev clean`

Cleans up the dev preview from the selected store.

```
USAGE
  $ shopify app dev clean [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ] [-s
    <value>] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -s, --store=<value>      [env: SHOPIFY_FLAG_STORE] Store URL. Must be an existing development store.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Cleans up the dev preview from the selected store.

  Stop the dev preview that was started with `shopify app dev`.

  It restores the app's active version to the selected development store.
```

## `shopify app env pull`

Pull app and extensions environment variables.

```
USAGE
  $ shopify app env pull [--client-id <value> | -c <value>] [--env-file <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --env-file=<value>   [env: SHOPIFY_FLAG_ENV_FILE] Specify an environment file to update if the update flag is set
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Pull app and extensions environment variables.

  Creates or updates an `.env` files that contains app and app extension environment variables.

  When an existing `.env` file is updated, changes to the variables are displayed in the terminal output. Existing
  variables and commented variables are preserved.
```

## `shopify app env show`

Display app and extensions environment variables.

```
USAGE
  $ shopify app env show [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Display app and extensions environment variables.

  Displays environment variables that can be used to deploy apps and app extensions.
```

## `shopify app execute`

Execute GraphQL queries and mutations.

```
USAGE
  $ shopify app execute [--client-id <value> | -c <value>] [--no-color] [--output-file <value>] [--path <value>]
    [-q <value>] [--query-file <value>] [--reset | ] [-s <value>] [--variable-file <value> | -v <value>] [--verbose]
    [--version <value>]

FLAGS
  -c, --config=<value>         [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -q, --query=<value>          [env: SHOPIFY_FLAG_QUERY] The GraphQL query or mutation, as a string.
  -s, --store=<value>          [env: SHOPIFY_FLAG_STORE] The myshopify.com domain of the store to execute against. The
                               app must be installed on the store. If not specified, you will be prompted to select a
                               store.
  -v, --variables=<value>      [env: SHOPIFY_FLAG_VARIABLES] The values for any GraphQL variables in your query or
                               mutation, in JSON format.
      --client-id=<value>      [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color               [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --output-file=<value>    [env: SHOPIFY_FLAG_OUTPUT_FILE] The file name where results should be written, instead of
                               STDOUT.
      --path=<value>           [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --query-file=<value>     [env: SHOPIFY_FLAG_QUERY_FILE] Path to a file containing the GraphQL query or mutation.
                               Can't be used with --query.
      --reset                  [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --variable-file=<value>  [env: SHOPIFY_FLAG_VARIABLE_FILE] Path to a file containing GraphQL variables in JSON
                               format. Can't be used with --variables.
      --verbose                [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.
      --version=<value>        [env: SHOPIFY_FLAG_VERSION] The API version to use for the query or mutation. Defaults to
                               the latest stable version.

DESCRIPTION
  Execute GraphQL queries and mutations.

  Executes an Admin API GraphQL query or mutation on the specified store. Mutations are only allowed on dev stores.

  For operations that process large amounts of data, use "`bulk execute`"
  (https://shopify.dev/docs/api/shopify-cli/app/app-bulk-execute) instead.
```

## `shopify app function build`

Compile a function to wasm.

```
USAGE
  $ shopify app function build [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your function directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Compile a function to wasm.

  Compiles the function in your current directory to WebAssembly (Wasm) for testing purposes.
```

## `shopify app function info`

Print basic information about your function.

```
USAGE
  $ shopify app function info [--client-id <value> | -c <value>] [-j] [--no-color] [--path <value>] [--reset | ]
    [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -j, --json               [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your function directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Print basic information about your function.

  The information returned includes the following:

  - The function handle
  - The function name
  - The function API version
  - The targeting configuration
  - The schema path
  - The WASM path
  - The function runner path
```

## `shopify app function replay`

Replays a function run from an app log.

```
USAGE
  $ shopify app function replay [--client-id <value> | -c <value>] [-j] [-l <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose] [-w]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -j, --json               [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
  -l, --log=<value>        [env: SHOPIFY_FLAG_LOG] Specifies a log identifier to replay instead of selecting from a
                           list. The identifier is provided in the output of `shopify app dev` and is the suffix of the
                           log file name.
  -w, --[no-]watch         [env: SHOPIFY_FLAG_WATCH] Re-run the function when the source code changes.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your function directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Replays a function run from an app log.

  Runs the function from your current directory for "testing purposes"
  (https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when
  errors occur, refer to "Shopify Functions error handling" (https://shopify.dev/docs/api/functions/errors).
```

## `shopify app function run`

Run a function locally for testing.

```
USAGE
  $ shopify app function run [--client-id <value> | -c <value>] [-e <value>] [-i <value>] [-j] [--no-color] [--path
    <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -e, --export=<value>     [env: SHOPIFY_FLAG_EXPORT] Name of the WebAssembly export to invoke.
  -i, --input=<value>      [env: SHOPIFY_FLAG_INPUT] The input JSON to pass to the function. If omitted, standard input
                           is used.
  -j, --json               [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your function directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Run a function locally for testing.

  Runs the function from your current directory for "testing purposes"
  (https://shopify.dev/docs/apps/functions/testing-and-debugging). To learn how you can monitor and debug functions when
  errors occur, refer to "Shopify Functions error handling" (https://shopify.dev/docs/api/functions/errors).
```

## `shopify app function schema`

Fetch the latest GraphQL schema for a function.

```
USAGE
  $ shopify app function schema [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ] [--stdout]
    [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your function directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --stdout             [env: SHOPIFY_FLAG_STDOUT] Output the schema to stdout instead of writing to a file.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Fetch the latest GraphQL schema for a function.

  Generates the latest "GraphQL schema" (https://shopify.dev/docs/apps/functions/input-output#graphql-schema) for a
  function in your app. Run this command from the function directory.

  This command uses the API type and version of your function, as defined in your extension TOML file, to generate the
  latest GraphQL schema. The schema is written to the `schema.graphql` file.
```

## `shopify app function typegen`

Generate GraphQL types for a function.

```
USAGE
  $ shopify app function typegen [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ]
  [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your function directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Generate GraphQL types for a function.

  Creates GraphQL types based on your "input query" (https://shopify.dev/docs/apps/functions/input-output#input) for a
  function. Supports JavaScript functions out of the box, or any language via the `build.typegen_command` configuration.
```

## `shopify app generate extension`

Generate a new app Extension.

```
USAGE
  $ shopify app generate extension [--client-id <value> | -c <value>] [--flavor
    vanilla-js|react|typescript|typescript-react|wasm|rust] [-n <value>] [--no-color] [--path <value>] [--reset | ] [-t
    <value>] [-t <value>] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -n, --name=<value>       [env: SHOPIFY_FLAG_NAME] name of your Extension
  -t, --template=<value>   [env: SHOPIFY_FLAG_EXTENSION_TEMPLATE] Extension template
  -t, --type=<value>       [env: SHOPIFY_FLAG_EXTENSION_TYPE] Deprecated. Please use --template
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --flavor=<option>    [env: SHOPIFY_FLAG_FLAVOR] Choose a starting template for your extension, where applicable
                           <options: vanilla-js|react|typescript|typescript-react|wasm|rust>
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Generate a new app Extension.

  Generates a new "app extension" (https://shopify.dev/docs/apps/app-extensions). For a list of app extensions that you
  can generate using this command, refer to "Supported extensions"
  (https://shopify.dev/docs/apps/structure/app-extensions/list).

  Each new app extension is created in a folder under `extensions/`. To learn more about the extensions file structure,
  refer to "App structure" (https://shopify.dev/docs/apps/tools/cli/structure) and the documentation for your extension.
```

## `shopify app import-custom-data-definitions`

Import metafield and metaobject definitions.

```
USAGE
  $ shopify app import-custom-data-definitions [--client-id <value> | -c <value>] [--include-existing] [--no-color] [--path <value>]
    [--reset | ] [-s <value>] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -s, --store=<value>      [env: SHOPIFY_FLAG_STORE] Store URL. Must be an existing development or Shopify Plus sandbox
                           store.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --include-existing   [env: SHOPIFY_FLAG_INCLUDE_EXISTING] Include existing declared definitions in the output.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Import metafield and metaobject definitions.

  Import metafield and metaobject definitions from your development store. "Read more about declarative custom data
  definitions" (https://shopify.dev/docs/apps/build/custom-data/declarative-custom-data-definitions).
```

## `shopify app import-extensions`

Import dashboard-managed extensions into your app.

```
USAGE
  $ shopify app import-extensions [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ]
  [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Import dashboard-managed extensions into your app.
```

## `shopify app info`

Print basic information about your app and extensions.

```
USAGE
  $ shopify app info [--client-id <value> | -c <value>] [-j] [--no-color] [--path <value>] [--reset | ]
    [--verbose] [--web-env]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -j, --json               [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.
      --web-env            [env: SHOPIFY_FLAG_OUTPUT_WEB_ENV] Outputs environment variables necessary for running and
                           deploying web/.

DESCRIPTION
  Print basic information about your app and extensions.

  The information returned includes the following:

  - The app and dev store that's used when you run the "dev" (https://shopify.dev/docs/api/shopify-cli/app/app-dev)
  command. You can reset these configurations using "`dev --reset`"
  (https://shopify.dev/docs/api/shopify-cli/app/app-dev#flags-propertydetail-reset).
  - The "structure" (https://shopify.dev/docs/apps/tools/cli/structure) of your app project.
  - The "access scopes" (https://shopify.dev/docs/api/usage) your app has requested.
  - System information, including the package manager and version of Shopify CLI used in the project.
```

## `shopify app init`

Create a new app project

```
USAGE
  $ shopify app init [--client-id <value> | ] [--flavor <value>] [-n <value>] [--no-color] [-d
    npm|yarn|pnpm|bun] [-p <value>] [--template <value>] [--verbose]

FLAGS
  -d, --package-manager=<option>  [env: SHOPIFY_FLAG_PACKAGE_MANAGER]
                                  <options: npm|yarn|pnpm|bun>
  -n, --name=<value>              [env: SHOPIFY_FLAG_NAME]
  -p, --path=<value>              [default: ., env: SHOPIFY_FLAG_PATH]
      --client-id=<value>         [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app. Use this to automatically
                                  link your new project to an existing app. Using this flag avoids the app selection
                                  prompt.
      --flavor=<value>            [env: SHOPIFY_FLAG_TEMPLATE_FLAVOR] Which flavor of the given template to use.
      --no-color                  [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --template=<value>          [env: SHOPIFY_FLAG_TEMPLATE] The app template. Accepts one of the following:
                                  - <reactRouter|remix|none>
                                  - Any GitHub repo with optional branch and subpath, e.g.,
                                  https://github.com/Shopify/<repository>/[subpath]#[branch]
      --verbose                   [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.
```

## `shopify app logs`

Stream detailed logs for your Shopify app.

```
USAGE
  $ shopify app logs [--client-id <value> | -c <value>] [-j] [--no-color] [--path <value>] [--reset | ]
    [--source <value>...] [--status success|failure] [-s <value>...] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -j, --json               [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
  -s, --store=<value>...   [env: SHOPIFY_FLAG_STORE] Store URL. Must be an existing development or Shopify Plus sandbox
                           store.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --source=<value>...  [env: SHOPIFY_FLAG_SOURCE] Filters output to the specified log source.
      --status=<option>    [env: SHOPIFY_FLAG_STATUS] Filters output to the specified status (success or failure).
                           <options: success|failure>
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Stream detailed logs for your Shopify app.


  Opens a real-time stream of detailed app logs from the selected app and store.
  Use the `--source` argument to limit output to a particular log source, such as a specific Shopify Function handle.
  Use the `shopify app logs sources` command to view a list of sources.
  Use the `--status` argument to filter on status, either `success` or `failure`.
  ```
  shopify app logs --status=success --source=extension.discount-function
  ```
```

## `shopify app logs sources`

Print out a list of sources that may be used with the logs command.

```
USAGE
  $ shopify app logs sources [--client-id <value> | -c <value>] [--no-color] [--path <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Print out a list of sources that may be used with the logs command.

  The output source names can be used with the `--source` argument of `shopify app logs` to filter log output. Currently
  only function extensions are supported as sources.
```

## `shopify app release --version <version>`

Release an app version.

```
USAGE
  $ shopify app release --version <version>

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -f, --force              [env: SHOPIFY_FLAG_FORCE] Release without asking for confirmation. Equivalent to
                           --allow-updates --allow-deletes. For CI/CD environments, the recommended flag is
                           --allow-updates.
      --allow-deletes      [env: SHOPIFY_FLAG_ALLOW_DELETES] Allows removing extensions and configuration without
                           requiring user confirmation. For CI/CD environments, the recommended flag is --allow-updates.
      --allow-updates      [env: SHOPIFY_FLAG_ALLOW_UPDATES] Allows adding and updating extensions and configuration
                           without requiring user confirmation. Recommended option for CI/CD environments.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.
      --version=<value>    (required) [env: SHOPIFY_FLAG_VERSION] The name of the app version to release.

DESCRIPTION
  Release an app version.

  Releases an existing app version. Pass the name of the version that you want to release using the `--version` flag.
```

## `shopify app versions list`

List deployed versions of your app.

```
USAGE
  $ shopify app versions list [--client-id <value> | -c <value>] [-j] [--no-color] [--path <value>] [--reset | ]
    [--verbose]

FLAGS
  -c, --config=<value>     [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.
  -j, --json               [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
      --client-id=<value>  [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path to your app directory.
      --reset              [env: SHOPIFY_FLAG_RESET] Reset all your settings.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  List deployed versions of your app.

  Lists the deployed app versions. An app version is a snapshot of your app extensions.
```

## `shopify app webhook trigger`

Trigger delivery of a sample webhook topic payload to a designated address.

```
USAGE
  $ shopify app webhook trigger [--address <value>] [--api-version <value>] [--client-id <value> | -c <value>]
    [--client-secret <value>] [--delivery-method http|google-pub-sub|event-bridge] [--help] [--path <value>] [--reset |
    ] [--shared-secret <value>] [--topic <value>]

FLAGS
  -c, --config=<value>
      [env: SHOPIFY_FLAG_APP_CONFIG] The name of the app configuration.

  --address=<value>
      [env: SHOPIFY_FLAG_ADDRESS] The URL where the webhook payload should be sent.
      You will need a different address type for each delivery-method:
      · For remote HTTP testing, use a URL that starts with https://
      · For local HTTP testing, use http://localhost:{port}/{url-path}
      · For Google Pub/Sub, use pubsub://{project-id}:{topic-id}
      · For Amazon EventBridge, use an Amazon Resource Name (ARN) starting with arn:aws:events:

  --api-version=<value>
      [env: SHOPIFY_FLAG_API_VERSION] The API Version of the webhook topic.

  --client-id=<value>
      [env: SHOPIFY_FLAG_CLIENT_ID] The Client ID of your app.

  --client-secret=<value>
      [env: SHOPIFY_FLAG_CLIENT_SECRET] Your app's client secret. This secret allows us to return the
      X-Shopify-Hmac-SHA256 header that lets you validate the origin of the response that you receive.

  --delivery-method=<option>
      [env: SHOPIFY_FLAG_DELIVERY_METHOD] Method chosen to deliver the topic payload. If not passed, it's inferred from
      the address.
      <options: http|google-pub-sub|event-bridge>

  --help
      [env: SHOPIFY_FLAG_HELP] This help. When you run the trigger command the CLI will prompt you for any information
      that isn't passed using flags.

  --path=<value>
      [env: SHOPIFY_FLAG_PATH] The path to your app directory.

  --reset
      [env: SHOPIFY_FLAG_RESET] Reset all your settings.

  --shared-secret=<value>
      [env: SHOPIFY_FLAG_SHARED_SECRET] Deprecated. Please use client-secret.

  --topic=<value>
      [env: SHOPIFY_FLAG_TOPIC] The requested webhook topic.

DESCRIPTION
  Trigger delivery of a sample webhook topic payload to a designated address.


  Triggers the delivery of a sample Admin API event topic payload to a designated address.

  You should use this command to experiment with webhooks, to initially test your webhook configuration, or for unit
  testing. However, to test your webhook configuration from end to end, you should always trigger webhooks by performing
  the related action in Shopify.

  Because most webhook deliveries use remote endpoints, you can trigger the command from any directory where you can use
  Shopify CLI, and send the webhook to any of the supported endpoint types. For example, you can run the command from
  your app's local directory, but send the webhook to a staging environment endpoint.

  To learn more about using webhooks in a Shopify app, refer to "Webhooks overview"
  (https://shopify.dev/docs/apps/webhooks).

  ### Limitations

  - Webhooks triggered using this method always have the same payload, so they can't be used to test scenarios that
  differ based on the payload contents.
  - Webhooks triggered using this method aren't retried when they fail.
  - Trigger requests are rate-limited using the "Partner API rate limit"
  (https://shopify.dev/docs/api/partner#rate_limits).
  - You can't use this method to validate your API webhook subscriptions.
```

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

## `shopify auth logout`

Logs you out of the Shopify account or Partner account and store.

```
USAGE
  $ shopify auth logout

DESCRIPTION
  Logs you out of the Shopify account or Partner account and store.
```

## `shopify commands`

List all shopify commands.

```
USAGE
  $ shopify commands [-c id|plugin|summary|type... | --tree] [--deprecated] [-x | ] [--hidden] [--json]
    [--no-truncate | ] [--sort id|plugin|summary|type | ]

FLAGS
  -c, --columns=<option>...  Only show provided columns (comma-separated).
                             <options: id|plugin|summary|type>
  -x, --extended             Show extra columns.
      --deprecated           Show deprecated commands.
      --hidden               Show hidden commands.
      --no-truncate          Do not truncate output.
      --sort=<option>        [default: id] Property to sort by.
                             <options: id|plugin|summary|type>
      --tree                 Show tree of commands.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List all shopify commands.
```

## `shopify config autocorrect off`

Disable autocorrect. Off by default.

```
USAGE
  $ shopify config autocorrect off

DESCRIPTION
  Disable autocorrect. Off by default.

  Disable autocorrect. Off by default.

  When autocorrection is enabled, Shopify CLI automatically runs a corrected version of your command if a correction is
  available.

  When autocorrection is disabled, you need to confirm that you want to run corrections for mistyped commands.
```

## `shopify config autocorrect on`

Enable autocorrect. Off by default.

```
USAGE
  $ shopify config autocorrect on

DESCRIPTION
  Enable autocorrect. Off by default.

  Enable autocorrect. Off by default.

  When autocorrection is enabled, Shopify CLI automatically runs a corrected version of your command if a correction is
  available.

  When autocorrection is disabled, you need to confirm that you want to run corrections for mistyped commands.
```

## `shopify config autocorrect status`

Check whether autocorrect is enabled or disabled. On by default.

```
USAGE
  $ shopify config autocorrect status

DESCRIPTION
  Check whether autocorrect is enabled or disabled. On by default.

  Check whether autocorrect is enabled or disabled. On by default.

  When autocorrection is enabled, Shopify CLI automatically runs a corrected version of your command if a correction is
  available.

  When autocorrection is disabled, you need to confirm that you want to run corrections for mistyped commands.
```

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

## `shopify hydrogen build`

Builds a Hydrogen storefront for production.

```
USAGE
  $ shopify hydrogen build [--bundle-stats] [--codegen-config-path <value> --codegen] [--disable-route-warning]
    [--entry <value>] [--force-client-sourcemap] [--lockfile-check] [--path <value>] [--sourcemap] [--watch]

FLAGS
  --[no-]bundle-stats            Show a bundle size summary after building. Defaults to true, use `--no-bundle-stats` to
                                 disable.
  --codegen                      Automatically generates GraphQL types for your project’s Storefront API queries.
  --codegen-config-path=<value>  Specifies a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if
                                 this file exists.
  --disable-route-warning        [env: SHOPIFY_HYDROGEN_FLAG_DISABLE_ROUTE_WARNING] Disables any warnings about missing
                                 standard routes.
  --entry=<value>                [env: SHOPIFY_HYDROGEN_FLAG_ENTRY] Entry file for the worker. Defaults to `./server`.
  --force-client-sourcemap       [env: SHOPIFY_HYDROGEN_FLAG_FORCE_CLIENT_SOURCEMAP] Client sourcemapping is avoided by
                                 default because it makes backend code visible in the browser. Use this flag to force
                                 enabling it.
  --[no-]lockfile-check          [env: SHOPIFY_HYDROGEN_FLAG_LOCKFILE_CHECK] Checks that there is exactly one valid
                                 lockfile in the project. Defaults to `true`. Deactivate with `--no-lockfile-check`.
  --path=<value>                 [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                                 Defaults to the current directory where the command is run.
  --[no-]sourcemap               [env: SHOPIFY_HYDROGEN_FLAG_SOURCEMAP] Controls whether server sourcemaps are
                                 generated. Default to `true`. Deactivate `--no-sourcemaps`.
  --watch                        [env: SHOPIFY_HYDROGEN_FLAG_WATCH] Watches for changes and rebuilds the project writing
                                 output to disk.

DESCRIPTION
  Builds a Hydrogen storefront for production.
```

## `shopify hydrogen check RESOURCE`

Returns diagnostic information about a Hydrogen storefront.

```
USAGE
  $ shopify hydrogen check RESOURCE [--path <value>]

ARGUMENTS
  RESOURCE  (routes) The resource to check. Currently only 'routes' is supported.

FLAGS
  --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                  the current directory where the command is run.

DESCRIPTION
  Returns diagnostic information about a Hydrogen storefront.
```

## `shopify hydrogen codegen`

Generate types for the Storefront API queries found in your project.

```
USAGE
  $ shopify hydrogen codegen [--codegen-config-path <value>] [--path <value>] [--watch]

FLAGS
  --codegen-config-path=<value>  Specify a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if it
                                 exists.
  --path=<value>                 [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                                 Defaults to the current directory where the command is run.
  --watch                        Watch the project for changes to update types on file save.

DESCRIPTION
  Generate types for the Storefront API queries found in your project.
```

## `shopify hydrogen customer-account-push`

Push project configuration to admin

```
USAGE
  $ shopify hydrogen customer-account-push --dev-origin <value> [--path <value>] [--relative-logout-uri <value>]
    [--relative-redirect-uri <value>] [--storefront-id <value>]

FLAGS
  --dev-origin=<value>             (required) The development domain of your application.
  --path=<value>                   [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen
                                   storefront. Defaults to the current directory where the command is run.
  --relative-logout-uri=<value>    The relative url of allowed url that will be redirected to post-logout for Customer
                                   Account API OAuth flow. Default to nothing.
  --relative-redirect-uri=<value>  The relative url of allowed callback url for Customer Account API OAuth flow. Default
                                   is '/account/authorize'
  --storefront-id=<value>          The id of the storefront the configuration should be pushed to. Must start with
                                   'gid://shopify/HydrogenStorefront/'

DESCRIPTION
  Push project configuration to admin
```

## `shopify hydrogen debug cpu`

Builds and profiles the server startup time the app.

```
USAGE
  $ shopify hydrogen debug cpu [--entry <value>] [--output <value>] [--path <value>]

FLAGS
  --entry=<value>   [env: SHOPIFY_HYDROGEN_FLAG_ENTRY] Entry file for the worker. Defaults to `./server`.
  --output=<value>  [default: startup.cpuprofile] Specify a path to generate the profile file. Defaults to
                    "startup.cpuprofile".
  --path=<value>    [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                    the current directory where the command is run.

DESCRIPTION
  Builds and profiles the server startup time the app.
```

## `shopify hydrogen deploy`

Builds and deploys a Hydrogen storefront to Oxygen.

```
USAGE
  $ shopify hydrogen deploy [--auth-bypass-token-duration <value> --auth-bypass-token] [--build-command <value>]
    [--entry <value>] [--env <value> | --env-branch <value>] [--env-file <value>] [-f] [--force-client-sourcemap]
    [--json-output] [--lockfile-check] [--metadata-description <value>] [--metadata-user <value>] [--no-verify] [--path
    <value>] [--preview] [-s <value>] [-t <value>]

FLAGS
  -f, --force                               [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Forces a deployment to proceed if there
                                            are uncommited changes in its Git repository.
  -s, --shop=<value>                        [env: SHOPIFY_SHOP] Shop URL. It can be the shop prefix (janes-apparel) or
                                            the full myshopify.com URL (janes-apparel.myshopify.com,
                                            https://janes-apparel.myshopify.com).
  -t, --token=<value>                       [env: SHOPIFY_HYDROGEN_DEPLOYMENT_TOKEN] Oxygen deployment token. Defaults
                                            to the linked storefront's token if available.
      --auth-bypass-token                   [env: AUTH_BYPASS_TOKEN] Generate an authentication bypass token, which can
                                            be used to perform end-to-end tests against the deployment.
      --auth-bypass-token-duration=<value>  [env: AUTH_BYPASS_TOKEN_DURATION] Specify the duration (in hours) up to 12
                                            hours for the authentication bypass token. Defaults to `2`
      --build-command=<value>               Specify a build command to run before deploying. If not specified, `shopify
                                            hydrogen build` will be used.
      --entry=<value>                       [env: SHOPIFY_HYDROGEN_FLAG_ENTRY] Entry file for the worker. Defaults to
                                            `./server`.
      --env=<value>                         Specifies the environment to perform the operation using its handle. Fetch
                                            the handle using the `env list` command.
      --env-branch=<value>                  [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH] Specifies the environment to
                                            perform the operation using its Git branch name.
      --env-file=<value>                    Path to an environment file to override existing environment variables for
                                            the deployment.
      --force-client-sourcemap              [env: SHOPIFY_HYDROGEN_FLAG_FORCE_CLIENT_SOURCEMAP] Client sourcemapping is
                                            avoided by default because it makes backend code visible in the browser. Use
                                            this flag to force enabling it.
      --[no-]json-output                    Create a JSON file containing the deployment details in CI environments.
                                            Defaults to true, use `--no-json-output` to disable.
      --[no-]lockfile-check                 [env: SHOPIFY_HYDROGEN_FLAG_LOCKFILE_CHECK] Checks that there is exactly one
                                            valid lockfile in the project. Defaults to `true`. Deactivate with
                                            `--no-lockfile-check`.
      --metadata-description=<value>        [env: SHOPIFY_HYDROGEN_FLAG_METADATA_DESCRIPTION] Description of the changes
                                            in the deployment. Defaults to the commit message of the latest commit if
                                            there are no uncommited changes.
      --metadata-user=<value>               [env: SHOPIFY_HYDROGEN_FLAG_METADATA_USER] User that initiated the
                                            deployment. Will be saved and displayed in the Shopify admin
      --no-verify                           Skip the routability verification step after deployment.
      --path=<value>                        [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen
                                            storefront. Defaults to the current directory where the command is run.
      --preview                             Deploys to the Preview environment.

DESCRIPTION
  Builds and deploys a Hydrogen storefront to Oxygen.
```

## `shopify hydrogen dev`

Runs Hydrogen storefront in an Oxygen worker for development.

```
USAGE
  $ shopify hydrogen dev [--codegen-config-path <value> --codegen] [--customer-account-push] [--debug]
    [--disable-deps-optimizer] [--disable-version-check] [--disable-virtual-routes] [--entry <value>] [--env <value> |
    --env-branch <value>] [--env-file <value>] [--host] [--inspector-port <value>] [--path <value>] [--port <value>]
    [--verbose]

FLAGS
  --codegen                      Automatically generates GraphQL types for your project’s Storefront API queries.
  --codegen-config-path=<value>  Specifies a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if
                                 this file exists.
  --customer-account-push        [env: SHOPIFY_HYDROGEN_FLAG_CUSTOMER_ACCOUNT_PUSH] Use tunneling for local development
                                 and push the tunneling domain to admin. Required to use Customer Account API's OAuth
                                 flow
  --debug                        [env: SHOPIFY_HYDROGEN_FLAG_DEBUG] Enables inspector connections to the server with a
                                 debugger such as Visual Studio Code or Chrome DevTools.
  --disable-deps-optimizer       [env: SHOPIFY_HYDROGEN_FLAG_DISABLE_DEPS_OPTIMIZER] Disable adding dependencies to
                                 Vite's `ssr.optimizeDeps.include` automatically
  --disable-version-check        Skip the version check when running `hydrogen dev`
  --disable-virtual-routes       [env: SHOPIFY_HYDROGEN_FLAG_DISABLE_VIRTUAL_ROUTES] Disable rendering fallback routes
                                 when a route file doesn't exist.
  --entry=<value>                [env: SHOPIFY_HYDROGEN_FLAG_ENTRY] Entry file for the worker. Defaults to `./server`.
  --env=<value>                  Specifies the environment to perform the operation using its handle. Fetch the handle
                                 using the `env list` command.
  --env-branch=<value>           [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH] Specifies the environment to perform the
                                 operation using its Git branch name.
  --env-file=<value>             [default: .env] Path to an environment file to override existing environment variables.
                                 Defaults to the '.env' located in your project path `--path`.
  --host                         Expose the server to the local network
  --inspector-port=<value>       [env: SHOPIFY_HYDROGEN_FLAG_INSPECTOR_PORT] The port where the inspector is available.
                                 Defaults to 9229.
  --path=<value>                 [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                                 Defaults to the current directory where the command is run.
  --port=<value>                 [env: SHOPIFY_HYDROGEN_FLAG_PORT] The port to run the server on. Defaults to 3000.
  --verbose                      [env: SHOPIFY_HYDROGEN_FLAG_VERBOSE] Outputs more information about the command's
                                 execution.

DESCRIPTION
  Runs Hydrogen storefront in an Oxygen worker for development.
```

## `shopify hydrogen env list`

List the environments on your linked Hydrogen storefront.

```
USAGE
  $ shopify hydrogen env list [--path <value>]

FLAGS
  --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                  the current directory where the command is run.

DESCRIPTION
  List the environments on your linked Hydrogen storefront.
```

## `shopify hydrogen env pull`

Populate your .env with variables from your Hydrogen storefront.

```
USAGE
  $ shopify hydrogen env pull [--env <value> | --env-branch <value>] [--env-file <value>] [-f] [--path <value>]

FLAGS
  -f, --force               [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Overwrites the destination directory and files if they
                            already exist.
      --env=<value>         Specifies the environment to perform the operation using its handle. Fetch the handle using
                            the `env list` command.
      --env-branch=<value>  [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH] Specifies the environment to perform the
                            operation using its Git branch name.
      --env-file=<value>    [default: .env] Path to an environment file to override existing environment variables.
                            Defaults to the '.env' located in your project path `--path`.
      --path=<value>        [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                            Defaults to the current directory where the command is run.

DESCRIPTION
  Populate your .env with variables from your Hydrogen storefront.
```

## `shopify hydrogen env push`

Push environment variables from the local .env file to your linked Hydrogen storefront.

```
USAGE
  $ shopify hydrogen env push [--env <value> | ] [--env-file <value>] [--path <value>]

FLAGS
  --env=<value>       Specifies the environment to perform the operation using its handle. Fetch the handle using the
                      `env list` command.
  --env-file=<value>  [default: .env] Path to an environment file to override existing environment variables. Defaults
                      to the '.env' located in your project path `--path`.
  --path=<value>      [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults
                      to the current directory where the command is run.

DESCRIPTION
  Push environment variables from the local .env file to your linked Hydrogen storefront.
```

## `shopify hydrogen generate route ROUTENAME`

Generates a standard Shopify route.

```
USAGE
  $ shopify hydrogen generate route ROUTENAME [--adapter <value>] [-f] [--locale-param <value>] [--path <value>]
    [--typescript]

ARGUMENTS
  ROUTENAME  (home|page|cart|products|collections|policies|blogs|account|search|robots|sitemap|tokenlessApi|all) The
             route to generate. One of
             home,page,cart,products,collections,policies,blogs,account,search,robots,sitemap,tokenlessApi,all.

FLAGS
  -f, --force                 [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Overwrites the destination directory and files if they
                              already exist.
      --adapter=<value>       [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER] Remix adapter used in the route. The default is
                              `@shopify/remix-oxygen`.
      --locale-param=<value>  [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER] The param name in Remix routes for the i18n locale,
                              if any. Example: `locale` becomes ($locale).
      --path=<value>          [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                              Defaults to the current directory where the command is run.
      --typescript            [env: SHOPIFY_HYDROGEN_FLAG_TYPESCRIPT] Generate TypeScript files

DESCRIPTION
  Generates a standard Shopify route.
```

## `shopify hydrogen generate routes`

Generates all supported standard shopify routes.

```
USAGE
  $ shopify hydrogen generate routes [--adapter <value>] [-f] [--locale-param <value>] [--path <value>] [--typescript]

FLAGS
  -f, --force                 [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Overwrites the destination directory and files if they
                              already exist.
      --adapter=<value>       [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER] Remix adapter used in the route. The default is
                              `@shopify/remix-oxygen`.
      --locale-param=<value>  [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER] The param name in Remix routes for the i18n locale,
                              if any. Example: `locale` becomes ($locale).
      --path=<value>          [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                              Defaults to the current directory where the command is run.
      --typescript            [env: SHOPIFY_HYDROGEN_FLAG_TYPESCRIPT] Generate TypeScript files

DESCRIPTION
  Generates all supported standard shopify routes.
```

## `shopify hydrogen init`

Creates a new Hydrogen storefront.

```
USAGE
  $ shopify hydrogen init [-f] [--git] [--install-deps] [--language <value>] [--markets <value>] [--mock-shop]
    [--path <value>] [--quickstart] [--routes] [--shortcut] [--styling <value>] [--template <value>]

FLAGS
  -f, --force              [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Overwrites the destination directory and files if they
                           already exist.
      --[no-]git           [env: SHOPIFY_HYDROGEN_FLAG_GIT] Init Git and create initial commits.
      --[no-]install-deps  [env: SHOPIFY_HYDROGEN_FLAG_INSTALL_DEPS] Auto installs dependencies using the active package
                           manager.
      --language=<value>   [env: SHOPIFY_HYDROGEN_FLAG_LANGUAGE] Sets the template language to use. One of `js` or `ts`.
      --markets=<value>    [env: SHOPIFY_HYDROGEN_FLAG_I18N] Sets the URL structure to support multiple markets. Must be
                           one of: `subfolders`, `domains`, `subdomains`, `none`. Example: `--markets subfolders`.
      --mock-shop          [env: SHOPIFY_HYDROGEN_FLAG_MOCK_DATA] Use mock.shop as the data source for the storefront.
      --path=<value>       [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the new Hydrogen storefront.
      --quickstart         [env: SHOPIFY_HYDROGEN_FLAG_QUICKSTART] Scaffolds a new Hydrogen project with a set of
                           sensible defaults. Equivalent to `shopify hydrogen init --path hydrogen-quickstart
                           --mock-shop --language js --shortcut --routes --markets none`
      --[no-]routes        [env: SHOPIFY_HYDROGEN_FLAG_ROUTES] Generate routes for all pages.
      --[no-]shortcut      [env: SHOPIFY_HYDROGEN_FLAG_SHORTCUT] Creates a global h2 shortcut for Shopify CLI using
                           shell aliases. Deactivate with `--no-shortcut`.
      --styling=<value>    [env: SHOPIFY_HYDROGEN_FLAG_STYLING] Sets the styling strategy to use. One of `tailwind`,
                           `vanilla-extract`, `css-modules`, `postcss`, `none`.
      --template=<value>   [env: SHOPIFY_HYDROGEN_FLAG_TEMPLATE] Scaffolds project based on an existing template or
                           example from the Hydrogen repository.

DESCRIPTION
  Creates a new Hydrogen storefront.
```

## `shopify hydrogen link`

Link a local project to one of your shop's Hydrogen storefronts.

```
USAGE
  $ shopify hydrogen link [-f] [--path <value>] [--storefront <value>]

FLAGS
  -f, --force               [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Overwrites the destination directory and files if they
                            already exist.
      --path=<value>        [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                            Defaults to the current directory where the command is run.
      --storefront=<value>  [env: SHOPIFY_HYDROGEN_STOREFRONT] The name of a Hydrogen Storefront (e.g. "Jane's Apparel")

DESCRIPTION
  Link a local project to one of your shop's Hydrogen storefronts.
```

## `shopify hydrogen list`

Returns a list of Hydrogen storefronts available on a given shop.

```
USAGE
  $ shopify hydrogen list [--path <value>]

FLAGS
  --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                  the current directory where the command is run.

DESCRIPTION
  Returns a list of Hydrogen storefronts available on a given shop.
```

## `shopify hydrogen login`

Login to your Shopify account.

```
USAGE
  $ shopify hydrogen login [--path <value>] [-s <value>]

FLAGS
  -s, --shop=<value>  [env: SHOPIFY_SHOP] Shop URL. It can be the shop prefix (janes-apparel) or the full myshopify.com
                      URL (janes-apparel.myshopify.com, https://janes-apparel.myshopify.com).
      --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults
                      to the current directory where the command is run.

DESCRIPTION
  Login to your Shopify account.
```

## `shopify hydrogen logout`

Logout of your local session.

```
USAGE
  $ shopify hydrogen logout [--path <value>]

FLAGS
  --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                  the current directory where the command is run.

DESCRIPTION
  Logout of your local session.
```

## `shopify hydrogen preview`

Runs a Hydrogen storefront in an Oxygen worker for production.

```
USAGE
  $ shopify hydrogen preview [--codegen-config-path <value> [--codegen --build]] [--debug] [--entry <value> ] [--env
    <value> | --env-branch <value>] [--env-file <value>] [--inspector-port <value>] [--path <value>] [--port <value>]
    [--verbose] [--watch ]

FLAGS
  --build                        Builds the app before starting the preview server.
  --codegen                      Automatically generates GraphQL types for your project’s Storefront API queries.
  --codegen-config-path=<value>  Specifies a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if
                                 this file exists.
  --debug                        [env: SHOPIFY_HYDROGEN_FLAG_DEBUG] Enables inspector connections to the server with a
                                 debugger such as Visual Studio Code or Chrome DevTools.
  --entry=<value>                [env: SHOPIFY_HYDROGEN_FLAG_ENTRY] Entry file for the worker. Defaults to `./server`.
  --env=<value>                  Specifies the environment to perform the operation using its handle. Fetch the handle
                                 using the `env list` command.
  --env-branch=<value>           [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH] Specifies the environment to perform the
                                 operation using its Git branch name.
  --env-file=<value>             [default: .env] Path to an environment file to override existing environment variables.
                                 Defaults to the '.env' located in your project path `--path`.
  --inspector-port=<value>       [env: SHOPIFY_HYDROGEN_FLAG_INSPECTOR_PORT] The port where the inspector is available.
                                 Defaults to 9229.
  --path=<value>                 [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                                 Defaults to the current directory where the command is run.
  --port=<value>                 [env: SHOPIFY_HYDROGEN_FLAG_PORT] The port to run the server on. Defaults to 3000.
  --verbose                      [env: SHOPIFY_HYDROGEN_FLAG_VERBOSE] Outputs more information about the command's
                                 execution.
  --watch                        Watches for changes and rebuilds the project.

DESCRIPTION
  Runs a Hydrogen storefront in an Oxygen worker for production.
```

## `shopify hydrogen setup`

Scaffold routes and core functionality.

```
USAGE
  $ shopify hydrogen setup [-f] [--install-deps] [--markets <value>] [--path <value>] [--shortcut]

FLAGS
  -f, --force              [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Overwrites the destination directory and files if they
                           already exist.
      --[no-]install-deps  [env: SHOPIFY_HYDROGEN_FLAG_INSTALL_DEPS] Auto installs dependencies using the active package
                           manager.
      --markets=<value>    [env: SHOPIFY_HYDROGEN_FLAG_I18N] Sets the URL structure to support multiple markets. Must be
                           one of: `subfolders`, `domains`, `subdomains`, `none`. Example: `--markets subfolders`.
      --path=<value>       [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                           Defaults to the current directory where the command is run.
      --[no-]shortcut      [env: SHOPIFY_HYDROGEN_FLAG_SHORTCUT] Creates a global h2 shortcut for Shopify CLI using
                           shell aliases. Deactivate with `--no-shortcut`.

DESCRIPTION
  Scaffold routes and core functionality.
```

## `shopify hydrogen setup css [STRATEGY]`

Setup CSS strategies for your project.

```
USAGE
  $ shopify hydrogen setup css [STRATEGY] [-f] [--install-deps] [--path <value>]

ARGUMENTS
  [STRATEGY]  (tailwind|vanilla-extract|css-modules|postcss) The CSS strategy to setup. One of
              tailwind,vanilla-extract,css-modules,postcss

FLAGS
  -f, --force              [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Overwrites the destination directory and files if they
                           already exist.
      --[no-]install-deps  [env: SHOPIFY_HYDROGEN_FLAG_INSTALL_DEPS] Auto installs dependencies using the active package
                           manager.
      --path=<value>       [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                           Defaults to the current directory where the command is run.

DESCRIPTION
  Setup CSS strategies for your project.
```

## `shopify hydrogen setup markets [STRATEGY]`

Setup support for multiple markets in your project.

```
USAGE
  $ shopify hydrogen setup markets [STRATEGY] [--path <value>]

ARGUMENTS
  [STRATEGY]  (subfolders|domains|subdomains) The URL structure strategy to setup multiple markets. One of
              subfolders,domains,subdomains

FLAGS
  --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                  the current directory where the command is run.

DESCRIPTION
  Setup support for multiple markets in your project.
```

## `shopify hydrogen setup vite`

EXPERIMENTAL: Upgrades the project to use Vite.

```
USAGE
  $ shopify hydrogen setup vite [--path <value>]

FLAGS
  --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                  the current directory where the command is run.

DESCRIPTION
  EXPERIMENTAL: Upgrades the project to use Vite.
```

## `shopify hydrogen shortcut`

Creates a global `h2` shortcut for the Hydrogen CLI

```
USAGE
  $ shopify hydrogen shortcut

DESCRIPTION
  Creates a global `h2` shortcut for the Hydrogen CLI
```

## `shopify hydrogen unlink`

Unlink a local project from a Hydrogen storefront.

```
USAGE
  $ shopify hydrogen unlink [--path <value>]

FLAGS
  --path=<value>  [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront. Defaults to
                  the current directory where the command is run.

DESCRIPTION
  Unlink a local project from a Hydrogen storefront.
```

## `shopify hydrogen upgrade`

Upgrade Remix and Hydrogen npm dependencies.

```
USAGE
  $ shopify hydrogen upgrade [-f] [--path <value>] [-v <value>]

FLAGS
  -f, --force            [env: SHOPIFY_HYDROGEN_FLAG_FORCE] Ignore warnings and force the upgrade to the target version
  -v, --version=<value>  A target hydrogen version to update to
      --path=<value>     [env: SHOPIFY_HYDROGEN_FLAG_PATH] The path to the directory of the Hydrogen storefront.
                         Defaults to the current directory where the command is run.

DESCRIPTION
  Upgrade Remix and Hydrogen npm dependencies.
```

## `shopify plugins add PLUGIN`

Installs a plugin into shopify.

```
USAGE
  $ shopify plugins add PLUGIN... [-f] [-h] [--json] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

ALIASES
  $ shopify plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ shopify plugins add myplugin

  Install a plugin from a github url.

    $ shopify plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ shopify plugins add someuser/someplugin
```

## `shopify plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ shopify plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ shopify plugins inspect myplugin
```

## `shopify plugins install PLUGIN`

Installs a plugin into shopify.

```
USAGE
  $ shopify plugins install PLUGIN... [-f] [-h] [--json] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

ALIASES
  $ shopify plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ shopify plugins install myplugin

  Install a plugin from a github url.

    $ shopify plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ shopify plugins install someuser/someplugin
```

## `shopify plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ shopify plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ shopify plugins link myplugin
```

## `shopify plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ shopify plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ shopify plugins unlink
  $ shopify plugins remove

EXAMPLES
  $ shopify plugins remove myplugin
```

## `shopify plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ shopify plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

## `shopify plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ shopify plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ shopify plugins unlink
  $ shopify plugins remove

EXAMPLES
  $ shopify plugins uninstall myplugin
```

## `shopify plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ shopify plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ shopify plugins unlink
  $ shopify plugins remove

EXAMPLES
  $ shopify plugins unlink myplugin
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

## `shopify theme check`

Validate the theme.

```
USAGE
  $ shopify theme check [-a] [-C <value>] [-e <value>...] [--fail-level
    crash|error|suggestion|style|warning|info] [--init] [--list] [--no-color] [-o text|json] [--path <value>] [--print]
    [--verbose] [-v]

FLAGS
  -C, --config=<value>          [env: SHOPIFY_FLAG_CONFIG] Use the config provided, overriding .theme-check.yml if
                                present
                                Supports all theme-check: config values, e.g., theme-check:theme-app-extension,
                                theme-check:recommended, theme-check:all
                                For backwards compatibility, :theme_app_extension is also supported
  -a, --auto-correct            [env: SHOPIFY_FLAG_AUTO_CORRECT] Automatically fix offenses
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -o, --output=<option>         [default: text, env: SHOPIFY_FLAG_OUTPUT] The output format to use
                                <options: text|json>
  -v, --version                 [env: SHOPIFY_FLAG_VERSION] Print Theme Check version
      --fail-level=<option>     [default: error, env: SHOPIFY_FLAG_FAIL_LEVEL] Minimum severity for exit with error code
                                <options: crash|error|suggestion|style|warning|info>
      --init                    [env: SHOPIFY_FLAG_INIT] Generate a .theme-check.yml file
      --list                    [env: SHOPIFY_FLAG_LIST] List enabled checks
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --print                   [env: SHOPIFY_FLAG_PRINT] Output active config to STDOUT
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Validate the theme.

  Calls and runs "Theme Check" (https://shopify.dev/docs/themes/tools/theme-check) to analyze your theme code for errors
  and to ensure that it follows theme and Liquid best practices. "Learn more about the checks that Theme Check runs."
  (https://shopify.dev/docs/themes/tools/theme-check/checks)
```

## `shopify theme console`

Shopify Liquid REPL (read-eval-print loop) tool

```
USAGE
  $ shopify theme console
  $ shopify theme console --url /products/classic-leather-jacket

FLAGS
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --store-password=<value>  [env: SHOPIFY_FLAG_STORE_PASSWORD] The password for storefronts with password
                                protection.
      --url=<value>             [default: /, env: SHOPIFY_FLAG_URL] The url to be used as context
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Shopify Liquid REPL (read-eval-print loop) tool

  Starts the Shopify Liquid REPL (read-eval-print loop) tool. This tool provides an interactive terminal interface for
  evaluating Liquid code and exploring Liquid objects, filters, and tags using real store data.

  You can also provide context to the console using a URL, as some Liquid objects are context-specific
```

## `shopify theme delete`

Delete remote themes from the connected store. This command can't be undone.

```
USAGE
  $ shopify theme delete [-d] [-e <value>...] [-f] [--no-color] [--password <value>] [--path <value>] [-a] [-s
    <value>] [-t <value>...] [--verbose]

FLAGS
  -a, --show-all                [env: SHOPIFY_FLAG_SHOW_ALL] Include others development themes in theme list.
  -d, --development             [env: SHOPIFY_FLAG_DEVELOPMENT] Delete your development theme.
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -f, --force                   [env: SHOPIFY_FLAG_FORCE] Skip confirmation.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>...        [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Delete remote themes from the connected store. This command can't be undone.

  Deletes a theme from your store.

  You can specify multiple themes by ID. If no theme is specified, then you're prompted to select the theme that you
  want to delete from the list of themes in your store.

  You're asked to confirm that you want to delete the specified themes before they are deleted. You can skip this
  confirmation using the `--force` flag.
```

## `shopify theme dev`

Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.

```
USAGE
  $ shopify theme dev [-a] [-e <value>...] [--error-overlay silent|default] [--host <value>] [-x <value>...]
    [--listing <value>] [--live-reload hot-reload|full-page|off] [--no-color] [-n] [--notify <value>] [-o <value>...]
    [--open] [--password <value>] [--path <value>] [--port <value>] [-s <value>] [--store-password <value>] [-t <value>]
    [--theme-editor-sync] [--verbose]

FLAGS
  -a, --allow-live
      [env: SHOPIFY_FLAG_ALLOW_LIVE] Allow development on a live theme.

  -e, --environment=<value>...
      [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.

  -n, --nodelete
      [env: SHOPIFY_FLAG_NODELETE] Prevents files from being deleted in the remote theme when a file has been deleted
      locally. This applies to files that are deleted while the command is running, and files that have been deleted
      locally before the command is run.

  -o, --only=<value>...
      [env: SHOPIFY_FLAG_ONLY] Hot reload only files that match the specified pattern.

  -s, --store=<value>
      [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full myshopify.com URL
      (example.myshopify.com, https://example.myshopify.com).

  -t, --theme=<value>
      [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.

  -x, --ignore=<value>...
      [env: SHOPIFY_FLAG_IGNORE] Skip hot reloading any files that match the specified pattern.

  --error-overlay=<option>
      [default: default, env: SHOPIFY_FLAG_ERROR_OVERLAY] Controls the visibility of the error overlay when an theme asset
      upload fails:
      - silent Prevents the error overlay from appearing.
      - default Displays the error overlay.

      <options: silent|default>

  --host=<value>
      [env: SHOPIFY_FLAG_HOST] Set which network interface the web server listens on. The default value is 127.0.0.1.

  --listing=<value>
      [env: SHOPIFY_FLAG_LISTING] The listing preset to use for multi-preset themes. Applies preset files from
      listings/[preset-name] directory.

  --live-reload=<option>
      [default: hot-reload, env: SHOPIFY_FLAG_LIVE_RELOAD] The live reload mode switches the server behavior when a file
      is modified:
      - hot-reload Hot reloads local changes to CSS and sections (default)
      - full-page  Always refreshes the entire page
      - off        Deactivate live reload
      <options: hot-reload|full-page|off>

  --no-color
      [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.

  --notify=<value>
      [env: SHOPIFY_FLAG_NOTIFY] The file path or URL. The file path is to a file that you want updated on idle. The URL
      path is where you want a webhook posted to report on file changes.

  --open
      [env: SHOPIFY_FLAG_OPEN] Automatically launch the theme preview in your default web browser.

  --password=<value>
      [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin API token.

  --path=<value>
      [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the current working directory.

  --port=<value>
      [env: SHOPIFY_FLAG_PORT] Local port to serve theme preview from.

  --store-password=<value>
      [env: SHOPIFY_FLAG_STORE_PASSWORD] The password for storefronts with password protection.

  --theme-editor-sync
      [env: SHOPIFY_FLAG_THEME_EDITOR_SYNC] Synchronize Theme Editor updates in the local theme files.

  --verbose
      [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to
  your terminal. While running, changes will push to the store in real time.


  Uploads the current theme as the specified theme, or a "development theme"
  (https://shopify.dev/docs/themes/tools/cli#development-themes), to a store so you can preview it.

  This command returns the following information:

  - A link to your development theme at http://127.0.0.1:9292. This URL can hot reload local changes to CSS and
  sections, or refresh the entire page when a file changes, enabling you to preview changes in real time using the
  store's data.

  You can specify a different network interface and port using `--host` and `--port`.

  - A link to the "editor" (https://shopify.dev/docs/themes/tools/online-editor) for the theme in the Shopify admin.

  - A "preview link"
  (https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can
  share with other developers.

  If you already have a development theme for your current environment, then this command replaces the development theme
  with your local theme. You can override this using the `--theme-editor-sync` flag.

  > Note: You can't preview checkout customizations using http://127.0.0.1:9292.

  Development themes are deleted when you run `shopify auth logout`. If you need a preview link that can be used after
  you log out, then you should "share" (https://shopify.dev/docs/api/shopify-cli/theme/theme-share) your theme or "push"
  (https://shopify.dev/docs/api/shopify-cli/theme/theme-push) to an unpublished theme on your store.

  You can run this command only in a directory that matches the "default Shopify theme folder structure"
  (https://shopify.dev/docs/themes/tools/cli#directory-structure).
```

## `shopify theme duplicate`

Duplicates a theme from your theme library.

```
USAGE
  $ shopify theme duplicate
  $ shopify theme duplicate --theme 10 --name 'New Theme'

FLAGS
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -f, --force                   [env: SHOPIFY_FLAG_FORCE] Force the duplicate operation to run without prompts or
                                confirmations.
  -j, --json                    [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
  -n, --name=<value>            [env: SHOPIFY_FLAG_NAME] Name of the newly duplicated theme.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Duplicates a theme from your theme library.

  If you want to duplicate your local theme, you need to run `shopify theme push` first.

  If no theme ID is specified, you're prompted to select the theme that you want to duplicate from the list of themes in
  your store. You're asked to confirm that you want to duplicate the specified theme.

  Prompts and confirmations are not shown when duplicate is run in a CI environment or the `--force` flag is used,
  therefore you must specify a theme ID using the `--theme` flag.

  You can optionally name the duplicated theme using the `--name` flag.

  If you use the `--json` flag, then theme information is returned in JSON format, which can be used as a
  machine-readable input for scripts or continuous integration.

  Sample JSON output:

  ```json
  {
  "theme": {
  "id": 108267175958,
  "name": "A Duplicated Theme",
  "role": "unpublished",
  "shop": "mystore.myshopify.com"
  }
  }
  ```

  ```json
  {
  "message": "The theme 'Summer Edition' could not be duplicated due to errors",
  "errors": ["Maximum number of themes reached"],
  "requestId": "12345-abcde-67890"
  }
  ```
```

## `shopify theme info`

Displays information about your theme environment, including your current store. Can also retrieve information about a specific theme.

```
USAGE
  $ shopify theme info [-d] [-e <value>...] [-j] [--no-color] [--password <value>] [--path <value>] [-s <value>]
    [-t <value>] [--verbose]

FLAGS
  -d, --development             [env: SHOPIFY_FLAG_DEVELOPMENT] Retrieve info from your development theme.
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -j, --json                    [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Displays information about your theme environment, including your current store. Can also retrieve information about a
  specific theme.
```

## `shopify theme init [name] [flags]`

Clones a Git repository to use as a starting point for building a new theme.

```
USAGE
  $ shopify theme init [name] [flags]

ARGUMENTS
  [NAME]  Name of the new theme

FLAGS
  -l, --latest             [env: SHOPIFY_FLAG_LATEST] Downloads the latest release of the `clone-url`
  -u, --clone-url=<value>  [default: https://github.com/Shopify/skeleton-theme.git, env: SHOPIFY_FLAG_CLONE_URL] The Git
                           URL to clone from. Defaults to Shopify's Skeleton theme.
      --no-color           [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --path=<value>       [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the current
                           working directory.
      --verbose            [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Clones a Git repository to use as a starting point for building a new theme.

  Clones a Git repository to your local machine to use as the starting point for building a theme.

  If no Git repository is specified, then this command creates a copy of Shopify's "Skeleton theme"
  (https://github.com/Shopify/skeleton-theme.git), with the specified name in the current folder. If no name is
  provided, then you're prompted to enter one.

  > Caution: If you're building a theme for the Shopify Theme Store, then you can use our example theme as a starting
  point. However, the theme that you submit needs to be "substantively different from existing themes"
  (https://shopify.dev/docs/themes/store/requirements#uniqueness) so that it provides added value for users.
```

## `shopify theme language-server`

Start a Language Server Protocol server.

```
USAGE
  $ shopify theme language-server [--no-color] [--verbose]

FLAGS
  --no-color  [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
  --verbose   [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Start a Language Server Protocol server.

  Starts the "Language Server" (https://shopify.dev/docs/themes/tools/cli/language-server).
```

## `shopify theme list`

Lists the themes in your store, along with their IDs and statuses.

```
USAGE
  $ shopify theme list [-e <value>...] [--id <value>] [-j] [--name <value>] [--no-color] [--password <value>]
    [--path <value>] [--role live|unpublished|development] [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -j, --json                    [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
      --id=<value>              [env: SHOPIFY_FLAG_ID] Only list theme with the given ID.
      --name=<value>            [env: SHOPIFY_FLAG_NAME] Only list themes that contain the given name.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --role=<option>           [env: SHOPIFY_FLAG_ROLE] Only list themes with the given role.
                                <options: live|unpublished|development>
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Lists the themes in your store, along with their IDs and statuses.
```

## `shopify theme metafields pull`

Download metafields definitions from your shop into a local file.

```
USAGE
  $ shopify theme metafields pull [-e <value>...] [--no-color] [--password <value>] [--path <value>] [-s <value>]
    [--verbose]

FLAGS
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Download metafields definitions from your shop into a local file.

  Retrieves metafields from Shopify Admin.

  If the metafields file already exists, it will be overwritten.
```

## `shopify theme open`

Opens the preview of your remote theme.

```
USAGE
  $ shopify theme open [-d] [-E] [-e <value>...] [-l] [--no-color] [--password <value>] [--path <value>] [-s
    <value>] [-t <value>] [--verbose]

FLAGS
  -E, --editor                  [env: SHOPIFY_FLAG_EDITOR] Open the theme editor for the specified theme in the browser.
  -d, --development             [env: SHOPIFY_FLAG_DEVELOPMENT] Open your development theme.
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -l, --live                    [env: SHOPIFY_FLAG_LIVE] Open your live (published) theme.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Opens the preview of your remote theme.

  Returns links that let you preview the specified theme. The following links are returned:

  - A link to the "editor" (https://shopify.dev/docs/themes/tools/online-editor) for the theme in the Shopify admin.
  - A "preview link"
  (https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can
  share with other developers.

  If you don't specify a theme, then you're prompted to select the theme to open from the list of the themes in your
  store.
```

## `shopify theme package`

Package your theme into a .zip file, ready to upload to the Online Store.

```
USAGE
  $ shopify theme package [--no-color] [--path <value>] [--verbose]

FLAGS
  --no-color      [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
  --path=<value>  [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the current working
                  directory.
  --verbose       [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Package your theme into a .zip file, ready to upload to the Online Store.

  Packages your local theme files into a ZIP file that can be uploaded to Shopify.

  Only folders that match the "default Shopify theme folder structure"
  (https://shopify.dev/docs/storefronts/themes/tools/cli#directory-structure) are included in the package.

  The package includes the `listings` directory if present (required for multi-preset themes per "Theme Store
  requirements"
  (https://shopify.dev/docs/storefronts/themes/store/requirements#adding-presets-to-your-theme-zip-submission)).

  The ZIP file uses the name `theme_name-theme_version.zip`, based on parameters in your "settings_schema.json"
  (https://shopify.dev/docs/storefronts/themes/architecture/config/settings-schema-json) file.
```

## `shopify theme profile`

Profile the Liquid rendering of a theme page.

```
USAGE
  $ shopify theme profile
  $ shopify theme profile --url /products/classic-leather-jacket

FLAGS
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -j, --json                    [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --store-password=<value>  [env: SHOPIFY_FLAG_STORE_PASSWORD] The password for storefronts with password
                                protection.
      --url=<value>             [default: /, env: SHOPIFY_FLAG_URL] The url to be used as context
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Profile the Liquid rendering of a theme page.

  Profile the Shopify Liquid on a given page.

  This command will open a web page with the Speedscope profiler detailing the time spent executing Liquid on the given
  page.
```

## `shopify theme publish`

Set a remote theme as the live theme.

```
USAGE
  $ shopify theme publish [-e <value>...] [-f] [--no-color] [--password <value>] [--path <value>] [-s <value>] [-t
    <value>] [--verbose]

FLAGS
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -f, --force                   [env: SHOPIFY_FLAG_FORCE] Skip confirmation.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Set a remote theme as the live theme.

  Publishes an unpublished theme from your theme library.

  If no theme ID is specified, then you're prompted to select the theme that you want to publish from the list of themes
  in your store.

  You can run this command only in a directory that matches the "default Shopify theme folder structure"
  (https://shopify.dev/docs/themes/tools/cli#directory-structure).

  If you want to publish your local theme, then you need to run `shopify theme push` first. You're asked to confirm that
  you want to publish the specified theme. You can skip this confirmation using the `--force` flag.
```

## `shopify theme pull`

Download your remote theme files locally.

```
USAGE
  $ shopify theme pull [-d] [-e <value>...] [-x <value>...] [-l] [--no-color] [-n] [-o <value>...] [--password
    <value>] [--path <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -d, --development             [env: SHOPIFY_FLAG_DEVELOPMENT] Pull theme files from your remote development theme.
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -l, --live                    [env: SHOPIFY_FLAG_LIVE] Pull theme files from your remote live theme.
  -n, --nodelete                [env: SHOPIFY_FLAG_NODELETE] Prevent deleting local files that don't exist remotely.
  -o, --only=<value>...         [env: SHOPIFY_FLAG_ONLY] Download only the specified files (Multiple flags allowed).
                                Wrap the value in double quotes if you're using wildcards.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
  -x, --ignore=<value>...       [env: SHOPIFY_FLAG_IGNORE] Skip downloading the specified files (Multiple flags
                                allowed). Wrap the value in double quotes if you're using wildcards.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Download your remote theme files locally.

  Retrieves theme files from Shopify.

  If no theme is specified, then you're prompted to select the theme to pull from the list of the themes in your store.
```

## `shopify theme push`

Uploads your local theme files to the connected store, overwriting the remote version if specified.

```
USAGE
  $ shopify theme push
  $ shopify theme push --unpublished --json

FLAGS
  -a, --allow-live              [env: SHOPIFY_FLAG_ALLOW_LIVE] Allow push to a live theme.
  -d, --development             [env: SHOPIFY_FLAG_DEVELOPMENT] Push theme files from your remote development theme.
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -j, --json                    [env: SHOPIFY_FLAG_JSON] Output the result as JSON.
  -l, --live                    [env: SHOPIFY_FLAG_LIVE] Push theme files from your remote live theme.
  -n, --nodelete                [env: SHOPIFY_FLAG_NODELETE] Prevent deleting remote files that don't exist locally.
  -o, --only=<value>...         [env: SHOPIFY_FLAG_ONLY] Upload only the specified files (Multiple flags allowed). Wrap
                                the value in double quotes if you're using wildcards.
  -p, --publish                 [env: SHOPIFY_FLAG_PUBLISH] Publish as the live theme after uploading.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
  -u, --unpublished             [env: SHOPIFY_FLAG_UNPUBLISHED] Create a new unpublished theme and push to it.
  -x, --ignore=<value>...       [env: SHOPIFY_FLAG_IGNORE] Skip uploading the specified files (Multiple flags allowed).
                                Wrap the value in double quotes if you're using wildcards.
      --listing=<value>         [env: SHOPIFY_FLAG_LISTING] The listing preset to use for multi-preset themes. Applies
                                preset files from listings/[preset-name] directory.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --strict                  [env: SHOPIFY_FLAG_STRICT_PUSH] Require theme check to pass without errors before
                                pushing. Warnings are allowed.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Uploads your local theme files to the connected store, overwriting the remote version if specified.

  Uploads your local theme files to Shopify, overwriting the remote version if specified.

  If no theme is specified, then you're prompted to select the theme to overwrite from the list of the themes in your
  store.

  You can run this command only in a directory that matches the "default Shopify theme folder structure"
  (https://shopify.dev/docs/themes/tools/cli#directory-structure).

  This command returns the following information:

  - A link to the "editor" (https://shopify.dev/docs/themes/tools/online-editor) for the theme in the Shopify admin.
  - A "preview link"
  (https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can
  share with others.

  If you use the `--json` flag, then theme information is returned in JSON format, which can be used as a
  machine-readable input for scripts or continuous integration.

  Sample output:

  ```json
  {
  "theme": {
  "id": 108267175958,
  "name": "MyTheme",
  "role": "unpublished",
  "shop": "mystore.myshopify.com",
  "editor_url": "https://mystore.myshopify.com/admin/themes/108267175958/editor",
  "preview_url": "https://mystore.myshopify.com/?preview_theme_id=108267175958"
  }
  }
  ```
```

## `shopify theme rename`

Renames an existing theme.

```
USAGE
  $ shopify theme rename [-d] [-e <value>...] [-l] [-n <value>] [--no-color] [--password <value>] [--path <value>]
    [-s <value>] [-t <value>] [--verbose]

FLAGS
  -d, --development             [env: SHOPIFY_FLAG_DEVELOPMENT] Rename your development theme.
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -l, --live                    [env: SHOPIFY_FLAG_LIVE] Rename your remote live theme.
  -n, --name=<value>            [env: SHOPIFY_FLAG_NEW_NAME] The new name for the theme.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
  -t, --theme=<value>           [env: SHOPIFY_FLAG_THEME_ID] Theme ID or name of the remote theme.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Renames an existing theme.

  Renames a theme in your store.

  If no theme is specified, then you're prompted to select the theme that you want to rename from the list of themes in
  your store.
```

## `shopify theme share`

Creates a shareable, unpublished, and new theme on your theme library with a randomized name.

```
USAGE
  $ shopify theme share [-e <value>...] [--listing <value>] [--no-color] [--password <value>] [--path <value>]
    [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>...  [env: SHOPIFY_FLAG_ENVIRONMENT] The environment to apply to the current command.
  -s, --store=<value>           [env: SHOPIFY_FLAG_STORE] Store URL. It can be the store prefix (example) or the full
                                myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
      --listing=<value>         [env: SHOPIFY_FLAG_LISTING] The listing preset to use for multi-preset themes. Applies
                                preset files from listings/[preset-name] directory.
      --no-color                [env: SHOPIFY_FLAG_NO_COLOR] Disable color output.
      --password=<value>        [env: SHOPIFY_CLI_THEME_TOKEN] Password generated from the Theme Access app or an Admin
                                API token.
      --path=<value>            [env: SHOPIFY_FLAG_PATH] The path where you want to run the command. Defaults to the
                                current working directory.
      --verbose                 [env: SHOPIFY_FLAG_VERBOSE] Increase the verbosity of the output.

DESCRIPTION
  Creates a shareable, unpublished, and new theme on your theme library with a randomized name.

  Uploads your theme as a new, unpublished theme in your theme library. The theme is given a randomized name.

  This command returns a "preview link"
  (https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can
  share with others.
```

## `shopify upgrade`

Shows details on how to upgrade Shopify CLI.

```
USAGE
  $ shopify upgrade

DESCRIPTION
  Shows details on how to upgrade Shopify CLI.

  Shows details on how to upgrade Shopify CLI.
```

## `shopify version`

Shopify CLI version currently installed.

```
USAGE
  $ shopify version

DESCRIPTION
  Shopify CLI version currently installed.
```
<!-- commandsstop -->
