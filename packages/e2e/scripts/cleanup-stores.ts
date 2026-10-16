/* eslint-disable no-console, no-restricted-imports, no-await-in-loop */

/**
 * E2E Store Cleanup Utility
 *
 * Finds and deletes leftover E2E dev stores from the Dev Dashboard.
 * Stores are matched by the "e2e-w" prefix in their name (default).
 *
 * Usage:
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts              # Delete matching stores with the CLI
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --list        # List matching stores
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --delete      # Delete matching stores with the CLI (default)
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --force       # Request store deletion via API without polling
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --headed      # Show browser window
 *   pnpm --filter e2e exec tsx scripts/cleanup-stores.ts --pattern X   # Match stores containing "X" (default: "e2e-w")
 *
 * Environment variables (loaded from packages/e2e/.env):
 *   E2E_ACCOUNT_EMAIL    — Shopify account email for login
 *   E2E_ACCOUNT_PASSWORD — Shopify account password
 *   E2E_ORG_ID           — Organization ID to scan for stores
 *   E2E_LOADTEST_HEADER  — Load-test bypass header name
 */

import {config} from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {BROWSER_TIMEOUT, CLI_TIMEOUT} from '../setup/constants.js'
import {deleteDevStoreWithCli} from '../setup/store.js'
import {executables} from '../setup/env.js'
import {refreshIfPageError, trackMainFrameStatus} from '../setup/browser.js'
import {completeLogin} from '../helpers/browser-login.js'
import {addLoadtestHeader} from '../helpers/loadtest-header.js'
import {DeleteAppDevelopmentStore} from '../../store/dist/cli/api/graphql/business-platform-organizations/generated/delete_app_development_store.js'
import {
  businessPlatformOrganizationsRequest,
  businessPlatformOrganizationsRequestDoc,
} from '../../cli-kit/dist/public/node/api/business-platform.js'
import {ensureAuthenticatedBusinessPlatform} from '../../cli-kit/dist/public/node/session.js'
import {extractHost} from '../../cli-kit/dist/public/common/url.js'
import {execa} from 'execa'
import type {CLIProcess} from '../setup/cli.js'
import type {Page} from '@playwright/test'

// Load .env from packages/e2e/ (not cwd) only if not already configured
const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (
  !process.env.E2E_ACCOUNT_EMAIL ||
  !process.env.E2E_ACCOUNT_PASSWORD ||
  !process.env.E2E_ORG_ID ||
  !process.env.E2E_LOADTEST_HEADER
) {
  config({path: path.resolve(__dirname, '../.env')})
}

// ---------------------------------------------------------------------------
// Core cleanup logic
// ---------------------------------------------------------------------------

export type CleanupStoresMode = 'list' | 'delete' | 'force'

type CleanupOutcome = 'succeeded' | 'already-deleted' | 'failed'

type DeletedStoreChecker = (storeFqdn: string) => Promise<boolean>

const CLEANUP_WORKER_COUNT = 5
// API requests use fewer resources than CLI processes, so force mode can use more workers.
const FORCE_DELETE_WORKER_COUNT = 20

const MODE_LABELS: Record<CleanupStoresMode, string> = {
  list: 'List only',
  delete: 'Delete stores with the CLI',
  force: 'Request store deletion via API without polling',
}

export interface CleanupStoresOptions {
  /** Cleanup mode (default: "delete") */
  mode?: CleanupStoresMode
  /** Store name pattern to match (default: "e2e-w") */
  pattern?: string
  /** Show browser window */
  headed?: boolean
  /** Organization ID (default: from E2E_ORG_ID env) */
  orgId?: string
  /** Playwright browser storage state path (default: E2E_BROWSER_STATE_PATH or global-auth path) */
  storageStatePath?: string
}

function isAccountsShopifyUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname === 'accounts.shopify.com'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

function defaultStorageStatePath(): string {
  const tmpBase = process.env.E2E_TEMP_DIR ?? path.resolve(__dirname, '../../../.e2e-tmp')
  return path.join(tmpBase, 'global-auth', 'browser-storage-state.json')
}

