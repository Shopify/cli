# App config validate stack rewrite plan

Date: 2026-03-26
Repo: /Users/donald/src/github.com/Shopify/cli
Current branch: dlm-app-validate-malformed-extension-configs

## Why this note exists

We are low on working context and have already rewritten/restacked this validation stack once. This note captures the current architectural diagnosis and a proposed second rewrite that better aligns with the Project extraction and avoids leaking command-shaped error state across lower layers.

This file is local planning context, not intended for commit.

---

## Current simplified stack

Merged already:
- #7069 — no-color for JSON
- #7065 — add `--json`

Open stack now:
1. #7066 / `dlm-app-validate-errors`
   - preserve structured app validation issues internally
   - current rewritten tip: `123cec3df3`
2. #7090 / `dlm-app-validate-error-layer`
   - expose structured local configuration issues in `app config validate --json`
   - current rewritten tip: `f321549426`
3. #7106 / `dlm-app-validate-malformed-extension-configs`
   - align project-backed config failures with `app config validate --json`
   - current rewritten tip: `f145c52781`

Closed as superseded:
- #7070
- #7103

---

## Historical / architectural backdrop

The key upstream architectural move was the extraction of filesystem discovery into the Project model:
- `Project` discovers filesystem state and malformed TOML metadata
- `ActiveConfig` selects one config from discovered state
- loader builds and validates an `App` from selected inputs
- command/service serialize user-facing output

The original intent of Project was to separate:
- filesystem / OS concerns
from:
- Shopify-specific loading and command behavior

That extraction is directionally right and should not be undone.

However, our current stack uses `AppConfigurationAbortError` across:
- Project / ActiveConfig
- loader / config parsing
- command JSON serialization

That is workable, but it means a command-facing abort type is acting as the shared cross-layer error currency for local config discovery/parse/validation failures.

That is the main place where the current architecture still feels leaky.

---

## Architectural diagnosis

### What is good in the current stack

- structured issues are preserved internally instead of flattening to strings too early
- public JSON no longer has to parse rendered CLI text back into machine-readable output
- Project retains malformed discovery facts instead of silently dropping them
- loader does not take ownership of filesystem discovery back from Project
- command/service own the public `{valid, issues}` contract

### What still feels wrong

The primary architectural compromise is:

> `AppConfigurationAbortError` spans too many layers and mixes local config/domain failures with command/abort semantics.

Concretely:
- lower layers throw an error whose name and usage are partly shaped by command behavior
- command layer recognizes that same type as the signal to serialize JSON
- `ConfigurationError` currently derives from that command-relevant error family rather than from a lower-level local-config failure abstraction

This is the main thing to fix in a rewrite.

---

## Rewrite goal

Keep the current Project / ActiveConfig / loader / command layering, but replace the shared command-shaped error path with a lower-level structured local-config error type.

### Desired principle

Project should discover and retain local config facts.
Loader should validate/build from those facts.
Commands should decide how local config failures are serialized into the public JSON contract.

### Non-goals

- do not move filesystem discovery back into loader
- do not reintroduce AppLoaderMode / AbortOrReport / callback-threaded loading
- do not go back to parsing human-readable text as a machine interface

---

## Proposed target architecture

### 1. Introduce a lower-level structured local-config error

Candidate names:
- `LocalConfigError`
- `ConfigurationIssueError`
- `AppConfigLoadError`

Preferred for now: `LocalConfigError`

This should be the shared structured error type for lower layers.

It should carry:
- `issues: AppValidationIssue[]`
- possibly a message / file path only; avoid adding too much shape unless there is a demonstrated need

This type should be conceptually lower-level than command abort behavior.

### 2. Remove `AppConfigurationAbortError` as the shared lower-layer currency

Options:
- delete it entirely, or
- keep it only as a command-edge wrapper if the CLI framework still wants an abort-specific type

Preferred rewrite:
- lower layers throw `LocalConfigError`
- command/service catch `LocalConfigError` and emit `{valid, issues}` in JSON mode
- non-JSON mode continues through the normal CLI error path

### 3. Keep `AppValidationIssue` / `parseStructuredErrors(...)`

These are still the right internal structured currency.

Keep:
- `AppValidationIssue`
- `AppValidationFileIssues`
- `parseStructuredErrors(...)`
- path/pathString helpers
- current union-selection alignment with human-readable output

### 4. Keep `validation-result.ts`

This is the right owner for the public machine-readable contract:
- `{valid, issues}`

No change needed except swapping the lower-level error type the command catches.

### 5. Project should retain malformed TOML metadata as facts

Keep this design:
- malformed app config metadata
- malformed extension config metadata
- malformed web config metadata

That is consistent with Project being the owner of filesystem discovery facts.

What should change is not the retained metadata, but the error abstraction used when that metadata becomes a user-visible failure.

### 6. ActiveConfig should own selection-only failure behavior

`selectActiveConfig()` should throw `LocalConfigError`, not a command-shaped abort error.

It should be responsible for:
- selecting the active config
- surfacing malformed selected config failures as structured local config errors

It should not own JSON behavior.

### 7. Loader should stay close to current narrowed `#7066`

Keep the narrowed loader architecture from `123cec3df3`:
- no AppLoaderMode
- no AbortOrReport
- no callback-threaded control flow
- `ConfigurationError` or equivalent may exist, but it should be lower-level and not inherit from a command-facing type

Two acceptable shapes:

#### Option A: unify on one lower-level error type
- parse helpers throw `LocalConfigError`
- Project / ActiveConfig throw `LocalConfigError`
- loader catches/records `LocalConfigError`

