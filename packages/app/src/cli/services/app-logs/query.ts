import {appManagementHeaders} from '@shopify/cli-kit/node/api/app-management'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'

interface QueryOptions {
  organizationId: string
  clientId: string
  minutes: number
  limit: number
  offset: number
  types?: string[]
  demo: boolean
}

export async function queryAppLogs(options: QueryOptions): Promise<unknown> {
  if (process.env.SHOPIFY_APP_LOG_QUERY_PROTOTYPE !== '1' || process.env.SHOPIFY_SERVICE_ENV !== 'local') {
    throw new AbortError('Prototype only: set SHOPIFY_APP_LOG_QUERY_PROTOTYPE=1 and SHOPIFY_SERVICE_ENV=local.')
  }
  if (!/^\d+$/.test(options.organizationId) || !options.clientId) {
    throw new AbortError('Provide a numeric organization ID and a nonempty app client ID.')
  }
  if (
    !Number.isInteger(options.minutes) ||
    options.minutes < 1 ||
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    !Number.isInteger(options.offset) ||
    options.offset < 0
  ) {
    throw new AbortError('Use positive integers for minutes and limit, and a nonnegative integer for offset.')
  }

  const {origin, token} = await queryConnection(options.demo)
  const end = new Date()
  const response = await fetch(
    `${origin}/app_management/unstable/organizations/${options.organizationId}/app_logs/query`,
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: appManagementHeaders(token),
      body: JSON.stringify({
        api_key: options.clientId,
        start_time: new Date(end.getTime() - options.minutes * 60 * 1000).toISOString(),
        end_time: end.toISOString(),
        limit: options.limit,
        offset: options.offset,
        ...(options.types ? {types: options.types} : {}),
      }),
    },
  )
  if (!response.ok) {
    throw new AbortError(`Local log query failed (HTTP ${response.status}). Check the local API server output.`)
  }
  return response.json()
}

async function queryConnection(demo: boolean): Promise<{origin: string; token: string}> {
  if (demo) {
    const path = process.env.APP_LOG_QUERY_DEMO_TOKEN_FILE
    if (!path) throw new AbortError('Set APP_LOG_QUERY_DEMO_TOKEN_FILE to the file printed by the local demo server.')
    const token = (await readFile(path)).trim()
    if (!token.startsWith('atkn_') || token.length > 4096) throw new AbortError('Invalid demo token file.')
    return {origin: 'http://127.0.0.1:4387', token}
  }

  const host = await appManagementFqdn()
  if (host !== 'app.shop.dev') throw new AbortError('This prototype can only call app.shop.dev.')
  const {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform()
  return {origin: `https://${host}`, token: appManagementToken}
}
