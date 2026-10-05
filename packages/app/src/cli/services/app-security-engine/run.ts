import {defaultCheckSet, type AppSecurityCheckSet} from './check-set.js'
import {EMBEDDED_APP_SECURITY_INSTRUCTIONS} from './checks/embedded.js'
import {
  buildAgentChecks,
  recordAgentFindings,
  type AgentChecks,
  type RecordAgentFindingsOptions,
} from './checks/index.js'
import {AppRootDiscoveryError, findAppRoot} from './scanners/discover.js'
import {readProjectState, scan} from './scanners/index.js'
import {buildDeterministicFindings} from './scan-artifact/index.js'
import {getEngineVersion} from './version.js'
import type {DeterministicFindingsDocument, ScanOptions, ScanResult} from './types.js'

export {AppRootDiscoveryError, findAppRoot, getEngineVersion, readProjectState}

export interface AppSecurityEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface AppSecurityScan {
  appRoot: string
  scan: ScanResult
  deterministicFindings: DeterministicFindingsDocument
  agentChecks: AgentChecks
  engine: AppSecurityEngineMetadata
}

export function getAgentInstructions(): string {
  return EMBEDDED_APP_SECURITY_INSTRUCTIONS
}

export async function scanApp(
  directory?: string,
  configFileName?: string,
  options?: ScanOptions,
  checkSet: AppSecurityCheckSet = defaultCheckSet,
): Promise<AppSecurityScan> {
  const appRoot = findAppRoot(directory)
  const result = await scan(appRoot, configFileName, options, checkSet)
  const engineVersion = getEngineVersion()
  const deterministicFindings = buildDeterministicFindings(result, {engineVersion, checkSet})
  return {
    appRoot,
    scan: result,
    deterministicFindings,
    agentChecks: buildAgentChecks(engineVersion, checkSet),
    engine: deterministicFindings.engine,
  }
}

/** Bind another check package while retaining the local scan/review/record workflow. */
export function createAppSecurityEngine(checkSet: AppSecurityCheckSet) {
  return {
    scanApp: (directory?: string, configFileName?: string, options?: ScanOptions) =>
      scanApp(directory, configFileName, options, checkSet),
    recordAgentFindings: (document: unknown, options: Omit<RecordAgentFindingsOptions, 'checkSet'>) =>
      recordAgentFindings(document, {...options, checkSet}),
  }
}
