# Log

Add entries in chronological order. Preserve earlier entries; correct mistakes with a dated note.

## 2026-10-07 — Nightly installed with clean global resolution

- **Change or action:** Activated Node 24.15.0, inspected global CLI resolution, removed npm-global `@shopify/cli` 4.8.5, installed the newly published `nightly` dist-tag through pnpm using the public npm registry override, refreshed zsh command resolution, and checked both global package managers.
- **Observation:** Before mutation, `shopify` resolved only to the NVM npm-global 4.8.5 executable and no pnpm-global CLI existed. The stable uninstall removed 49 packages. pnpm installed `@shopify/cli@0.0.0-nightly-20261007061909`; `shopify` now resolves only to `/Users/durga/Library/pnpm/shopify` and reports that exact nightly version. npm-global `@shopify/cli` is empty. pnpm warned about deprecated `boolean@3.2.0`, a newer pnpm release, and an ignored `esbuild@0.28.1` build script. npm also repeated the existing `tokenHelper` configuration warning during uninstall/listing.
- **Interpretation:** Version attribution is clean and the intended nightly is installed, avoiding the duplicate-global hazard from the stable run. The ignored esbuild install script is a functional-preflight risk to test before creating remote resources; it is not yet evidence of a CLI failure because `shopify version` succeeds.
- **Evidence:** Bounded local install, path, version, and global-package output on 2026-10-07; [QA flow](https://docs.google.com/document/d/1XX6QnS6kKZTT1shcCZVcso74VWn-Ui4V2IASenHHi1E/edit?tab=t.0).
- **Next step:** Run a local functional preflight (`commands`/help and environment checks), then create the fresh nightly app workspace if the CLI remains healthy.

## 2026-10-07 — Nightly functional preflight passes

- **Change or action:** Reverified the sole resolved nightly executable and environment, loaded the command tree plus app-init/extension/function/Hydrogen help, confirmed the fresh app target is absent, and directly exercised the pnpm-global `esbuild@0.28.1` package with a JavaScript transform.
- **Observation:** `shopify` still resolves only to `/Users/durga/Library/pnpm/shopify` and reports `0.0.0-nightly-20261007061909`. Node is 24.15.0, npm 11.12.1, pnpm 10.28.0, macOS 26.5.1 arm64, and Git 2.55.0-shop-ba0d22fa. All inspected command/help surfaces exited successfully. The exact pnpm-global esbuild 0.28.1 dependency loaded and transformed JavaScript despite pnpm's ignored-build-script warning. `/Users/durga/cli-release-qa/macos-nightly-4.9.0/cli-qa-mac-490-1007` is absent.
- **Interpretation:** The nightly installation is functionally usable and cleanly attributed. The ignored esbuild postinstall warning is non-blocking on this machine because the platform binary is present and operational; preserve the install warning for cross-OS comparison.
- **Evidence:** Bounded local path/version/help/esbuild checks on 2026-10-07; notebook validation found all five expected files and no template placeholders.
- **Next step:** With explicit confirmation of the new temporary app and remote side effects, initialize the fresh React Router TypeScript app for the nightly run.

## 2026-10-07 — Nightly React Router app initialization passes

- **Change or action:** Ran the nightly `app init` non-interactively for `cli-qa-mac-490-1007` in organization `150256644` with React Router TypeScript and pnpm, using the human auth alias and a fresh absent target path.
- **Observation:** Template download, Liquid parsing, package update, dependency installation, cleanup, Git initialization, and remote app creation completed successfully. The 465 MiB generated project pins project-local `@shopify/cli` to the exact nightly version, and both global `shopify version` and `pnpm shopify version` report `0.0.0-nightly-20261007061909`. No project build approvals are pending. The generated app config still includes `build.include_config_on_deploy = true`, and `.shopify/project.json` is initially empty.
- **Interpretation:** The nightly app-init stage passes cleanly on the first attempt. The stable run's stale organization lookup issue does not reproduce after the cleaned cache/single-global preflight. The stale `include_config_on_deploy` generation behavior persists into this nightly and should be checked again at deploy.
- **Evidence:** Non-sensitive CLI success output and bounded local project/config/package inspection on 2026-10-07; Client ID was intentionally not recorded.
- **Next step:** Inspect nightly admin-action flavor help, then generate the required non-theme extensions and compare each result with stable.

## 2026-10-07 — Three extensions pass; admin-action flavor mismatch persists

- **Change or action:** Inspected nightly extension help, then ran separate generation commands for an admin action using the advertised `react` flavor, a TypeScript discount function, a Flow action, and a TypeScript Web Pixel.
- **Observation:** Nightly help now exposes `--json-schema` but still lists flavors as `vanilla-js|react|typescript|typescript-react|wasm|rust`, without `preact`. The non-interactive admin-action probe exited 1 because the live template specification expected only `preact`. Discount generation, dependency/type setup, Flow action generation, and Web Pixel generation all succeeded, creating `qa-discount`, `qa-flow-action`, and `qa-web-pixel`.
- **Interpretation:** The stable admin-action contract mismatch is unchanged in this nightly: static help cannot express the server-required flavor. The documented interactive generator still needs testing; the other required non-theme extension stages pass.
- **Evidence:** Bounded CLI help and four separately labelled generator outcomes on 2026-10-07.
- **Next step:** With explicit confirmation, run the admin-action generator interactively without a flavor and select its offered Preact template.

## 2026-10-07 — Flavorless admin-action generation passes without a prompt

- **Change or action:** Ran the admin-action generator in a real TTY with no `--flavor`, targeting `qa-admin-action`.
- **Observation:** The nightly detected the sole live Preact option, generated the extension, and exited 0 without displaying a flavor selector. The scaffold uses Preact and `@shopify/ui-extensions` 2026.7.x and matches the stable generated source shape. Project size is 534 MiB. pnpm now reports `core-js` as an automatically ignored project build script.
- **Interpretation:** The documented flavorless path passes and is slightly smoother than stable, which presented an interactive Preact choice. However, the non-interactive help/flag contract remains broken because `preact` still cannot be named through the advertised enum. The ignored core-js postinstall is likely non-functional but should be retained as a warning comparison point.
- **Evidence:** TTY exit status, generated files/package metadata, and `pnpm ignored-builds` output on 2026-10-07.
- **Next step:** Start nightly `app dev` on the development store, complete the storefront-password gate privately, and verify build/preview readiness.

## 2026-10-07 — Nightly app dev reaches ready state

- **Change or action:** Started nightly `app dev` in detached tmux session `cli-qa-nightly-app-dev` for `durga-test-store.myshopify.com` with the human auth alias and no inherited automation/client-ID variables.
- **Observation:** Organization, app, store, and URL-update settings resolved correctly. No storefront-password prompt appeared, consistent with reuse of the previously stored development-store context. The proxy, GraphiQL, React Router server, admin action, Web Pixel, and discount function started/built; the Flow action configuration was accepted; access scopes were auto-granted; the uninstall webhook delivered after one transient startup retry; and CLI reached `Ready, watching for changes in your app`. The same npm `auto-install-peers`/`tokenHelper` and React Router future-flag warnings appeared as stable, while Prisma advertised 8.0.0-rc.21 rather than rc.20.
- **Interpretation:** The required nightly app-dev startup/build stage passes with no new blocker. Browser confirmation of preview rendering, ordering, and Connected status remains.
- **Evidence:** Redacted live tmux output and bounded process state on 2026-10-07; transient preview/GraphiQL URLs were not recorded.
- **Next step:** Open the app preview and verify the app loads, is the first Dev Console preview, and is green/Connected.

## 2026-10-07 — Nightly Dev Console browser checks pass

- **Change or action:** Opened the nightly app preview from the running CLI and inspected it in the development store's Dev Console.
- **Observation:** The app loaded without an error. `cli-qa-mac-490-1007` appeared as the first development preview and showed a green Connected status.
- **Interpretation:** The nightly app-preview launch, Dev Console ordering, and live connection checks pass, matching stable 4.8.5.
- **Evidence:** User-observed browser results while the nightly app-dev process remained ready on 2026-10-07.
- **Next step:** Open the nightly admin action against an existing suitable product, confirm the modal renders, then verify open-modal hot reload.

## 2026-10-07 — Nightly admin-action hot-reload probe triggered

- **Change or action:** Opened the nightly admin action against an existing product and left its correctly rendered baseline modal open. Added the validated message `CLI 4.9.0 nightly hot reload check` to the 2026-07 `admin.product-details.action.render` source without restarting app dev.
- **Observation:** The revised source passed Admin UI extension component validation. The running nightly rebundled `qa-admin-action` successfully in 19 ms, reported `Extension changed`, reran the product-context extension code, and remained Ready without an error.
- **Interpretation:** Nightly file watching, incremental bundling, and runtime rerender have reacted correctly. User confirmation that the already-open modal visibly changed is still required to complete the end-to-end check.
- **Evidence:** User-observed baseline modal, validated local source, and redacted tmux output on 2026-10-07; product identifiers were intentionally omitted.
- **Next step:** Confirm whether the open modal now displays `CLI 4.9.0 nightly hot reload check` without being closed or reopened.

## 2026-10-07 — Nightly admin-action visible hot reload passes

- **Change or action:** Observed the still-open modal after the source edit, then removed the temporary marker and revalidated the restored generated source.
- **Observation:** The modal changed automatically to `CLI 4.9.0 nightly hot reload check` without user interaction, closing, or reopening. The restored source also validated, rebuilt in 17 ms, reported `Extension changed`, rerendered, and left app dev Ready.
- **Interpretation:** The nightly admin-action flow matches stable end to end and improves incremental build time in this observation (19 ms versus stable's 32 ms), although a single timing sample is not a performance claim. Temporary QA instrumentation has been removed.
- **Evidence:** User visual confirmation, two successful component validations, and correlated redacted CLI rebuild events on 2026-10-07.
- **Next step:** Generate a second Flow action while app dev remains active and verify automatic Dev Console discovery without restart or refresh.

## 2026-10-07 — Nightly live-added Flow action generated and detected

- **Change or action:** Generated a second Flow action named `qa-live-added-flow` while the original nightly app-dev process remained active.
- **Observation:** Generation succeeded and created its extension config. Without restarting app dev, the running nightly reported `qa-live-added-flow │ Extension created` and remained `Ready, watching for changes in your app`.
- **Interpretation:** Nightly live project discovery passes at the CLI level and matches stable. Browser confirmation of automatic Dev Console rendering is still required.
- **Evidence:** Successful generator output, bounded generated config, and redacted live tmux output on 2026-10-07.
- **Next step:** Confirm whether `qa-live-added-flow` appears automatically in the already-open Dev Console without a browser refresh.

## 2026-10-07 — Nightly dynamic Dev Console discovery passes

- **Change or action:** Observed the already-open Dev Console after the nightly detected `qa-live-added-flow`.
- **Observation:** The new Flow Action appeared automatically without browser refresh or app-dev restart.
- **Interpretation:** The nightly add-an-extension-during-development check passes end to end and matches stable 4.8.5.
- **Evidence:** User-observed browser result correlated with the CLI `Extension created` event on 2026-10-07.
- **Next step:** Open nightly GraphiQL, execute `query { shop { name } }`, then run the same read-only query through nightly `shopify app execute`.

## 2026-10-07 — Nightly GraphiQL query passes

- **Change or action:** Opened GraphiQL from the running nightly and executed the read-only shop-name query against the development store.
- **Observation:** The query completed successfully and returned the expected development-store result with no reported GraphQL error.
- **Interpretation:** Nightly GraphiQL launch, Admin API authentication, and query execution pass, matching stable.
- **Evidence:** User-observed GraphiQL result on 2026-10-07; no token or transient URL was recorded.
- **Next step:** Execute the same query through nightly `shopify app execute` using explicit store, auth alias, and API version.

## 2026-10-07 — Nightly CLI Admin query passes

- **Change or action:** Ran nightly `shopify app execute` with the same shop-name query, explicit Admin API version 2026-07, development-store domain, and human auth alias.
- **Observation:** Authentication and execution succeeded, returning `shop.name` as `durga-test-store-dev`, matching GraphiQL and stable.
- **Interpretation:** The nightly CLI GraphQL path passes with no regression.
- **Evidence:** Non-sensitive CLI result on 2026-10-07.
- **Next step:** Stop app dev with `q`, verify the retained preview is disconnected, then clean it and verify it is hidden.

## 2026-10-07 — Nightly app dev stops cleanly with a new app-logs warning

- **Change or action:** Sent `q` to the running nightly app-dev TTY after completing browser and GraphQL checks.
- **Observation:** Before shutdown, the nightly emitted repeated `app-logs │ Error while polling app logs` messages with five-second retries for approximately one minute; app development otherwise remained functional. The process then exited 0, reported that the development preview remains available until `app dev clean`, and closed the local GraphiQL listener.
- **Interpretation:** Local shutdown and retained-preview behavior pass. Repeated app-log polling errors were not observed in the stable run and are a new non-blocking nightly warning requiring comparison/reproduction; the current output does not expose a cause.
- **Evidence:** Redacted tmux output, clean exit status, and post-stop listener check on 2026-10-07.
- **Next step:** Confirm the preview remains listed without a green Connected indicator.

## 2026-10-07 — Nightly retained preview is disconnected

- **Change or action:** Inspected the Dev Console after the nightly app-dev process exited.
- **Observation:** The nightly preview remained listed and showed the expected disconnected state without the green Connected indicator.
- **Interpretation:** Nightly preview retention/disconnection behavior passes and matches stable.
- **Evidence:** Clean CLI exit plus user-observed Dev Console state on 2026-10-07.
- **Next step:** Run nightly `app dev clean` for the temporary app/store and verify the disconnected preview disappears.

## 2026-10-07 — Nightly development-preview cleanup command passes

- **Change or action:** Ran nightly `shopify app dev clean` for `cli-qa-mac-490-1007` on the development store using the human auth alias.
- **Observation:** The command exited successfully with `Dev preview stopped` and reported that the app's active version was restored.
- **Interpretation:** The nightly cleanup operation passes at the CLI level and matches stable. Browser confirmation that the preview is hidden remains.
- **Evidence:** Non-sensitive CLI success output on 2026-10-07.
- **Next step:** Refresh/reopen Dev Console and confirm the nightly development preview is no longer visible.

## 2026-10-07 — Nightly preview is hidden after cleanup

- **Change or action:** Refreshed/reopened Dev Console after nightly `app dev clean`.
- **Observation:** The nightly development preview was no longer visible.
- **Interpretation:** Preview cleanup passes end to end and matches stable.
- **Evidence:** CLI cleanup success plus user-observed Dev Console result on 2026-10-07.
- **Next step:** Build and locally run the nightly TypeScript discount function with the documented fixture.

## 2026-10-07 — Nightly discount function build and run pass

- **Change or action:** From `extensions/qa-discount`, ran nightly `shopify app function build`, then piped the QA document's synthetic cart/discount fixture into `shopify app function run`.
- **Observation:** GraphQL type generation, JavaScript bundling, and Javy compilation completed successfully. The local run returned the same order and product discount operations, resource limits, and benchmark shape as stable with no error.
- **Interpretation:** Nightly function compilation and local Wasm execution pass with no observed regression.
- **Evidence:** Non-sensitive local CLI build/run output on 2026-10-07.
- **Next step:** Deploy and release nightly app version `v1`, observe whether the stale config field is removed, then verify `v1` is active.

## 2026-10-07 — Nightly app version v1 deploy and release pass

- **Change or action:** Ran nightly `shopify app deploy --version=v1 --allow-updates` for `cli-qa-mac-490-1007` using the human auth alias.
- **Observation:** Before deployment, the nightly again removed generated `build.include_config_on_deploy` as unsupported. It bundled the admin action and Web Pixel, built GraphQL types and the discount function, ran validation, released `v1`, and exited successfully.
- **Interpretation:** Nightly build/deploy/release passes and matches stable. The internal generate-then-remove inconsistency for `include_config_on_deploy` persists unchanged.
- **Evidence:** Non-sensitive deploy output and bounded local config inspection on 2026-10-07; the returned Dashboard URL was intentionally not copied into this notebook.
- **Next step:** Check whether nightly supports versions-list JSON-schema discovery, then query the app versions and confirm `v1` is active.

## 2026-10-07 — Versions-list JSON-schema discovery is fixed in nightly

- **Change or action:** Ran local `shopify app versions list --json-schema` before the authenticated version query.
- **Observation:** Unlike stable 4.8.5, the nightly accepted the flag and emitted 8,402 bytes of valid JSON Schema with the expected top-level schema structure.
- **Interpretation:** The stable automation-capability finding is resolved in this nightly.
- **Evidence:** Locally parsed nightly JSON-schema output on 2026-10-07; no remote request or mutation occurred.
- **Next step:** With explicit confirmation, run authenticated `app versions list --json` and verify active `v1`.

## 2026-10-07 — Nightly released version v1 is active

- **Change or action:** Queried the nightly app's deployed versions with JSON output and the human auth alias.
- **Observation:** The result listed `v1` first with status `active`, plus one older auto-generated inactive version from the app-development lifecycle.
- **Interpretation:** Nightly deploy/version verification passes and matches stable.
- **Evidence:** Authenticated read-only CLI result on 2026-10-07; user and version GIDs were intentionally omitted.
- **Next step:** Create and link a second temporary app/config, explicitly deploy to it, and independently verify its active version.

## 2026-10-07 — Nightly second-app creation and config link pass

- **Change or action:** Ran nightly interactive `app config link`, selected `durga-test-store`, created `cli-qa-mac-link-490-1007`, and targeted separate file `shopify.app.linked.toml`.
- **Observation:** The command exited 0, created the remote app, preserved the original config, wrote the linked config, and selected it as default. The linked config again contains generated `build.include_config_on_deploy = true`.
- **Interpretation:** Nightly config-link/new-app behavior passes, but the stable generate-then-remove inconsistency persists unchanged before linked deployment.
- **Evidence:** Redacted TTY success output and bounded linked-config inspection on 2026-10-07; Client ID was intentionally omitted.
- **Next step:** Explicitly deploy/release `v1` with `--config=linked`, then verify the linked app version independently.

## 2026-10-07 — Nightly linked-app deploy and release pass

- **Change or action:** Ran nightly `app deploy --config=linked --version=v1 --allow-updates` using the linked config and human auth alias.
- **Observation:** CLI explicitly identified `shopify.app.linked.toml` and `cli-qa-mac-link-490-1007`, removed `include_config_on_deploy` as unsupported, built and validated all non-theme extensions/function, released `v1`, and exited successfully.
- **Interpretation:** Nightly redeploy-to-a-new-app passes and explicit config targeting is correct. The stale-field generate/remove cycle is reproduced for both nightly deploy paths.
- **Evidence:** Non-sensitive deploy output and local linked-config inspection on 2026-10-07; Dashboard URL was intentionally omitted.
- **Next step:** Query versions with explicit `--config=linked` and confirm `v1` is active on the second app.

## 2026-10-07 — Nightly linked app v1 is verified active

- **Change or action:** Queried linked-app versions with nightly `app versions list --config=linked --json`.
- **Observation:** The result listed `v1` first with status `active`, plus the linked app's initial auto-generated inactive version.
- **Interpretation:** Nightly config-link/redeploy verification passes end to end and matches stable.
- **Evidence:** Authenticated read-only CLI result on 2026-10-07; user/version GIDs were intentionally omitted.
- **Next step:** Initialize a fresh Hydrogen storefront with nightly CLI defaults, compare generated local CLI resolution with stable, then build and run it through the verified global nightly.

## 2026-10-07 — Nightly Hydrogen initialization passes with two persistent findings

- **Change or action:** Ran nightly interactive `hydrogen init` into fresh `cli-qa-hydrogen-mac-490` and accepted the displayed defaults: mock.shop, JavaScript, Tailwind v4, npm, and subfolder markets.
- **Observation:** Initialization exited 0, installed dependencies, created a clean Git repository, and produced a 584 MiB Hydrogen 2026.4.5 project. Before prompting, nightly displayed stable 4.8.5 as an `Upgrade available` from `0.0.0-nightly-20261007061909`. The generated project still pins project-local `@shopify/cli` 3.93.2; global resolution remains the intended nightly. MiniOxygen moved from stable's 4.2.2 to 4.2.3. The existing global `h2` alias prevented a repeat alias prompt.
- **Interpretation:** Hydrogen scaffolding passes, but both the misleading nightly-to-stable upgrade notice and generated local/global CLI divergence are release-candidate findings. The version divergence is unchanged from stable; the upgrade notice is nightly-specific.
- **Evidence:** Redacted TTY output, clean Git state, and bounded package/version/environment-name inspection on 2026-10-07; `.env` values were not read.
- **Next step:** Build with the verified global nightly, compare warnings/artifacts, then run the storefront locally.

## 2026-10-07 — Nightly Hydrogen production build passes

- **Change or action:** From the Hydrogen project, verified `/Users/durga/Library/pnpm/shopify` and the exact nightly version, then ran direct global `shopify hydrogen build` instead of the npm script that would resolve local CLI 3.93.2.
- **Observation:** Vite 8.3.2 successfully built client and Oxygen server bundles. The same `envFile`, React Router v8 future-flag, and `transformWithEsbuild` deprecation warnings appeared as stable. Production artifacts and the bundle report were created under `dist/`.
- **Interpretation:** Nightly Hydrogen build passes with no blocking regression. The build warning profile matches stable; the invoking bundled Vite version differs from stable's observed 8.3.3 and should be recorded, not treated as a performance/result regression.
- **Evidence:** Verified global path/version and successful bounded build output on 2026-10-07.
- **Next step:** Start global-nightly `shopify hydrogen dev`, open the localhost storefront, verify mock.shop content visually, and stop the server.

## 2026-10-07 — Nightly Hydrogen dev server and HTTP storefront checks pass

- **Change or action:** Started global-nightly `shopify hydrogen dev` in detached tmux session `cli-qa-nightly-hydrogen-dev`, requested the localhost home page, and opened it in the user's browser.
- **Observation:** MiniOxygen listened on localhost port 3000 with only the `SESSION_SECRET` variable name reported as injected. The home page returned HTTP 200 with no error-page signature, title `Hydrogen | Home`, mock.shop navigation, and the expected products Hoodie, Beanie, High Top Sneakers, and Clear Sunnies. Startup repeated the stable `envFile` and React Router future-flag warnings.
- **Interpretation:** Nightly Hydrogen local dev and server-rendered mock.shop checks pass technically and match stable. Final human visual confirmation remains before shutdown.
- **Evidence:** Redacted live CLI output and bounded HTTP response inspection on 2026-10-07; no environment values were read or recorded.
- **Next step:** Confirm the storefront is visibly rendered, then stop the local server and conclude the macOS nightly comparison.

## 2026-10-07 — Nightly Hydrogen visual check passes and server stops

- **Change or action:** Visually inspected the browser-opened nightly Hydrogen storefront, then intentionally stopped the tmux-hosted dev server with Ctrl-C.
- **Observation:** The user confirmed the storefront was visible and matched the technical evidence. An additional product route returned HTTP 200. After Ctrl-C, the process ended and localhost port 3000 closed. The signal-driven pane status was 1, matching the stable intentional shutdown behavior.
- **Interpretation:** Nightly Hydrogen init/build/dev/browser flow passes end to end with no blocking regression.
- **Evidence:** User visual confirmation, HTTP/render logs, and post-stop listener check on 2026-10-07.
- **Next step:** Conclude the macOS nightly comparison, preserve candidate findings, then continue Linux/Windows non-theme QA.

## 2026-10-07 — macOS nightly comparison concluded

- **Change or action:** Reviewed every planned non-theme macOS checkpoint and compared it with the concluded stable 4.8.5 baseline.
- **Observation:** Every in-scope required nightly stage reached its expected end state: clean install/preflight, app init, extension generation, app dev/Dev Console, admin-action hot reload, live extension discovery, GraphiQL/CLI query, preview cleanup, function build/run, initial and linked-app deploy/version verification, and Hydrogen init/build/dev/browser rendering. No blocking nightly-only regression remained.
- **Interpretation:** The intended 4.9.0 nightly passes macOS non-theme QA. Release-wide GO still depends on Linux, Windows, and delegated theme coverage. New nightly warnings/findings remain suitable for follow-up but did not invalidate the macOS result.
- **Evidence:** This chronological log and the stable-versus-nightly summary in `RESULTS.md`.
- **Next step:** Run Linux and Windows in parallel using the 4.9.0 command handoff, then combine all platform and delegated-theme results for the release decision.

## 2026-10-07 — Candidate identity correction supersedes macOS GO

- **Change or action:** After Linux installed a later package from `@nightly`, queried npm publication metadata and the manually dispatched release workflow timeline.
- **Observation:** This macOS run used daily nightly `0.0.0-nightly-20261007061909`, published at 06:30:47Z. The manual Release workflow started at 17:20:44Z, completed at 17:23:58Z, and npm published candidate `0.0.0-nightly-20261007172129` at 17:33:07Z. The macOS install occurred before that publication/tag update became available.
- **Interpretation:** The functional run remains valid evidence for `061909`, but it cannot support a GO decision for the manually generated `172129` candidate. The earlier macOS GO conclusion is superseded; a full or appropriately risk-assessed macOS rerun on `172129` is required.
- **Evidence:** npm immutable publication times, current dist-tags, and [Shopify/cli workflow run 37658331851](https://github.com/Shopify/cli/actions/runs/37658331851).
- **Next step:** Install exact candidate `172129` on macOS and rerun candidate QA before the overall release decision.
