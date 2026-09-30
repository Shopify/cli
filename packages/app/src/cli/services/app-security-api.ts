import {
  AppRootDiscoveryError,
  FindingsDocumentError,
  compileFindings,
  findAppRoot,
  parseFindings,
  parseRequestManifest,
  RequestManifestError,
  scanApp,
  type AppSecurityCompile,
  type AppSecurityEngineMetadata,
  type AppSecurityFindings,
  type AppSecurityScan,
  type AppSecurityRequestManifest,
  type FindingsDocument,
  type Severity,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileSize, readFile} from '@shopify/cli-kit/node/fs'

const MAX_FINDINGS_FILE_SIZE_BYTES = 5_000_000
const MAX_REQUEST_MANIFEST_FILE_SIZE_BYTES = 1_000_000

export type {AppSecurityEngineMetadata, AppSecurityFindings}

export type AppSecurityBlockingLevel = Severity | 'none'

export type AppSecurityExecution = (AppSecurityScan | AppSecurityCompile) & {elapsedMilliseconds: number}

const severityRank: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export function securityExitCode(execution: AppSecurityExecution, blocking: AppSecurityBlockingLevel): number {
  if (execution.operation === 'compile' && execution.findings.rejected.length > 0) return 2
  if (shouldBlock(execution.scan.issues, blocking)) return 1
  return 0
}

function shouldBlock(issues: {severity: Severity}[], blocking: AppSecurityBlockingLevel): boolean {
  if (blocking === 'none') return false
  return issues.some((issue) => severityRank[issue.severity] >= severityRank[blocking])
}

export async function loadAppSecurityFindings(path: string): Promise<FindingsDocument> {
  let content: string
  try {
    const size = await fileSize(path)
    if (size > MAX_FINDINGS_FILE_SIZE_BYTES) {
      throw new AbortError(`Could not read App Security findings from ${path}.`, 'The file is larger than 5 MB.')
    }
    content = await readFile(path)
  } catch (error) {
    if (error instanceof AbortError) throw error
    throw new AbortError(
      `Could not read App Security findings from ${path}.`,
      error instanceof Error ? error.message : undefined,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new AbortError(
      `Could not parse App Security findings from ${path}.`,
      error instanceof Error ? error.message : undefined,
    )
  }

  try {
    return parseFindings(parsed)
  } catch (error) {
    if (error instanceof FindingsDocumentError) {
      throw new AbortError(error.message, error.tryMessage)
    }
    throw error
  }
}

export async function loadAppSecurityRequestManifest(path: string): Promise<AppSecurityRequestManifest> {
  let content: string
  try {
    const size = await fileSize(path)
    if (size > MAX_REQUEST_MANIFEST_FILE_SIZE_BYTES) {
      throw new AbortError(
        `Could not read the App Security request manifest from ${path}.`,
        'The file is larger than 1 MB.',
      )
    }
    content = await readFile(path)
  } catch (error) {
    if (error instanceof AbortError) throw error
    throw new AbortError(
      `Could not read the App Security request manifest from ${path}.`,
      error instanceof Error ? error.message : undefined,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new AbortError(
      `Could not parse the App Security request manifest from ${path}.`,
      error instanceof Error ? error.message : undefined,
    )
  }

  try {
    return parseRequestManifest(parsed)
  } catch (error) {
    if (error instanceof RequestManifestError) throw new AbortError(error.message)
    throw error
  }
}

export function normalizeAppSecurityProbeUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new AbortError('Invalid App Security probe URL.', 'Pass an absolute HTTP or HTTPS URL.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new AbortError(
      'Invalid App Security probe URL.',
      'Use HTTP or HTTPS without embedded credentials, query parameters, or a URL fragment.',
    )
  }
  return url.href
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
  findings?: FindingsDocument
  configFileName?: string
  probeUrl?: string
  requestManifest?: AppSecurityRequestManifest
}): Promise<AppSecurityExecution> {
  const startTime = Date.now()
  const probeUrl = options.probeUrl ? normalizeAppSecurityProbeUrl(options.probeUrl) : undefined
  const result = options.findings
    ? await compileFindings(
        options.appRoot,
        options.findings,
        options.configFileName,
        probeUrl,
        options.requestManifest,
      )
    : await scanApp(options.appRoot, options.configFileName, probeUrl, options.requestManifest)
  return {
    ...result,
    elapsedMilliseconds: Date.now() - startTime,
  }
}
