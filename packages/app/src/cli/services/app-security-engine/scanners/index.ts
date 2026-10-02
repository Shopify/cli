import {
  findAppRoot,
  loadAppToml,
  findExtensions,
  findAppSourceFiles,
  findSensitiveFiles,
  findSourceCandidates,
  resetSkippedFiles,
  getSkippedFiles,
  findManifests,
  findManifestPaths,
  findDependencyAutomationInputs,
  listRepositoryFiles,
} from './discover.js'
import {buildPathRules, hasIncludeOverride, ignorePatternRules, listGitIgnoredPaths} from './path-rules.js'
import {detectCapabilities, detectProject} from '../capabilities/detect.js'
import {computeScanMetadata} from '../scorer/index.js'
import {redactText} from '../rules/secret-rules.js'
import {getRegistry} from '../registry/index.js'
import {
  defaultCheckSet,
  deterministicChecks,
  type AppSecurityCheckSet,
  type DeterministicCheckDefinition,
} from '../check-set.js'
import {redactIssue} from '../scan-artifact/index.js'
import {getEngineVersion} from '../version.js'
import {getAppConfigurationFileName} from '../../../models/app/config-file-naming.js'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import type {ScanContext} from '../rules/types.js'
import type {RunnerResult, SourceFile} from './types.js'
import type {
  CheckExecution,
  CheckExecutionReason,
  CheckExecutionStatus,
  CoverageGap,
  Issue,
  ProjectState,
  ScanOptions,
  ScanResult,
  SkippedFile,
} from '../types.js'

export type {DeterministicCheckDefinition} from '../check-set.js'
export const DETERMINISTIC_CHECKS = deterministicChecks(defaultCheckSet)
export const DETERMINISTIC_RULES = [...DETERMINISTIC_CHECKS.values()].map(({id, version, requires}) => ({
  id,
  version,
  requires,
}))

function themeFiles(context: ScanContext): SourceFile[] {
  return context.extensions.filter((extension) => extension.type === 'theme').flatMap((extension) => extension.files)
}

function appSourceFiles(context: ScanContext): SourceFile[] {
  const themePaths = new Set(themeFiles(context).map((file) => file.path))
  return context.sourceFiles.filter((file) => !themePaths.has(file.path))
}

function reactRouterFiles(context: ScanContext): SourceFile[] {
  return appSourceFiles(context)
}

export async function readProjectState(appRoot: string): Promise<ProjectState> {
  const run = async (args: string[]): Promise<{exitCode: number; stdout: string} | undefined> => {
    try {
      return await captureOutputWithExitCode('git', args, {cwd: appRoot})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return undefined
    }
  }
  const head = await run(['rev-parse', 'HEAD'])
  const status = await run(['status', '--porcelain'])
  return {
    commit: head?.exitCode === 0 ? head.stdout.trim() : null,
    dirty: status?.exitCode === 0 ? status.stdout.trim().length > 0 : null,
  }
}

function selectedFiles(definition: DeterministicCheckDefinition, context: ScanContext): string[] {
  const configurations = context.appTomls.map((toml) => relativePath(context.appRoot, toml.path).replace(/\\/g, '/'))
  if (definition.target === 'config') return configurations
  if (definition.target === 'dependency_automation')
    return [
      ...context.manifests.map((manifest) => manifest.path),
      ...context.dependencyAutomation.files.filter((file) => file.content !== undefined).map((file) => file.path),
    ]
  if (definition.target === 'secrets')
    return context.sensitiveFiles.filter((file) => file.content !== undefined).map((file) => file.path)
  let files = definition.target === 'app_source' ? appSourceFiles(context) : reactRouterFiles(context)
  if (definition.target === 'theme') files = themeFiles(context)
  else if (definition.target === 'source_and_theme') files = [...files, ...themeFiles(context)]
  const source = files
    .filter(
      (file) => file.content !== undefined && (!definition.extensions || definition.extensions.includes(file.ext)),
    )
    .map((file) => file.path)
  return definition.target === 'config_and_source' ? [...configurations, ...source] : source
}

function languageForPath(path: string, context: ScanContext): string | undefined {
  return context.sourceCandidates.find((candidate) => candidate.path === path)?.language
}

