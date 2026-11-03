import {blockedCheckCount, executeAppSecurity, listAppSecurityFiles} from './app-security-api.js'
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
  type DeclinedAppSecuritySelection,
} from './app-security-selection.js'
import {recordAppSecurityMetadata, type AppSecurityMetadata} from './app-security-metadata.js'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import type {CheckArtifactPaths} from './app-security-artifacts.js'
import type {
  AgentChecks,
  AppSecurityScope,
  DeterministicFindingsDocument,
  ScanInput,
  ScanOptions,
} from './app-security-engine/index.js'
import type {AppSecurityBlockingLevel, AppSecurityExecution} from './app-security-api.js'

interface SecurityOptions {
  directory: string
  configName?: string
  clientId?: string
  withoutAppConfig: boolean
  blocking: AppSecurityBlockingLevel
  includeDirs: ReadonlyArray<string>
  excludePatterns: ReadonlyArray<string>
  noGitIgnore: boolean
  /** Only resolve and gather: return the gathered paths and stop. */
  listFiles: boolean
  /**
   * Called when resolving the selection prompted, before anything is gathered, with the commands that repeat the run
   * without prompts.
   */
  onSelectionPrompted?: (commands: AppSecurityCommands) => void
}

/** What a run resolved, whether it scanned or only listed files. */
interface SecurityCheckResolution {
  selection: AppSecuritySelection
  resultsKey: string
  /** The commands that repeat this run, including its scope. */
  commands: AppSecurityCommands
  /** The scope flags, as typed. */
  scope: AppSecurityScope
  scanDirectories: AppSecurityScanDirectory[]
}

/** The directories that gathering warns about. Both lists hold absolute paths. */
interface AppSecurityGatheringNotices {
  ignoredScanDirectories: string[]
  otherAppDirectories: string[]
}

/** The files a scan would gather, which `--list-files` lists. */
type ListedSecurityCheck = {kind: 'listed'; paths: string[]} & SecurityCheckResolution & AppSecurityGatheringNotices

/** A finished scan, with the results files it replaced and the `--blocking` outcome. */
type ScannedSecurityCheck = {
  kind: 'scanned'
  execution: AppSecurityExecution
  artifacts: CheckArtifactPaths
  blocking: {
    level: AppSecurityBlockingLevel
    /** Checks with a deterministic issue at or above the level. Zero for `none`. */
    blockedChecks: number
  }
} & SecurityCheckResolution

/**
 * What `securityCheck` returns: the listed files, the finished scan, or a cancellation, when the user declined to scan
 * without app configuration.
 */
export type SecurityCheckOutcome = ListedSecurityCheck | ScannedSecurityCheck | {kind: 'cancelled'}

interface SecurityDependencies {
  resolveSelection(options: AppSecuritySelectionOptions): Promise<AppSecuritySelection | DeclinedAppSecuritySelection>
  execute(options: ScanInput & Required<ScanOptions>): Promise<AppSecurityExecution>
  listFiles(options: ScanInput & Required<ScanOptions>): Promise<{paths: string[]} & AppSecurityGatheringNotices>
  writeArtifacts(
    appDirectory: string,
    resultsKey: string,
    artifacts: {deterministicFindings: DeterministicFindingsDocument; agentChecks: AgentChecks},
  ): Promise<CheckArtifactPaths>
  canPrompt(): boolean
  recordMetadata(fields: AppSecurityMetadata): Promise<void>
}

const defaultDependencies: SecurityDependencies = {
  resolveSelection: resolveAppSecuritySelection,
  execute: executeAppSecurity,
  listFiles: listAppSecurityFiles,
  writeArtifacts: writeCheckArtifacts,
  canPrompt: terminalSupportsPrompting,
  recordMetadata: recordAppSecurityMetadata,
}

/**
 * Scans the app and replaces deterministic-findings.json and agent-checks.json. Scanning never reads or
 * changes the agent's recorded findings, so it's always safe to run again. Prints nothing: the command presents the
 * outcome.
 *
 * With `listFiles`, it only resolves and gathers: it returns the gathered paths and writes nothing.
 * `directory` is the `--path` value, an absolute path.
 */
export default async function securityCheck(
  options: SecurityOptions,
  dependencies: SecurityDependencies = defaultDependencies,
): Promise<SecurityCheckOutcome> {
  // Resolved first so a mistyped directory fails before any prompt.
  const includeDirectories = await resolveIncludeDirectories(options.includeDirs)
  const selection = await dependencies.resolveSelection({
    path: options.directory,
    config: options.configName,
    clientId: options.clientId,
    withoutAppConfig: options.withoutAppConfig,
    allowPrompts: !options.listFiles && dependencies.canPrompt(),
    validateClientIdFlag: true,
  })
  if (selection.kind === 'declined') return {kind: 'cancelled'}

  const {appDirectory} = selection
  const scope: AppSecurityScope = {
    include_dirs: [...options.includeDirs],
    excludes: [...options.excludePatterns],
    no_git_ignore: options.noGitIgnore,
  }
  const commands = resolveAppSecurityCommands(selection, options.directory, scope)
  // Prompts are shown when no TOML was found and `--without-app-config` wasn't passed, or when `check` asked which TOML
  // to scan.
  const prompted = selection.kind === 'no-config' ? !options.withoutAppConfig : selection.appConfigFilePicked === true
  if (prompted) options.onSelectionPrompted?.(commands)
  const appConfigDirectories = selection.kind === 'config' ? (selection.appConfigDirectories ?? []) : []
  const {scanDirectories, requestedScanDirectories} = mergeScanDirectories(
    appDirectory,
    includeDirectories,
    appConfigDirectories,
  )
  const resolution = {selection, resultsKey: resultsKey(selection), commands, scope, scanDirectories}

  const scanOptions = {
    appDirectory,
    scanDirectories: scanDirectories.map(({directory}) => directory),
    requestedScanDirectories,
    appConfigDirectories: scanDirectories
      .filter(({origin}) => origin === 'app_config_directory')
      .map(({directory}) => directory),
    appConfigFilePath: selection.kind === 'config' ? selection.appConfigFilePath : undefined,
    clientId: effectiveClientId(selection),
    includeDirs: options.includeDirs,
    excludePatterns: options.excludePatterns,
    noGitIgnore: options.noGitIgnore,
  }

  if (options.listFiles) {
    const listing = await dependencies.listFiles(scanOptions)
    return {kind: 'listed', ...resolution, ...listing}
  }

  const execution = await dependencies.execute(scanOptions)
  await dependencies.recordMetadata({num_security_findings: execution.scan.issues.length})
  const artifacts = await dependencies.writeArtifacts(appDirectory, resolution.resultsKey, {
    deterministicFindings: execution.deterministicFindings,
    agentChecks: execution.agentChecks,
  })

  return {
    kind: 'scanned',
    ...resolution,
    execution,
    artifacts,
    blocking: {level: options.blocking, blockedChecks: blockedCheckCount(execution, options.blocking)},
  }
}
