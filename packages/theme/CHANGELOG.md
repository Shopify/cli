# @shopify/theme

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
