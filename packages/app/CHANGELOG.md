# @shopify/app

## 3.45.0-pre.5

### Minor Changes

- e85f718cd: Use `-e` as an alias for --environment and remove the current one for --theme-editor-sync
- 47856bde2: Set cloudflare as tunneling solution by default

### Patch Changes

- 09ff5a34e: Exclude system files from theme app extensions
- 326e9b2fb: Update esbuild to 0.17.10
- 7ff4f45db: Read function specifications from Partners API
- Updated dependencies [da01d3595]
- Updated dependencies [6735253e6]
- Updated dependencies [e85f718cd]
- Updated dependencies [e6753f4ed]
- Updated dependencies [47856bde2]
- Updated dependencies [645b085b8]
  - @shopify/cli-kit@3.45.0-pre.5
  - @shopify/plugin-cloudflare@3.45.0-pre.5
  - @shopify/plugin-ngrok@3.45.0-pre.5

## 3.45.0-pre.4

### Minor Changes

- 04f67f727: [Internal] Implement new unified deployment flow for organizations with the right beta flag

### Patch Changes

- b650d2234: Update the cart_transform templatePath to point to checkout/${lang}/cart-transform/default
- 7b409222e: Allow to specify a custom port in toml for frontend/backend processes
- Updated dependencies [ce1457036]
- Updated dependencies [2ca5b35d8]
  - @shopify/cli-kit@3.45.0-pre.4
  - @shopify/plugin-cloudflare@3.45.0-pre.4
  - @shopify/plugin-ngrok@3.45.0-pre.4

## 3.45.0-pre.3

### Patch Changes

- Updated dependencies [ddb967914]
- Updated dependencies [7153dff92]
  - @shopify/cli-kit@3.45.0-pre.3
  - @shopify/plugin-cloudflare@3.45.0-pre.3
  - @shopify/plugin-ngrok@3.45.0-pre.3

## 3.45.0-pre.2

### Patch Changes

- Updated dependencies [9c253511e]
  - @shopify/cli-kit@3.45.0-pre.2
  - @shopify/plugin-cloudflare@3.45.0-pre.2
  - @shopify/plugin-ngrok@3.45.0-pre.2

## 3.45.0-pre.1

### Minor Changes

- 1dd35b0b2: Enable environments for themes

### Patch Changes

- 705cb92eb: Get redirect url of the preview link for customer-accounts-ui-extension on dev console
- d6f278863: Integrate Theme App Extension output with the new UI Kit
- 8fbf5d50f: Add default api_version to the TOML for the ui-extension template
- 67d919a73: Disable function type validation except on deploy
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
  - @shopify/plugin-cloudflare@3.45.0-pre.1
  - @shopify/plugin-ngrok@3.45.0-pre.1

## 3.44.1-pre.0

### Patch Changes

- da6a3bdf8: Adding support for the new naming convention of extension points
- b895bb5e9: Fix template for ui_extension to not contain unsupported extensions points
- Updated dependencies [25fc42ae2]
- Updated dependencies [b2e066fc0]
- Updated dependencies [657593b1a]
  - @shopify/cli-kit@3.44.1-pre.0
  - @shopify/plugin-ngrok@3.44.1-pre.0

## 3.44.0

### Patch Changes

- b61c5972c: Speed up app dev by running web requests in parallel
- 2def6f113: Use app host for frontend url in spin when available
- 7925a40b2: Fix loading JS functions when there are UI extensions. Improve theme dev loading time.
- 6802b0876: Always populate host theme
- 26bee3526: Fix proxy crashing with ECONNREFUSED/ECONNRESET when a process isn't ready to receive packets.
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
  - @shopify/plugin-ngrok@3.44.0

## 3.43.0

### Minor Changes

- 4b0cc57ce: Theme bundling is now an opt-in feature

### Patch Changes

- Updated dependencies [f732207fa]
- Updated dependencies [4b0cc57ce]
- Updated dependencies [b6f93cfa7]
  - @shopify/cli-kit@3.43.0
  - @shopify/plugin-ngrok@3.43.0

## 3.42.0

### Minor Changes

- 66653aecd: Added the template for the new cart & checkout validation function

### Patch Changes

- Updated dependencies [2203d4e6f]
  - @shopify/cli-kit@3.42.0
  - @shopify/plugin-ngrok@3.42.0

## 3.41.2

### Patch Changes

- dd3d0c846: Update to latest version of javy and function-runner
  - @shopify/cli-kit@3.41.2
  - @shopify/plugin-ngrok@3.41.2

