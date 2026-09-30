import {EMBEDDED_APP_SECURITY_INSTRUCTIONS} from './checks/embedded.js'
import {buildReviewPack, type ReviewPack} from './checks/index.js'
import {AppRootDiscoveryError, findAppRoot} from './scanners/discover.js'
import {scan} from './scanners/index.js'
import {compileTrace, validateTrace} from './trace/index.js'
import {getEngineVersion} from './version.js'
import type {ScanOptions, ScanResult, TraceV3} from './types.js'

export {AppRootDiscoveryError, findAppRoot}

export interface AppSecurityEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface AppSecurityScan {
  operation: 'scan'
  appRoot: string
  scan: ScanResult
  trace: TraceV3
  reviewPack: ReviewPack
  engine: AppSecurityEngineMetadata
}

export type ParseTraceResult = {ok: true; trace: TraceV3} | {ok: false; errors: string[]}

export function getAgentInstructions(): string {
  return EMBEDDED_APP_SECURITY_INSTRUCTIONS
}

export function parseTrace(value: unknown): ParseTraceResult {
  const validation = validateTrace(value)
  return validation.valid ? {ok: true, trace: value as TraceV3} : {ok: false, errors: validation.errors}
}

export async function scanApp(
  directory?: string,
  configFileName?: string,
  options?: ScanOptions,
): Promise<AppSecurityScan> {
  const appRoot = findAppRoot(directory)
  const result = await scan(appRoot, configFileName, options)
  const engineVersion = getEngineVersion()
  const reviewPack = buildReviewPack(engineVersion)
  const trace = compileTrace(result, {engineVersion})
  return {
    operation: 'scan',
    appRoot,
    scan: result,
    trace,
    reviewPack,
    engine: trace.engine,
  }
}
