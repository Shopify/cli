import {appManagementHeaders} from '@shopify/cli-kit/node/api/app-management'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {readStdinString} from '@shopify/cli-kit/node/system'

export const logsJsonOutputSchema = defineJsonOutputSchema({
  name: 'LogsGraphQLResponse',
  schema: zod
    .object({
      data: zod.record(zod.unknown()).nullable().optional(),
      errors: zod
        .array(zod.object({message: zod.string()}).passthrough())
        .min(1)
        .optional(),
      extensions: zod.record(zod.unknown()).optional(),
    })
    .passthrough()
    .refine((response) => response.data !== undefined || response.errors !== undefined),
})

export interface LogsQueryOptions {
  api?: string
  query?: string
  queryFile?: string
  variables?: string
  variableFile?: string
  operationName?: string
  noPrompt: boolean
  demo: boolean
}

interface LogsQueryResult {
  response: InferJsonOutputSchema<typeof logsJsonOutputSchema>
  failed: boolean
}

export async function executeLogsQuery(options: LogsQueryOptions): Promise<LogsQueryResult> {
  if (options.api !== undefined && options.api !== 'app-logs') {
    throw new AbortError('Unsupported logs API. Use --api app-logs.')
  }
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
    const result = zod.record(zod.unknown()).safeParse(parsed)
    if (!result.success) throw new AbortError('GraphQL variables must be a JSON object.')
    variables = result.data
  }

  const origin = options.demo ? 'http://127.0.0.1:4388' : await localOrigin()
  if (getAppAutomationToken()) {
    throw new AbortError(
      'This prototype requires a signed-in Shopify account.',
      'Unset SHOPIFY_APP_AUTOMATION_TOKEN and SHOPIFY_CLI_PARTNERS_TOKEN before signing in.',
    )
  }
  const {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: options.noPrompt})
  const response = await fetch(`${origin}/app_observability/unstable/graphql`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
    headers: appManagementHeaders(appManagementToken),
    body: JSON.stringify({query, variables, operationName: options.operationName}),
  })
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new AbortError(`App logs returned invalid JSON (HTTP ${response.status}).`)
  }
  const result = logsJsonOutputSchema.schema.safeParse(body)
  if (!result.success) {
    throw new AbortError(`App logs returned an invalid GraphQL response (HTTP ${response.status}).`)
  }
  return {response: result.data, failed: !response.ok || Boolean(result.data.errors?.length)}
}

async function localOrigin(): Promise<string> {
  const host = await appManagementFqdn()
  if (host !== 'app.shop.dev') throw new AbortError('This prototype can only call app.shop.dev.')
  return `https://${host}`
}
