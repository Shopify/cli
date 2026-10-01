export type AuthStage = 'configuration' | 'pty-startup' | 'device-code-generation' | 'browser-login' | 'session-prewarm'

export interface AuthConfig {
  email: string
  password: string
  orgId: string
}

interface NavigationResponse {
  ok(): boolean
}

interface UrlWaiter {
  waitForURL(predicate: (url: URL) => boolean, options: {timeout: number}): Promise<unknown>
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

export async function runAuthStages<T>({
  authenticate,
  prewarm,
  complete,
  dispose,
  onRetry,
  delayMs,
}: {
  authenticate: () => Promise<T>
  prewarm: (authenticatedSession: T) => Promise<void>
  complete: (authenticatedSession: T) => Promise<void>
  dispose: (authenticatedSession: T) => Promise<void>
  onRetry?: (failure: AuthSetupError, nextAttempt: number) => void
  delayMs?: number
}): Promise<void> {
  const authenticatedSession = await retryAuthOperation(authenticate, {onRetry, delayMs})
  try {
    await retryAuthOperation(() => prewarm(authenticatedSession), {onRetry, delayMs})
    await complete(authenticatedSession)
  } finally {
    await dispose(authenticatedSession)
  }
}

export async function requireSuccessfulNavigation(
  navigate: () => Promise<NavigationResponse | null>,
  stage: AuthStage,
  reason: string,
): Promise<void> {
  try {
    const response = await navigate()
    if (!response?.ok()) throw new AuthSetupError(stage, reason)
  } catch (error) {
    if (error instanceof AuthSetupError) throw error
    throw new AuthSetupError(stage, reason)
  }
}

export function isExpectedAuthDestination(rawUrl: string, hostname: string, pathnamePrefix?: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.hostname === hostname && (!pathnamePrefix || url.pathname.startsWith(pathnamePrefix))
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

export async function requireExpectedAuthDestination(
  page: UrlWaiter,
  hostname: string,
  pathnamePrefix: string | undefined,
  timeout: number,
  reason: string,
): Promise<void> {
  try {
    await page.waitForURL((url) => isExpectedAuthDestination(url.href, hostname, pathnamePrefix), {timeout})
  } catch (_error) {
    throw new AuthSetupError('session-prewarm', reason)
  }
}
