import {clientIdSource, effectiveClientId} from './app-security-selection.js'
import type {AppSecurityEngineMetadata, AppSecurityExecution} from './app-security-api.js'
import type {AppSecurityScanDirectory, AppSecuritySelection} from './app-security-selection.js'
import type {DeterministicFindingsDocument} from './app-security-engine/index.js'

interface AppSecurityJsonResult {
  engine: AppSecurityEngineMetadata
  selection: {
    app_directory: string
    app_config_file: string | null
    client_id: string | null
    client_id_source: 'config' | 'flag' | 'picker' | null
    scan_directories: AppSecurityScanDirectory[]
  }
  deterministic_findings: DeterministicFindingsDocument
  agent_checks_path: string
}

export function toSecurityJson(
  execution: Pick<AppSecurityExecution, 'engine' | 'deterministicFindings'>,
  agentChecksPath: string,
  selection: AppSecuritySelection,
  scanDirectories: AppSecurityScanDirectory[],
): AppSecurityJsonResult {
  return {
    engine: execution.engine,
    selection: {
      app_directory: selection.appDirectory,
      app_config_file: selection.kind === 'config' ? selection.appConfigFilePath : null,
      client_id: effectiveClientId(selection) ?? null,
      client_id_source: clientIdSource(selection) ?? null,
      scan_directories: scanDirectories,
    },
    deterministic_findings: execution.deterministicFindings,
    agent_checks_path: agentChecksPath,
  }
}

export function encodeSecurityJson(result: AppSecurityJsonResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}
