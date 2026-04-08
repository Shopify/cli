// ---------------------------------------------------------------------------
// Shared timeout constants for E2E tests
// ---------------------------------------------------------------------------

/** Per-test timeouts (Playwright test.setTimeout) */
export const TEST_TIMEOUT = {
  /** 3 min — default per-test timeout (set in playwright.config.ts) */
  default: 3 * 60_000,
  /** 10 min — tests with create + deploy + teardown */
  long: 10 * 60_000,
} as const

/** CLI command execution timeouts */
export const CLI_TIMEOUT = {
  /** 1 min — quick commands (versions list, function run, app info) */
  short: 1 * 60_000,
  /** 3 min — standard commands (deploy, build, config link) */
  medium: 3 * 60_000,
  /** 5 min — slow commands (create app, scaffold + npm install) */
  long: 5 * 60_000,
} as const

/** Browser interaction timeouts */
export const BROWSER_TIMEOUT = {
  /** 1s — brief pause between UI interactions */
  short: 1_000,
  /** 3s — page settle, element visibility checks */
  medium: 3_000,
  /** 5s — slow page loads (store admin, heavy pages) */
  long: 5_000,
  /** 60s — browser-level default for any Playwright action */
  max: 60_000,
} as const