function existingStorageStatePath(candidate?: string): string | undefined {
  return [candidate, process.env.E2E_BROWSER_STATE_PATH, defaultStorageStatePath()].find(
    (storageStatePath): storageStatePath is string => Boolean(storageStatePath && fs.existsSync(storageStatePath)),
  )
}

const cleanupCli: Pick<CLIProcess, 'exec'> = {
  async exec(args, opts = {}) {
    const result = await execa('node', [executables.cli, ...args], {
      cwd: opts.cwd,
      env: {...process.env, ...opts.env},
      timeout: opts.timeout ?? CLI_TIMEOUT.store,
      reject: false,
    })
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode ?? 1,
    }
  },
}

export async function cleanupStores(opts: CleanupStoresOptions = {}): Promise<void> {
  const mode = opts.mode ?? 'delete'
  const pattern = opts.pattern ?? 'e2e-w'
  const orgId = opts.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD
  const storageStatePath = existingStorageStatePath(opts.storageStatePath)

  console.log('')
  console.log(`[cleanup-stores] Mode:    ${MODE_LABELS[mode]}`)
  console.log(`[cleanup-stores] Org:     ${orgId || '(not set)'}`)
  console.log(`[cleanup-stores] Pattern: "${pattern}"`)
  console.log('')

  if (!storageStatePath && (!email || !password)) {
    throw new Error(
      'E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD are required when no browser storage state is available',
    )
  }
  if (!orgId) {
    throw new Error('E2E_ORG_ID is required')
  }

  const browser = await chromium.launch({headless: !opts.headed})
  const context = await browser.newContext({
    ...(storageStatePath ? {storageState: storageStatePath} : {}),
  })
  await addLoadtestHeader(context)
  context.setDefaultTimeout(BROWSER_TIMEOUT.max)
  context.setDefaultNavigationTimeout(BROWSER_TIMEOUT.max)
  const page = await context.newPage()
  trackMainFrameStatus(page)

  const totalStart = Date.now()

  try {
    // Step 1: Reuse Playwright's global auth storage when available; otherwise log in directly.
    if (storageStatePath) {
      console.log('[cleanup-stores] Reusing browser storage state.')
    } else if (email && password) {
      console.log('[cleanup-stores] Logging in...')
      await completeLogin(page, 'https://accounts.shopify.com/lookup', email, password)
      console.log('[cleanup-stores] Logged in successfully.')
    }

    // Step 2: Find matching stores. Prefer Business Platform API discovery because the Dev Dashboard
    // stores page is virtualized/lazy-loaded and its rendered HTML does not always include myshopify domains.
    const stores = await findStores(page, {pattern, orgId, email, password})
    console.log(`[cleanup-stores] Found ${stores.length} store(s) matching pattern "${pattern}"`)
    console.log('')

    if (stores.length === 0) return

    if (mode === 'list') {
      for (let i = 0; i < stores.length; i++) {
        const store = stores[i]!
        console.log(`  ${i + 1}. ${store.name}`)
      }
      console.log('')
      return
    }

    // Step 3: Process stores in parallel — each worker handles one store at a time.
    const isStoreDeleted = createDeletedStoreChecker(page, {email, password})
    const outcomes =
      mode === 'force'
        ? await forceDeleteStoresInParallel({stores, orgId, isStoreDeleted})
        : await cleanupStoresInParallel({stores, orgId, isStoreDeleted})
    const stats: Record<CleanupOutcome, number> = {succeeded: 0, 'already-deleted': 0, failed: 0}
    for (const outcome of outcomes) {
      stats[outcome]++
    }

    // Summary
    const parts = [`${stats.succeeded} succeeded`]
    if (stats['already-deleted'] > 0) parts.push(`${stats['already-deleted']} already deleted`)
    if (stats.failed > 0) parts.push(`${stats.failed} failed`)
    const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)
    console.log('')
    console.log(`[cleanup-stores] Complete: ${parts.join(', ')} (${totalElapsed}s total)`)
    if (stats.failed > 0) process.exitCode = 1
  } finally {
    await browser.close()
  }
}

