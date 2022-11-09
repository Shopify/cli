# @shopify/cli-kit

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
