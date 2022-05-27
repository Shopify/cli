# @shopify/cli-kit

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
