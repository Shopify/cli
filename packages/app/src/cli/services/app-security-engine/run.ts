import {EMBEDDED_APP_SECURITY_INSTRUCTIONS} from './checks/embedded.js'
import {buildAgentChecks, type AgentChecks} from './checks/index.js'
import {scan} from './scanners/index.js'
import {buildDeterministicFindings} from './scan-artifact/index.js'
import {getEngineVersion} from './version.js'
import {normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import type {CoverageScanDirectory, DeterministicFindingsDocument, ScanInput, ScanOptions, ScanResult} from './types.js'

export {getEngineVersion}

export interface AppSecurityEngineMetadata {
  name: string
  version: string
  ruleset: string
}

export interface AppSecurityScan {
  scan: ScanResult
  /** Absolute paths of the scan directories that their repository ignores, so only the files Git tracks in them were scanned. */
  ignoredScanDirectories: string[]
  deterministicFindings: DeterministicFindingsDocument
  agentChecks: AgentChecks
  engine: AppSecurityEngineMetadata
}

export function getAgentInstructions(): string {
  return EMBEDDED_APP_SECURITY_INSTRUCTIONS
}

/** A scan directory equal to the app directory is the app directory itself, however it was requested. */
function coverageScanDirectories({appDirectory, scanDirectories}: ScanInput): CoverageScanDirectory[] {
  return scanDirectories.map((directory) => ({
    directory: normalizePath(relativePath(appDirectory, directory)) || '.',
    origin: directory === appDirectory ? 'app_directory' : 'include_dir',
  }))
}

export async function scanApp(input: ScanInput, options: ScanOptions = {}): Promise<AppSecurityScan> {
  const {ignoredScanDirectories, ...result} = await scan(input, options)
  const engineVersion = getEngineVersion()
  const deterministicFindings = buildDeterministicFindings(result, {
    engineVersion,
    scope: {
      include_dirs: [...(options.includeDirs ?? [])],
      excludes: [...(options.excludePatterns ?? [])],
      no_git_ignore: options.noGitIgnore ?? false,
    },
    scanDirectories: coverageScanDirectories(input),
  })
  return {
    scan: result,
    ignoredScanDirectories,
    deterministicFindings,
    agentChecks: buildAgentChecks(engineVersion),
    engine: deterministicFindings.engine,
  }
}
