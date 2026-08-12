/* eslint-disable no-restricted-globals, no-await-in-loop, no-restricted-imports -- the
   harness calls the App Management API directly with minimal queries, like admin-api.ts
   does for the Admin API */
import {loadtestHeaderRecord} from '../helpers/loadtest-header.js'
import {execa} from 'execa'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const APP_MANAGEMENT_URL = 'https://app.shopify.com/app_management/unstable/graphql.json'

/** Minimal app identity as returned by the App Management API. */
export interface AppManagementApp {
  /** GID, e.g. gid://organization/App/123 — input for install-count lookups. */
  id: string
  /** API key (the app's client_id) — last segment of the Dev Dashboard app URL. */
  key: string
}

let cachedToken: string | undefined

/**
 * Get an App Management API token for the CLI session in `sessionEnv`'s XDG
 * dirs. Delegates to get-app-management-token.ts in a tsx subprocess: cli-kit
 * reuses the session cleanly there, while importing its dist into Playwright's
 * transpiled harness crashes Node's require(esm) path on CI's Node version.
 */
async function appManagementToken(sessionEnv: NodeJS.ProcessEnv, forceRefresh = false): Promise<string> {
  if (cachedToken && !forceRefresh) return cachedToken
  const script = path.join(__dirname, 'get-app-management-token.ts')
  const result = await execa('tsx', [script, ...(forceRefresh ? ['--force-refresh'] : [])], {
    env: sessionEnv,
    extendEnv: false,
    preferLocal: true,
    localDir: path.resolve(__dirname, '..'),
    timeout: 60_000,
  })
  const {token} = JSON.parse(result.stdout) as {token: string}
  // eslint-disable-next-line require-atomic-updates
  cachedToken = token
  return token
}

interface GraphQLPayload {
  errors?: {message?: string}[]
  data?: unknown
}

/**
 * Run a GraphQL query against the App Management API using the CLI session
 * from `sessionEnv`. Retries once with a refreshed token on 401.
 */
async function appManagementQuery(
  sessionEnv: NodeJS.ProcessEnv,
  query: string,
  variables: {[key: string]: string},
): Promise<unknown> {
  let token = await appManagementToken(sessionEnv)

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(APP_MANAGEMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...loadtestHeaderRecord(),
      },
      body: JSON.stringify({query, variables}),
    })

    if (response.status === 401 && attempt === 1) {
      token = await appManagementToken(sessionEnv, true)
      continue
    }
    if (!response.ok) {
      throw new Error(`App Management API request failed (status ${response.status}): ${await response.text()}`)
    }

    const payload = (await response.json()) as GraphQLPayload
    if (payload.errors?.length) {
      throw new Error(`App Management API returned errors: ${payload.errors.map((error) => error.message).join(', ')}`)
    }
    return payload.data
  }
}

/**
 * Look up an app by its API key (client_id). Returns undefined when the app
 * does not exist — for teardown that means it was already deleted.
 */
export async function findAppByClientId(
  sessionEnv: NodeJS.ProcessEnv,
  clientId: string,
): Promise<AppManagementApp | undefined> {
  const data = (await appManagementQuery(
    sessionEnv,
    'query appByKey($key: String!) { appByKey(key: $key) { id key } }',
    {
      key: clientId,
    },
  )) as {appByKey?: AppManagementApp | null}
  return data.appByKey ?? undefined
}

/**
 * Search the org's apps by exact name. Returns undefined when no app matches.
 *
 * `organizationId` is not declared in the operation on purpose: the App
 * Management API reads it from the variables map for request routing, exactly
 * as the CLI's own `appsForOrg` does.
 */
export async function findAppByName(
  sessionEnv: NodeJS.ProcessEnv,
  appName: string,
  orgId: string,
): Promise<AppManagementApp | undefined> {
  const data = (await appManagementQuery(
    sessionEnv,
    'query listApps($query: String) { appsConnection(query: $query, first: 50) { edges { node { id key activeRelease { version { name } } } } } }',
    {query: `title:${appName}`, organizationId: orgId},
  )) as {
    appsConnection?: {edges: {node: AppManagementApp & {activeRelease: {version: {name: string}}}}[]} | null
  }
  return data.appsConnection?.edges.map((edge) => edge.node).find((node) => node.activeRelease.version.name === appName)
}

/** Total install count for an app across all stores. */
export async function appInstallCount(sessionEnv: NodeJS.ProcessEnv, appId: string): Promise<number> {
  const data = (await appManagementQuery(
    sessionEnv,
    'query AppInstallCount($appId: ID!) { app(id: $appId) { installCount } }',
    {appId},
  )) as {app?: {installCount?: number | null} | null}
  return data.app?.installCount ?? 0
}

/**
 * Poll until the app reports zero installs. Uninstall records clear
 * asynchronously after an Admin API uninstall, usually within seconds.
 * Returns false when installs remain after the timeout.
 */
export async function waitForZeroInstalls(
  sessionEnv: NodeJS.ProcessEnv,
  appId: string,
  options: {timeoutMs?: number; pollIntervalMs?: number} = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 30_000
  const pollIntervalMs = options.pollIntervalMs ?? 2_000
  const deadline = Date.now() + timeoutMs

  while ((await appInstallCount(sessionEnv, appId)) > 0) {
    if (Date.now() >= deadline) return false

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
  return true
}
