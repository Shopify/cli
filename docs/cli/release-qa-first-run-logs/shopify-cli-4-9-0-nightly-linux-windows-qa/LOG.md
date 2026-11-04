# Log

Add entries in chronological order. Preserve earlier entries; correct mistakes with a dated note.

## 2026-10-07 — Linux pnpm global setup required two corrections

- **Change or action:** Began the Linux setup commands with Node 24.15.0 and npm 11.12.1, installed pnpm, attempted to remove prior globals, and attempted to install the nightly.
- **Observation:** The initial latest pnpm install failed global operations because `/home/durga256/.local/share/pnpm/bin` was not in PATH, then rejected the release issue's `--@shopify:registry` argument form. Pinning pnpm 10.28.0 succeeded, but `pnpm setup` only modified future shell configuration; querying the bin directory in the current shell returned empty, causing `mkdir ''`, no global manifest, and no Shopify CLI installation. Explicitly setting `PNPM_HOME`, PATH, and `global-bin-dir` then allowed installation.
- **Interpretation:** These were Linux pnpm bootstrap/runbook issues, not Shopify CLI candidate failures. The handoff commands were corrected to pin pnpm 10.28.0 and configure the current shell explicitly.
- **Evidence:** User-pasted Linux setup output on 2026-10-07.
- **Next step:** Ensure the installed package is the exact macOS-tested candidate before any app command.

## 2026-10-07 — Mutable nightly tag installed a different Linux build

- **Change or action:** Installed `@shopify/cli@nightly` after pnpm global setup succeeded and inspected resolution/version.
- **Observation:** Linux cleanly resolved `/home/durga256/.local/share/pnpm/shopify` with no npm-global CLI, but the mutable dist-tag installed `0.0.0-nightly-20261007172129`, not the macOS-tested `0.0.0-nightly-20261007061909`.
- **Interpretation:** Cross-OS comparison cannot proceed on this newer build. This is expected behavior for a mutable dist-tag, not a candidate failure. The Linux and Windows commands must pin the immutable package version used on macOS.
- **Evidence:** User-pasted Linux path/version/global-package output on 2026-10-07.
- **Next step:** Replace the Linux package with exact `@shopify/cli@0.0.0-nightly-20261007061909`, verify sole resolution, then begin preflight/app QA.

## 2026-10-07 — Correction: Linux installed the intended candidate; macOS installed too early

