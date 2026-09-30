# CLI lifecycle and time-dependent state

Use these variants when bootstrap, base-command, API callbacks, or success/error hooks reach the corresponding reader. A hook can run before the command body, after its result, or while handling a failure. Record the command filter, gates, and whether background work is awaited. The source baseline is CLI commit `8829ed581d25f964c53564c403bfbf94484753b4`. Recheck changed readers and dependency versions before reusing an outcome.

## Deprecation warning dates

A successful command can print `Upgrade to the latest CLI version by …` after the command result. API response deprecations supply the timestamp; the postrun hook formats it with `Intl.DateTimeFormat('default', {year: 'numeric', month: 'long', day: 'numeric'})`.

The formatter specifies neither a timezone nor a fixed output language. The runtime's resolved locale, timezone, and ICU data affect the displayed date. `TZ` can select the timezone in supported Node environments. `LANG`, `LC_ALL`, and OS/runtime settings can influence the default locale; Shopify flags do not select it. Verify `resolvedOptions().locale` and `resolvedOptions().timeZone` instead of assuming an environment string was honored.

For the same timestamp, `2030-01-01T00:00:00Z`, fresh-process probes produced:

| Resolved locale | Resolved timezone     | Date in the warning |
| --------------- | --------------------- | ------------------- |
| `en-US`         | `UTC`                 | `January 1, 2030`   |
| `en-US`         | `America/Los_Angeles` | `December 31, 2029` |
| `fr-FR`         | `UTC`                 | `1 janvier 2030`    |

Only the date fragment is locale-formatted here; the surrounding warning text remains the CLI's English string. The timezone does not change the underlying deadline instant. A timestamp without a timezone is a separate date-parsing input; use an explicit `Z` or offset when isolating formatting behavior.

| Fixture                             | State                                                                                | Expected behavior                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `deprecation/no-date`               | Fresh process; no future deprecation date recorded                                   | No deprecation warning.                                                                                                             |
| `deprecation/future`                | Future timestamp recorded and command succeeds                                       | Warning after the command result. Test the caller's supported result modes; the hook has no JSON-mode suppression.                  |
| `deprecation/timezone-boundary`     | Same midnight-UTC instant, UTC versus a timezone west of UTC                         | Can display different calendar days without a different API response.                                                               |
| `deprecation/default-locale`        | Same instant/timezone under two resolved runtime locales                             | Month spelling, ordering, and punctuation can differ.                                                                               |
| `deprecation/past-invalid-boundary` | Only invalid dates, past dates, or a timestamp exactly equal to the controlled clock | Fresh date selection records none; it uses strictly future instants.                                                                |
| `deprecation/multiple-dates`        | Several future dates across API responses                                            | Keeps the earliest future date encountered. Formatting uses the resulting date, not each response separately.                       |
| `deprecation/cache-hit`             | Fresh process with a cached query result instead of a network response callback      | That cached result does not record its deprecations through the success callback; another request can still supply a date.          |
| `deprecation/failed-command`        | Command throws or directly exits 2 after reporting collected errors                  | Successful postrun does not run, so this hook does not append its warning.                                                          |
| `deprecation/same-process`          | A date was recorded earlier in the same process                                      | The store retains it. Empty/past-date input does not clear it, and the rendering hook does not recheck whether it has since passed. |

Freeze the clock before the candidate deadline. Set locale/timezone before starting the process, pin the Node/ICU environment for byte-level snapshots, and capture stderr as well as stdout. This is a specific locale-sensitive output path, not a reason to multiply every app-data fixture by every locale.

Sources: [deprecation-date selection](/packages/cli-kit/src/private/node/context/deprecations-store.ts), [API callback](/packages/cli-kit/src/public/node/api/app-management.ts), [date rendering](/packages/cli-kit/src/public/node/hooks/deprecations.ts), and [successful postrun](/packages/cli-kit/src/public/node/hooks/postrun.ts).

## Notifications, upgrades, and analytics