async function cleanupStoresInParallel(opts: {
  stores: StoreInfo[]
  orgId: string
  isStoreDeleted: DeletedStoreChecker
}): Promise<CleanupOutcome[]> {
  const {stores, orgId, isStoreDeleted} = opts
  const outcomes = new Array<CleanupOutcome>(stores.length)
  const workerCount = Math.min(CLEANUP_WORKER_COUNT, stores.length)
  let nextStoreIndex = 0

  await Promise.all(
    Array.from({length: workerCount}, async (_, workerIndex) => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const storeIndex = nextStoreIndex++
        if (storeIndex >= stores.length) break

        outcomes[storeIndex] = await cleanupStore({
          store: stores[storeIndex]!,
          orgId,
          isStoreDeleted,
          workerNumber: workerIndex + 1,
          storeNumber: storeIndex + 1,
          foundCount: stores.length,
        })
      }
    }),
  )

  return outcomes
}

async function cleanupStore(opts: {
  store: StoreInfo
  orgId: string
  isStoreDeleted: DeletedStoreChecker
  workerNumber: number
  storeNumber: number
  foundCount: number
}): Promise<CleanupOutcome> {
  const {store, orgId, isStoreDeleted, workerNumber, storeNumber, foundCount} = opts
  const tag = `[cleanup-stores] [worker ${workerNumber}] [${storeNumber}/${foundCount}] ${store.name}`
  const storeStart = Date.now()
  let outcome: CleanupOutcome = 'failed'

  console.log(`${tag}: Deleting store...`)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const deletionConfirmed = await deleteDevStoreWithCli({cli: cleanupCli, storeFqdn: store.fqdn, orgId})
      console.log(deletionConfirmed ? `${tag}: Deletion confirmed by CLI` : `${tag}: Deletion requested with CLI`)
      outcome = 'succeeded'
      break
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      if (attempt === 1 && (await isStoreDeleted(store.fqdn))) {
        console.log(`${tag}: Already deleted (confirmed in store admin)`)
        outcome = 'already-deleted'
        break
      }
      console.log(`${tag}: (${attempt}/3) deletion failed: ${err instanceof Error ? err.message : err}`)
    }
  }
  if (outcome === 'failed') {
    console.warn(`${tag}: Failed after 3 attempts`)
  }

  const storeElapsed = ((Date.now() - storeStart) / 1000).toFixed(1)
  console.log(`${tag}: ${outcome} (${storeElapsed}s)`)
  return outcome
}

/**
 * Force mode: request deletion for every store through the Business Platform API.
 *
 * This skips the CLI subprocess and deletion-confirmation polling.
 * Deletions are requested and left to complete asynchronously.
 */
async function forceDeleteStoresInParallel(opts: {
  stores: StoreInfo[]
  orgId: string
  isStoreDeleted: DeletedStoreChecker
}): Promise<CleanupOutcome[]> {
  const {stores, orgId, isStoreDeleted} = opts
  const token = await ensureAuthenticatedBusinessPlatform([], {noPrompt: true})
  const outcomes = new Array<CleanupOutcome>(stores.length)
  const workerCount = Math.min(FORCE_DELETE_WORKER_COUNT, stores.length)
  let nextStoreIndex = 0

  await Promise.all(
    Array.from({length: workerCount}, async (_, workerIndex) => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const storeIndex = nextStoreIndex++
        if (storeIndex >= stores.length) break

        outcomes[storeIndex] = await forceDeleteStore({
          store: stores[storeIndex]!,
          orgId,
          token,
          isStoreDeleted,
          workerNumber: workerIndex + 1,
          storeNumber: storeIndex + 1,
          foundCount: stores.length,
        })
      }
    }),
  )

  return outcomes
}

