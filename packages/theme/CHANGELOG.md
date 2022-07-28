# @shopify/theme

## 3.4.0

### Minor Changes

- 1ee62000: • Show subcommand help in theme help-old (development convenience feature)
  • Add missing -t shortcut for theme id or name in theme pull/push
  • Handle multiple --only or --ignore flags correctly in theme pull/push
- 0da6c7e8: • Run CLI2 commands from passed-in directory, defaulting to current working directory
  • Fill in flags for theme check
  • Add --path to theme check
  • Add --verbose to theme check

### Patch Changes

- Updated dependencies [08366831]
- Updated dependencies [feae2499]
- Updated dependencies [19ab3f99]
- Updated dependencies [0da6c7e8]
  - @shopify/cli-kit@3.4.0

## 3.3.3

### Patch Changes

- e89dfa81: • Update Ruby CLI to latest
  • Fix: Await Ruby subprocess
  • Add path flag to init for better development flow
  • Add verbose flag to see more output from the Node CLI
  • Set up logging and CLI-kit store separately for the theme CLI
- Updated dependencies [e89dfa81]
  - @shopify/cli-kit@3.3.3

## 3.3.2

### Patch Changes

- ecc4697c: Publish @shopify/theme dist directory
  - @shopify/cli-kit@3.3.2

## 3.3.1

### Patch Changes

- 68032f84: bump @shopify/theme up to most recent version
  - @shopify/cli-kit@3.3.1

## 0.6.1

### Patch Changes

- Updated dependencies [f7708fcc]
  - @shopify/cli-kit@3.3.0

## 0.6.0

### Minor Changes

- 9c10736a: Stop using semantic versioning for @shopify/cli-kit and pin the version from all the dependent packages

### Patch Changes

- Updated dependencies [86b04187]
  - @shopify/cli-kit@3.2.0

## 0.5.14

### Patch Changes

- 022a4e24: Internal: build cli-kit using tsc instead of rollup+esbuild
- Updated dependencies [dbcffdbb]
- Updated dependencies [022a4e24]
- Updated dependencies [e81e52b1]
- Updated dependencies [c16035f1]
- Updated dependencies [61f595df]
- Updated dependencies [87f7843f]
- Updated dependencies [8ff4e3d7]
- Updated dependencies [168bb4c6]
- Updated dependencies [0a9dbc63]
- Updated dependencies [2d8e4458]
  - @shopify/cli-kit@3.0.26

## 0.5.13

### Patch Changes

- eb915dee: Loose version requirements to help dependency managers dedupe dependencies
- Updated dependencies [eb915dee]
- Updated dependencies [85ee088d]
- Updated dependencies [2ecbff43]
- Updated dependencies [a750e67c]
  - @shopify/cli-kit@3.0.16

## 0.5.12

### Patch Changes

- b7b980b: Add pull/push/dev/open commands to theme
- 924fdf3: Added first batch of theme commands

## 0.5.11

### Patch Changes

- Add deploy command

## 0.5.10

### Patch Changes

- e2e working

## 0.5.9

### Patch Changes

- Some fixes

## 0.5.8

### Patch Changes

- Get workflows working e2e

## 0.5.7

### Patch Changes

- Remove unnecessary dependencies

## 0.5.6

### Patch Changes

- Add .gitignore to the app template

## 0.5.5

### Patch Changes

- Version 0.33.2

## 0.5.4

### Patch Changes

- Add scaffold to the package.json's scripts section of the app template

## 0.5.3

### Patch Changes

- New CLI version

## 0.5.2

### Patch Changes

- Add @shopify/support and fix dependencies' setup
- Updated dependencies
  - @shopify/cli-kit@0.5.2
  - @shopify/support@0.5.2

## 0.3.0

### Minor Changes

- Draft the CLI interface

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.3.0
  - @shopify/cli-support@0.3.0

## 0.2.0

### Minor Changes

- Move from Lerna to changeset

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.2.0
  - @shopify/cli-support@0.2.0