function executionDisposition(
  definition: DeterministicCheckDefinition,
  context: ScanContext,
): {status: CheckExecutionStatus; required: boolean; applicable: boolean; reason?: CheckExecutionReason} {
  const files = selectedFiles(definition, context)
  const themePaths = new Set(themeFiles(context).map((file) => file.path))
  const nonThemeCandidates = context.sourceCandidates.filter((candidate) => !themePaths.has(candidate.path))
  const reactRouterSupported = context.detection.framework === 'react_router'
  const hasTheme = context.capabilities.theme_app_extension

  if (definition.target === 'dependency_automation' && !context.manifests.some(manifestHasDependencies))
    return {
      status: 'not_applicable',
      required: false,
      applicable: false,
      reason: {code: 'no_relevant_files', message: 'No supported package manifest declares dependencies.'},
    }
  if (definition.target === 'source' && !reactRouterSupported) {
    if (nonThemeCandidates.length > 0)
      return {
        status: 'unsupported_framework',
        required: true,
        applicable: true,
        reason: {
          code: 'unsupported_framework',
          message: `${definition.id} applies to app source, but deterministic analysis requires @shopify/shopify-app-react-router and its conventional app structure.`,
        },
      }
    return {
      status: 'not_applicable',
      required: false,
      applicable: false,
      reason: {code: 'no_relevant_files', message: 'No React Router app source applies to this check.'},
    }
  }
  if (definition.target === 'source_and_theme' && !reactRouterSupported && !hasTheme) {
    if (nonThemeCandidates.length > 0)
      return {
        status: 'unsupported_framework',
        required: true,
        applicable: true,
        reason: {
          code: 'unsupported_framework',
          message: `${definition.id} applies to app source, but its framework is not supported by deterministic analysis.`,
        },
      }
    return {
      status: 'not_applicable',
      required: false,
      applicable: false,
      reason: {code: 'no_relevant_files', message: 'No supported app or theme source applies to this check.'},
    }
  }
  if (definition.target === 'source_and_theme' && !reactRouterSupported && nonThemeCandidates.length > 0)
    return files.length > 0
      ? {
          status: 'unresolved',
          required: true,
          applicable: true,
          reason: {
            code: 'unsupported_framework',
            message: `${definition.id} inspected theme extensions, but the non-theme app source framework is unsupported.`,
          },
        }
      : {
          status: 'unsupported_framework',
          required: true,
          applicable: true,
          reason: {
            code: 'unsupported_framework',
            message: `${definition.id} applies to app source, but its framework is unsupported.`,
          },
        }
  if (definition.target === 'theme' && !hasTheme)
    return {
      status: 'not_applicable',
      required: false,
      applicable: false,
      reason: {code: 'capability_absent', message: 'No theme app extension was detected.'},
    }
  if (
    definition.target === 'config_and_source' &&
    !reactRouterSupported &&
    nonThemeCandidates.length > 0 &&
    context.appTomls.length > 0
  )
    return {
      status: 'unresolved',
      required: true,
      applicable: true,
      reason: {
        code: 'unsupported_framework',
        message: `Configuration can be inspected, but ${definition.id} source analysis requires @shopify/shopify-app-react-router.`,
      },
    }
  if (definition.requires && !context.capabilities[definition.requires])
    return {
      status: 'not_applicable',
      required: false,
      applicable: false,
      reason: {code: 'capability_absent', message: `Capability ${definition.requires} was not detected.`},
    }
  if ((definition.target === 'config' || definition.target === 'config_and_source') && context.appTomls.length === 0)
    return {
      status: 'unresolved',
      required: true,
      applicable: true,
      reason: {code: 'parser_unavailable', message: 'No readable Shopify app configuration was available.'},
    }
  if (
    ['source', 'app_source', 'theme', 'secrets', 'source_and_theme'].includes(definition.target) &&
    files.length === 0
  )
    return {
      status: 'not_applicable',
      required: false,
      applicable: false,
      reason: {
        code: 'no_relevant_files',
        message: `No ${definition.target.replaceAll('_', ' ')} files apply to this check.`,
      },
    }
  return {status: 'executed', required: true, applicable: true}
}

function manifestHasDependencies(manifest: ScanContext['manifests'][number]): boolean {
  return Object.keys(manifest.dependencies).length > 0 || Object.keys(manifest.devDependencies ?? {}).length > 0
}