## 3.41.1

### Patch Changes

- 830617a4d: Fix bug when deploying apps that contain only theme app extensions
  - @shopify/cli-kit@3.41.1
  - @shopify/plugin-ngrok@3.41.1

## 3.41.0

### Minor Changes

- 9d9480341: Add developer experience preview for JavaScript functions

### Patch Changes

- Updated dependencies [9d9480341]
  - @shopify/cli-kit@3.41.0
  - @shopify/plugin-ngrok@3.41.0

## 3.40.3

### Patch Changes

- 9e7e226dd: Fix dev console link not appearing
  - @shopify/cli-kit@3.40.3
  - @shopify/plugin-ngrok@3.40.3

## 3.40.2

### Patch Changes

- c729e470d: Fix preview banner not showing when there are only UI extensions
- Updated dependencies [7c0b13944]
- Updated dependencies [7ca9a667d]
  - @shopify/cli-kit@3.40.2
  - @shopify/plugin-ngrok@3.40.2

## 3.40.1

### Patch Changes

- df3f6e629: Revert change to update Checkout UI template to use the new extension format
- 3314a972b: Fix windows not storing dev selected values correctly
  - @shopify/cli-kit@3.40.1
  - @shopify/plugin-ngrok@3.40.1

## 3.40.0

### Minor Changes

- cfb4b7f68: Improve output of preview instructions in dev command
- 9e74a9fc0: Send an app/uninstalled webhook to the app when the user selects a different app, to force the app to clean up the store's database entry
- 64bcf07c7: Enable Shopify Plus Sandbox stores
- 48122f791: Add the ability to migrate checkout ui extensions to the new ui extension type
- af42f22f6: Update Checkout UI template to use the new extension format

### Patch Changes

- 1661f80a2: Various copy improvements
- 228328a6d: Remove old `ui` module from cli-kit exports
- c30eb6978: Rename experimental presets feature to environments
- 3e94c0e0f: Fix the partnersWebIdentifier for the ui_extension specification
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
  - @shopify/plugin-ngrok@3.40.0

## 3.39.0

### Minor Changes

- 11f6fbec6: Add description configuration to POS UI Extension

### Patch Changes

- afe541577: Adopt the CLI UI kit in the `shopify theme package` command
- b8a96a215: Fix next steps in deploy success banner
- 91a44020b: Warn the user if there are more than 25 apps in app selection prompt
- Updated dependencies [afe541577]
- Updated dependencies [f4d5fb1a8]
- Updated dependencies [91a44020b]
  - @shopify/cli-kit@3.39.0
  - @shopify/plugin-ngrok@3.39.0

## 3.38.0

### Patch Changes

- da8c87a9f: Fix an issue with CLI2 not printing to the right stdout
  - @shopify/cli-kit@3.38.0
  - @shopify/plugin-ngrok@3.38.0

## 3.37.0

### Patch Changes

- Updated dependencies [a5224543b]
  - @shopify/cli-kit@3.37.0
  - @shopify/plugin-ngrok@3.37.0

## 3.36.2

### Patch Changes

- Updated dependencies [3ddd21dba]
  - @shopify/cli-kit@3.36.2
  - @shopify/plugin-ngrok@3.36.2

## 3.36.1

### Patch Changes

- Updated dependencies [d81271abd]
  - @shopify/cli-kit@3.36.1
  - @shopify/plugin-ngrok@3.36.1

## 3.36.0

### Minor Changes

- c2a7c17e0: Refresh command UIs with newly implemented Ink components
- 335a96a24: Improved dev console with new UX & functionality. New functionality: Preview app link and QRCode, better post purchase extension instructions, copy button for all preview links, support for upcoming UI extension changes

### Patch Changes

- Updated dependencies [c2a7c17e0]
  - @shopify/cli-kit@3.36.0
  - @shopify/plugin-ngrok@3.36.0

## 3.35.0

### Patch Changes

- Updated dependencies [50c0b2cd3]
- Updated dependencies [2aa5c07aa]
- Updated dependencies [1a482191a]
- Updated dependencies [a4f78e95f]
  - @shopify/cli-kit@3.35.0
  - @shopify/plugin-ngrok@3.35.0

## 3.34.0

### Minor Changes

- 39d6bcae8: Update to app_function_set: Adds new feature Input Query Variables - adds optional inqut query varialbes, updates schema + tests

### Patch Changes

- @shopify/cli-kit@3.34.0
- @shopify/plugin-ngrok@3.34.0

