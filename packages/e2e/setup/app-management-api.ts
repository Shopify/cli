/* eslint-disable no-restricted-imports -- this wrapper runs the cli-kit API client in a tsx subprocess */
import {execa} from 'execa'
import * as path from 'path'
import {fileURLToPath} from 'url'
import type {AppDeletionReadiness} from './teardown-orchestrator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESULT_PREFIX = 'E2E_APP_MANAGEMENT_RESULT='

interface AppDeletionReadinessOptions {
  appName: string
  clientId?: string
  orgId: string
  timeoutMs?: number
  pollIntervalMs?: number
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
    timeout: (options.timeoutMs ?? 30_000) + 90_000,
  })

  const resultLine = result.stdout.split('\n').findLast((line) => line.startsWith(RESULT_PREFIX))
  if (!resultLine) {
    throw new Error('App Management inspection did not return a result')
  }

  return JSON.parse(resultLine.slice(RESULT_PREFIX.length)) as AppDeletionReadiness
}