function skippedInputsForCheck(
  definition: DeterministicCheckDefinition,
  context: ScanContext,
  skippedFiles: SkippedFile[],
): SkippedFile[] {
  const themeDirectories = context.extensions
    .filter((extension) => extension.type === 'theme')
    .map((extension) => extension.path.replace(/shopify\.extension\.toml$/, ''))
  const isThemePath = (path: string) =>
    themeDirectories.some((directory) => path.startsWith(directory)) || path.endsWith('shopify.extension.toml')
  const isSourcePath = (path: string) =>
    !isThemePath(path) && Boolean(definition.extensions?.some((extension) => path.endsWith(extension)))
  const isConfig = (path: string) => /^shopify\.app(?:\.[^/]+)?\.toml$/.test(path)
  const isDependencyAutomationInput = (path: string) =>
    /(^|\/)package\.json$/.test(path) || context.dependencyAutomation.files.some((file) => file.path === path)
  const isSecretInput = (file: SkippedFile) =>
    !file.detail?.includes('could not be parsed') &&
    (context.sourceCandidates.some((candidate) => candidate.path === file.path) ||
      context.sensitiveFiles.some((sensitiveFile) => sensitiveFile.path === file.path) ||
      /(^|\/)(?:\.env(?:\.[^/]+)?|secrets\.json|credentials\.json)$/.test(file.path))

  return skippedFiles.filter((file) => {
    if (definition.target === 'config') return isConfig(file.path)
    if (definition.target === 'dependency_automation') return isDependencyAutomationInput(file.path)
    if (definition.target === 'config_and_source') return isConfig(file.path) || isSourcePath(file.path)
    if (definition.target === 'source' || definition.target === 'app_source') return isSourcePath(file.path)
    if (definition.target === 'theme') return isThemePath(file.path)
    if (definition.target === 'source_and_theme') return isSourcePath(file.path) || isThemePath(file.path)
    return isSecretInput(file)
  })
}

function skippedInputReason(definition: DeterministicCheckDefinition, files: SkippedFile[]): CheckExecutionReason {
  const parserFailure = files.some(
    (file) =>
      Boolean(file.detail?.includes('could not be parsed')) ||
      file.path.endsWith('shopify.extension.toml') ||
      file.path.endsWith('package.json'),
  )
  return {
    code: parserFailure ? 'parser_unavailable' : 'input_rejected',
    message: `${definition.id} could not inspect required input: ${files
      .map((file) => `${file.path} (${file.reason.replaceAll('_', ' ')})`)
      .join(', ')}.`,
  }
}

function runnerContext(definition: DeterministicCheckDefinition, context: ScanContext): ScanContext {
  if (definition.target === 'app_source') return {...context, sourceFiles: appSourceFiles(context)}
  return definition.target === 'source' || definition.target === 'config_and_source'
    ? {...context, sourceFiles: reactRouterFiles(context)}
    : context
}

function normalizeRunnerResult(value: Issue[] | RunnerResult): RunnerResult {
  return Array.isArray(value) ? {issues: value} : value
}

