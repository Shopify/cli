import {EMBEDDED_APP_SECURITY_INSTRUCTIONS} from './checks/embedded.js'
import {buildAgentChecks, type AgentChecks} from './checks/index.js'
import {readProjectState, scan} from './scanners/index.js'
import {buildDeterministicFindings} from './scan-artifact/index.js'
import {getEngineVersion} from './version.js'
import type {DeterministicFindingsDocument, ScanInput, ScanOptions, ScanResult} from './types.js'

export {getEngineVersion, readProjectState}

export interface AppSecurityEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface AppSecurityScan {
  scan: ScanResult
  deterministicFindings: DeterministicFindingsDocument
  agentChecks: AgentChecks
  engine: AppSecurityEngineMetadata
}

export function getAgentInstructions(): string {
  return EMBEDDED_APP_SECURITY_INSTRUCTIONS
}

export async function scanApp(input: ScanInput, options?: ScanOptions): Promise<AppSecurityScan> {
  const result = await scan(input, options)
  const engineVersion = getEngineVersion()
  const deterministicFindings = buildDeterministicFindings(result, {engineVersion})
  return {
    scan: result,
    deterministicFindings,
    agentChecks: buildAgentChecks(engineVersion),
    engine: deterministicFindings.engine,
  }
}
