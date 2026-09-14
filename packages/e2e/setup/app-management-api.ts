/* eslint-disable no-restricted-imports -- this wrapper runs the cli-kit API client in a tsx subprocess */
import {execa} from 'execa'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESULT_PREFIX = 'E2E_APP_MANAGEMENT_RESULT='

export type AppDeletionReadiness =
  | {status: 'ready'; app: {id: string; key: string}}
  | {status: 'already-deleted'}
  | {status: 'still-installed'; installCount: number}

export interface AppManagementAppState {
  id: string
  key: string
  installCount?: number | null
  activeRelease: {version: {name: string}}
}

interface AppDeletionReadinessOptions {
  appName: string
  clientId?: string
  orgId: string
}

/**
 * Inspect the app and wait for its install count to reach zero.
 *
 * The subprocess is required because Playwright's transformed module graph
 * cannot load cli-kit's dist ESM on every supported CI Node version. Running
 * the API work under tsx also lets teardown use cli-kit's normal GraphQL
 * throttling, network retry, and token-refresh behavior.
 */
export async function waitForAppDeletionReadiness(
  sessionEnv: NodeJS.ProcessEnv,
  options: AppDeletionReadinessOptions,
): Promise<AppDeletionReadiness> {
  const script = path.join(__dirname, 'inspect-app-management-state.ts')
  const result = await execa('tsx', [script], {
    env: {...sessionEnv, SHOPIFY_FLAG_VERBOSE: undefined},
    extendEnv: false,
    preferLocal: true,
    localDir: path.resolve(__dirname, '..'),
    input: JSON.stringify(options),
    timeout: 120_000,
  })

  const resultLine = result.stdout.split('\n').findLast((line) => line.startsWith(RESULT_PREFIX))
  if (!resultLine) {
    throw new Error('App Management inspection did not return a result')
  }

  return JSON.parse(resultLine.slice(RESULT_PREFIX.length)) as AppDeletionReadiness
}

export function appDeletionReadinessFromApps(
  apps: AppManagementAppState[],
  appName: string,
  clientId?: string,
): AppDeletionReadiness {
  const exactNameMatches = apps.filter((app) => app.activeRelease.version.name === appName)
  const clientIdMatches = clientId ? exactNameMatches.filter((app) => app.key === clientId) : []
  const matchingApps = clientIdMatches.length > 0 ? clientIdMatches : exactNameMatches

  if (matchingApps.length === 0) return {status: 'already-deleted'}
  if (matchingApps.length > 1) {
    throw new Error(`App Management API returned multiple apps named ${appName}`)
  }

  const app = matchingApps[0]!
  if (typeof app.installCount !== 'number') {
    throw new Error(`App Management API did not return installCount for ${appName}`)
  }

  return app.installCount === 0
    ? {status: 'ready', app: {id: app.id, key: app.key}}
    : {status: 'still-installed', installCount: app.installCount}
}