Sources: [notifications](/packages/cli-kit/src/public/node/notifications-system.ts), [upgrade logic](/packages/cli-kit/src/public/node/upgrade.ts), [postrun](/packages/cli-kit/src/public/node/hooks/postrun.ts), [analytics](/packages/cli-kit/src/public/node/analytics.ts), [error reporting](/packages/cli-kit/src/public/node/error-handler.ts).

| Variable                                              | Rule                                         | Effect and fixtures                                                                                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHOPIFY_CLI_NOTIFICATIONS_URL`                       | URL validation                               | Changes the notification feed and its cache key. HTTPS and loopback HTTP are allowed. Invalid URLs or non-loopback HTTP fall back to the default feed.                                                     |
| `SHOPIFY_CLI_FORCE_AUTO_UPGRADE`                      | Exactly `1`                                  | Bypasses the normal preference, CI, prerelease, and daily-rate-limit gates once a newer cached version exists. Does not bypass every later gate, such as a major-version warning or blocking notification. |
| `SHOPIFY_HOMEBREW_FORMULA`                            | Nonempty string                              | Makes global-install detection select Homebrew; changes install/reminder commands.                                                                                                                         |
| `SHOPIFY_CLI_NO_ANALYTICS`, `OPT_OUT_INSTRUMENTATION` | CLI truthy                                   | Ordinarily disable Monorail usage analytics and OpenTelemetry metrics. Metadata gathering and other hooks can still run.                                                                                   |
| `SHOPIFY_CLI_ALWAYS_LOG_ANALYTICS`                    | CLI truthy                                   | Overrides ordinary analytics opt-out for Monorail.                                                                                                                                                         |
| `SHOPIFY_CLI_ALWAYS_LOG_METRICS`                      | CLI truthy                                   | Overrides ordinary metrics opt-out; unit-test mode still prevents the actual metric exporter.                                                                                                              |
| `SHOPIFY_CLI_OTEL_EXPORTER_OTLP_ENDPOINT`             | Nonblank string                              | Replaces the metrics host/base URL; the code appends `/v1/metrics`. This is not an app API endpoint override.                                                                                              |
| `CODESPACES`, `GITPOD_WORKSPACE_URL`, `CLOUD_SHELL`   | Nonblank detection, in this precedence order | Mark a cloud environment and prevent automatic browser opening during login. Also affect analytics metadata.                                                                                               |
| `npm_config_user_agent`                               | Substring detection                          | Selects the launcher metadata and package-manager fallback when no lockfile/workspace marker is found. It can change the package manager printed by info.                                                  |
| `TF_BUILD`                                            | CLI truthy in `ciPlatform()`                 | Marks Azure CI for analytics and delivery mode, even without `CI`. It does not make `isCI()` or prompt checks true by itself.                                                                              |

Auto-upgrade preference is stored state, controlled by `shopify config autoupgrade off/on`. A command-specific `--no-update` flag is not automatically an auto-upgrade control; inspect its reader. Disabling upgrades does not disable the background npm version lookup.

`SHOPIFY_CLI_NO_ANALYTICS` is not a blanket error-reporting switch. `sendErrorToBugsnag()` has separate gates, including local service mode, framework debug settings, expected-error classification, and rate limiting. Control that boundary separately in failure tests.

Npm version lookup and upgrade subprocesses also read their own registry, authentication, proxy, and package-manager settings. Include isolated `.npmrc` files and relevant `npm_config_*` / `NPM_CONFIG_*` values in installer tests, but do not treat them as command flags unless declared. The platform browser opener can inherit OS settings such as `BROWSER` on Linux.

## Metadata-only environment

Keep these separate from inputs that choose an app or change its report. They still matter when testing telemetry payloads or process diagnostics.

Sources: [analytics environment data](/packages/cli-kit/src/private/node/analytics.ts), [CI metadata](/packages/cli-kit/src/private/node/context/utilities.ts), [agent attribution](/packages/cli-kit/src/private/node/context/agent.ts), [plugin hint](/packages/cli-kit/src/private/node/plugin-hints.ts).

| Variables                                                                                                                                                                                                           | Effect                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHOPIFY_INVOKED_BY`, `SHOPIFY_CLI_AGENT`, `SHOPIFY_CLI_AGENT_INFO`, `SHOPIFY_CLI_AGENT_IDS`, `SHOPIFY_CLI_AGENT_VERSION`, `SHOPIFY_CLI_AGENT_RUN_ID`, `SHOPIFY_CLI_AGENT_SESSION_ID`, `SHOPIFY_CLI_AGENT_PROVIDER` | Allowlisted agent/launcher metadata. Nonblank `AGENT_INFO` or `AGENT_IDS` skips automatic agent attribution. None selects an app or account.                                                                   |
| `SHOPIFY_CLI_AGENT_DETECTION`                                                                                                                                                                                       | Generated attribution result, not a user-selectable detection mode. The metadata code overwrites it with its result.                                                                                           |
| `SHOPIFY_CLI_BUILD_REPO`                                                                                                                                                                                            | Build-origin metadata, default `unknown` in source. Bundling can replace the read with a build-time literal, so a runtime override need not affect a distributed build.                                        |
| `SHOPIFY_CLI_THEME_TOKEN`                                                                                                                                                                                           | Does not authenticate app APIs, but shared analytics helpers can use it for user/auth attribution. Clear it from app-only telemetry fixtures.                                                                  |
| `SHOPIFY_RUN_AS_USER`                                                                                                                                                                                               | Overrides employee attribution when the key exists: CLI-truthy means not an employee; false/empty values mean employee. If absent, detection checks for `/opt/dev/bin/dev`. Does not choose an app or account. |
| `BITBUCKET_BUILD_NUMBER`, `CIRCLECI`, `GITHUB_ACTION`, `GITLAB_CI`, `BUILDKITE`                                                                                                                                     | CI vendor detection when `CI` is CLI-truthy. Note singular `GITHUB_ACTION` here, distinct from dependency color detection's `GITHUB_ACTIONS`.                                                                  |

