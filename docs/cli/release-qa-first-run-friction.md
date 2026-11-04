# Release QA first-run friction handoff

> **Temporary investigation note — do not merge.** This document gives reviewers a
> line-commentable surface for assigning follow-up work. Close the draft PR after
> the findings have owners or have moved to durable issues/documentation.

## Why this exists

A tester setting up Shopify CLI release QA from scratch exercised stable 4.8.5,
an early 4.9 nightly, and the immutable 4.9 release candidate on macOS, Linux,
and Windows. The candidate eventually passed the required functional coverage,
but setup and attribution required many retries that were unrelated to product
regressions.

This summary is a sanitized synthesis of four detailed QA notebooks. At the
experiment owner's request, the original logs are also attached unchanged:

- [Stable 4.8.5 macOS](release-qa-first-run-logs/shopify-cli-4-8-5-macos-qa/LOG.md)
- [4.9 candidate macOS](release-qa-first-run-logs/shopify-cli-4-9-0-candidate-macos-qa/LOG.md)
- [4.9 nightly Linux and Windows](release-qa-first-run-logs/shopify-cli-4-9-0-nightly-linux-windows-qa/LOG.md)
- [4.9 pre-candidate nightly macOS](release-qa-first-run-logs/shopify-cli-4-9-0-nightly-macos-qa/LOG.md)

The attached logs contain original account, store, app, request, and
local-machine details and should be treated as investigation artifacts.

## Executive summary

The largest source of friction was not running the QA checks. It was proving
that each check ran with the intended candidate, runtime, account, architecture,
working directory, and terminal semantics.

A first-time tester currently has to discover several unwritten invariants:

1. A completed release workflow does not mean the package and mutable npm tag
   are already available.
2. `shopify` may resolve to a different npm, pnpm, Yarn, project-local, or
   shell-cached installation than expected.
3. Authentication can be affected by inherited automation variables and stale
   cached organization state even when Dashboard access is valid.
4. Interactive commands stop behaving interactively when output is piped.
5. Windows VM architecture and working-directory choice can determine whether
   Hydrogen installs and whether Node can rewrite build artifacts.
6. Scope, fixture, and extension-limit assumptions are not explicit enough for
   someone performing the checklist for the first time.

## Friction observed

