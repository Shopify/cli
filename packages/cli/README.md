# Commands
<!-- commands -->
* [`shopify app build`](#shopify-app-build)
* [`shopify app bulk cancel`](#shopify-app-bulk-cancel)
* [`shopify app bulk execute`](#shopify-app-bulk-execute)
* [`shopify app bulk status`](#shopify-app-bulk-status)
* [`shopify app config link`](#shopify-app-config-link)
* [`shopify app config pull`](#shopify-app-config-pull)
* [`shopify app config use [config] [flags]`](#shopify-app-config-use-config-flags)
* [`shopify app config validate`](#shopify-app-config-validate)
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
* [`shopify app graphiql`](#shopify-app-graphiql)
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
* [`shopify config autoupgrade off`](#shopify-config-autoupgrade-off)
* [`shopify config autoupgrade on`](#shopify-config-autoupgrade-on)
* [`shopify config autoupgrade status`](#shopify-config-autoupgrade-status)
* [`shopify doc fetch`](#shopify-doc-fetch)
* [`shopify doc search`](#shopify-doc-search)
* [`shopify feedback`](#shopify-feedback)
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
* [`shopify organization list`](#shopify-organization-list)
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
* [`shopify store auth`](#shopify-store-auth)
* [`shopify store auth list`](#shopify-store-auth-list)
* [`shopify store bulk cancel`](#shopify-store-bulk-cancel)
* [`shopify store bulk execute`](#shopify-store-bulk-execute)
* [`shopify store bulk status`](#shopify-store-bulk-status)
* [`shopify store create preview`](#shopify-store-create-preview)
* [`shopify store execute`](#shopify-store-execute)
* [`shopify store graphiql`](#shopify-store-graphiql)
* [`shopify store info`](#shopify-store-info)
* [`shopify store list`](#shopify-store-list)
* [`shopify store open`](#shopify-store-open)
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
* [`shopify theme preview`](#shopify-theme-preview)
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
  $ shopify app build [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--skip-dependencies-installation] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --skip-dependencies-installation
      Skips the installation of dependencies. Deprecated, use workspaces instead.
      [env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app bulk cancel --id <value> [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color]
    [--path <value>] [--reset | ] [-s <value>] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -s, --store=<value>
      The store domain. Must be an existing dev store.
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --id=<value>
      (required) The bulk operation ID to cancel (numeric ID or full GID).
      [env: SHOPIFY_FLAG_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Cancel a bulk operation.

  Cancels a running bulk operation by ID.
```

## `shopify app bulk execute`

Execute bulk operations.

```
USAGE
  $ shopify app bulk execute [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--output-file
    <value> --watch] [--path <value>] [-q <value>] [--query-file <value>] [--reset | ] [-s <value>] [--variable-file
    <value> | -v <value>...] [--verbose] [--version <value>]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -q, --query=<value>
      The GraphQL query or mutation to run as a bulk operation.
      [env: SHOPIFY_FLAG_QUERY]

  -s, --store=<value>
      The store domain. Must be an existing dev store.
      [env: SHOPIFY_FLAG_STORE]

  -v, --variables=<value>...
      The values for any GraphQL variables in your mutation, in JSON format. Can be specified multiple times.
      [env: SHOPIFY_FLAG_VARIABLES]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --output-file=<value>
      The file path where results should be written if --watch is specified. If not specified, results will be written to
      STDOUT.
      [env: SHOPIFY_FLAG_OUTPUT_FILE]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --query-file=<value>
      Path to a file containing the GraphQL query or mutation. Can't be used with --query.
      [env: SHOPIFY_FLAG_QUERY_FILE]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --variable-file=<value>
      Path to a file containing GraphQL variables in JSONL format (one JSON object per line). Can't be used with
      --variables.
      [env: SHOPIFY_FLAG_VARIABLE_FILE]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      The API version to use for the bulk operation. If not specified, uses the latest stable version.
      [env: SHOPIFY_FLAG_VERSION]

  --watch
      Wait for bulk operation results before exiting. Defaults to false.
      [env: SHOPIFY_FLAG_WATCH]

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
  $ shopify app bulk status [--auth-alias <value>] [--client-id <value> | -c <value>] [--id <value>] [--no-color]
    [--path <value>] [--reset | ] [-s <value>] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -s, --store=<value>
      The store domain. Must be an existing dev store.
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --id=<value>
      The bulk operation ID (numeric ID or full GID). If not provided, lists all bulk operations belonging to this app on
      this store in the last 7 days.
      [env: SHOPIFY_FLAG_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app config link [--auth-alias <value>] [--client-id <value> | -c <value>] [--force [--file-name <value> |
    ]] [--no-color] [--path <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app. Required if non interactive.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --file-name=<value>
      The name of the app configuration file to create or overwrite.
      [env: SHOPIFY_FLAG_APP_CONFIG_FILE_NAME]

  --force
      Overwrite an existing configuration file without prompting.
      [env: SHOPIFY_FLAG_FORCE]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app config pull [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Activate an app configuration.

  Sets default configuration when you run app-related CLI commands. If you omit the `config-name` parameter, then you'll
  be prompted to choose from the configuration files in your project.
```

## `shopify app config validate`

Validate your app configuration and extensions.

```
USAGE
  $ shopify app config validate [--auth-alias <value>] [--client-id <value> | -c <value>] [-j] [--no-color] [--path
    <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Validate your app configuration and extensions.

  Validates the selected app configuration file and all extension configurations against their schemas and reports any
  errors found.
```

## `shopify app deploy`

Deploy your Shopify app.

```
USAGE
  $ shopify app deploy [--auth-alias <value>] [--client-id <value> | -c <value>] [--message <value>]
    [--no-build] [--no-color] [--no-release | --allow-updates | --allow-deletes] [--path <value>] [--reset | ]
    [--source-control-url <value>] [--verbose] [--version <value>]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --allow-deletes
      Allows removing extensions and configuration without requiring user confirmation. For CI/CD environments, the
      recommended flag is --allow-updates. In non-interactive environments, provide this flag, --allow-updates, or
      --no-release.
      [env: SHOPIFY_FLAG_ALLOW_DELETES]

  --allow-updates
      Allows adding and updating extensions and configuration without requiring user confirmation. Recommended option for
      CI/CD environments. In non-interactive environments, provide this flag, --allow-deletes, or --no-release.
      [env: SHOPIFY_FLAG_ALLOW_UPDATES]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --message=<value>
      Optional message that will be associated with this version. This is for internal use only and won't be available
      externally.
      [env: SHOPIFY_FLAG_MESSAGE]

  --no-build
      Use with caution: Skips building any elements of the app that require building. You should ensure your app has been
      prepared in advance, such as by running `shopify app build` or by caching build artifacts.
      [env: SHOPIFY_FLAG_NO_BUILD]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --no-release
      Creates a version but doesn't release it - it's not made available to merchants. With this flag, a user confirmation
      is not required. In non-interactive environments, provide this flag, --allow-updates, or --allow-deletes.
      [env: SHOPIFY_FLAG_NO_RELEASE]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --source-control-url=<value>
      URL associated with the new app version.
      [env: SHOPIFY_FLAG_SOURCE_CONTROL_URL]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      Optional version tag that will be associated with this app version. If not provided, an auto-generated identifier
      will be generated for this app version.
      [env: SHOPIFY_FLAG_VERSION]

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
  $ shopify app dev [--auth-alias <value>] [--checkout-cart-url <value>] [--client-id <value> | -c <value>]
    [--install-mkcert --use-localhost] [--localhost-port <value>] [--no-color] [--no-update] [--notify <value>] [--path
    <value>] [--reset | ] [--skip-dependencies-installation] [-s <value>] [--store-password <value>]
    [--subscription-product-url <value>] [-t <value>] [--theme-app-extension-port <value>] [--tunnel-url <value> | ]
    [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -s, --store=<value>
      Store URL. Must be an existing development or Shopify Plus sandbox store.
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the theme app extension host theme.
      [env: SHOPIFY_FLAG_THEME]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --checkout-cart-url=<value>
      Resource URL for checkout UI extension. Format: "/cart/{productVariantID}:{productQuantity}"
      [env: SHOPIFY_FLAG_CHECKOUT_CART_URL]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --install-mkcert
      Install and use mkcert to generate localhost certificates when --use-localhost is enabled without prompting.
      [env: SHOPIFY_FLAG_INSTALL_MKCERT]

  --localhost-port=<value>
      Port to use for localhost. Must be between 1 and 65535.
      [env: SHOPIFY_FLAG_LOCALHOST_PORT]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --no-update
      Uses the app URL from the toml file instead an autogenerated URL for dev.
      [env: SHOPIFY_FLAG_NO_UPDATE]

  --notify=<value>
      The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a
      webhook posted to report on file changes.
      [env: SHOPIFY_FLAG_NOTIFY]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --skip-dependencies-installation
      Skips the installation of dependencies. Deprecated, use workspaces instead.
      [env: SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION]

  --store-password=<value>
      The password for storefronts with password protection.
      [env: SHOPIFY_FLAG_STORE_PASSWORD]

  --subscription-product-url=<value>
      Resource URL for subscription UI extension. Format: "/products/{productId}"
      [env: SHOPIFY_FLAG_SUBSCRIPTION_PRODUCT_URL]

  --theme-app-extension-port=<value>
      Local port of the theme app extension development server. Must be between 1 and 65535.
      [env: SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT]

  --tunnel-url=<value>
      Use a custom tunnel, it must be running before executing dev. Format: "https://my-tunnel-url:port".
      [env: SHOPIFY_FLAG_TUNNEL_URL]

  --use-localhost
      Service entry point will listen to localhost. A tunnel won't be used. Will work for testing many app features, but
      not those that directly invoke your app (E.g: Webhooks)
      [env: SHOPIFY_FLAG_USE_LOCALHOST]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Run the app.

  Builds and previews your app on a dev store, and watches for changes. "Read more about testing apps locally"
  (https://shopify.dev/docs/apps/build/cli-for-apps/test-apps-locally).
```

## `shopify app dev clean`

Cleans up the dev preview from the selected store.

```
USAGE
  $ shopify app dev clean [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [-s <value>] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -s, --store=<value>
      Store URL. Must be an existing development store.
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Cleans up the dev preview from the selected store.

  Stop the dev preview that was started with `shopify app dev`.

  It restores the app's active version to the selected development store.
```

## `shopify app env pull`

Pull app and extensions environment variables.

```
USAGE
  $ shopify app env pull [--auth-alias <value>] [--client-id <value> | -c <value>] [--env-file <value>]
    [--no-color] [--path <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --env-file=<value>
      Specify an environment file to update if the update flag is set
      [env: SHOPIFY_FLAG_ENV_FILE]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app env show [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Display app and extensions environment variables.

  Displays environment variables that can be used to deploy apps and app extensions.
```

## `shopify app execute`

Execute GraphQL queries and mutations.

```
USAGE
  $ shopify app execute [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--output-file
    <value>] [--path <value>] [-q <value>] [--query-file <value>] [--reset | ] [-s <value>] [--variable-file <value> |
    -v <value>] [--verbose] [--version <value>]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -q, --query=<value>
      The GraphQL query or mutation, as a string.
      [env: SHOPIFY_FLAG_QUERY]

  -s, --store=<value>
      The myshopify.com domain of the store to execute against. The app must be installed on the store. If not specified,
      you will be prompted to select a store.
      [env: SHOPIFY_FLAG_STORE]

  -v, --variables=<value>
      The values for any GraphQL variables in your query or mutation, in JSON format.
      [env: SHOPIFY_FLAG_VARIABLES]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --output-file=<value>
      The file name where results should be written, instead of STDOUT.
      [env: SHOPIFY_FLAG_OUTPUT_FILE]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --query-file=<value>
      Path to a file containing the GraphQL query or mutation. Can't be used with --query.
      [env: SHOPIFY_FLAG_QUERY_FILE]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --variable-file=<value>
      Path to a file containing GraphQL variables in JSON format. Can't be used with --variables.
      [env: SHOPIFY_FLAG_VARIABLE_FILE]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      The API version to use for the query or mutation. Defaults to the latest stable version.
      [env: SHOPIFY_FLAG_VERSION]

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
  $ shopify app function build [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your function directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Compile a function to wasm.

  Compiles the function in your current directory to WebAssembly (Wasm) for testing purposes.
```

## `shopify app function info`

Print basic information about your function.

```
USAGE
  $ shopify app function info [--auth-alias <value>] [--client-id <value> | -c <value>] [-j] [--no-color] [--path
    <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your function directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app function replay [--auth-alias <value>] [--client-id <value> | -c <value>] [-j] [-l <value>] [--no-color]
    [--path <value>] [--reset | ] [--verbose] [-w]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -l, --log=<value>
      Specifies a log identifier to replay instead of selecting from a list. The identifier is provided in the output of
      `shopify app dev` and is the suffix of the log file name. Required if non interactive.
      [env: SHOPIFY_FLAG_LOG]

  -w, --[no-]watch
      Re-run the function when the source code changes.
      [env: SHOPIFY_FLAG_WATCH]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your function directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app function run [--auth-alias <value>] [--client-id <value> | -c <value>] [-e <value>] [-i <value>] [-j]
    [--no-color] [--path <value>] [--profile] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -e, --export=<value>
      Name of the WebAssembly export to invoke.
      [env: SHOPIFY_FLAG_EXPORT]

  -i, --input=<value>
      The input JSON to pass to the function. If omitted, standard input is used.
      [env: SHOPIFY_FLAG_INPUT]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your function directory.
      [env: SHOPIFY_FLAG_PATH]

  --profile
      Generate a WebAssembly performance profile for the function run. The profile can be viewed in Speedscope.
      [env: SHOPIFY_FLAG_PROFILE]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app function schema [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--stdout] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your function directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --stdout
      Output the schema to stdout instead of writing to a file.
      [env: SHOPIFY_FLAG_STDOUT]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app function typegen [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your function directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Generate GraphQL types for a function.

  Creates GraphQL types based on your "input query" (https://shopify.dev/docs/apps/functions/input-output#input) for a
  function. Supports JavaScript functions out of the box, or any language via the `build.typegen_command` configuration.
```

## `shopify app generate extension`

Generate a new app Extension.

```
USAGE
  $ shopify app generate extension [--auth-alias <value>] [--client-id <value> | -c <value>] [--flavor
    vanilla-js|react|typescript|typescript-react|wasm|rust] [-n <value>] [--no-color] [--path <value>] [--reset | ] [-t
    <value>] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -n, --name=<value>
      name of your Extension. Required if non interactive.
      [env: SHOPIFY_FLAG_NAME]

  -t, --template=<value>
      Extension template. Required if non interactive.
      [env: SHOPIFY_FLAG_EXTENSION_TEMPLATE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --flavor=<option>
      Choose a starting template for your extension, where applicable. Required if non interactive when the selected
      extension template supports multiple flavors.
      [env: SHOPIFY_FLAG_FLAVOR]
      <options: vanilla-js|react|typescript|typescript-react|wasm|rust>

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Generate a new app Extension.

  Generates a new "app extension" (https://shopify.dev/docs/apps/build/app-extensions). For a list of app extensions
  that you can generate using this command, refer to "Supported extensions"
  (https://shopify.dev/docs/apps/build/app-extensions/list-of-app-extensions).

  Each new app extension is created in a folder under `extensions/`. To learn more about the extensions file structure,
  refer to "App structure" (https://shopify.dev/docs/apps/build/cli-for-apps/app-structure) and the documentation for
  your extension.
```

## `shopify app graphiql`

Open a local GraphiQL UI for your app and store.

```
USAGE
  $ shopify app graphiql [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--port <value>] [--reset | ] [-s <value>] [-v <value>] [--verbose] [--version <value>]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -s, --store=<value>
      The myshopify.com domain of the store to open GraphiQL against. The app must be installed on the store. If not
      specified, you will be prompted to select a store.
      [env: SHOPIFY_FLAG_STORE]

  -v, --variables=<value>
      The values for any GraphQL variables in your query or mutation, in JSON format.
      [env: SHOPIFY_FLAG_VARIABLES]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --port=<value>
      Local port for the GraphiQL server. Must be between 1 and 65535.
      [env: SHOPIFY_FLAG_PORT]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      The API version to use in GraphiQL. Defaults to the latest stable version.
      [env: SHOPIFY_FLAG_VERSION]

DESCRIPTION
  Open a local GraphiQL UI for your app and store.

  Opens an authenticated Admin API GraphiQL UI for your app and selected store.

  The app must be installed on the store.

EXAMPLES
  $ shopify app graphiql --store shop.myshopify.com

  $ shopify app graphiql --store shop.myshopify.com --port 9123
```

## `shopify app import-custom-data-definitions`

Import metafield and metaobject definitions.

```
USAGE
  $ shopify app import-custom-data-definitions [--auth-alias <value>] [--client-id <value> | -c <value>] [--include-existing]
    [--no-color] [--path <value>] [--reset | ] [-s <value>] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -s, --store=<value>
      Store URL. Must be an existing development or Shopify Plus sandbox store.
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --include-existing
      Include existing declared definitions in the output.
      [env: SHOPIFY_FLAG_INCLUDE_EXISTING]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Import metafield and metaobject definitions.

  Import metafield and metaobject definitions from your development store. "Read more about declarative custom data
  definitions" (https://shopify.dev/docs/apps/build/custom-data/declarative-custom-data-definitions).
```

## `shopify app import-extensions`

Import dashboard-managed extensions into your app.

```
USAGE
  $ shopify app import-extensions [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Import dashboard-managed extensions into your app.
```

## `shopify app info`

Print basic information about your app and extensions.

```
USAGE
  $ shopify app info [--auth-alias <value>] [--client-id <value> | -c <value>] [-j] [--no-color] [--path
    <value>] [--reset | ] [--verbose] [--web-env]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --web-env
      Outputs environment variables necessary for running and deploying web/.
      [env: SHOPIFY_FLAG_OUTPUT_WEB_ENV]

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
  $ shopify app init [--auth-alias <value>] [--flavor <value>] [-n <value>] [--no-color] [--organization-id
    <value> | [--client-id <value> | ]] [-d npm|yarn|pnpm|bun] [-p <value>] [--template <value>] [--verbose]

FLAGS
  -d, --package-manager=<option>
      [env: SHOPIFY_FLAG_PACKAGE_MANAGER]
      <options: npm|yarn|pnpm|bun>

  -n, --name=<value>
      The name for the new app. When provided, skips the app selection prompt and creates a new app with this name.
      Required in non-interactive environments unless --client-id is provided.
      [env: SHOPIFY_FLAG_NAME]

  -p, --path=<value>
      [default: .] [env: SHOPIFY_FLAG_PATH]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app. Use this to automatically link your new project to an existing app. In non-interactive
      environments, provide this flag or both --name and --organization-id.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --flavor=<value>
      Which flavor of the given template to use. Required in non-interactive environments when the selected template
      offers multiple flavors.
      [env: SHOPIFY_FLAG_TEMPLATE_FLAVOR]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --organization-id=<value>
      The organization ID. Your organization ID can be found in your Dev Dashboard URL:
      https://dev.shopify.com/dashboard/<organization-id>. Required in non-interactive environments unless --client-id is
      provided.
      [env: SHOPIFY_FLAG_ORGANIZATION_ID]

  --template=<value>
      The app template. Accepts one of the following:
      - <reactRouter|none>
      - Any GitHub repo with optional branch and subpath, e.g.,
      https://github.com/Shopify/<repository>/[subpath]#[branch]. Required if non interactive.
      [env: SHOPIFY_FLAG_TEMPLATE]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

EXAMPLES
  $ shopify app init --name my-app --organization-id 123 --template reactRouter --flavor typescript

  $ shopify app init --client-id 123 --template none
```

## `shopify app logs`

Stream detailed logs for your Shopify app.

```
USAGE
  $ shopify app logs [--auth-alias <value>] [--client-id <value> | -c <value>] [-j] [--no-color] [--path
    <value>] [--reset | ] [--source <value>...] [--status success|failure] [-s <value>...] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -s, --store=<value>...
      Store URL. Must be an existing development or Shopify Plus sandbox store.
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --source=<value>...
      Filters output to the specified log source.
      [env: SHOPIFY_FLAG_SOURCE]

  --status=<option>
      Filters output to the specified status (success or failure).
      [env: SHOPIFY_FLAG_STATUS]
      <options: success|failure>

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify app logs sources [--auth-alias <value>] [--client-id <value> | -c <value>] [--no-color] [--path <value>]
    [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --allow-deletes
      Allows removing extensions and configuration without requiring user confirmation. For CI/CD environments, the
      recommended flag is --allow-updates. Required in non-interactive environments unless --allow-updates is provided.
      [env: SHOPIFY_FLAG_ALLOW_DELETES]

  --allow-updates
      Allows adding and updating extensions and configuration without requiring user confirmation. Recommended option for
      CI/CD environments. Required in non-interactive environments unless --allow-deletes is provided.
      [env: SHOPIFY_FLAG_ALLOW_UPDATES]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      (required) The name of the app version to release.
      [env: SHOPIFY_FLAG_VERSION]

DESCRIPTION
  Release an app version.

  Releases an existing app version. Pass the name of the version that you want to release using the `--version` flag.
```

## `shopify app versions list`

List deployed versions of your app.

```
USAGE
  $ shopify app versions list [--auth-alias <value>] [--client-id <value> | -c <value>] [-j] [--no-color] [--path
    <value>] [--reset | ] [--verbose]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  List deployed versions of your app.

  Lists the deployed app versions. An app version is a snapshot of your app extensions.
```

## `shopify app webhook trigger`

Trigger delivery of a sample webhook topic payload to a designated address.

```
USAGE
  $ shopify app webhook trigger [--address <value>] [--api-version <value>] [--auth-alias <value>] [--client-id <value> |
    -c <value>] [--client-secret <value>] [--delivery-method http|google-pub-sub|event-bridge] [--help] [--path <value>]
    [--reset | ] [--topic <value>]

FLAGS
  -c, --config=<value>
      The name of the app configuration.
      [env: SHOPIFY_FLAG_APP_CONFIG]

  --address=<value>
      The URL where the webhook payload should be sent.
      You will need a different address type for each delivery-method:
      · For remote HTTP testing, use a URL that starts with https://
      · For local HTTP testing, use http://localhost:{port}/{url-path}
      · For Google Pub/Sub, use pubsub://{project-id}:{topic-id}
      · For Amazon EventBridge, use an Amazon Resource Name (ARN) starting with arn:aws:events:. Required if non
      interactive.
      [env: SHOPIFY_FLAG_ADDRESS]

  --api-version=<value>
      The API Version of the webhook topic. Required if non interactive.
      [env: SHOPIFY_FLAG_API_VERSION]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --client-id=<value>
      The Client ID of your app.
      [env: SHOPIFY_FLAG_CLIENT_ID]

  --client-secret=<value>
      Your app's client secret. This secret allows us to return the X-Shopify-Hmac-SHA256 header that lets you validate
      the origin of the response that you receive.
      [env: SHOPIFY_FLAG_CLIENT_SECRET]

  --delivery-method=<option>
      Method chosen to deliver the topic payload. If not passed, it's inferred from the address.
      [env: SHOPIFY_FLAG_DELIVERY_METHOD]
      <options: http|google-pub-sub|event-bridge>

  --help
      This help. When you run the trigger command the CLI will prompt you for any information that isn't passed using
      flags.
      [env: SHOPIFY_FLAG_HELP]

  --path=<value>
      The path to your app directory.
      [env: SHOPIFY_FLAG_PATH]

  --reset
      Reset all your settings.
      [env: SHOPIFY_FLAG_RESET]

  --topic=<value>
      The requested webhook topic. Required if non interactive.
      [env: SHOPIFY_FLAG_TOPIC]

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
  --alias=<value>
      Alias of an existing session you want to use. Required if non interactive.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

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
  -c, --columns=<option>...
      Only show provided columns (comma-separated).
      <options: id|plugin|summary|type>

  -x, --extended
      Show extra columns.

  --deprecated
      Show deprecated commands.

  --hidden
      Show hidden commands.

  --no-truncate
      Do not truncate output.

  --sort=<option>
      [default: id] Property to sort by.
      <options: id|plugin|summary|type>

  --tree
      Show tree of commands.

GLOBAL FLAGS
  --json
      Format output as json.

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

## `shopify config autoupgrade off`

Disable automatic upgrades for Shopify CLI.

```
USAGE
  $ shopify config autoupgrade off

DESCRIPTION
  Disable automatic upgrades for Shopify CLI.

  Disable automatic upgrades for Shopify CLI.

  When auto-upgrade is disabled, Shopify CLI won't automatically update. Run `shopify upgrade` to update manually.

  To enable auto-upgrade, run `shopify config autoupgrade on`.
```

## `shopify config autoupgrade on`

Enable automatic upgrades for Shopify CLI.

```
USAGE
  $ shopify config autoupgrade on

DESCRIPTION
  Enable automatic upgrades for Shopify CLI.

  Enable automatic upgrades for Shopify CLI.

  When auto-upgrade is enabled, Shopify CLI automatically updates to the latest version once per day. Major version
  upgrades are skipped and must be done manually.

  To disable auto-upgrade, run `shopify config autoupgrade off`.
```

## `shopify config autoupgrade status`

Check whether auto-upgrade is enabled, disabled, or not yet configured.

```
USAGE
  $ shopify config autoupgrade status

DESCRIPTION
  Check whether auto-upgrade is enabled, disabled, or not yet configured.

  Check whether auto-upgrade is enabled, disabled, or not yet configured.

  When auto-upgrade is enabled, Shopify CLI automatically updates to the latest version after each command.

  Run `shopify config autoupgrade on` or `shopify config autoupgrade off` to configure it.
```

## `shopify doc fetch`

Download a complete document from shopify.dev. Every page on shopify.dev has a Markdown version, and that is what this tool returns. Use this to pull an entire document verbatim — for example, a set of instructions an agent follows like a centrally-served skill. For finding the relevant pieces of content across shopify.dev instead, use `doc search`.

```
USAGE
  $ shopify doc fetch --url <value> [--no-color] [--output <value>] [--verbose]

FLAGS
  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --output=<value>
      Write the document to this file path instead of printing it to stdout.
      [env: SHOPIFY_FLAG_OUTPUT]

  --url=<value>
      (required) The shopify.dev URL to fetch.
      [env: SHOPIFY_FLAG_URL]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Download a complete document from shopify.dev. Every page on shopify.dev has a Markdown version, and that is what this
  tool returns. Use this to pull an entire document verbatim — for example, a set of instructions an agent follows like
  a centrally-served skill. For finding the relevant pieces of content across shopify.dev instead, use `doc search`.

EXAMPLES
  # fetch the Markdown version of a Shopify.dev page

    $ shopify doc fetch --url https://shopify.dev/docs/api/shopify-cli

  # save the document to a file instead of printing it

    $ shopify doc fetch --url https://shopify.dev/docs/api/shopify-cli --output docs/shopify-cli.md
```

## `shopify doc search`

Query the shopify.dev vector store and print the most relevant documentation chunks as JSON. Best for programmatic discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `doc fetch`.

```
USAGE
  $ shopify doc search --query <value> [--api-name <value>] [--api-version <value>] [--no-color] [--verbose]

FLAGS
  --api-name=<value>
      Limit results to a specific API (for example: admin, storefront, hydrogen, functions). Unrecognized values are
      ignored.
      [env: SHOPIFY_FLAG_API_NAME]

  --api-version=<value>
      Limit results to a specific API version (for example: 2025-10, latest, current).
      [env: SHOPIFY_FLAG_API_VERSION]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --query=<value>
      (required) The search query.
      [env: SHOPIFY_FLAG_QUERY]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Query the shopify.dev vector store and print the most relevant documentation chunks as JSON. Best for programmatic
  discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To
  download a full document verbatim, use `doc fetch`.

EXAMPLES
  # search shopify.dev for a topic
      shopify doc search --query "subscribe to webhooks"
      # narrow the search to a specific API and version
      shopify doc search --query "create a product" --api-name admin --api-version latest
```

## `shopify feedback`

Send feedback about Shopify CLI.

```
USAGE
  $ shopify feedback -m <value> [--category
    wrong_guidance|missing_capability|confusing_docs|tool_failure|slow|other] [-j] [--no-color] [--sentiment
    frustrated|blocked|confused|praise] [--verbose]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -m, --message=<value>
      (required) The feedback message. Pass - to read the message from stdin. Messages longer than 2000 characters are
      truncated.
      [env: SHOPIFY_FLAG_MESSAGE]

  --category=<option>
      What the feedback is about.
      [env: SHOPIFY_FLAG_CATEGORY]
      <options: wrong_guidance|missing_capability|confusing_docs|tool_failure|slow|other>

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --sentiment=<option>
      How the experience felt.
      [env: SHOPIFY_FLAG_SENTIMENT]
      <options: frustrated|blocked|confused|praise>

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Send feedback about Shopify CLI.

  Sends feedback about Shopify CLI to the team that builds it. The feedback travels on the usage analytics the CLI
  already reports, so it makes no separate network request and respects the analytics opt-out. It never prompts, so both
  humans and AI agents can run it.

EXAMPLES
  $ shopify feedback --message "The deploy command told me to use a flag that does not exist"

  $ shopify feedback --message "dev keeps disconnecting from my store" --sentiment frustrated --category tool_failure

  echo "Docs and CLI disagree about theme push" | shopify feedback --message -
```

## `shopify help [command] [flags]`

Display help for Shopify CLI

```
USAGE
  $ shopify help [command] [flags]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands
      Include all nested commands in the output.
      [env: SHOPIFY_FLAG_CLI_NESTED_COMMANDS]

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
  --[no-]bundle-stats
      Show a bundle size summary after building. Defaults to true, use `--no-bundle-stats` to disable.

  --codegen
      Automatically generates GraphQL types for your project’s Storefront API queries.

  --codegen-config-path=<value>
      Specifies a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if this file exists.

  --disable-route-warning
      Disables any warnings about missing standard routes.
      [env: SHOPIFY_HYDROGEN_FLAG_DISABLE_ROUTE_WARNING]

  --entry=<value>
      Entry file for the worker. Defaults to `./server`.
      [env: SHOPIFY_HYDROGEN_FLAG_ENTRY]

  --force-client-sourcemap
      Client sourcemapping is avoided by default because it makes backend code visible in the browser. Use this flag to
      force enabling it.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE_CLIENT_SOURCEMAP]

  --[no-]lockfile-check
      Checks that there is exactly one valid lockfile in the project. Defaults to `true`. Deactivate with
      `--no-lockfile-check`.
      [env: SHOPIFY_HYDROGEN_FLAG_LOCKFILE_CHECK]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --[no-]sourcemap
      Controls whether server sourcemaps are generated. Default to `true`. Deactivate `--no-sourcemaps`.
      [env: SHOPIFY_HYDROGEN_FLAG_SOURCEMAP]

  --watch
      Watches for changes and rebuilds the project writing output to disk.
      [env: SHOPIFY_HYDROGEN_FLAG_WATCH]

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
  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Returns diagnostic information about a Hydrogen storefront.
```

## `shopify hydrogen codegen`

Generate types for the Storefront API queries found in your project.

```
USAGE
  $ shopify hydrogen codegen [--codegen-config-path <value>] [--path <value>] [--watch]

FLAGS
  --codegen-config-path=<value>
      Specify a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if it exists.

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --watch
      Watch the project for changes to update types on file save.

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
  --dev-origin=<value>
      (required) The development domain of your application.

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --relative-logout-uri=<value>
      The relative url of allowed url that will be redirected to post-logout for Customer Account API OAuth flow. Default
      to nothing.

  --relative-redirect-uri=<value>
      The relative url of allowed callback url for Customer Account API OAuth flow. Default is '/account/authorize'

  --storefront-id=<value>
      The id of the storefront the configuration should be pushed to. Must start with 'gid://shopify/HydrogenStorefront/'

DESCRIPTION
  Push project configuration to admin
```

## `shopify hydrogen debug cpu`

Builds and profiles the server startup time the app.

```
USAGE
  $ shopify hydrogen debug cpu [--entry <value>] [--output <value>] [--path <value>]

FLAGS
  --entry=<value>
      Entry file for the worker. Defaults to `./server`.
      [env: SHOPIFY_HYDROGEN_FLAG_ENTRY]

  --output=<value>
      [default: startup.cpuprofile] Specify a path to generate the profile file. Defaults to "startup.cpuprofile".

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Builds and profiles the server startup time the app.
```

## `shopify hydrogen deploy`

Builds and deploys a Hydrogen storefront to Oxygen.

```
USAGE
  $ shopify hydrogen deploy [--assets-dir <value>] [--auth-bypass-token-duration <value> --auth-bypass-token]
    [--build-command <value>] [--entry <value>] [--env <value> | --env-branch <value>] [--env-file <value>] [-f]
    [--force-client-sourcemap] [--json-output] [--lockfile-check] [--metadata-description <value>] [--metadata-user
    <value>] [--no-verify] [--path <value>] [--preview] [-s <value>] [-t <value>] [--worker-dir <value>]

FLAGS
  -f, --force
      Forces a deployment to proceed if there are uncommitted changes in its Git repository, and skips confirmation
      prompts for non-preview environments.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  -s, --shop=<value>
      Shop URL. It can be the shop prefix (janes-apparel) or the full myshopify.com URL (janes-apparel.myshopify.com,
      https://janes-apparel.myshopify.com).
      [env: SHOPIFY_SHOP]

  -t, --token=<value>
      Oxygen deployment token. Defaults to the linked storefront's token if available.
      [env: SHOPIFY_HYDROGEN_DEPLOYMENT_TOKEN]

  --assets-dir=<value>
      Directory containing the client assets to deploy, relative to the project root. Defaults to the detected Vite client
      output directory, then falls back to `dist/client`.
      [env: SHOPIFY_HYDROGEN_FLAG_ASSETS_DIR]

  --auth-bypass-token
      Generate an authentication bypass token, which can be used to perform end-to-end tests against the deployment.
      [env: AUTH_BYPASS_TOKEN]

  --auth-bypass-token-duration=<value>
      Specify the duration (in hours) up to 12 hours for the authentication bypass token. Defaults to `2`
      [env: AUTH_BYPASS_TOKEN_DURATION]

  --build-command=<value>
      Specify a build command to run before deploying. If not specified, the Hydrogen build pipeline will be used. When
      custom output directories are configured, defaults to `node --run build`.

  --entry=<value>
      Entry file for the worker. Defaults to `./server`.
      [env: SHOPIFY_HYDROGEN_FLAG_ENTRY]

  --env=<value>
      Specifies the environment to perform the operation using its handle. Fetch the handle using the `env list` command.

  --env-branch=<value>
      Specifies the environment to perform the operation using its Git branch name.
      [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH]

  --env-file=<value>
      Path to an environment file to override existing environment variables for the deployment.

  --force-client-sourcemap
      Client sourcemapping is avoided by default because it makes backend code visible in the browser. Use this flag to
      force enabling it.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE_CLIENT_SOURCEMAP]

  --[no-]json-output
      Create a JSON file containing the deployment details in CI environments. Defaults to true, use `--no-json-output` to
      disable.

  --[no-]lockfile-check
      Checks that there is exactly one valid lockfile in the project. Defaults to `true`. Deactivate with
      `--no-lockfile-check`.
      [env: SHOPIFY_HYDROGEN_FLAG_LOCKFILE_CHECK]

  --metadata-description=<value>
      Description of the changes in the deployment. Defaults to the commit message of the latest commit if there are no
      uncommitted changes.
      [env: SHOPIFY_HYDROGEN_FLAG_METADATA_DESCRIPTION]

  --metadata-user=<value>
      User that initiated the deployment. Will be saved and displayed in the Shopify admin
      [env: SHOPIFY_HYDROGEN_FLAG_METADATA_USER]

  --no-verify
      Skip the routability verification step after deployment.

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --preview
      Deploys to the Preview environment.

  --worker-dir=<value>
      Directory containing the Oxygen worker entry point (`index.js` or `index.mjs`), relative to the project root.
      Defaults to the detected Vite server output directory, then falls back to `dist/server`.
      [env: SHOPIFY_HYDROGEN_FLAG_WORKER_DIR]

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
  --codegen
      Automatically generates GraphQL types for your project’s Storefront API queries.

  --codegen-config-path=<value>
      Specifies a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if this file exists.

  --customer-account-push
      Use tunneling for local development and push the tunneling domain to admin. Required to use Customer Account API's
      OAuth flow
      [env: SHOPIFY_HYDROGEN_FLAG_CUSTOMER_ACCOUNT_PUSH]

  --debug
      Enables inspector connections to the server with a debugger such as Visual Studio Code or Chrome DevTools.
      [env: SHOPIFY_HYDROGEN_FLAG_DEBUG]

  --disable-deps-optimizer
      Disable adding dependencies to Vite's `ssr.optimizeDeps.include` automatically
      [env: SHOPIFY_HYDROGEN_FLAG_DISABLE_DEPS_OPTIMIZER]

  --disable-version-check
      Skip the version check when running `hydrogen dev`

  --disable-virtual-routes
      Disable rendering fallback routes when a route file doesn't exist.
      [env: SHOPIFY_HYDROGEN_FLAG_DISABLE_VIRTUAL_ROUTES]

  --entry=<value>
      Entry file for the worker. Defaults to `./server`.
      [env: SHOPIFY_HYDROGEN_FLAG_ENTRY]

  --env=<value>
      Specifies the environment to perform the operation using its handle. Fetch the handle using the `env list` command.

  --env-branch=<value>
      Specifies the environment to perform the operation using its Git branch name.
      [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH]

  --env-file=<value>
      [default: .env] Path to an environment file to override existing environment variables. Defaults to the '.env'
      located in your project path `--path`.

  --host
      Expose the server to the local network

  --inspector-port=<value>
      The port where the inspector is available. Defaults to 9229.
      [env: SHOPIFY_HYDROGEN_FLAG_INSPECTOR_PORT]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --port=<value>
      The port to run the server on. Defaults to 3000.
      [env: SHOPIFY_HYDROGEN_FLAG_PORT]

  --verbose
      Outputs more information about the command's execution.
      [env: SHOPIFY_HYDROGEN_FLAG_VERBOSE]

DESCRIPTION
  Runs Hydrogen storefront in an Oxygen worker for development.
```

## `shopify hydrogen env list`

List the environments on your linked Hydrogen storefront.

```
USAGE
  $ shopify hydrogen env list [--path <value>]

FLAGS
  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  List the environments on your linked Hydrogen storefront.
```

## `shopify hydrogen env pull`

Populate your .env with variables from your Hydrogen storefront.

```
USAGE
  $ shopify hydrogen env pull [--env <value> | --env-branch <value>] [--env-file <value>] [-f] [--path <value>]

FLAGS
  -f, --force
      Overwrites the destination directory and files if they already exist.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  --env=<value>
      Specifies the environment to perform the operation using its handle. Fetch the handle using the `env list` command.

  --env-branch=<value>
      Specifies the environment to perform the operation using its Git branch name.
      [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH]

  --env-file=<value>
      [default: .env] Path to an environment file to override existing environment variables. Defaults to the '.env'
      located in your project path `--path`.

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Populate your .env with variables from your Hydrogen storefront.
```

## `shopify hydrogen env push`

Push environment variables from the local .env file to your linked Hydrogen storefront.

```
USAGE
  $ shopify hydrogen env push [--dry-run | -f] [--env <value> | ] [--env-file <value>] [--path <value>]

FLAGS
  -f, --force
      Push environment variable changes without confirmation.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  --dry-run
      Preview environment variable changes without pushing them.
      [env: SHOPIFY_HYDROGEN_FLAG_DRY_RUN]

  --env=<value>
      Specifies the environment to perform the operation using its handle. Fetch the handle using the `env list` command.

  --env-file=<value>
      [default: .env] Path to an environment file to override existing environment variables. Defaults to the '.env'
      located in your project path `--path`.

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

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
  ROUTENAME  (home|page|cart|products|collections|policies|blogs|account|search|robots|sitemap|all) The route to
             generate. One of home,page,cart,products,collections,policies,blogs,account,search,robots,sitemap,all.

FLAGS
  -f, --force
      Overwrites the destination directory and files if they already exist.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  --adapter=<value>
      React Router adapter used in the route. The default is `react-router`.
      [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER]

  --locale-param=<value>
      The param name in Remix routes for the i18n locale, if any. Example: `locale` becomes ($locale).
      [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --typescript
      Generate TypeScript files
      [env: SHOPIFY_HYDROGEN_FLAG_TYPESCRIPT]

DESCRIPTION
  Generates a standard Shopify route.
```

## `shopify hydrogen generate routes`

Generates all supported standard shopify routes.

```
USAGE
  $ shopify hydrogen generate routes [--adapter <value>] [-f] [--locale-param <value>] [--path <value>] [--typescript]

FLAGS
  -f, --force
      Overwrites the destination directory and files if they already exist.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  --adapter=<value>
      React Router adapter used in the route. The default is `react-router`.
      [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER]

  --locale-param=<value>
      The param name in Remix routes for the i18n locale, if any. Example: `locale` becomes ($locale).
      [env: SHOPIFY_HYDROGEN_FLAG_ADAPTER]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --typescript
      Generate TypeScript files
      [env: SHOPIFY_HYDROGEN_FLAG_TYPESCRIPT]

DESCRIPTION
  Generates all supported standard shopify routes.
```

## `shopify hydrogen init`

Creates a new Hydrogen storefront.

```
USAGE
  $ shopify hydrogen init [-f] [--git] [--install-deps] [--language <value>] [--markets <value>] [--mock-shop]
    [--path <value>] [--quickstart] [--shortcut] [--styling <value>] [--template <value>]

FLAGS
  -f, --force
      Overwrites the destination directory and files if they already exist.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  --[no-]git
      Init Git and create initial commits.
      [env: SHOPIFY_HYDROGEN_FLAG_GIT]

  --[no-]install-deps
      Auto installs dependencies using the active package manager.
      [env: SHOPIFY_HYDROGEN_FLAG_INSTALL_DEPS]

  --language=<value>
      Sets the template language to use. One of `js` or `ts`.
      [env: SHOPIFY_HYDROGEN_FLAG_LANGUAGE]

  --markets=<value>
      Sets the URL structure to support multiple markets. Must be one of: `subfolders`, `domains`, `subdomains`, `none`.
      Example: `--markets subfolders`.
      [env: SHOPIFY_HYDROGEN_FLAG_I18N]

  --mock-shop
      Use mock.shop as the data source for the storefront.
      [env: SHOPIFY_HYDROGEN_FLAG_MOCK_DATA]

  --path=<value>
      The path to the directory of the new Hydrogen storefront.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --quickstart
      Scaffolds a new Hydrogen project with a set of sensible defaults. Equivalent to `shopify hydrogen init --path
      hydrogen-quickstart --mock-shop --language js --shortcut --markets none`
      [env: SHOPIFY_HYDROGEN_FLAG_QUICKSTART]

  --[no-]shortcut
      Creates a global h2 shortcut for Shopify CLI using shell aliases. Deactivate with `--no-shortcut`.
      [env: SHOPIFY_HYDROGEN_FLAG_SHORTCUT]

  --styling=<value>
      Sets the styling strategy to use. One of `tailwind`, `vanilla-extract`, `css-modules`, `postcss`, `none`.
      [env: SHOPIFY_HYDROGEN_FLAG_STYLING]

  --template=<value>
      Scaffolds project based on an existing template or example from the Hydrogen repository.
      [env: SHOPIFY_HYDROGEN_FLAG_TEMPLATE]

DESCRIPTION
  Creates a new Hydrogen storefront.
```

## `shopify hydrogen link`

Link a local project to one of your shop's Hydrogen storefronts.

```
USAGE
  $ shopify hydrogen link [--create-storefront | --storefront <value>] [-f] [--name <value> | ] [--path <value>]
    [-s <value>]

FLAGS
  -f, --force
      Overwrites the destination directory and files if they already exist.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  -s, --shop=<value>
      Shop URL. It can be the shop prefix (janes-apparel) or the full myshopify.com URL (janes-apparel.myshopify.com,
      https://janes-apparel.myshopify.com).
      [env: SHOPIFY_SHOP]

  --create-storefront
      Create a new Hydrogen storefront.
      [env: SHOPIFY_HYDROGEN_FLAG_CREATE_STOREFRONT]

  --name=<value>
      The name to use when creating a new Hydrogen storefront.
      [env: SHOPIFY_HYDROGEN_FLAG_NAME]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --storefront=<value>
      The name of a Hydrogen Storefront (e.g. "Jane's Apparel")
      [env: SHOPIFY_HYDROGEN_STOREFRONT]

DESCRIPTION
  Link a local project to one of your shop's Hydrogen storefronts.
```

## `shopify hydrogen list`

Returns a list of Hydrogen storefronts available on a given shop.

```
USAGE
  $ shopify hydrogen list [--path <value>]

FLAGS
  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Returns a list of Hydrogen storefronts available on a given shop.
```

## `shopify hydrogen login`

Login to your Shopify account.

```
USAGE
  $ shopify hydrogen login [--path <value>] [-s <value>]

FLAGS
  -s, --shop=<value>
      Shop URL. It can be the shop prefix (janes-apparel) or the full myshopify.com URL (janes-apparel.myshopify.com,
      https://janes-apparel.myshopify.com).
      [env: SHOPIFY_SHOP]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Login to your Shopify account.
```

## `shopify hydrogen logout`

Logout of your local session.

```
USAGE
  $ shopify hydrogen logout [--path <value>]

FLAGS
  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

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
  --build
      Builds the app before starting the preview server.

  --codegen
      Automatically generates GraphQL types for your project’s Storefront API queries.

  --codegen-config-path=<value>
      Specifies a path to a codegen configuration file. Defaults to `<root>/codegen.ts` if this file exists.

  --debug
      Enables inspector connections to the server with a debugger such as Visual Studio Code or Chrome DevTools.
      [env: SHOPIFY_HYDROGEN_FLAG_DEBUG]

  --entry=<value>
      Entry file for the worker. Defaults to `./server`.
      [env: SHOPIFY_HYDROGEN_FLAG_ENTRY]

  --env=<value>
      Specifies the environment to perform the operation using its handle. Fetch the handle using the `env list` command.

  --env-branch=<value>
      Specifies the environment to perform the operation using its Git branch name.
      [env: SHOPIFY_HYDROGEN_ENVIRONMENT_BRANCH]

  --env-file=<value>
      [default: .env] Path to an environment file to override existing environment variables. Defaults to the '.env'
      located in your project path `--path`.

  --inspector-port=<value>
      The port where the inspector is available. Defaults to 9229.
      [env: SHOPIFY_HYDROGEN_FLAG_INSPECTOR_PORT]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --port=<value>
      The port to run the server on. Defaults to 3000.
      [env: SHOPIFY_HYDROGEN_FLAG_PORT]

  --verbose
      Outputs more information about the command's execution.
      [env: SHOPIFY_HYDROGEN_FLAG_VERBOSE]

  --watch
      Watches for changes and rebuilds the project.

DESCRIPTION
  Runs a Hydrogen storefront in an Oxygen worker for production.
```

## `shopify hydrogen setup`

Scaffold routes and core functionality.

```
USAGE
  $ shopify hydrogen setup [-f] [--install-deps] [--markets <value>] [--path <value>] [--shortcut]

FLAGS
  -f, --force
      Overwrites the destination directory and files if they already exist.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  --[no-]install-deps
      Auto installs dependencies using the active package manager.
      [env: SHOPIFY_HYDROGEN_FLAG_INSTALL_DEPS]

  --markets=<value>
      Sets the URL structure to support multiple markets. Must be one of: `subfolders`, `domains`, `subdomains`, `none`.
      Example: `--markets subfolders`.
      [env: SHOPIFY_HYDROGEN_FLAG_I18N]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

  --[no-]shortcut
      Creates a global h2 shortcut for Shopify CLI using shell aliases. Deactivate with `--no-shortcut`.
      [env: SHOPIFY_HYDROGEN_FLAG_SHORTCUT]

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
  -f, --force
      Overwrites the destination directory and files if they already exist.
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  --[no-]install-deps
      Auto installs dependencies using the active package manager.
      [env: SHOPIFY_HYDROGEN_FLAG_INSTALL_DEPS]

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

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
  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Setup support for multiple markets in your project.
```

## `shopify hydrogen setup vite`

EXPERIMENTAL: Upgrades the project to use Vite.

```
USAGE
  $ shopify hydrogen setup vite [--path <value>]

FLAGS
  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

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
  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Unlink a local project from a Hydrogen storefront.
```

## `shopify hydrogen upgrade`

Upgrade Remix and Hydrogen npm dependencies.

```
USAGE
  $ shopify hydrogen upgrade [-f] [--path <value>] [-v <value>]

FLAGS
  -f, --force
      Ignore warnings and force the upgrade to the target version
      [env: SHOPIFY_HYDROGEN_FLAG_FORCE]

  -v, --version=<value>
      A target hydrogen version to update to

  --path=<value>
      The path to the directory of the Hydrogen storefront. Defaults to the current directory where the command is run.
      [env: SHOPIFY_HYDROGEN_FLAG_PATH]

DESCRIPTION
  Upgrade Remix and Hydrogen npm dependencies.
```

## `shopify organization list`

List Shopify organizations you have access to.

```
USAGE
  $ shopify organization list [--auth-alias <value>] [-j] [--no-color] [--verbose]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  List Shopify organizations you have access to.

  Lists the Shopify organizations that you have access to, along with their organization IDs.
```

## `shopify plugins add PLUGIN`

Installs a plugin into shopify.

```
USAGE
  $ shopify plugins add PLUGIN... [-f] [-h] [--json] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force
      Force npm to fetch remote resources even if a local copy exists on disk.

  -h, --help
      Show CLI help.

  -s, --silent
      Silences npm output.

  -v, --verbose
      Show verbose npm output.

GLOBAL FLAGS
  --json
      Format output as json.

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
  -h, --help
      Show CLI help.

  -v, --verbose

GLOBAL FLAGS
  --json
      Format output as json.

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
  -f, --force
      Force npm to fetch remote resources even if a local copy exists on disk.

  -h, --help
      Show CLI help.

  -s, --silent
      Silences npm output.

  -v, --verbose
      Show verbose npm output.

GLOBAL FLAGS
  --json
      Format output as json.

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
  -h, --help
      Show CLI help.

  -v, --verbose

  --[no-]install
      Install dependencies after linking the plugin.

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
  -h, --help
      Show CLI help.

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
  --hard
      Delete node_modules and package manager related files in addition to uninstalling plugins.

  --reinstall
      Reinstall all plugins after uninstalling.
```

## `shopify plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ shopify plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help
      Show CLI help.

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
  -h, --help
      Show CLI help.

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
  -h, --help
      Show CLI help.

  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

## `shopify search [query]`

Search shopify.dev for the most relevant content matching a query. Best for discovery — surfacing the relevant pieces of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `doc fetch`.

```
USAGE
  $ shopify search [query]

FLAGS
  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Search shopify.dev for the most relevant content matching a query. Best for discovery — surfacing the relevant pieces
  of documentation for a topic, rather than retrieving a whole document. To download a full document verbatim, use `doc
  fetch`.

EXAMPLES
  # open the search modal on Shopify.dev
      shopify search
      # search for a term on Shopify.dev
      shopify search <query>
      # search for a phrase on Shopify.dev
      shopify search "<a search query separated by spaces>"
```

## `shopify store auth`

Authenticate an app against a store for store commands.

```
USAGE
  $ shopify store auth --scopes <value> -s <value> [-j] [--no-color] [--verbose]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --scopes=<value>
      (required) Comma-separated Admin API scopes to request for the app.
      [env: SHOPIFY_FLAG_SCOPES]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Authenticate an app against a store for store commands.

  Authenticates the app against the specified store for store commands and stores an online access token for later
  reuse.

  Re-run this command if the stored token is missing, expires, or no longer has the scopes you need.

EXAMPLES
  $ shopify store auth --store shop.myshopify.com --scopes read_products,write_products

  $ shopify store auth --store shop.myshopify.com --scopes read_products,write_products --json
```

## `shopify store auth list`

List stores authenticated directly with store auth.

```
USAGE
  $ shopify store auth list [-j] [--no-color] [--verbose]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  List stores authenticated directly with store auth.

  Lists stores authenticated directly on this machine with `shopify store auth`.

  Use this command to find stores that can be used with store-authenticated commands such as `shopify store execute`.
  To list stores in a Shopify organization, run `shopify store list`.

EXAMPLES
  $ shopify store auth list

  $ shopify store auth list --json
```

## `shopify store bulk cancel`

Cancel a bulk operation on a store.

```
USAGE
  $ shopify store bulk cancel --id <value> -s <value> [--no-color] [--verbose]

FLAGS
  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  --id=<value>
      (required) The bulk operation ID to cancel (numeric ID or full GID).
      [env: SHOPIFY_FLAG_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Cancel a bulk operation on a store.

  Cancels a running bulk operation by ID, using previously stored app authentication.

  Run `shopify store auth` first to create stored auth for the store.

EXAMPLES
  $ shopify store bulk cancel --store shop.myshopify.com --id 123456789
```

## `shopify store bulk execute`

Execute bulk operations on a store.

```
USAGE
  $ shopify store bulk execute -s <value> [--allow-mutations] [--no-color] [--output-file <value> --watch] [-q <value>]
    [--query-file <value>] [--variable-file <value> | -v <value>...] [--verbose] [--version <value>]

FLAGS
  -q, --query=<value>
      The GraphQL query or mutation to run as a bulk operation.
      [env: SHOPIFY_FLAG_QUERY]

  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  -v, --variables=<value>...
      The values for any GraphQL variables in your mutation, in JSON format. Can be specified multiple times.
      [env: SHOPIFY_FLAG_VARIABLES]

  --allow-mutations
      Allow GraphQL mutations to run against the target store.
      [env: SHOPIFY_FLAG_ALLOW_MUTATIONS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --output-file=<value>
      The file path where results should be written if --watch is specified. If not specified, results will be written to
      STDOUT.
      [env: SHOPIFY_FLAG_OUTPUT_FILE]

  --query-file=<value>
      Path to a file containing the GraphQL query or mutation. Can't be used with --query.
      [env: SHOPIFY_FLAG_QUERY_FILE]

  --variable-file=<value>
      Path to a file containing GraphQL variables in JSONL format (one JSON object per line). Can't be used with
      --variables.
      [env: SHOPIFY_FLAG_VARIABLE_FILE]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      The API version to use for the bulk operation. If not specified, uses the latest stable version.
      [env: SHOPIFY_FLAG_VERSION]

  --watch
      Wait for bulk operation results before exiting. Defaults to false.
      [env: SHOPIFY_FLAG_WATCH]

DESCRIPTION
  Execute bulk operations on a store.

  Executes an Admin API GraphQL query or mutation on the specified store as a bulk operation, using previously stored
  app authentication.

  Run `shopify store auth` first to create stored auth for the store.

  Bulk operations allow you to process large amounts of data asynchronously. Learn more about "bulk query operations"
  (https://shopify.dev/docs/api/usage/bulk-operations/queries) and "bulk mutation operations"
  (https://shopify.dev/docs/api/usage/bulk-operations/imports).

  Mutations are disabled by default. Re-run with `--allow-mutations` if you intend to modify store data.

  Use "`store bulk status`" (https://shopify.dev/docs/api/shopify-cli/store/store-bulk-status) to check the status of
  your bulk operations.

EXAMPLES
  $ shopify store bulk execute --store shop.myshopify.com --query "query { products { edges { node { id } } } }"

  $ shopify store bulk execute --store shop.myshopify.com --query-file ./operation.graphql --watch

  $ shopify store bulk execute --store shop.myshopify.com --query-file ./mutation.graphql --variable-file ./variables.jsonl --allow-mutations
```

## `shopify store bulk status`

Check the status of bulk operations on a store.

```
USAGE
  $ shopify store bulk status -s <value> [--id <value>] [--no-color] [--verbose]

FLAGS
  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  --id=<value>
      The bulk operation ID (numeric ID or full GID). If not provided, lists all bulk operations on this store in the last
      7 days.
      [env: SHOPIFY_FLAG_ID]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Check the status of bulk operations on a store.

  Check the status of a specific bulk operation by ID, or list all bulk operations on this store in the last 7 days,
  using previously stored app authentication.

  Run `shopify store auth` first to create stored auth for the store.

  Use "`store bulk execute`" (https://shopify.dev/docs/api/shopify-cli/store/store-bulk-execute) to start a new bulk
  operation.

EXAMPLES
  $ shopify store bulk status --store shop.myshopify.com

  $ shopify store bulk status --store shop.myshopify.com --id 123456789
```

## `shopify store create preview`

Create a preview Shopify store.

```
USAGE
  $ shopify store create preview [--country <value>] [-j] [--name <value>] [--no-color] [--verbose]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --country=<value>
      Two-letter country code for the store, such as US, CA, or GB. Follows the ISO 3166-1 alpha-2 standard.
      [env: SHOPIFY_FLAG_STORE_COUNTRY]

  --name=<value>
      The name of the store.
      [env: SHOPIFY_FLAG_PREVIEW_STORE_NAME]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Create a preview Shopify store.

  Creates a new Shopify store, with no need for an existing account.

EXAMPLES
  $ shopify store create preview --name "Lavender Candles"

  $ shopify store create preview --name "Lavender Candles" --country US

  $ shopify store create preview --name "Lavender Candles" --json
```

## `shopify store execute`

Execute GraphQL queries and mutations on a store.

```
USAGE
  $ shopify store execute -s <value> [--allow-mutations] [-j] [--no-color] [--output-file <value>] [-q <value>]
    [--query-file <value>] [--variable-file <value> | -v <value>] [--verbose] [--version <value>]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -q, --query=<value>
      The GraphQL query or mutation, as a string.
      [env: SHOPIFY_FLAG_QUERY]

  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  -v, --variables=<value>
      The values for any GraphQL variables in your query or mutation, in JSON format.
      [env: SHOPIFY_FLAG_VARIABLES]

  --allow-mutations
      Allow GraphQL mutations to run against the target store.
      [env: SHOPIFY_FLAG_ALLOW_MUTATIONS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --output-file=<value>
      The file name where results should be written, instead of STDOUT.
      [env: SHOPIFY_FLAG_OUTPUT_FILE]

  --query-file=<value>
      Path to a file containing the GraphQL query or mutation. Can't be used with --query.
      [env: SHOPIFY_FLAG_QUERY_FILE]

  --variable-file=<value>
      Path to a file containing GraphQL variables in JSON format. Can't be used with --variables.
      [env: SHOPIFY_FLAG_VARIABLE_FILE]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      The API version to use for the query or mutation. Defaults to the latest stable version.
      [env: SHOPIFY_FLAG_VERSION]

DESCRIPTION
  Execute GraphQL queries and mutations on a store.

  Executes an Admin API GraphQL query or mutation on the specified store using previously stored app authentication.

  Run `shopify store auth` first to create stored auth for the store.

  Mutations are disabled by default. Re-run with `--allow-mutations` if you intend to modify store data.

EXAMPLES
  $ shopify store execute --store shop.myshopify.com --query "query { shop { name } }"

  $ shopify store execute --store shop.myshopify.com --query-file ./operation.graphql --variables '{"id":"gid://shopify/Product/1"}'

  $ shopify store execute --store shop.myshopify.com --query "mutation { shop { id } }" --allow-mutations

  $ shopify store execute --store shop.myshopify.com --query "query { shop { name } }" --json
```

## `shopify store graphiql`

Open a local GraphiQL UI for a store.

```
USAGE
  $ shopify store graphiql -s <value> [--allow-mutations] [--no-color] [--port <value>] [-v <value>] [--verbose]
    [--version <value>]

FLAGS
  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  -v, --variables=<value>
      The values for any GraphQL variables in your query or mutation, in JSON format.
      [env: SHOPIFY_FLAG_VARIABLES]

  --allow-mutations
      Allow GraphQL mutations to run against the target store.
      [env: SHOPIFY_FLAG_ALLOW_MUTATIONS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --port=<value>
      Local port for the GraphiQL server. Must be between 1 and 65535.
      [env: SHOPIFY_FLAG_PORT]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

  --version=<value>
      The API version to use in GraphiQL. Defaults to the latest stable version.
      [env: SHOPIFY_FLAG_VERSION]

DESCRIPTION
  Open a local GraphiQL UI for a store.

  Opens an authenticated Admin API GraphiQL UI for the specified store using previously stored app authentication.

  Run `shopify store auth` first to create stored auth for the store.

  Mutations are disabled by default. Re-run with `--allow-mutations` if you intend to modify store data.

EXAMPLES
  $ shopify store graphiql --store shop.myshopify.com

  $ shopify store graphiql --store shop.myshopify.com --allow-mutations

  $ shopify store graphiql --store shop.myshopify.com --port 9123
```

## `shopify store info`

Surface metadata about a Shopify store.

```
USAGE
  $ shopify store info -s <value> [-j] [--no-color] [--verbose]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Surface metadata about a Shopify store.

  Returns available metadata about a store you have access to, such as its id, display name, subdomain, organization,
  store owner, type, plan, feature preview, admin URL, and access and save URLs for preview stores.

  Some details may be omitted when they are not available for the store.

  Use `--json` for machine-readable output.

EXAMPLES
  $ shopify store info --store shop.myshopify.com

  $ shopify store info --store shop.myshopify.com --json
```

## `shopify store list`

List stores in a Shopify organization.

```
USAGE
  $ shopify store list [-j] [--no-color] [--organization-id <value>] [--verbose]

FLAGS
  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --organization-id=<value>
      The numeric organization ID. Auto-selects if you belong to a single organization. Required if non interactive when
      more than one organization is available.
      [env: SHOPIFY_FLAG_ORGANIZATION_ID]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  List stores in a Shopify organization.

  Lists stores in a Shopify organization available to the current CLI account.

  When more than one organization is available, the command prompts you to pick one unless you provide
  `--organization-id`. In that case, `--organization-id` is required in non-interactive environments.

  Run `shopify organization list` to find organization IDs.

EXAMPLES
  $ shopify store list

  $ shopify store list --organization-id 1234567

  $ shopify store list --json
```

## `shopify store open`

Open your Shopify store in the default web browser.

```
USAGE
  $ shopify store open -s <value> [--no-color] [--verbose]

FLAGS
  -s, --store=<value>
      (required) The myshopify.com domain of the store.
      [env: SHOPIFY_FLAG_STORE]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Open your Shopify store in the default web browser.

  Opens the storefront for a store you have access to in your default web browser.

EXAMPLES
  $ shopify store open --store shop.myshopify.com
```

## `shopify theme check`

Validate the theme.

```
USAGE
  $ shopify theme check [--auth-alias <value>] [-a] [-C <value>] [-e <value>...] [--fail-level
    crash|error|suggestion|style|warning|info] [--init] [--list] [--no-color] [-o text|json] [--path <value>] [--print]
    [--verbose] [-v]

FLAGS
  -C, --config=<value>
      Use the config provided, overriding .theme-check.yml if present
      Supports all theme-check: config values, e.g., theme-check:theme-app-extension,
      theme-check:recommended, theme-check:all
      For backwards compatibility, :theme_app_extension is also supported
      [env: SHOPIFY_FLAG_CONFIG]

  -a, --auto-correct
      Automatically fix offenses
      [env: SHOPIFY_FLAG_AUTO_CORRECT]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -o, --output=<option>
      [default: text] The output format to use
      [env: SHOPIFY_FLAG_OUTPUT]
      <options: text|json>

  -v, --version
      Print Theme Check version
      [env: SHOPIFY_FLAG_VERSION]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --fail-level=<option>
      [default: error] Minimum severity for exit with error code
      [env: SHOPIFY_FLAG_FAIL_LEVEL]
      <options: crash|error|suggestion|style|warning|info>

  --init
      Generate a .theme-check.yml file
      [env: SHOPIFY_FLAG_INIT]

  --list
      List enabled checks
      [env: SHOPIFY_FLAG_LIST]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --print
      Output active config to STDOUT
      [env: SHOPIFY_FLAG_PRINT]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --store-password=<value>
      The password for storefronts with password protection.
      [env: SHOPIFY_FLAG_STORE_PASSWORD]

  --url=<value>
      [default: /] The url to be used as context
      [env: SHOPIFY_FLAG_URL]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme delete [--auth-alias <value>] [-d] [-e <value>...] [-f] [--no-color] [--password <value>]
    [--path <value>] [-a] [-s <value>] [-t <value>...] [--verbose]

FLAGS
  -a, --show-all
      Include other development themes in the theme list. Use --show-all, --development, or --theme in non-interactive
      environments.
      [env: SHOPIFY_FLAG_SHOW_ALL]

  -d, --development
      Delete your development theme. Use --show-all, --development, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_DEVELOPMENT]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -f, --force
      Skip confirmation. Required if non interactive.
      [env: SHOPIFY_FLAG_FORCE]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>...
      Theme ID or name of the remote theme. Use --show-all, --development, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme dev [-a] [--auth-alias <value>] [-e <value>...] [--error-overlay silent|default] [--host
    <value>] [-x <value>...] [--listing <value>] [--live-reload hot-reload|full-page|off] [--no-color] [-n] [--notify
    <value>] [-o <value>...] [--open] [--password <value>] [--path <value>] [--port <value>] [--reconciliation-strategy
    keep-local|keep-remote|abort --theme-editor-sync] [--standard-events-inspector] [-s <value>] [--store-password
    <value>] [-t <value>] [--verbose]

FLAGS
  -a, --allow-live
      Allow development on a live theme.
      [env: SHOPIFY_FLAG_ALLOW_LIVE]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -n, --nodelete
      Prevents files from being deleted in the remote theme when a file has been deleted locally. This applies to files
      that are deleted while the command is running, and files that have been deleted locally before the command is run.
      [env: SHOPIFY_FLAG_NODELETE]

  -o, --only=<value>...
      Hot reload only files that match the specified pattern.
      [env: SHOPIFY_FLAG_ONLY]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme.
      [env: SHOPIFY_FLAG_THEME_ID]

  -x, --ignore=<value>...
      Skip hot reloading any files that match the specified pattern.
      [env: SHOPIFY_FLAG_IGNORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --error-overlay=<option>
      [default: default] Controls the visibility of the error overlay when an theme asset upload fails:
      - silent Prevents the error overlay from appearing.
      - default Displays the error overlay.

      [env: SHOPIFY_FLAG_ERROR_OVERLAY]
      <options: silent|default>

  --host=<value>
      Set which network interface the web server listens on. The default value is 127.0.0.1.
      [env: SHOPIFY_FLAG_HOST]

  --listing=<value>
      The listing preset to use for multi-preset themes. Applies preset files from listings/[preset-name] directory.
      [env: SHOPIFY_FLAG_LISTING]

  --live-reload=<option>
      [default: hot-reload] The live reload mode switches the server behavior when a file is modified:
      - hot-reload Hot reloads local changes to CSS and sections (default)
      - full-page  Always refreshes the entire page
      - off        Deactivate live reload
      [env: SHOPIFY_FLAG_LIVE_RELOAD]
      <options: hot-reload|full-page|off>

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --notify=<value>
      The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a
      webhook posted to report on file changes.
      [env: SHOPIFY_FLAG_NOTIFY]

  --open
      Automatically launch the theme preview in your default web browser.
      [env: SHOPIFY_FLAG_OPEN]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --port=<value>
      Local port to serve theme preview from. Must be between 1 and 65535.
      [env: SHOPIFY_FLAG_PORT]

  --reconciliation-strategy=<option>
      How to resolve JSON conflicts when --theme-editor-sync is enabled. Use keep-local to keep local files, keep-remote
      to keep remote files, or abort to fail instead of prompting.
      [env: SHOPIFY_FLAG_RECONCILIATION_STRATEGY]
      <options: keep-local|keep-remote|abort>

  --standard-events-inspector
      Inject the standard events inspector into storefront HTML.
      [env: SHOPIFY_FLAG_STANDARD_EVENTS_INSPECTOR]

  --store-password=<value>
      The password for storefronts with password protection.
      [env: SHOPIFY_FLAG_STORE_PASSWORD]

  --theme-editor-sync
      Synchronize Theme Editor updates in the local theme files.
      [env: SHOPIFY_FLAG_THEME_EDITOR_SYNC]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -f, --force
      Force the duplicate operation to run without prompts or confirmations. Required if non interactive outside CI.
      [env: SHOPIFY_FLAG_FORCE]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -n, --name=<value>
      Name of the newly duplicated theme.
      [env: SHOPIFY_FLAG_NAME]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme. Required if non interactive.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme info [--auth-alias <value>] [-d] [-e <value>...] [-j] [--no-color] [--password <value>]
    [--path <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -d, --development
      Retrieve info from your development theme.
      [env: SHOPIFY_FLAG_DEVELOPMENT]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  -l, --latest
      Downloads the latest release of the `clone-url`
      [env: SHOPIFY_FLAG_LATEST]

  -u, --clone-url=<value>
      [default: https://github.com/Shopify/skeleton-theme.git] The Git URL to clone from. Defaults to Shopify's Skeleton
      theme.
      [env: SHOPIFY_FLAG_CLONE_URL]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme language-server [--auth-alias <value>] [--no-color] [--verbose]

FLAGS
  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Start a Language Server Protocol server.

  Starts the "Language Server" (https://shopify.dev/docs/themes/tools/cli/language-server).
```

## `shopify theme list`

Lists the themes in your store, along with their IDs and statuses.

```
USAGE
  $ shopify theme list [--auth-alias <value>] [-e <value>...] [--id <value>] [-j] [--name <value>] [--no-color]
    [--password <value>] [--path <value>] [--role live|unpublished|development] [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --id=<value>
      Only list theme with the given ID.
      [env: SHOPIFY_FLAG_ID]

  --name=<value>
      Only list themes that contain the given name.
      [env: SHOPIFY_FLAG_NAME]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --role=<option>
      Only list themes with the given role.
      [env: SHOPIFY_FLAG_ROLE]
      <options: live|unpublished|development>

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Lists the themes in your store, along with their IDs and statuses.
```

## `shopify theme metafields pull`

Download metafields definitions from your shop into a local file.

```
USAGE
  $ shopify theme metafields pull [--auth-alias <value>] [-e <value>...] [--no-color] [--password <value>] [--path <value>]
    [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Download metafields definitions from your shop into a local file.

  Retrieves metafields from Shopify Admin.

  If the metafields file already exists, it will be overwritten.
```

## `shopify theme open`

Opens the preview of your remote theme.

```
USAGE
  $ shopify theme open [--auth-alias <value>] [-d] [-E] [-e <value>...] [-l] [--no-color] [--password <value>]
    [--path <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -E, --editor
      Open the theme editor for the specified theme in the browser.
      [env: SHOPIFY_FLAG_EDITOR]

  -d, --development
      Open your development theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_DEVELOPMENT]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -l, --live
      Open your live (published) theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_LIVE]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme package [--auth-alias <value>] [--no-color] [--path <value>] [--verbose]

FLAGS
  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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

## `shopify theme preview`

Applies JSON overrides to a theme and returns a preview URL.

```
USAGE
  $ shopify theme preview --overrides <value> -t <value> [--auth-alias <value>] [-e <value>...] [--json]
    [--no-color] [--open] [--password <value>] [--path <value>] [--preview-id <value>] [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      (required) Theme ID or name of the remote theme.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --json
      Output the preview URL and identifier as JSON.
      [env: SHOPIFY_FLAG_JSON]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --open
      Automatically launch the theme preview in your default web browser.
      [env: SHOPIFY_FLAG_OPEN]

  --overrides=<value>
      (required) Path to a JSON overrides file.
      [env: SHOPIFY_FLAG_OVERRIDES]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --preview-id=<value>
      An existing preview identifier to update instead of creating a new preview.
      [env: SHOPIFY_FLAG_PREVIEW_ID]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Applies JSON overrides to a theme and returns a preview URL.

  Applies a JSON overrides file to a theme and creates or updates a preview. This lets you quickly preview changes.

  The command returns a preview URL and a preview identifier. You can reuse the preview identifier with `--preview-id`
  to update an existing preview instead of creating a new one.
```

## `shopify theme profile`

Profile the Liquid rendering of a theme page.

```
USAGE
  $ shopify theme profile
  $ shopify theme profile --url /products/classic-leather-jacket

FLAGS
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --store-password=<value>
      The password for storefronts with password protection.
      [env: SHOPIFY_FLAG_STORE_PASSWORD]

  --url=<value>
      [default: /] The url to be used as context
      [env: SHOPIFY_FLAG_URL]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme publish [--auth-alias <value>] [-e <value>...] [-f] [--no-color] [--password <value>] [--path
    <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -f, --force
      Skip confirmation. Required if non interactive.
      [env: SHOPIFY_FLAG_FORCE]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme. Required if non interactive.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme pull [--auth-alias <value>] [-d] [-e <value>...] [-x <value>...] [-l] [--no-color] [-n] [-o
    <value>...] [--password <value>] [--path <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -d, --development
      Pull theme files from your remote development theme. Use --development, --live, or --theme in non-interactive
      environments.
      [env: SHOPIFY_FLAG_DEVELOPMENT]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -l, --live
      Pull theme files from your remote live theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_LIVE]

  -n, --nodelete
      Prevent deleting local files that don't exist remotely.
      [env: SHOPIFY_FLAG_NODELETE]

  -o, --only=<value>...
      Download only the specified files (Multiple flags allowed). Wrap the value in double quotes if you're using
      wildcards.
      [env: SHOPIFY_FLAG_ONLY]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_THEME_ID]

  -x, --ignore=<value>...
      Skip downloading the specified files (Multiple flags allowed). Wrap the value in double quotes if you're using
      wildcards.
      [env: SHOPIFY_FLAG_IGNORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  -a, --allow-live
      Allow push to a live theme. Required in non-interactive environments when targeting the live theme.
      [env: SHOPIFY_FLAG_ALLOW_LIVE]

  -c, --development-context=<value>
      Unique identifier for a development theme context (e.g., PR number, branch name). Reuses an existing development
      theme with this context name, or creates one if none exists.
      [env: SHOPIFY_FLAG_DEVELOPMENT_CONTEXT]

  -d, --development
      Push theme files from your remote development theme. Use --development, --live, --theme, or --unpublished in
      non-interactive environments.
      [env: SHOPIFY_FLAG_DEVELOPMENT]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -j, --json
      Output the result as JSON. Automatically disables color output.
      [env: SHOPIFY_FLAG_JSON]

  -l, --live
      Push theme files from your remote live theme. Use --development, --live, --theme, or --unpublished in
      non-interactive environments.
      [env: SHOPIFY_FLAG_LIVE]

  -n, --nodelete
      Prevent deleting remote files that don't exist locally.
      [env: SHOPIFY_FLAG_NODELETE]

  -o, --only=<value>...
      Upload only the specified files (Multiple flags allowed). Wrap the value in double quotes if you're using wildcards.
      [env: SHOPIFY_FLAG_ONLY]

  -p, --publish
      Publish as the live theme after uploading.
      [env: SHOPIFY_FLAG_PUBLISH]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme. Use --development, --live, --theme, or --unpublished in non-interactive
      environments. When using --unpublished without --development, use --theme to provide the new theme name.
      [env: SHOPIFY_FLAG_THEME_ID]

  -u, --unpublished
      Create a new unpublished theme and push to it. Use --development, --live, --theme, or --unpublished in
      non-interactive environments. When using --unpublished without --development, use --theme to provide the new theme
      name.
      [env: SHOPIFY_FLAG_UNPUBLISHED]

  -x, --ignore=<value>...
      Skip uploading the specified files (Multiple flags allowed). Wrap the value in double quotes if you're using
      wildcards.
      [env: SHOPIFY_FLAG_IGNORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --listing=<value>
      The listing preset to use for multi-preset themes. Applies preset files from listings/[preset-name] directory.
      [env: SHOPIFY_FLAG_LISTING]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --strict
      Require theme check to pass without errors before pushing. Warnings are allowed.
      [env: SHOPIFY_FLAG_STRICT_PUSH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme rename [--auth-alias <value>] [-d] [-e <value>...] [-l] [-n <value>] [--no-color] [--password
    <value>] [--path <value>] [-s <value>] [-t <value>] [--verbose]

FLAGS
  -d, --development
      Rename your development theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_DEVELOPMENT]

  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -l, --live
      Rename your remote live theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_LIVE]

  -n, --name=<value>
      The new name for the theme. Required if non interactive.
      [env: SHOPIFY_FLAG_NEW_NAME]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  -t, --theme=<value>
      Theme ID or name of the remote theme. Use --development, --live, or --theme in non-interactive environments.
      [env: SHOPIFY_FLAG_THEME_ID]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

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
  $ shopify theme share [--auth-alias <value>] [-e <value>...] [--listing <value>] [--no-color] [--password
    <value>] [--path <value>] [-s <value>] [--verbose]

FLAGS
  -e, --environment=<value>...
      The environment to apply to the current command.
      [env: SHOPIFY_FLAG_ENVIRONMENT]

  -s, --store=<value>
      Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com,
      https://example.myshopify.com).
      [env: SHOPIFY_FLAG_STORE]

  --auth-alias=<value>
      Alias of the Shopify account to use for authentication.
      [env: SHOPIFY_FLAG_AUTH_ALIAS]

  --listing=<value>
      The listing preset to use for multi-preset themes. Applies preset files from listings/[preset-name] directory.
      [env: SHOPIFY_FLAG_LISTING]

  --no-color
      Disable color output.
      [env: SHOPIFY_FLAG_NO_COLOR]

  --password=<value>
      Password generated from the Theme Access app or an Admin API token.
      [env: SHOPIFY_CLI_THEME_TOKEN]

  --path=<value>
      The path where you want to run the command. Defaults to the current working directory.
      [env: SHOPIFY_FLAG_PATH]

  --verbose
      Increase the verbosity of the output. May include sensitive data.
      [env: SHOPIFY_FLAG_VERBOSE]

DESCRIPTION
  Creates a shareable, unpublished, and new theme on your theme library with a randomized name.

  Uploads your theme as a new, unpublished theme in your theme library. The theme is given a randomized name.

  This command returns a "preview link"
  (https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can
  share with others.
```

## `shopify upgrade`

Upgrades Shopify CLI.

```
USAGE
  $ shopify upgrade

DESCRIPTION
  Upgrades Shopify CLI.

  Upgrades Shopify CLI using your package manager.
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