The installed `@vercel/detect-agent` 1.2.5 dependency also checks `AI_AGENT`, `CURSOR_TRACE_ID`, `CURSOR_AGENT`, `CURSOR_EXTENSION_HOST_ROLE`, `GEMINI_CLI`, `CODEX_SANDBOX`, `CODEX_CI`, `CODEX_THREAD_ID`, `ANTIGRAVITY_AGENT`, `AUGMENT_AGENT`, `OPENCODE_CLIENT`, `CLAUDECODE`, `CLAUDE_CODE`, `CLAUDE_CODE_IS_COWORK`, `REPL_ID`, `COPILOT_MODEL`, `COPILOT_ALLOW_ALL`, and `COPILOT_GITHUB_TOKEN`. Their presence can change detected attribution. That is distinct from the CLI-truthy Claude Code stderr hint.

CI payload fields come from these additional names:

| Vendor    | Metadata variables                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bitbucket | `BITBUCKET_BRANCH`, `BITBUCKET_COMMIT`, `BITBUCKET_WORKSPACE`, `BITBUCKET_REPO_SLUG`, plus build number above.                                         |
| CircleCI  | `CIRCLE_USERNAME`, `CIRCLE_BRANCH`, `CIRCLE_BUILD_NUM`, `CIRCLE_SHA1`, `CIRCLE_WORKFLOW_ID`, `CIRCLE_BUILD_URL`.                                       |
| GitHub    | `GITHUB_ACTOR`, `GITHUB_RUN_ATTEMPT`, `GITHUB_REF_NAME`, `GITHUB_RUN_ID`, `GITHUB_SHA`, `GITHUB_RUN_NUMBER`, `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`. |
| GitLab    | `GITLAB_USER_LOGIN`, `CI_COMMIT_REF_NAME`, `CI_PIPELINE_ID`, `CI_COMMIT_SHA`, `CI_COMMIT_MESSAGE`, `CI_RUNNER_ID`, `CI_PIPELINE_URL`.                  |
| Buildkite | `BUILDKITE_BRANCH`, `BUILDKITE_BUILD_NUMBER`, `BUILDKITE_COMMIT`, `BUILDKITE_MESSAGE`, `BUILDKITE_BUILD_URL`.                                          |