async function forceDeleteStore(opts: {
  store: StoreInfo
  orgId: string
  token: string
  isStoreDeleted: DeletedStoreChecker
  workerNumber: number
  storeNumber: number
  foundCount: number
}): Promise<CleanupOutcome> {
  const {store, orgId, token, isStoreDeleted, workerNumber, storeNumber, foundCount} = opts
  const tag = `[cleanup-stores] [worker ${workerNumber}] [${storeNumber}/${foundCount}] ${store.name}`
  const storeStart = Date.now()
  let outcome: CleanupOutcome = 'failed'

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await businessPlatformOrganizationsRequestDoc({
        query: DeleteAppDevelopmentStore,
        token,
        organizationId: orgId,
        variables: {storeFqdn: store.fqdn},
        unauthorizedHandler: {
          type: 'token_refresh',
          handler: async () => ({token: await ensureAuthenticatedBusinessPlatform([], {noPrompt: true})}),
        },
      })

      const deletion = result.deleteAppDevelopmentStore
      if (!deletion) throw new Error('Unexpected empty response from deleteAppDevelopmentStore')
      const userErrors = deletion.userErrors ?? []
      if (userErrors.length > 0) throw new Error(userErrors.map((error) => error.message).join(', '))
      if (deletion.success === false) throw new Error('Deletion was not accepted')

      outcome = 'succeeded'
      break
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      if (attempt === 1 && (await isStoreDeleted(store.fqdn))) {
        console.log(`${tag}: Already deleted (confirmed in store admin)`)
        outcome = 'already-deleted'
        break
      }
      console.log(`${tag}: (${attempt}/3) deletion failed: ${err instanceof Error ? err.message : err}`)
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, BROWSER_TIMEOUT.medium))
    }
  }

  const storeElapsed = ((Date.now() - storeStart) / 1000).toFixed(1)
  const summaries: Record<CleanupOutcome, string> = {
    succeeded: 'Deletion requested',
    'already-deleted': 'Already deleted',
    failed: 'Failed after 3 attempts',
  }
  console.log(`${tag}: ${summaries[outcome]} (${storeElapsed}s)`)
  return outcome
}

/** Confirm deletion through store admin when the API's store record is stale. */
function createDeletedStoreChecker(page: Page, credentials: {email?: string; password?: string}): DeletedStoreChecker {
  // Workers share this page, so wait for each check to finish before navigating again.
  let previousCheck = Promise.resolve(false)

  return (storeFqdn) => {
    const check = previousCheck.then(async () => {
      const storeSlug = storeFqdn.replace('.myshopify.com', '')
      const storeUrl = `https://admin.shopify.com/store/${storeSlug}`
      await page.goto(storeUrl, {waitUntil: 'domcontentloaded'})

      if (isAccountsShopifyUrl(page.url())) {
        const {email, password} = credentials
        if (!email || !password) throw new Error('E2E credentials are required to refresh the browser login')
        await completeLogin(page, page.url(), email, password)
        await page.goto(storeUrl, {waitUntil: 'domcontentloaded'})
      }

      return page
        .getByText('This dev store has been deleted', {exact: true})
        .waitFor({state: 'visible', timeout: BROWSER_TIMEOUT.long})
        .then(
          () => new URL(page.url()).pathname === `/store/${storeSlug}/access_account`,
          () => false,
        )
    })

    previousCheck = check.catch((error: unknown) => {
      console.warn(
        `[cleanup-stores] ${storeFqdn}: Could not confirm deletion: ${error instanceof Error ? error.message : error}`,
      )
      return false
    })
    return previousCheck
  }
}

// ---------------------------------------------------------------------------
// Discovery and browser helpers
// ---------------------------------------------------------------------------

interface StoreInfo {
  name: string
  fqdn: string
}

interface FindStoresOptions {
  pattern: string
  orgId: string
  email?: string
  password?: string
}

async function findStores(page: Page, opts: FindStoresOptions): Promise<StoreInfo[]> {
  try {
    return await findStoresWithBusinessPlatformApi(opts.pattern, opts.orgId)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    console.warn(
      `[cleanup-stores] API discovery failed, falling back to Dev Dashboard UI: ${err instanceof Error ? err.message : err}`,
    )
  }

  return findStoresOnDashboard(page, opts)
}