## 3.33.0

### Minor Changes

- d7b582cb1: Add the @shopify/ngrok plugin to the @shopify/app package
- 9eb807bf7: Add confirmation summary when deploying your app to Shopify. This will show new extensions, updated extensions and extensions which are missing locally. You can pass `--force` to the deploy command to skip this prompt.

### Patch Changes

- Updated dependencies [eee1293ef]
- Updated dependencies [5e7474fab]
- Updated dependencies [9eb807bf7]
  - @shopify/cli-kit@3.33.0
  - @shopify/plugin-ngrok@3.33.0

## 3.32.1

### Patch Changes

- Updated dependencies [39315c3d0]
  - @shopify/cli-kit@3.32.1

## 3.32.0

### Minor Changes

- aaa9730d: New update-url command

### Patch Changes

- Updated dependencies [a8489366]
- Updated dependencies [00de42e8]
  - @shopify/cli-kit@3.32.0

## 3.31.1

### Patch Changes

- 21a15024: Fix loading function specifications
  - @shopify/cli-kit@3.31.1

## 3.31.0

### Minor Changes

- 49f8f895: Add support for multiple custom OAuth callback paths by setting auth_callback_path to an array in shopify.web.toml

### Patch Changes

- a786f371: Fix bug in functions using a custom template repository
- b37ace4c: Fix extension generate not accepting some template values
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

### Minor Changes

- eb1ef02d: Added support for extensions and functions plugins

### Patch Changes

- 31de285b: Add appId to extensions payload
- Updated dependencies [737ca469]
  - @shopify/cli-kit@3.30.0

## 3.29.0

### Minor Changes

- 06b6b00d: Allow searching for apps to connect to by title
- b549291a: Update @oclif/core to 1.21.0

### Patch Changes

- 36d4a22c: Fix the loading of extensions failing because we treat .d.ts files as ESM modules
- Updated dependencies [eaf98706]
- Updated dependencies [d12ece22]
- Updated dependencies [aeca53c6]
- Updated dependencies [3b37c679]
- Updated dependencies [b549291a]
- Updated dependencies [06b6b00d]
  - @shopify/cli-kit@3.29.0

## 3.28.0

### Minor Changes

- 07c95c01: Adds api_access ability for UI Extensions

### Patch Changes

- 97e6e7bf: Fix bug generating functions without type
  - @shopify/cli-kit@3.28.0

## 3.27.0

### Patch Changes

- 2678d5a1: Fix bug generating theme app extensions
- 081db917: Add support for configuring the directories to load shopify.web.toml files from via the attribute web_directories in the shopify.app.toml file
- 93f22d6c: Only request necessary information to speed up fetching apps list
- 26c8ef33: Fix template for Delivery Customization extensions
- Updated dependencies [32bbe23d]
  - @shopify/cli-kit@3.27.0

## 3.26.0

### Patch Changes

- a6a3f2b4: Redirect extension output messages to concurrent output UI component
- 32cec194: Checkout ui extension React TypeScript template has ts error
- 127c0558: Fixed backend's shopify.web.toml parsing issue which causes auth_callback_path setting getting ignored
- Updated dependencies [0d8ac8c9]
- Updated dependencies [ab76be51]
- Updated dependencies [a6a3f2b4]
- Updated dependencies [ca8141bc]
  - @shopify/cli-kit@3.26.0

## 3.25.0

### Minor Changes

- d7064a0c: Fix issue where extensions could not import .graphql files
- 2555e5a9: Add ui.enable_create option for function toml configuration

### Patch Changes

- Updated dependencies [78196a78]
  - @shopify/cli-kit@3.25.0

## 3.24.1

### Patch Changes

- Updated dependencies [7e5c492a]
  - @shopify/cli-kit@3.24.1

## 3.24.0

### Minor Changes

- 76120036: Remove metadata.json from function extension
- fdaee1fc: Bring consistency to the environment variables that we pass to the web frontend and backend processes

### Patch Changes

- cb0990df: Fixed no organization error formatting
- Updated dependencies [d47a6e80]
- Updated dependencies [a9d4be9e]
- Updated dependencies [aca90638]
- Updated dependencies [cb0990df]
  - @shopify/cli-kit@3.24.0

## 3.23.0

### Patch Changes

- 5afb99e5: Add event trigger command
- Updated dependencies [c15ad5df]
- Updated dependencies [1ee1cfd1]
  - @shopify/cli-kit@3.23.0

## 3.22.1

### Patch Changes