export async function scan(
  startPath?: string,
  configFileName?: string,
  options: ScanOptions = {},
  checkSet: AppSecurityCheckSet = defaultCheckSet,
): Promise<ScanResult> {
  getRegistry(checkSet)
  const definitions = deterministicChecks(checkSet)
  const appRoot = findAppRoot(startPath)
  resetSkippedFiles()
  const selectedFileName = getAppConfigurationFileName(configFileName)
  const appToml = loadAppToml(joinPath(appRoot, selectedFileName), appRoot)
  const appTomls = appToml ? [appToml] : []
  const overrides = ignorePatternRules(options.ignorePatterns ?? [])
  const gitIgnoreListing = await listGitIgnoredPaths(appRoot, {
    pruneDefaultDirectories: !hasIncludeOverride(overrides),
  })
  const pathRules = buildPathRules({
    gitIgnoredPaths: gitIgnoreListing.status === 'listed' ? gitIgnoreListing.paths : [],
    overrides,
  })
  const repositoryFiles = listRepositoryFiles(appRoot, pathRules)
  const extensions = findExtensions(appRoot, repositoryFiles)
  const sourceCandidates = findSourceCandidates(repositoryFiles)
  const sourceFiles = findAppSourceFiles(appRoot, repositoryFiles)
  // The selected app configuration is an explicit input, not a discovered path: it's loaded and
  // scanned for secrets even when path rules exclude it.
  const sensitivePaths = appToml ? [...new Set([...repositoryFiles, selectedFileName])].sort() : repositoryFiles
  const sensitiveFiles = findSensitiveFiles(appRoot, sensitivePaths, selectedFileName)
  const manifestPaths = findManifestPaths(repositoryFiles)
  const manifests = findManifests(appRoot, manifestPaths)
  const dependencyAutomation = manifests.some(manifestHasDependencies)
    ? findDependencyAutomationInputs(appRoot, pathRules)
    : {files: []}
  const capabilities = detectCapabilities(appToml, extensions, sourceFiles, appTomls)
  const detection = detectProject(manifests, extensions, sourceCandidates)
  const context: ScanContext = {
    appRoot,
    appToml,
    appTomls,
    extensions,
    sourceFiles,
    manifests,
    dependencyAutomation,
    sensitiveFiles,
    capabilities,
    detection,
    sourceCandidates,
    gitIgnoreListing: gitIgnoreListing.status,
  }

  let issues: Issue[] = []
  const checksExecuted: CheckExecution[] = []
  // Only required checks that could not run are reported as coverage gaps.
  const requiredCheckIds = new Set<string>()
  for (const definition of definitions.values()) {
    let disposition = executionDisposition(definition, context)
    let inspectedFiles = disposition.status === 'unsupported_framework' ? [] : selectedFiles(definition, context)
    const before = issues.length
    const rejectedInputs = skippedInputsForCheck(definition, context, getSkippedFiles())
    const suppressRunnerForRejectedInput = definition.target === 'dependency_automation' && rejectedInputs.length > 0
    if (
      (disposition.status === 'executed' || disposition.status === 'unresolved') &&
      definition.runner &&
      !suppressRunnerForRejectedInput
    ) {
      // eslint-disable-next-line no-await-in-loop
      const output = normalizeRunnerResult(await definition.runner(runnerContext(definition, context)))
      if (definition.target !== 'dependency_automation' || !output.unresolvedReason) issues.push(...output.issues)
      if (output.inspectedFiles) inspectedFiles = output.inspectedFiles
      if (output.unresolvedReason)
        disposition = {
          status: 'unresolved',
          required: true,
          applicable: true,
          reason: {
            code: output.unresolvedReasonCode ?? 'parser_unavailable',
            message: output.unresolvedReason,
          },
        }
    }
    if (disposition.status !== 'unsupported_framework' && rejectedInputs.length > 0) {
      const reason = skippedInputReason(definition, rejectedInputs)
      disposition = {status: 'unresolved', required: true, applicable: true, reason}
    }
    if (disposition.required) requiredCheckIds.add(definition.id)
    const languages = [
      ...new Set(
        inspectedFiles.map((path) => languageForPath(path, context)).filter((value): value is string => Boolean(value)),
      ),
    ].sort()
    checksExecuted.push({
      id: definition.id,
      version: definition.version,
      kind: 'deterministic',
      status: disposition.status,
      applicable: disposition.applicable,
      languages,
      framework: detection.framework,
      surface: detection.surface,
      inspected_files: inspectedFiles,
      findings: issues.length - before,
      analysis_mode: definition.analysisMode,
      ...(disposition.reason ? {reason: disposition.reason} : {}),
    })
  }

  const versionById = new Map([...definitions.values()].map((definition) => [definition.id, definition.version]))
  issues = issues.map((issue) => redactIssue({...issue, rule_version: versionById.get(issue.id) ?? 1}))
  for (const execution of checksExecuted)
    execution.findings = issues.filter((issue) => issue.id === execution.id).length

  const skippedFiles = [
    ...new Map(
      getSkippedFiles().map((file) => {
        const safe = {...file, path: redactText(file.path), ...(file.detail ? {detail: redactText(file.detail)} : {})}
        return [`${safe.path}|${safe.reason}`, safe] as const
      }),
    ).values(),
  ]
  const coverageGaps: CoverageGap[] = [
    ...skippedFiles.map(
      (file): CoverageGap => ({
        code: 'skipped_file',
        file: file.path,
        message: `The file was not inspected because it was ${file.reason.replaceAll('_', ' ')}.`,
      }),
    ),
    ...detection.languages
      .filter((language) => language.support === 'unsupported')
      .map(
        (language): CoverageGap => ({
          code: 'unsupported_language',
          message: `${language.name} source is not supported by deterministic analysis.`,
        }),
      ),
    ...checksExecuted.flatMap((execution): CoverageGap[] =>
      !requiredCheckIds.has(execution.id) ||
      (execution.status !== 'unsupported_framework' && execution.status !== 'unresolved')
        ? []
        : [
            {
              code: execution.status === 'unsupported_framework' ? 'unsupported_framework' : 'unresolved_check',
              check_id: execution.id,
              message: execution.reason?.message ?? `${execution.id} could not execute.`,
            },
          ],
    ),
  ]
  const rulesRun = checksExecuted.filter((execution) => execution.status === 'executed').length
  const scanMetadata = computeScanMetadata(
    sourceFiles.filter((file) => file.content !== undefined).length,
    rulesRun,
    checksExecuted.length - rulesRun,
    skippedFiles,
    checksExecuted,
    coverageGaps,
  )
  return {
    version: getEngineVersion(),
    timestamp: new Date().toISOString(),
    project: await readProjectState(appRoot),
    app: {name: redactText(String(appToml?.raw.name ?? 'Unknown')), type: 'public'},
    capabilities,
    detection,
    scan: scanMetadata,
    issues,
  }
}
