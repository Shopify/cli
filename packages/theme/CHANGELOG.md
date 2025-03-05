# @shopify/theme

## 3.76.2

### Patch Changes

- Updated dependencies [7fe2ae0]
  - @shopify/cli-kit@3.76.2

## 3.76.1

### Patch Changes

- @shopify/cli-kit@3.76.1

## 3.76.0

### Minor Changes

- fca9c19: Render error overlay when `theme dev` encounters asset upload errors. A 500 status code is returned when the error overlay is rendered.

### Patch Changes

- 0b515f3: Fix 401 and 405 errors when rendering certain routes.
- fa2fa08: Improve `shopify theme dev` to recover the session when theme ID mismatch errors happen
- d361f3a: Fixed `shopify theme dev` to avoid emitting full page reload events when files are updated successfully, preventing conflicts with hot-reloading.
- Updated dependencies [4a3895c]
- Updated dependencies [38e8d7b]
- Updated dependencies [b1ed29d]
- Updated dependencies [6449aa6]
  - @shopify/cli-kit@3.76.0

## 3.75.0

### Patch Changes

- da606a6: Improve mechanism that adds `.shopify` to `.gitignore` to avoid duplicate entries
- f3498c3: Fix the local dev proxy for `/checkouts` and `/accounts/logout` to avoid 401 and 403 errors.
- 88ba848: Update `shopify theme push -x` documentation (it uploads, doesn't download)
- Updated dependencies [da606a6]
- Updated dependencies [4aee075]
- Updated dependencies [ab407f3]
  - @shopify/cli-kit@3.75.0

## 3.74.0

### Minor Changes

- b7cda8c890: Add `theme profile` command which allows users to get a performance profile for Liquid rendering on a given page
- 1b8ad07153: Give theme info a facelift using standard UI components
- 6380277a7a: Unify how asset upload errors are reported in the `theme dev` command

### Patch Changes

- 7e34195c30: Store theme asset upload errors encountered while running the theme dev command
- 1a5aec270d: Fix `shopify theme dev` to no longer fail when development themes expire in internationalized stores
- 404fa77c90: When the `.shopify/metafields.json` file gets created, the CLI now proposes to add it to `.gitignore` by default
- 5be14a5b08: Update documentation for `theme push --only`
- f004019bb9: Utilize Admin API to determine if a storefront is password protected
- Updated dependencies [7e34195c30]
- Updated dependencies [1a5aec270d]
- Updated dependencies [bb3b100731]
- Updated dependencies [369351435b]
- Updated dependencies [f004019bb9]
  - @shopify/cli-kit@3.74.0

## 3.73.0

### Minor Changes

- beab713acd: Developers can now use the `shopify theme metafields pull` command to download metafields, which can then be used for more refined code completion.

### Patch Changes

- 9d47c0f5f2: Support theme blocks in the `theme package` command
- a92307dce8: Bump Shopify/theme-tools packages
- df9d347d73: [Bug Fix] Reduce theme upload batch size to prevent timeout
- 4d722c64fc: Ensure git directory is clean when running `theme pull`
- Updated dependencies [beab713acd]
- Updated dependencies [4d722c64fc]
- Updated dependencies [03fb93e3c9]
  - @shopify/cli-kit@3.73.0

## 3.72.0

### Patch Changes

- @shopify/cli-kit@3.72.0

## 3.71.5

### Patch Changes

- Updated dependencies [94a7d4ce4f]
  - @shopify/cli-kit@3.71.5

## 3.71.4

### Patch Changes

- Updated dependencies [94953a671e]
  - @shopify/cli-kit@3.71.4

## 3.71.3

### Patch Changes

- @shopify/cli-kit@3.71.3

## 3.71.2

### Patch Changes

- Updated dependencies [a395820e7b]
  - @shopify/cli-kit@3.71.2

## 3.71.1

### Patch Changes

- @shopify/cli-kit@3.71.1

## 3.71.0

### Minor Changes

- 5107f4e805: Add `--strict` flag to `theme push` command, which will report `theme check` warnings and abort the operation if there are errors.
- 057e2c6189: Add shortcut keys to theme dev commands

### Patch Changes

- ff994c34d3: Fix password validation to support localized URLs when authenticating storefronts.
- 1e267a2e04: Update `shopify theme dev` to no longer display redundant URLs
- 7017b9e31c: Improve storefront password detection for password-protected shops with redirects
- 9548a34471: Fix password validation to handle capitalized store names on `shopify theme dev`
- 33f713e06e: Bump @shopify/theme-check-node & @shopify/theme-language-server
- Updated dependencies [5fd19d2920]
- Updated dependencies [5531731c11]
  - @shopify/cli-kit@3.71.0

## 3.70.0

### Minor Changes

- ade20307dc: Removes Ruby implementation of the `theme push` command
- b981aea41c: Removes the Ruby implementation of the `theme push` command

### Patch Changes

- 404cd2674c: Added a warning to help users troubleshoot when a development theme is missing required files
- 5aecb3eecb: Prevent the `shopify theme dev` command from terminating by refreshing the session
- 82786bc78c: Bump Shopify/theme-tools packages
- 57abf0b31c: Fix the theme ID mismatch error, where the live theme ID is returned instead of the development theme ID
- eccb52dccd: Fixes an issue in the `theme push` command where a confirmation prompt is rendered to users who provide the `--allow-live` flag
- 7d89068e32: Fix an issue in `app dev` where host themes would have empty files
- 8120536219: Show an error when the `config/settings_schema.json` file cannot be parsed.
- Updated dependencies [03b39a67b3]
- Updated dependencies [33477dd9d7]
  - @shopify/cli-kit@3.70.0

## 3.69.0

### Minor Changes

- 82dd1daf8: Add a new option to create a theme on `shopify theme push`
- 371d53d3e: Remove `legacy` flag and `Ruby` implementation for the following commands:
  - `shopify theme console`
  - `shopify theme dev`
  - `shopify theme push`
  - `shopify theme pull`

### Patch Changes

- a7f7dc300: Fix hot reloading of `.css.liquid` and `.js.liquid` assets.
- 1fe7024e6: Fix the issue that prevents password-protected storefronts with an ampersand `&` from logging in, and improve the password prompt message to disambiguate passwords
- c75c8e201: Remove the warning message from the ignore-module because some files can only be ignored using backward-compatible patterns
- 87b52747d: Remove Liquid syntax error prettifier to avoid breaking the rest of the document.
- 8c6906c06: Fix an issue with `shopify theme dev --theme-editor-sync` to prevent showing a remote file deletion error when the file has already been removed
- 3b6159e8a: Use the new implementation of shopify theme share that no longer depends on Ruby to work.
  This also fixes the command so it no longer ignores `.shopifyignore`.
- 265d3e178: Handle background async errors and avoid process exit in some scenarios.
- a38952cd6: Improved warning message on shopify theme push --json by removing reference to [object Object]
- df7b178da: Avoid process exit when failing to delete a file from the remote theme.
- 707b901a7: Make `shopify theme dev` more resilient to HTTP errors with the Admin API
- 3f10612f0: Fix CDN URls in .css.liquid files
- 41bfd221f: Fix cart requests in the local proxy to avoid 401-Unauthorized errors
- a6abeb289: Show preview url for gift cards in the initial server logs.
- d9fff2c30: Update the ignore module (`--only`/`--ignore`/`.shopifyignore`) to be backward compatible with (Ruby) Shopify CLI 2
- 89250c301: Fix ignore patterns
- 1f5d13cf1: Fix serving local assets from the root path for backward compatibility.
- 51178f2f6: Fix `shopify theme pull --only <value>` so it does not delete ignored files
- Updated dependencies [283aa815c]
  - @shopify/cli-kit@3.69.0

## 3.68.0

### Patch Changes

- fc7d5ce58: Fix content in SVG files
- cce54b10b: Fix Theme Access authentication on `shopify theme dev` and `shopify theme console` commands
- 53459a23f: Fixes a bug where some users were unable to intialize their app dev command with theme app extensions
- 492225c47: Fix cart/add request in development.
- dc30dca87: Fix encoding of certain characters in HTML responses in the new theme dev server.
- a2f31c249: Fix hot reload on sections
- a1887fc14: Fix serving local assets that contain non-printable characters.
- d6c661f06: Update checksum calculation to no longer minify assets before calculating
- Updated dependencies [4d89691ad]
  - @shopify/cli-kit@3.68.0

## 3.67.0

### Minor Changes

- 4b4146186: Default to Typescript implementation for theme commands. Legacy implementation is stil available via the `--legacy` flag.

### Patch Changes

- 60ff8754c: Bump Shopify/theme-tools packages
- Updated dependencies [435c88bf1]
- Updated dependencies [9cc4d7c1d]
- Updated dependencies [e9aeab01e]
  - @shopify/cli-kit@3.67.0

## 3.66.0

### Minor Changes

- f8f55f6c56: Release the developer preview for the Theme Console command

### Patch Changes

- 640420acd0: Update the theme selector to no longer match partial theme names by default; use the '\*' character to enable partial matching
- 40a7b1229a: CLI now better handles 429 rate limiting for large projects
- Updated dependencies [05cbe63566]
- Updated dependencies [40a7b1229a]
- Updated dependencies [dd4b730962]
  - @shopify/cli-kit@3.66.0

## 3.65.0

### Patch Changes

- 19f230fca5: Prevent the live theme from being set in the `shopify theme dev` session by Shopify infrastructure
  - @shopify/cli-kit@3.65.0

## 3.64.0

### Patch Changes

- 13c246e60: Avoid loop with static assets when users pass the `--theme-editor-sync` flag
- c053fd555: Avoid loop when users pass the `--theme-editor-sync` flag in the `shopify theme dev` command
- Updated dependencies [f76debde5]
- Updated dependencies [593019155]
  - @shopify/cli-kit@3.64.0

## 3.63.0

### Minor Changes

- 53811a2dc: Bump Shopify/theme-tools packages
- 2a6341b3b: - Add VariableName check
  - Update Theme Check to use jsonc parser

### Patch Changes

- 9d3a6bade: Updated nx and eslint rules
- Updated dependencies [9d3a6bade]
  - @shopify/cli-kit@3.63.0

## 3.62.0

### Patch Changes

- Updated dependencies [08b6acce2]
- Updated dependencies [2ae9341e7]
  - @shopify/cli-kit@3.62.0

## 3.61.0

### Patch Changes

- Updated dependencies [79a951f3c]
- Updated dependencies [87a6cc590]
- Updated dependencies [0c117d0f4]
- Updated dependencies [009a43078]
  - @shopify/cli-kit@3.61.0

## 3.60.0

### Minor Changes

- 0c8800c87: Enables filtering by theme name in commands that use the theme-selector

### Patch Changes

- ea177a190: Render progress bar for theme uploads to stderr
- d5a05e7cc: - Fix the `shopify theme dev` proxy to use the development theme, even when users have a browser session with the live theme loaded
- d5a05e7cc: - Fix `shopify theme dev` and `shopify theme console` proxies following session changes
  - Bring the legacy `shopify theme push` implementation in CI/CD workflows
- 031aa2d0b: Fix unpublished themes being marked as development themes
- 5343a3672: Fix issue that prevents `shopify theme console` from evaluating results when another 'preview_theme_id' is set
- 601020909: Fix the `shopify theme dev`/`shopify theme console` proxy to handle cookies as expected, and ensure they no longer render the live theme instead of the development theme
- Updated dependencies [0ff96c777]
  - @shopify/cli-kit@3.60.0

## 3.59.0

### Minor Changes

- ca218cd31: Shopify CLI now defaults to be Global
- ca218cd31: Rename: Render text input prompt when 'name' flag not provided

### Patch Changes

- ca218cd31: - Theme Push: Fix issue with unresponsive server when password flag is provided
  - Theme Push: Add 'theme' key to root node of JSON output
- ca218cd31: Fix `shopify theme dev` issue to avoid previewing the live theme instead of the development one
- ca218cd31: Activate the new implementation of `shopify theme push` in CI/CD workflows to support contextual assets
- ca218cd31: Introduce support to the `blocks/` directory in the `shopify theme push` command
- ca218cd31: Update theme selection text for `shopify theme push` command
- ca218cd31: Improve Glob Pattern subdirectory mismatch error handling
- ca218cd31: Bump Shopify/theme-tools packages

  - TL;DR
    - (New) `ValidJson` check - JSON schema validation on `.json` files
    - (New) Section/block schema `t:` translation completion
    - (Updated) `MatchingTranslations` check - extend support to `.schema.json` files
    - (Updated) Translation completion is now fuzzy instead of partial
    - Dynamic JSON schema management without requiring new releases
    - Internal API changes
  - https://github.com/Shopify/theme-tools/blob/main/packages/theme-language-server-node/CHANGELOG.md
  - https://github.com/Shopify/theme-tools/blob/main/packages/theme-check-common/CHANGELOG.md

- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
  - @shopify/cli-kit@3.59.0

## 3.58.0

### Minor Changes

- e0feb4414: - Refine `theme push` implementation to no longer require Ruby setup.
  - Move Ruby implementation behind `--stable` flag
- a0a69d9a2: Add support for retrieving single theme information via `shopify theme info --theme <themeNameOrID>` (other supported flags: `--store`, `--environment`, `--development`, `--json`)

### Patch Changes

- ab752de6e: Fix file pattern matching to obey glob patterns on beta version of `theme pull`
- Updated dependencies [ab752de6e]
- Updated dependencies [3affd6bbe]
- Updated dependencies [cedd14e6c]
  - @shopify/cli-kit@3.58.0

## 3.57.0

### Patch Changes

- 57b51c371: Fix `shopify theme dev` issue to avoid previewing the live theme instead of the development one
  - @shopify/cli-kit@3.57.0

## 3.56.0

### Patch Changes

- dc946c26c: Fix the error message that started occurring since Ruby 3.3.0
- 0d59df9f1: Show deprecation logs only on `--verbose` mode
- Updated dependencies [1220290ec]
  - @shopify/cli-kit@3.56.0

## 3.55.0

### Minor Changes

- Theme Check 2.0: https://shopify.dev/docs/themes/tools/theme-check
- 1f4bc949e: Bring the new `shopify theme pull` implementation behind the `--beta` flag and use the legacy version by default
  - @shopify/cli-kit@3.55.0

## 3.54.0

### Minor Changes

- a9e847717: Refine `shopify theme pull` implementation to no longer require a Ruby setup
- a9e847717: Introduce `shopify theme rename` command
- a9e847717: Upgrade oclif to v3 (improved help menus and more)

### Patch Changes

- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
  - @shopify/cli-kit@3.54.0

## 3.53.0

### Minor Changes

- 1d6fe3475: Increase minimum Node version to 18
- 0896e62b1: Versioned app config support
- 72b1daaee: Add new `nodelete` flag to `shopify theme dev` command

### Patch Changes

- Updated dependencies [1d6fe3475]
- Updated dependencies [cc3ada0a2]
- Updated dependencies [0896e62b1]
- Updated dependencies [72b1daaee]
  - @shopify/cli-kit@3.53.0

## 3.52.0

### Patch Changes

- 1de8122c4: No longer drops _.json templates when there is a _.json.liquid template with the same name.
- Updated dependencies [4ea4c08dd]
- Updated dependencies [1de8122c4]
- Updated dependencies [060bd75cf]
- Updated dependencies [060bd75cf]
- Updated dependencies [9cbe46e06]
  - @shopify/cli-kit@3.52.0

## 3.51.0

### Minor Changes

- 2145d7a46: Added fix to support `:theme_app_extension` for dev-preview theme check.

### Patch Changes

- 84ae8eff7: Fixed misleading message in `shopify theme console` in specific scenarios
- f5caf4da4: Add new --json flag to theme list and app versions list commands
- 412b8ca74: Clarify `SHOPIFY_CLI_BUNDLED_THEME_CLI` environment variable should not be used, yet resolve its compatibility issue
- Updated dependencies [533c66492]
- Updated dependencies [a8c8b1e6b]
- Updated dependencies [8b7ce36b1]
- Updated dependencies [b90f24b2e]
- Updated dependencies [8c979a621]
- Updated dependencies [7802bffa9]
- Updated dependencies [28e629078]
- Updated dependencies [0b8b97993]
- Updated dependencies [64b49598b]
- Updated dependencies [e72b4f1c8]
  - @shopify/cli-kit@3.51.0

## 3.50.0

### Minor Changes

- 3f36e9463: Fixed CI issue due to theme check --dev-preview --version implementation
- 6095a8827: Added `--dev-preview` for `theme language-server`
- fbab28e9e: Added --dev-preview flag for theme check 2.0

### Patch Changes

- a73bb1179: Add versioning to Liquid Console remote theme, allowing users to try different versions of Liquid Console in the same store without facing compatibility issues
- e0b042e3c: Fix ambiguity between `--editor` and `--environment` flags in the `shopify theme open` command
- 42aacb5f0: Enhance the `shopify theme dev` command banner by adding the preview URL next to the preview link, for easy copy/pasting in terminal emulators that support hyperlinks
- b3e858038: The `shopify theme delete` command no longer fails when some flags (`-f`, `-d`, etc.) are passed without the `-t` flag
- Updated dependencies [4bb8fff29]
- Updated dependencies [3f36e9463]
- Updated dependencies [cf5bbff61]
- Updated dependencies [46a72a6b4]
- Updated dependencies [3ed6ae88e]
- Updated dependencies [d6b02afcf]
- Updated dependencies [e0cd881e1]
- Updated dependencies [20d667246]
  - @shopify/cli-kit@3.50.0

## 3.49.1

### Patch Changes

- @shopify/cli-kit@3.49.1

## 3.49.0

### Minor Changes

- 330dddeaa: Introduce support for the `shopify theme console` command

### Patch Changes

- 8d3578b87: Fix internal server error issue in the `shopify theme dev` command
- Updated dependencies [6211a4aea]
- Updated dependencies [b2e93d9c3]
- Updated dependencies [8f5ac815e]
- Updated dependencies [f1a774c78]
- Updated dependencies [1914affaf]
- Updated dependencies [8d3578b87]
- Updated dependencies [b4c9439c4]
- Updated dependencies [6ab0ce1a8]
- Updated dependencies [d230b8773]
- Updated dependencies [3c88932af]
- Updated dependencies [c4396fd58]
  - @shopify/cli-kit@3.49.0

## 3.48.0

### Minor Changes

- 9a942421c: Introduce the `shopify theme update run` command

### Patch Changes

- Updated dependencies [91e7a1fd8]
- Updated dependencies [598812ca0]
- Updated dependencies [a156c8b7b]
- Updated dependencies [f32c66bf6]
- Updated dependencies [cf52851b7]
- Updated dependencies [2afacc5e1]
- Updated dependencies [48f5934d7]
- Updated dependencies [0705bc30f]
- Updated dependencies [9311df3a7]
- Updated dependencies [6a1b88228]
- Updated dependencies [934c53968]
- Updated dependencies [f0adf0651]
- Updated dependencies [64f0d4821]
- Updated dependencies [029b49795]
- Updated dependencies [7d512e1b0]
- Updated dependencies [a17e43672]
- Updated dependencies [2a1cfc206]
  - @shopify/cli-kit@3.48.0

## 3.47.0

### Minor Changes

- 0224abe16: Introduce `shopify theme update init` and `shopify theme update check` commands
- 0d6cdd4c6: Introduce the `--open` flag to open a browser window only when users specifically request it
- 8420d71cc: Fix `shopify theme dev` command to show valid URLs when `--theme` flag is used with a theme name

### Patch Changes

- ad3894aea: Fix an issue in `shopify theme dev` and `shopify app dev` that was affecting image loading on local servers
- 22d30f4ad: Fix session refresh for theme dev without password
- 9bb98c029: Remove image proxying through local server to enable proper functioning of Liquid filters
- ca2461e94: Fix theme dev re-authentication
- 99fc03fbc: Fix an issue in `shopify theme dev` that was affecting asset loading on local servers, in some shops
- 2d3c6dd41: Fix a hot-reload for theme app extensions when blocks are rendered on section groups (in the `app dev` command)
- 76694a35f: Fix clean login on theme dev
- Updated dependencies [ad3894aea]
- Updated dependencies [99df79caf]
- Updated dependencies [9bb98c029]
- Updated dependencies [ca2461e94]
- Updated dependencies [4ded88051]
- Updated dependencies [99fc03fbc]
- Updated dependencies [e217b34eb]
  - @shopify/cli-kit@3.47.0

## 3.47.0-pre.0

### Minor Changes

- 0224abe16: Introduce `shopify theme update init` and `shopify theme update check` commands

### Patch Changes

- ad3894aea: Fix an issue in `shopify theme dev` and `shopify app dev` that was affecting image loading on local servers
- ca2461e94: Fix theme dev re-authentication
- Updated dependencies [ad3894aea]
- Updated dependencies [ca2461e94]
- Updated dependencies [4ded88051]
  - @shopify/cli-kit@3.47.0-pre.0

## 3.46.0

### Minor Changes

- 162504891: Introduce the `--notify` flag in the shopify app/theme dev commands
- d2d1b96a6: Introduce support for update extension files
- 9de04da4d: Introduce `.jpeg` support for theme app extensions
- 151684a25: - Improve rule for lazy loading to prevent developers from overusing it
  - Introduce `--update-docs` flag to synchronously update Theme Check resources (objects, filters, and tags)

### Patch Changes

- 3b1da7747: Fix unavailable constant reference in theme dev
- 94d197f63: Display clear error message when prompting fails due to non-TTY terminal
- 9e06083e4: Fix localhost link in the `shopify theme dev` command
- 595233406: Fix description for `shopify theme open` flags
- Updated dependencies [d9ef6c3f6]
- Updated dependencies [33881af95]
- Updated dependencies [2729e3784]
- Updated dependencies [3b1da7747]
- Updated dependencies [a7c1eabeb]
- Updated dependencies [cc37858fb]
- Updated dependencies [1707ef75a]
- Updated dependencies [94d197f63]
- Updated dependencies [162504891]
- Updated dependencies [9e4c97b52]
- Updated dependencies [9de04da4d]
- Updated dependencies [f95e3a1d5]
- Updated dependencies [1c8afb7f4]
- Updated dependencies [151684a25]
- Updated dependencies [37b53a5be]
- Updated dependencies [01988114d]
- Updated dependencies [beda7c241]
- Updated dependencies [07d0be690]
- Updated dependencies [6663b3a8f]
- Updated dependencies [3169c1e44]
- Updated dependencies [069e38ecf]
  - @shopify/cli-kit@3.46.0

## 3.46.0-pre.3

### Patch Changes

- Updated dependencies [d9ef6c3f6]
- Updated dependencies [cc37858fb]
- Updated dependencies [1c8afb7f4]
- Updated dependencies [6663b3a8f]
- Updated dependencies [069e38ecf]
  - @shopify/cli-kit@3.46.0-pre.3

## 3.46.0-pre.2

### Minor Changes

- 162504891: Introduce the `--notify` flag in the shopfiy app/theme dev commands
- 151684a25: - Improve rule for lazy loading to prevent developers from overusing it
  - Introduce `--update-docs` flag to synchronously update Theme Check resources (objects, filters, and tags)

### Patch Changes

- 9e06083e4: Fix localhost link in the `shopify theme dev` command
- 595233406: Fix description for `shopify theme open` flags
- Updated dependencies [a7c1eabeb]
- Updated dependencies [162504891]
- Updated dependencies [151684a25]
- Updated dependencies [01988114d]
  - @shopify/cli-kit@3.46.0-pre.2

## 3.46.0-pre.1

### Patch Changes

- Updated dependencies [beda7c241]
- Updated dependencies [3169c1e44]
  - @shopify/cli-kit@3.46.0-pre.1

## 3.46.0-pre.0

### Patch Changes

- Updated dependencies [f95e3a1d5]
  - @shopify/cli-kit@3.46.0-pre.0

## 3.45.0

### Minor Changes

- 1dd35b0b2: Enable environments for themes
- e85f718cd: Use `-e` as an alias for --environment and remove the current one for --theme-editor-sync
- dcc95e191: Improve theme selector component by grouping themes by role
- 4fc91508e: Fix `shopify theme share` description

### Patch Changes

- db5981a1e: Clean errors related to metrics requests on theme dev
- 25fc42ae2: Fix: Run ruby with shopify bin file as an argument
- 6735253e6: Adopt the CLI UI kit in the `shopify theme dev` command
- 4b223b644: Standardize the tone of prompt text messages for consistency
- 067199cf6: Pass development theme from CLI 3’s to CLI 2’s local storage
- Updated dependencies [da01d3595]
- Updated dependencies [1dd35b0b2]
- Updated dependencies [db5981a1e]
- Updated dependencies [7f8a9436d]
- Updated dependencies [d2a352442]
- Updated dependencies [25fc42ae2]
- Updated dependencies [fe32fb789]
- Updated dependencies [4d5cff225]
- Updated dependencies [a4b0953d9]
- Updated dependencies [6735253e6]
- Updated dependencies [d6f278863]
- Updated dependencies [ddb967914]
- Updated dependencies [c3d5ce5e6]
- Updated dependencies [e85f718cd]
- Updated dependencies [4bb549840]
- Updated dependencies [b2e066fc0]
- Updated dependencies [9c253511e]
- Updated dependencies [e6753f4ed]
- Updated dependencies [657593b1a]
- Updated dependencies [ce1457036]
- Updated dependencies [163df5e9a]
- Updated dependencies [b3ea29a21]
- Updated dependencies [2ca5b35d8]
- Updated dependencies [067199cf6]
- Updated dependencies [645b085b8]
- Updated dependencies [7153dff92]
  - @shopify/cli-kit@3.45.0

## 3.45.0-pre.5

### Minor Changes

- e85f718cd: Use `-e` as an alias for --environment and remove the current one for --theme-editor-sync

### Patch Changes

- 6735253e6: Adopt the CLI UI kit in the `shopify theme dev` command
- Updated dependencies [da01d3595]
- Updated dependencies [6735253e6]
- Updated dependencies [e85f718cd]
- Updated dependencies [e6753f4ed]
- Updated dependencies [645b085b8]
  - @shopify/cli-kit@3.45.0-pre.5

## 3.45.0-pre.4

### Minor Changes

- 4fc91508e: Fix `shopify theme share` description

### Patch Changes

- Updated dependencies [ce1457036]
- Updated dependencies [2ca5b35d8]
  - @shopify/cli-kit@3.45.0-pre.4

## 3.45.0-pre.3

### Patch Changes

- Updated dependencies [ddb967914]
- Updated dependencies [7153dff92]
  - @shopify/cli-kit@3.45.0-pre.3

## 3.45.0-pre.2

### Patch Changes

- Updated dependencies [9c253511e]
  - @shopify/cli-kit@3.45.0-pre.2

## 3.45.0-pre.1

### Minor Changes

- 1dd35b0b2: Enable environments for themes

### Patch Changes

- db5981a1e: Clean errors related to metrics requests on theme dev
- 067199cf6: Pass development theme from CLI 3’s to CLI 2’s local storage
- Updated dependencies [1dd35b0b2]
- Updated dependencies [db5981a1e]
- Updated dependencies [7f8a9436d]
- Updated dependencies [fe32fb789]
- Updated dependencies [4d5cff225]
- Updated dependencies [a4b0953d9]
- Updated dependencies [d6f278863]
- Updated dependencies [c3d5ce5e6]
- Updated dependencies [b3ea29a21]
- Updated dependencies [067199cf6]
  - @shopify/cli-kit@3.45.0-pre.1

## 3.44.1-pre.0

### Patch Changes

- 25fc42ae2: Fix: Run ruby with shopify bin file as an argument
- Updated dependencies [25fc42ae2]
- Updated dependencies [b2e066fc0]
- Updated dependencies [657593b1a]
  - @shopify/cli-kit@3.44.1-pre.0

## 3.44.0

### Minor Changes

- 84284bd27: Introduce the hidden/beta `shopify theme console` command
- 8b7c94940: Fix: The CLI should not report IO messages when the `--json` flag is passed

### Patch Changes

- 7925a40b2: Fix loading JS functions when there are UI extensions. Improve theme dev loading time.
- d2adeb5ec: Extract the ownership of host themes to the CLI3
- Updated dependencies [999a2fc79]
- Updated dependencies [b61c5972c]
- Updated dependencies [d44250676]
- Updated dependencies [c8e75ac24]
- Updated dependencies [fb22cb013]
- Updated dependencies [159df5d07]
- Updated dependencies [2def6f113]
- Updated dependencies [ef3846d91]
- Updated dependencies [3a75ed0a7]
- Updated dependencies [d2adeb5ec]
  - @shopify/cli-kit@3.44.0

## 3.43.0

### Patch Changes

- Updated dependencies [f732207fa]
- Updated dependencies [4b0cc57ce]
- Updated dependencies [b6f93cfa7]
  - @shopify/cli-kit@3.43.0

## 3.42.0

### Patch Changes

- 3b8951631: Do not overwrite `theme` parameter if present
- Updated dependencies [2203d4e6f]
  - @shopify/cli-kit@3.42.0

## 3.41.2

### Patch Changes

- @shopify/cli-kit@3.41.2

## 3.41.1

### Patch Changes

- @shopify/cli-kit@3.41.1

## 3.41.0

### Patch Changes

- Updated dependencies [9d9480341]
  - @shopify/cli-kit@3.41.0

## 3.40.3

### Patch Changes

- @shopify/cli-kit@3.40.3

## 3.40.2

### Patch Changes

- Updated dependencies [7c0b13944]
- Updated dependencies [7ca9a667d]
  - @shopify/cli-kit@3.40.2

## 3.40.1

### Patch Changes

- @shopify/cli-kit@3.40.1

## 3.40.0

### Minor Changes

- b69bee85c: Add an alias to the `shopify theme serve` command

### Patch Changes

- 1661f80a2: Various copy improvements
- 99b88caa7: Fix to include customer JSON templates in `theme package`
- 5ba869fb2: Extract the ownership of development themes
- 228328a6d: Remove old `ui` module from cli-kit exports
- Updated dependencies [91e15fed4]
- Updated dependencies [cfb4b7f68]
- Updated dependencies [9e74a9fc0]
- Updated dependencies [1661f80a2]
- Updated dependencies [ae22dfbaf]
- Updated dependencies [7734a7ed3]
- Updated dependencies [5ba869fb2]
- Updated dependencies [228328a6d]
- Updated dependencies [c30eb6978]
  - @shopify/cli-kit@3.40.0

## 3.39.0

### Patch Changes

- afe541577: Adopt the CLI UI kit in the `shopify theme package` command
- Updated dependencies [afe541577]
- Updated dependencies [f4d5fb1a8]
- Updated dependencies [91a44020b]
  - @shopify/cli-kit@3.39.0

## 3.38.0

### Patch Changes

- @shopify/cli-kit@3.38.0

## 3.37.0

### Minor Changes

- 2f0420599: Slightly improve the text messages in the `shopify theme delete` and `shopify theme publish` commands

### Patch Changes

- Updated dependencies [a5224543b]
  - @shopify/cli-kit@3.37.0

## 3.36.2

### Patch Changes

- 868befded: Migrate `theme publish` to TypeScript
- Updated dependencies [3ddd21dba]
  - @shopify/cli-kit@3.36.2

## 3.36.1

### Patch Changes

- Updated dependencies [d81271abd]
  - @shopify/cli-kit@3.36.1

## 3.36.0

### Minor Changes

- c2a7c17e0: Refresh command UIs with newly implemented Ink components

### Patch Changes

- Updated dependencies [c2a7c17e0]
  - @shopify/cli-kit@3.36.0

## 3.35.0

### Minor Changes

- 50c0b2cd3: - Adopt CLI UI kit on `shopify theme delete` command
  - Introduce the `pluralize` API on `@shopify/cli-kit/common/string`

### Patch Changes

- 1a482191a: Improve the DX of the `shopify theme list` command, by adopting the CLI UI kit
- Updated dependencies [50c0b2cd3]
- Updated dependencies [2aa5c07aa]
- Updated dependencies [1a482191a]
- Updated dependencies [a4f78e95f]
  - @shopify/cli-kit@3.35.0

## 3.34.0

### Patch Changes

- 8fa3e7094: Add extra timeout when restarting theme dev
  - @shopify/cli-kit@3.34.0

## 3.33.0

### Patch Changes

- eee1293ef: - Introduce REST Admin API client on `@shopify/cli-kit`
  - Improve the DX of the `shopify theme open` command, by adopting the CLI UI kit
- Updated dependencies [eee1293ef]
- Updated dependencies [5e7474fab]
- Updated dependencies [9eb807bf7]
  - @shopify/cli-kit@3.33.0

## 3.32.1

### Patch Changes

- Updated dependencies [39315c3d0]
  - @shopify/cli-kit@3.32.1

## 3.32.0

### Patch Changes

- Updated dependencies [a8489366]
- Updated dependencies [00de42e8]
  - @shopify/cli-kit@3.32.0

## 3.31.1

### Patch Changes

- db48152c: Fix theme dev not refreshing session automatically
  - @shopify/cli-kit@3.31.1

## 3.31.0

### Patch Changes

- Updated dependencies [80c6638c]
- Updated dependencies [dcf53ece]
  - @shopify/cli-kit@3.31.0

## 3.30.2

### Patch Changes

- Updated dependencies [ba91a2da]
- Updated dependencies [23b1cc84]
  - @shopify/cli-kit@3.30.2

## 3.30.1

### Patch Changes

- Updated dependencies [2ac83ce6]
  - @shopify/cli-kit@3.30.1

## 3.30.0

### Patch Changes

- Updated dependencies [737ca469]
  - @shopify/cli-kit@3.30.0

## 3.29.0

### Minor Changes

- 3b37c679: Enable password flag for theme dev
- b549291a: Update @oclif/core to 1.21.0

### Patch Changes

- Updated dependencies [eaf98706]
- Updated dependencies [d12ece22]
- Updated dependencies [aeca53c6]
- Updated dependencies [3b37c679]
- Updated dependencies [b549291a]
- Updated dependencies [06b6b00d]
  - @shopify/cli-kit@3.29.0

## 3.28.0

### Patch Changes

- @shopify/cli-kit@3.28.0

## 3.27.0

### Patch Changes

- Updated dependencies [32bbe23d]
  - @shopify/cli-kit@3.27.0

## 3.26.0

### Patch Changes

- Updated dependencies [0d8ac8c9]
- Updated dependencies [ab76be51]
- Updated dependencies [a6a3f2b4]
- Updated dependencies [ca8141bc]
  - @shopify/cli-kit@3.26.0

## 3.25.0

### Patch Changes

- Updated dependencies [78196a78]
  - @shopify/cli-kit@3.25.0

## 3.24.1

### Patch Changes

- Updated dependencies [7e5c492a]
  - @shopify/cli-kit@3.24.1

## 3.24.0

### Patch Changes

- a9d4be9e: Generate creative suggested names for new themes
- Updated dependencies [d47a6e80]
- Updated dependencies [a9d4be9e]
- Updated dependencies [aca90638]
- Updated dependencies [cb0990df]
  - @shopify/cli-kit@3.24.0

## 3.23.0

### Patch Changes

- d5e81d69: Add hidden `--force` flag for validation on `shopify theme dev/pull/push/share` if users are running the command in a theme directory.
- Updated dependencies [c15ad5df]
- Updated dependencies [1ee1cfd1]
  - @shopify/cli-kit@3.23.0

## 3.22.1

### Patch Changes

- @shopify/cli-kit@3.22.1

## 3.22.0

### Minor Changes

- bc66741a: Introduce shorthand `-e` for `--theme-editor-sync` in `shopify theme dev`

### Patch Changes

- 6c0cd13d: Polish log truncation process
- Updated dependencies [e0b5c20b]
- Updated dependencies [6de19ebd]
- Updated dependencies [6c0cd13d]
- Updated dependencies [7035d36b]
  - @shopify/cli-kit@3.22.0

## 3.21.0

### Patch Changes

- Updated dependencies [e4352f2e]
- Updated dependencies [c906187f]
- Updated dependencies [5cda6300]
  - @shopify/cli-kit@3.21.0

## 3.20.1

### Patch Changes

- Updated dependencies [3f285ff9]
  - @shopify/cli-kit@3.20.1

## 3.20.0

### Minor Changes

- 96d5b175: Enable experimental presets feature for apps and themes
- 65aac089: Add the hidden `--stable` flag in the `theme dev/push` commands
- 0a35aca5: Introduce `--only/--ignore` support into the `shopify theme dev` command
- 4bd05555: Add experimental preset flag for pre-specifying command line flags

### Patch Changes

- efa5b071: Refresh theme dev session every 90 minutes
- 78372fe7: Fix password flag for theme open/publish
- Updated dependencies [96d5b175]
- Updated dependencies [0a8ee2a3]
- Updated dependencies [efa5b071]
- Updated dependencies [4bd05555]
  - @shopify/cli-kit@3.20.0

## 3.19.0

### Minor Changes

- 7bb5c23f: Enable Theme Kit Access passwords

### Patch Changes

- Updated dependencies [7bb5c23f]
  - @shopify/cli-kit@3.19.0

## 3.18.0

### Patch Changes

- 72171c1b: `shopify theme check` no longer ignores the `.theme-check.yml` file
- Updated dependencies [ef42fda6]
- Updated dependencies [514f2cb5]
- Updated dependencies [1455ee44]
- Updated dependencies [b4dafa4f]
- Updated dependencies [65625f47]
- Updated dependencies [0d674d64]
  - @shopify/cli-kit@3.18.0

## 3.17.0

### Patch Changes

- ff7a13d5: Fix push command with --store flag
- Updated dependencies [dac186b2]
- Updated dependencies [5617050a]
- Updated dependencies [5703ce9b]
- Updated dependencies [483318aa]
  - @shopify/cli-kit@3.17.0

## 3.16.3

### Patch Changes

- Updated dependencies [fc4d6c58]
  - @shopify/cli-kit@3.16.3

## 3.16.2

### Patch Changes

- Updated dependencies [ca6c7295]
  - @shopify/cli-kit@3.16.2

## 3.16.1

### Patch Changes

- @shopify/cli-kit@3.16.1

## 3.16.0

### Patch Changes

- Updated dependencies [d460e738]
  - @shopify/cli-kit@3.16.0

## 3.15.0

### Patch Changes

- Updated dependencies [9f7d90d9]
  - @shopify/cli-kit@3.15.0

## 3.14.0

### Patch Changes

- Updated dependencies [1dba11ec]
  - @shopify/cli-kit@3.14.0

## 3.13.1

### Patch Changes

- Updated dependencies [81d3ca50]
  - @shopify/cli-kit@3.13.1

## 3.13.0

### Patch Changes

- Updated dependencies [a979c0de]
- Updated dependencies [afa808cb]
- Updated dependencies [a225e415]
- Updated dependencies [5336b01f]
- Updated dependencies [2239cad9]
  - @shopify/cli-kit@3.13.0

## 3.12.0

### Patch Changes

- Updated dependencies [454641be]
  - @shopify/cli-kit@3.12.0

## 3.11.0

### Patch Changes

- Updated dependencies [38dedc05]
- Updated dependencies [79508f56]
- Updated dependencies [922c204e]
- Updated dependencies [ddbf7ee4]
  - @shopify/cli-kit@3.11.0

## 3.10.1

### Patch Changes

- f04ec835: Fix store initialization for Homebrew (project version error)
- b23e0461: Add theme info command
- Updated dependencies [f04ec835]
- Updated dependencies [b23e0461]
  - @shopify/cli-kit@3.10.1

## 3.10.0

### Patch Changes

- 630153fc: Fix initialization of themes on Windows due to invalid arguments being passed
- 30a048da: Fix pull command with --store flag
- Updated dependencies [4c8853f1]
  - @shopify/cli-kit@3.10.0

## 3.9.2

### Patch Changes

- 1e524fae: Fix syntax of the Homebrew formula
  - @shopify/cli-kit@3.9.2

## 3.9.1

### Patch Changes

- 869532f9: Remove the theme-command under the theme namespace
- Updated dependencies [08c42c45]
  - @shopify/cli-kit@3.9.1

## 3.9.0

### Patch Changes

- Updated dependencies [c7137a3b]
  - @shopify/cli-kit@3.9.0

## 3.8.0

### Patch Changes

- Updated dependencies [db4e6089]
- Updated dependencies [79df925d]
- Updated dependencies [03bd5f28]
- Updated dependencies [79df925d]
  - @shopify/cli-kit@3.8.0

## 3.7.1

### Patch Changes

- Updated dependencies [18717ad5]
- Updated dependencies [29f46e8f]
- Updated dependencies [bba213f9]
  - @shopify/cli-kit@3.7.1

## 3.6.2

### Patch Changes

- 59d56a40: Add multiple IDs to theme delete
- Updated dependencies [59d56a40]
  - @shopify/cli-kit@3.6.2

## 3.6.1

### Patch Changes

- @shopify/cli-kit@3.6.1

## 3.6.0

### Minor Changes

- 08c6526f: - Clean up theme share
  - Clean up theme package
  - Clean up theme publish
  - Clean up theme delete
  - Clean up theme open

### Patch Changes

- Updated dependencies [073e514c]
- Updated dependencies [d9351df4]
  - @shopify/cli-kit@3.6.0

## 3.5.0

### Patch Changes

- Updated dependencies [dabc4bab]
  - @shopify/cli-kit@3.5.0

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
