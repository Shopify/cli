# @shopify/cli

## 3.81.0

### Minor Changes

- ce3dfdc: Print all log messages to stderr instead of stdout

## 3.80.0

## 3.79.0

### Patch Changes

- 0e244dc: Update cli-hydrogen 10.0.1
- 5839055: Added formatting and comment preserving TOML support via @shopify/toml-patch; opt-in by setting "SHOPIFY_CLI_USE_WASM_TOML_PATCH"

## 3.78.0

### Minor Changes

- 4c6acaa: Add HTTP proxy support with the environment variables `SHOPIFY_HTTP_PROXY` and `SHOPIFY_HTTPS_PROXY`

  If your proxy uses basic authentication, provide the auth in the following format:

  ```bash
  SHOPIFY_HTTP_PROXY=http://user:pass@yourproxy.com:PORT
  ```

### Patch Changes

- daf44e8: Updated `@shopify/cli-hydrogen` dependency to `9.0.9`.

## 3.77.0

## 3.76.0

### Minor Changes

- fd32347: Add multi-environment infrastructure and allow multiple environment usage in theme list command

### Patch Changes

- c72ce71: Update to cli-hydrogen 9.0.6
- 5ad63a4: Update to cli-hydrogen 9.0.7
- e9b8582: Upgrade cli-hydrogen to 9.0.8 for 2025.1.2

## 3.75.0

### Patch Changes

- 07289c7: Bump cli-hydrogen to 9.0.5

## 3.74.0

## 3.73.0

### Minor Changes

- beab713acd: Developers can now use the `shopify theme metafields pull` command to download metafields, which can then be used for more refined code completion.

### Patch Changes

- cbfc36ca88: Bump cli-hydrogen package to 9.0.3

## 3.72.0

## 3.71.5

## 3.71.4

## 3.71.3

### Patch Changes

- 05a1eda9eb: Updated link extension import to match a target format similar to action extesions

## 3.71.2

## 3.71.1

## 3.71.0

### Patch Changes

- 93d65a6c38: Remove PHP template from app creation options

## 3.70.0

### Minor Changes

- 33477dd9d7: Notification system

### Patch Changes

- 2720923007: Fix files ignored when using negate patterns
- 55307bb536: Remove ruby version from theme info command
- 7da2c4dbde: Bump cli-hydrogen to 9.0.2
- 1623765ac9: Fix issue where you could not use multipass passwords with theme dev
- 57bb933980: Fix theme dev command deleting remote files even if using --nodelete flag
- 58768c3b64: Improve language around --nodelete flags for push and pull commands

## 3.69.0

### Minor Changes

- 0b587dff5: Improve user logging for render requests

### Patch Changes

- 581abd8d4: Improve user logging by adding status codes and event methods
- 8df131c3e: Fix syntax for theme command documentation

## 3.68.0

### Minor Changes

- 2200be0ae: force a minor CLI 3.68.0 release from patch changes

## 3.67.0

### Minor Changes

- 4b4146186: Default to Typescript implementation for theme commands. Legacy implementation is stil available via the `--legacy` flag.

## 3.66.0

### Minor Changes

- 05cbe63566: Display daily upgrade reminder when a new version is available

### Patch Changes

- 40a7b1229a: CLI now better handles 429 rate limiting for large projects

## 3.65.0

### Minor Changes

- 28acb03664: [Checkout extensibility] Adds iframe.sources capability

### Patch Changes

- 8da3bd7d02: Replace sample domain with IANA-reserved domain for technical documentation

## 3.64.0

### Minor Changes

- cb06f10e1: Added extension type pos_ui_extension to the ui_extension migration process

## 3.63.0

### Minor Changes

