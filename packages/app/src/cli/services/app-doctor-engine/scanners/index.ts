import {
  findAppRoot,
  findAppTomls,
  loadAppToml,
  findExtensions,
  findAppSourceFiles,
  findSensitiveFiles,
  findSourceCandidates,
  resetSkippedFiles,
  getSkippedFiles,
  findManifests,
  findManifestPaths,
  readOptionalRepositoryFile,
} from './discover.js'
import {detectCapabilities, detectProject} from '../capabilities/detect.js'
import {calculateScore, computeScanMetadata} from '../scorer/index.js'
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
import {auditKnownCves} from '../rules/dependency-rules.js'
import {scanDeprecatedScriptTagApi} from '../rules/shopify-rules.js'
import {missingComplianceWebhooks, scanEolApiVersions} from '../rules/compliance-rules.js'
import {scanAppProxyLiquidInjection} from '../rules/proxy-rules.js'
import {scanExpiringOfflineTokens} from '../rules/token-rules.js'
import {RULE_CATALOG} from '../rules/catalog.js'
import {redactIssue} from '../trace/index.js'
import {getEngineVersion} from '../version.js'
import {basename, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {createHash} from 'node:crypto'
import type {AuditExecutor} from '../rules/dependency-rules.js'
import type {Rule, ScanContext, SourceFile} from '../rules/types.js'
import type {
  AnalysisMode,
  CheckExecution,
  CheckExecutionReason,
  CheckExecutionStatus,
  CoverageGap,
  Issue,
  ScanResult,
  SkippedFile,
} from '../types.js'

type CheckTarget = 'config' | 'source' | 'theme' | 'manifest' | 'secrets' | 'config_and_source' | 'source_and_theme'
interface RunnerImplementationResult {
  id: string
  analysisMode: AnalysisMode
  status: CheckExecutionStatus
  inspectedFiles: string[]
  findings: number
  reason?: CheckExecutionReason
}
interface RunnerResult {
  issues: Issue[]
  unresolvedReason?: string
  inspectedFiles?: string[]
  implementations?: RunnerImplementationResult[]
}
type Runner = (context: ScanContext) => Issue[] | RunnerResult | Promise<Issue[] | RunnerResult>

export interface DeterministicCheckDefinition {
  id: string
  version: number
  lifecycle: 'active' | 'planned' | 'investigate'
  analysisMode: Extract<AnalysisMode, 'regex' | 'structured_config' | 'audit' | 'ast'>
  target: CheckTarget
  requires?: keyof ScanContext['capabilities']
  guidance: string
  extensions?: string[]
  runner?: Runner
}

const JAVASCRIPT_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']
const JAVASCRIPT_LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'])

const configRule = (rule: Rule): DeterministicCheckDefinition => ({
  id: rule.id,
  version: 1,
  lifecycle: 'active',
  analysisMode: 'structured_config',
  target: 'config',
  requires: rule.requires,
  guidance: `Review ${rule.id} in every shopify.app*.toml file and resolve any parse error.`,
  runner: (context) => rule.check(context),
})

const jsCheck = (id: string, runner: Runner, target: CheckTarget = 'source'): DeterministicCheckDefinition => ({
  id,
  version: 1,
  lifecycle: 'active',
  analysisMode: 'regex',
  target,
  extensions: JAVASCRIPT_EXTENSIONS,
  guidance: `Review ${id} using the matching version 1 agent prompt; trace aliases, computed access, and non-local flows in the listed files.`,
  runner,
})

/** The only active deterministic product checks. Shared agent IDs are deliberate fallback coverage. */
const DETERMINISTIC_CHECK_DEFINITIONS: ReadonlyArray<DeterministicCheckDefinition> = [
  configRule(missingComplianceWebhooks),
  {
    id: 'EOL_API_VERSION',
    version: 1,
    lifecycle: 'active',
    analysisMode: 'regex',
    target: 'config_and_source',
    extensions: JAVASCRIPT_EXTENSIONS,
    guidance:
      'Inspect parsed shopify.app*.toml values and high-signal React Router shopify.server ApiVersion declarations using the matching version 1 agent prompt.',
    runner: (context) => scanEolApiVersions(context),
  },
  {
    ...jsCheck('EXPIRING_OFFLINE_TOKEN', (context) => scanExpiringOfflineTokens(context)),
    extensions: [...JAVASCRIPT_EXTENSIONS, '.prisma'],
    guidance:
      'Review offline-token feature configuration, session storage refresh metadata, and ambiguous setup using the matching version 1 agent prompt.',
  },
  {
    ...jsCheck('UNAUTHENTICATED_ENDPOINT', (context) => scanUnauthenticatedEndpoints(context.sourceFiles)),
    requires: 'has_backend',
  },
  jsCheck('REQUEST_CONTROLLED_ADMIN_CONTEXT', (context) => scanRequestControlledAdminContext(context.sourceFiles)),
  {
    ...configRule(deprecatedScriptTagScope),
    target: 'config_and_source',
    analysisMode: 'regex',
    extensions: JAVASCRIPT_EXTENSIONS,
    runner: (context) => [
      ...deprecatedScriptTagScope.check(context),
      ...scanDeprecatedScriptTagApi(context.sourceFiles),
    ],
  },
  configRule(insecureWebhookUrl),
  {
    id: 'COMMITTED_SECRET',
    version: 1,
    lifecycle: 'active',
    analysisMode: 'regex',
    target: 'secrets',
    guidance: "Review secret-bearing files and rotate any exposed credential; don't include secret values in evidence.",
    runner: (context) => scanCommittedSecrets(context.sensitiveFiles, context.appRoot),
  },
  jsCheck('CREDENTIAL_LOG_LEAKAGE', (context) => scanCredentialLogLeakage(context.sourceFiles)),
  jsCheck('CREDENTIAL_BROWSER_LEAKAGE', (context) => scanCredentialBrowserLeakage(context.sourceFiles)),
  {
    id: 'KNOWN_CVE_IN_DEPENDENCY',
    version: 2,
    lifecycle: 'active',
    analysisMode: 'audit',
    target: 'manifest',
    guidance:
      'Run the matching version 2 dependency prompt for static lockfile review without executing repository-controlled code.',
    runner: async (context) => {
      const result = await auditKnownCves(context.appRoot, context.manifests, context.dependencyAuditExecutor)
      return {issues: result.issues, unresolvedReason: result.unresolvedReason, inspectedFiles: result.inspectedFiles}
    },
  },
  {
    id: 'LIQUID_UNSAFE_RENDER',
    version: 1,
    lifecycle: 'active',
    analysisMode: 'ast',
    target: 'theme',
    requires: 'theme_app_extension',
    extensions: ['.liquid', '.html'],
    guidance:
      'Use the matching version 1 prompt to inspect metafield and block/section setting output in files the Liquid parser could not parse.',
    runner: (context) => liquidRunner(context, 'LIQUID_UNSAFE_RENDER'),
  },
  {
    ...jsCheck('UNSAFE_INNERHTML', unsafeInnerHtmlRunner, 'source_and_theme'),
    analysisMode: 'regex',
    extensions: [...JAVASCRIPT_EXTENSIONS, '.liquid', '.html'],
  },
  {
    ...jsCheck('APP_PROXY_LIQUID_INJECTION', (context) => scanAppProxyLiquidInjection(context.sourceFiles)),
    requires: 'app_proxy',
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
    implementations,
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

function reactRouterFiles(context: ScanContext): SourceFile[] {
  const themePaths = new Set(themeFiles(context).map((file) => file.path))
  return context.sourceFiles.filter((file) => !themePaths.has(file.path))
}

async function gitProject(appRoot: string): Promise<ScanResult['project']> {
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
  if (definition.target === 'manifest') return context.manifests.map((manifest) => manifest.path)
  if (definition.target === 'secrets')
    return context.sensitiveFiles.filter((file) => file.content !== undefined).map((file) => file.path)
  let files = reactRouterFiles(context)
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
  if (['source', 'theme', 'manifest', 'secrets', 'source_and_theme'].includes(definition.target) && files.length === 0)
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
  const isManifest = (path: string) => path.endsWith('package.json')
  const isSecretInput = (file: SkippedFile) =>
    !file.detail?.includes('could not be parsed') &&
    (context.sourceCandidates.some((candidate) => candidate.path === file.path) ||
      context.sensitiveFiles.some((sensitiveFile) => sensitiveFile.path === file.path) ||
      /(^|\/)(?:\.env(?:\.[^/]+)?|secrets\.json|credentials\.json)$/.test(file.path))

  return skippedFiles.filter((file) => {
    if (definition.target === 'config') return isConfig(file.path)
    if (definition.target === 'config_and_source') return isConfig(file.path) || isSourcePath(file.path)
    if (definition.target === 'source') return isSourcePath(file.path)
    if (definition.target === 'theme') return isThemePath(file.path)
    if (definition.target === 'source_and_theme') return isSourcePath(file.path) || isThemePath(file.path)
    if (definition.target === 'manifest') return isManifest(file.path)
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
  return definition.target === 'source' || definition.target === 'config_and_source'
    ? {...context, sourceFiles: reactRouterFiles(context)}
    : context
}

function normalizeRunnerResult(value: Issue[] | RunnerResult): RunnerResult {
  return Array.isArray(value) ? {issues: value} : value
}

export async function scan(
  startPath?: string,
  options: {dependencyAuditExecutor?: AuditExecutor} = {},
): Promise<ScanResult> {
  const appRoot = findAppRoot(startPath)
  resetSkippedFiles()
  const appTomls = findAppTomls(appRoot)
  const extensions = findExtensions(appRoot)
  const sourceCandidates = findSourceCandidates(appRoot)
  const sourceFiles = findAppSourceFiles(appRoot)
  const sensitiveFiles = findSensitiveFiles(appRoot)
  const manifestPaths = findManifestPaths(appRoot)
  const manifests = findManifests(appRoot, manifestPaths)
  const requestedAppToml = startPath?.endsWith('.toml')
    ? (appTomls.find((toml) => basename(toml.path) === basename(startPath)) ??
      loadAppToml(joinPath(appRoot, basename(startPath)), appRoot))
    : undefined
  const appToml = requestedAppToml ?? appTomls[0] ?? null
  const mergedConfig = appToml
    ? {
        ...appToml,
        webhooks: appTomls.flatMap((configuration) => configuration.webhooks),
        raw: Object.assign({}, ...appTomls.map((configuration) => configuration.raw)),
      }
    : null
  const capabilities = detectCapabilities(mergedConfig, extensions, sourceFiles)
  const detection = detectProject(manifests, extensions, sourceCandidates)
  const context: ScanContext = {
    appRoot,
    appToml,
    appTomls,
    extensions,
    sourceFiles,
    manifests,
    sensitiveFiles,
    capabilities,
    detection,
    sourceCandidates,
    dependencyAuditExecutor: options.dependencyAuditExecutor,
  }

  let issues: Issue[] = []
  const checksExecuted: CheckExecution[] = []
  for (const definition of DETERMINISTIC_CHECKS.values()) {
    let disposition = executionDisposition(definition, context)
    let inspectedFiles = disposition.status === 'unsupported_framework' ? [] : selectedFiles(definition, context)
    let implementations: RunnerImplementationResult[] | undefined
    const before = issues.length
    if ((disposition.status === 'executed' || disposition.status === 'unresolved') && definition.runner) {
      // eslint-disable-next-line no-await-in-loop
      const output = normalizeRunnerResult(await definition.runner(runnerContext(definition, context)))
      issues.push(...output.issues)
      implementations = output.implementations
      if (output.inspectedFiles) inspectedFiles = output.inspectedFiles
      if (output.unresolvedReason)
        disposition = {
          status: 'unresolved',
          required: true,
          applicable: true,
          reason: {
            code: definition.analysisMode === 'audit' ? 'audit_unavailable' : 'parser_unavailable',
            message: output.unresolvedReason,
          },
        }
    }
    const rejectedInputs = skippedInputsForCheck(definition, context, getSkippedFiles())
    if (disposition.status !== 'unsupported_framework' && rejectedInputs.length > 0) {
      const reason = skippedInputReason(definition, rejectedInputs)
      disposition = {status: 'unresolved', required: true, applicable: true, reason}
      if (implementations)
        implementations = [
          ...implementations,
          {
            id: 'safe-read-coverage',
            analysisMode: definition.analysisMode,
            status: 'unresolved',
            inspectedFiles: [],
            findings: 0,
            reason,
          },
        ]
    }
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
      required: disposition.required,
      applicable: disposition.applicable,
      languages,
      framework: detection.framework,
      surface: detection.surface,
      inspected_files: inspectedFiles,
      findings: issues.length - before,
      analysis_mode: definition.analysisMode,
      ...(disposition.reason ? {reason: disposition.reason} : {}),
      ...(disposition.status === 'unsupported_framework' || disposition.status === 'unresolved'
        ? {guidance: definition.guidance}
        : {}),
      ...(implementations
        ? {
            implementations: implementations.map((implementation) => ({
              id: implementation.id,
              analysis_mode: implementation.analysisMode,
              status: implementation.status,
              inspected_files: implementation.inspectedFiles,
              findings: implementation.findings,
              ...(implementation.reason ? {reason: implementation.reason} : {}),
            })),
          }
        : {}),
    })
  }

  const versionById = new Map(
    [...DETERMINISTIC_CHECKS.values()].map((definition) => [definition.id, definition.version]),
  )
  issues = issues.map((issue) =>
    redactIssue({...issue, found_by: 'static', rule_version: versionById.get(issue.id) ?? 1}),
  )
  for (const execution of checksExecuted)
    execution.findings = issues.filter((issue) => issue.id === execution.id && issue.found_by === 'static').length

  const fileHashMap: Record<string, string> = {}
  for (const file of [...sourceFiles, ...sensitiveFiles])
    if (file.content !== undefined)
      fileHashMap[redactText(file.path)] = `sha256:${createHash('sha256').update(file.content).digest('hex')}`
  const auditedLockfiles =
    checksExecuted
      .find((execution) => execution.id === 'KNOWN_CVE_IN_DEPENDENCY')
      ?.inspected_files.filter((path) => JAVASCRIPT_LOCKFILES.has(path)) ?? []
  const selectedAuditInputs =
    auditedLockfiles.length === 1
      ? auditedLockfiles.map((path) => {
          const input = readOptionalRepositoryFile(appRoot, joinPath(appRoot, path))
          return {absolutePath: joinPath(appRoot, path), content: input.ok ? input.content : undefined}
        })
      : []
  const configFiles = [
    ...appTomls.map((toml) => ({absolutePath: toml.path, content: toml.content})),
    ...extensions.map((extension) => ({absolutePath: joinPath(appRoot, extension.path), content: extension.content})),
    ...manifests.map((manifest) => ({absolutePath: manifest.absolutePath, content: manifest.content})),
    ...selectedAuditInputs,
  ]
  for (const {absolutePath, content} of configFiles)
    if (content !== undefined) {
      const relativeFilePath = relativePath(appRoot, absolutePath)
      const path = redactText(relativeFilePath.length > 0 ? relativeFilePath : basename(absolutePath))
      fileHashMap[path] ??= `sha256:${createHash('sha256').update(content).digest('hex')}`
    }

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
      !execution.required || (execution.status !== 'unsupported_framework' && execution.status !== 'unresolved')
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
  const score = coverageGaps.length === 0 ? calculateScore(issues) : null
  const rulesRun = checksExecuted.filter((execution) => execution.status === 'executed').length
  const scanMetadata = computeScanMetadata(
    sourceFiles.filter((file) => file.content !== undefined).length,
    rulesRun,
    checksExecuted.length - rulesRun,
    issues,
    score,
    fileHashMap,
    skippedFiles,
    checksExecuted,
    coverageGaps,
  )
  return {
    version: getEngineVersion(),
    timestamp: new Date().toISOString(),
    project: await gitProject(appRoot),
    app: {name: redactText(String(appToml?.raw.name ?? 'Unknown')), type: 'public'},
    capabilities,
    detection,
    score,
    scan: scanMetadata,
    issues,
  }
}
