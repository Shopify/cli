/* eslint-disable no-restricted-globals, no-await-in-loop, @nx/enforce-module-boundaries -- the
   harness calls the App Management API directly with minimal queries, like admin-api.ts
   does for the Admin API; cli-kit is only used to reuse the CLI session that
   global setup created, following the cleanup-stores.ts pattern */
import {loadtestHeaderRecord} from '../helpers/loadtest-header.js'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '../../cli-kit/dist/public/node/session.js'

const APP_MANAGEMENT_URL = 'https://app.shopify.com/app_management/unstable/graphql.json'

/** Minimal app identity as returned by the App Management API. */
export interface AppManagementApp {
  /** GID, e.g. gid://organization/App/123 — input for install-count lookups. */
  id: string
  /** API key (the app's client_id) — last segment of the Dev Dashboard app URL. */
  key: string
}

const XDG_KEYS = ['XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME'] as const

let sessionEnvReady = false

/**
 * Point cli-kit's session storage at an authenticated CLI session before its
 * first use in this process. cli-kit resolves its storage directory from
 * process.env at first access and caches it, so this runs once and the dirs
 * must not change afterwards — workers keep one XDG dir set for their lifetime.
 */
function ensureSessionEnv(sessionEnv: NodeJS.ProcessEnv): void {
  if (sessionEnvReady) return
  for (const key of XDG_KEYS) {
    const value = sessionEnv[key]
    if (value) process.env[key] = value
  }
  sessionEnvReady = true
}

let cachedToken: string | undefined

async function appManagementToken(sessionEnv: NodeJS.ProcessEnv, forceRefresh = false): Promise<string> {
  ensureSessionEnv(sessionEnv)
  if (cachedToken && !forceRefresh) return cachedToken
  const {appManagementToken: token} = await ensureAuthenticatedAppManagementAndBusinessPlatform({
    noPrompt: true,
    forceRefresh,
  })
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