- 7742994a5: Log streaming for Shopify Functions within `app dev` and re-execution of function runs via `app function replay` are available in beta. See [Shopify Functions documentation](https://shopify.dev/docs/apps/build/functions/log-streaming-and-replay) for more information.

### Patch Changes

- 9d3a6bade: Updated nx and eslint rules

## 3.62.0

## 3.61.0

### Minor Changes

- 95d534387: Rename unreleased default_placement_reference extension property to default_placement.
- d85e7adb4: Include hydrogen commands in the bundle

### Patch Changes

- Updated dependencies [caa015042]
- Updated dependencies [79a951f3c]
- Updated dependencies [79a951f3c]
- Updated dependencies [87a6cc590]
- Updated dependencies [0c117d0f4]
- Updated dependencies [009a43078]
- Updated dependencies [b2b041f56]
  - @shopify/app@3.61.0
  - @shopify/cli-kit@3.61.0
  - @shopify/plugin-cloudflare@3.61.0
  - @shopify/plugin-did-you-mean@3.61.0
  - @shopify/theme@3.61.0

## 3.60.0

### Minor Changes

- d4d493e25: Adds validations for editor extension collection
- fb085c32c: Adds localization support for editor extension collection
- 427d9dc0f: Webhook trigger now reads from the configuration instead of .env and accepts more flags

### Patch Changes

- 6e68a82c1: Fix bug with plugins installation
- Updated dependencies [ea177a190]
- Updated dependencies [d5a05e7cc]
- Updated dependencies [2ac5142dc]
- Updated dependencies [d5a05e7cc]
- Updated dependencies [031aa2d0b]
- Updated dependencies [0ff96c777]
- Updated dependencies [0c8800c87]
- Updated dependencies [5343a3672]
- Updated dependencies [5bca2e386]
- Updated dependencies [601020909]
- Updated dependencies [427d9dc0f]
- Updated dependencies [fed261a9b]
  - @shopify/theme@3.60.0
  - @shopify/app@3.60.0
  - @shopify/cli-kit@3.60.0
  - @shopify/plugin-cloudflare@3.60.0
  - @shopify/plugin-did-you-mean@3.60.0

## 3.59.0

### Minor Changes

- ca218cd31: Shopify CLI now defaults to be Global

### Patch Changes

- a2d6f882d: Fix release scripts
- 725f2f72b: Fix hydrogen init to always show the package manager selection prompt
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
- Updated dependencies [ca218cd31]
  - @shopify/plugin-did-you-mean@3.59.0
  - @shopify/plugin-cloudflare@3.59.0
  - @shopify/cli-kit@3.59.0
  - @shopify/theme@3.59.0
  - @shopify/app@3.59.0

## 3.58.0

### Minor Changes

- d1c4f4bf7: Adds editor extension collection specification [here](https://github.com/Shopify/cli/pull/3551)

### Patch Changes

- 960cdc0a2: Add a new "app init" command
- 94da7f678: Move webhook commands under app
- d1c4f4bf7: Renames nested `write_privacy_consent` capability to `customer_privacy` under `collect_buyer_consent`
- Updated dependencies [ab752de6e]
- Updated dependencies [3affd6bbe]
- Updated dependencies [cedd14e6c]
  - @shopify/cli-kit@3.58.0
  - @shopify/plugin-did-you-mean@3.58.0

## 3.57.0

### Patch Changes

- @shopify/cli-kit@3.57.0
- @shopify/plugin-did-you-mean@3.57.0

## 3.56.0

### Minor Changes

- 390729c33: `app config push` and `app update-url` commands dropped

### Patch Changes

- 8e95f18a2: Load betas inside the remote app entity
- Updated dependencies [1220290ec]
  - @shopify/cli-kit@3.56.0
  - @shopify/plugin-did-you-mean@3.56.0

## 3.55.0

### Patch Changes

- @shopify/cli-kit@3.55.0
- @shopify/plugin-did-you-mean@3.55.0

## 3.54.0

### Minor Changes

- a9e847717: Upgrade oclif to v3 (improved help menus and more)

### Patch Changes

- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
- Updated dependencies [a9e847717]
  - @shopify/cli-kit@3.54.0
  - @shopify/plugin-did-you-mean@3.54.0

## 3.53.0

### Minor Changes

- 1d6fe3475: Increase minimum Node version to 18
- 0896e62b1: Versioned app config support
- 72b1daaee: Add new `nodelete` flag to `shopify theme dev` command

### Patch Changes

- 562ae6c3a: Adds new, nested `write_privacy_consent` capability under `collect_buyer_consent`
- Updated dependencies [1d6fe3475]
- Updated dependencies [cc3ada0a2]
- Updated dependencies [0896e62b1]
- Updated dependencies [72b1daaee]
  - @shopify/plugin-did-you-mean@3.53.0
  - @shopify/cli-kit@3.53.0

## 3.52.0

### Patch Changes

- Updated dependencies [4ea4c08dd]
- Updated dependencies [1de8122c4]
- Updated dependencies [060bd75cf]
- Updated dependencies [060bd75cf]
- Updated dependencies [9cbe46e06]
  - @shopify/cli-kit@3.52.0
  - @shopify/plugin-did-you-mean@3.52.0

## 3.51.0

### Minor Changes

- 2145d7a46: Added fix to support `:theme_app_extension` for dev-preview theme check.

### Patch Changes

- f5caf4da4: Add new --json flag to theme list and app versions list commands
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
  - @shopify/plugin-did-you-mean@3.51.0

## 3.50.0

### Minor Changes

- 6095a8827: Added `--dev-preview` for `theme language-server`

### Patch Changes

- 1eb27c05b: Show friendlier message when invalid json template format
- Updated dependencies [4bb8fff29]
- Updated dependencies [3f36e9463]
- Updated dependencies [cf5bbff61]
- Updated dependencies [46a72a6b4]
- Updated dependencies [3ed6ae88e]
- Updated dependencies [d6b02afcf]
- Updated dependencies [e0cd881e1]
- Updated dependencies [20d667246]
  - @shopify/cli-kit@3.50.0
  - @shopify/plugin-did-you-mean@3.50.0

## 3.49.1

### Patch Changes

- @shopify/cli-kit@3.49.1
- @shopify/plugin-did-you-mean@3.49.1

## 3.49.0

### Minor Changes

- 84fddcf69: Added support for optional localizable description to UI extensions dev and deploy
- 2615b9765: Add new dev docs search command

### Patch Changes

- 5689257af: Improve upgrade command to ensure both cli and app are up to date
- 1914affaf: Fix pnpm shopify upgrade for workspaces
- fa7937b65: Updated the simplified deployments info banner
- 037925af0: Upgrade command works with a valid app config file different from the default shopify.app.toml
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
  - @shopify/plugin-did-you-mean@3.49.0

## 3.48.0

### Minor Changes

- 6e0d87220: Remove ngrok plugin
- a17e43672: Implement Unified Deployments

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
  - @shopify/plugin-did-you-mean@3.48.0

## 3.47.0

### Minor Changes

- 79288e004: Updated app generate schema to output to either to schema.graphql (by default) or stdout with --stdout flag

### Patch Changes

- Updated dependencies [ad3894aea]
- Updated dependencies [99df79caf]
- Updated dependencies [9bb98c029]
- Updated dependencies [ca2461e94]
- Updated dependencies [4ded88051]
- Updated dependencies [99fc03fbc]
- Updated dependencies [e217b34eb]
  - @shopify/cli-kit@3.47.0
  - @shopify/plugin-did-you-mean@3.47.0

## 3.47.0-pre.0

### Patch Changes

- Updated dependencies [ad3894aea]
- Updated dependencies [ca2461e94]
- Updated dependencies [4ded88051]
  - @shopify/cli-kit@3.47.0-pre.0
  - @shopify/plugin-did-you-mean@3.47.0-pre.0

## 3.46.0

### Minor Changes

- e13c78960: Hide plugins commands

### Patch Changes

- 94d197f63: Display clear error message when prompting fails due to non-TTY terminal
- 1ed1321cd: Not upgrade the global Homebrew installation of the CLI on 'shopify upgrade'
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
  - @shopify/plugin-did-you-mean@3.46.0

## 3.46.0-pre.3

### Patch Changes

- Updated dependencies [d9ef6c3f6]
- Updated dependencies [cc37858fb]
- Updated dependencies [1c8afb7f4]
- Updated dependencies [6663b3a8f]
- Updated dependencies [069e38ecf]
  - @shopify/cli-kit@3.46.0-pre.3
  - @shopify/plugin-did-you-mean@3.46.0-pre.3

## 3.46.0-pre.2

### Minor Changes

- e13c78960: Hide plugins commands

### Patch Changes

- Updated dependencies [a7c1eabeb]
- Updated dependencies [162504891]
- Updated dependencies [151684a25]
- Updated dependencies [01988114d]
  - @shopify/cli-kit@3.46.0-pre.2
  - @shopify/plugin-did-you-mean@3.46.0-pre.2

## 3.46.0-pre.1

### Patch Changes

- Updated dependencies [beda7c241]
- Updated dependencies [3169c1e44]
  - @shopify/cli-kit@3.46.0-pre.1
  - @shopify/plugin-did-you-mean@3.46.0-pre.1

## 3.46.0-pre.0

### Patch Changes

- 1ed1321cd: Not upgrade the global Homebrew installation of the CLI on 'shopify upgrade'
- Updated dependencies [f95e3a1d5]
  - @shopify/cli-kit@3.46.0-pre.0
  - @shopify/plugin-did-you-mean@3.46.0-pre.0

## 3.45.0

### Patch Changes

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
  - @shopify/plugin-did-you-mean@3.45.0

## 3.45.0-pre.5

### Patch Changes

- Updated dependencies [da01d3595]
- Updated dependencies [6735253e6]
- Updated dependencies [e85f718cd]
- Updated dependencies [e6753f4ed]
- Updated dependencies [645b085b8]
  - @shopify/cli-kit@3.45.0-pre.5
  - @shopify/plugin-did-you-mean@3.45.0-pre.5

## 3.45.0-pre.4

### Patch Changes

- Updated dependencies [ce1457036]
- Updated dependencies [2ca5b35d8]
  - @shopify/cli-kit@3.45.0-pre.4
  - @shopify/plugin-did-you-mean@3.45.0-pre.4

## 3.45.0-pre.3

### Patch Changes

- Updated dependencies [ddb967914]
- Updated dependencies [7153dff92]
  - @shopify/cli-kit@3.45.0-pre.3
  - @shopify/plugin-did-you-mean@3.45.0-pre.3

## 3.45.0-pre.2

### Patch Changes

- Updated dependencies [9c253511e]
  - @shopify/cli-kit@3.45.0-pre.2
  - @shopify/plugin-did-you-mean@3.45.0-pre.2

## 3.45.0-pre.1

### Patch Changes

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
  - @shopify/plugin-did-you-mean@3.45.0-pre.1

## 3.44.1-pre.0

### Patch Changes

- Updated dependencies [25fc42ae2]
- Updated dependencies [b2e066fc0]
- Updated dependencies [657593b1a]
  - @shopify/cli-kit@3.44.1-pre.0
  - @shopify/plugin-did-you-mean@3.44.1-pre.0

## 3.44.0

### Patch Changes

- 82a06e7e2: Add did-you-mean plugin
- Updated dependencies [82a06e7e2]
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
  - @shopify/plugin-did-you-mean@3.44.0
  - @shopify/cli-kit@3.44.0

## 3.43.0

### Patch Changes

- Updated dependencies [f732207fa]
- Updated dependencies [4b0cc57ce]
- Updated dependencies [b6f93cfa7]
  - @shopify/cli-kit@3.43.0

## 3.42.0

### Patch Changes

- Updated dependencies [2203d4e6f]
  - @shopify/cli-kit@3.42.0

## 3.41.2

### Patch Changes

- @shopify/cli-kit@3.41.2

## 3.41.1

### Patch Changes

- @shopify/cli-kit@3.41.1

## 3.41.0

### Minor Changes

- 9d9480341: Add developer experience preview for JavaScript functions

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

- 413980f0b: Enable configuring api_version for ui_extension

### Patch Changes

- 1661f80a2: Various copy improvements
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

- 91a44020b: Warn the user if there are more than 25 apps in app selection prompt
- Updated dependencies [afe541577]
- Updated dependencies [f4d5fb1a8]
- Updated dependencies [91a44020b]
  - @shopify/cli-kit@3.39.0

## 3.38.0

### Minor Changes

- a9ee91b2e: Drop editions command

### Patch Changes

- @shopify/cli-kit@3.38.0

## 3.37.0

### Patch Changes

- Updated dependencies [a5224543b]
  - @shopify/cli-kit@3.37.0

## 3.36.2

### Patch Changes

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

- 8c2926479: Split kitchen-sink command into subcommands
- Updated dependencies [c2a7c17e0]
  - @shopify/cli-kit@3.36.0

## 3.35.0

### Patch Changes

- Updated dependencies [50c0b2cd3]
- Updated dependencies [2aa5c07aa]
- Updated dependencies [1a482191a]
- Updated dependencies [a4f78e95f]
  - @shopify/cli-kit@3.35.0

## 3.34.0

### Patch Changes

- @shopify/cli-kit@3.34.0

## 3.33.0

### Minor Changes

- d7b582cb1: Remove the @shopify/ngrok plugin from @shopify/cli

### Patch Changes

- Updated dependencies [eee1293ef]
- Updated dependencies [5e7474fab]
- Updated dependencies [9eb807bf7]
  - @shopify/cli-kit@3.33.0

## 3.32.1

### Patch Changes

- Updated dependencies [39315c3d0]
  - @shopify/cli-kit@3.32.1
  - @shopify/plugin-ngrok@3.32.1

## 3.32.0

### Patch Changes

- Updated dependencies [a8489366]
- Updated dependencies [00de42e8]
  - @shopify/cli-kit@3.32.0
  - @shopify/plugin-ngrok@3.32.0

## 3.31.1

### Patch Changes

- @shopify/cli-kit@3.31.1
- @shopify/plugin-ngrok@3.31.1

## 3.31.0

### Patch Changes

- Updated dependencies [80c6638c]
- Updated dependencies [dcf53ece]
  - @shopify/cli-kit@3.31.0
  - @shopify/plugin-ngrok@3.31.0

## 3.30.2

### Patch Changes

- Updated dependencies [ba91a2da]
- Updated dependencies [23b1cc84]
  - @shopify/cli-kit@3.30.2
  - @shopify/plugin-ngrok@3.30.2

## 3.30.1

### Patch Changes

- Updated dependencies [2ac83ce6]
  - @shopify/cli-kit@3.30.1
  - @shopify/plugin-ngrok@3.30.1

## 3.30.0

### Minor Changes

- 737ca469: Remove logs functionality

### Patch Changes

- Updated dependencies [737ca469]
  - @shopify/cli-kit@3.30.0
  - @shopify/plugin-ngrok@3.30.0

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
  - @shopify/plugin-ngrok@3.29.0

## 3.28.0

### Patch Changes

- @shopify/cli-kit@3.28.0
- @shopify/plugin-ngrok@3.28.0

## 3.27.0

### Patch Changes

- Updated dependencies [32bbe23d]
  - @shopify/cli-kit@3.27.0
  - @shopify/plugin-ngrok@3.27.0

## 3.26.0

### Patch Changes

- Updated dependencies [0d8ac8c9]
- Updated dependencies [ab76be51]
- Updated dependencies [a6a3f2b4]
- Updated dependencies [ca8141bc]
  - @shopify/cli-kit@3.26.0
  - @shopify/plugin-ngrok@3.26.0

## 3.25.0

### Patch Changes

- Updated dependencies [78196a78]
  - @shopify/cli-kit@3.25.0
  - @shopify/plugin-ngrok@3.25.0

## 3.24.1

### Patch Changes

- Updated dependencies [7e5c492a]
  - @shopify/cli-kit@3.24.1
  - @shopify/plugin-ngrok@3.24.1

## 3.24.0

### Patch Changes

- cb0990df: Fixed no organization error formatting
- Updated dependencies [d47a6e80]
- Updated dependencies [a9d4be9e]
- Updated dependencies [aca90638]
- Updated dependencies [cb0990df]
  - @shopify/cli-kit@3.24.0
  - @shopify/plugin-ngrok@3.24.0

## 3.23.0

### Patch Changes

- Updated dependencies [c15ad5df]
- Updated dependencies [1ee1cfd1]
  - @shopify/cli-kit@3.23.0
  - @shopify/plugin-ngrok@3.23.0

## 3.22.1

### Patch Changes

- @shopify/cli-kit@3.22.1
- @shopify/plugin-ngrok@3.22.1

## 3.22.0

### Patch Changes

- 6c0cd13d: Polish log truncation process
- Updated dependencies [e0b5c20b]
- Updated dependencies [6de19ebd]
- Updated dependencies [6c0cd13d]
- Updated dependencies [7035d36b]
  - @shopify/cli-kit@3.22.0
  - @shopify/plugin-ngrok@3.22.0

## 3.21.0

### Patch Changes

- Updated dependencies [e4352f2e]
- Updated dependencies [c906187f]
- Updated dependencies [5cda6300]
  - @shopify/cli-kit@3.21.0
  - @shopify/plugin-ngrok@3.21.0

## 3.20.1

### Patch Changes

- 3f285ff9: Fix homebrew upgrade to handle shopify-cli package
- Updated dependencies [3f285ff9]
  - @shopify/cli-kit@3.20.1
  - @shopify/plugin-ngrok@3.20.1

## 3.20.0

### Patch Changes

- Updated dependencies [96d5b175]
- Updated dependencies [0a8ee2a3]
- Updated dependencies [efa5b071]
- Updated dependencies [4bd05555]
  - @shopify/cli-kit@3.20.0
  - @shopify/plugin-ngrok@3.20.0

## 3.19.0

### Patch Changes

- Updated dependencies [7bb5c23f]
  - @shopify/cli-kit@3.19.0
  - @shopify/plugin-ngrok@3.19.0

## 3.18.0

### Minor Changes

- b4dafa4f: Add timestamps to logs and introduce first UI kit components

### Patch Changes

- ef42fda6: Improve error outputs by using the new Banner component
- 1455ee44: Improve how concurrent processes output looks
- Updated dependencies [ef42fda6]
- Updated dependencies [514f2cb5]
- Updated dependencies [1455ee44]
- Updated dependencies [b4dafa4f]
- Updated dependencies [65625f47]
- Updated dependencies [0d674d64]
  - @shopify/cli-kit@3.18.0
  - @shopify/plugin-ngrok@3.18.0

## 3.17.0

### Patch Changes

- Updated dependencies [dac186b2]
- Updated dependencies [5617050a]
- Updated dependencies [5703ce9b]
- Updated dependencies [483318aa]
  - @shopify/cli-kit@3.17.0
  - @shopify/plugin-ngrok@3.17.0

## 3.16.3

### Patch Changes

- Updated dependencies [fc4d6c58]
  - @shopify/cli-kit@3.16.3
  - @shopify/plugin-ngrok@3.16.3

## 3.16.2

### Patch Changes

- Updated dependencies [ca6c7295]
  - @shopify/cli-kit@3.16.2
  - @shopify/plugin-ngrok@3.16.2

## 3.16.1

### Patch Changes

- @shopify/cli-kit@3.16.1
- @shopify/plugin-ngrok@3.16.1

## 3.16.0

### Patch Changes

- Updated dependencies [d460e738]
  - @shopify/cli-kit@3.16.0
  - @shopify/plugin-ngrok@3.16.0

## 3.15.0

### Patch Changes

- Updated dependencies [9f7d90d9]
  - @shopify/cli-kit@3.15.0
  - @shopify/plugin-ngrok@3.15.0

## 3.14.0

### Minor Changes

- 1dba11ec: Support upgrade of a globally installed CLI

### Patch Changes

- Updated dependencies [1dba11ec]
  - @shopify/cli-kit@3.14.0
  - @shopify/plugin-ngrok@3.14.0

## 3.13.1

### Patch Changes

- Updated dependencies [81d3ca50]
  - @shopify/cli-kit@3.13.1
  - @shopify/plugin-ngrok@3.13.1

## 3.13.0

### Patch Changes

- 24f08565: Add missing import that causes the CLI execution to fail in production
- 89d6cb86: Clear app information when logging out
- Updated dependencies [a979c0de]
- Updated dependencies [afa808cb]
- Updated dependencies [a225e415]
- Updated dependencies [5336b01f]
- Updated dependencies [2239cad9]
  - @shopify/cli-kit@3.13.0
  - @shopify/plugin-ngrok@3.13.0

## 3.12.0

### Minor Changes

- 454641be: Allow running shopify installed globally instead of npm/yarn/pnpm shopify

### Patch Changes

- Updated dependencies [454641be]
  - @shopify/cli-kit@3.12.0
  - @shopify/plugin-ngrok@3.12.0

## 3.11.0

### Minor Changes

- 79508f56: Don't allow the log file to grow too much

### Patch Changes

- Updated dependencies [38dedc05]
- Updated dependencies [79508f56]
- Updated dependencies [922c204e]
- Updated dependencies [ddbf7ee4]
  - @shopify/cli-kit@3.11.0
  - @shopify/plugin-ngrok@3.11.0

## 3.10.1

### Patch Changes

- f04ec835: Fix store initialization for Homebrew (project version error)
- Updated dependencies [f04ec835]
- Updated dependencies [b23e0461]
  - @shopify/cli-kit@3.10.1
  - @shopify/plugin-ngrok@3.10.1

## 3.10.0

### Patch Changes

- Updated dependencies [fcbcfcfa]
- Updated dependencies [4c8853f1]
  - @shopify/plugin-ngrok@3.10.0
  - @shopify/cli-kit@3.10.0

## 3.9.2

### Patch Changes

- @shopify/cli-kit@3.9.2

## 3.9.1

### Patch Changes

- Updated dependencies [08c42c45]
  - @shopify/cli-kit@3.9.1

## 3.9.0

### Patch Changes

- Updated dependencies [c7137a3b]
  - @shopify/cli-kit@3.9.0

## 3.8.0

### Minor Changes

- 36db5aa3: Add the option to choose typescript templates for ui extensions

### Patch Changes

- Updated dependencies [db4e6089]
- Updated dependencies [79df925d]
- Updated dependencies [03bd5f28]
- Updated dependencies [79df925d]
  - @shopify/cli-kit@3.8.0

## 3.7.1

### Minor Changes

- 18717ad5: Rename the environment variable SHOPIFY_CONFIG to SHOPIFY_ENV because it's more representative of its usage

### Patch Changes

- Updated dependencies [18717ad5]
- Updated dependencies [29f46e8f]
- Updated dependencies [bba213f9]
  - @shopify/cli-kit@3.7.1

## 3.6.2

### Patch Changes

- Updated dependencies [59d56a40]
  - @shopify/cli-kit@3.6.2

## 3.6.1

### Patch Changes

- @shopify/cli-kit@3.6.1

## 3.6.0

### Patch Changes

- 6f6dc914: Fix script execution for Windows dev enviroments
- Updated dependencies [073e514c]
- Updated dependencies [d9351df4]
  - @shopify/cli-kit@3.6.0

## 3.5.0

### Patch Changes

- Updated dependencies [dabc4bab]
  - @shopify/cli-kit@3.5.0

## 3.4.0

### Patch Changes

- 08366831: Better logging:
  • include Prompt and List input/output
  • distinguish commands via UUID and log lines for command start/finish
  • use a command line flag to specify log stream to view (cli, create-app, create-hydrogen)
- Updated dependencies [08366831]
- Updated dependencies [feae2499]
- Updated dependencies [19ab3f99]
- Updated dependencies [0da6c7e8]
  - @shopify/cli-kit@3.4.0

## 3.3.3

### Patch Changes

- Updated dependencies [e89dfa81]
  - @shopify/cli-kit@3.3.3

## 3.3.2

### Patch Changes

- @shopify/cli-kit@3.3.2

## 3.3.1

### Patch Changes

- @shopify/cli-kit@3.3.1

## 3.3.0

### Patch Changes

- 35018a96: updated placeholder app urls used during app creation
- Updated dependencies [f7708fcc]
  - @shopify/cli-kit@3.3.0

## 3.2.0

### Minor Changes

- 9c10736a: Stop using semantic versioning for @shopify/cli-kit and pin the version from all the dependent packages

### Patch Changes

- Updated dependencies [86b04187]
  - @shopify/cli-kit@3.2.0

## 3.1.0

### Patch Changes

- Updated dependencies [740f73ac]
- Updated dependencies [d17770e8]
- Updated dependencies [d17770e8]
- Updated dependencies [de8ee02d]
- Updated dependencies [45f0f0b9]
- 53c46773: Replaces btoa() with Buffer.from()
  - @shopify/cli-kit@3.1.0

## 3.0.27

### Patch Changes

- Updated dependencies [e2e8b4db]
  - @shopify/cli-kit@3.0.27

## 3.0.26

### Patch Changes

- 022a4e24: Internal: build cli-kit using tsc instead of rollup+esbuild
- e81e52b1: Report error events
- 168bb4c6: Add total time to analytics reports
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

## 3.0.25

### Patch Changes

- a6ea9c8d: Fix shopify upgrade
- Updated dependencies [a6ea9c8d]
- Updated dependencies [822d0fd3]
- Updated dependencies [bf8137c2]
- Updated dependencies [e650b499]
- Updated dependencies [3360289d]
- Updated dependencies [2a666db7]
  - @shopify/cli-kit@3.0.25

## 3.0.24

### Patch Changes

- @shopify/cli-kit@3.0.24

## 3.0.23

### Patch Changes

- d115df3b: Check that the error has object as a prototype
  - @shopify/cli-kit@3.0.23

## 3.0.22

### Patch Changes

- 7f32e9ac: Delete the global store when the user logs out
- Updated dependencies [7f32e9ac]
- Updated dependencies [7f32e9ac]
  - @shopify/cli-kit@3.0.22

## 3.0.21

### Patch Changes

- Consume a new release of the extensions binary that allows setting the ngrok header
  - @shopify/cli-kit@3.0.21

## 3.0.20

### Patch Changes

- Updated dependencies [5d422ea9]
  - @shopify/cli-kit@3.0.20

## 3.0.19

### Patch Changes

- Updated dependencies [d73ea66a]
- Updated dependencies [45866b2a]
- Updated dependencies [3c9519fa]
- Updated dependencies [0550cb31]
- Updated dependencies [fd254893]
- Updated dependencies [cc4c0151]
  - @shopify/cli-kit@3.0.19

## 3.0.18

### Patch Changes

- 84438079: Add logging to file and command to access logs
- fa518a0d: Report events with the analytics helper from cli-kit
- Updated dependencies [84438079]
- Updated dependencies [fa518a0d]
- Updated dependencies [fd10fc01]
- Updated dependencies [0243890b]
- Updated dependencies [cb1caa7c]
  - @shopify/cli-kit@3.0.18

## 3.0.17

### Patch Changes

- 336ae141: Fix analytics report for dev command
- Updated dependencies [df0d0347]
- Updated dependencies [6657a57c]
  - @shopify/cli-kit@3.0.17

## 3.0.16

### Patch Changes

- eb915dee: Loose version requirements to help dependency managers dedupe dependencies
- a750e67c: Improve dependency upgrade messages to leverage new shopify upgrade command
- Updated dependencies [eb915dee]
- Updated dependencies [85ee088d]
- Updated dependencies [2ecbff43]
- Updated dependencies [a750e67c]
  - @shopify/cli-kit@3.0.16

## 3.0.15

### Patch Changes

- 99378ca0: Push dependency manager detection into cli-kit
- 99378ca0: Add command to upgrade all project types
- Updated dependencies [c3b711ec]
- Updated dependencies [99378ca0]
  - @shopify/cli-kit@3.0.15

## 3.0.14

### Patch Changes

- Updated dependencies [8f82bd36]
- Updated dependencies [ae3823c8]
- Updated dependencies [8f82bd36]
- Updated dependencies [c383ed42]
  - @shopify/cli-kit@3.0.14

## 3.0.13

### Patch Changes

- 604d7d97: Fix some unhandled promises and errors
- Updated dependencies [604d7d97]
  - @shopify/cli-kit@3.0.13

## 3.0.12

### Patch Changes

- 11d09f7f: Encourage upgrading if not up-to-date
- 89a48ba9: Report analytics for every command to Monorail
- Updated dependencies [e05749dc]
- Updated dependencies [89a48ba9]
- Updated dependencies [1f45ddc4]
- Updated dependencies [8c690cca]
- Updated dependencies [11d09f7f]
- Updated dependencies [783a3714]
- Updated dependencies [e12c82b3]
- Updated dependencies [cb8e2c25]
  - @shopify/cli-kit@3.0.12

## 3.0.11

### Patch Changes

- Updated dependencies [1f10093b]
  - @shopify/cli-kit@3.0.11

## 3.0.10

### Patch Changes

- @shopify/cli-kit@3.0.10

## 3.0.9

### Patch Changes

- @shopify/cli-kit@3.0.9

## 3.0.8

### Patch Changes

- @shopify/cli-kit@3.0.8

## 3.0.7

### Patch Changes

- 8de7f95d: Fix an issue that causes releases not to pick the latest version of the CLI packages
- Updated dependencies [8de7f95d]
  - @shopify/cli-kit@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies [1e4d024e]
- Updated dependencies [27677c2d]
  - @shopify/cli-kit@3.0.6

## 3.0.5

### Patch Changes

- @shopify/cli-kit@3.0.5

## 3.0.4

### Patch Changes

- Fix create-app not using 3.0.3
- Updated dependencies
  - @shopify/cli-kit@3.0.4

## 3.0.1

### Patch Changes

- b911cfa2: Add editions command
- 2044f14c: Update Ngrok plugin dependency to 0.2.6 (error improvements)
- Updated dependencies [c01cd9a5]
- Updated dependencies [9d324502]
  - @shopify/cli-kit@3.0.1

## 3.0.0

### Major Changes

- Bump to 3.0.0

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@3.0.0

## 2.0.15

### Patch Changes

- Updated dependencies [19e343ea]
- Updated dependencies [eaf69a92]
- Updated dependencies [5ed34580]
  - @shopify/cli-kit@2.0.15

## 2.0.14

### Patch Changes

- Updated dependencies [87e51326]
- Updated dependencies [87e51326]
- Updated dependencies [b10ddafc]
  - @shopify/cli-kit@2.0.14

## 2.0.13

### Patch Changes

- Updated dependencies [1fb2da6c]
  - @shopify/cli-kit@2.0.13

## 2.0.10

### Patch Changes

- Updated dependencies [31b75488]
  - @shopify/cli-kit@2.0.10

## 2.0.9

### Patch Changes

- 4170ac8e: Hide plugins command
- Updated dependencies [4170ac8e]
- Updated dependencies [4170ac8e]
  - @shopify/cli-kit@2.0.9

## 2.0.8

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@2.0.8

## 2.0.7

### Patch Changes

- Updated dependencies [0d2e8e50]
- Updated dependencies [739e8e9d]
- Updated dependencies [c95660a6]
  - @shopify/cli-kit@2.0.7

## 2.0.6

### Patch Changes

- Updated dependencies [f7e74d33]
  - @shopify/cli-kit@2.0.6

## 2.0.5

### Patch Changes

- Updated dependencies [56b31022]
  - @shopify/cli-kit@2.0.5

## 2.0.3

### Patch Changes

- 8421ec9e: Enable creation of checkout-ui extensions
- Updated dependencies [30daa213]
- Updated dependencies [07bcb005]
- Updated dependencies [ba003f7b]
- Updated dependencies [b00ac480]
  - @shopify/cli-kit@2.0.3

## 2.0.2

### Patch Changes

- 70d8d50d: Use ngrok from plugin with --tunnel flag
- c6a9450b: Add support to scaffold function extensions
- Updated dependencies [c6a9450b]
- Updated dependencies [70d8d50d]
  - @shopify/cli-kit@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [9cb99f12]
- Updated dependencies [882e54e6]
  - @shopify/cli-kit@2.0.1

## 1.1.1

### Patch Changes

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

- 8e2c3d3: Improve the error handling to not treat invalid commands as bug errors
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

## 1.0.3

### Patch Changes

- Add support for plugins

## 1.0.1

### Patch Changes

- Some fixes
- Updated dependencies
  - @shopify/cli-kit@1.0.1

## 1.0.0

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

## 0.30.0

### Minor Changes

- Fix the releasing of @shopify/cli

## 0.29.1

### Patch Changes

- Updated dependencies [c31bb1e]
  - @shopify/cli-kit@0.29.1

## 0.16.0

### Minor Changes

- Fix executables not running in the production version of the CLI

## 0.15.0

### Minor Changes

- 15c4491: Add Hydrogen commands to the CLI

## 0.12.0

### Patch Changes

- Updated dependencies [cb12e51]
- Updated dependencies [a999af0]
- Updated dependencies [bed0951]
  - @shopify/cli-kit@0.12.0

## 0.10.0

### Patch Changes

- Updated dependencies
  - @shopify/cli-kit@0.10.0

## 0.8.0

### Minor Changes

- b07c608: Rename @shopify/core to @shopify/cli-kit and finish up the create-app workflow

### Patch Changes

- Updated dependencies [b07c608]
  - @shopify/cli-kit@0.8.0

## 0.6.0

### Minor Changes

- 7b69661: Remove the @shopify/support package

## 0.5.2

### Patch Changes

- Add @shopify/support and fix dependencies' setup
- Updated dependencies
  - @shopify/app@0.5.2
  - @shopify/cli-kit@0.5.2
  - @shopify/support@0.5.2
  - @shopify/theme@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies
  - @shopify/configs@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies
  - @shopify/@0.5.0

## 0.4.0

### Minor Changes

- ac955a9: Remove the Bugsnag setup from the CLI used for development purposes

## 0.3.0

### Minor Changes

- Draft the CLI interface

### Patch Changes

- Updated dependencies
  - @shopify/theme@0.3.0
  - @shopify/@0.3.0
  - @shopify/cli-kit@0.3.0
  - @shopify/cli-support@0.3.0

## 0.2.0

### Minor Changes

- Move from Lerna to changeset

### Patch Changes

- Updated dependencies
  - @shopify/@0.2.0
  - @shopify/cli-kit@0.2.0
  - @shopify/cli-support@0.2.0
  - @shopify/theme@0.2.0