These values are fixture inputs only when asserting metadata. Do not multiply every app response fixture by every CI vendor.

## CLI lifecycle calls

A process-level fixture must account for these calls even though `info()` itself never sends them. Some run in detached child processes. Either control their inputs or disable them through the supported test seams; unexpected real network access should fail the test.

Sources: [prerun hook](/packages/cli-kit/src/public/node/hooks/prerun.ts), [BaseCommand.init](/packages/cli-kit/src/public/node/base-command.ts), [postrun hook](/packages/cli-kit/src/public/node/hooks/postrun.ts).

### H1: Notifications feed

**Request:** `GET https://cdn.shopify.com/static/cli/notifications.json`. `SHOPIFY_CLI_NOTIFICATIONS_URL` can override it with HTTPS or loopback HTTP.

Source: [notifications-system.ts](/packages/cli-kit/src/public/node/notifications-system.ts).

```ts
type NotificationsBody = {
  notifications: Array<{
    id: string
    message: string
    type: "info" | "warning" | "error"
    frequency: "always" | "once" | "once_a_day" | "once_a_week"
    ownerChannel: string
    cta?: {label: string; url: string}
    title?: string
    minVersion?: string
    maxVersion?: string
    minDate?: string
    maxDate?: string
    commands?: string[]
    surface?: string
  }>
}
```

The background `notifications list --ignore-errors` process refreshes the feed. The command reads cached notifications in base initialization and again after extension loading. The refresh and those reads can race.

| Fixture                           | Response/cache variation                                                  | Expected behavior                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `notifications/empty`             | HTTP 200 with `notifications: []`.                                        | No additional output.                                                                                                                            |
| `notifications/info-warning`      | Matching info/warning notifications.                                      | Additional terminal output; at most two notifications per render call.                                                                           |
| `notifications/blocking`          | Matching cached `type: "error"`.                                          | Renders an error and throws `AbortSilentError`. Can stop before app lookup or during app loading.                                                |
| `notifications/filtered`          | Nonmatching command, surface, dates, version, or already-shown frequency. | Does not render that notification. Use the target command's oclif ID for the filter; for example, `app:info`.                                    |
| `notifications/json`              | Matching cached notification with JSON output enabled.                    | Rendering is skipped. Background fetching is not skipped solely because of `--json`.                                                             |
| `notifications/ci`                | CI or unit-test mode.                                                     | Normal notification fetching/rendering is skipped.                                                                                               |
| `notifications/bad-feed`          | Non-200, invalid JSON/schema, stream failure, or timeout.                 | Feed refresh failure is handled independently of ordinary command work. A bad cached feed is handled separately and may trigger error reporting. |
| `notifications/autoupgrade-block` | Matching `surface: "autoupgrade", type: "error"`.                         | A fresh postrun feed check can prevent auto-upgrade, not the already-completed info result.                                                      |

Feed requests have a three-second timeout and no network retry. The auto-upgrade blocking check fails open: a fetch/parse failure allows the upgrade attempt to continue.

### H2: npm version lookup

**Request:** registry package metadata for `@shopify/cli`, normally `GET https://registry.npmjs.org/@shopify%2Fcli`. The `latest-version`/`package-json` dependency selects the configured registry, including scoped registry settings.

Source: [checkForNewVersion and getLatestNPMPackageVersion](/packages/cli-kit/src/public/node/node-package-manager.ts). The installed dependency boundary inspected here is `latest-version` 7 / `package-json` 8.

A minimal success body for the consumed fields is:

```json
{
  "name": "@shopify/cli",
  "dist-tags": {"latest": "3.999.0"},
  "versions": {
    "3.999.0": {"name": "@shopify/cli", "version": "3.999.0"}
  }
}
```

The hook starts this check in the background for non-prerelease CLI versions, with a 24-hour cache. It does not wait for the result before app loading.

