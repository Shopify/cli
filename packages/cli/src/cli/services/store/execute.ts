import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchApiVersions, adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {renderSingleTask, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, outputResult, outputToken} from '@shopify/cli-kit/node/output'
import {fileExists, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {parse} from 'graphql'
import {getStoredStoreAppSession, setStoredStoreAppSession, clearStoredStoreAppSession, isSessionExpired} from './session.js'
import {STORE_AUTH_APP_CLIENT_ID, maskToken} from './config.js'
import type {StoredStoreAppSession} from './session.js'

interface ExecuteStoreOperationInput {
  store: string
  query: string
  variables?: string
  variableFile?: string
  outputFile?: string
  version?: string
  allowMutations?: boolean
  mock?: boolean
}

const DEFAULT_MOCK_API_VERSION = '2025-10'

async function parseVariables(
  variables?: string,
  variableFile?: string,
): Promise<{[key: string]: unknown} | undefined> {
  if (variables) {
    try {
      return JSON.parse(variables)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(
        outputContent`Invalid JSON in ${outputToken.yellow('--variables')} flag: ${errorMessage}`,
        'Please provide valid JSON format.',
      )
    }
  } else if (variableFile) {
    if (!(await fileExists(variableFile))) {
      throw new AbortError(
        outputContent`Variable file not found at ${outputToken.path(
          variableFile,
        )}. Please check the path and try again.`,
      )
    }

    const fileContent = await readFile(variableFile, {encoding: 'utf8'})
    try {
      return JSON.parse(fileContent)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new AbortError(
        outputContent`Invalid JSON in variable file ${outputToken.path(variableFile)}: ${errorMessage}`,
        'Please provide valid JSON format.',
      )
    }
  }

  return undefined
}

function validateSingleOperation(graphqlOperation: string): void {
  let document

  try {
    document = parse(graphqlOperation)
  } catch (error) {
    if (error instanceof Error) {
      throw new AbortError(`Invalid GraphQL syntax: ${error.message}`)
    }

    throw error
  }

  const operationDefinitions = document.definitions.filter((definition) => definition.kind === 'OperationDefinition')

  if (operationDefinitions.length !== 1) {
    throw new AbortError(
      'GraphQL document must contain exactly one operation definition. Multiple operations are not supported.',
    )
  }
}

function isMutation(graphqlOperation: string): boolean {
  const document = parse(graphqlOperation)
  const operationDefinition = document.definitions.find((definition) => definition.kind === 'OperationDefinition')

  return operationDefinition?.operation === 'mutation'
}

function validateMutationsAllowed(graphqlOperation: string, allowMutations = false): void {
  if (isMutation(graphqlOperation) && !allowMutations) {
    throw new AbortError(
      'Mutations are disabled by default for shopify store execute.',
      'Re-run with --allow-mutations if you intend to modify store data.',
    )
  }
}

async function resolveApiVersion(options: {
  adminSession: AdminSession
  userSpecifiedVersion?: string
}): Promise<string> {
  const {adminSession, userSpecifiedVersion} = options

  if (userSpecifiedVersion === 'unstable') return userSpecifiedVersion

  const availableVersions = await fetchApiVersions(adminSession)

  if (!userSpecifiedVersion) {
    const supportedVersions = availableVersions.filter((version) => version.supported).map((version) => version.handle)
    return supportedVersions.sort().reverse()[0]!
  }

  const versionList = availableVersions.map((version) => version.handle)
  if (versionList.includes(userSpecifiedVersion)) return userSpecifiedVersion

  throw new AbortError(`Invalid API version: ${userSpecifiedVersion}`, `Allowed versions: ${versionList.join(', ')}`)
}

function buildMockResponse(input: {
  store: string
  query: string
  variables?: {[key: string]: unknown}
  version?: string
}) {
  return {
    data: {
      mockExecute: {
        store: input.store,
        version: input.version ?? DEFAULT_MOCK_API_VERSION,
        operation: isMutation(input.query) ? 'mutation' : 'query',
        query: input.query,
        variables: input.variables ?? null,
      },
    },
    extensions: {
      mock: true,
    },
  }
}

function isGraphQLClientError(error: unknown): error is {response: {errors?: unknown; status?: number}} {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: unknown}).response
  return !!response && typeof response === 'object'
}

async function writeOrOutputResult(result: unknown, outputFile?: string): Promise<void> {
  const resultString = JSON.stringify(result, null, 2)

  if (outputFile) {
    await writeFile(outputFile, resultString)
    renderSuccess({
      headline: 'Operation succeeded.',
      body: `Results written to ${outputFile}`,
    })
  } else {
    renderSuccess({headline: 'Operation succeeded.'})
    outputResult(resultString)
  }
}