- b9275c2b: Fix dev-console not loading because it can't be found
  - @shopify/cli-kit@3.22.1

## 3.22.0

### Patch Changes

- Updated dependencies [e0b5c20b]
- Updated dependencies [6de19ebd]
- Updated dependencies [6c0cd13d]
- Updated dependencies [7035d36b]
  - @shopify/cli-kit@3.22.0

## 3.21.0

### Minor Changes

- ad31c0bd: Adding support for a new auth_callback_path setting in web.shopify.toml, which overrides the values in the app setup when running the dev command.

  This enables apps to use custom paths for their OAuth callback, but still have the CLI set the appropriate value in the Partners Dashboard to keep the development flow unchanged.

  If you use a non-standard OAuth callback path, you can set this value to have the CLI automatically set the correct value for you.

- 5cda6300: Enable external access to cli inside a spin instance

### Patch Changes

- e4352f2e: Do not report handled tunnel plugin errors to Bugsnag
- Updated dependencies [e4352f2e]
- Updated dependencies [c906187f]
- Updated dependencies [5cda6300]
  - @shopify/cli-kit@3.21.0
  - @shopify/shopify-cli-extensions@3.21.0

## 3.20.1

### Patch Changes

- Updated dependencies [3f285ff9]
  - @shopify/cli-kit@3.20.1
  - @shopify/shopify-cli-extensions@3.20.1

## 3.20.0

### Minor Changes

- 96d5b175: Enable experimental presets feature for apps and themes
- 1e157c5b: Default to Node for building and deving extensions
- 4bd05555: Add experimental preset flag for pre-specifying command line flags

### Patch Changes

- 48dfd98e: Include the approvalScopes attributes when serving extensions form the new extensions' server implemented in Node
- Updated dependencies [96d5b175]
- Updated dependencies [0a8ee2a3]
- Updated dependencies [efa5b071]
- Updated dependencies [4bd05555]
  - @shopify/cli-kit@3.20.0
  - @shopify/shopify-cli-extensions@3.20.0

## 3.19.0

### Patch Changes

- Updated dependencies [7bb5c23f]
  - @shopify/cli-kit@3.19.0
  - @shopify/shopify-cli-extensions@3.19.0

## 3.18.0

### Minor Changes

- b4dafa4f: Add timestamps to logs and introduce first UI kit components
- 65625f47: Send a new environment variable to apps in dev command with the spin store domain.

### Patch Changes

- 1455ee44: Improve how concurrent processes output looks
- 5a73a0e2: Remove old workaround for extensions resource_url
- 0d674d64: Output messages with partners urls fixed when running against an spin instance
- Updated dependencies [ef42fda6]
- Updated dependencies [514f2cb5]
- Updated dependencies [1455ee44]
- Updated dependencies [b4dafa4f]
- Updated dependencies [65625f47]
- Updated dependencies [0d674d64]
  - @shopify/cli-kit@3.18.0
  - @shopify/shopify-cli-extensions@3.18.0

## 3.17.0

### Patch Changes

- 7576f700: Send capabilities in payload as camelCase
- dac186b2: Removing unnecessary calls to enqueue and check compilation status
- Updated dependencies [dac186b2]
- Updated dependencies [5617050a]
- Updated dependencies [5703ce9b]
- Updated dependencies [483318aa]
  - @shopify/cli-kit@3.17.0
  - @shopify/shopify-cli-extensions@3.17.0

## 3.16.3

### Patch Changes

- 58147c33: Added back the React import for scaffolded checkout ui extensions.
- Updated dependencies [fc4d6c58]
  - @shopify/cli-kit@3.16.3
  - @shopify/shopify-cli-extensions@3.16.3

## 3.16.2

### Patch Changes

- b02e2ff1: add jsx transform support to extensions build
- ca6c7295: React types dependency version should be overwritten when generating React Typescript extensions
- Updated dependencies [ca6c7295]
  - @shopify/cli-kit@3.16.2
  - @shopify/shopify-cli-extensions@3.16.2

## 3.16.1

### Patch Changes

- b0b66f8a: Fix error deploying extensions with capabilities
  - @shopify/cli-kit@3.16.1
  - @shopify/shopify-cli-extensions@3.16.1

## 3.16.0

### Minor Changes

- d460e738: Add the `app generate schema <function-name>` command
- 66d31140: Migrate the logic for serving extensions from Go to Node

### Patch Changes

- 2030174c: Print relevant error message when function wasm blob fails to upload
- Updated dependencies [d460e738]
  - @shopify/cli-kit@3.16.0
  - @shopify/shopify-cli-extensions@3.16.0

