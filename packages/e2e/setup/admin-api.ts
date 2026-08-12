/* eslint-disable no-restricted-globals -- the harness calls Shopify endpoints
   directly, like the Playwright browser does; the cli-kit fetch wrapper (and
   its proxy support) is for the CLI under test, which this package must not
   depend on */
import {extractClientId} from './app.js'
import {CLI_TIMEOUT} from './constants.js'
import {loadtestHeaderRecord} from '../helpers/loadtest-header.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import type {CLIProcess} from './cli.js'

/** Admin API version for harness-side GraphQL requests. */
const ADMIN_API_VERSION = '2026-04'

interface AdminApiUninstallCtx {
  cli: Pick<CLIProcess, 'exec'>
  appDir: string
  storeFqdn: string
}

/**
 * Uninstall the app from the store over the Admin API instead of driving the
 * store admin UI:
 *   1. Read the app's client secret with `app env show`.
 *   2. Mint an app access token with the client credentials grant. The grant
 *      works here because the E2E org owns both the app and the dev store.
 *   3. Run the `appUninstall` mutation, which uninstalls the calling app.
 *
 * Throws on any failure so teardown surfaces the error instead of leaking.
 */
export async function uninstallAppWithAdminApi(ctx: AdminApiUninstallCtx): Promise<void> {
  const clientId = extractClientId(ctx.appDir)
  const clientSecret = await fetchClientSecret(ctx)
  const accessToken = await mintAppAccessTokenWithRetry(ctx.storeFqdn, clientId, clientSecret)
  await runAppUninstall(ctx.storeFqdn, accessToken)
}

/**
 * Freshly created apps and stores can transiently 400 with
 * `application_cannot_be_found` while records propagate — retry briefly.
 */
async function mintAppAccessTokenWithRetry(storeFqdn: string, clientId: string, clientSecret: string): Promise<string> {
  const attempts = 3
  const retryDelayMs = 5000

  for (let attempt = 1; ; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await mintAppAccessToken(storeFqdn, clientId, clientSecret)
    } catch (err) {
      if (attempt === attempts) throw err
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }
}

async function fetchClientSecret(ctx: AdminApiUninstallCtx): Promise<string> {
  const result = await ctx.cli.exec(['app', 'env', 'show', '--path', ctx.appDir], {timeout: CLI_TIMEOUT.short})
  if (result.exitCode !== 0) {
    throw new Error(`app env show failed (exit ${result.exitCode}): ${result.stderr}`)
  }
  const secret = stripAnsi(result.stdout).match(/SHOPIFY_API_SECRET=(\S+)/)?.[1]
  if (!secret) {
    throw new Error('app env show output did not include SHOPIFY_API_SECRET')
  }
  return secret
}

async function mintAppAccessToken(storeFqdn: string, clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`https://${storeFqdn}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', ...loadtestHeaderRecord()},
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })
  if (!response.ok) {
    throw new Error(
      `access token request failed for client_id ${clientId} on ${storeFqdn} ` +
        `(status ${response.status}): ${summarizeErrorBody(await response.text())}`,
    )
  }
  const payload = (await response.json()) as {access_token?: string}
  if (!payload.access_token) {
    throw new Error('access token response did not include access_token')
  }
  return payload.access_token
}

async function runAppUninstall(storeFqdn: string, accessToken: string): Promise<void> {
  const response = await fetch(`https://${storeFqdn}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      ...loadtestHeaderRecord(),
    },
    body: JSON.stringify({query: 'mutation { appUninstall { userErrors { field message } } }'}),
  })
  if (!response.ok) {
    throw new Error(
      `appUninstall request failed (status ${response.status}): ${summarizeErrorBody(await response.text())}`,
    )
  }
  const payload = (await response.json()) as {
    errors?: unknown
    data?: {appUninstall?: {userErrors?: {message: string}[]}}
  }
  if (payload.errors) {
    throw new Error(`appUninstall returned errors: ${JSON.stringify(payload.errors)}`)
  }
  const userErrors = payload.data?.appUninstall?.userErrors ?? []
  if (userErrors.length > 0) {
    throw new Error(`appUninstall returned user errors: ${userErrors.map((error) => error.message).join(', ')}`)
  }
}

/** Shopify OAuth errors come back as full HTML pages — keep only the <title>, which carries the error code. */
function summarizeErrorBody(body: string): string {
  const htmlTitle = body.match(/<title>([^<]*)<\/title>/)?.[1]
  return htmlTitle ?? body.slice(0, 300)
}
