# Log

Add entries in chronological order. Preserve earlier entries; correct mistakes with a dated note.

## 2026-10-07 — Exact manual candidate installed with sole resolution

- **Change or action:** Replaced pnpm-global daily nightly `0.0.0-nightly-20261007061909` with immutable manual candidate `0.0.0-nightly-20261007172129` using the public npm registry override, refreshed zsh resolution, and checked pnpm/npm globals.
- **Observation:** pnpm replaced one package and reports only candidate `172129`; `shopify` resolves only to `/Users/durga/Library/pnpm/shopify` and reports the exact candidate. npm-global CLI remains empty. pnpm repeated the deprecated `boolean@3.2.0` and ignored `esbuild@0.28.1` build-script warnings; npm repeated the existing `tokenHelper` warning.
- **Interpretation:** Candidate attribution is clean. Install warnings match the prior nightly setup and require functional preflight, not automatic failure classification.
- **Evidence:** Bounded local install/path/version/global-package output on 2026-10-07 and [workflow run 37658331851](https://github.com/Shopify/cli/actions/runs/37658331851).
- **Next step:** Run local functional preflight and initialize the fresh candidate app if healthy.

## 2026-10-07 — Exact candidate functional preflight passes

- **Change or action:** Reverified sole candidate resolution and environment, loaded command/help surfaces, exercised exact pnpm-global esbuild 0.28.1 with a JavaScript transform, and checked the fresh app target.
- **Observation:** Candidate `172129`, Node 24.15.0, npm 11.12.1, pnpm 10.28.0, Git 2.55.0-shop-ba0d22fa, and macOS 26.5.1 arm64 are active. All command/help checks passed, esbuild transformed successfully, and `/Users/durga/cli-release-qa/macos-candidate-4.9.0/cli-qa-mac-490-1007b` is absent.
- **Interpretation:** The candidate installation is healthy and cleanly attributed; remote product-flow QA can begin.
- **Evidence:** Bounded local path/version/help/native-dependency checks on 2026-10-07; notebook validation found all expected files and no placeholders.
- **Next step:** With explicit confirmation, initialize fresh React Router app `cli-qa-mac-490-1007b` against the development organization.

## 2026-10-07 — Candidate React Router app initialization passes

- **Change or action:** Ran exact-candidate `app init` non-interactively for `cli-qa-mac-490-1007b` with React Router TypeScript, pnpm, organization `150256644`, and the human auth alias.
- **Observation:** Template download/preparation, dependency installation, cleanup, Git initialization, and remote app creation completed successfully. The 465 MiB project pins project-local CLI to exact candidate `172129`; global and local versions match. No project build approvals are pending. The generated config still includes unsupported `include_config_on_deploy`, and project store context is initially empty.
- **Interpretation:** Candidate app initialization passes on the first attempt. The stale config-generation finding persists before deploy; no candidate-only init regression is visible.
- **Evidence:** Non-sensitive init output and bounded local project/package/config inspection on 2026-10-07.
- **Next step:** Inspect admin-action flavor help and generate required non-theme extensions.

## 2026-10-07 — Candidate reproduces Preact help mismatch; three extensions pass

- **Change or action:** Ran separate candidate generators for advertised `react` admin action, TypeScript discount function, Flow action, and TypeScript Web Pixel.
- **Observation:** The admin probe exited 1 because the live spec accepts only `preact`, which help still does not advertise. Discount, Flow, and Web Pixel generation completed successfully.
- **Interpretation:** The exact candidate reproduces the known admin-action help/live-spec mismatch. Other required non-theme extensions pass; flavorless admin generation remains.
- **Evidence:** Separately labelled command outcomes on 2026-10-07.
- **Next step:** Run flavorless admin-action generation in a real TTY and verify Preact scaffold creation.

## 2026-10-07 — Candidate flavorless admin-action generation passes

- **Change or action:** Ran candidate admin-action generation in a real TTY without `--flavor`.
- **Observation:** The command automatically selected the sole live Preact template, created `qa-admin-action`, and exited 0 without a selector prompt.
- **Interpretation:** The documented flavorless path passes and matches the pre-candidate behavior; only the explicit help/enum contract remains defective.
- **Evidence:** TTY success output and generated extension on 2026-10-07.
- **Next step:** Start candidate app dev, verify readiness and browser outcomes, then run hot reload/live-add/GraphQL checks.

## 2026-10-07 — Candidate app dev reaches ready; app-log polling error reproduces

- **Change or action:** Started exact-candidate app dev in detached tmux session `cli-qa-candidate-app-dev` against the development store with the human auth alias.
- **Observation:** App/store context resolved; React Router, proxy, GraphiQL, admin action, Web Pixel, discount function, Flow configuration, scopes, and webhook startup completed; CLI reached `Ready, watching for changes in your app`. Existing npm/React Router warnings persisted. `app-logs │ Error while polling app logs` began before Ready and retried every five seconds, reproducing the pre-candidate warning on the actual candidate.
- **Interpretation:** Candidate app-dev startup passes, but the repeated app-log polling failure is now a reproducible candidate finding rather than a one-off pre-candidate observation. Browser checks remain.
- **Evidence:** Redacted live tmux output on 2026-10-07.
- **Next step:** Open the candidate preview and verify load, first-position, and green Connected state.

## 2026-10-07 — Candidate Dev Console browser checks pass

- **Change or action:** Opened the exact-candidate app preview and inspected Dev Console.
- **Observation:** `cli-qa-mac-490-1007b` loaded without error, appeared first, and showed green Connected status.
- **Interpretation:** Candidate preview/browser connection behavior passes and matches both controls despite the background app-log polling warning.
- **Evidence:** User-observed browser result on 2026-10-07.
- **Next step:** Open the candidate admin action on an existing product, leave the modal open, and verify in-place source hot reload.

## 2026-10-07 — Candidate admin hot-reload probe triggered

- **Change or action:** Opened the correctly rendered candidate admin-action modal and left it open, then added validated message `CLI 4.9.0 candidate hot reload check` without restarting app dev.
- **Observation:** Component validation passed. Candidate rebuilt the admin action in 18 ms, reported `Extension changed`, reran product-context code, and remained Ready. App-log polling failures continued independently.
- **Interpretation:** Candidate file watching/bundling/runtime rerender passes technically; visible open-modal confirmation remains.
- **Evidence:** User baseline modal, validation result, and redacted tmux output on 2026-10-07; product IDs omitted.
- **Next step:** Confirm whether the open modal changed automatically to the candidate marker.

## 2026-10-07 — Candidate admin-action visible hot reload passes

- **Change or action:** Observed the still-open modal, then removed the temporary marker and revalidated the generated source.
- **Observation:** The modal updated automatically to `CLI 4.9.0 candidate hot reload check` without user interaction or reopening. Restored source also validates and rebuilds.
- **Interpretation:** Exact-candidate admin-action hot reload passes end to end, matching stable and pre-candidate controls. Temporary instrumentation is removed.
- **Evidence:** User visual confirmation and two successful component validations on 2026-10-07.
- **Next step:** Generate a second Flow action while app dev remains active and verify automatic Dev Console discovery.

## 2026-10-07 — Candidate live-added Flow action detected

- **Change or action:** Generated `qa-live-added-flow` while candidate app dev remained active.
- **Observation:** Generation succeeded; running candidate reported `Extension created` without restart and remained Ready. App-log polling failures continued every five seconds.
- **Interpretation:** Candidate live project discovery passes at the CLI level; browser confirmation remains. The polling failure is persistent throughout the session but has not broken required workflows.
- **Evidence:** Generator success and redacted tmux output on 2026-10-07.
- **Next step:** Confirm automatic appearance in the already-open Dev Console.

## 2026-10-07 — Candidate dynamic Dev Console discovery passes

- **Change or action:** Observed Dev Console after candidate CLI detected the live-added Flow action.
- **Observation:** `qa-live-added-flow` appeared automatically without browser refresh or app-dev restart.
- **Interpretation:** Candidate live extension discovery passes end to end, matching both controls.
- **Evidence:** User-observed browser result correlated with the CLI event on 2026-10-07.
- **Next step:** Run shop-name query in candidate GraphiQL, then through candidate `app execute`.

## 2026-10-07 — Candidate GraphiQL passes

- **Change or action:** Opened candidate GraphiQL and ran the shop-name query.
- **Observation:** The query returned the expected development store without GraphQL errors.
- **Interpretation:** Candidate GraphiQL/auth/query path passes and matches controls.
- **Evidence:** User-observed GraphiQL result on 2026-10-07.
- **Next step:** Run the same read-only query through candidate `shopify app execute`.

## 2026-10-07 — Candidate CLI Admin query passes

- **Change or action:** Ran candidate `app execute` with shop-name query, explicit API version/store/auth alias.
- **Observation:** Authentication and execution succeeded; result returned `durga-test-store-dev`.
- **Interpretation:** Candidate CLI query path passes and matches GraphiQL/controls.
- **Evidence:** Non-sensitive CLI result on 2026-10-07.
- **Next step:** Stop app dev, verify retained preview is disconnected, then clean and verify hidden.

## 2026-10-07 — Candidate app dev stops cleanly; polling error persists until shutdown

- **Change or action:** Sent `q` to candidate app-dev TTY.
- **Observation:** App-log polling errors continued through the session. Candidate exited 0, reported retained development preview, and stopped local processes.
- **Interpretation:** Shutdown/retention behavior passes; the polling error is persistent but non-blocking.
- **Evidence:** Redacted tmux output and exit status on 2026-10-07.
- **Next step:** Confirm retained preview is disconnected in Dev Console.

## 2026-10-07 — Candidate retained preview is disconnected

- **Change or action:** Inspected Dev Console after candidate app-dev exit.
- **Observation:** Preview remained listed without green Connected status.
- **Interpretation:** Candidate retained-preview/disconnect behavior passes and matches controls.
- **Evidence:** User-observed Dev Console state on 2026-10-07.
- **Next step:** Run candidate `app dev clean` and verify the preview disappears.

## 2026-10-07 — Scope clarification pauses cleanup for theme app extension check

- **Change or action:** Before executing the confirmed cleanup command, the user identified that `blocks/star_rating.liquid` had not been tested.
- **Observation:** No candidate `app dev clean` command was executed. The earlier scope excluded both standalone themes and theme app extensions based on the broad instruction that themes need not be checked. `blocks/star_rating.liquid` belongs to the app's theme app extension check, distinct from the delegated standalone `shopify theme ...` flow.
- **Interpretation:** Include the theme app extension generation/setup/Liquid hot-reload check now, while continuing to exclude standalone theme init/check/package/dev/push/list commands. Restart app dev after generating the extension, complete the browser check, then stop and clean once.
- **Evidence:** User scope clarification on 2026-10-07 and the candidate project, which currently has no theme app extension directory.
- **Next step:** With explicit confirmation, generate `qa-theme-extension`, restart app dev, set it up in the host theme, and verify `blocks/star_rating.liquid` hot reload.

## 2026-10-07 — Candidate theme app extension generation passes

- **Change or action:** Generated `qa-theme-extension` through the exact candidate after the scope clarification.
- **Observation:** Generation exited successfully and created the expected theme app extension scaffold including `blocks/star_rating.liquid`.
- **Interpretation:** Candidate theme app extension generation passes. App dev must restart to incorporate it into the retained preview before browser setup/hot reload.
- **Evidence:** CLI success output and generated file inspection on 2026-10-07.
- **Next step:** Restart candidate app dev, open the setup/preview links, save the Star Rating section, and leave local preview open for a Liquid hot-reload edit.

## 2026-10-07 — Candidate app dev restarts with theme preview ready

- **Change or action:** Restarted candidate app dev after generating the theme app extension.
- **Observation:** Candidate ran theme check, bundled `qa-theme-extension`, started its local preview on port 9293, rebuilt other app components, and reached Ready. The host-theme setup URL targets theme ID `191921127733`. App-log polling errors immediately reproduced and continue every five seconds.
- **Interpretation:** Candidate theme extension startup/check/bundle passes; browser setup and Liquid hot reload remain. Polling failure is independent and persistent across restarts.
- **Evidence:** Redacted tmux output and sanitized setup/preview link extraction on 2026-10-07.
- **Next step:** Add/save the candidate Star Rating section in the host theme, open localhost:9293, and leave it open for source edit.

## 2026-10-07 — Candidate theme Liquid hot-reload probe triggered

- **Change or action:** With the saved Star Rating section visible in the open local preview, added dynamic `{{ shop.name }}` immediately after the rendered stars in `blocks/star_rating.liquid`.
- **Observation:** The modified app-context Liquid passed validation. Candidate ran theme check, bundled the extension, reported `Extension changed`, and remained Ready. App-log polling errors continued independently.
- **Interpretation:** Candidate theme source watch/check/bundle reacts correctly. Visual confirmation that the already-open preview updated automatically to show the store name remains.
- **Evidence:** User-confirmed open preview, Liquid validation, and redacted tmux output on 2026-10-07.
- **Next step:** Confirm whether `durga-test-store-dev` appeared automatically next to the stars without refresh.

## 2026-10-07 — Candidate theme app extension visible hot reload passes

- **Change or action:** Observed the open local preview, then removed the temporary `shop.name` marker, revalidated the generated Liquid, and stopped app dev with `q`.
- **Observation:** `durga-test-store-dev` appeared automatically next to the stars without refresh. Restored Liquid validated and rebundled. App dev exited 0 and retained the preview as expected; app-log polling errors continued until shutdown.
- **Interpretation:** Candidate theme app extension generation/setup/theme-check/Liquid-hot-reload passes end to end. This completes the app-level theme extension requirement while standalone theme CLI remains delegated.
- **Evidence:** User visual confirmation, two Liquid validations, CLI rebuild events, and clean exit on 2026-10-07.
- **Next step:** Confirm retained preview is disconnected, then run `app dev clean` and verify hidden.

## 2026-10-07 — Candidate preview is disconnected after theme check

- **Change or action:** Inspected Dev Console after stopping the candidate session that included the theme app extension.
- **Observation:** Preview remained listed without green Connected status.
- **Interpretation:** Retained-preview/disconnect behavior remains correct after the restarted/theme-inclusive session.
- **Evidence:** User-observed Dev Console state on 2026-10-07.
- **Next step:** Clean the candidate preview and verify it is hidden.

## 2026-10-07 — Candidate preview cleanup command passes

- **Change or action:** Ran exact-candidate `app dev clean` on the development store.
- **Observation:** Command exited successfully with `Dev preview stopped` and reported restoration of the active app version.
- **Interpretation:** Candidate cleanup passes at CLI level; browser hidden-state confirmation remains.
- **Evidence:** Non-sensitive CLI success output on 2026-10-07.
- **Next step:** Refresh/reopen Dev Console and confirm the candidate preview is hidden.

## 2026-10-07 — Candidate preview hidden after cleanup

- **Change or action:** Refreshed/reopened Dev Console after candidate cleanup.
- **Observation:** Candidate preview was no longer visible.
- **Interpretation:** Candidate cleanup passes end to end.
- **Evidence:** CLI success plus user-observed hidden state on 2026-10-07.
- **Next step:** Build and run the candidate discount function.

## 2026-10-07 — Candidate discount function build/run pass

- **Change or action:** Built the TypeScript discount function and ran the documented synthetic fixture locally.
- **Observation:** Type generation, JS bundling, Javy compilation, and Wasm execution all succeeded; output matched expected order/product discount operations and controls.
- **Interpretation:** Candidate function path passes with no regression.
- **Evidence:** Non-sensitive local build/run output on 2026-10-07.
- **Next step:** Deploy/release candidate app `v1`, verify active version, then repeat through linked app.

## 2026-10-07 — Candidate app v1 deploy/release passes

- **Change or action:** Ran exact-candidate `app deploy --version=v1 --allow-updates` for `cli-qa-mac-490-1007b`.
- **Observation:** Candidate removed generated `include_config_on_deploy` as unsupported, bundled admin/Web Pixel/theme extension, theme-checked the theme extension, built function/types, validated, released `v1`, and exited successfully.
- **Interpretation:** Candidate deploy/release passes including the theme app extension. Stale config generation/removal persists.
- **Evidence:** Non-sensitive deploy output and bounded config inspection on 2026-10-07; Dashboard URL omitted.
- **Next step:** Verify versions JSON-schema support and active `v1`, then create/link/deploy a second app.

## 2026-10-07 — Candidate versions JSON-schema support passes

- **Change or action:** Ran local `app versions list --json-schema`.
- **Observation:** Candidate emitted 8,402 bytes of valid JSON Schema.
- **Interpretation:** The stable automation finding is fixed on the exact candidate.
- **Evidence:** Locally parsed schema output on 2026-10-07.
- **Next step:** Run authenticated versions list and confirm active `v1`.

## 2026-10-07 — Candidate first-app v1 is active

- **Change or action:** Queried candidate app versions in JSON form.
- **Observation:** `v1` is first and active; one earlier auto-generated version is inactive.
- **Interpretation:** Candidate first-app deploy/version verification passes.
- **Evidence:** Authenticated read-only result on 2026-10-07; GIDs omitted.
- **Next step:** Create/link `cli-qa-mac-link-490-1007b`, explicitly deploy, and verify linked `v1` active.

## 2026-10-07 — Candidate second-app config link passes

- **Change or action:** Ran interactive candidate `app config link`, selected the test organization, and created `cli-qa-mac-link-490-1007b` in separate `shopify.app.linked.toml`.
- **Observation:** Command exited 0, preserved original config, selected linked config as default, and again generated `include_config_on_deploy = true`.
- **Interpretation:** Candidate config-link path passes; stale-field generation persists.
- **Evidence:** Redacted TTY success and local config inspection on 2026-10-07.
- **Next step:** Explicitly deploy/release linked `v1` and independently verify active version.

## 2026-10-07 — Candidate linked-app deploy/release passes

- **Change or action:** Ran candidate `app deploy --config=linked --version=v1 --allow-updates`.
- **Observation:** Candidate explicitly targeted the linked app, removed stale config field, bundled/admin/theme/Web Pixel, theme-checked, built function/types, validated, released `v1`, and exited successfully.
- **Interpretation:** Candidate linked-app deploy passes including theme extension; config inconsistency persists.
- **Evidence:** Non-sensitive deploy output on 2026-10-07; Dashboard URL omitted.
- **Next step:** Query linked versions and verify active `v1`.

## 2026-10-07 — Candidate linked-app v1 is active

- **Change or action:** Queried linked candidate app versions with explicit config.
- **Observation:** `v1` is first and active; initial auto-generated version is inactive.
- **Interpretation:** Candidate config-link/redeploy/version verification passes end to end.
- **Evidence:** Authenticated read-only result on 2026-10-07; GIDs omitted.
- **Next step:** Initialize/build/run a fresh Hydrogen project through exact global candidate and verify storefront.

## 2026-10-07 — Candidate Hydrogen init passes with known findings

- **Change or action:** Ran exact-candidate Hydrogen init into fresh `cli-qa-hydrogen-mac-490c` and accepted mock.shop, JavaScript, Tailwind v4, npm, and subfolder-market defaults.
- **Observation:** Init exited 0, produced a clean 587 MiB Git project with Hydrogen 2026.4.5 and MiniOxygen 4.2.3. It again misleadingly called stable 4.8.5 an upgrade, and generated project-local CLI remains 3.93.2 while global CLI is candidate `172129`.
- **Interpretation:** Candidate Hydrogen scaffolding passes; misleading upgrade and local/global divergence are confirmed candidate findings.
- **Evidence:** Redacted TTY output, package metadata, Git state, and version checks on 2026-10-07.
- **Next step:** Build using verified global candidate, then run/inspect local storefront.

## 2026-10-07 — Candidate Hydrogen build passes

- **Change or action:** Ran global candidate `hydrogen build` rather than the local-CLI npm script.
- **Observation:** Vite 8.3.2 built client/Oxygen server successfully. Known envFile, React Router, and transformWithEsbuild warnings persisted; artifacts/report were produced.
- **Interpretation:** Candidate Hydrogen build passes with warning profile matching pre-candidate.
- **Evidence:** Verified global path/version and successful build output on 2026-10-07.
- **Next step:** Start candidate Hydrogen dev, verify HTTP/browser storefront, stop cleanly, and conclude candidate macOS result.

## 2026-10-07 — Candidate Hydrogen dev and HTTP storefront checks pass

- **Change or action:** Started global candidate Hydrogen dev in detached tmux, requested localhost home, and opened it in the browser.
- **Observation:** MiniOxygen listens on port 3000; home returned HTTP 200 with no error-page signature, `Hydrogen | Home`, mock.shop navigation, and expected products. Known warnings persisted.
- **Interpretation:** Candidate Hydrogen local server/rendering passes technically; human visual confirmation remains.
- **Evidence:** Redacted CLI output and bounded HTTP inspection on 2026-10-07; env values not read.
- **Next step:** Confirm storefront visibility, stop server, and conclude exact-candidate macOS QA.

## 2026-10-07 — Candidate Hydrogen visual check passes and server stops

- **Change or action:** Visually inspected the browser-opened candidate storefront, then stopped dev with Ctrl-C.
- **Observation:** User confirmed storefront visible. Server stopped, port 3000 closed, and signal-driven pane status was 1 as in controls.
- **Interpretation:** Candidate Hydrogen init/build/dev/browser flow passes end to end.
- **Evidence:** User visual confirmation, HTTP 200/rendered-content evidence, and listener check on 2026-10-07.
- **Next step:** Conclude exact-candidate macOS comparison and publish corrected release evidence.

## 2026-10-07 — Exact-candidate macOS QA concluded

- **Change or action:** Reviewed all required macOS app and theme-app-extension checkpoints for immutable candidate `172129`.
- **Observation:** Every required stage reached expected outcome: install/preflight, app init, admin/theme/discount/Flow/Web Pixel generation, app dev/Dev Console, admin and theme hot reload, live extension discovery, GraphQL, preview cleanup, function build/run, first and linked deploy/version verification, and Hydrogen init/build/dev/browser. Repeated app-log polling errors remained non-blocking throughout app dev.
- **Interpretation:** Exact candidate passes macOS QA, including the app-level theme extension check. Standalone theme CLI remains delegated. Overall release decision still needs Linux, Windows, and delegated theme result.
- **Evidence:** This log and `RESULTS.md`.
- **Next step:** Continue Linux/Windows candidate QA and triage app-log polling plus other persistent findings for release follow-up.