## 3.15.0

### Minor Changes

- 9f7d90d9: Add dev, build, deploy and another additional baseline instrumentantion

### Patch Changes

- 5fa4439c: Show `env pull` and `env show` in the `help` command output and move them under the `app` topic
- Updated dependencies [9f7d90d9]
  - @shopify/cli-kit@3.15.0
  - @shopify/shopify-cli-extensions@3.15.0

## 3.14.0

### Minor Changes

- ddba7e55: Use tunnel by default again (temporary change)

### Patch Changes

- Updated dependencies [1dba11ec]
  - @shopify/cli-kit@3.14.0
  - @shopify/shopify-cli-extensions@3.14.0

## 3.13.1

### Patch Changes

- ac0d42b1: React depency only added for generated extensions with react flavor
- 14737f76: Fix extensions generate not working with react templates
- Updated dependencies [81d3ca50]
  - @shopify/cli-kit@3.13.1
  - @shopify/shopify-cli-extensions@3.13.1

## 3.13.0

### Minor Changes

- 42ba3761: Add tunnel flag and use localhost by default instead of tunneling
- 5336b01f: Added support for extension development server to pass permissions metadata about the parent app to extension host systems
- 2239cad9: - `@shopify/cli-kit` - Add support to partners tokens in the `execCLI2` function
  - `@shopify/app` - Add support to theme app extensions in the `app dev` command

### Patch Changes

- 0c29f260: Fix an issue to avoid duplicated app selection when users execute `dev --reset`
- Updated dependencies [a979c0de]
- Updated dependencies [afa808cb]
- Updated dependencies [a225e415]
- Updated dependencies [5336b01f]
- Updated dependencies [2239cad9]
  - @shopify/cli-kit@3.13.0
  - @shopify/shopify-cli-extensions@3.13.0

## 3.12.0

### Minor Changes

- 8f3d677f: Add support for configuring extensions' directories via the attribute extension_directories in the shopify.app.toml file
- 3e98501c: [Web Pixel Extension] - the `configuration` property has been renamed to `settings` in the shopify.ui.extension.toml

### Patch Changes

- 5fa3c854: Rename `web-env` command to `env pull` and `env show`
- Updated dependencies [454641be]
  - @shopify/cli-kit@3.12.0
  - @shopify/shopify-cli-extensions@3.12.0

## 3.11.0

### Minor Changes

- 81283e95: Move the extension creation business logic from the Go binary to the @shopify/app package
- 922c204e: New Result type for handling errors

### Patch Changes

- 38dedc05: Fix getRandomPort retries
- 70f3578a: Fixed upload unit test
- Updated dependencies [38dedc05]
- Updated dependencies [79508f56]
- Updated dependencies [922c204e]
- Updated dependencies [ddbf7ee4]
  - @shopify/cli-kit@3.11.0
  - @shopify/shopify-cli-extensions@3.11.0

## 3.10.1

### Patch Changes

- f04ec835: Fix store initialization for Homebrew (project version error)
- b23e0461: Add theme info command
- Updated dependencies [f04ec835]
- Updated dependencies [dc364f39]
- Updated dependencies [b23e0461]
  - @shopify/cli-kit@3.10.1
  - @shopify/shopify-cli-extensions@3.10.1

## 3.10.0

### Minor Changes

- 16627bb4: Add --api-key flag for app deploy

### Patch Changes

- 4c8853f1: Use hooks to communicate with ngrok plugin
- Updated dependencies [4c8853f1]
  - @shopify/cli-kit@3.10.0
  - @shopify/shopify-cli-extensions@3.10.0

## 3.9.2

### Patch Changes

- @shopify/cli-kit@3.9.2
- @shopify/shopify-cli-extensions@3.9.2

## 3.9.1

### Patch Changes

- b777c41e: Fixed bug when running CLI on Windows machine. The node executable path is now pointing directly to a node file instead of relying in the node generated files.
- Updated dependencies [08c42c45]
  - @shopify/cli-kit@3.9.1
  - @shopify/shopify-cli-extensions@3.9.1

## 3.9.0

### Minor Changes

- c7137a3b: Grouping extension types in scaffold select type prompt

### Patch Changes

- 3b94965e: Be more consistent in how we refer to the Partners Dashboard
- 4a987a07: Displayed app URL more clearly in console output
- Updated dependencies [c7137a3b]
  - @shopify/cli-kit@3.9.0
  - @shopify/shopify-cli-extensions@3.9.0

