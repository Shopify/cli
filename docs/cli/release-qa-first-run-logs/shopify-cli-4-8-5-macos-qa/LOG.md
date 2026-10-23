# Log

Add entries in chronological order. Preserve earlier entries; correct mistakes with a dated note.

## 2026-10-06 — Experiment started and environment prepared

- **Change or action:** Loaded the full internal QA document through Google Workspace, identified its required macOS flow, upgraded the active Node version, installed Shopify CLI 4.8.5, and verified the newly installed binary directly.
- **Observation:** The machine is macOS 26.5.1 arm64. Active Node is 24.15.0 with npm 11.12.1. `@shopify/cli@4.8.5` is installed under the Node 24 NVM prefix. An initial `shopify version` returned 4.7.0 because zsh had cached the old pnpm executable; rehashing resolves the Node 24 binary, which reports 4.8.5. Older pnpm and Yarn installations still exist at lower-priority paths. Shopify Lockdown reports Monitor mode.
- **Interpretation:** The machine meets the current CLI engine requirement. Command resolution must be reverified in every resumed shell so an older global install does not contaminate results.
- **Evidence:** Local version and path checks on 2026-10-06; [QA flow](https://docs.google.com/document/d/1XX6QnS6kKZTT1shcCZVcso74VWn-Ui4V2IASenHHi1E/edit?tab=t.0).
- **Next step:** Run automated preflight and inspect app-init help before creating the temporary project.

## 2026-10-06 — Automated preflight passed

- **Change or action:** Ran a fresh login-shell preflight with Node 24.15.0, refreshed command resolution, verified the exact CLI executable/version, checked macOS/architecture, checked Shopify Lockdown, validated all notebook files and placeholders, and inspected `app init` and `app generate extension` help for non-interactive execution.
- **Observation:** `shopify` resolves to `/Users/durga/.nvm/versions/node/v24.15.0/bin/shopify` and reports 4.8.5. Node is 24.15.0, npm is 11.12.1, Git is 2.55.0-shop-cb0a34b5, macOS is 26.5.1 arm64, and Shopify Lockdown is Monitor. The CLI's saved authentication can list accessible organizations without prompting. Non-interactive React Router initialization requires a name, organization ID, template, flavor, and package manager; extension generation requires explicit names/templates and flavors where applicable.
- **Interpretation:** Local preconditions pass. The first remote mutation is creation of a temporary development app, so execution is paused for the user to confirm which test organization to use rather than inferring one.
- **Evidence:** Local bounded preflight and CLI help output on 2026-10-06; notebook validation found all five files and no template placeholders.
- **Next step:** Obtain human confirmation of the development organization, then create the uniquely named React Router app in the temporary QA workspace.

## 2026-10-06 — Development organization candidates verified

- **Change or action:** Used the authenticated CLI's read-only `store list --type dev --json` command against the two user-specific test-organization candidates and one additional candidate; no app or store was created or changed.
- **Observation:** Organization `durga-test-store` (ID `150256644`) contains `durga-test-store-dev`, explicitly returned with store type `dev`. Organization `new-org-test-store` currently returns no development stores. The additional candidate did not permit organization-user access.
- **Interpretation:** `durga-test-store` is the verified development organization and existing dev-store context for this QA run. It is safer than inferring from names alone. Remote app creation remains paused pending explicit human confirmation.
- **Evidence:** Read-only Shopify CLI organization/store responses on 2026-10-06.
- **Next step:** Confirm use of `durga-test-store`, then initialize the temporary React Router app with explicit non-interactive flags.

## 2026-10-06 — App initialization blocked by organization capability

- **Change or action:** After explicit user approval, attempted non-interactive React Router initialization in the clean QA workspace using `durga-test-store`. The first attempt inherited `SHOPIFY_FLAG_CLIENT_ID`; the second removed that command-scoped but inherited `SHOPIFY_APP_AUTOMATION_TOKEN`; the third removed both command-scoped and used the saved human user session. No target project directory or app was created.
- **Observation:** The first attempt was rejected because an inherited client ID cannot be combined with `--organization-id`. The automation-token attempt identified a different organization account and returned `No Organization found`. The human-session attempt correctly identified `durga.sivakumar@shopify.com` but still returned `No Organization found` for organization `150256644`, with guidance about Partner organization existence and Manage app permissions. A read-only organization listing can see `durga-test-store` and its dev-type store, but that does not prove permission to create/manage apps in the organization.
- **Interpretation:** A development store and an app-development organization are distinct capabilities. My earlier statement that the presence of a dev store made `durga-test-store` the correct app-init organization was too strong. The run needs a Dev Dashboard/Partner organization where the user has Manage apps permission. The environment-variable collisions are also a reproducible setup hazard, but the human-session result confirms they are not the remaining blocker.
- **Evidence:** Redacted command outcomes in `/tmp/shopify-cli-4-8-5-app-init.log`; no project directory exists under the target workspace.
- **Next step:** Have the user select or identify an app-development organization in an interactive CLI/Dev Dashboard flow, then resume non-interactive execution with that confirmed organization ID.

## 2026-10-06 — Organization recommendation corrected

- **Change or action:** Reviewed the interactive app-init organization picker after the user supplied its choices and reconsidered the earlier recommendation to avoid `durga-test-store`.
- **Observation:** The interactive picker does offer `durga-test-store`, and that organization already has the confirmed `durga-test-store-dev` development store. The earlier failure occurred only on the explicit non-interactive `--organization-id 150256644` path after the automation-token and client-ID environment values were removed.
- **Interpretation:** The explicit-ID failure proves that path did not resolve an app-manageable organization, but it does not prove the interactive selection will fail. A dev store alone does not guarantee Manage apps permission; however, if the interactive app-init selection succeeds, `durga-test-store` is preferable because it already has the required dev store. My recommendation to reject it outright was too strong.
- **Evidence:** Prior read-only store listing, explicit app-init failure, and user-reported interactive picker.
- **Next step:** Select `durga-test-store` interactively. If initialization succeeds, retain it for QA; if it returns the same permission error, stop and use/create an organization with Manage apps permission.

## 2026-10-06 — Interactive selection confirms missing app-development access

- **Change or action:** The user selected `durga-test-store` from the interactive app-init organization picker.
- **Observation:** The CLI again returned `No Organization found` for the human account and pointed to missing Manage app permissions/Partner organization access. No app or project was created.
- **Interpretation:** `durga-test-store` currently grants enough store-management access to list and own its dev store, but not the app-development capability required by `shopify app init`, or the current session has not picked up that role. The next diagnostic is the Dev Dashboard navigation/role assignment, followed by a fresh aliased login to distinguish permission state from a stale auth session.
- **Evidence:** User-provided interactive CLI error on 2026-10-06.
- **Next step:** In the Dev Dashboard, assign or obtain the App developer role/App development permission for the human account, then authenticate a fresh `cli-qa` session and retry initialization.

## 2026-10-06 — Auth alias behavior clarified

- **Change or action:** The user ran `shopify auth login --alias cli-qa`, selected the already stored `durga.sivakumar@shopify.com` session, and then tried `organization list --auth-alias cli-qa`. Inspected the 4.8.5-compatible auth-login behavior and current CLI source semantics.
- **Observation:** Login reported the existing email account as current, but `--auth-alias cli-qa` subsequently returned `No authenticated account found for alias cli-qa`. The flag is documented and implemented as an alias of an existing session to select; it does not rename the selected session or create a new custom alias. When a missing alias is supplied, the interactive fallback chooser can select an existing account, whose alias remains its email.
- **Interpretation:** This error does not mean login failed. The valid alias remains `durga.sivakumar@shopify.com`; `cli-qa` was never created. To truly refresh authentication, choose `Log in with a different account` and authenticate again, then use the email alias or the newly reported alias. The organization role still must be fixed first.
- **Evidence:** User-provided CLI output, [auth login reference](https://shopify.dev/docs/api/shopify-cli/general-commands/auth-login), and local CLI source inspection.
- **Next step:** Confirm/assign App developer access in the Dev Dashboard, force a new OAuth login using the chooser's `Log in with a different account` option, and retry with the actual stored alias.

## 2026-10-06 — Dev Dashboard confirms app-development permission

- **Change or action:** The user opened `durga-test-store` in the Dev Dashboard and inspected its navigation/actions.
- **Observation:** The organization shows Apps and a Create app button.
- **Interpretation:** The human account has app-development access in the product UI, so assigning a role is not the next fix. The remaining leading explanations are stale OAuth scopes/session state or a discrepancy in CLI 4.8.5's organization resolution. A forced new OAuth session is the narrowest next diagnostic.
- **Evidence:** User confirmation from the Dev Dashboard on 2026-10-06.
- **Next step:** Force a new OAuth flow via `Log in with a different account`, retain the email alias, then retry the exact app-init operation.

## 2026-10-06 — Fresh human OAuth session established

- **Change or action:** The user ran auth login with the inherited client-ID and automation-token variables removed, chose `Log in with a different account`, and completed Shopify's browser/device authorization flow as `durga.sivakumar@shopify.com`. A bounded read-only organization check using the actual email alias then found `durga-test-store` with organization ID `150256644`.
- **Observation:** Login completed successfully and reported the email account as current. The target project path remains absent, so no local or remote app was created by prior attempts.
- **Interpretation:** Stale authentication is now removed as the leading explanation. The next exact app-init attempt will distinguish a resolved stale-session issue from a reproducible CLI/API organization-resolution issue.
- **Evidence:** User confirmation of successful fresh login and redacted read-only organization result on 2026-10-06. The device verification code and activation URL were intentionally not recorded.
- **Next step:** After explicit confirmation of the exact target, transmitted fields, and side effects, rerun app initialization with the fresh email alias.

## 2026-10-06 — Required app-init stage fails after fresh OAuth

- **Change or action:** After explicit user confirmation, ran the exact non-interactive React Router initialization against `durga-test-store` using the fresh human-session alias, with inherited client-ID and automation-token variables removed and agent attribution set. Target name was `cli-qa-macos-4-8-5-20261006`; template was React Router TypeScript with pnpm.
- **Observation:** CLI 4.8.5 again returned `No Organization found`, identified the correct human account, and linked organization `150256644`. The local target directory remains absent and no remote app was created. This reproduces after both interactive selection and explicit `--organization-id`, before and after fresh OAuth. The Dev Dashboard simultaneously shows Apps and Create app for that organization.
- **Interpretation:** The documented app-init stage is failed for this stable baseline. Authentication, command resolution, target ID, and visible Dev Dashboard app access have been checked. The strongest remaining explanation is a discrepancy between Dev Dashboard access and the organization eligibility/resolution used by CLI's app-init API path, not a local project problem. This may be backend/account-specific rather than a 4.8.5 regression until compared with another CLI build or account.
- **Evidence:** `/tmp/shopify-cli-4-8-5-app-init.log`, exact CLI 4.8.5 command, and Dev Dashboard confirmation. No secrets are recorded.
- **Next step:** Preserve the failed stage, create a temporary app record through the Dev Dashboard as a workaround, initialize/link by client ID, and continue the remaining QA stages; separately escalate the organization-resolution discrepancy and compare with the next nightly.

## 2026-10-06 — Dashboard-created app ready for linked initialization

- **Change or action:** The user created the temporary app record through the `durga-test-store` Dev Dashboard and supplied its non-secret Client ID for linking.
- **Observation:** The intended local target directory is still absent. The remote app name remains `cli-qa-macos-4-8-5-20261006`.
- **Interpretation:** Linked initialization by Client ID can bypass only the failed organization/app-creation lookup while preserving the rest of the React Router scaffolding test. This is a workaround, not a pass for the required create-new-app path.
- **Evidence:** User confirmation and local target-path check on 2026-10-06. The Client ID is intentionally not copied into this notebook.
- **Next step:** After confirming the exact authenticated linking command and side effects, initialize the TypeScript React Router project with pnpm against the existing temporary app.

## 2026-10-06 — Client-ID workaround scaffolds locally but still exits with organization error

- **Change or action:** After explicit confirmation, ran linked React Router initialization with the existing temporary app's Client ID, TypeScript flavor, pnpm, fresh human alias, inherited automation/client-ID variables removed, and agent attribution set.
- **Observation:** Template download, Liquid parsing, dependency installation, cleanup, and Git repository initialization ran. The CLI then returned the same `No Organization found` error for organization `150256644` and exited 1. Nevertheless, it left a 540 MiB local project with dependencies, package lock, a Git repository with no commits, and `shopify.app.toml` containing the intended app name and Client ID. `.shopify/project.json` is empty. The generated project pins `@shopify/cli` 4.8.5. No deploy or store install occurred.
- **Interpretation:** The workaround bypasses enough of app init to produce a usable-looking scaffold and configuration, but does not complete the command successfully or establish all local app context. App initialization remains failed, not passed. The next extension-generation command will test whether the linked TOML is sufficient or whether every app workflow remains blocked by the same organization resolver.
- **Evidence:** `/tmp/shopify-cli-4-8-5-linked-init.log`, bounded local project inspection, and generated config/package metadata.
- **Next step:** With explicit confirmation of the exact commands and local/remote effects, attempt the required extension-generation batch against this temporary app and stop on the first organization-context failure.

## 2026-10-06 — Research identifies known organization lookup inconsistency

- **Change or action:** Paused downstream QA at the user's request and investigated current docs, CLI source, GitHub issues, and internal support/history for the exact `No Organization found` signature.
- **Observation:** The CLI has two relevant Business Platform paths: organization enumeration through `organizationsWithAccessToDestination(destination: APPS_CLI)` and a follow-up direct `currentUserAccount.organization(id:)` lookup used by `app init --organization-id`, client-ID linking, and `orgAndApps`. Historical confirmed cases show the list/app leg succeeding while the direct lookup returns null for the same active member with `develop_apps`, producing this exact error. Those cases were owned by the Organizations/Accounts platform rather than fixed locally. CLI caches some Business Platform account/API results for six hours, and `shopify cache clear` is the supported local cache reset. On this Mac, `SHOPIFY_CLI_1P_DEV` and `SHOPIFY_CLI_ORGANIZATION` are unset; inherited app-automation/client-ID variables were removed command-scoped; CLI is current; fresh OAuth, interactive selection, explicit ID, and client-ID linking all reproduce. Dev Dashboard shows Apps/Create app and successfully created the temporary app.
- **Interpretation:** This matches the known server-side organization lookup asymmetry much more closely than a local auth, PATH, app-config, or dev-store problem. A cache clear plus one fresh diagnostic is the last low-cost local remediation. If it persists, the durable fix is correction of the user's organization membership/destination/direct-lookup state by Accounts and Access/Organizations platform; grinding on Dev Dashboard setup or scaffolding does not fix it.
- **Evidence:** [Dev Dashboard user permissions](https://shopify.dev/docs/apps/build/dev-dashboard/user-permissions), Shopify CLI `fetchOrgFromId`/`orgFromId` source, internal `#help-accounts-and-access` precedent from 2026-07-21, and local environment/reproduction evidence.
- **Next step:** Clear the CLI cache, collect only redacted request IDs from one verbose reproduction, and escalate with organization ID `150256644`, account, CLI version, successful dashboard access, and the list-vs-direct-lookup discrepancy if the error remains.

## 2026-10-06 — Organization link succeeds under the wrong global CLI version

- **Change or action:** The user ran the proposed `app config link` probe against the dashboard-created app and supplied its complete output.
- **Observation:** The command succeeded and created `shopify.app.org-probe.toml`, selecting it as the default configuration. However, the command explicitly reported that it found global CLI 4.7.0 and local dependency 4.8.5 and was **using global installation 4.7.0**; it also suggested upgrading to 4.8.5. The project still has multiple CLI installations, and `.shopify/project.json` remains empty.
- **Interpretation:** The organization is linkable, which weakens the server-side-permanent-membership diagnosis, but this result does not prove 4.8.5 works. It establishes an accidental A/B signal: 4.7.0 succeeds where our confirmed 4.8.5 app-init/link paths failed. We must rerun the same bounded operation with verified 4.8.5 before deciding whether cache state or a 4.8.5 regression caused the earlier failures. Multiple CLI resolution is itself a failed QA precondition from the checklist.
- **Evidence:** User-provided command output and generated `shopify.app.org-probe.toml` inspected locally.
- **Next step:** Resolve or bypass the duplicate global installations, verify the actual executable reports 4.8.5 in the same shell, and repeat a non-destructive config-link probe to a separate local filename.

## 2026-10-06 — Obsolete global CLI installations removed

- **Change or action:** After explicit user confirmation, removed pnpm-global `@shopify/cli` 4.7.0 and Yarn-global `@shopify/cli` 3.94.3, refreshed zsh command resolution, and verified the remaining executable.
- **Observation:** pnpm removed 26 packages for CLI 4.7.0. Yarn removed CLI 3.94.3 successfully, with only its own `url.parse()` deprecation warning. `whence -va shopify` now reports exactly one executable at `/Users/durga/.nvm/versions/node/v24.15.0/bin/shopify`, and it reports 4.8.5.
- **Interpretation:** The QA checklist's single-global-CLI precondition now passes. Future command results can be attributed to stable 4.8.5 without the prior global-version ambiguity; the project-local dependency is also 4.8.5.
- **Evidence:** `/tmp/shopify-cli-remove-old-globals.log` and post-removal path/version checks.
- **Next step:** Clear the 4.8.5 CLI cache and repeat the bounded config-link probe under the now-unambiguous executable.

## 2026-10-06 — Clean CLI 4.8.5 organization probe passes

- **Change or action:** After explicit user confirmation, activated Node 24.15.0, verified the sole global executable and version, cleared the CLI cache, and ran `app config link` under global CLI 4.8.5 against the existing temporary app with a separate probe filename.
- **Observation:** The command resolved `/Users/durga/.nvm/versions/node/v24.15.0/bin/shopify`, reported 4.8.5, and linked successfully. It created `shopify.app.org-probe-485.toml` and selected it as default. The only notice was that both global and project-local CLI installations exist at the same 4.8.5 version. No deploy or store mutation occurred.
- **Interpretation:** `durga-test-store` is valid for CLI app workflows. The prior 4.8.5 `No Organization found` failures were caused by stale cached organization/account state; duplicate global installations then obscured the diagnosis by allowing a later probe to run under 4.7.0. Platform escalation is no longer warranted unless the failure returns after a clean cache. The required create-new-app QA stage still needs a fresh rerun because all prior init attempts exited nonzero.
- **Evidence:** `/tmp/shopify-cli-4-8-5-clean-org-probe.log`, generated probe config, and verified single global CLI path.
- **Next step:** Run a fresh, uniquely named CLI-created React Router app initialization under 4.8.5 now that organization resolution passes; use that clean project for subsequent QA and clean up the dashboard-created workaround later.

## 2026-10-06 — Fresh app init exposes late app-name validation

- **Change or action:** After explicit confirmation, ran fresh CLI 4.8.5 app initialization against `durga-test-store` using React Router TypeScript and pnpm, with a unique descriptive name.
- **Observation:** Organization resolution passed. The CLI downloaded the template, parsed Liquid, updated `package.json`, installed dependencies, cleaned up, and initialized Git before failing with `App name is too long (maximum is 30 characters)`. The supplied name was 39 characters. It left a 465 MiB uncommitted local scaffold and did not create the remote app.
- **Interpretation:** The stale organization issue is fixed. The failure is now valid input validation, but it occurs after several expensive side effects; rejecting a known overlength `--name` before template download/dependency installation would provide substantially better failure behavior. This is a reproducible non-blocking UX/performance finding in 4.8.5. The required app-init stage still needs a valid ≤30-character name.
- **Evidence:** `/tmp/shopify-cli-4-8-5-fresh-app-init.log`, local target inspection, and measured name length.
- **Next step:** Retry with the 19-character name `cli-qa-mac-485-1006` in a new absent target directory; preserve or delete the failed scaffold only after explicit cleanup approval.

## 2026-10-06 — Required fresh app-init stage passes

- **Change or action:** After explicit confirmation, ran Shopify CLI 4.8.5 app initialization with the valid 19-character name `cli-qa-mac-485-1006`, organization `150256644`, React Router TypeScript, and pnpm.
- **Observation:** The command resolved the sole global 4.8.5 executable, downloaded and parsed the template, installed dependencies, initialized Git, created the remote app, and exited successfully. The local project is 465 MiB, pins project-local `@shopify/cli` 4.8.5, and has a generated `shopify.app.toml` with a new Client ID. The Git repository has no commits and all scaffold files are untracked, which is the generated state. No deploy or store install occurred.
- **Interpretation:** The required create-new-app QA stage passes once stale CLI cache, duplicate global executables, and the invalid overlength test name are removed. Stable 4.8.5 can create a React Router app in `durga-test-store` on macOS arm64. The earlier name-validation behavior remains a separate non-blocking finding.
- **Evidence:** `/tmp/shopify-cli-4-8-5-short-app-init.log` and bounded local scaffold/config inspection.
- **Next step:** Generate the required admin action, theme app extension, TypeScript discount function, Flow action, and one additional extension, recording each result separately.

## 2026-10-06 — Three required extensions pass; admin-action flavor contract fails

- **Change or action:** After explicit confirmation, ran the four required extension-generation operations under global CLI 4.8.5 with inherited automation/client-ID variables removed and agent attribution set.
- **Observation:** Theme app extension, TypeScript discount function, and Flow action generation succeeded, creating `extensions/qa-theme-extension`, `extensions/qa-discount`, and `extensions/qa-flow-action`. The theme scaffold includes the expected `blocks/star_rating.liquid`; discount generation installed dependencies and built GraphQL types. Admin action generation with the CLI-documented `react` flavor failed: `Invalid template for extension type` and `Expected template to be ... preact`. However, `shopify app generate extension --help` lists allowed `--flavor` values as `vanilla-js|react|typescript|typescript-react|wasm|rust` and does not list `preact`.
- **Interpretation:** There is a contract mismatch between CLI 4.8.5's static flag options and the live admin-action template specification: the server requires `preact`, but non-interactive help/flag validation does not advertise it. The QA document's interactive command may still succeed by selecting the server-provided Preact choice, so that path needs a human/PTY check. This is a concrete CLI/package compatibility finding, not a local environment problem.
- **Evidence:** `/tmp/shopify-cli-4-8-5-generate-admin-action.log`, `/tmp/shopify-cli-4-8-5-generate-theme-extension.log`, `/tmp/shopify-cli-4-8-5-generate-discount.log`, `/tmp/shopify-cli-4-8-5-generate-flow-action.log`, generated extension files, and CLI help output.
- **Next step:** Run the QA document's interactive admin-action generator without a flavor flag and select its offered Preact option; then generate the additional random extension.

## 2026-10-06 — Correction: batch did not stop after first failure

- **Change or action:** Reviewed the batch execution control flow after the admin-action failure.
- **Observation:** The wrapper piped each command through `tee` without enabling `pipefail`, so the failed command's nonzero status was masked and the remaining three authorized generators continued.
- **Interpretation:** Continuing caused no unapproved remote mutation—the other three commands were explicitly confirmed and only generated local extension scaffolds—but it did not honor the stated stop-on-first-failure behavior. Future command batches must enable `set -o pipefail` or inspect `PIPESTATUS`.
- **Evidence:** Batch output order and shell wrapper.
- **Next step:** Use a single explicitly confirmed interactive admin-action command with PTY semantics; do not batch it with other operations.

## 2026-10-06 — Interactive admin-action generation passes with Preact

- **Change or action:** After explicit confirmation, ran the QA document's admin-action generator without a flavor flag under a pseudo-terminal and accepted the offered Preact selection.
- **Observation:** CLI 4.8.5 installed dependencies, updated shared type definitions, and created `extensions/qa-admin-action` successfully. The scaffold uses `preact`, `@preact/signals`, and `@shopify/ui-extensions` 2026.7.x; its source is `src/ActionExtension.jsx` and target is `admin.product-details.action.render`. The captured PTY output is extremely noisy because the Ink UI redraws were logged character-by-character, but the final success and generated files are unambiguous.
- **Interpretation:** The documented interactive path passes. The finding is narrower: CLI 4.8.5 cannot express the live required `preact` flavor through its advertised non-interactive `--flavor` enum, while interactive selection works.
- **Evidence:** `/tmp/shopify-cli-4-8-5-generate-admin-action-interactive.log` and generated admin-action files/config.
- **Next step:** Generate one additional random extension; use the documented `web_pixel` TypeScript scaffold for a deterministic non-interactive choice.

## 2026-10-06 — Additional Web Pixel extension passes

- **Change or action:** After explicit confirmation, generated a TypeScript `web_pixel` extension named `qa-web-pixel` under CLI 4.8.5 with agent attribution and the human auth alias.
- **Observation:** Generation, dependency installation, and shared type update succeeded. The extension contains `src/index.ts`, a strict-runtime `web_pixel_extension` config, and `@shopify/web-pixels-extension` ^2.10.0. The project now has all five intended extension directories and uses 534 MiB. A harmless zsh session-save warning appeared after the successful command because strict shell mode encountered an unset session parameter; the generator itself exited successfully and files are complete.
- **Interpretation:** The QA document's additional random-extension stage passes with a deterministic documented Web Pixel choice.
- **Evidence:** `/tmp/shopify-cli-4-8-5-generate-web-pixel.log` and generated files/config.
- **Next step:** Start `shopify app dev` against `durga-test-store.myshopify.com`, monitor the build/dev-console output, and pause at human browser/product/theme checks.

## 2026-10-06 — App dev reached storefront-password human gate

- **Change or action:** After explicit confirmation, launched CLI 4.8.5 `app dev` for the temporary app against `durga-test-store.myshopify.com` in detached tmux session `cli-qa-app-dev-485` with agent attribution and inherited automation/client-ID variables removed.
- **Observation:** The CLI resolved the expected organization, app, dev store, and URL-update setting. The first attempt piped output through `tee`, causing CLI to treat it as non-interactive and fail when it needed the storefront password. The same authorized command was restarted without an output pipe, with tmux `pipe-pane` capturing output instead. It is now interactively waiting for the store password from the store's Online Store preferences page.
- **Interpretation:** Organization/app/store context resolution passes. The first failure is harness-induced, not a CLI product failure; piping stdout changed TTY detection. The password is a human-only secret and must be entered directly into the tmux prompt, never sent to or recorded by the agent.
- **Evidence:** `/tmp/shopify-cli-4-8-5-app-dev.log`, `/tmp/shopify-cli-4-8-5-app-dev-interactive.log`, and live tmux prompt.
- **Next step:** User attaches to `cli-qa-app-dev-485`, enters the storefront password privately, and detaches; agent resumes monitoring after confirmation.

## 2026-10-06 — Interrupted app-dev state recovered

- **Change or action:** Reloaded the authoritative QA document through Google Workspace, reviewed the complete experiment notebook, and inspected the local workspace, CLI resolution, tmux sessions, running processes, and listeners after the interrupted run.
- **Observation:** The successful app scaffold and all five extension directories remain intact under `/Users/durga/cli-release-qa/macos-4.8.5/cli-qa-mac-485-1006`. No `cli-qa-app-dev-485` tmux session, Shopify app-dev process, or relevant local listener remains. The volatile `/tmp` app-dev logs are no longer present. Both the sole global executable and `pnpm shopify version` report 4.8.5 under Node 24.15.0.
- **Interpretation:** The interruption ended the local development session before the required Dev Console, hot-reload, GraphQL, theme-extension, and disconnected-preview checks were completed. The durable scaffold is reusable; the correct recovery is to restart `app dev` against the same temporary app and development store, not repeat initialization or extension generation.
- **Evidence:** Local bounded process, path, version, workspace, and listener checks on 2026-10-06; [QA flow](https://docs.google.com/document/d/1XX6QnS6kKZTT1shcCZVcso74VWn-Ui4V2IASenHHi1E/edit?tab=t.0).
- **Next step:** With explicit confirmation of the target and side effects, restart interactive `app dev` in a detached tmux session and have the user enter the storefront password privately if prompted.

## 2026-10-06 — App dev reaches ready state after recovery

- **Change or action:** Restarted CLI 4.8.5 `app dev` in detached tmux session `cli-qa-app-dev-485` against the temporary app and `durga-test-store.myshopify.com`. The user entered the storefront password privately in the interactive terminal.
- **Observation:** Organization, app, store, and automatic URL-update context resolved correctly. The React Router server and proxy started; Prisma generated its client, created the local SQLite database, and applied the default migration. GraphiQL started on port 3457 and the theme app extension server on port 9293. The admin action and Web Pixel bundled successfully, the discount function completed its build, the theme extension bundled, and the Flow action configuration was accepted. The CLI reached `Ready, watching for changes in your app`; app-preview, GraphiQL, and theme-setup/preview links are available. Startup emitted npm configuration and React Router future-flag warnings, plus transient app-not-responding webhook retries that recovered and delivered successfully.
- **Interpretation:** The required `app dev` startup/build stage passes. The warnings did not block readiness but should be compared with the nightly. The browser-only Dev Console connection, admin-action behavior, GraphQL query, and theme-extension setup/hot reload remain unverified.
- **Evidence:** Live tmux output and redacted `/tmp/shopify-cli-4-8-5-app-dev-interactive.log` on 2026-10-06. No storefront password or preview URL was recorded in the notebook.
- **Next step:** Open the app preview, confirm the app is the first Dev Console preview and green/connected, then test the admin action against an in-stock product.

## 2026-10-06 — Dev Console browser checks pass

- **Change or action:** Opened the running app preview from the interactive CLI and inspected it in the development store's Dev Console.
- **Observation:** The app loaded without an error. `cli-qa-mac-485-1006` appeared as the first development preview and showed a green Connected status.
- **Interpretation:** The required app-preview launch, Dev Console ordering, and live connection checks pass under CLI 4.8.5.
- **Evidence:** User-observed browser results while `cli-qa-app-dev-485` remained ready and connected on 2026-10-06.
- **Next step:** Open the admin-action extension against an in-stock product, confirm its modal renders, then change its displayed message and verify hot reload.

## 2026-10-06 — Product fixture prerequisite confirmed

- **Change or action:** Checked whether the development store has a suitable product fixture for extension testing.
- **Observation:** The user confirmed that `durga-test-store-dev` already contains products with positive stock as well as products for which inventory is not tracked.
- **Interpretation:** No product creation or inventory mutation is needed. An existing in-stock or untracked-inventory product can be used for the admin-action and later extension checks.
- **Evidence:** User-observed development-store product inventory state on 2026-10-06.
- **Next step:** From the Dev Console, open `qa-admin-action` against a suitable existing product and verify that its action modal renders the product title and controls.

## 2026-10-06 — Admin-action baseline modal passes

- **Change or action:** Opened the `qa-admin-action` Dev Console link against an existing suitable product in the development store.
- **Observation:** The product Admin page opened and the action modal rendered successfully with its expected baseline content and controls.
- **Interpretation:** Admin-action navigation, extension delivery, product-context GraphQL fetch, and initial modal rendering pass under the live CLI 4.8.5 development preview.
- **Evidence:** User-observed browser result while `cli-qa-app-dev-485` remained connected on 2026-10-06.
- **Next step:** Add a distinctive local message to `src/ActionExtension.jsx` and verify that the already-open action modal hot reloads it without restarting `app dev`.

## 2026-10-06 — Admin-action hot-reload change prepared and rebuilt

- **Change or action:** Added the distinctive message `CLI 4.8.5 hot reload check` to `extensions/qa-admin-action/src/ActionExtension.jsx` while the original `app dev` process remained running, then validated the 2026-07 `admin.product-details.action.render` source against the Admin UI Extensions component schema.
- **Observation:** Validation passed. The running CLI detected the source change, rebundled `qa-admin-action` successfully in 32 ms, reported `Extension changed`, and returned to `Ready, watching for changes in your app` without a restart or build error. The prior modal had been closed before this edit, so visible in-place browser refresh is not yet proven.
- **Interpretation:** File watching and incremental extension rebuilding pass. A browser observation with the modal left open during one more message change is still needed to distinguish true visible hot reload from merely loading the new bundle on reopen.
- **Evidence:** Validated local source and live redacted tmux output on 2026-10-06; merchant product identifiers were intentionally not recorded.
- **Next step:** Reopen the action modal, leave it open, confirm the current marker appears, then make one final message change and observe whether the open modal updates immediately.

## 2026-10-06 — Open-modal hot-reload probe triggered

- **Change or action:** The user reopened the modal, confirmed it displayed `CLI 4.8.5 hot reload check`, and left it open. While it remained open, changed that validated message to `CLI 4.8.5 hot reload verified` without restarting `app dev`.
- **Observation:** The revised 2026-07 Admin UI extension source passed component validation. CLI immediately reported `Extension changed`; the extension reran its product-context logging one second later and the process remained at `Ready, watching for changes in your app` with no rebuild error.
- **Interpretation:** The CLI and extension runtime reacted to the change while the modal was open. Final browser confirmation that the visible text changed in place, without closing/reopening the modal, remains required to mark hot reload passed.
- **Evidence:** User-observed pre-change modal plus validated local source and redacted live tmux output on 2026-10-06; product identifiers were intentionally omitted.
- **Next step:** Confirm whether the still-open modal changed to `CLI 4.8.5 hot reload verified` without being reopened.

## 2026-10-06 — Admin-action visible hot reload passes

- **Change or action:** Observed the still-open admin-action modal after changing its local source message from `CLI 4.8.5 hot reload check` to `CLI 4.8.5 hot reload verified`.
- **Observation:** The visible modal updated to the revised message without being closed or reopened.
- **Interpretation:** The required admin-action hot-reload behavior passes end to end: source watching, rebundling, runtime rerender, and in-place browser update all worked under CLI 4.8.5.
- **Evidence:** User-observed browser result correlated with the validated source edit and live CLI `Extension changed` event on 2026-10-06.
- **Next step:** Generate one additional extension while `app dev` remains active and verify that it appears dynamically in the Dev Console.

## 2026-10-06 — First live-add extension choice rejected at app limit

- **Change or action:** While `app dev` remained active, attempted to generate a second TypeScript Web Pixel named `qa-live-added` through CLI 4.8.5.
- **Observation:** The CLI exited 1 with `Invalid extension type: web_pixel` and explained that the app had reached its limit for `web_pixel_extension`. It created no target directory, and the original app-dev process remained healthy.
- **Interpretation:** This is expected constraint enforcement, not a CLI failure: the app already contains `qa-web-pixel`, and only one Web Pixel is allowed per app. The attempted extension type was unsuitable for testing dynamic addition. The QA check should be retried with an extension type that permits multiple instances.
- **Evidence:** CLI command result and bounded local path/process checks on 2026-10-06.
- **Next step:** With explicit confirmation, generate a second theme app extension named `qa-live-added-theme` while dev remains active, then verify dynamic Dev Console discovery.

## 2026-10-06 — Second live-add choice also rejected at app limit

- **Change or action:** Retried the live-add check with a second theme app extension named `qa-live-added-theme` while the original development session remained active.
- **Observation:** CLI 4.8.5 exited 1 and reported that the app had reached its limit for extension type `theme`. No target directory was created, and `app dev` remained healthy.
- **Interpretation:** Theme app extensions, like Web Pixels, are single-container extension types for this app; additional blocks belong inside the existing theme extension. This is expected limit enforcement and a second unsuitable test-fixture choice, not a CLI runtime failure. The next retry should use a multi-instance extension type rather than guessing another single-container type.
- **Evidence:** CLI command result and bounded local path/process checks on 2026-10-06.
- **Next step:** Verify a multi-instance extension type and, with explicit confirmation, use it for the dynamic Dev Console discovery check.

## 2026-10-06 — Live-added Flow action generated and detected

- **Change or action:** While the original `app dev` session remained active, generated a second Flow action named `qa-live-added-flow` through CLI 4.8.5.
- **Observation:** Generation succeeded and created only `extensions/qa-live-added-flow/shopify.extension.toml`. Without restarting `app dev`, the running process reported `qa-live-added-flow │ Extension created` and remained at `Ready, watching for changes in your app`.
- **Interpretation:** The required live project discovery path passes at the CLI level: a newly generated multi-instance extension is detected by the existing development process. Browser confirmation that the Dev Console added the new extension is still required.
- **Evidence:** Successful generator output, bounded local file inspection, and redacted live tmux output on 2026-10-06.
- **Next step:** Confirm that `qa-live-added-flow` appears in the already-open Dev Console without restarting `app dev`; note whether a browser refresh is required.

## 2026-10-06 — Dynamic Dev Console extension discovery passes

- **Change or action:** Observed the already-open Dev Console after the running CLI detected the newly generated `qa-live-added-flow` extension.
- **Observation:** `qa-live-added-flow` appeared automatically in the Dev Console as a Flow Action; no browser refresh and no `app dev` restart were required.
- **Interpretation:** The documented add-an-extension-during-development check passes end to end, including generation, live CLI discovery, preview update, and automatic Dev Console rendering.
- **Evidence:** User-observed browser result correlated with the CLI's `Extension created` event on 2026-10-06.
- **Next step:** Open GraphiQL from the running CLI and execute `query { shop { name } }`, then run the same read-only query through `shopify app execute`.

## 2026-10-06 — GraphiQL Admin query passes

- **Change or action:** Opened GraphiQL from the running CLI and executed the schema-validated read-only query `query { shop { name } }` against the development store.
- **Observation:** The response returned `data.shop.name` as `durga-test-store-dev` with no GraphQL errors. Requested and actual query cost were both 1, and throttle capacity remained available.
- **Interpretation:** The documented GraphiQL launch, Admin API authentication, query execution, and response rendering checks pass under CLI 4.8.5.
- **Evidence:** User-provided non-sensitive GraphiQL result on 2026-10-06; no token or transient URL was recorded.
- **Next step:** Execute the same read-only query through `shopify app execute` and compare its result with GraphiQL.

## 2026-10-06 — CLI Admin query execution passes

- **Change or action:** Ran the same schema-validated read-only query through global CLI 4.8.5 using `shopify app execute`, explicit Admin API version `2026-07`, the development-store domain, and the human auth alias.
- **Observation:** Authentication and GraphQL execution completed successfully. The command returned `shop.name` as `durga-test-store-dev`, matching the GraphiQL result, and exited without an error.
- **Interpretation:** The documented CLI GraphQL execution path passes and is consistent with the interactive GraphiQL path.
- **Evidence:** Non-sensitive CLI result on 2026-10-06; no credential, token, or transient URL was recorded.
- **Next step:** Set up the existing theme app extension in the host theme, save it, open the local theme-extension preview, and verify a Liquid source change hot reloads.

## 2026-10-06 — Theme app extension hot-reload probe triggered

- **Change or action:** The user set up the existing Star Rating app section in the host theme, saved it, and opened the local preview on port 9293. While that preview remained open, added the translated marker `CLI 4.8.5 theme hot reload check` to `blocks/star_rating.liquid` and its English locale file.
- **Observation:** Both the theme-app-extension Liquid block and locale JSON passed validation. The running CLI invoked theme check, bundled `qa-theme-extension`, reported `Extension changed` for the edits, stayed at `Ready, watching for changes in your app`, and kept the port 9293 preview listener active.
- **Interpretation:** Host-theme setup and the CLI's theme-extension watch/check/bundle path pass. Browser confirmation that the already-open preview visibly updated without a manual refresh remains required.
- **Evidence:** User confirmation of the open preview, validated local files, and redacted live tmux/process output on 2026-10-06.
- **Next step:** Confirm whether `CLI 4.8.5 theme hot reload check` appeared in the open local preview without manually refreshing it.

## 2026-10-06 — Theme Liquid hot reload passes; new locale key is unresolved

- **Change or action:** Inspected the already-open local theme preview after the validated Liquid and locale edits propagated.
- **Observation:** Without being directed to refresh, the preview changed in the Star Rating section and displayed `Translation missing: en.ratings.qa.hot_reload` where the new marker was inserted.
- **Interpretation:** Visible Liquid hot reload passes: the browser rendered the newly added translation expression in place after the CLI change event. The newly added, locally valid `en.default.json` key did not resolve in the active preview even though the CLI detected and bundled both edits. This is a separate non-blocking localization live-update/caching finding, not a failure of the documented Liquid hot-reload requirement. It should be compared with the nightly or reproduced after a clean dev restart before being classified as a CLI defect.
- **Evidence:** User-observed preview text, validated Liquid/locale files, and correlated CLI theme-check/bundle events on 2026-10-06.
- **Next step:** Restore the temporary marker changes, preserve this finding in the log, then stop `app dev` and test disconnected-preview and `app dev clean` behavior.

## 2026-10-06 — Temporary theme marker restored cleanly

- **Change or action:** Removed the temporary translation expression and locale key, restoring `star_rating.liquid` and `en.default.json` to their generated content.
- **Observation:** Both restored files passed validation. The running CLI theme-checked and bundled both changes, reported `Extension changed`, and remained ready without errors.
- **Interpretation:** The temporary QA instrumentation has been removed while preserving the localization observation in this notebook. The app-dev session is ready for the documented stop/disconnect/clean sequence.
- **Evidence:** Validated restored files and redacted live tmux output on 2026-10-06.
- **Next step:** Stop `app dev` with `q`, verify the Dev Console keeps a disconnected preview, then run `shopify app dev clean` and verify the preview is hidden.

## 2026-10-06 — Stopped preview is retained as disconnected

- **Change or action:** Stopped the interactive CLI development session with `q` and inspected both local process state and the Dev Console preview status.
- **Observation:** `app dev` exited cleanly with status 0 and explicitly reported that the development preview remains available until `shopify app dev clean` is run. Its child processes and ports 9293/3457 stopped. In the Dev Console, the user no longer saw the green Connected indicator while the preview remained listed.
- **Interpretation:** The documented stop behavior passes: ending the local process does not delete the remote preview, and its missing green connection indicator is consistent with the expected Disconnected state.
- **Evidence:** CLI exit output, bounded process/listener checks, and user-observed Dev Console state on 2026-10-06.
- **Next step:** With explicit confirmation, run `shopify app dev clean` for this temporary app/store and verify that the disconnected preview is hidden.

## 2026-10-06 — Development preview cleanup command passes

- **Change or action:** Ran CLI 4.8.5 `shopify app dev clean` for the temporary app on `durga-test-store.myshopify.com` using the human auth alias.
- **Observation:** The command exited successfully with `Dev preview stopped` and reported that the app's active version had been restored on the development store.
- **Interpretation:** The CLI cleanup operation passes. Browser confirmation that the disconnected preview is now hidden from the Dev Console remains required to complete the documented cleanup check.
- **Evidence:** Non-sensitive CLI success output on 2026-10-06.
- **Next step:** Refresh or reopen the Dev Console and confirm that the temporary development preview is no longer shown.

## 2026-10-06 — Development preview is hidden after cleanup

- **Change or action:** Refreshed or reopened the Dev Console after the successful `app dev clean` operation.
- **Observation:** The temporary development preview was no longer visible.
- **Interpretation:** The documented preview-cleanup behavior passes end to end: the CLI stopped the preview, restored the active app version, and removed the disconnected preview from the Dev Console.
- **Evidence:** CLI cleanup success plus user-observed Dev Console result on 2026-10-06.
- **Next step:** Build and locally run the generated TypeScript discount function with the QA document's JSON input fixture.

## 2026-10-06 — Discount function build and local run pass

- **Change or action:** From `extensions/qa-discount`, ran CLI 4.8.5 `shopify app function build`, then piped the QA document's cart/discount JSON fixture into `shopify app function run` without overriding the generated export.
- **Observation:** GraphQL type generation, JavaScript bundling, and Javy compilation completed with `Function built successfully`. The local run accepted the documented fixture and returned order and product discount operations with no error, followed by resource-limit and benchmark metrics.
- **Interpretation:** The required TypeScript discount-function compilation and local Wasm execution checks pass on macOS arm64 with Shopify Lockdown previously confirmed in Monitor mode. The current two-target generated function handled the documented command without requiring an explicit export.
- **Evidence:** Non-sensitive local CLI build/run output on 2026-10-06; the fixture contains only synthetic cart data.
- **Next step:** Deploy and release app version `v1`, then list app versions and confirm it appears.

## 2026-10-06 — App version v1 deploy and release pass

- **Change or action:** Ran CLI 4.8.5 `shopify app deploy --version=v1 --allow-updates` for the temporary app using the human auth alias.
- **Observation:** Before deployment, CLI removed the now-unsupported `build.include_config_on_deploy` field from `shopify.app.toml` and explained that configuration is always included. It then built the admin action, Web Pixel, theme extension, and discount function; ran validation; created the version; released `v1` to users; and exited successfully.
- **Interpretation:** The required build/deploy/release stage passes. Automatic removal of the stale generated configuration field is a noteworthy local-file migration side effect to compare with the nightly, but it did not block release.
- **Evidence:** Non-sensitive CLI deploy output on 2026-10-06. The returned Dev Dashboard version link is intentionally not copied into this notebook.
- **Next step:** Query the app's deployed-version list in JSON form and verify that released version `v1` is present and active.

## 2026-10-06 — Versions-list schema discovery is unavailable in 4.8.5

- **Change or action:** Before querying versions, tried the current agent-preferred `shopify app versions list --json-schema` discovery form locally.
- **Observation:** CLI 4.8.5 exited 2 with `Nonexistent flag: --json-schema`, although `app versions list --help` does advertise `--json` output.
- **Interpretation:** This stable version predates the generic JSON-schema discovery capability for this command. It is not a failure of the documented release QA flow; use the command's supported `--json` flag directly and inspect the bounded result.
- **Evidence:** Local CLI flag-validation output on 2026-10-06; no remote request or mutation occurred.
- **Next step:** With explicit confirmation, run the supported authenticated `app versions list --json` command and verify `v1`.

## 2026-10-06 — Released version v1 is listed as active

- **Change or action:** Queried the temporary app's deployed versions with CLI 4.8.5 `shopify app versions list --json` using the human auth alias.
- **Observation:** The bounded JSON result listed `v1` first with status `active`. It also showed one older auto-generated inactive version from the earlier app-development lifecycle.
- **Interpretation:** The documented version-list verification passes and confirms that the just-deployed `v1` release is the active app version.
- **Evidence:** Authenticated read-only CLI result on 2026-10-06; user and version GIDs were intentionally omitted from this notebook.
- **Next step:** Run `shopify app config link`, create a second temporary app/configuration, deploy to it, and verify that the deployment targets the new app rather than the original.

## 2026-10-06 — Second app creation and config linking pass

- **Change or action:** Ran interactive CLI 4.8.5 `shopify app config link`, selected `durga-test-store`, chose to create a new app named `cli-qa-485-linked-1006`, and targeted a separate local file `shopify.app.linked.toml`.
- **Observation:** The command exited 0, created the remote app, wrote the separate linked configuration, and selected it as the default without overwriting `shopify.app.toml`. The new configuration has the expected app name and access scopes. It also regenerated `build.include_config_on_deploy = true`, even though the immediately preceding deploy removed that field as unsupported.
- **Interpretation:** The documented create-and-link path passes. Regenerating a field that the same CLI version removes on deploy is a concrete internal consistency finding in 4.8.5; it is expected to be removed again when the linked app is deployed and should be compared with the nightly.
- **Evidence:** Redacted interactive CLI success output and bounded local configuration inspection on 2026-10-06; the new Client ID was intentionally not recorded.
- **Next step:** Deploy and release the project explicitly with `--config=linked`, then query versions with the same explicit config to prove that the new app—not the original—received the release.

## 2026-10-06 — Linked-app deploy and release pass

- **Change or action:** Ran CLI 4.8.5 `shopify app deploy --config=linked --version=v1 --allow-updates` using the separate configuration for `cli-qa-485-linked-1006`.
- **Observation:** CLI explicitly identified `shopify.app.linked.toml` and the new app as its target, again removed the unsupported `include_config_on_deploy` field, built and validated the extensions/function, released `v1`, and exited successfully.
- **Interpretation:** The required redeploy-to-a-new-app path passes at the command level, and explicit config selection prevented accidental deployment to the original app. The repeated generate-then-remove behavior for `include_config_on_deploy` is reproducible within 4.8.5.
- **Evidence:** Non-sensitive CLI deploy output and local linked-config inspection on 2026-10-06; the returned dashboard URL was intentionally not copied into this notebook.
- **Next step:** Query versions with `--config=linked` and verify that `v1` is active on the linked app.

## 2026-10-06 — Linked app version verification passes

- **Change or action:** Queried the second app's versions through CLI 4.8.5 using explicit `--config=linked` and JSON output.
- **Observation:** The result listed `v1` first with status `active`, independently of the original app's version list, plus the linked app's initial auto-generated inactive version.
- **Interpretation:** Deployment routing to `cli-qa-485-linked-1006` is proven, completing the app config-link/redeploy portion of the QA flow.
- **Evidence:** Authenticated read-only CLI result on 2026-10-06; user and version GIDs were intentionally omitted.
- **Next step:** Initialize a separate Hydrogen storefront from the documented defaults, then build and run it locally.

## 2026-10-06 — Hydrogen default initialization passes

- **Change or action:** Ran interactive global CLI 4.8.5 `shopify hydrogen init` into the clean `cli-qa-hydrogen-485-1006` path and accepted every displayed default.
- **Observation:** Initialization exited 0 after selecting mock.shop, JavaScript, Tailwind v4, npm, creation of the global `h2` alias, and subfolder-based markets. It installed dependencies, created a clean Git repository/initial commit, and produced a 588 MiB storefront with Hydrogen 2026.4.5. The generated project pins project-local `@shopify/cli` 3.93.2 even though scaffolding was invoked by global CLI 4.8.5; consequently `npm run build` would use a different CLI than the documented direct `shopify hydrogen build` command.
- **Interpretation:** Hydrogen scaffolding with default answers passes. The global `h2` alias and Git initialization are default local side effects. The generated local-CLI version mismatch is a reproducibility hazard: this stable-baseline QA must use and reverify the global 4.8.5 executable for direct Hydrogen commands, while separately noting what the generated npm scripts would resolve.
- **Evidence:** Redacted interactive output, local project/package metadata, clean Git state, and shell-alias inspection on 2026-10-06; `.env` values were not read or recorded.
- **Next step:** Run `shopify hydrogen build` through the verified global 4.8.5 executable, then launch global 4.8.5 `shopify hydrogen dev` and verify the mock.shop storefront.

## 2026-10-06 — Hydrogen production build passes under global 4.8.5

- **Change or action:** Reverified the global executable and version inside the Hydrogen project, then ran the documented direct `shopify hydrogen build` through `/Users/durga/.nvm/versions/node/v24.15.0/bin/shopify` 4.8.5 rather than the generated local 3.93.2 dependency.
- **Observation:** Vite 8.3.3 built both client and Oxygen server bundles successfully. Output included repeated `envFile` deprecation notices, React Router v8 future-flag warnings, and a `transformWithEsbuild` deprecation warning, but no build error. Production artifacts and a server bundle report were created under `dist/`.
- **Interpretation:** The required Hydrogen build stage passes under the intended stable CLI version. The warnings and global-vs-local CLI discrepancy are useful nightly comparison points, not blockers.
- **Evidence:** Local global-path/version checks, bounded package metadata, and successful build output on 2026-10-06.
- **Next step:** Start global 4.8.5 `shopify hydrogen dev`, open its local storefront URL, verify mock.shop products render, then stop the server.

## 2026-10-06 — Hydrogen dev server and storefront response pass

- **Change or action:** Started global CLI 4.8.5 `shopify hydrogen dev` in detached tmux session `cli-qa-hydrogen-dev-485`, requested the local home page, and opened it in the user's default browser.
- **Observation:** MiniOxygen started on localhost port 3000 with only the local `SESSION_SECRET` variable reported as injected. The home page returned HTTP 200 with no error-page signature, title `Hydrogen | Home`, mock.shop navigation/content, and rendered recommended products including Hoodie, Beanie, High Top Sneakers, and Clear Sunnies. Startup repeated the existing `envFile` and React Router future-flag warnings but did not fail.
- **Interpretation:** The required Hydrogen local-dev startup and server-rendered mock.shop storefront checks pass technically. A final user visual confirmation in the opened browser remains before stopping the server.
- **Evidence:** Redacted live CLI output and bounded HTTP response inspection on 2026-10-06; no environment-variable values were read or recorded.
- **Next step:** Confirm the storefront is visibly rendered in the browser, then stop the Hydrogen dev server.

## 2026-10-06 — Hydrogen storefront visual check passes and server stops

- **Change or action:** Visually inspected the browser-opened Hydrogen home page, then intentionally stopped the tmux-hosted development server with Ctrl-C.
- **Observation:** The user confirmed the storefront was visible. The page matched the HTTP evidence with mock.shop navigation and product content. After Ctrl-C, the process ended and localhost port 3000 closed. The signal-driven pane status was 1, but shutdown was intentional and left no listener.
- **Interpretation:** The required Hydrogen init/build/dev/browser flow passes under global CLI 4.8.5. The mock.shop analytics warning is an expected limitation of the test data source, not a storefront failure.
- **Evidence:** User visual confirmation, HTTP 200/rendered-content inspection, redacted CLI request logs, and post-stop listener check on 2026-10-06.
- **Next step:** Conclude the stable macOS baseline, preserve the findings and nightly comparison checklist, and coordinate delegated theme/cross-OS QA only for an actual release.

## 2026-10-06 — Stable macOS baseline concluded

- **Change or action:** Reviewed the documented macOS scope against the chronological evidence after completing the app, extension, GraphQL, theme-app-extension, cleanup, function, deploy/link, and Hydrogen stages.
- **Observation:** Every required grouped macOS checkpoint eventually reached its expected end state. Several setup and compatibility hazards were reproduced and resolved or classified, with no unexplained blocker remaining. Standalone theme QA, Linux, Windows, and release-nightly publication were intentionally outside this rehearsal's scope.
- **Interpretation:** Shopify CLI 4.8.5 provides a successful stable macOS baseline for the same flow on a future nightly. Success does not erase the findings: they are the specific behaviors to compare during nightly QA.
- **Evidence:** This chronological log and the summarized `RESULTS.md`.
- **Next step:** Use the results checklist for the nightly rerun; for a real release, coordinate the themes engineer and complete Linux/Windows coverage before a GO decision.

## 2026-10-06 — Linked app v1 is verified active

- **Change or action:** Queried deployed versions with CLI 4.8.5 `app versions list --config=linked --json` using the human auth alias.
- **Observation:** The linked app's bounded result listed `v1` first with status `active`, plus one older auto-generated inactive version associated with initial app creation.
- **Interpretation:** The documented config-link/redeploy verification passes end to end: a second app was created and linked, deployment was explicitly routed to it, and its released `v1` is independently confirmed active.
- **Evidence:** Authenticated read-only CLI result on 2026-10-06; user and version GIDs were intentionally omitted.
- **Next step:** Initialize a Hydrogen storefront with default choices, build it, run its local dev server, and verify the storefront renders.

## 2026-10-07 — Windows command transfer falls back to a mounted ISO

- **Change or action:** Prepared the Windows 4.9.0 handoff commands for a Windows 11 ARM Insider Preview VM running under UTM 4.7.5. UTM clipboard sharing was enabled, but Windows Guest Tools 0.1.271 crashed the guest during each of two installation attempts. Windows recovered after a VM restart, but Guest Tools was not listed as installed and host-to-guest clipboard sharing remained unavailable. A temporary HTTP transfer was also attempted through the QEMU shared-network host address and the macOS LAN address, but Edge in the guest could not reach the page.
- **Observation:** Created a small ISO containing the Windows section of `CROSS_OS_COMMANDS_4_9_0.md` as HTML and plain text, mounted it through UTM's removable CD drive, and opened it inside Windows. The user confirmed that this worked, allowing normal Windows-internal copy/paste into PowerShell without Guest Tools. The reproducible host-side packaging mechanism was `hdiutil makehybrid -iso -joliet -o <output.iso> <staging-directory>`.
- **Interpretation:** A mounted ISO is a reliable command-transfer fallback when UTM Guest Tools, shared clipboard, shared folders, and host-local HTTP transfer are unavailable. This workaround only proves file transfer into the guest; it does not validate Guest Tools compatibility or general Windows networking, both of which remain separate environment findings.
- **Evidence:** UTM VM configuration inspection, two observed Guest Tools installation crashes and recoveries, failed guest browser access to the temporary host server, and user confirmation that the mounted ISO was readable on 2026-10-07. No crash stop code was captured.
- **Next step:** Continue the Windows nightly QA from the mounted command file. Record internet access separately before CLI installation and preserve any future Guest Tools BSOD stop code rather than retrying the installer repeatedly.

## 2026-10-07 — Windows CLI authentication requires exact cross-device activation URL

- **Change or action:** Ran nightly 4.9.0 `shopify auth login` in the Windows UTM guest. The CLI opened Chrome in the guest, where the Shopify employee sign-in path was rejected with `You do not have permission to perform the requested action`. The browser identity and device policy behind that denial were not independently confirmed. Kept the CLI's device-authorization model but moved browser approval to the macOS host.
- **Observation:** Opening the generic `https://shopify.com/activate` page on macOS and entering the code failed with `We were unable to verify that your request originated from Shopify`, consistent with a login-session/request-verification failure. The working sequence was to cancel the stale CLI attempt, run `shopify auth login` again, leave PowerShell polling, and open the newly generated complete URL in a fresh private browser session on the Mac: `https://accounts.shopify.com/activate-with-code?device_code%5Buser_code%5D=<fresh-user-code>`. Completing that flow within the roughly ten-minute authorization window authenticated the Windows CLI successfully.
- **Interpretation:** Cross-device approval is a viable workaround when an employee login cannot complete inside the Windows VM, but the generic activation page is not reliable for this environment. The exact, fresh `verification_uri_complete` URL emitted by the CLI must be preserved; stale codes, Back navigation, and duplicate submission should be avoided. This is environment/authentication friction rather than a demonstrated Shopify CLI functional failure.
- **Evidence:** User-observed browser errors followed by successful completion of the fresh exact-link flow on 2026-10-07. No user verification code, token, cookie, or request ID was retained.
- **Next step:** Continue Windows QA with the authenticated session. If authentication must be repeated, generate a new code and perform the exact-link approval from the trusted macOS browser rather than the guest browser or generic activation page.
