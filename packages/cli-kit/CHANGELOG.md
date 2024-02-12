# @shopify/cli-kit

## 3.56.0

### Minor Changes

- 1220290ec: Add placeholder tab completion to text prompts

## 3.55.0

## 3.54.0

### Minor Changes

- a9e847717: Refine `shopify theme pull` implementation to no longer require a Ruby setup
- a9e847717: Upgrade oclif to v3 (improved help menus and more)
- a9e847717: Add `performActionWithRetryAfterRecovery` to codify pattern of optimistic attempt + recovery/retry mechanism
- a9e847717: Fix password page error for safari

### Patch Changes

- a9e847717: Update @shopify/polaris and @shopify/polaris-icons to latest version

## 3.53.0

### Minor Changes

- 1d6fe3475: Increase minimum Node version to 18
- 0896e62b1: Versioned app config support
- 72b1daaee: Add new `nodelete` flag to `shopify theme dev` command

### Patch Changes

- cc3ada0a2: Throw an error correctly if reauthenticating in non-TTY with noPrompt = true

## 3.52.0

### Minor Changes

- 060bd75cf: Support client credentials flow (currently used in GraphiQL)
- 060bd75cf: Expose functions to get information on available Admin API versions

### Patch Changes

- 4ea4c08dd: Fix bundler env vars
- 1de8122c4: No longer drops _.json templates when there is a _.json.liquid template with the same name.
- 9cbe46e06: Fix a bug with keypresses after Input

## 3.51.0

### Minor Changes

- 533c66492: Adds `pascalize` function which wraps the `pascalCase` function from change-case package
- 64b49598b: Support Bun as a package manager (experimental)
- e72b4f1c8: Allow refreshing a Partners token without a fallback to prompting

### Patch Changes

- a8c8b1e6b: Fix node/git isClean to return a boolean value instead of a function
- 8b7ce36b1: Fix node site link, which was just changed
- b90f24b2e: Warn when using EoL'ed Node
- 8c979a621: Fix TAE hot code reloading in spin
- 7802bffa9: Fix duplicated error messages
- 28e629078: Fix ruby bundler config when Rails app that uses bundler local config
- 0b8b97993: Fixing CLI Kit base-command to await errorHandler method instead of exiting early

## 3.50.0

### Minor Changes

- 4bb8fff29: Added InfoToken, WarnToken, and ErrorToken to cli-kit ui
- 3f36e9463: Fixed CI issue due to theme check --dev-preview --version implementation

### Patch Changes

- cf5bbff61: Add verbose logs for Bugsnag reporting
- 46a72a6b4: Fix NPM separator warning for negated flags
- 3ed6ae88e: Dev component rethrow the exception to display error banner
- d6b02afcf: Fix incorrect variables in getCIMetadata
- e0cd881e1: Add monorail config for reliability metrics
- 20d667246: Add OpenTelemetry helper library

## 3.49.1

## 3.49.0

### Minor Changes

- b2e93d9c3: Validate deploy flags in non-TTY environments
- b4c9439c4: add Github attempt number to getCIMetadata

### Patch Changes

- 6211a4aea: Only report non-200 statuses on GraphQL errors
- 8f5ac815e: Remove dev preview enabled flickering status
- f1a774c78: Notify theme/theme extension updates when the workers have gone idle
- 1914affaf: Fix pnpm shopify upgrade for workspaces
- 8d3578b87: Fix internal server error issue in the `shopify theme dev` command
- 6ab0ce1a8: Include Request ID in error message
- d230b8773: - Enable dev preview mode on startup.
  - Add dev log footer shortcut to toggle dev preview mode on/off.
  - Disabke dev preview mode when exit
- 3c88932af: Fix loading of custom fonts
- c4396fd58: Make commands pop with magenta coloring

## 3.48.0

### Minor Changes

- 91e7a1fd8: output: pass logLevel to Logger
- 598812ca0: Introduces a dangerous confirmation prompt which requires a specific string input. This is used to grab the user's intention about a particularly dangerous operation.
- 934c53968: Add scrollbar to prompts
- a17e43672: Implement Unified Deployments

### Patch Changes

