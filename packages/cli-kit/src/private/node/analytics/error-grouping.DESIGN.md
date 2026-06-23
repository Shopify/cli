# Design: Structured error grouping for crash reporting

## Problem

A single Bugsnag bucket (`groupingHash 16864652937831232783`) is a catch-all for ~1,170
unrelated GraphQL/API errors across `app`/`theme`/`store`/`hydrogen` (issue #7891). It is
un-routable (five different owning teams), mixes expected/transient noise with genuine
regressions, and manufactures false P1s. Root cause: in `sendErrorToBugsnag` every error is
flattened to `new Error(error.message)` (losing its class/code), no `groupingHash` is set, and
stack traces are uniform — so the backend groups everything together.

## Users

- **Resiliency owners / on-call** routing CLI crash buckets to the right team.
- **Dashboards/alerting** (Bugsnag, Observe) that escalate severity on a bucket.

## Success criteria

1. Distinct failure families land in distinct buckets, split by product slice and a stable
   semantic category (authentication / permission / rate_limit / server / …).
2. Categories are derived from **structured signals** (HTTP status, GraphQL `extensions.code`,
   error class) read from the original typed error — not by regex-reparsing a stringified message.
3. Expected/handled and known-transient errors (AbortErrors, THROTTLED, 5xx, raw 401) do **not**
   reach crash reporting.
4. Genuinely unknown errors keep Bugsnag's stack-trace grouping (we do not merge distinct bugs).
5. Backend routing works regardless of CLI version (structured metadata tags, not just the hash).

## Constraints

- **Reporter-only scope.** No changes to API throw sites or cross-team code. The original typed
  error is already in scope in `sendErrorToBugsnag`; `GraphQLClientError` already carries
  `statusCode` + `errors[]`, and graphql-request's `ClientError` carries `response.status`/`errors`.
- **Do not mutate `error-categorizer.ts`.** Its precedence quirks are pinned by
  `error-categorizer.test.ts` / `storage.test.ts` because it is shared with Monorail analytics
  (`storage.ts` emits `error:${category}:${signature}`). It is reused here only as a fallback.
- **No import cycles.** `error.ts → headers.ts → error.ts` would cycle, so transient suppression
  in `error.ts` uses only the external `ClientError` type (the raw-401 path).

## Key decisions

1. **Group on the original error, structured-first.** A new `error-grouping.ts` extracts
   `{httpStatus, code, errorClass}` and maps them to a category via an explicit decision table.
   `403` and `ACCESS_DENIED` → `permission` (deliberately, fixing the prior 403→authentication
   confusion). Keyword `categorizeError` is the fallback only.
2. **Suppress + drop transient.** Restore the `expected_error` skip in `sendErrorToBugsnag`;
   extend `shouldReportErrorAsUnexpected` so raw `ClientError` 401/429/THROTTLED is expected.
3. **Hash + tags.** Set `event.groupingHash` (when a real category resolves) AND emit
   `error_grouping` metadata (`slice_name`, `http_status`, `error_code`, `error_class`, `category`)
   so dashboards/routing don't depend on the hash or on CLI upgrade adoption.

## Out of scope (follow-ups)

- At-source `category`/`code` field on the `FatalError` hierarchy + API wrappers.
- Folding status/code grouping into `error-categorizer.ts` (needs coordinated `storage.ts` update).
- Alerting on `*:unknown:*` / `cli:*` bucket growth; tying severity to SLO burn not volume.