## 3.8.0

### Minor Changes

- 391f02a1: Fix using the wrong package manager when installing dependencies in dev
- db4e6089: Releasing extensions binary in an automatic way
- 79df925d: New update URL flow
- 8a03b1cc: Fix a bug that caused pnpm not to work with Shopify app projects.
- 03bd5f28: Added `web-env` command to show and generate .env files without erasing existing ones

### Patch Changes

- Updated dependencies [db4e6089]
- Updated dependencies [79df925d]
- Updated dependencies [03bd5f28]
- Updated dependencies [79df925d]
  - @shopify/cli-kit@3.8.0
  - @shopify/shopify-cli-extensions@3.8.0

## 3.7.1

### Minor Changes

- bba213f9: Shopify Functions identifiers have been changed to ULIDs. Existing projects will be updated during the next deploy.

### Patch Changes

- Updated dependencies [18717ad5]
- Updated dependencies [29f46e8f]
- Updated dependencies [bba213f9]
  - @shopify/cli-kit@3.7.1
  - @shopify/shopify-cli-extensions@3.7.1

## 3.6.2

### Patch Changes

- Updated dependencies [59d56a40]
  - @shopify/cli-kit@3.6.2

## 3.6.1

### Patch Changes

- c33a6dcf: Bug-fix for running embedded apps without a backend
  - @shopify/cli-kit@3.6.1

## 3.6.0

### Minor Changes

- 1d438b3c: Support for new internal extension type identifiers

### Patch Changes

- d9351df4: Use a custom list of safe nouns and adjectives to generate default names for apps and extensions
- 858e3faf: Human facing internal extension type ids
- ffd33ec1: Fix logs when reusing dev values
- Updated dependencies [073e514c]
- Updated dependencies [d9351df4]
  - @shopify/cli-kit@3.6.0

## 3.5.0

### Minor Changes

- b6c4c709: Use the same package manager consistently througout all the CLI workflows

### Patch Changes

- dabc4bab: Refactor rejection tests to follow recommended implementation by Vitest
- Updated dependencies [dabc4bab]
  - @shopify/cli-kit@3.5.0

## 3.4.0

### Patch Changes

- a696df0c: Update some copies
- 3cf308d4: Loosen the convention of the web component having to be under the /web directory
- 690cfb75: Allow websocket connections to support vite HMR
- Updated dependencies [08366831]
- Updated dependencies [feae2499]
- Updated dependencies [19ab3f99]
- Updated dependencies [0da6c7e8]
  - @shopify/cli-kit@3.4.0

## 3.3.3

### Patch Changes

- ceacde28: Add a new flag to dev command that makes possible to access the app directly using localhost and a local port instead of going through an http tunnel.
- Updated dependencies [e89dfa81]
  - @shopify/cli-kit@3.3.3

## 3.3.2

### Patch Changes

- @shopify/cli-kit@3.3.2

## 3.3.1

### Patch Changes

- @shopify/cli-kit@3.3.1

## 3.3.0

### Minor Changes

- f7708fcc: Replace fastify/http-proxy with node-http-proxy to support Node < 17

### Patch Changes

- Updated dependencies [f7708fcc]
  - @shopify/cli-kit@3.3.0

## 3.2.0

### Minor Changes

- 9c10736a: Stop using semantic versioning for @shopify/cli-kit and pin the version from all the dependent packages

### Patch Changes

- 86b04187: Exit without error message on deliberate user actions
- Updated dependencies [86b04187]
  - @shopify/cli-kit@3.2.0

## 3.1.0

### Patch Changes

- de8ee02d: [FEATURE] Add query to fetch shop by domain
- 45f0f0b9: Bump theme-check version
- Updated dependencies [740f73ac]
- Updated dependencies [d17770e8]
- Updated dependencies [d17770e8]
- Updated dependencies [de8ee02d]
- Updated dependencies [45f0f0b9]
  - @shopify/cli-kit@3.1.0

## 3.0.27

### Patch Changes

- Updated dependencies [e2e8b4db]
  - @shopify/cli-kit@3.0.27

## 3.0.26

### Patch Changes

- 022a4e24: Internal: build cli-kit using tsc instead of rollup+esbuild
- e81e52b1: Report error events
- 87f7843f: Show validation errors when deploying UI extensions
- 0a9dbc63: Fix path outputs for the working directory
- 2d8e4458: Log Listr task titles to logfile
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

