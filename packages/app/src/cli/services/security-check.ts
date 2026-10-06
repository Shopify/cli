import {executeAppSecurity, listAppSecurityFiles} from './app-security-api.js'
import {writeCheckArtifacts} from './app-security-artifacts.js'
import {resolveAppSecurityCommands, type AppSecurityCommands} from './app-security-commands.js'
import {
  effectiveClientId,
  mergeScanDirectories,
  resolveAppSecuritySelection,
  resolveIncludeDirectories,
  resultsKey,
  type AppSecurityScanDirectory,
  type AppSecuritySelection,
  type AppSecuritySelectionOptions,
} from './app-security-selection.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import type {CheckArtifactPaths} from './app-security-artifacts.js'
import type {
  AgentChecks,
  AppSecurityScope,
  DeterministicFindingsDocument,
  ScanInput,
  ScanOptions,
} from './app-security-engine/index.js'
import type {AppSecurityExecution} from './app-security-api.js'

interface SecurityCheckSelectionOptions {
  directory: string
  configName?: string
  clientId?: string
  withoutAppConfig: boolean
  includeDirs: ReadonlyArray<string>
  excludePatterns: ReadonlyArray<string>
  noGitIgnore: boolean
  allowPrompts: boolean
}

/** What a run resolved before it scans or lists files. */
export interface SecurityCheckResolution {
  selection: AppSecuritySelection
  resultsKey: string
  /** The commands that repeat this run, including its scope. */
  commands: AppSecurityCommands
  scope: AppSecurityScope
  /** The real paths of the `--include-dir` directories. */
  includeDirectories: string[]
  /** Whether choosing the selection showed prompts, which `commands.scan` skips next time. */
  prompted: boolean
}

export type SecurityCheckResult =
  | {
      kind: 'file-list'
      resolution: SecurityCheckResolution
      /** Relative to the app directory. */
      paths: string[]
      ignoredScanDirectories: string[]
    }
  | {
      kind: 'scan'
      resolution: SecurityCheckResolution
      scanDirectories: AppSecurityScanDirectory[]
      execution: AppSecurityExecution
      artifacts: CheckArtifactPaths
    }

interface SecurityCheckSelectionDependencies {
  resolveSelection(options: AppSecuritySelectionOptions): Promise<AppSecuritySelection>
}

interface SecurityCheckDependencies {
  execute(options: ScanInput & Required<ScanOptions>): Promise<AppSecurityExecution>
  listFiles(options: ScanInput & Required<ScanOptions>): Promise<{paths: string[]; ignoredScanDirectories: string[]}>
  writeArtifacts(
    appDirectory: string,
    resultsKey: string,
    artifacts: {deterministicFindings: DeterministicFindingsDocument; agentChecks: AgentChecks},
  ): Promise<CheckArtifactPaths>
  recordMetadata(fields: AppSecurityMetadata): Promise<void>
}

const defaultSelectionDependencies: SecurityCheckSelectionDependencies = {
  resolveSelection: resolveAppSecuritySelection,
}

const defaultDependencies: SecurityCheckDependencies = {
  execute: executeAppSecurity,
  listFiles: listAppSecurityFiles,
  writeArtifacts: writeCheckArtifacts,
  recordMetadata: recordAppSecurityMetadata,
}

/**
 * Resolves what `check` scans: the `--include-dir` directories, then the selection, which prompts when
 * `allowPrompts` is set and the selection needs a choice. `directory` is the `--path` value, an absolute path.
 */
export async function resolveSecurityCheckSelection(
  options: SecurityCheckSelectionOptions,
  dependencies: SecurityCheckSelectionDependencies = defaultSelectionDependencies,
): Promise<SecurityCheckResolution> {
  // Resolved first so a mistyped directory fails before any prompt.
  const includeDirectories = await resolveIncludeDirectories(options.includeDirs)
  const selection = await dependencies.resolveSelection({
    path: options.directory,
    config: options.configName,
    clientId: options.clientId,
    withoutAppConfig: options.withoutAppConfig,
    allowPrompts: options.allowPrompts,
    validateClientIdFlag: true,
  })
  const scope: AppSecurityScope = {
    include_dirs: [...options.includeDirs],
    excludes: [...options.excludePatterns],
    no_git_ignore: options.noGitIgnore,
  }
  return {
    selection,
    resultsKey: resultsKey(selection),
    commands: resolveAppSecurityCommands(selection, options.directory, scope),
    scope,
    includeDirectories,
    // Prompts are shown when no TOML was found and `--without-app-config` wasn't passed, or when `check` asked
    // which TOML to scan.
    prompted: selection.kind === 'no-config' ? !options.withoutAppConfig : selection.appConfigFilePicked === true,
  }
}

/**
 * Scans the app and replaces deterministic-findings.json and agent-checks.json. Scanning never reads or
 * changes the agent's recorded findings, so it's always safe to run again. It shows nothing in the terminal.
 *
 * With `listFiles`, it only gathers the files it would scan and writes nothing.
 */
export default async function securityCheck(
  resolution: SecurityCheckResolution,
  options: {listFiles: boolean},
  dependencies: SecurityCheckDependencies = defaultDependencies,
): Promise<SecurityCheckResult> {
  const {selection, scope} = resolution
  const {appDirectory} = selection
  const {scanDirectories, requestedScanDirectories} = mergeScanDirectories(appDirectory, resolution.includeDirectories)
  const scanOptions = {
    appDirectory,
    scanDirectories: scanDirectories.map(({directory}) => directory),
    requestedScanDirectories,
    appConfigFilePath: selection.kind === 'config' ? selection.appConfigFilePath : undefined,
    clientId: effectiveClientId(selection),
    includeDirs: scope.include_dirs,
    excludePatterns: scope.excludes,
    noGitIgnore: scope.no_git_ignore,
  }

  if (options.listFiles) {
    const {paths, ignoredScanDirectories} = await dependencies.listFiles(scanOptions)
    return {kind: 'file-list', resolution, paths, ignoredScanDirectories}
  }

  const execution = await dependencies.execute(scanOptions)
  await dependencies.recordMetadata({num_security_findings: execution.scan.issues.length})
  const artifacts = await dependencies.writeArtifacts(appDirectory, resolution.resultsKey, {
    deterministicFindings: execution.deterministicFindings,
    agentChecks: execution.agentChecks,
  })
  return {kind: 'scan', resolution, scanDirectories, execution, artifacts}
}
