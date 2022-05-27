# @shopify/app

## 2.0.14

### Patch Changes

- Improve several copies
- Updated dependencies [87e51326]
- Updated dependencies [87e51326]
- Updated dependencies [b10ddafc]
  - @shopify/cli-kit@2.0.14

## 2.0.13

### Patch Changes

- Updated dependencies [1fb2da6c]
  - @shopify/cli-kit@2.0.13

## 2.0.12

### Patch Changes

- 28d6ab49: Persist local state globally and scoped to the project's directory instead of using a .env.local file
- b13810e6: Only allow to scaffold one post purchase extension

## 2.0.10

### Patch Changes

- abf1c08c: Do not allow to scaffold extensions that already reached the quota limit
- 31b75488: Derive app name from package.json, not TOML config
- Updated dependencies [31b75488]
  - @shopify/cli-kit@2.0.10

## 2.0.9

### Patch Changes

- 4170ac8e: Improve copies related to `dev`
- 4170ac8e: Always create a tunnel when running dev
- Updated dependencies [4170ac8e]
- Updated dependencies [4170ac8e]
  - @shopify/cli-kit@2.0.9

## 2.0.8

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@2.0.8

## 2.0.7

### Patch Changes

- 9b17ef2c: Add utility function to obtain the renderer runtime package for a given extension type
- Updated dependencies [0d2e8e50]
- Updated dependencies [739e8e9d]
- Updated dependencies [c95660a6]
  - @shopify/cli-kit@2.0.7

## 2.0.6

### Patch Changes

- 904218a1: Use the tunnel on dev when there are extensions
- Updated dependencies [f7e74d33]
  - @shopify/cli-kit@2.0.6

## 2.0.5

### Patch Changes

- 56b31022: Install UI extensions' runtime dependencies when scaffolding new extensions
- Updated dependencies [56b31022]
  - @shopify/cli-kit@2.0.5

## 2.0.3

### Patch Changes

- 30daa213: Install dependencies as part of the dev workflow
- 8421ec9e: Enable creation of checkout-ui extensions
- ba003f7b: Automatically make stores non-transferable when selecting them for `dev`
- b00ac480: Remove appType prompt, add createAsNew prompt
- Updated dependencies [30daa213]
- Updated dependencies [07bcb005]
- Updated dependencies [ba003f7b]
- Updated dependencies [b00ac480]
  - @shopify/cli-kit@2.0.3

## 2.0.2

### Patch Changes

- 99018b84: Print loadable app/extensions data even when there is some invalid configuration
- c6a9450b: Add support to scaffold function extensions
- Updated dependencies [c6a9450b]
- Updated dependencies [70d8d50d]
  - @shopify/cli-kit@2.0.2

## 2.0.1

### Patch Changes

- 9cb99f12: Add new UI selection type: autocomplete
- 651ecb0f: Add support for scaffolding theme extensions
- 882e54e6: Improve validation of --api-key and --store flags for dev
- Updated dependencies [9cb99f12]
- Updated dependencies [882e54e6]
  - @shopify/cli-kit@2.0.1

## 1.1.1

### Patch Changes

- 22ff40a: Add support for running the extensions' CLI through the sources
- 5763a76: Determine terminal coloring vs monochrome globally
- Updated dependencies [488c06a]
- Updated dependencies [f156c37]
- Updated dependencies [5763a76]
  - @shopify/cli-kit@1.1.1

## 1.0.9

### Patch Changes

- Updated dependencies [df1c523]
  - @shopify/cli-kit@1.0.9

## 1.0.8

### Patch Changes

- Updated dependencies [8e2c3d3]
  - @shopify/cli-kit@1.0.8

## 1.0.6

### Patch Changes

- Add deploy command
- Updated dependencies
  - @shopify/cli-kit@1.0.6

## 1.0.5

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@1.0.5

## 1.0.4

### Patch Changes

- e2e working
- Updated dependencies
  - @shopify/cli-kit@1.0.4

## 1.0.1

### Patch Changes

- Some fixes
- Updated dependencies
  - @shopify/cli-kit@1.0.1

## 1.0.0

### Minor Changes

- e744db7: Rename UI Extensions back to Extensions

### Patch Changes

- Get workflows working e2e
- Updated dependencies
  - @shopify/cli-kit@1.0.0

## 0.33.8

### Patch Changes

- Remove unnecessary dependencies
- Updated dependencies
  - @shopify/cli-kit@0.33.8

## 0.33.7

### Patch Changes

- Add .gitignore to the app template
- Updated dependencies
  - @shopify/cli-kit@0.33.7

## 0.33.3

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.33.3

## 0.33.2

### Patch Changes

- Version 0.33.2
- Updated dependencies
  - @shopify/cli-kit@0.33.2

## 0.33.1

### Patch Changes

- Updated dependencies [e1b7b31]
  - @shopify/cli-kit@0.33.1

## 0.31.3

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.31.3

## 0.31.0

### Minor Changes

- a9ae85a: Rename extensions to UI extensions consistently

### Patch Changes

- Updated dependencies [e701cf5]
- Updated dependencies [563f225]
  - @shopify/cli-kit@0.31.0

## 0.30.2

### Patch Changes

- Add scaffold to the package.json's scripts section of the app template
- Updated dependencies
  - @shopify/cli-kit@0.30.2

## 0.30.1

### Patch Changes

- New CLI version
- Updated dependencies
  - @shopify/cli-kit@0.30.1

## 0.29.1

### Patch Changes

- d61706c: Add command: app scaffold extension
- e699434: Add app info command for basic loaded app information
- Updated dependencies [c31bb1e]
  - @shopify/cli-kit@0.29.1

## 0.15.0

### Minor Changes

- 4189370: Include ui-extensions runtime APIs

## 0.5.2

### Patch Changes

- Add @shopify/support and fix dependencies' setup
- Updated dependencies
  - @shopify/cli-kit@0.5.2
  - @shopify/support@0.5.2

## 0.5.0

### Minor Changes

- Fix the executable and add a templates folder

## 0.3.0

### Minor Changes

- Draft the CLI interface

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.3.0
  - @shopify/support@0.3.0

## 0.2.0

### Minor Changes

- Move from Lerna to changeset

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.2.0
  - @shopify/support@0.2.0
