import {EMBEDDED_APP_SECURITY_INSTRUCTIONS} from './checks/embedded.js'
import {buildReviewPack, type ReviewPack} from './checks/index.js'
import {AppRootDiscoveryError, findAppRoot} from './scanners/discover.js'
import {scan} from './scanners/index.js'
import {buildDeterministicFindings} from './scan-artifact/index.js'
import {getEngineVersion} from './version.js'
import type {DeterministicFindingsDocument, ScanOptions, ScanResult} from './types.js'

export {AppRootDiscoveryError, findAppRoot}

export interface AppSecurityEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface AppSecurityScan {
  appRoot: string
  scan: ScanResult
  artifact: DeterministicFindingsDocument
  reviewPack: ReviewPack
  engine: AppSecurityEngineMetadata
}

export function getAgentInstructions(): string {
  return EMBEDDED_APP_SECURITY_INSTRUCTIONS
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
  const artifact = buildDeterministicFindings(result, {engineVersion})
  return {
    appRoot,
    scan: result,
    artifact,
    reviewPack,
    engine: artifact.engine,
  }
}