- 2a666db7: Only include the "do you have access" next step if the organization id is passed
- 1b735810: Add ping to the websocket proxy to keep connections alive
- 0c3aba7d: Make @shopify/cli-kit a dependency instead of a peerDependency
- 025be76b: Run extensions server only when there are UI extensions
- 3360289d: Compile function module before deploying function to the registry
- Updated dependencies [a6ea9c8d]
- Updated dependencies [822d0fd3]
- Updated dependencies [bf8137c2]
- Updated dependencies [e650b499]
- Updated dependencies [3360289d]
- Updated dependencies [2a666db7]
  - @shopify/cli-kit@3.0.25

## 3.0.24

### Patch Changes

- 73ca5002: Automatically add the @shopify/web-pixels-extension dependency when scaffolding a web pixel extension
- 687c2835: Check before "Next steps in Shopify Partners"

## 3.0.23

## 3.0.22

### Patch Changes

- 8916cac2: Tweak post-scaffolding line breaks and indents
- 7f32e9ac: Fix race-condition when the organization can't be found and improve the error message
- c17e5b56: Add flag to override tunnel URL

## 3.0.21

## 3.0.20

### Patch Changes

- 5d422ea9: - Use a shallow repo clone to speed up cloning template repos
  - Display progress of git clones
- 7cccc42d: Update checkout ui extensions dependency to ^0.17.0
- 742e70aa: Last version of human facing extension names
- a0b066ca: Fix checking against the wrong list of extension types

## 3.0.19

### Patch Changes

- d73ea66a: Ask to reuse dev config if it's the first time deploying
- 3015a702: removed version from web_pixel_extension payload
- f5a73830: Abort create-app if a directory with the same name already exists
- 8e9e3486: Validate all extension types simultaneously
- 45866b2a: include apiVersion from toml when deploying a function
- 57cc65b1: Reverted Human-facing extension type names
- 9bf1af7c: Set react version to ^17.0.0 when scaffolding extensions
- 5f3d2fc8: update to extensions version v0.20.1
- cc4c0151: Simplify query complexity when fetching organizations
- 8548577c: Pass the environment variables in .env to the Go binary

## 3.0.18

### Patch Changes

- d23daa09: Sending a buffer instead of a string when uploading the function .wasm file
- 1b3a3a45: Human-facing extension type names
- 84438079: Add logging to file and command to access logs
- 0426f958: Remove POS UI extension type from scaffold
- fd10fc01: Add a confirmation prompt before opening the browser to continue auth
- 8ef8a3ab: Add deployment of theme extensions
- 0243890b: Fix function appBridge variables not being set during GraphQL mutation
- fa518a0d: Report events with the analytics helper from cli-kit
- cb1caa7c: Improve create app error message when using an invalid template flag value

## 3.0.17

### Patch Changes

- 336ae141: Fix analytics report for dev command
- 1400291a: Include input.query when uploading functions
- e982e9d3: Fix web pixel extension's URL in the "next steps" section in the deploy's output
- 94cea939: Fix some issues with surface/renderer in extensions server
- e982e9d3: Use the right FQDN in the URLs that are output in the next steps section of the deploy command
- e982e9d3: Ensure that identifiers are persisted in the .env file on failing deployments
- c7918e9e: Fix renderer version for web_pixel (and other configs)
- e982e9d3: Not include the next steps section if there are no next steps in deployment
- bc7dd282: Deploy functions sequentially to avoid API rate issues
- e982e9d3: Throw an error if the API key in the .env is invalid or points to an app that the user doesn't have access to
- df0d0347: Use inquirer with SHOPIFY_USE_INQUIRER
- a8f5b806: Remove React template option for web pixel extension
- 6657a57c: Stop passing configuration when deploying a function

## 3.0.16

### Patch Changes

- eb915dee: Loose version requirements to help dependency managers dedupe dependencies
- d532467d: Use the exact renderer version for extensions instead of a relative one
- 3f6c188b: Remove the next steps message for functions
- a750e67c: Update app info format to --json not --format=json
- a750e67c: Improve extension scaffolding copy
- 2ecbff43: Fix issues with windows being reported as unsuported platform
- a750e67c: Improve dependency upgrade messages to leverage new shopify upgrade command

## 3.0.15

### Patch Changes

- 99378ca0: Push dependency manager detection into cli-kit
- af64c637: Improve deploy copies including next steps
- 99378ca0: Add command to upgrade all project types
- 6989f388: Fix the extension configuration sent to dev/deploy to match the required fields
- Updated dependencies [c3b711ec]
- Updated dependencies [99378ca0]
  - @shopify/cli-kit@3.0.15