| Priority | Area | What happened | Impact on a first-time tester | Requested disposition |
| --- | --- | --- | --- | --- |
| P0 | Candidate identity | macOS installed the mutable `nightly` tag after the release workflow completed but before the newly published package/tag was visible. Linux installed later and received a different build. | The first complete macOS pass tested the wrong immutable package and had to be repeated. | Publish an immutable candidate manifest only after registry availability is verified. The runbook should pin that version rather than a mutable tag. |
| P0 | Windows architecture | The available Windows VM was ARM64. Hydrogen's `workerd` dependency rejected native `win32-arm64`; portable x64 Node under Windows emulation worked. | The blocker initially looked like a candidate install or filesystem regression and led to several ineffective cleanup attempts. | State supported/tested OS architectures before VM creation and fail preflight before scaffolding when the runtime architecture is unsupported. Decide whether native Windows ARM64 is in scope. |
| P0 | Command resolution | Older npm, pnpm, and Yarn global CLIs coexisted. zsh command hashing continued to resolve an older binary after installing the target version. Generated projects could also resolve a different local CLI. | Results were briefly attributed to 4.8.5 when one probe had actually run with 4.7.0. | Add a cross-shell command-resolution preflight that lists every `shopify` executable and checks global plus project-local versions. |
| P0 | Harness semantics | Piping `app dev` through `tee` removed TTY semantics at a secret prompt. A shell pipeline without `pipefail` masked a failed generator. Pasted PowerShell statements continued after failed guards and printed an unconditional PASS message. | Harness behavior created false product failures and false success signals. | Supply executable Bash/PowerShell harnesses with strict error handling, real-TTY guidance, conditional success markers, and secret-safe logging. |
| P1 | Linux pnpm bootstrap | `pnpm setup` updated a future shell but did not configure the current one. The global bin path was empty, and a registry argument copied from the release instructions was rejected. | Setup stopped before CLI installation and required hand-correcting `PNPM_HOME`, `PATH`, `global-bin-dir`, pnpm version, and registry syntax. | Provide tested current-shell bootstrap commands for each guest OS and pin the expected pnpm version. |
| P1 | Auth environment | Inherited client-ID and app-automation-token variables changed the account/organization path used by `app init`. | Errors looked like missing organization permissions even though the intended human account had Dashboard access. | Preflight should report the **names only** of behavior-changing Shopify environment variables and ask the tester to use an isolated shell/profile. |
| P1 | Cached organization state | `app init` repeatedly returned `No Organization found` despite valid Dashboard access and fresh OAuth. The path succeeded after duplicate globals were removed and the CLI cache was cleared. | The tester investigated roles, OAuth, organization APIs, and a Dashboard-created workaround before returning to a clean state. | Put `shopify cache clear` and explicit auth/account verification in the clean-room setup. Improve diagnostics so cache, destination access, and permissions are distinguishable. |
| P1 | Auth alias expectations | `shopify auth login --alias <new-name>` did not create or rename an alias after selecting an existing session; the usable alias remained the account identifier. | A successful login appeared to fail on the next command. | Clarify alias behavior in release instructions or expose a way to list the exact alias to reuse. |
| P1 | Windows project path | The original Windows project repeatedly returned `EPERM` while rewriting package/config/metafile/Wasm/deploy-bundle files. A clean copy under `%LOCALAPPDATA%` installed, built, deployed, and verified successfully. The exact VM filesystem/security cause was not isolated. | Repeated failures across unrelated files looked like a deterministic CLI regression and consumed most of the Windows setup effort. | Prescribe a local, writable, non-shared QA root; add a write/rename/delete probe; record filesystem attributes and security tooling when it fails. Do not claim a root cause from this run. |
| P1 | Scope ownership | “Theme QA is delegated” was initially interpreted to exclude the app's theme app extension as well as standalone theme commands. The app extension check was recovered later. | A required candidate check was nearly omitted. | Separate standalone theme CLI ownership from theme app extension coverage in the checklist. |
| P1 | Fixture assumptions | The run required a development organization, development store, storefront password, suitable products, and temporary app cleanup. These prerequisites were discovered while executing. | Setup paused at multiple human gates and risked using the wrong kind of organization or resource. | Add a fixture inventory, safe-target confirmation, secret-entry instructions, naming scheme, and cleanup owner before commands begin. |
| P2 | App naming | An over-30-character app name was rejected only after template download, dependency installation, Git initialization, and creation of a roughly 465 MiB local scaffold. | A reasonable descriptive QA name caused a slow failure and left cleanup work. | Document the name limit in the runbook and validate it before local side effects in the CLI. |
| P2 | Extension selection | A second Web Pixel and then a second theme app extension were selected for the “add during dev” check, but both hit per-app limits. A second Flow action worked. | Correct limit enforcement looked like two failed attempts because the fixture choice was unspecified. | Prescribe a known multi-instance extension type for this check. |
| P2 | Install warnings | pnpm reported ignored `esbuild` and `core-js` build scripts. `esbuild` still functioned on the tested machine. | The tester could not tell whether to stop before remote mutations. | Define functional preflight probes and classify which install warnings are expected, blocking, or evidence-only. |

## Candidate findings discovered during setup

These are product or packaging findings, not reasons to make the release setup
more complicated. They need normal issue ownership rather than more runbook
workarounds.

- Candidate `app dev` repeatedly logged `Error while polling app logs` at
  five-second intervals on macOS and Linux/Windows runs. Required app-dev flows
  continued to work; stable 4.8.5 had not shown the warning.
- Admin-action help advertised `react` but not the live-required `preact`
  flavor. Explicit `react` failed; flavorless generation selected Preact and
  succeeded.
- App init/config link generated `build.include_config_on_deploy = true`, then
  deploy removed the same field as unsupported.
- Hydrogen init described stable 4.8.5 as an upgrade from the `0.0.0-nightly-*`
  candidate.
- Candidate-generated Hydrogen projects pinned project-local Shopify CLI
  3.93.2 while QA intentionally invoked the newer global candidate.
