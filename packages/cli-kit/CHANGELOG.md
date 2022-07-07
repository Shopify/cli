# @shopify/cli-kit

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