## 3.0.14

### Patch Changes

- 4be13097: Show all output URLs before the build process
- 788fedb1: Fix binary the extensions' binary download on Windows OSs
- 9fa8e79b: Add two new flags: subscription-product-url and checkout-cart-url as resource urls
- 8f82bd36: Remove unneeded callbacks while updating Partners URLs
- 9d9a1d97: Add --output-web-env flag to deploy to output the web environment
- Updated dependencies [8f82bd36]
- Updated dependencies [ae3823c8]
- Updated dependencies [8f82bd36]
- Updated dependencies [c383ed42]
  - @shopify/cli-kit@3.0.14

## 3.0.13

### Patch Changes

- 29669e3b: Remove use_msgpack flag from functions metadata
- 3a76edd8: Remove unused use_msgpack metadata field for functions
- 604d7d97: Fix some unhandled promises and errors
- 5a46a903: Keep shipping and payment functions as internal
- 3e7815fe: Re-use functions' ids across deploys
- Updated dependencies [604d7d97]
  - @shopify/cli-kit@3.0.13

## 3.0.12

### Patch Changes

- 8c690cca: Provide haikunator-style default names for apps and extensions
- 783a3714: Support Typescript UI extensions
- 8178cf2d: Add Shopify POS extension type
- 504b502a: Accept a flag to specify extension template for scaffolding, React or vanilla JS
- cb8e2c25: Copy improvements
- 7ad2b9fa: Fix the extension point name used for discounts
- 11d09f7f: Encourage upgrading if not up-to-date
- 783a3714: Add support for dev'ing Typescript extensions
- 9ee5feb5: Rename SHOPIFY_APP_API_KEY to SHOPIFY_API_KEY for consistency with Shopify CLI 2.0
- 687bd47b: Do not include the extension name in the extension URL
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

- 279cfc37: Removed the --tunnel flag from the dev command
- d79cdf1b: Not throw an error when generating the ids if the app doesn't have UI or theme extensions
- 1f10093b: Fix a bug that arises when we try to colorize the JSON response that we get from the API
- 3de7c180: Don't store app metadata in development
- Updated dependencies [1f10093b]
  - @shopify/cli-kit@3.0.11

## 3.0.10

### Patch Changes

- Include the host header in all the proxied requests
  - @shopify/cli-kit@3.0.10

## 3.0.9

### Patch Changes

- 3024598f: Pass the signal instance to make sure we kill the processes if one of them fails
- 3024598f: Only load the web configuration files from the web directory
- 3024598f: Pass environment variables to the frontend process too
  - @shopify/cli-kit@3.0.9

## 3.0.8

### Patch Changes

- Pass the PORT variable when running the frontend web side
  - @shopify/cli-kit@3.0.8

## 3.0.7

### Patch Changes

- 63e2fb89: Don't assume the location of the source file for extensions
- f26960e0: Extension types selector grouped by category
- 3b98649b: Don't output the web/ link if the app doesn't have web/
- 8fc77262: Don't assume web is present when dev'ing an app
- a8245232: Make web/ optional in apps
- Updated dependencies [8de7f95d]
  - @shopify/cli-kit@3.0.7

## 3.0.6

### Patch Changes

- 27677c2d: Added support for apps_next beta flag when creating apps
- dfd212f6: Add --reset flag to deploy
- Updated dependencies [1e4d024e]
- Updated dependencies [27677c2d]
  - @shopify/cli-kit@3.0.6

## 3.0.5

### Patch Changes

- f6d0e62f: Fix issue when dev'ing extensions with spaces/uppercase in name
  - @shopify/cli-kit@3.0.5

## 3.0.4

### Patch Changes

- Fix create-app not using 3.0.3
- Updated dependencies
  - @shopify/cli-kit@3.0.4

## 3.0.2

### Patch Changes

- 91e25520: Fix an issue where CLI checks for a Ruby env even if not needed (no theme extension present)
- 79cb9f72: Add manual matching for extensions IDs when deploying
- 7f783134: Rename Beacon to WebPixel and add deploy configuration

## 3.0.1

### Patch Changes

- 9d324502: Add locale configuration to checkout_ui_extensions
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

- 19e343ea: Add support to dev checkout_ui_extension
- eaf69a92: Improve app info output contents and copy
- Updated dependencies [19e343ea]
- Updated dependencies [eaf69a92]
- Updated dependencies [5ed34580]
  - @shopify/cli-kit@2.0.15

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
