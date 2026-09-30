import {
  AppRootDiscoveryError,
  findAppRoot,
  scanApp,
  type AppSecurityEngineMetadata,
  type AppSecurityScan,
  type Severity,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export type {AppSecurityEngineMetadata}

export type AppSecurityBlockingLevel = Severity | 'none'

export type AppSecurityExecution = AppSecurityScan & {elapsedMilliseconds: number}

const severityRank: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export function securityExitCode(execution: AppSecurityExecution, blocking: AppSecurityBlockingLevel): number {
  if (blocking === 'none') return 0
  const blocks = execution.scan.issues.some((issue) => severityRank[issue.severity] >= severityRank[blocking])
  return blocks ? 1 : 0
}

export function resolveAppSecurityRoot(directory?: string): string {
  try {
    return findAppRoot(directory)
  } catch (error) {
    if (error instanceof AppRootDiscoveryError) {
      throw new AbortError(error.message, 'Run this command from a Shopify app directory or pass --path to one.')
    }
    throw error
  }
}

export async function executeAppSecurity(options: {
  appRoot: string
  configFileName?: string
  ignorePatterns?: ReadonlyArray<string>
}): Promise<AppSecurityExecution> {
  const startTime = Date.now()
  const result = await scanApp(options.appRoot, options.configFileName, {ignorePatterns: options.ignorePatterns})
  return {
    ...result,
    elapsedMilliseconds: Date.now() - startTime,
  }
}