#### Option B: keep `ConfigurationError`, but make it lower-level
- `ConfigurationError extends Error` or `ConfigurationError extends LocalConfigError`
- Project / ActiveConfig use `LocalConfigError`
- command catches both and normalizes

Preferred if rewriting aggressively: **Option A**.

---

## Proposed rewritten stack

### PR 1 — Preserve structured issues internally
Equivalent role to current `#7066`, but keep it strictly internal.

Scope:
- `AppValidationIssue`
- `AppValidationFileIssues`
- `parseStructuredErrors(...)`
- `AppErrors` stores both rendered messages and structured issues

No public JSON changes.
No command-edge error type.

### PR 2 — Introduce lower-level `LocalConfigError`
New rewrite PR.

Scope:
- add `LocalConfigError`
- use it in:
  - Project discovery failures
  - ActiveConfig selection failures
  - loader/config parse failures
- ensure lower layers all speak the same structured local-config failure language

Still no public JSON change.

### PR 3 — Expose public JSON contract for local config failures
Rewrite of current `#7090`.

Scope:
- `validation-result.ts`
- `validate.ts` uses `{valid, issues}`
- `app config validate` catches `LocalConfigError`
- no text-parsing fallback
- unrelated operational failures stay on normal CLI path

This becomes a much cleaner command/service PR once lower layers no longer throw command-shaped aborts.

### PR 4 — Surface malformed discovered configs
Rewrite of current `#7106`.

Scope:
- Project retains malformed discovered extension/web config metadata
- config-selection filters malformed discovered files to active config
- loader reports those malformed discovered files through the existing error aggregation path
- selected malformed app config failures already flow via `LocalConfigError`

This remains the final PR.

---

## If we want a smaller PR count

Possible 3-PR rewrite:
1. internal structured issues
2. lower-level local-config error + public JSON contract
3. malformed discovered config follow-up

This is probably the best practical compromise if we rewrite again.

---

## File-by-file rewrite targets

### Likely keep mostly as-is
- `packages/app/src/cli/models/app/error-parsing.ts`
- `packages/app/src/cli/services/validation-result.ts`

### Likely add / rename
- a new lower-level shared error file, e.g.:
  - `packages/app/src/cli/models/app/local-config-error.ts`
  - or `packages/app/src/cli/models/project/local-config-error.ts`

### Likely rewrite
- `packages/app/src/cli/models/project/project.ts`
- `packages/app/src/cli/models/project/active-config.ts`
- `packages/app/src/cli/models/app/loader.ts`
- `packages/app/src/cli/services/validate.ts`
- `packages/app/src/cli/commands/app/config/validate.ts`

### Likely strengthen tests
- `packages/app/src/cli/models/project/project.test.ts`
- `packages/app/src/cli/models/project/active-config.test.ts`
- `packages/app/src/cli/models/project/config-selection.test.ts`
- `packages/app/src/cli/models/app/loader.test.ts`
- `packages/app/src/cli/services/validate.test.ts`
- `packages/app/src/cli/commands/app/config/validate.test.ts`

---

## Success criteria for the rewrite

### Architecture
- lower layers do not throw command-shaped error types
- command layer is the first layer that cares about abort/CLI semantics
- Project remains the owner of discovery facts
- loader remains a consumer/validator, not a rediscovery layer

### Behavior
- `shopify app config validate --json` returns `{valid, issues}` for all local config discovery / selection / parse / validation failures in scope
- unrelated auth/network/platform failures remain normal CLI errors
- malformed selected app configs surface parse errors, not generic missing-file errors
- malformed discovered extension/web configs do not silently disappear

### Testing
- filesystem-backed regression coverage for:
  - missing app root
  - malformed selected app config
  - malformed discovered extension config
  - malformed discovered web config
  - mixed multi-config selection cases

---

## Current implementation status vs rewrite target

Current code is directionally close, but not yet at the target architecture:
- structured issue preservation: **done**
- public JSON contract: **done**
- malformed discovered config retention/surfacing: **done**
- lower-level shared local-config error abstraction: **not done**
- command semantics isolated to command/service edge: **not fully done**

The largest remaining architectural gap is still the shared use of `AppConfigurationAbortError` across lower layers.

---

## Recommended next implementation steps

1. Add a local note/patch plan before touching code again.
2. Introduce `LocalConfigError` (or chosen lower-level type) without changing public behavior yet.
3. Convert Project + ActiveConfig to use that lower-level type.
4. Convert loader/config parse helpers to use that lower-level type.
5. Update command/service JSON handling to catch the new lower-level type.
6. Remove or demote `AppConfigurationAbortError` to command-edge behavior only.
7. Re-run the focused validation suites and build.

---

## Open architectural questions

1. Should `ConfigurationError` survive as a separate type, or should everything collapse into one lower-level `LocalConfigError`?
   - preference: collapse unless we discover a strong need for distinction

2. Where should the lower-level error type live?
   - `models/app/` is pragmatic because `AppValidationIssue` already lives nearby
   - `models/project/` would be narrower but might be awkward once loader parse failures also use it
   - current preference: keep it near the structured issue types, but with a lower-level name

3. Should we add error `kind` metadata now?
   - preference: not initially
   - only add it if command/service or tests clearly need it

---

## Notes for future context recovery

If context collapses again, the key thing to remember is:

> The next rewrite is not about changing the JSON contract or undoing Project. It is about replacing `AppConfigurationAbortError` with a lower-level structured local-config error type so command abort behavior stops leaking across layers.
