# @shopify/create-hydrogen

## 0.32.0

### Minor Changes

- c1705a5: Adds the following new flags for the create-hydrogen command

  - template flag (-t): One of our templates such as, template-hydrogen-default, from the hydrogen /examples directory.
  - name flag (-n): Dafaults to hydrogen-app
  - path flag (-p)
  - dependency-manager flag (-d): One of 'npm', 'yarn' or 'pnpm'
  - shopify-cli-version flag (-s)
  - hydrogen-version flag (-v)

  Adds the following new Prompts for the create-hydrogen command

  "Name your new Hydrogen storefront": (default: 'hydrogen-app')
  "Choose a template": (default: 'template-hydrogen-minimal')

  Uses new template functions from the @shopify/cli-kit package for scaffolding

## 0.31.3

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.31.3
  - @shopify/cli-hydrogen@0.31.3

## 0.31.1

### Patch Changes

- Fix create-app and create-hydrogen that fail because "open" is missing

## 0.31.0

### Patch Changes

- Updated dependencies [e701cf5]
- Updated dependencies [563f225]
  - @shopify/cli-kit@0.31.0
  - @shopify/cli-hydrogen@0.31.0

## 0.30.2

### Patch Changes

- Add scaffold to the package.json's scripts section of the app template
- Updated dependencies
  - @shopify/cli-hydrogen@0.30.2
  - @shopify/cli-kit@0.30.2

## 0.30.1

### Patch Changes

- New CLI version
- Updated dependencies
  - @shopify/cli-hydrogen@0.30.1
  - @shopify/cli-kit@0.30.1

## 0.29.1

### Patch Changes

- Updated dependencies [c31bb1e]
  - @shopify/cli-kit@0.29.1
  - @shopify/cli-hydrogen@0.29.1

## 0.29.0

### Minor Changes

- Fix create-hydrogen

### Patch Changes

- Updated dependencies
  - @shopify/cli-hydrogen@0.7.0

## 0.28.0

### Minor Changes

- Some fixes in create-hydrogen

## 0.27.0

### Minor Changes

- Fix create-hydrogen

## 0.26.0

### Minor Changes

- Fix create-hydrogen

### Patch Changes

- Updated dependencies
  - @shopify/cli-hydrogen@0.6.0

## 0.25.0

### Minor Changes

- Fix create-hydrogen

## 0.24.0

### Minor Changes

- Fix create-hydrogen

## 0.23.0

### Minor Changes

- Fix create-hydrogen

## 0.22.0

### Minor Changes

- Fix create-hydrogen

## 0.21.0

### Minor Changes

- b3d8008: Fix create-hydrogen

## 0.20.0

### Minor Changes

- Fix create-hydrogen

## 0.19.0

### Minor Changes

- Fix create-hydrogen

## 0.18.0

### Minor Changes

- Fix creation flows

## 0.16.0

### Minor Changes

- Fix executables not running in the production version of the CLI

## 0.15.0

### Minor Changes

- 15c4491: Add create-hydrogen package to the repository
