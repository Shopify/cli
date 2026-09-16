import {appManagementHeaders} from '@shopify/cli-kit/node/api/app-management'
import {developerDashboardFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {readStdinString} from '@shopify/cli-kit/node/system'
import {z} from 'zod'

const responseSchema = z
  .object({
    data: z.record(z.unknown()).nullable().optional(),
    errors: z
      .array(z.object({message: z.string()}).passthrough())
      .min(1)
      .optional(),
    extensions: z.record(z.unknown()).optional(),
  })
  .passthrough()
  .refine((response) => response.data !== undefined || response.errors !== undefined)

interface ExecuteOptions {
  query?: string
  queryFile?: string
  variables?: string
  variableFile?: string
  operationName?: string
  demo: boolean
}

interface ExecuteResult {
  response: z.infer<typeof responseSchema>
  failed: boolean
}

export async function executeDevPlatformOperation(options: ExecuteOptions): Promise<ExecuteResult> {
  if (process.env.SHOPIFY_APP_LOG_QUERY_PROTOTYPE !== '1' || process.env.SHOPIFY_SERVICE_ENV !== 'local') {
    throw new AbortError('Prototype only: set SHOPIFY_APP_LOG_QUERY_PROTOTYPE=1 and SHOPIFY_SERVICE_ENV=local.')
  }
  if ((options.query === undefined) === (options.queryFile === undefined)) {
    throw new AbortError('Provide exactly one of --query or --query-file.')
  }
  if (options.variables !== undefined && options.variableFile !== undefined) {
    throw new AbortError('Provide either --variables or --variable-file, not both.')
  }

  const query =
    options.query ?? (options.queryFile === '-' ? await readStdinString() : await readFile(options.queryFile!))
  if (!query?.trim()) throw new AbortError('Provide a nonempty GraphQL document.')

  const variableText =
    options.variables ?? (options.variableFile === undefined ? undefined : await readFile(options.variableFile))
  let variables: Record<string, unknown> | undefined
  if (variableText !== undefined) {
    let parsed: unknown
    try {
      parsed = JSON.parse(variableText)
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      throw new AbortError('GraphQL variables must be a valid JSON object.')
    }
    const result = z.record(z.unknown()).safeParse(parsed)
    if (!result.success) throw new AbortError('GraphQL variables must be a JSON object.')
    variables = result.data
  }

  const {origin, token} = await queryConnection(options.demo)
  const response = await fetch(`${origin}/api/unstable/graphql`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: appManagementHeaders(token),
    body: JSON.stringify({query, variables, operationName: options.operationName}),
  })
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new AbortError(`Local Dev Platform API returned invalid JSON (HTTP ${response.status}).`)
  }
  const result = responseSchema.safeParse(body)
  if (!result.success) {
    throw new AbortError(`Local Dev Platform API returned an invalid GraphQL response (HTTP ${response.status}).`)
  }
  return {response: result.data, failed: !response.ok || Boolean(result.data.errors?.length)}
}

async function queryConnection(demo: boolean): Promise<{origin: string; token: string}> {
  if (demo) {
    const path = process.env.APP_LOG_QUERY_DEMO_TOKEN_FILE
    if (!path) throw new AbortError('Set APP_LOG_QUERY_DEMO_TOKEN_FILE to the file printed by the local demo server.')
    const token = (await readFile(path)).trim()
    if (!token.startsWith('atkn_') || token.length > 4096) throw new AbortError('Invalid demo token file.')
    return {origin: 'http://127.0.0.1:4387', token}
  }

  const host = await developerDashboardFqdn()
  if (host !== 'dev.shop.dev') throw new AbortError('This prototype can only call dev.shop.dev.')
  const {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform()
  return {origin: `https://${host}`, token: appManagementToken}
}