- Stable app-name validation happened after expensive scaffolding side effects.
- `app versions list --json-schema`, unavailable in stable 4.8.5, worked in the
  candidate.

## Proposed first-run contract

### 1. Release owner publishes a candidate manifest

The handoff should contain one immutable block:

```text
package: @shopify/cli
version: <immutable version>
git SHA: <source SHA>
registry: <registry URL>
integrity: <npm dist.integrity>
Node: <supported version>
pnpm: <supported version>
OS/architecture matrix: <required combinations>
```

The release job should verify that this exact version can be read from the
registry before telling testers to install it. QA scripts should reject a
mutable tag and print expected versus actual version before any remote mutation.

### 2. One preflight per operating system

The preflight should stop on the first failed invariant and emit a sanitized
report containing:

- OS version, platform, and architecture;
- Node, npm, and pnpm versions and architectures;
- every resolved `shopify` executable;
- global and project-local Shopify CLI versions;
- exact candidate version and package integrity;
- presence, by name only, of behavior-changing Shopify environment variables;
- CLI cache reset and selected human account/alias;
- development organization/store availability;
- working-directory write, rename, and delete checks;
- TTY availability for interactive commands; and
- native dependency smoke tests needed by app and Hydrogen flows.

No app should be created until preflight prints a conditional PASS.

### 3. The runbook declares resources and side effects

Before execution, list:

- who owns app QA, standalone theme QA, and theme app extension QA;
- the development organization and store selection criteria;
- required products and storefront state;
- app-name length and a collision-safe naming pattern;
- the extension type used for the live-add check;
- which commands create apps, deploy versions, alter theme state, or retain
  previews;
- where a human must enter a password or use a browser; and
- who removes temporary apps, projects, versions, previews, and theme changes.

### 4. The harness is resumable and evidence-safe

- Number sections and give each a guarded success marker.
- Use strict shell modes and executable scripts rather than pasted statement
  sequences.
- Preserve a real TTY for prompts; capture sanitized output around it rather
  than piping the command itself.
- Never print credentials, device codes, passwords, client IDs, or transient
  preview URLs.
- Record exact versions again after any shell restart, runtime switch, or
  project-directory change.
- Separate failures into candidate, backend, VM/environment, harness, and
  missing-prerequisite categories before making the release decision.

## Suggested ownership split

| Owner | Decision or deliverable |
| --- | --- |
| Release automation | Candidate manifest, registry-readiness gate, immutable install command |
| Release QA/runbook | OS scripts, scope matrix, fixture inventory, evidence template, cleanup checklist |
| CLI install/auth | Duplicate-resolution diagnostics, environment-variable visibility, cache/alias guidance |
| Hydrogen | Supported Windows architecture statement and native Windows ARM64 disposition |
| Windows VM/tooling | Known-good local QA root and filesystem/security diagnostics |
| App CLI owners | App-name validation, Preact flavor metadata, stale generated config, app-log polling |
| Hydrogen CLI owners | Nightly upgrade notice and generated local CLI version |

## Definition of done for follow-up

This handoff can be closed when:

- a new tester can install the intended immutable candidate on each required OS
  without undocumented package-manager or PATH recovery;
- preflight prevents testing the wrong CLI version or unsupported architecture;
- interactive commands and failure guards cannot produce false pass/fail
  signals;
- auth/cache/environment prerequisites are explicit and diagnosable;
- Windows QA starts in a known-good local path and records enough evidence to
  route an `EPERM` failure;
- standalone theme versus theme app extension ownership is unambiguous; and
- each product finding above has an owner, issue, or explicit no-action
  decision.

## Questions for reviewers

1. Which team should own the release-candidate manifest and registry-readiness
   gate?
2. Is native Windows ARM64 intended to be supported for Hydrogen release QA, or
   should x64 be the required guest/runtime?
3. Can one supported preflight command replace the current collection of manual
   PATH, cache, auth, architecture, and writable-directory checks?
4. Which candidate findings should block a release versus move to post-release
   follow-up?
5. Where should the durable release runbook live after this temporary PR is
   closed?
