/* eslint-disable @nx/enforce-module-boundaries, no-await-in-loop -- this
   subprocess uses cli-kit's built API client with the isolated E2E session */
import {appDeletionReadinessFromApps} from './app-management-state.js'
import {appManagementFqdn} from '../../cli-kit/dist/public/node/context/fqdn.js'
import {graphqlRequest} from '../../cli-kit/dist/public/node/api/graphql.js'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '../../cli-kit/dist/public/node/session.js'
import {loadtestHeaderRecord} from '../helpers/loadtest-header.js'
import type {AppDeletionReadiness} from './teardown-orchestrator.js'
import type {AppManagementAppState} from './app-management-state.js'

const RESULT_PREFIX = 'E2E_APP_MANAGEMENT_RESULT='

interface InspectionOptions {
  appName: string
  clientId?: string
  orgId: string
  timeoutMs?: number
  pollIntervalMs?: number
}

interface AppsQueryResult {
  appsConnection?: {edges: {node: AppManagementAppState}[]} | null
}

const query = `
  query E2ETeardownApps($query: String) {
    appsConnection(query: $query, first: 50) {
      edges {
        node {
          id
          key
          installCount
          activeRelease {
            version {
              name
            }
          }
        }
      }
    }
  }
`

const options = JSON.parse(await readStandardInput()) as InspectionOptions
const timeoutMs = options.timeoutMs ?? 30_000
const pollIntervalMs = options.pollIntervalMs ?? 2_000
const deadline = Date.now() + timeoutMs
const missingAppConfirmationsRequired = 2
const apiUrl = `https://${await appManagementFqdn()}/app_management/unstable/graphql.json`

let {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: true})

async function inspectApp(): Promise<AppDeletionReadiness> {
  const result = await graphqlRequest<AppsQueryResult>({
    api: 'App Management',
    url: apiUrl,
    token: appManagementToken,
    addedHeaders: loadtestHeaderRecord(),
    query,
    variables: {
      query: `title:${options.appName}`,
      // App Management reads this undeclared variable to route the request to the organization.
      organizationId: options.orgId,
    },
    unauthorizedHandler: {
      type: 'token_refresh',
      handler: async () => {
        const refreshed = await ensureAuthenticatedAppManagementAndBusinessPlatform({
          noPrompt: true,
          forceRefresh: true,
        })
        appManagementToken = refreshed.appManagementToken
        return {token: appManagementToken}
      },
    },
  })

  if (!result.appsConnection) {
    throw new Error('App Management API did not return appsConnection')
  }

  return appDeletionReadinessFromApps(
    result.appsConnection.edges.map((edge) => edge.node),
    options.appName,
    options.clientId,
  )
}

let readiness: AppDeletionReadiness
let missingAppConfirmations = 0

while (true) {
  readiness = await inspectApp()
  missingAppConfirmations = readiness.status === 'already-deleted' ? missingAppConfirmations + 1 : 0

  if (readiness.status === 'ready') break
  if (readiness.status === 'already-deleted' && missingAppConfirmations >= missingAppConfirmationsRequired) break
  if (Date.now() >= deadline) break

  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
}

process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify(readiness)}\n`)

async function readStandardInput(): Promise<string> {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk.toString()
  }
  return input
}