Cover current/older version, newer patch/minor version, newer major version, cache hit/miss, 404, unavailable registry, invalid JSON, missing latest metadata, and invalid version strings. Fetch/lookup failures return no update; semver comparison errors sit outside that catch and need a separate regression case. Postrun uses whichever cached version is available by then.

### H3: Auto-upgrade subprocess

Postrun can fetch H1 again, then invoke the detected global package manager (`npm`, `pnpm`, `yarn`, or Homebrew). Its registry, metadata, archive, and installation traffic belongs to that subprocess, so there is no single Shopify CLI JSON response schema for it.

Source: [upgrade.ts](/packages/cli-kit/src/public/node/upgrade.ts).

Test the subprocess outcome and the installed-version check:

| Fixture                  | Outcome                                                                                                            | Expected behavior                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `upgrade/success`        | Installer exits 0; installed version meets the expected version.                                                   | Prints upgrade success after the command result.                                           |
| `upgrade/install-fails`  | Installer exits nonzero or cannot reach its registry.                                                              | Catches the upgrade failure, emits an upgrade reminder, and records failure.               |
| `upgrade/stale-registry` | Installer exits 0 but installs an older version.                                                                   | Verification fails; no success claim.                                                      |
| `upgrade/unverifiable`   | Cannot read installed version.                                                                                     | Verification fails.                                                                        |
| `upgrade/skipped`        | Disabled preference, CI, prerelease, daily limit, no newer cached version, major update, or blocking notification. | No installer launch; major updates can produce a warning.                                  |
| `upgrade/local-install`  | Project-local CLI.                                                                                                 | Automatic mode does not modify project dependencies. Earlier upgrade checks may still run. |

Clear `SHOPIFY_CLI_FORCE_AUTO_UPGRADE` in ordinary fixtures. It bypasses several normal gates. Script the installer result; do not execute real upgrades in command tests.

### H4: Usage analytics

**Request:** `POST https://monorail-edge.shopifysvc.com/v1/produce`.

Sources: [analytics.ts](/packages/cli-kit/src/public/node/analytics.ts), [monorail.ts](/packages/cli-kit/src/public/node/monorail.ts).

The command does not consume a response-body schema. HTTP **200** means success; any other status produces an internal error result using `statusText`. Body contents are ignored.

Cover 200 with an empty body, non-200, timeout, and transport rejection. These do not replace the app result or original command error. Sending is normally detached, but Windows, CI, containers, or a synchronous-analytics requirement can make it awaited. `SHOPIFY_CLI_NO_ANALYTICS=1` disables ordinary analytics unless an always-log override is set.

### H5: OpenTelemetry metrics

**Request:** `POST https://otlp-http-production-cli.shopifysvc.com/v1/metrics`, with a host override through `SHOPIFY_CLI_OTEL_EXPORTER_OTLP_ENDPOINT`.

Sources: [otel-metrics.ts](/packages/cli-kit/src/private/node/otel-metrics.ts), [metric exporter setup](/packages/cli-kit/src/public/node/vendor/otel-js/service/DefaultOtelService/DefaultMeterProvider.ts), [export completion handling](/packages/cli-kit/src/public/node/vendor/otel-js/export/InstantaneousMetricReader.ts).

The OTLP HTTP exporter handles response decoding and retries. The app command reads no metric-response fields. Cover exporter success and failure, including non-2xx, malformed responses, and transport timeouts. The metric reader resolves after the exporter callback even when export fails, and the CLI suppresses exporter diagnostics. Test the exporter protocol separately from app-data fixtures.

### H6: Error reporting

**Request:** Bugsnag-compatible reports to `https://error-analytics-production.shopifysvc.com`, conditional on error classification, analytics settings, and rate limits.

Source: [sendErrorToBugsnag and initializeBugsnag](/packages/cli-kit/src/public/node/error-handler.ts).

The Bugsnag SDK owns the response contract. The CLI uses its completion callback, not a JSON response field. Cover delivery success, delivery failure, and reporting skipped; the original command error must remain the user-facing result. Automatic session tracking is disabled, so the configured `error-analytics-sessions-production.shopifysvc.com` endpoint is not a routine request in this reporting setup.