async function refreshStoreToken(session: StoredStoreAppSession): Promise<StoredStoreAppSession> {
  if (!session.refreshToken) {
    throw new AbortError(
      `No refresh token stored for ${session.store}.`,
      `Run ${outputToken.genericShellCommand(`shopify store auth --store ${session.store} --scopes ${session.scopes.join(',')}`).value} to re-authenticate.`,
    )
  }

  const endpoint = `https://${session.store}/admin/oauth/access_token`

  outputDebug(
    outputContent`Refreshing expired token for ${outputToken.raw(session.store)} (expired at ${outputToken.raw(session.expiresAt ?? 'unknown')}, refresh_token=${outputToken.raw(maskToken(session.refreshToken))})`,
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: STORE_AUTH_APP_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  })

  const body = await response.text()

  if (!response.ok) {
    outputDebug(outputContent`Token refresh failed with HTTP ${outputToken.raw(String(response.status))}: ${outputToken.raw(body.slice(0, 300))}`)
    clearStoredStoreAppSession(session.store)
    throw new AbortError(
      `Token refresh failed for ${session.store} (HTTP ${response.status}).`,
      `Run ${outputToken.genericShellCommand(`shopify store auth --store ${session.store} --scopes ${session.scopes.join(',')}`).value} to re-authenticate.`,
    )
  }

  let data: {access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number}
  try {
    data = JSON.parse(body)
  } catch {
    throw new AbortError('Received an invalid refresh response from Shopify.')
  }

  if (!data.access_token) {
    clearStoredStoreAppSession(session.store)
    throw new AbortError(
      `Token refresh returned an invalid response for ${session.store}.`,
      `Run ${outputToken.genericShellCommand(`shopify store auth --store ${session.store} --scopes ${session.scopes.join(',')}`).value} to re-authenticate.`,
    )
  }

  const now = Date.now()
  const newExpiresAt = data.expires_in ? new Date(now + data.expires_in * 1000).toISOString() : session.expiresAt

  const refreshedSession: StoredStoreAppSession = {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
    expiresAt: newExpiresAt,
    refreshTokenExpiresAt: data.refresh_token_expires_in
      ? new Date(now + data.refresh_token_expires_in * 1000).toISOString()
      : session.refreshTokenExpiresAt,
    acquiredAt: new Date(now).toISOString(),
  }

  outputDebug(
    outputContent`Token refresh succeeded for ${outputToken.raw(session.store)}: ${outputToken.raw(maskToken(session.accessToken))} → ${outputToken.raw(maskToken(refreshedSession.accessToken))}, new expiry ${outputToken.raw(newExpiresAt ?? 'unknown')}`,
  )

  setStoredStoreAppSession(refreshedSession)
  return refreshedSession
}

async function loadAuthenticatedStoreSession(store: string): Promise<AdminSession> {
  let session = getStoredStoreAppSession(store)

  if (!session) {
    throw new AbortError(
      `No stored app authentication found for ${store}.`,
      `Run ${outputToken.genericShellCommand(`shopify store auth --store ${store} --scopes <comma-separated-scopes>`).value} first.`,
    )
  }

  outputDebug(
    outputContent`Loaded stored session for ${outputToken.raw(store)}: token=${outputToken.raw(maskToken(session.accessToken))}, expires=${outputToken.raw(session.expiresAt ?? 'unknown')}`,
  )

  if (isSessionExpired(session)) {
    session = await refreshStoreToken(session)
  }

  return {
    token: session.accessToken,
    storeFqdn: session.store,
  }
}

export async function executeStoreOperation(input: ExecuteStoreOperationInput): Promise<void> {
  const {store, query, variables, variableFile, outputFile, version: userSpecifiedVersion, allowMutations, mock} =
    input

  validateSingleOperation(query)
  validateMutationsAllowed(query, allowMutations)

  const parsedVariables = await parseVariables(variables, variableFile)

  if (mock) {
    const result = buildMockResponse({
      store,
      query,
      variables: parsedVariables,
      version: userSpecifiedVersion,
    })

    await writeOrOutputResult(result, outputFile)
    return
  }

  const {adminSession, version} = await renderSingleTask({
    title: outputContent`Authenticating`,
    task: async (): Promise<{adminSession: AdminSession; version: string}> => {
      const adminSession = await loadAuthenticatedStoreSession(store)
      const version = await resolveApiVersion({adminSession, userSpecifiedVersion})
      return {adminSession, version}
    },
    renderOptions: {stdout: process.stderr},
  })

  try {
    const result = await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return graphqlRequest({
          query,
          api: 'Admin',
          url: adminUrl(adminSession.storeFqdn, version, adminSession),
          token: adminSession.token,
          variables: parsedVariables,
          responseOptions: {handleErrors: false},
        })
      },
      renderOptions: {stdout: process.stderr},
    })

    await writeOrOutputResult(result, outputFile)
  } catch (error) {
    if (isGraphQLClientError(error) && error.response.status === 401) {
      clearStoredStoreAppSession(store)
      throw new AbortError(
        `Stored app authentication for ${store} is no longer valid.`,
        `Run ${outputToken.genericShellCommand(`shopify store auth --store ${store} --scopes <comma-separated-scopes>`).value} to re-authenticate.`,
      )
    }

    if (isGraphQLClientError(error) && error.response.errors) {
      throw new AbortError('GraphQL operation failed.', JSON.stringify({errors: error.response.errors}, null, 2))
    }

    throw error
  }
}
