export const E2E_STORES = {
  devServer: 'no-delete-e2e-reusable-store-1.myshopify.com',
  configReload: 'no-delete-e2e-reusable-store-2.myshopify.com',
  extensionCreation: 'no-delete-e2e-reusable-store-3.myshopify.com',
  extensionDeletion: 'no-delete-e2e-reusable-store-4.myshopify.com',
  namedConfig: 'no-delete-e2e-reusable-store-5.myshopify.com',
  defaultConfig: 'no-delete-e2e-reusable-store-6.myshopify.com',
  fullConfig: 'no-delete-e2e-reusable-store-7.myshopify.com',
  spare: 'no-delete-e2e-reusable-store-8.myshopify.com',
} as const

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
  /** 5 min — slow commands (create app, scaffold) */
  long: 5 * 60_000,
  /** 6 min — store commands that poll for provisioning or deletion */
  store: 6 * 60_000,
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
