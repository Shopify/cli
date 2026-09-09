import {
  AppRootDiscoveryError,
  FindingsDocumentError,
  compileFindings,
  findAppRoot,
  parseFindings,
  scanApp,
  type AppDoctorCompile,
  type AppDoctorEngineMetadata,
  type AppDoctorFindings,
  type AppDoctorScan,
  type FindingsDocument,
  type Severity,
} from './app-doctor-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileSize, readFile} from '@shopify/cli-kit/node/fs'

const MAX_FINDINGS_FILE_SIZE_BYTES = 5_000_000

export type {AppDoctorEngineMetadata, AppDoctorFindings, FindingsDocument}

export type AppDoctorBlockingLevel = Severity | 'none'

export type AppDoctorExecution = (AppDoctorScan | AppDoctorCompile) & {elapsedMilliseconds: number}

const severityRank: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export function doctorExitCode(execution: AppDoctorExecution, blocking: AppDoctorBlockingLevel): number {
  if (execution.operation === 'compile' && execution.findings.rejected.length > 0) return 2
  if (shouldBlock(execution.scan.issues, blocking)) return 1
  return 0
}

function shouldBlock(issues: {severity: Severity}[], blocking: AppDoctorBlockingLevel): boolean {
  if (blocking === 'none') return false
  return issues.some((issue) => severityRank[issue.severity] >= severityRank[blocking])
}

export async function loadAppDoctorFindings(path: string): Promise<FindingsDocument> {
  let content: string
  try {
    const size = await fileSize(path)
    if (size > MAX_FINDINGS_FILE_SIZE_BYTES) {
      throw new AbortError(`Could not read App Doctor findings from ${path}.`, 'The file is larger than 5 MB.')
    }
    content = await readFile(path)
  } catch (error) {
    if (error instanceof AbortError) throw error
    throw new AbortError(
      `Could not read App Doctor findings from ${path}.`,
      error instanceof Error ? error.message : undefined,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new AbortError(
      `Could not parse App Doctor findings from ${path}.`,
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

export function resolveAppDoctorRoot(directory?: string): string {
  try {
    return findAppRoot(directory)
  } catch (error) {
    if (error instanceof AppRootDiscoveryError) {
      throw new AbortError(error.message, 'Run this command from a Shopify app directory or pass --path to one.')
    }
    throw error
  }
}

export async function executeAppDoctor(options: {
  appRoot: string
  findings?: FindingsDocument
}): Promise<AppDoctorExecution> {
  const startTime = Date.now()
  const result = options.findings
    ? await compileFindings(options.appRoot, options.findings)
    : await scanApp(options.appRoot)
  return {
    ...result,
    elapsedMilliseconds: Date.now() - startTime,
  }
}