- **Change or action:** Queried current npm dist-tags and immutable publication times, then inspected the successful manually dispatched Shopify/cli Release workflow run.
- **Observation:** The manual workflow started at 2026-10-07T17:20:44Z and completed at 17:23:58Z from main SHA `1cf6e579fd5812dd2ee9922813ec6bd78363f3e9`. npm published `0.0.0-nightly-20261007172129` at 17:33:07Z and the `nightly` tag now points to it. The earlier `061909` package was published at 06:30:47Z. The macOS install occurred after workflow completion but before the later npm publication/tag update was visible, so it received the old daily nightly. Linux installed after the tag moved and therefore has the intended manual candidate.
- **Interpretation:** The prior entry's conclusion that Linux had the wrong build is incorrect and superseded. Linux should keep `172129` and proceed after preflight. MacOS must be rerun on `172129`; Windows must pin `172129`. The mutable tag itself behaved normally, but the release instructions' immediate install step did not account for npm publication/tag propagation delay.
- **Evidence:** Public npm dist-tag/publication metadata and [Shopify/cli workflow run 37658331851](https://github.com/Shopify/cli/actions/runs/37658331851).
- **Next step:** Run Linux environment/command preflight with `172129`, begin Linux app QA, start Windows with exact `172129`, and schedule the macOS candidate rerun.

## 2026-10-07 — Linux exact candidate resolution passes

- **Change or action:** Verified Linux after explicit pnpm global-bin configuration and candidate installation.
- **Observation:** pnpm 10.28.0 resolves a sole Shopify CLI at `/home/durga256/.local/share/pnpm/shopify`; version is exact manually published candidate `0.0.0-nightly-20261007172129`; npm-global CLI is empty.
- **Interpretation:** Linux candidate attribution passes. Because initial setup failed before the final cache/auth commands, run candidate verification, `shopify cache clear`, and `shopify auth login` before app init.
- **Evidence:** User-pasted Linux path/version/global-package output on 2026-10-07.
- **Next step:** Complete the short pre-app block, then continue Linux at section 02 App init.

## 2026-10-07 — Linux app dev first attempt blocked by server-side identity timeout

- **Change or action:** Completed Linux app init/extensions and started section 04 `app dev` for `cli-qa-linux-490-1007` using exact candidate `172129`; correlated the returned request ID through Observe.
- **Observation:** Local React Router/Prisma startup, admin/Web Pixel bundles, and discount-function build succeeded. App-log polling errors appeared, then DevSessionCreate returned HTTP 500 and remained `Preparing dev preview`. Request `192151ba-d963-43b8-89ed-43e1fb68e454-1791403265` spent about 10.13 seconds upstream and failed in `AppDev::GraphQLController#query`. The backend exception was `IdentityClient::CommunicationError` caused by `Net::ReadTimeout` while introspecting the bearer token against `identity.sfe.shopifyinternal.com`; server timing attributed about 10.03 seconds to external calls.
- **Interpretation:** This failure is server-side identity/token-introspection timeout, not a Linux native/build failure. The same candidate's app-log polling failures reproduced on macOS, but macOS DevSessionCreate succeeded. Allow one bounded retry without changing the candidate or generated project; if it repeats, mark Linux app-dev blocked and escalate with the request IDs.
- **Evidence:** User-pasted Linux output and Observe correlation for request ID `192151ba-d963-43b8-89ed-43e1fb68e454-1791403265` on 2026-10-07.
- **Next step:** Stop the stuck session, rerun the same app-dev command once, and report whether it reaches Ready or returns another request ID.

## 2026-10-07 — Linux app-dev retry and all 17 runbook sections pass

- **Change or action:** Retried the unchanged Linux app-dev command once after the correlated server-side identity timeout, then completed sections 04 through 17 of the Linux command handoff, including browser/manual checkpoints.
- **Observation:** The user reported the retry and all remaining steps completed with results similar to the successful macOS candidate run. This includes app dev/Dev Console, admin-action hot reload, live Flow discovery, GraphQL, preview cleanup, function build/run, first and linked-app deploy/version checks, and Hydrogen init/build/dev/storefront. The linked app used `cli-qa-lnx-link-490-1007`.
- **Interpretation:** Linux candidate QA passes. The first app-dev HTTP 500 was a transient Shopify backend IdentityClient timeout, not a Linux regression. Candidate warning/finding profile is consistent with macOS based on the user's comparison.
- **Evidence:** User completion report for all 17 Linux sections, plus the correlated first-attempt request ID and prior pasted command output.
- **Next step:** Publish the Linux runbook/result to release issue #6, then complete Windows on exact candidate `172129`.

## 2026-10-07 — Windows Hydrogen step 16 blocked by node_modules file lock

- **Change or action:** Reached Windows section 16 (Hydrogen versions/build) for `cli-qa-hydrogen-win-490`.
- **Observation:** Windows reported a resource-busy/file-lock error while attempting to remove `node_modules\\unrs-resolver`. Earlier Windows sections were completed far enough to reach Hydrogen build.
- **Interpretation:** `unrs-resolver` contains native Windows binaries and the reported `rmdir` failure is most likely a local handle held by Node, VS Code, Explorer/indexing, or security scanning—not yet evidence of a Shopify CLI candidate regression. Stop Node processes, remove/reinstall dependencies on the local VM disk, and retry once. If it repeats after restart, capture the full command/error and identify the locking process.
- **Evidence:** User-pasted Windows error summary on 2026-10-07.
- **Next step:** Close project consumers, terminate Node, remove `node_modules`, run `npm ci`, and rerun step 16 with verified global candidate; reboot first if deletion remains locked.

## 2026-10-07 — Windows cleanup reports operation not permitted

- **Change or action:** Attempted to remove the Windows Hydrogen `node_modules` tree after stopping the build path.
- **Observation:** Removal reached `unrs-resolver` but returned operation-not-permitted/EPERM behavior rather than successfully deleting it.
- **Interpretation:** The native module is still held open or has Windows attributes/ACL preventing deletion. Repeated deletion attempts in the same session are unlikely to help. Restart the VM and delete before opening VS Code/Explorer; if EPERM survives reboot, perform an administrator-only ownership/ACL cleanup, then return to a normal shell for `npm ci`.
- **Evidence:** User-reported Windows cleanup result on 2026-10-07; full errno/syscall text is still needed if the post-reboot attempt fails.
- **Next step:** Reboot Windows, rerun variables, delete `node_modules` before opening project tools, reinstall with `npm ci`, and rerun build once.

## 2026-10-07 — Fresh Windows Hydrogen init also gets EPERM on package.json

- **Change or action:** Changed to fresh Hydrogen path `cli-qa-hydrogen-win-491` and reran `hydrogen init`, selecting mock.shop.
- **Observation:** Candidate failed while Node attempted to open/write the new project's `package.json`: `EPERM: operation not permitted, open ...\\cli-qa-hydrogen-win-491\\package.json`, from Node internal fs promises and candidate CLI's generic file-write helper. This is no longer limited to deleting the existing `unrs-resolver` native module.
- **Interpretation:** The evidence now points to Windows filesystem permissions, file attributes, or security software blocking Node writes in the QA parent/path, rather than a stale node_modules lock alone. Diagnose parent ACL and compare direct PowerShell versus direct Node writes before another init attempt. If Node alone is blocked, inspect Windows Security Controlled Folder Access/Protection History; do not globally disable protection.
- **Evidence:** User-pasted candidate stack excerpt and local mapping of the referenced CLI helper to generic `fs/promises.writeFile`.
- **Next step:** Run non-destructive ACL/attribute and PowerShell/Node write probes, paste results, then choose ACL repair, Defender allow-list, or a clean LOCALAPPDATA path based on which probe fails.

## 2026-10-07 — Windows write probes pass; clean LOCALAPPDATA recovery prepared

- **Change or action:** Ran the offline diagnostics from the mounted ISO, then rebuilt the ISO with a dedicated clean Hydrogen recovery command.
- **Observation:** Parent ACL entries reported FullControl; direct Node write exited 0 and produced `node-ok`. The user also reported successful write probes. Therefore generic Node writes and parent ACL are functional outside the failing Hydrogen operation. The refreshed ISO now includes `Windows-Hydrogen-Recovery.html/.txt`, using a clean `%LOCALAPPDATA%\\ShopifyCLIQA` path, deferred dependency installation, and exact candidate verification.
- **Interpretation:** This rules out a persistent parent ACL or blanket Node/Controlled Folder Access denial. The original EPERM was likely a transient per-file lock/security scan race or state in the previous project path. Retry once in clean LOCALAPPDATA while avoiding VS Code/Explorer; a repeated package.json EPERM there would be stronger candidate-specific evidence.
- **Evidence:** User-reported diagnostic summary and mounted ISO verification on 2026-10-07.
- **Next step:** Remount the refreshed ISO, run `Windows-Hydrogen-Recovery`, and report whether init, dependency installation, and build pass.

## 2026-10-07 — Offline Windows QA ISO rebuilt and verified

- **Change or action:** Rebuilt `/Users/durga/Downloads/windows-qa-commands.iso` from the current exact-candidate Windows command handoff and added Hydrogen diagnostic and clean-recovery commands in HTML/TXT forms, avoiding guest networking and UTM Guest Tools/shared-folder dependencies.
- **Observation:** ISO volume `UTM_QA_ISO` contains `Windows-QA-Commands`, `Windows-Hydrogen-Diagnostics`, and `Windows-Hydrogen-Recovery` in HTML/TXT forms plus `README.txt`. The ISO mounts read-only on macOS, all expected files are present, and the full QA/recovery files pin exact candidate `172129` where applicable.
- **Interpretation:** Windows can continue offline by mounting the ISO and copying commands locally. Diagnostics now pass; the clean LOCALAPPDATA recovery is next.
- **Evidence:** Mounted ISO verification and file/content checks on 2026-10-07.
- **Next step:** Remount the refreshed ISO, open `Windows-Hydrogen-Recovery`, run it in normal PowerShell before opening VS Code/Explorer, and report init/install/build result.

## 2026-10-07 — Windows Hydrogen root cause is unsupported native ARM64 workerd

- **Change or action:** Reviewed the full Windows transcript, including the original Hydrogen init npm failure and subsequent diagnostics/recovery start.
- **Observation:** Windows app init, required extensions, app dev Ready, admin/live-extension changes, preview cleanup, function build/run, first deploy, active `v1`, and linked-app creation succeeded. App-log polling errors reproduced; the startup uninstall webhook timed out before the React Router server became ready. Hydrogen scaffolding completed with warnings, but dependency installation's primary fatal error was `workerd/install.js: Error: Unsupported platform: win32 arm64 LE`. EBUSY/EPERM cleanup messages for esbuild/unrs-resolver/Hydrogen directories were secondary to the failed npm install. ACLs, PowerShell writes, and direct Node writes all passed.
- **Interpretation:** Native Windows ARM64 Hydrogen is blocked because the generated workerd dependency lacks a win32-arm64 binary. This is not fixed by changing directories or ACLs. To complete the Windows functional Hydrogen check in the ARM VM, use x64 Node under Windows ARM emulation so npm selects win32-x64 workerd; retain native ARM64 as a documented platform failure. Do not continue clean-path retries with ARM64 Node.
- **Evidence:** User-pasted full Windows transcript, including `Unsupported platform: win32 arm64 LE`, plus passing ACL/write diagnostics.
- **Next step:** Verify `node -p process.arch`; stop the in-progress recovery if it is ARM64, install Node 24.15.0 x64, reinstall/verify pnpm and exact candidate, then rerun Hydrogen in a fresh local path. Also verify linked-app deploy/version step 14, which is not present in the pasted transcript.

## 2026-10-07 — Windows transcript confirms two independent Hydrogen blockers and reusable scaffold

- **Change or action:** Reviewed the complete Windows transcript from setup through app QA, Hydrogen init failures, ACL/write diagnostics, and the LOCALAPPDATA no-install retry.
- **Observation:** The original `cli-qa-hydrogen-win-490` scaffold reached `ready to build` and contains package metadata/routes, but dependency installation failed because workerd does not support `win32 arm64 LE` under Node 24.21.0 ARM64. Separate fresh init attempts (`win-491` and LOCALAPPDATA) failed earlier while rewriting `package.json` with EPERM even though direct PowerShell/Node writes pass. The transcript also confirms first-app `v1` active and linked-app creation, but no linked-app deploy/version output.
- **Interpretation:** These are two distinct issues: x64 Node resolves the workerd dependency blocker but not the fresh-init package.json race. Avoid another init. Reuse the already complete first scaffold, switch to Node 24.15.0 x64, remove partial node_modules, run npm install, and build/dev. This bypasses the package rewrite path and tests the actual runtime stack. Linked-app step 14 remains required.
- **Evidence:** Full user-pasted Windows transcript on 2026-10-07.
- **Next step:** Install Node 24.15.0 x64, reinstall exact candidate under that Node, repair dependencies in existing `cli-qa-hydrogen-win-490`, build/dev/visual-check, then run linked-app deploy/version step 14.

## 2026-10-07 — Windows recovery continued under ARM64 despite guard failures

- **Change or action:** Ran the x64-recovery text by pasting it interactively before replacing ARM64 Node.
- **Observation:** Architecture check explicitly returned Node v24.21.0, `win32 arm64`; both version and architecture guards threw. Because the text was pasted as separate interactive statements, PowerShell continued executing later commands. pnpm global update hit EPERM on its workspace-state file; npm install again failed with `Unsupported platform: win32 arm64 LE`; Hydrogen build/dev lacked Vite. The final `WINDOWS HYDROGEN X64 BUILD=PASS` line printed unconditionally despite prior failures and is invalid.
- **Interpretation:** Windows Hydrogen remains blocked; no x64 test has occurred. Recovery must be delivered as an executable `.ps1` with terminating exit codes and run only after uninstalling ARM64 Node, installing Node 24.15.0 x64, closing shells, and rebooting. Reuse the existing scaffold after that.
- **Evidence:** User-pasted recovery transcript on 2026-10-07.
- **Next step:** Replace Node with x64 and reboot; verify `v24.15.0 win32 x64`; then run the guarded ISO `.ps1` recovery, not pasted text. Complete linked-app step 14 separately.

## 2026-10-07 — Guarded Windows recovery correctly stops on ARM64 Node

- **Change or action:** Ran the ISO's guarded `.ps1` recovery as a file.
- **Observation:** Script reported Node v24.21.0, platform win32, architecture arm64, then stopped with the expected version/architecture guard before attempting recovery.
- **Interpretation:** Guard behavior is correct; no x64 test has started. Replace ARM64 Node before rerunning. To remove guest-network dependency, the ISO was rebuilt with the checksum-verified official Node 24.15.0 x64 MSI and installation instructions.
- **Evidence:** User-pasted guarded-script output; mounted ISO SHA-256 verification for `node-v24.15.0-x64.msi` (`feffb8e5cb5ac47f793666636d496ef3e975be82c84c4da5d20e6aa8fa4eb806`).
- **Next step:** Eject/remount refreshed ISO, follow `INSTALL-Node-x64-FIRST.txt`, verify win32 x64 v24.15.0, then rerun `Windows-Hydrogen-x64-Recovery.ps1`.

## 2026-10-07 — Node x64 installer blocked because ARM64 24.21 remains installed

- **Change or action:** Launched the bundled Node 24.15.0 x64 MSI.
- **Observation:** Windows Installer reported that a later Node.js version is already installed. Current Node remains 24.21.0 ARM64.
- **Interpretation:** MSI version detection is architecture-agnostic for this downgrade and will not replace the newer ARM64 installation. Fully uninstall Node.js 24.21.0, reboot, verify `node.exe` is absent, then install the x64 24.15.0 MSI. Global npm/pnpm packages can be reinstalled by the guarded recovery afterward.
- **Evidence:** User-reported Windows Installer message and prior architecture check.
- **Next step:** Uninstall Node.js through Settings (or MSI product fallback), reboot, confirm no `node` command remains, install bundled x64 MSI, reboot, verify win32 x64 v24.15.0, then rerun recovery.

## 2026-10-07 — Windows ARM64 Node reappears after uninstall; portable x64 recovery prepared

- **Change or action:** Attempted repeatedly to uninstall ARM64 Node before installing x64.
- **Observation:** Node 24.21.0 ARM64 reappears after restart, preventing the older x64 MSI from installing. The source of reinstallation/symlink management is not yet identified.
- **Interpretation:** Avoid changing the system Node installation. A portable x64 Node can run under Windows ARM emulation side-by-side and isolate pnpm/global candidate state. This directly tests Hydrogen's supported win32-x64 path without fighting the managed ARM64 install.
- **Evidence:** User report plus guarded recovery repeatedly detecting `win32 arm64 v24.21.0` after uninstall/restart.
- **Next step:** Remount the ISO containing checksum-verified portable Node x64 ZIP and run the guarded portable-x64 `.ps1`; trust only its final PASS line, then run the printed dev command and complete linked-app step 14.

## 2026-10-07 — Windows Hydrogen build passes under portable Node x64

- **Change or action:** Ran the guarded offline portable-x64 recovery, isolating Node 24.15.0 x64, pnpm x64 global state, exact candidate, and reinstalling dependencies in the existing Hydrogen scaffold.
- **Observation:** Script reached its guarded final line `WINDOWS HYDROGEN PORTABLE X64 BUILD=PASS`. This proves all prior architecture/version/install/build checks succeeded under win32-x64 emulation.
- **Interpretation:** Windows Hydrogen build works on the supported x64 runtime under Windows ARM emulation. Native win32-arm64 remains a documented workerd platform blocker, but is not a candidate regression if Windows release support is x64. Storefront dev/visual confirmation is still required.
- **Evidence:** User-reported guarded-script PASS line on 2026-10-07.
- **Next step:** Run Hydrogen dev with portable x64 PATH, visually verify mock.shop storefront, stop it, then complete linked-app step 14 in a fresh normal PowerShell.

## 2026-10-07 — Offline ISO now includes guarded Hydrogen dev and linked-app scripts

- **Change or action:** Added executable ISO scripts for portable-x64 Hydrogen dev and Windows linked-app deploy/version verification, plus launcher text files, then rebuilt and mounted the ISO for validation.
- **Observation:** `Windows-Hydrogen-Portable-x64-Dev.ps1` verifies x64 Node/candidate/Vite before starting dev. `Windows-Linked-App-Deploy.ps1` verifies system candidate/config, deploys linked `v1`, parses JSON versions, and prints PASS only when active `v1` exists. Refreshed ISO mounts successfully with all scripts.
- **Interpretation:** Remaining Windows steps can be executed offline as guarded script files rather than pasted commands, preventing continuation after hidden failures.
- **Evidence:** Mounted ISO file and content verification on 2026-10-07.
- **Next step:** Remount ISO; run guarded Hydrogen dev script and confirm storefront; then run guarded linked-app script and report both final PASS states.

## 2026-10-07 — Windows Hydrogen storefront passes under portable x64

- **Change or action:** Ran the guarded portable-x64 Hydrogen dev script after the successful portable-x64 build.
- **Observation:** The mock.shop Hydrogen storefront rendered visibly in the Windows ARM VM under x64 Node emulation.
- **Interpretation:** Windows Hydrogen functional build/dev/browser coverage passes on the supported win32-x64 runtime. Native win32-arm64 workerd remains unsupported and separately documented.
- **Evidence:** User visual confirmation on 2026-10-07.
- **Next step:** Complete read-only linked-app active-v1 verification; its guarded script is currently running without a final output.

## 2026-10-07 — Linked-app verifier failed because system node.exe is absent

- **Change or action:** Ran the first guarded linked-app verification script from a fresh normal PowerShell.
- **Observation:** It failed with `node.exe` not recognized because prior Node uninstall attempts removed the system Node executable, and the script used the system pnpm candidate shim. Portable x64 Node/candidate remain available and already passed Hydrogen.
- **Interpretation:** This is a verifier-script environment bug, not linked-app or candidate failure. Read-only version verification can use the isolated portable x64 Node/candidate without touching app build artifacts. The ISO verifier was updated to set portable x64 PATH and candidate explicitly before querying.
- **Evidence:** User-reported PowerShell error and updated mounted-ISO script construction on 2026-10-07.
- **Next step:** Remount refreshed ISO and rerun `Windows-Linked-App-Verify.ps1`; report its guarded final PASS or STOP line.

## 2026-10-07 — Windows linked app has no active v1; deploy was not completed

- **Change or action:** Ran read-only linked-app version verification under portable x64 candidate.
- **Observation:** Verifier reported that the linked app does not list active `v1`, confirming the earlier user-reported deploy was not completed or not released to this linked target.
- **Interpretation:** Step 14 remains incomplete and requires an actual linked deploy. Because app project dependencies were installed for native ARM64 and deploy builds extensions/functions, use an isolated portable ARM64 Node/candidate environment for this step, while retaining portable x64 only for Hydrogen.
- **Evidence:** Guarded linked-app verifier result on 2026-10-07.
- **Next step:** Remount ISO and run updated `Windows-Linked-App-Deploy.ps1`, which provisions portable ARM64 Node/candidate, deploys linked v1, and verifies active status.

## 2026-10-07 — Windows linked deploy blocked by candidate config rewrite EPERM

- **Change or action:** Ran guarded portable-ARM64 linked deploy script.
- **Observation:** Portable Node 24.15.0 ARM64 and exact candidate installed successfully, but deploy failed before upload while CLI attempted to rewrite `shopify.app.linked.toml` to remove `include_config_on_deploy`: `EPERM: operation not permitted, open ...\\shopify.app.linked.toml`.
- **Interpretation:** This is the same Windows candidate generic file-rewrite failure observed during fresh Hydrogen init, now reproduced on app config migration. PowerShell writes work, so bypass the CLI migration write by creating a separate `shopify.app.linked-clean.toml` with the unsupported field already removed, then deploy/query using `--config=linked-clean`. This preserves the original linked config and still tests remote deployment/build behavior.
- **Evidence:** User-pasted guarded linked-deploy output on 2026-10-07.
- **Next step:** Remount refreshed ISO and rerun `Windows-Linked-App-Deploy.ps1`; it now creates the clean config via PowerShell, deploys with `linked-clean`, and verifies active v1.

## 2026-10-07 — Windows linked deploy build hits widespread artifact-write EPERM

- **Change or action:** Reran linked deploy through portable ARM64 Node/candidate using PowerShell-created `shopify.app.linked-clean.toml` without the stale config field.
- **Observation:** Candidate correctly targeted `cli-qa-win-link-490-1007`. Admin/Web Pixel bundles completed but failed to write their metafile JSON files with EPERM. Function bundling/Javy completed, then wasm-opt could not open `dist/function.wasm` for output (`Operation not permitted`), so deploy stopped before release.
- **Interpretation:** The Windows file-write failure is broader than config/package writes and affects existing build artifacts under the app project. First app deploy/build already succeeded and sources are unchanged, so the documented second-app deployment can safely use the previously built artifacts via `--no-build`; verify required artifacts exist/non-empty first. This preserves evidence of the Windows rewrite issue while avoiding a redundant second build.
- **Evidence:** User-pasted portable-ARM64 linked-deploy output on 2026-10-07.
- **Next step:** Remount refreshed ISO and rerun the guarded linked deploy; it now verifies prior artifacts, uses `--no-build` with `linked-clean`, and confirms active linked v1.

## 2026-10-07 — Windows no-build retry finds missing admin artifact

- **Change or action:** Reran linked deploy script configured to verify existing artifacts before `--no-build`.
- **Observation:** Portable ARM64/candidate and clean config succeeded, but `qa-admin-action/dist/qa-admin-action.js` was unavailable when read. The previous failed build likely removed/partially cleaned outputs before its write failures, so artifact reuse is unsafe.
- **Interpretation:** A fresh build is required. Earlier diagnostics showed the QA parent directory has the Hidden attribute, and Windows/Node commonly rejects overwrite/delete operations on hidden/read-only paths with EPERM. Perform a bounded repair by clearing Hidden/ReadOnly/System attributes recursively, deleting partial extension dist directories, and running one normal linked deploy. If writes still fail, classify candidate Windows build/deploy as blocked.
- **Evidence:** User-pasted guarded no-build output and prior parent attribute diagnostics.
- **Next step:** Remount refreshed ISO and run repaired linked deploy script; report PASS or first attribute/delete/build error.

## 2026-10-07 — Windows linked deploy remains blocked after bounded repair

- **Change or action:** Reran linked deploy after clearing app/extension Hidden/ReadOnly/System attributes, removing partial dist directories, recreating clean config, and rebuilding from scratch under portable ARM64 Node/candidate.
- **Observation:** Admin action, Web Pixel, and discount function rebuilt successfully. Deploy then failed writing new `.shopify\\deploy-bundle.br` with `EPERM: operation not permitted`. This follows earlier candidate EPERMs on package.json, linked config, metafile JSON, and wasm output. Linked app still lacks active `v1`.
- **Interpretation:** The bounded repair did not resolve the pervasive Windows file-write failure. Stop further workarounds and classify required Windows linked-app deploy as blocked/NO-GO pending root-cause investigation or an explicit release waiver. The candidate can build many artifacts, but cannot reliably complete the documented second deploy in this VM.
- **Evidence:** User-pasted guarded linked-deploy output on exact candidate `172129` under portable Node 24.15.0 ARM64.
- **Next step:** Preserve the VM/project, inspect Windows Security/handle telemetry if owners request, and escalate the reproducible file-write paths; do not keep mutating the test environment.

## 2026-10-07 — User elects isolated clean-copy workaround to test desired linked behavior

- **Change or action:** At user direction, prepared one final isolated workaround rather than modifying the failing original project further.
- **Observation:** New guarded ISO script copies source/config (excluding node_modules, Git, `.shopify`, and dist) to `%LOCALAPPDATA%\\ShopifyCLIQA\\cli-qa-win-490-1007-deploy`, clears attributes, reinstalls from the frozen pnpm lock under portable ARM64 Node/candidate, creates a clean linked config, deploys, and verifies active v1. Original failing project remains preserved.
- **Interpretation:** A successful clean-copy deploy would demonstrate desired linked-app behavior and strengthen the VM-path/environment explanation, but does not erase the original-path EPERM finding. A repeated EPERM in the clean copy ends workaround attempts.
- **Evidence:** Guarded `Windows-Linked-App-Deploy-CleanCopy.ps1` included in mounted/verified ISO build.
- **Next step:** Run the clean-copy script once and report its guarded PASS or first STOP/EPERM result.

## 2026-10-07 — Windows linked-app clean-copy deploy passes

- **Change or action:** Ran guarded isolated clean-copy linked deploy under portable ARM64 Node/candidate.
- **Observation:** Script reached `WINDOWS LINKED APP CLEAN COPY DEPLOY=PASS`, proving clean dependency install/build, linked deployment, JSON version query, and active `v1` on `cli-qa-win-link-490-1007` from the `%LOCALAPPDATA%` copy.
- **Interpretation:** Required linked-app behavior works on Windows when isolated from the original project path/state. This strongly supports a VM filesystem/security/path-state cause for the original EPERMs rather than a deterministic candidate deploy defect. Preserve the original-path failure as an environment compatibility finding. Windows functional candidate QA now passes using x64 emulation for Hydrogen and clean-copy isolation for linked deploy.
- **Evidence:** User-reported guarded final PASS on 2026-10-07.
- **Next step:** Conclude Windows/cross-OS candidate QA with caveats, publish the Windows runbook/result, and combine with delegated standalone-theme status for overall release GO.

## 2026-10-07 — Windows linked app reportedly deployed; Hydrogen dev remains

- **Change or action:** User reported linked app `v1` was deployed, but the transcript/output was not preserved; asked whether original runbook sections 16/17 should be rerun.
- **Observation:** Guarded portable-x64 Hydrogen build already passed, so original section 16 commands must not be rerun under system ARM64 Node. Linked app deployment is user-confirmed, but active-version JSON verification is not present in retained evidence.
- **Interpretation:** Treat Hydrogen build as complete via portable x64 workaround. Run only the guarded portable-x64 dev script for step 17 and visually verify. Run a read-only linked versions query (or guarded linked script if redeploy is acceptable) to close evidence.
- **Evidence:** User report and prior guarded build PASS.
- **Next step:** Run `Windows-Hydrogen-Portable-x64-Dev.ps1`, confirm storefront, then verify linked active `v1` and conclude Windows.