// Local paginated variant of the app package's ListAppDevStores query, which fetches a single
// page of the server's default size. Selects only the fields toStoreInfo reads.
const ListAppDevStoresPaginated = `
  query ListAppDevStoresPaginated($searchTerm: String, $first: Int, $after: String) {
    organization {
      accessibleShops(
        filters: [
          {field: STORE_TYPE, operator: EQUALS, value: "app_development"}
          {field: STORE_STATUS, operator: EQUALS, value: "ACTIVE"}
        ]
        search: $searchTerm
        first: $first
        after: $after
      ) {
        edges {
          node {
            name
            shortName
            primaryDomain
            url
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`

interface AppDevStoreNode {
  name?: string | null
  shortName?: string | null
  primaryDomain?: string | null
  url?: string | null
}

interface ListAppDevStoresPaginatedResult {
  organization?: {
    accessibleShops?: {
      edges: {node: AppDevStoreNode}[]
      pageInfo: {hasNextPage: boolean; endCursor?: string | null}
    } | null
  } | null
}

const STORE_DISCOVERY_PAGE_SIZE = 100
const STORE_DISCOVERY_MAX_PAGES = 50

/** Find app development stores matching a name pattern using Business Platform GraphQL. */
async function findStoresWithBusinessPlatformApi(namePattern: string, orgId: string): Promise<StoreInfo[]> {
  console.log('[cleanup-stores] Discovering stores via Business Platform API...')

  const token = await ensureAuthenticatedBusinessPlatform([], {noPrompt: true})
  const seen = new Set<string>()
  const stores: StoreInfo[] = []
  let after: string | undefined

  for (let pageNumber = 1; pageNumber <= STORE_DISCOVERY_MAX_PAGES; pageNumber++) {
    const result = await businessPlatformOrganizationsRequest<ListAppDevStoresPaginatedResult>({
      query: ListAppDevStoresPaginated,
      token,
      organizationId: orgId,
      variables: {searchTerm: namePattern, first: STORE_DISCOVERY_PAGE_SIZE, ...(after ? {after} : {})},
      unauthorizedHandler: {
        type: 'token_refresh',
        handler: async () => ({token: await ensureAuthenticatedBusinessPlatform([], {noPrompt: true})}),
      },
    })

    const accessibleShops = result.organization?.accessibleShops
    if (!accessibleShops) break

    for (const edge of accessibleShops.edges) {
      const store = toStoreInfo(edge.node, namePattern)
      if (!store || seen.has(store.fqdn)) continue
      seen.add(store.fqdn)
      stores.push(store)
    }

    const {hasNextPage, endCursor} = accessibleShops.pageInfo
    if (!hasNextPage || !endCursor) return stores
    after = endCursor
    console.log(`[cleanup-stores]   ...${stores.length} stores after ${pageNumber} page(s)`)
  }

  console.warn(
    `[cleanup-stores] Stopped discovery after ${STORE_DISCOVERY_MAX_PAGES} pages; more stores may match pattern "${namePattern}".`,
  )
  return stores
}

function toStoreInfo(node: AppDevStoreNode, namePattern: string): StoreInfo | undefined {
  const fqdn =
    normalizeStoreFqdn(node.primaryDomain) ??
    normalizeStoreFqdn(node.url) ??
    normalizeStoreFqdn(node.shortName) ??
    normalizeStoreFqdn(node.name)
  if (!fqdn) return undefined

  const searchable = [node.name, node.shortName, node.primaryDomain, node.url, fqdn].filter(Boolean).join(' ')
  if (!searchable.toLowerCase().includes(namePattern.toLowerCase())) return undefined

  return {name: fqdn.replace('.myshopify.com', ''), fqdn}
}

