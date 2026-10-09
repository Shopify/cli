import {
  loadAppToml,
  findExtensions,
  findAppSourceFiles,
  findSensitiveFiles,
  findSourceCandidates,
  configureRepositoryReader,
  getSkippedFiles,
  findManifests,
  findManifestPaths,
  findDependencyAutomationInputs,
  gatherPaths,
} from './discover.js'
import {createPathRules} from './path-rules.js'
import {
  detectCapabilities,
  detectProject,
  detectReactRouterRoots,
  isReactRouterSourcePath,
} from '../capabilities/detect.js'
import {computeScanMetadata} from '../scorer/index.js'
import {deprecatedScriptTagScope, insecureWebhookUrl} from '../rules/config-rules.js'
import {
  scanCredentialBrowserLeakage,
  scanCredentialLogLeakage,
  scanRequestControlledAdminContext,
  scanUnauthenticatedEndpoints,
  scanUnsafeInnerHTML,
} from '../rules/js-rules.js'
import {scanLiquidSecurity} from '../rules/liquid-rules.js'
import {redactText, scanCommittedSecrets} from '../rules/secret-rules.js'
import {scanDeprecatedScriptTagApi} from '../rules/shopify-rules.js'
import {missingComplianceWebhooks, scanEolApiVersions} from '../rules/compliance-rules.js'
import {scanAppProxyLiquidInjection} from '../rules/proxy-rules.js'
import {scanExpiringOfflineTokens} from '../rules/token-rules.js'
import {scanStaticFrameAncestors} from '../rules/csp-rules.js'
import {scanDependencyAutomation} from '../rules/dependency-automation-rules.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {redactIssue} from '../scan-artifact/index.js'
import {getEngineVersion} from '../version.js'
import {normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import type {Rule, ScanContext} from '../rules/types.js'
import type {RunnerImplementationResult, RunnerResult, SourceFile} from './types.js'
import type {
  AnalysisMode,
  CheckExecution,
  CheckExecutionReason,
  CheckExecutionStatus,
  CoverageGap,
  Issue,
  ScanInput,
  ScanOptions,
  ScanOutput,
  SkippedFile,
} from '../types.js'

type CheckTarget =
  | 'config'
  | 'source'
  | 'app_source'
  | 'theme'
  | 'secrets'
  | 'config_and_source'
  | 'source_and_theme'
  | 'dependency_automation'
type Runner = (context: ScanContext) => Issue[] | RunnerResult | Promise<Issue[] | RunnerResult>

export interface DeterministicCheckDefinition {
  id: string
  version: number
  lifecycle: 'active' | 'planned' | 'investigate'
  analysisMode: AnalysisMode
  target: CheckTarget
  requires?: keyof ScanContext['capabilities']
  extensions?: string[]
  runner?: Runner
}

const JAVASCRIPT_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']

const configRule = (rule: Rule, version = 1): DeterministicCheckDefinition => ({
  id: rule.id,
  version,
  lifecycle: 'active',
  analysisMode: 'structured_config',
  target: 'config',
  requires: rule.requires,
  runner: (context) => rule.check(context),
})

const jsCheck = (
  id: string,
  runner: Runner,
  target: CheckTarget = 'source',
  version = 1,
): DeterministicCheckDefinition => ({
  id,
  version,
  lifecycle: 'active',
  analysisMode: 'regex',
  target,
  extensions: JAVASCRIPT_EXTENSIONS,
  runner,
})

/** The only active deterministic product checks. Shared agent IDs are deliberate fallback coverage. */
const DETERMINISTIC_CHECK_DEFINITIONS: ReadonlyArray<DeterministicCheckDefinition> = [
  configRule(missingComplianceWebhooks),
  {
    id: 'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
    version: 2,
    lifecycle: 'active',
    analysisMode: 'structured_config',
    target: 'dependency_automation',
    runner: (context) => scanDependencyAutomation(context),
  },
  {
    id: 'EOL_API_VERSION',
    version: 2,
    lifecycle: 'active',
    analysisMode: 'regex',
    target: 'config_and_source',
    extensions: JAVASCRIPT_EXTENSIONS,
    runner: (context) => scanEolApiVersions(context),
  },
  {
    ...jsCheck('EXPIRING_OFFLINE_TOKEN', (context) => scanExpiringOfflineTokens(context), 'source', 2),
    extensions: [...JAVASCRIPT_EXTENSIONS, '.prisma'],
  },
  {
    ...jsCheck('UNAUTHENTICATED_ENDPOINT', (context) => scanUnauthenticatedEndpoints(context.sourceFiles), 'source', 3),
    requires: 'has_backend',
  },
  jsCheck(
    'REQUEST_CONTROLLED_ADMIN_CONTEXT',
    (context) => scanRequestControlledAdminContext(context.sourceFiles),
    'source',
    4,
  ),
  {
    ...configRule(deprecatedScriptTagScope, 2),
    target: 'config_and_source',
    analysisMode: 'regex',
    extensions: JAVASCRIPT_EXTENSIONS,
    runner: (context) => [
      ...deprecatedScriptTagScope.check(context),
      ...scanDeprecatedScriptTagApi(context.sourceFiles),
    ],
  },
  configRule(insecureWebhookUrl, 2),
  {
    id: 'COMMITTED_SECRET',
    version: 4,
    lifecycle: 'active',
    analysisMode: 'regex',
    target: 'secrets',
    runner: (context) => scanCommittedSecrets(context.sensitiveFiles, context.appRoot, context.gitIgnoreListing),
  },
  jsCheck('CREDENTIAL_LOG_LEAKAGE', (context) => scanCredentialLogLeakage(context.sourceFiles), 'source', 2),
  jsCheck('CREDENTIAL_BROWSER_LEAKAGE', (context) => scanCredentialBrowserLeakage(context.sourceFiles), 'source', 2),
  {
    id: 'LIQUID_UNSAFE_RENDER',
    version: 1,
    lifecycle: 'active',
    analysisMode: 'ast',
    target: 'theme',
    requires: 'theme_app_extension',
    extensions: ['.liquid', '.html'],
    runner: (context) => liquidRunner(context, 'LIQUID_UNSAFE_RENDER'),
  },
  {
    ...jsCheck('UNSAFE_INNERHTML', unsafeInnerHtmlRunner, 'source_and_theme', 3),
    analysisMode: 'regex',
    extensions: [...JAVASCRIPT_EXTENSIONS, '.liquid', '.html'],
  },
  {
    ...jsCheck(
      'APP_PROXY_LIQUID_INJECTION',
      (context) => scanAppProxyLiquidInjection(context.sourceFiles),
      'source',
      3,
    ),
    requires: 'app_proxy',
  },
  {
    ...jsCheck('STATIC_FRAME_ANCESTORS', (context) => scanStaticFrameAncestors(context.sourceFiles), 'app_source', 2),
    requires: 'embedded_app',
  },
]

function unsafeInnerHtmlRunner(context: ScanContext): RunnerResult {
  const issues: Issue[] = []
  const implementations: RunnerImplementationResult[] = []
  if (context.detection.framework === 'react_router') {
    const files = reactRouterFiles(context).filter(
      (file) => file.content !== undefined && JAVASCRIPT_EXTENSIONS.includes(file.ext),
    )
    const findings = scanUnsafeInnerHTML(files)
    issues.push(...findings)
    implementations.push({
      id: 'react-router-js-regex',
      analysisMode: 'regex',
      status: 'executed',
      inspectedFiles: files.map((file) => file.path),
      findings: findings.length,
    })
  }
  if (context.capabilities.theme_app_extension) {
    const themeSources = themeFiles(context)
    const themePaths = new Set(themeSources.map((file) => file.path))
    if (
      context.detection.framework !== 'react_router' &&
      context.sourceCandidates.some((candidate) => !themePaths.has(candidate.path))
    )
      implementations.push({
        id: 'app-source-unsupported',
        analysisMode: 'regex',
        status: 'unsupported_framework',
        inspectedFiles: [],
        findings: 0,
        reason: {
          code: 'unsupported_framework',
          message: 'The non-theme app source framework is not supported by deterministic analysis.',
        },
      })
    const javascriptFiles = themeSources.filter(
      (file) => file.content !== undefined && JAVASCRIPT_EXTENSIONS.includes(file.ext),
    )
    const javascriptFindings = scanUnsafeInnerHTML(javascriptFiles)
    issues.push(...javascriptFindings)
    implementations.push(
      javascriptFiles.length > 0
        ? {
            id: 'theme-js-regex',
            analysisMode: 'regex',
            status: 'executed',
            inspectedFiles: javascriptFiles.map((file) => file.path),
            findings: javascriptFindings.length,
          }
        : {
            id: 'theme-js-regex',
            analysisMode: 'regex',
            status: 'not_applicable',
            inspectedFiles: [],
            findings: 0,
            reason: {code: 'no_relevant_files', message: 'The theme app extensions contain no JavaScript files.'},
          },
    )
    const liquidFiles = themeSources.filter(
      (file) => file.content !== undefined && (file.ext === '.liquid' || file.ext === '.html'),
    )
    const liquid = scanLiquidSecurity(liquidFiles)
    const liquidFindings = liquid.issues.filter((issue) => issue.id === 'UNSAFE_INNERHTML')
    issues.push(...liquidFindings)
    let liquidStatus: CheckExecutionStatus = 'executed'
    let liquidReason: CheckExecutionReason | undefined
    if (liquidFiles.length === 0) {
      liquidStatus = 'not_applicable'
      liquidReason = {code: 'no_relevant_files', message: 'The theme app extensions contain no Liquid files.'}
    } else if (liquid.parserFailures.length > 0) {
      liquidStatus = 'unresolved'
      liquidReason = {
        code: 'parser_unavailable',
        message: `Liquid parser failed for: ${liquid.parserFailures.join(', ')}`,
      }
    }
    implementations.push({
      id: 'theme-liquid-ast',
      analysisMode: 'ast',
      status: liquidStatus,
      inspectedFiles: liquidFiles.map((file) => file.path),
      findings: liquidFindings.length,
      ...(liquidReason ? {reason: liquidReason} : {}),
    })
  }
  return {
    issues,
    inspectedFiles: [...new Set(implementations.flatMap((implementation) => implementation.inspectedFiles))],
    ...(implementations.some((implementation) => implementation.status === 'unresolved')
      ? {
          unresolvedReason: implementations
            .filter((implementation) => implementation.status === 'unresolved')
            .map((implementation) => implementation.reason?.message)
            .filter(Boolean)
            .join('; '),
        }
      : {}),
  }
}

function liquidRunner(context: ScanContext, id: 'LIQUID_UNSAFE_RENDER' | 'UNSAFE_INNERHTML'): RunnerResult {
  const scanResult = scanLiquidSecurity(themeFiles(context).filter((file) => file.content !== undefined))
  const parserFailures = scanResult.parserFailures
  return {
    issues: scanResult.issues.filter((issue) => issue.id === id),
    ...(parserFailures.length > 0 ? {unresolvedReason: `Liquid parser failed for: ${parserFailures.join(', ')}`} : {}),
  }
}

export const DETERMINISTIC_CHECKS: ReadonlyMap<string, DeterministicCheckDefinition> = createDeterministicCheckMap(
  DETERMINISTIC_CHECK_DEFINITIONS,
)
assertRunnableDefinitions([...DETERMINISTIC_CHECKS.values()])
export const DETERMINISTIC_RULES = [...DETERMINISTIC_CHECKS.values()].map(({id, version, requires}) => ({
  id,
  version,
  requires,
}))

function createDeterministicCheckMap(definitions: ReadonlyArray<DeterministicCheckDefinition>) {
  const checks = new Map<string, DeterministicCheckDefinition>()
  for (const definition of definitions) {
    if (checks.has(definition.id)) throw new Error(`Duplicate deterministic stable ID: ${definition.id}`)
    checks.set(definition.id, definition)
  }
  return checks
}

function assertRunnableDefinitions(definitions: ReadonlyArray<DeterministicCheckDefinition>): void {
  const catalogIds = new Set(RULE_CATALOG.map((entry) => entry.id))
  for (const definition of definitions) {
    if (!catalogIds.has(definition.id)) throw new Error(`Orphan deterministic runner: ${definition.id}`)
    if (definition.lifecycle === 'active' && !definition.runner)
      throw new Error(`Active deterministic check has no runner: ${definition.id}`)
    if (definition.lifecycle !== 'active' && definition.runner)
      throw new Error(`A non-active deterministic check can't have a runner: ${definition.id}`)
  }
}

function themeFiles(context: ScanContext): SourceFile[] {
  return context.extensions.filter((extension) => extension.type === 'theme').flatMap((extension) => extension.files)
}

function appSourceFiles(context: ScanContext): SourceFile[] {
  const themePaths = new Set(themeFiles(context).map((file) => file.path))
  return context.sourceFiles.filter((file) => !themePaths.has(file.path))
}

/**
 * Every source path when the app isn't React Router; otherwise only this app's code, in its app directory or React
 * Router roots.
 */
function isReactRouterFilePath(path: string, context: ScanContext): boolean {
  return (
    context.detection.framework !== 'react_router' ||
    isReactRouterSourcePath(path, context.reactRouterRoots, context.otherAppDirectories)
  )
}

function reactRouterFiles(context: ScanContext): SourceFile[] {
  return appSourceFiles(context).filter((file) => isReactRouterFilePath(file.path, context))
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
  const isReactRouterInput = (path: string) => isSourcePath(path) && isReactRouterFilePath(path, context)
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
    if (definition.target === 'config_and_source') return isConfig(file.path) || isReactRouterInput(file.path)
    if (definition.target === 'source') return isReactRouterInput(file.path)
    if (definition.target === 'app_source') return isSourcePath(file.path)
    if (definition.target === 'theme') return isThemePath(file.path)
    if (definition.target === 'source_and_theme') return isReactRouterInput(file.path) || isThemePath(file.path)
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

function gatherScanPaths(
  {appDirectory, scanDirectories, requestedScanDirectories, appConfigFilePath}: ScanInput,
  options: ScanOptions,
) {
  return gatherPaths({
    appDirectory,
    scanDirectories,
    requestedScanDirectories,
    selectedAppConfigFilePath: appConfigFilePath,
    rules: createPathRules({excludePatterns: options.excludePatterns ?? [], noGitIgnore: options.noGitIgnore ?? false}),
  })
}

/**
 * Only gathers: nothing is read, and no check runs. The reader is configured because walking records directories
 * it can't list as skipped files, which are dropped here.
 */
export async function listGatheredPaths(input: ScanInput, options: ScanOptions = {}) {
  configureRepositoryReader({
    appDirectory: input.appDirectory,
    scanDirectories: input.scanDirectories,
    explicitInputs: new Set(),
  })
  const {paths, ignoredScanDirectories, otherAppDirectories} = await gatherScanPaths(input, options)
  return {paths, ignoredScanDirectories, otherAppDirectories}
}

export async function scan(input: ScanInput, options: ScanOptions = {}): Promise<ScanOutput> {
  const {appDirectory: appRoot, scanDirectories, appConfigFilePath} = input
  // The selected app configuration is an explicit input: it's read even when it is a symbolic link
  // that leaves the app directory.
  configureRepositoryReader({
    appDirectory: appRoot,
    scanDirectories,
    explicitInputs: new Set(appConfigFilePath ? [appConfigFilePath] : []),
  })
  const selectedAppConfigPath = appConfigFilePath ? normalizePath(relativePath(appRoot, appConfigFilePath)) : undefined
  const appToml = appConfigFilePath ? loadAppToml(appConfigFilePath, appRoot) : null
  const appTomls = appToml ? [appToml] : []
  const {
    paths: repositoryFiles,
    ignoredScanDirectories,
    otherAppDirectories,
    listingStatus,
  } = await gatherScanPaths(input, options)
  const extensions = findExtensions(appRoot, repositoryFiles)
  const sourceCandidates = findSourceCandidates(repositoryFiles)
  const sourceFiles = findAppSourceFiles(appRoot, repositoryFiles)
  const sensitiveFiles = findSensitiveFiles(appRoot, repositoryFiles, selectedAppConfigPath)
  const manifestPaths = findManifestPaths(repositoryFiles)
  const manifests = findManifests(appRoot, manifestPaths)
  const dependencyAutomation = manifests.some(manifestHasDependencies)
    ? findDependencyAutomationInputs(appRoot, repositoryFiles)
    : {files: []}
  const capabilities = detectCapabilities(appToml, extensions, sourceFiles, appTomls)
  const relativeOtherAppDirectories = otherAppDirectories.map((directory) =>
    normalizePath(relativePath(appRoot, directory)),
  )
  const reactRouterRoots = detectReactRouterRoots(manifests, sourceCandidates, relativeOtherAppDirectories)
  const detection = detectProject(extensions, sourceCandidates, reactRouterRoots)
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
    reactRouterRoots,
    otherAppDirectories: relativeOtherAppDirectories,
    sourceCandidates,
    gitIgnoreListing: listingStatus,
  }

  let issues: Issue[] = []
  const checksExecuted: CheckExecution[] = []
  // Only required checks that could not run are reported as coverage gaps.
  const requiredCheckIds = new Set<string>()
  for (const definition of DETERMINISTIC_CHECKS.values()) {
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

  const versionById = new Map(
    [...DETERMINISTIC_CHECKS.values()].map((definition) => [definition.id, definition.version]),
  )
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
    app: {name: redactText(String(appToml?.raw.name ?? 'Unknown')), type: 'public'},
    capabilities,
    detection,
    scan: scanMetadata,
    issues,
    ignoredScanDirectories,
    otherAppDirectories,
  }
}
