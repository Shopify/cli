import {EMBEDDED_APP_SECURITY_INSTRUCTIONS} from './checks/embedded.js'
import {buildAgentChecks, type AgentChecks} from './checks/index.js'
import {scan} from './scanners/index.js'
import {buildDeterministicFindings} from './scan-artifact/index.js'
import {createPathRules} from './scanners/path-rules.js'
import {getEngineVersion} from './version.js'
import {normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import type {
  CoverageExclusions,
  CoverageScanDirectory,
  DeterministicFindingsDocument,
  ScanInput,
  ScanOptions,
  ScanResult,
} from './types.js'

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
  /** Absolute paths of directories, other than the app directory, that hold an app configuration file, so another app's files were scanned as this app's. */
  otherAppDirectories: string[]
  deterministicFindings: DeterministicFindingsDocument
  agentChecks: AgentChecks
  engine: AppSecurityEngineMetadata
}

export function getAgentInstructions(): string {
  return EMBEDDED_APP_SECURITY_INSTRUCTIONS
}

function coverageScanDirectories({
  appDirectory,
  scanDirectories,
  appConfigDirectories = [],
}: ScanInput): CoverageScanDirectory[] {
  return scanDirectories.map((directory) => ({
    directory: normalizePath(relativePath(appDirectory, directory)) || '.',
    origin: coverageOrigin(directory, appDirectory, appConfigDirectories),
  }))
}

/** The scan matches `--exclude` globs with the same rules, so a results file can tell which of its paths they matched. */
function coverageExclusions({appDirectory}: ScanInput, options: ScanOptions): CoverageExclusions {
  const {excludePatterns, workingDirectory} = createPathRules({
    excludePatterns: options.excludePatterns ?? [],
    noGitIgnore: options.noGitIgnore ?? false,
  })
  return {
    patterns: [...excludePatterns],
    working_directory: normalizePath(relativePath(appDirectory, workingDirectory)) || '.',
    app_directory: normalizePath(relativePath(workingDirectory, appDirectory)) || '.',
  }
}

/** A scan directory equal to the app directory is the app directory itself, however it was requested. */
function coverageOrigin(
  directory: string,
  appDirectory: string,
  appConfigDirectories: ReadonlyArray<string>,
): CoverageScanDirectory['origin'] {
  if (directory === appDirectory) return 'app_directory'
  return appConfigDirectories.includes(directory) ? 'app_config_directory' : 'include_dir'
}

export async function scanApp(input: ScanInput, options: ScanOptions = {}): Promise<AppSecurityScan> {
  const {ignoredScanDirectories, otherAppDirectories, ...result} = await scan(input, options)
  const engineVersion = getEngineVersion()
  const deterministicFindings = buildDeterministicFindings(result, {
    engineVersion,
    scope: {
      include_dirs: [...(options.includeDirs ?? [])],
      excludes: [...(options.excludePatterns ?? [])],
      no_git_ignore: options.noGitIgnore ?? false,
    },
    scanDirectories: coverageScanDirectories(input),
    exclusions: coverageExclusions(input, options),
    ...(input.appConfigFilePath
      ? {appConfigFile: normalizePath(relativePath(input.appDirectory, input.appConfigFilePath))}
      : {}),
  })
  return {
    scan: result,
    ignoredScanDirectories,
    otherAppDirectories,
    deterministicFindings,
    agentChecks: buildAgentChecks(engineVersion),
    engine: deterministicFindings.engine,
  }
}