function normalizeStoreFqdn(rawValue?: string | null): string | undefined {
  if (!rawValue) return undefined

  const host = extractHost(rawValue) ?? rawValue.replace(/^https?:\/\//, '').split('/')[0]
  const normalizedHost = host?.trim().toLowerCase()
  if (!normalizedHost) return undefined
  if (normalizedHost.endsWith('.myshopify.com')) return normalizedHost
  if (/^[a-z0-9][a-z0-9-]*$/.test(normalizedHost)) return `${normalizedHost}.myshopify.com`
  return undefined
}

/**
 * Find stores matching a name pattern on the stores page (dev dashboard).
 *
 * The stores page lazy-loads rows as you scroll — each scroll-to-bottom triggers another batch to render.
 * Keep scrolling until the row count has been stable for several consecutive passes, then scrape all FQDNs from the final HTML.
 */
async function findStoresOnDashboard(page: Page, opts: FindStoresOptions): Promise<StoreInfo[]> {
  const {pattern: namePattern, orgId, email, password} = opts

  console.log('[cleanup-stores] Navigating to stores page...')
  await page.goto(`https://dev.shopify.com/dashboard/${orgId}/stores`, {waitUntil: 'domcontentloaded'})
  if (isAccountsShopifyUrl(page.url()) && email && password) {
    console.log('[cleanup-stores] Browser storage state was not accepted; logging in...')
    await completeLogin(page, page.url(), email, password)
    await page.goto(`https://dev.shopify.com/dashboard/${orgId}/stores`, {waitUntil: 'domcontentloaded'})
  }
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Handle account picker
  const accountButton = email ? page.locator(`text=${email}`).first() : undefined
  if (accountButton && (await accountButton.isVisible({timeout: BROWSER_TIMEOUT.long}).catch(() => false))) {
    await accountButton.click()
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  // Recover from transient 500/502 before parsing.
  await refreshIfPageError(page)

  // Wait for initial rows to render — `<tbody id="stores-tbody">` holds every loaded row
  await page.locator('#stores-tbody tr').first().waitFor({state: 'attached', timeout: BROWSER_TIMEOUT.max})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Scroll until row count stops growing.
  // Short wait per scroll while actively loading,
  // longer wait once we hit a plateau (lazy-loader may need a beat to catch up).
  const MAX_IDLE_ROUNDS = 3
  const MAX_SCROLLS = 200
  let lastCount = 0
  let idleRounds = 0
  for (let i = 0; i < MAX_SCROLLS; i++) {
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#stores-tbody tr')
      const last = rows[rows.length - 1]
      if (last) last.scrollIntoView({block: 'end'})
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(idleRounds > 0 ? BROWSER_TIMEOUT.long : BROWSER_TIMEOUT.short)

    const count = await page.locator('#stores-tbody tr').count()
    if (count > lastCount) {
      console.log(`[cleanup-stores]   ...loaded ${count} stores`)
      lastCount = count
      idleRounds = 0
    } else {
      idleRounds++
      if (idleRounds >= MAX_IDLE_ROUNDS) break
    }
  }

  // Parse FQDNs from full HTML (href attrs + visible text), dedupe, filter by pattern
  const bodyHtml = await page.content()
  const seen = new Set<string>()
  const stores: StoreInfo[] = []

  const fqdnRegex = /([\w-]+)\.myshopify\.com/g
  let match = fqdnRegex.exec(bodyHtml)
  while (match) {
    const slug = match[1]!
    const fqdn = `${slug}.myshopify.com`
    if (!seen.has(fqdn) && slug.toLowerCase().includes(namePattern.toLowerCase())) {
      seen.add(fqdn)
      stores.push({name: slug, fqdn})
    }
    match = fqdnRegex.exec(bodyHtml)
  }

  return stores
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const headed = args.includes('--headed')
  const patternIdx = args.indexOf('--pattern')
  let pattern: string | undefined
  if (patternIdx !== -1) {
    const nextArg = args[patternIdx + 1]
    if (!nextArg || nextArg.startsWith('--')) {
      console.error('[cleanup-stores] --pattern requires a value')
      process.exitCode = 1
      return
    }
    pattern = nextArg
  }

  let mode: CleanupStoresMode = 'delete'
  if (args.includes('--list')) mode = 'list'
  else if (args.includes('--force')) mode = 'force'

  await cleanupStores({mode, pattern, headed})
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch((err) => {
    console.error('[cleanup-stores] Fatal error:', err)
    process.exitCode = 1
  })
}