- a156c8b7b: Display infoTables with a single column and custom bullets
- f32c66bf6: Display dev preview warn message running dev command
- cf52851b7: Remove automatic key generation for select prompt choices
- 2afacc5e1: Dev preview is not automatically enabled/disabled when running the commands dev and deploy
- 48f5934d7: Remove limit of 25 items per select prompt
- 0705bc30f: Remove dates from dev and deploy logs
- 9311df3a7: Fix log line wrapping so line sections don't wrap
- 6a1b88228: Improve error message on non-tty when prompting for a key press
- f0adf0651: Improve Cloudflare errors
- 64f0d4821: Show a warning when passing a flag witn npm without the -- separator
- 029b49795: Keep showing the footer when running dev with extension only apps
- 7d512e1b0: Fix image_url on data attributes
- 2a1cfc206: The status of registered, but unreleased, CLI-managed extensions in the deploy confirmation prompt are based on their relation to the active app version (or a blank slate if there's no active version)

## 3.47.0

### Minor Changes

- 99df79caf: Add GitDiff component for showing diffs in confirmation prompts

### Patch Changes

- ad3894aea: Fix an issue in `shopify theme dev` and `shopify app dev` that was affecting image loading on local servers
- 9bb98c029: Remove image proxying through local server to enable proper functioning of Liquid filters
- ca2461e94: Fix theme dev re-authentication
- 4ded88051: Show extensions as disabled during generation when they have reached their limit
- 99fc03fbc: Fix an issue in `shopify theme dev` that was affecting asset loading on local servers, in some shops
- e217b34eb: Add React deduplication plugin for ESBuild & extensions

## 3.47.0-pre.0

### Patch Changes

- ad3894aea: Fix an issue in `shopify theme dev` and `shopify app dev` that was affecting image loading on local servers
- ca2461e94: Fix theme dev re-authentication
- 4ded88051: Show extensions as disabled during generation when they have reached their limit

## 3.46.0

### Minor Changes

- 162504891: Introduce the `--notify` flag in the shopify app/theme dev commands
- 9de04da4d: Introduce `.jpeg` support for theme app extensions
- 1c8afb7f4: lookupMimeType and setMimeTypes using mrmime
- 151684a25: - Improve rule for lazy loading to prevent developers from overusing it
  - Introduce `--update-docs` flag to synchronously update Theme Check resources (objects, filters, and tags)
- 01988114d: Add support for Google Cloud Shell
- 3169c1e44: Introduce partial support for --no-color mode

### Patch Changes

- d9ef6c3f6: Add support to display an empty value when the input in configured to allow empty values
- 33881af95: fixes theme preview for new shopify cdn url format
- 2729e3784: Fix autocomplete height resize when items are split in groups
- 3b1da7747: Fix unavailable constant reference in theme dev
- a7c1eabeb: Add support for theme app extensions in Spin
- cc37858fb: Disable concurrent output component in a non tty terminal
- 1707ef75a: Set current CLI3 version as the version used by the cli-ruby API requests
- 94d197f63: Display clear error message when prompting fails due to non-TTY terminal
- 9e4c97b52: Add abortSignal to async ui function parameters
- f95e3a1d5: Do not proxy /localization and /cart/ requests
- 37b53a5be: Install exact versions with NPM by default
- beda7c241: Fix peer dependency resolution issue with npm
- 07d0be690: Fix localhost as host to run the library get port please
- 6663b3a8f: ciPlatform: return metadata from environment variables
- 069e38ecf: Fix graphql query for products to only retrieve published products

## 3.46.0-pre.3

### Minor Changes

- 1c8afb7f4: lookupMimeType and setMimeTypes using mrmime

### Patch Changes

- d9ef6c3f6: Add support to display an empty value when the input in configured to allow empty values
- cc37858fb: Disable concurrent output component in a non tty terminal
- 6663b3a8f: ciPlatform: return metadata from environment variables
- 069e38ecf: Fix graphql query for products to only retrieve published products

## 3.46.0-pre.2

### Minor Changes

- 162504891: Introduce the `--notify` flag in the shopfiy app/theme dev commands
- 151684a25: - Improve rule for lazy loading to prevent developers from overusing it
  - Introduce `--update-docs` flag to synchronously update Theme Check resources (objects, filters, and tags)
- 01988114d: Add support for Google Cloud Shell

### Patch Changes

- a7c1eabeb: Add support for theme app extensions in Spin

## 3.46.0-pre.1

### Minor Changes

- 3169c1e44: Introduce partial support for --no-color mode

### Patch Changes

- beda7c241: Fix peer dependency resolution issue with npm

## 3.46.0-pre.0

### Patch Changes

- f95e3a1d5: Do not proxy /localization and /cart/ requests

## 3.45.0

### Minor Changes

- 1dd35b0b2: Enable environments for themes
- e85f718cd: Use `-e` as an alias for --environment and remove the current one for --theme-editor-sync
- e6753f4ed: Upgrade Ink to 4.0.0 which is pure ESM and uses React 18
- 645b085b8: Render upgrade warning if Partners API returns deprecation dates

### Patch Changes

- da01d3595: Send environment flags to analytics
- db5981a1e: Clean errors related to metrics requests on theme dev
- 7f8a9436d: Add log information when graphql requests return an error
- d2a352442: Added 2 new utilities on the git module:

  - git.ensureIsClean(directory?: string): Promise<void>: If the .git directory tree is not clean (has uncommitted changes) it throws an abort error.
  - git.isClean(directory?: string): Promise<boolean>: Returns true if the .git directory tree is clean (no uncommitted changes).

- 25fc42ae2: Fix: Run ruby with shopify bin file as an argument
- fe32fb789: Fix issue with dev footer and resizing the terminal
- 4d5cff225: Fix issue with unicode characters not being displayed correctly in log output
- a4b0953d9: Fix visual bug appearing when pressing enter while tasks are running
- 6735253e6: Adopt the CLI UI kit in the `shopify theme dev` command
- d6f278863: Integrate Theme App Extension output with the new UI Kit
- ddb967914: Fix log from api responses for node version that donnot support Headers type
- c3d5ce5e6: Fix layout width for very narrow terminals
- 4bb549840: Fix introspection URL cache
- b2e066fc0: Fix error by installing gems in local folder instead of system folder
- 9c253511e: Do not inject hot-reload code into web-pixels-manager sandbox
- 657593b1a: Fix run dev with theme app extension and spin
- ce1457036: Resolve renderTasks with the value of context
- 163df5e9a: Add default value option to renderConfirmation prompt
- b3ea29a21: Fix prompts not showing the question in short terminals
- 2ca5b35d8: Add UI Kit documentation
- 067199cf6: Pass development theme from CLI 3’s to CLI 2’s local storage
- 7153dff92: Cut long host names for development theme naming

## 3.45.0-pre.5

### Minor Changes

- e85f718cd: Use `-e` as an alias for --environment and remove the current one for --theme-editor-sync
- e6753f4ed: Upgrade Ink to 4.0.0 which is pure ESM and uses React 18
- 645b085b8: Render upgrade warning if Partners API returns deprecation dates

### Patch Changes

- da01d3595: Send environment flags to analytics
- 6735253e6: Adopt the CLI UI kit in the `shopify theme dev` command

## 3.45.0-pre.4

### Patch Changes

- ce1457036: Resolve renderTasks with the value of context
- 2ca5b35d8: Add UI Kit documentation

## 3.45.0-pre.3

### Patch Changes

- ddb967914: Fix log from api responses for node version that donnot support Headers type
- 7153dff92: Cut long host names for development theme naming

## 3.45.0-pre.2

### Patch Changes

- 9c253511e: Do not inject hot-reload code into web-pixels-manager sandbox

## 3.45.0-pre.1

### Minor Changes

- 1dd35b0b2: Enable environments for themes

### Patch Changes

- db5981a1e: Clean errors related to metrics requests on theme dev
- 7f8a9436d: Add log information when graphql requests return an error
- fe32fb789: Fix issue with dev footer and resizing the terminal
- 4d5cff225: Fix issue with unicode characters not being displayed correctly in log output
- a4b0953d9: Fix visual bug appearing when pressing enter while tasks are running
- d6f278863: Integrate Theme App Extension output with the new UI Kit
- c3d5ce5e6: Fix layout width for very narrow terminals
- b3ea29a21: Fix prompts not showing the question in short terminals
- 067199cf6: Pass development theme from CLI 3’s to CLI 2’s local storage

## 3.44.1-pre.0

### Patch Changes

- 25fc42ae2: Fix: Run ruby with shopify bin file as an argument
- b2e066fc0: Fix error by installing gems in local folder instead of system folder
- 657593b1a: Fix run dev with theme app extension and spin

## 3.44.0

### Patch Changes

- 999a2fc79: For the embedded cli-ruby the dependencies were moved from the gemspec to the Gemfile
- b61c5972c: Speed up app dev by running web requests in parallel
- d44250676: Fixed problem with theme app extension server in spin
- c8e75ac24: Added windows gem depencies to embedded cli-ruby
- fb22cb013: Remove theme directory confirmation during tests and make confirmation dialogue respect `SHOPIFY_CLI_TTY`.
- 159df5d07: Embedded cli-ruby opt-in by default. Use SHOPIFY_CLI_BUNDLED_THEME_CLI=1 in case of problems with the embedded version.
- 2def6f113: Use app host for frontend url in spin when available
- ef3846d91: Do not inject hot-reload code into web-pixels-manager sandbox
- 3a75ed0a7: Remove `e` shortcut to environments flag to avoid conflicts
- d2adeb5ec: Extract the ownership of host themes to the CLI3

## 3.43.0

### Minor Changes

- 4b0cc57ce: Theme bundling is now an opt-in feature

### Patch Changes

- f732207fa: Fix embedded Ruby CLI (remove Gemfile.lock)
- b6f93cfa7: Use bundled Ruby CLI by default

## 3.42.0

### Patch Changes

- 2203d4e6f: Fix theme issues with bundler and ruby version managers

## 3.41.2

## 3.41.1

## 3.41.0

### Minor Changes

- 9d9480341: Add developer experience preview for JavaScript functions

## 3.40.3

## 3.40.2

### Patch Changes

- 7c0b13944: Fix Banner potentially crashing on very narrow terminals
- 7ca9a667d: Fix Ruby version for running CLI with Homebrew installs

## 3.40.1

## 3.40.0

### Minor Changes

- cfb4b7f68: Improve output of preview instructions in dev command

### Patch Changes

- 91e15fed4: UI Kit UX improvements
- 9e74a9fc0: Send an app/uninstalled webhook to the app when the user selects a different app, to force the app to clean up the store's database entry
- 1661f80a2: Various copy improvements
- ae22dfbaf: Theme commands run using embedded CLI2
- 7734a7ed3: Add contributing guide for UI Kit
- 5ba869fb2: Extract the ownership of development themes
- 228328a6d: Remove old `ui` module from cli-kit exports
- c30eb6978: Rename experimental presets feature to environments

## 3.39.0

### Minor Changes

- f4d5fb1a8: Replace the UI of all tasks renderers and remove listr2 as a dependency

### Patch Changes

- afe541577: Adopt the CLI UI kit in the `shopify theme package` command
- 91a44020b: Warn the user if there are more than 25 apps in app selection prompt

## 3.38.0

## 3.37.0

### Patch Changes

- a5224543b: Fix issue with CLI2 task output not being rendered correctly inside the output from the dev command

## 3.36.2

### Patch Changes

- 3ddd21dba: Add better TypeScript support when formating files with the fs module by explicitly setting the parser to "typescript" in the prettier config. Fixes issues where the babel parser was not able to process JSX in TypeScript files.

## 3.36.1

### Patch Changes

- d81271abd: Fix performance import for Node 14

## 3.36.0

### Minor Changes

- c2a7c17e0: Refresh command UIs with newly implemented Ink components

## 3.35.0

### Minor Changes

- 50c0b2cd3: - Adopt CLI UI kit on `shopify theme delete` command
  - Introduce the `pluralize` API on `@shopify/cli-kit/common/string`
- a4f78e95f: Update 'pathe' to 1.0.0

### Patch Changes

- 2aa5c07aa: Fix output for pnpm commands with parameters
- 1a482191a: Improve the DX of the `shopify theme list` command, by adopting the CLI UI kit

## 3.34.0

## 3.33.0

### Minor Changes

- 9eb807bf7: Add confirmation summary when deploying your app to Shopify. This will show new extensions, updated extensions and extensions which are missing locally. You can pass `--force` to the deploy command to skip this prompt.

### Patch Changes

- eee1293ef: - Introduce REST Admin API client on `@shopify/cli-kit`
  - Improve the DX of the `shopify theme open` command, by adopting the CLI UI kit
- 5e7474fab: CLI2 version pumped to 2.34.0

## 3.32.1

### Patch Changes

- 39315c3d0: Bump theme-check to version 1.14.0

## 3.32.0

### Patch Changes

- a8489366: Bumped CLI2 to 2.33.1.
- 00de42e8: Add Text Prompt component

## 3.31.1

## 3.31.0

### Patch Changes

- 80c6638c: Add Tasks component that displays a loading bar while async tasks are running
- dcf53ece: Add support in spin to set the flag store with only the store name

## 3.30.2

### Patch Changes

- ba91a2da: Fix terminal links adding a zero-width character
- 23b1cc84: Add timing information to verbose logs

## 3.30.1

### Patch Changes

- 2ac83ce6: Fix error handling on session refresh

## 3.30.0

### Minor Changes

- 737ca469: Remove logs functionality

## 3.29.0

### Minor Changes

- aeca53c6: Upgrade CLI 2.0 and theme-check dependencies
- b549291a: Update @oclif/core to 1.21.0
- 06b6b00d: Allow passing a filter function to autocomplete prompts

### Patch Changes

- eaf98706: - Refresh token if possible, fallback to full login when it's not possible
  - Parallelize access token refreshes
- d12ece22: Add new single select prompt to the UI library
- 3b37c679: Enable password flag for theme dev

## 3.28.0

## 3.27.0

### Minor Changes

- 32bbe23d: Remove the version export from the @shopify/cli-kit module and merge its functions into @shopify/cli-kit/node/node-package-manager

## 3.26.0

### Minor Changes

- 0d8ac8c9: Not show a message when we truncate the logs file
- ab76be51: Add 'wdm' to bundled CLI 2.x Gemfile

### Patch Changes

- a6a3f2b4: Redirect extension output messages to concurrent output UI component
- ca8141bc: Fix CLI not killing Node processes after quitting `dev` on Windows

## 3.25.0

### Patch Changes

- 78196a78: Improve text contrast of UI kit components and introduce several new text tokens

## 3.24.1

### Patch Changes

- 7e5c492a: Fix errors not being displayed properly when coming from processes rendered concurrently

## 3.24.0

### Patch Changes

- d47a6e80: Improve success message style in create-app command
- a9d4be9e: Generate creative suggested names for new themes
- aca90638: Removed unnecessary line breaks in concurrent output
- cb0990df: Fixed no organization error formatting

## 3.23.0

### Minor Changes

- c15ad5df: Rename port to tcp and export its API from the module @shopify/cli-kit/node/tcp instead of @shopify/cli-kit
- 1ee1cfd1: Expose the semver API from the @shopify/cli-kit/node/semver and improve the function semantics

## 3.22.1

## 3.22.0

### Patch Changes

- e0b5c20b: Update the version of the Ruby CLI
- 6de19ebd: Move haiku's exported logic into the @shopify/cli-kit/common/string and @shopify/cli-kit/node/fs modules and remove the export from @shopify/cli-kit
- 6c0cd13d: Polish log truncation process
- 7035d36b: Fixed third party errors formatting issue

## 3.21.0

### Minor Changes

- 5cda6300: Enable external access to cli inside a spin instance

### Patch Changes

- e4352f2e: Do not report handled tunnel plugin errors to Bugsnag
- c906187f: Add backticks surrounding command tokens

## 3.20.1

### Patch Changes

- 3f285ff9: Fix homebrew upgrade to handle shopify-cli package

## 3.20.0

### Minor Changes

- 96d5b175: Enable experimental presets feature for apps and themes
- 4bd05555: Add experimental preset flag for pre-specifying command line flags

### Patch Changes

- 0a8ee2a3: Document how to style error messages
- efa5b071: Refresh theme dev session every 90 minutes

## 3.19.0

### Minor Changes

- 7bb5c23f: Add ensureAuthenticatedThemes helper for session

## 3.18.0

### Minor Changes

- b4dafa4f: Add timestamps to logs and introduce first UI kit components
- 65625f47: Send a new environment variable to apps in dev command with the spin store domain.

### Patch Changes

- ef42fda6: Improve error outputs by using the new Banner component
- 514f2cb5: Support git 2.28 or earlier when initializing a repository
- 1455ee44: Improve how concurrent processes output looks
- 0d674d64: Output messages with partners urls fixed when running against an spin instance

## 3.17.0

### Minor Changes

- 483318aa: Create a new Oxygen service for interacting with Oxygen related services.

### Patch Changes

- dac186b2: Removing unnecessary calls to enqueue and check compilation status
- 5617050a: initializeRepository now defaults to 'main' as initial branch.
- 5703ce9b: Cloud environment checking was not working properly so wrong authentication method was used

## 3.16.3

### Patch Changes

- fc4d6c58: Removed unused fields from FunctionSet mutation

## 3.16.2

### Patch Changes

- ca6c7295: React types dependency version should be overwritten when generating React Typescript extensions

## 3.16.1

## 3.16.0

### Minor Changes

- d460e738: Add the `app generate schema <function-name>` command

## 3.15.0

### Minor Changes

- 9f7d90d9: Add dev, build, deploy and another additional baseline instrumentantion

## 3.14.0

### Minor Changes

- 1dba11ec: Support upgrade of a globally installed CLI

## 3.13.1

### Patch Changes

- 81d3ca50: Fix authentication issue when token is expired and invalid/revoked

## 3.13.0

### Minor Changes

- a225e415: - cli-kit:
  - Added additional Git functionality for commits, generating .gitignore templates, and ensuring commands are run in a Git project.
  - Added new Oxygen service type for interacting with the Oyxgen service
  - New method for creating readable file streams
  - create-hydrogen
    - Added support for initializing a local Git repository when you create a new Hydrogen project
- 5336b01f: Added support for extension development server to pass permissions metadata about the parent app to extension host systems
- 2239cad9: - `@shopify/cli-kit` - Add support to partners tokens in the `execCLI2` function
  - `@shopify/app` - Add support to theme app extensions in the `app dev` command

### Patch Changes

- a979c0de: Avoid the loosing of terminal cursor when using crtl+c with and active list prompt
- afa808cb: The overriden command name is correctly used

## 3.12.0

### Minor Changes

- 454641be: Allow running shopify installed globally instead of npm/yarn/pnpm shopify

## 3.11.0

### Minor Changes

- 79508f56: Don't allow the log file to grow too much
- 922c204e: New Result type for handling errors
- ddbf7ee4: Add new authentication method for cloud environments

### Patch Changes

- 38dedc05: Fix getRandomPort retries

## 3.10.1

### Patch Changes

- f04ec835: Fix store initialization for Homebrew (project version error)
- b23e0461: Add theme info command

## 3.10.0

### Patch Changes

- 4c8853f1: Use hooks to communicate with ngrok plugin

## 3.9.2

## 3.9.1

### Patch Changes

- 08c42c45: Use the Ruby bin directory from environment variable when provided (to fix homebrew issues)

## 3.9.0

### Minor Changes

- c7137a3b: Grouping extension types in scaffold select type prompt

## 3.8.0

### Minor Changes

- db4e6089: Releasing extensions binary in an automatic way
- 79df925d: Add GraphQL endpoint to get Partners URLs

### Patch Changes

- 79df925d: Add new fields to app cache: updateURLs and newApp
- 03bd5f28: Added `web-env` command to show and generate .env files without erasing existing ones

## 3.7.1

### Minor Changes

- 18717ad5: Rename the environment variable SHOPIFY_CONFIG to SHOPIFY_ENV because it's more representative of its usage
- 29f46e8f: Make inquirer default for inputs
- bba213f9: Shopify Functions identifiers have been changed to ULIDs. Existing projects will be updated during the next deploy.

## 3.6.2

### Patch Changes

- 59d56a40: Only show errors from CLI 2 once

## 3.6.1

## 3.6.0

### Patch Changes

- 073e514c: Validation that port used for receiving autentication token from browser is not already in use
- d9351df4: Use a custom list of safe nouns and adjectives to generate default names for apps and extensions

## 3.5.0

### Patch Changes

- dabc4bab: Refactor rejection tests to follow recommended implementation by Vitest

## 3.4.0

### Minor Changes

- 0da6c7e8: • Run CLI2 commands from passed-in directory, defaulting to current working directory
  • Fill in flags for theme check
  • Add --path to theme check
  • Add --verbose to theme check

### Patch Changes

- 08366831: Better logging:
  • include Prompt and List input/output
  • distinguish commands via UUID and log lines for command start/finish
  • use a command line flag to specify log stream to view (cli, create-app, create-hydrogen)
- feae2499: Fix support for using a private template repo when git credentials are not setup
- 19ab3f99: Report 5xx reponses coming from the Partners' API as aborts

## 3.3.3

### Patch Changes

- e89dfa81: • Update Ruby CLI to latest
  • Fix: Await Ruby subprocess
  • Add path flag to init for better development flow
  • Add verbose flag to see more output from the Node CLI
  • Set up logging and CLI-kit store separately for the theme CLI

## 3.3.2

## 3.3.1

## 3.3.0

### Minor Changes

- f7708fcc: Replace fastify/http-proxy with node-http-proxy to support Node < 17

## 3.2.0

### Patch Changes

- 86b04187: Exit without error message on deliberate user actions

## 3.1.0

### Minor Changes

- d17770e8: Massage error stacktraces to be properly formatted on Bugsnag
- d17770e8: Not report unhandled errors that go straight to the Node runtime

### Patch Changes

- 740f73ac: Added a retrying implementation to the method that obtains a random local port. Occasionally that third party logic failed in the middle of the execution of a command and abort the process. Running the command for a second time solved that temporary problem
- de8ee02d: [FEATURE] Add query to fetch shop by domain
- 45f0f0b9: Bump theme-check version

## 3.0.27

### Patch Changes

- e2e8b4db: Fix identity token validation which is requiring a new login every time

## 3.0.26

### Patch Changes

- dbcffdbb: Fix issue when exchanging an identity token fails
- 022a4e24: Internal: build cli-kit using tsc instead of rollup+esbuild
- e81e52b1: Report error events
- c16035f1: Fix post auth screen styling
- 61f595df: Fix an issue that will force the users to re-login when the token expires
- 87f7843f: Show validation errors when deploying UI extensions
- 8ff4e3d7: Fix runCreateCLI's detection of the executable index
- 168bb4c6: Add total time to analytics reports
- 0a9dbc63: Fix path outputs for the working directory
- 2d8e4458: Log Listr task titles to logfile

## 3.0.25

### Patch Changes

- a6ea9c8d: Fix shopify upgrade
- 822d0fd3: Move archiver to @shopify/node/archiver and export it from the package.json
- bf8137c2: Save session to local storage when secure storage (keychain) is not available
- e650b499: Add project type to analytics reports
- 3360289d: Compile function module before deploying function to the registry
- 2a666db7: Fix the formatting of errors' next steps not respecting the line breaks

## 3.0.24

## 3.0.23

## 3.0.22

### Patch Changes

- 7f32e9ac: Add an interface to delete the global store
- 7f32e9ac: Make sure the user has a partner organization associated to the session

## 3.0.21

## 3.0.20

### Patch Changes

- 5d422ea9: - Use a shallow repo clone to speed up cloning template repos
  - Display progress of git clones

## 3.0.19

### Patch Changes

- d73ea66a: Ask to reuse dev config if it's the first time deploying
- 45866b2a: include apiVersion from toml when deploying a function
- 3c9519fa: Improve authentication completion screen
- 0550cb31: Gracefully handle the scenario where the given SPIN_INSTANCE is invalid or non-existing
- fd254893: Add additional verbose logs
- cc4c0151: Simplify query complexity when fetching organizations

## 3.0.18

### Patch Changes

- 84438079: Add logging to file and command to access logs
- fa518a0d: Add analytics helper to report events
- fd10fc01: Add a confirmation prompt before opening the browser to continue auth
- 0243890b: Fix function appBridge variables not being set during GraphQL mutation
- cb1caa7c: Improve create app error message when using an invalid template flag value

## 3.0.17

### Patch Changes

- df0d0347: Use inquirer with SHOPIFY_USE_INQUIRER
- 6657a57c: Stop passing configuration when deploying a function

## 3.0.16

### Patch Changes

- eb915dee: Loose version requirements to help dependency managers dedupe dependencies
- 85ee088d: Add a utility function to know whether Git is present in the environment
- 2ecbff43: Fix issues with windows being reported as unsuported platform
- a750e67c: Improve dependency upgrade messages to leverage new shopify upgrade command

## 3.0.15

### Patch Changes

- c3b711ec: Improve Ruby Bundler upgrade message
- 99378ca0: Push dependency manager detection into cli-kit

## 3.0.14

### Patch Changes

- 8f82bd36: Fix lookupTunnelPlugin on Windows
- ae3823c8: Abort the execution if prompts are attempted in a non-interactive terminal
- 8f82bd36: Add pathToFileURL helper
- c383ed42: Gracefully handle revoked tokens

## 3.0.13

### Patch Changes

- 604d7d97: Fix some unhandled promises and errors

## 3.0.12

### Patch Changes

- e05749dc: Adds format to the @shopify/cli-kit `file` module that formats a file content using prettier.
- 89a48ba9: Helpers to check ruby version, analytics enabled and verbose mode
- 1f45ddc4: New module called `vscode` for integrating with the user's VSCode editor. The initial utilities are focused on determining if the user is using VSCode and adding recommended extensions to the project.
- 8c690cca: Add generator for haiku-style names
- 11d09f7f: Encourage upgrading if not up-to-date
- 783a3714: Relativize path tokens before printing them
- e12c82b3: Fixed error executing CLI connected to a spin instance using SPIN_INSTANCE environment variable
- cb8e2c25: Output stderr in bold instead of prefacing with scary ERROR

## 3.0.11

### Patch Changes

- 1f10093b: Add support for tokenized messages in errors

## 3.0.10

## 3.0.9

## 3.0.8

## 3.0.7

### Patch Changes

- 8de7f95d: Fix an issue that causes releases not to pick the latest version of the CLI packages

## 3.0.6

### Patch Changes

- 1e4d024e: Fixed randomly misfunction for detecting Fatal error types
- 27677c2d: Added support for apps_next beta flag when creating apps

## 3.0.5

## 3.0.4

### Patch Changes

- Fix create-app not using 3.0.3

## 3.0.1

### Patch Changes

- c01cd9a5: Supports updated template names from the hydrogen monorepo. The `parseRepoUrl` helper now includes the full `http` address in the returns object.
- 9d324502: Add locale configuration to checkout_ui_extensions

## 3.0.0

### Major Changes

- Bump to 3.0.0

## 2.0.15

### Patch Changes

- 19e343ea: Add support to dev checkout_ui_extension
- eaf69a92: Add Italic output format
  Store app title from Partners API
- 5ed34580: Default option when overwriting project files is now "No"

## 2.0.14

### Patch Changes

- 87e51326: Report errors coming from child processes as abort errors
- 87e51326: Output the sub-processes that we execute when the user invokes the CLI with --verbose
- b10ddafc: Output requests' HTTP headers when the user invokes the CLI with --verbose

## 2.0.13

### Patch Changes

- 1fb2da6c: Fix uhandled errors not being treated as bugs

## 2.0.10

### Patch Changes

- 31b75488: Derive app name from package.json, not TOML config

## 2.0.9

### Patch Changes

- 4170ac8e: Improve copies related to `dev`
- 4170ac8e: Add new `completed` helper to output

## 2.0.8

### Patch Changes

- Make envfile a dependency to mitigate bundling issues

## 2.0.7

### Patch Changes

- 0d2e8e50: Allow ui.Question to accept preface string
- 739e8e9d: Add password type for UI Question
- c95660a6: Add dotenv module that provides utility functions to read and write .env files

## 2.0.6

### Patch Changes

- f7e74d33: Retrieve only non-archived stores

## 2.0.5

### Patch Changes

- 56b31022: Fix the installation of NPM packages that was failing because there were not awaiting the Promise

## 2.0.3

### Patch Changes

- 30daa213: Add a utility function to install NPM packages recursively
- 07bcb005: Add a utility functions for adding NPM dependencies to a project
- ba003f7b: Automatically make stores non-transferable when selecting them for `dev`
- b00ac480: Remove appType prompt, add createAsNew prompt

## 2.0.2

### Patch Changes

- c6a9450b: Add support to scaffold function extensions
- 70d8d50d: Add homeDir helper to 'os'
  Remove tunnel

## 2.0.1

### Patch Changes

- 9cb99f12: Add new UI selection type: autocomplete
- 882e54e6: Improve validation of --api-key and --store flags for dev

## 1.1.1

### Patch Changes

- 488c06a: Added an interface to shell out to the Ruby CLI
- f156c37: - New `github` module for retrieving latest releases of a given github repository and for parsing github repository URLs.
  - New field in select prompts `result` for formatting a value after submission.
- 5763a76: Determine terminal coloring vs monochrome globally

## 1.0.9

### Patch Changes

- df1c523: Re-authenticate if Identity returns an invalid grant error

## 1.0.8

### Patch Changes

- 8e2c3d3: Improve the error handling to not treat invalid commands as bug errors

## 1.0.6

### Patch Changes

- Add deploy command

## 1.0.5

### Patch Changes

- Import ngrok dynamically

## 1.0.4

### Patch Changes

- e2e working

## 1.0.1

### Patch Changes

- Some fixes

## 1.0.0

### Patch Changes

- Get workflows working e2e

## 0.33.8

### Patch Changes

- Remove unnecessary dependencies

## 0.33.7

### Patch Changes

- Add .gitignore to the app template

## 0.33.6

### Patch Changes

- Fix create-app fixing the wrong dependency of @shopify/app

## 0.33.5

### Patch Changes

- Some fixes with external packages

## 0.33.3

### Patch Changes

- Make keytar a devDependency to bundle it with Rollup

## 0.33.2

### Patch Changes

- Version 0.33.2

## 0.33.1

### Patch Changes

- e1b7b31: Added complete Authentication flow

## 0.31.3

### Patch Changes

- Fix the detection of the package manager when creating an app

## 0.31.0

### Minor Changes

- e701cf5: Add a GraphQL client to communicate with Admin and Partners API
- 563f225: Add utility to scaffold projects from a Liquid-based template

## 0.30.2

### Patch Changes

- Add scaffold to the package.json's scripts section of the app template

## 0.30.1

### Patch Changes

- New CLI version

## 0.29.1

### Patch Changes

- c31bb1e: Add a method that returns true if the CLI is run from a Shopify environment (local or cloud)

## 0.12.0

### Minor Changes

- cb12e51: Add utility for fetching the current user
- a999af0: Add utility to fetch the latest version of a given NPM package
- bed0951: Add a utility to obtain the dependency manager used to run the create workflow

## 0.10.0

### Minor Changes

- Fix prompts not working when bundling the code

## 0.8.0

### Minor Changes

- b07c608: Rename @shopify/core to @shopify/cli-kit and finish up the create-app workflow

## 0.5.2

### Patch Changes

- Add @shopify/support and fix dependencies' setup
- Updated dependencies
  - @shopify/support@0.5.2

## 0.3.0

### Minor Changes

- Draft the CLI interface

### Patch Changes

- Updated dependencies
  - @shopify/cli-support@0.3.0

## 0.2.0

### Minor Changes

- Move from Lerna to changeset

### Patch Changes

- Updated dependencies
  - @shopify/cli-support@0.2.0
