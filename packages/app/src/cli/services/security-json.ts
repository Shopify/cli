import type {AppSecurityEngineMetadata, AppSecurityExecution} from './app-security-api.js'
import type {DeterministicFindingsDocument} from './app-security-engine/index.js'

interface AppSecurityJsonResult {
  engine: AppSecurityEngineMetadata
  deterministic_findings: DeterministicFindingsDocument
  agent_checks_path: string
}

export function toSecurityJson(
  execution: Pick<AppSecurityExecution, 'engine' | 'artifact'>,
  agentChecksPath: string,
): AppSecurityJsonResult {
  return {
    engine: execution.engine,
    deterministic_findings: execution.artifact,
    agent_checks_path: agentChecksPath,
  }
}

export function encodeSecurityJson(result: AppSecurityJsonResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
