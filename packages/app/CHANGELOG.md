# @shopify/app

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
