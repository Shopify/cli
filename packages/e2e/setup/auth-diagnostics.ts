import {isValidLoadtestHeader} from '../helpers/loadtest-header.js'

export type AuthStage = 'configuration' | 'pty-startup' | 'device-code-generation' | 'browser-login' | 'session-prewarm'

export interface AuthConfig {
  email: string
  password: string
  orgId: string
}

export class AuthSetupError extends Error {
  readonly stage: AuthStage
  readonly reason: string
  readonly retryable: boolean

  constructor(stage: AuthStage, reason: string) {
    super(`[e2e][auth] failed stage=${stage} reason=${reason}`)
    this.name = 'AuthSetupError'
    this.stage = stage
    this.reason = reason
    this.retryable = isRetryableAuthFailure(stage, reason)
  }
}

export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const requiredValues = {
    E2E_ACCOUNT_EMAIL: env.E2E_ACCOUNT_EMAIL,
    E2E_ACCOUNT_PASSWORD: env.E2E_ACCOUNT_PASSWORD,
    E2E_ORG_ID: env.E2E_ORG_ID,
    E2E_LOADTEST_HEADER: env.E2E_LOADTEST_HEADER,
  }
  const missingVariables = Object.entries(requiredValues)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name)

  if (missingVariables.length > 0) {
    throw new AuthSetupError('configuration', `missing-${missingVariables.join(',')}`)
  }

  const loadtestHeader = requiredValues.E2E_LOADTEST_HEADER!.trim()
  if (!isValidLoadtestHeader(loadtestHeader)) {
    throw new AuthSetupError('configuration', 'invalid-loadtest-header')
  }

  return {
    email: requiredValues.E2E_ACCOUNT_EMAIL!.trim(),
    password: requiredValues.E2E_ACCOUNT_PASSWORD!,
    orgId: requiredValues.E2E_ORG_ID!.trim(),
  }
}

function isRetryableAuthFailure(stage: AuthStage, reason: string): boolean {
  return (
    (stage === 'device-code-generation' && reason === 'timeout') ||
    (stage === 'browser-login' && (reason === 'page-load' || reason === 'cli-confirmation-timeout')) ||
    (stage === 'session-prewarm' && reason.endsWith('-page-load'))
  )
}

export function validateRemoteE2EEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  readAuthConfig(env)
  if (!env.E2E_STORE_FQDN?.trim()) {
    throw new AuthSetupError('configuration', 'missing-E2E_STORE_FQDN')
  }
}

export async function retryAuthOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    delayMs?: number
    onRetry?: (failure: AuthSetupError, nextAttempt: number) => void
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2
  const delayMs = options.delayMs ?? 1_000

  const runAttempt = async (attempt: number): Promise<T> => {
    try {
      return await operation()
    } catch (error) {
      if (!(error instanceof AuthSetupError)) throw error
      if (!error.retryable || attempt === maxAttempts) throw error

      options.onRetry?.(error, attempt + 1)
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
      return runAttempt(attempt + 1)
    }
  }

  return runAttempt(1)
}
