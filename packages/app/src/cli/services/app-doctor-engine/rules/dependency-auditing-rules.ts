import {
  DependencyReviewInputsSchema,
  GitHubActionStepSchema,
  GitHubDefaultsSchema,
  GitHubJobHeaderSchema,
  GitHubReusableDefinitionSchema,
  GitHubReusableJobSchema,
  GitHubRunStepSchema,
  GitHubStepHeaderSchema,
  GitHubStepsJobSchema,
  GitHubWorkflowSchema,
  OsvWorkflowInputsSchema,
  SnykArgsInputsSchema,
  SnykCommandInputsSchema,
} from './dependency-auditing-github-schema.js'
import {
  GitLabConfigurationSchema,
  GitLabDefaultsSchema,
  GitLabDependencyScanningTemplateSchema,
  GitLabIncludeHeaderSchema,
  GitLabJobSchema,
  GitLabNeverRulesSchema,
  GitLabScriptsSchema,
  GitLabVariablesSchema,
} from './dependency-auditing-gitlab-schema.js'
import {
  CircleCheckoutSchema,
  CircleConfigurationHeaderSchema,
  CircleConfigurationSchema,
  CircleJobInvocationSchema,
  CircleJobSchema,
  CircleRunCommandSchema,
  CircleRunHeaderSchema,
  CircleSnykSettingsSchema,
  CircleSnykTargetSchema,
  CircleStepSchema,
  CircleWhenStepHeaderSchema,
  CircleWhenStepSchema,
  CircleWorkflowHeaderSchema,
  CircleWorkflowSchema,
} from './dependency-auditing-circle-schema.js'
import {parseDocument} from 'yaml'
import type {CircleJob} from './dependency-auditing-circle-schema.js'
import type {GitHubActionStep, GitHubDefaults, GitHubRunStep} from './dependency-auditing-github-schema.js'
import type {Issue} from '../types.js'
import type {ManifestFile, ScanContext, SourceFile} from './types.js'

interface Analysis {
  recognized: boolean
  obstacles: string[]
}

interface CommandContext {
  directory: string
  manifests: ManifestFile[]
  allowPackageScript: boolean
}

type ParsedConfiguration = {ok: true; value: unknown; warnings: string[]} | {ok: false; reason: string}
type ResolvedValue = {ok: true; value: string} | {ok: false}
type OptionalValue = {ok: true; present: boolean; value?: unknown} | {ok: false}
type ParsedShell = {ok: true; segments: string[]} | {ok: false}

const GITLAB_RESERVED_KEYS = new Set([
  'after_script',
  'before_script',
  'cache',
  'default',
  'image',
  'include',
  'pages',
  'services',
  'stages',
  'variables',
  'workflow',
])
const SUPPORTED_PACKAGE_MANAGERS = new Set(['javascript', 'node', 'npm', 'pnpm', 'yarn'])
const LOCAL_SCRIPT_EXECUTORS = new Set(['.', 'bash', 'node', 'sh', 'source', 'tsx'])
const SHELL_CONTROL_WORDS = new Set([
  'break',
  'case',
  'continue',
  'do',
  'done',
  'elif',
  'else',
  'eval',
  'exit',
  'false',
  'fi',
  'for',
  'function',
  'if',
  'return',
  'set',
  'then',
  'trap',
  'until',
  'while',
])
const CIRCLE_BUILT_IN_STEPS = new Set([
  'add_ssh_keys',
  'attach_workspace',
  'checkout',
  'persist_to_workspace',
  'restore_cache',
  'save_cache',
  'setup_remote_docker',
  'store_artifacts',
  'store_test_results',
])
const MAX_YAML_ALIASES = 20

/**
 * Recognizes a deliberately small set of dependency-auditing executions.
 * Unknown indirection is left unresolved rather than interpreted as shell or CI code.
 */
export function scanDependencyAuditing(context: Pick<ScanContext, 'manifests' | 'dependencyAuditing'>): {
  issues: Issue[]
  unresolvedReason?: string
} {
  const applicableManifests = context.manifests.filter(hasDependencies)
  if (applicableManifests.length === 0) return {issues: []}
  if (context.dependencyAuditing.unresolvedReason) {
    return {issues: [], unresolvedReason: context.dependencyAuditing.unresolvedReason}
  }

  const parsedFiles = context.dependencyAuditing.files.map((file) => ({file, parsed: parseConfiguration(file)}))
  const malformed = parsedFiles.find(({parsed}) => !parsed.ok)
  if (malformed && !malformed.parsed.ok) return {issues: [], unresolvedReason: malformed.parsed.reason}

  const analysis = parsedFiles.reduce<Analysis>((combined, {file, parsed}) => {
    if (!parsed.ok) return combined
    return combine(combined, analyzeConfiguration(file, parsed, context.manifests))
  }, noEvidence())
  if (analysis.recognized) return {issues: []}
  if (analysis.obstacles.length > 0) return {issues: [], unresolvedReason: analysis.obstacles[0]}

  const manifest = [...applicableManifests].sort((left, right) => left.path.localeCompare(right.path))[0]!
  return {
    issues: [
      {
        id: 'MISSING_DEPENDENCY_AUDITING',
        severity: 'low',
        points: -5,
        title: 'Dependency auditing configuration not detected',
        message:
          'No recognized dependency-auditing configuration was found in the inspected files. Add an automated dependency vulnerability check, or verify that your existing integration covers this app. Hosted integrations and repository settings were not inspected.',
        location: {file: normalizePath(manifest.path)},
        fix: {
          automated: false,
          description: 'Add an automated dependency vulnerability check for this package.',
        },
      },
    ],
  }
}

function hasDependencies(manifest: ManifestFile): boolean {
  return Object.keys(manifest.dependencies).length > 0 || Object.keys(manifest.devDependencies ?? {}).length > 0
}

function analyzeConfiguration(
  file: SourceFile,
  parsed: Extract<ParsedConfiguration, {ok: true}>,
  manifests: ManifestFile[],
): Analysis {
  const path = normalizePath(file.path)
  const warnings = parsed.warnings.reduce(
    (analysis, warning) => combine(analysis, obstacle(`${warning}: ${path}`)),
    noEvidence(),
  )
  if (parsed.warnings.length > 0 || parsed.value === null || parsed.value === undefined) return warnings
  if (/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path)) {
    return combine(warnings, analyzeGitHubWorkflow(parsed.value, path, manifests))
  }
  if (/(?:^|\/)\.gitlab-ci\.ya?ml$/i.test(path)) {
    return combine(warnings, analyzeGitLabConfiguration(parsed.value, path, manifests))
  }
  if (/^\.circleci\/config\.ya?ml$/i.test(path)) {
    return combine(warnings, analyzeCircleConfiguration(parsed.value, path, manifests))
  }
  return warnings
}

function parseConfiguration(file: SourceFile): ParsedConfiguration {
  if (file.content === undefined) {
    return {ok: false, reason: `Dependency-auditing configuration was unreadable: ${file.path}`}
  }
  try {
    const document = parseDocument(file.content, {schema: 'core', merge: true, uniqueKeys: true})
    if (document.errors.length > 0) {
      return {ok: false, reason: `Dependency-auditing YAML is malformed: ${file.path}`}
    }
    const value = document.toJS({maxAliasCount: MAX_YAML_ALIASES}) as unknown
    const warnings = document.warnings.map(() => 'Unsupported YAML feature prevents complete auditing analysis')
    return {ok: true, value, warnings}
    // YAML conversion may reject excessive aliases or invalid custom structures.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return {ok: false, reason: `Dependency-auditing YAML could not be parsed safely: ${file.path}`}
  }
}

function analyzeGitHubWorkflow(value: unknown, path: string, manifests: ManifestFile[]): Analysis {
  // A reusable-only workflow is a definition, not evidence of invocation. Local callers remain unresolved.
  if (GitHubReusableDefinitionSchema.safeParse(value).success) return noEvidence()
  const workflowResult = GitHubWorkflowSchema.safeParse(value)
  if (!workflowResult.success) return obstacle(`GitHub Actions workflow has an unsupported structure: ${path}`)
  const root = workflowResult.data
  if (root.jobs === undefined) return noEvidence()

  let analysis = noEvidence()
  const workflowDefaults = GitHubDefaultsSchema.safeParse(root.defaults)
  const workflowDirectory: OptionalValue = workflowDefaults.success
    ? readGitHubDefaultDirectory(workflowDefaults.data)
    : {ok: false}
  for (const jobValue of Object.values(root.jobs)) {
    const jobResult = GitHubJobHeaderSchema.safeParse(jobValue)
    if (!jobResult.success) {
      analysis = combine(analysis, obstacle(`GitHub Actions workflow has an unsupported job in ${path}`))
      continue
    }
    const job = jobResult.data
    if (isDisabled(job.if)) continue
    if (job.uses !== undefined) {
      const reusableJob = GitHubReusableJobSchema.safeParse(jobValue)
      if (!reusableJob.success) {
        analysis = combine(analysis, obstacle(`GitHub Actions reusable workflow has an unsupported structure: ${path}`))
      } else if (isKnownOsvWorkflow(reusableJob.data.uses)) {
        analysis = combine(analysis, analyzeOsvWorkflow(reusableJob.data.with, path))
      } else {
        analysis = combine(analysis, obstacle(`Unsupported reusable workflow referenced by ${path}`))
      }
      continue
    }

    const stepsJob = GitHubStepsJobSchema.safeParse(jobValue)
    if (!stepsJob.success) {
      analysis = combine(analysis, obstacle(`GitHub Actions workflow has an unsupported steps section: ${path}`))
      continue
    }
    if (stepsJob.data.steps.some(hasUnsupportedCheckout)) {
      analysis = combine(analysis, obstacle(`Unsupported checkout repository or path in ${path}`))
      continue
    }
    const jobDefaults = GitHubDefaultsSchema.safeParse(stepsJob.data.defaults)
    const jobDirectory: OptionalValue = jobDefaults.success ? readGitHubDefaultDirectory(jobDefaults.data) : {ok: false}
    for (const stepValue of stepsJob.data.steps) {
      const stepResult = GitHubStepHeaderSchema.safeParse(stepValue)
      if (!stepResult.success) {
        analysis = combine(analysis, obstacle(`GitHub Actions workflow has an unsupported step in ${path}`))
        continue
      }
      const step = stepResult.data
      if (isDisabled(step.if)) continue
      if (step.uses !== undefined) {
        const action = GitHubActionStepSchema.safeParse(stepValue)
        if (action.success) {
          // defaults.run and working-directory apply only to run steps. Actions execute from checkout root.
          analysis = combine(analysis, analyzeGitHubAction(action.data, path, manifests))
        } else {
          analysis = combine(analysis, obstacle(`GitHub Actions workflow has an unsupported action step in ${path}`))
        }
      }
      if (step.run !== undefined) {
        const run = GitHubRunStepSchema.safeParse(stepValue)
        if (!run.success) {
          analysis = combine(analysis, obstacle(`GitHub Actions workflow has an unsupported run step in ${path}`))
          continue
        }
        const shell =
          run.data.shell ??
          (jobDefaults.success ? jobDefaults.data.run?.shell : undefined) ??
          (workflowDefaults.success ? workflowDefaults.data.run?.shell : undefined)
        if (shell !== undefined && (typeof shell !== 'string' || !/^(?:bash|sh|cmd|pwsh|powershell)$/.test(shell))) {
          analysis = combine(analysis, obstacle(`Unsupported execution shell in ${path}`))
          continue
        }
        const directory = resolveGitHubRunDirectory(run.data, jobDirectory, workflowDirectory)
        analysis = combine(
          analysis,
          directory.ok
            ? analyzeCommands(run.data.run, {directory: directory.value, manifests, allowPackageScript: true}, path)
            : obstacle(`Unsupported working-directory prevents auditing analysis in ${path}`),
        )
      }
    }
  }
  return analysis
}

function hasUnsupportedCheckout(value: unknown): boolean {
  const result = GitHubActionStepSchema.safeParse(value)
  if (!result.success || isDisabled(result.data.if) || !/^actions\/checkout@/i.test(result.data.uses)) return false
  const inputs = result.data.with
  return (
    inputs?.repository !== undefined ||
    (inputs?.path !== undefined && inputs.path !== '.' && inputs.path !== './') ||
    inputs?.['sparse-checkout'] !== undefined
  )
}

function analyzeOsvWorkflow(inputs: unknown, path: string): Analysis {
  return OsvWorkflowInputsSchema.safeParse(inputs).success
    ? evidence()
    : obstacle(`Unsupported OSV reusable workflow input referenced by ${path}`)
}

function analyzeGitHubAction(step: GitHubActionStep, workflowPath: string, manifests: ManifestFile[]): Analysis {
  const uses = step.uses.toLowerCase()
  if (/^actions\/dependency-review-action@[^\s]+$/i.test(uses)) {
    const result = DependencyReviewInputsSchema.safeParse(step.with)
    if (!result.success) return obstacle(`Unsupported dependency review input in ${workflowPath}`)
    const inputs = result.data
    if (inputs['config-file'] !== undefined) {
      return obstacle(`Dependency review config-file can't be inspected from ${workflowPath}`)
    }
    const vulnerabilityCheck = inputs?.['vulnerability-check']
    if (isDisabled(vulnerabilityCheck)) return noEvidence()
    if (vulnerabilityCheck !== undefined && vulnerabilityCheck !== true && vulnerabilityCheck !== 'true') {
      return obstacle(`Unsupported dependency review input in ${workflowPath}`)
    }
    return evidence()
  }
  if (/^snyk\/actions\/node(?:-\d+)?@[^\s]+$/i.test(uses)) {
    const command = SnykCommandInputsSchema.safeParse(step.with)
    if (!command.success) return obstacle(`Unsupported Snyk command input in ${workflowPath}`)
    const commandValue = command.data.command
    if (commandValue !== undefined && isDynamic(commandValue)) {
      return obstacle(`Dynamic Snyk command input in ${workflowPath}`)
    }
    if (commandValue !== undefined && commandValue.trim() !== 'test') return noEvidence()
    const argsResult = SnykArgsInputsSchema.safeParse(step.with)
    if (!argsResult.success) return obstacle(`Unsupported Snyk args input in ${workflowPath}`)
    const args = argsResult.data.args
    const parsedArgs = splitShell(args)
    if (!parsedArgs.ok || parsedArgs.segments.length > 1 || isDynamic(args)) {
      return obstacle(`Unsupported Snyk args input in ${workflowPath}`)
    }
    if (/\b(?:code|container)\s+test\b/i.test(args)) return noEvidence()
    return analyzeCommands(`snyk test ${args}`, {directory: '', manifests, allowPackageScript: false}, workflowPath)
  }
  if (/^snyk\/actions\/(?:setup|code|docker|container)@[^\s]+$/i.test(uses)) return noEvidence()
  if (uses.startsWith('./')) return obstacle(`Unsupported local action referenced by ${workflowPath}`)
  return noEvidence()
}

function analyzeGitLabConfiguration(value: unknown, path: string, manifests: ManifestFile[]): Analysis {
  const configuration = GitLabConfigurationSchema.safeParse(value)
  if (!configuration.success) return obstacle(`GitLab CI configuration has an unsupported structure: ${path}`)
  const root = configuration.data
  if (GitLabNeverRulesSchema.safeParse(root.workflow?.rules).success) return noEvidence()

  const variables = GitLabVariablesSchema.safeParse(root.variables)
  if (!variables.success) return obstacle(`GitLab CI variables have an unsupported structure: ${path}`)
  const dependencyScanningDisabled = variables.data.DS_DISABLED === true || variables.data.DS_DISABLED === 'true'
  let analysis = analyzeGitLabIncludes(root.include, path, dependencyScanningDisabled)
  const defaults = GitLabDefaultsSchema.safeParse(root.default)
  if (!defaults.success) {
    analysis = combine(analysis, obstacle(`GitLab CI default has an unsupported structure: ${path}`))
  }
  const defaultConfiguration = defaults.success ? defaults.data : undefined

  for (const [jobName, jobValue] of Object.entries(root)) {
    if (jobName.startsWith('.') || GITLAB_RESERVED_KEYS.has(jobName)) continue
    const jobResult = GitLabJobSchema.safeParse(jobValue)
    if (!jobResult.success) {
      analysis = combine(analysis, obstacle(`GitLab CI has an unsupported job in ${path}`))
      continue
    }
    const job = jobResult.data
    if (job.when === 'never' || GitLabNeverRulesSchema.safeParse(job.rules).success) continue
    if (job.extends !== undefined || job.inherit !== undefined) {
      analysis = combine(analysis, obstacle(`Unsupported GitLab job inheritance referenced by ${path}`))
      continue
    }
    if (job.script === undefined) continue

    const scripts = GitLabScriptsSchema.safeParse({
      before_script: job.before_script ?? defaultConfiguration?.before_script ?? root.before_script,
      script: job.script,
      after_script: job.after_script ?? defaultConfiguration?.after_script ?? root.after_script,
    })
    if (!scripts.success) {
      analysis = combine(analysis, obstacle(`GitLab CI job has an unsupported script structure in ${path}`))
      continue
    }
    const mainCommands = [...scripts.data.before_script, ...scripts.data.script]
    if (mainCommands.length > 0) {
      analysis = combine(
        analysis,
        analyzeCommands(mainCommands.join('\n'), {directory: '', manifests, allowPackageScript: true}, path),
      )
    }
    if (scripts.data.after_script.length > 0) {
      analysis = combine(
        analysis,
        analyzeCommands(
          scripts.data.after_script.join('\n'),
          {directory: '', manifests, allowPackageScript: true},
          path,
        ),
      )
    }
  }
  return analysis
}

function analyzeGitLabIncludes(value: unknown, path: string, dependencyScanningDisabled: boolean): Analysis {
  if (value === undefined) return noEvidence()
  let analysis = noEvidence()
  for (const include of Array.isArray(value) ? value : [value]) {
    const header = GitLabIncludeHeaderSchema.safeParse(include)
    if (!header.success) {
      analysis = combine(analysis, obstacle(`Unsupported GitLab include referenced by ${path}`))
      continue
    }
    if (header.data.rules !== undefined) {
      if (GitLabNeverRulesSchema.safeParse(header.data.rules).success) continue
      analysis = combine(analysis, obstacle(`Conditional GitLab include can't be resolved in ${path}`))
      continue
    }
    if (GitLabDependencyScanningTemplateSchema.safeParse(include).success) {
      if (dependencyScanningDisabled) continue
      analysis = combine(analysis, evidence())
    } else {
      analysis = combine(analysis, obstacle(`Unsupported GitLab include referenced by ${path}`))
    }
  }
  return analysis
}

function analyzeCircleConfiguration(value: unknown, path: string, manifests: ManifestFile[]): Analysis {
  const header = CircleConfigurationHeaderSchema.safeParse(value)
  if (!header.success) return obstacle(`CircleCI configuration has an unsupported structure: ${path}`)
  if (header.data.workflows === undefined) return noEvidence()
  const configuration = CircleConfigurationSchema.safeParse(value)
  if (!configuration.success) return obstacle(`CircleCI configuration has unsupported jobs or workflows: ${path}`)
  const {jobs, workflows, commands, orbs} = configuration.data

  const snykAliases = new Set(
    Object.entries(orbs)
      .filter(([, orb]) => typeof orb === 'string' && /^snyk\/snyk@[^\s]+$/i.test(orb))
      .map(([alias]) => alias),
  )
  const customCommands = new Set(Object.keys(commands ?? {}))
  let analysis = noEvidence()
  for (const [workflowName, workflowValue] of Object.entries(workflows)) {
    if (workflowName === 'version') continue
    const workflowHeader = CircleWorkflowHeaderSchema.safeParse(workflowValue)
    if (!workflowHeader.success) {
      analysis = combine(analysis, obstacle(`CircleCI workflow has an unsupported structure in ${path}`))
      continue
    }
    if (isDisabled(workflowHeader.data.when)) continue
    const workflow = CircleWorkflowSchema.safeParse(workflowValue)
    if (!workflow.success) {
      analysis = combine(analysis, obstacle(`CircleCI workflow has unsupported jobs in ${path}`))
      continue
    }
    for (const invocation of workflow.data.jobs) {
      const parsedInvocation = CircleJobInvocationSchema.safeParse(invocation)
      if (!parsedInvocation.success) {
        analysis = combine(analysis, obstacle(`CircleCI workflow has an unsupported job invocation in ${path}`))
        continue
      }
      const jobName = parsedInvocation.data
      if (!jobName) continue
      if (jobName.includes('/')) {
        analysis = combine(analysis, obstacle(`Unsupported CircleCI orb job referenced by ${path}`))
        continue
      }
      const job = CircleJobSchema.safeParse(jobs[jobName])
      if (!job.success) {
        analysis = combine(analysis, obstacle(`Unknown CircleCI job referenced by ${path}`))
        continue
      }
      analysis = combine(analysis, analyzeCircleJob(job.data, snykAliases, customCommands, path, manifests))
    }
  }
  return analysis
}

function analyzeCircleJob(
  job: CircleJob,
  snykAliases: Set<string>,
  customCommands: Set<string>,
  path: string,
  manifests: ManifestFile[],
): Analysis {
  const directory = resolveCircleDirectory(job.working_directory)
  if (!directory.ok) return obstacle(`Unsupported CircleCI working_directory in ${path}`)
  if (
    job.steps.some((step) => {
      const checkout = CircleCheckoutSchema.safeParse(step)
      return checkout.success && checkout.data.checkout.path !== undefined
    })
  ) {
    return obstacle(`Unsupported CircleCI checkout path in ${path}`)
  }

  let analysis = noEvidence()
  for (const stepValue of job.steps) {
    const header = CircleWhenStepHeaderSchema.safeParse(stepValue)
    if (header.success && header.data.when !== undefined) {
      const when = CircleWhenStepSchema.safeParse(header.data.when)
      if (!when.success) {
        analysis = combine(analysis, obstacle(`CircleCI when step has an unsupported structure in ${path}`))
        continue
      }
      if (isDisabled(when.data.condition)) continue
      for (const nestedStep of when.data.steps) {
        analysis = combine(
          analysis,
          analyzeCircleStep(nestedStep, directory.value, snykAliases, customCommands, path, manifests),
        )
      }
      continue
    }
    analysis = combine(
      analysis,
      analyzeCircleStep(stepValue, directory.value, snykAliases, customCommands, path, manifests),
    )
  }
  return analysis
}

function analyzeCircleStep(
  stepValue: unknown,
  directory: string,
  snykAliases: Set<string>,
  customCommands: Set<string>,
  path: string,
  manifests: ManifestFile[],
): Analysis {
  if (typeof stepValue === 'string') {
    if (CIRCLE_BUILT_IN_STEPS.has(stepValue)) return noEvidence()
    const [alias, command] = stepValue.split('/')
    if (alias && command) {
      if (command === 'scan' && snykAliases.has(alias)) {
        return targetCoversManifest(directory, undefined, manifests) ? evidence() : noEvidence()
      }
      return obstacle(`Unsupported CircleCI orb command referenced by ${path}`)
    }
    return obstacle(`Unsupported CircleCI custom command referenced by ${path}`)
  }
  const step = CircleStepSchema.safeParse(stepValue)
  if (!step.success) return obstacle(`CircleCI job has an unsupported step in ${path}`)
  const {name, settings: settingsValue} = step.data
  if (name === 'run' && settingsValue !== undefined) {
    const runValue = typeof settingsValue === 'string' ? {command: settingsValue} : settingsValue
    const header = CircleRunHeaderSchema.safeParse(runValue)
    if (!header.success) return obstacle(`CircleCI run step has an unsupported structure in ${path}`)
    if (header.data.when === 'never') return noEvidence()
    const run = CircleRunCommandSchema.safeParse(runValue)
    if (!run.success) return obstacle(`CircleCI run command has an unsupported structure in ${path}`)
    const runDirectory =
      run.data.working_directory === undefined
        ? {ok: true as const, value: directory}
        : resolveCircleDirectory(run.data.working_directory)
    if (!runDirectory.ok) return obstacle(`Unsupported CircleCI run working_directory in ${path}`)
    return analyzeCommands(run.data.command, {directory: runDirectory.value, manifests, allowPackageScript: true}, path)
  }

  if (CIRCLE_BUILT_IN_STEPS.has(name)) return noEvidence()
  const [alias, command] = name.split('/')
  if (!alias || !command) {
    return customCommands.has(name)
      ? obstacle(`Unsupported CircleCI custom command referenced by ${path}`)
      : obstacle(`Unknown CircleCI command referenced by ${path}`)
  }
  if (!snykAliases.has(alias) || command !== 'scan') {
    return obstacle(`Unsupported CircleCI orb command referenced by ${path}`)
  }
  const settings = CircleSnykSettingsSchema.safeParse(settingsValue)
  if (!settings.success) return obstacle(`CircleCI Snyk settings have an unsupported structure in ${path}`)
  const packageManagerValue = settings.data['package-manager']
  if (packageManagerValue !== undefined) {
    if (packageManagerValue.length === 0 || isDynamic(packageManagerValue)) {
      return obstacle(`CircleCI Snyk package manager has an unsupported value in ${path}`)
    }
    if (!SUPPORTED_PACKAGE_MANAGERS.has(packageManagerValue.toLowerCase())) return noEvidence()
  }
  const target = CircleSnykTargetSchema.safeParse(settings.data['target-file'] ?? settings.data.file)
  if (!target.success) return obstacle(`CircleCI Snyk target has an unsupported structure in ${path}`)
  const targetValue = target.data
  if (targetValue !== undefined && (!targetValue || !isSafeRelativePath(targetValue))) {
    return obstacle(`Unsupported CircleCI Snyk target prevents auditing analysis in ${path}`)
  }
  return targetCoversManifest(directory, targetValue, manifests) ? evidence() : noEvidence()
}

function analyzeCommands(command: string, context: CommandContext, configurationPath: string): Analysis {
  const parsedShell = splitShell(command)
  if (!parsedShell.ok) return obstacle(`Unsupported shell syntax referenced by ${configurationPath}`)

  const segments = parsedShell.segments.map((segment) => ({segment, tokens: tokenize(segment)}))
  if (
    segments.some(
      ({segment, tokens}) =>
        segment.includes('`') || segment.includes('$(') || SHELL_CONTROL_WORDS.has(firstExecutable(tokens) ?? ''),
    )
  ) {
    return obstacle(`Unsupported shell control flow referenced by ${configurationPath}`)
  }

  let analysis = noEvidence()
  let directory = normalizeDirectory(context.directory)
  for (const {tokens} of segments) {
    if (tokens.length === 0) continue
    const executableIndex = tokens.findIndex((token) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))
    if (executableIndex < 0) continue
    const executable = tokens[executableIndex]!
    const commandTokens = tokens.slice(executableIndex)
    if (executable === 'echo' || executable === 'printf') continue
    if (executable === 'cd') {
      const target = commandTokens[1]
      const resolved = target === undefined ? undefined : resolveDirectory(directory, target)
      if (resolved === undefined) {
        analysis = combine(analysis, obstacle(`Unsupported shell directory in ${configurationPath}`))
      } else {
        directory = resolved
      }
      continue
    }
    if (isPotentialUnsupportedPackageInvocation(commandTokens)) {
      analysis = combine(analysis, obstacle(`Unsupported package manager selector in ${configurationPath}`))
      continue
    }
    if (isRecognizedAuditCommand(commandTokens)) {
      if (hasHelpOrVersion(commandTokens)) continue
      const packageManagerOption = selectedOption(commandTokens, ['--package-manager'])
      if (packageManagerOption.present) {
        if (!isUsableOptionValue(packageManagerOption.value) || isDynamic(packageManagerOption.value)) {
          analysis = combine(analysis, obstacle(`Unsupported scanner package manager in ${configurationPath}`))
          continue
        }
        if (!SUPPORTED_PACKAGE_MANAGERS.has(packageManagerOption.value.toLowerCase())) continue
      }
      const targetOption = selectedOption(commandTokens, scannerTargetOptionNames(commandTokens[0]))
      if (
        targetOption.present &&
        (!isUsableOptionValue(targetOption.value) || !isSafeRelativePath(targetOption.value))
      ) {
        analysis = combine(analysis, obstacle(`Unsupported scanner target in ${configurationPath}`))
      } else if (commandCoversManifest(commandTokens, directory, targetOption.value, context.manifests)) {
        analysis = combine(analysis, evidence())
      }
      continue
    }

    const packageScript = parsePackageScript(commandTokens)
    if (packageScript.kind === 'unsupported') {
      analysis = combine(analysis, obstacle(`Unsupported package script invocation in ${configurationPath}`))
      continue
    }
    if (packageScript.kind === 'script') {
      if (!context.allowPackageScript) {
        analysis = combine(analysis, obstacle(`Nested package script referenced by ${configurationPath}`))
        continue
      }
      const scriptDirectory = packageScript.target ? resolveDirectory(directory, packageScript.target) : directory
      if (scriptDirectory === undefined) {
        analysis = combine(analysis, obstacle(`Unsupported package script target in ${configurationPath}`))
        continue
      }
      const selectedManifest = manifestInDirectory(context.manifests, scriptDirectory)
      const script = selectedManifest?.scripts?.[packageScript.name]
      if (!selectedManifest || script === undefined) {
        analysis = combine(analysis, obstacle(`Package script can't be resolved in ${configurationPath}`))
        continue
      }
      analysis = combine(
        analysis,
        analyzeCommands(
          script,
          {directory: manifestDirectory(selectedManifest), manifests: context.manifests, allowPackageScript: false},
          configurationPath,
        ),
      )
      continue
    }

    if (isDynamic(executable) || referencesLocalScript(commandTokens) || invokesShellCommand(commandTokens)) {
      analysis = combine(analysis, obstacle(`Unsupported local script referenced by ${configurationPath}`))
    }
  }

  // An unsupported construct in this execution block may govern any command in that block.
  return analysis.obstacles.length > 0 ? {recognized: false, obstacles: analysis.obstacles} : analysis
}

function isRecognizedAuditCommand(tokens: string[]): boolean {
  const words = tokens.map((token) => token.toLowerCase())
  const executable = words[0]
  if (executable === 'npm' || executable === 'pnpm') return packageManagerCommand(words) === 'audit'
  if (executable === 'yarn') {
    const commandWords = packageManagerCommandWords(words)
    return commandWords[0] === 'audit' || (commandWords[0] === 'npm' && commandWords[1] === 'audit')
  }
  let snykIndex = -1
  if (executable === 'snyk') snykIndex = 0
  else if (executable === 'npx' && words[1] === 'snyk') snykIndex = 1
  if (snykIndex >= 0) return words[snykIndex + 1] === 'test'
  return executable === 'semgrep' && words[1] === 'ci' && words.includes('--supply-chain')
}

function packageManagerCommand(tokens: string[]): string | undefined {
  return packageManagerCommandWords(tokens)[0]
}

function packageManagerCommandWords(tokens: string[]): string[] {
  const words = tokens.slice(1)
  const manager = tokens[0]
  const supportedOptions = packageManagerDirectoryOptionNames(manager)
  while (words[0]?.startsWith('-')) {
    const option = words.shift()!
    if (!option.includes('=') && supportedOptions.includes(option)) words.shift()
  }
  return words
}

type PackageScript = {kind: 'none'} | {kind: 'unsupported'} | {kind: 'script'; name: string; target?: string}

function parsePackageScript(tokens: string[]): PackageScript {
  const manager = tokens[0]?.toLowerCase()
  if (!manager || !['npm', 'pnpm', 'yarn'].includes(manager)) return {kind: 'none'}
  const targetOption = selectedOption(tokens, scannerTargetOptionNames(manager))
  if (targetOption.present && (!isUsableOptionValue(targetOption.value) || !isSafeRelativePath(targetOption.value))) {
    return {kind: 'unsupported'}
  }
  const target = targetOption.value
  const words = packageManagerCommandWords(tokens.map((token) => token.toLowerCase()))
  const commandIndex = tokens.length - words.length
  if (['install', 'add', 'remove', 'update', 'upgrade', 'login', 'logout', 'config'].includes(words[0] ?? '')) {
    return {kind: 'none'}
  }
  if (words[0] === 'run' || words[0] === 'run-script') {
    const scriptName = tokens[commandIndex + 1]
    if (words.length !== 2 || !scriptName || !/^[A-Za-z0-9_.:-]+$/.test(scriptName)) {
      return {kind: 'unsupported'}
    }
    return {kind: 'script', name: scriptName, target}
  }
  if (
    (manager === 'pnpm' || manager === 'yarn') &&
    words.length === 1 &&
    words[0] &&
    /^[A-Za-z0-9_.:-]+$/.test(words[0])
  ) {
    return {kind: 'script', name: tokens[commandIndex]!, target}
  }
  return {kind: 'none'}
}

function isPotentialUnsupportedPackageInvocation(tokens: string[]): boolean {
  const manager = tokens[0]?.toLowerCase()
  if (!manager || !['npm', 'pnpm', 'yarn'].includes(manager)) return false
  const lower = tokens.map((token) => token.toLowerCase())
  const invokesAuditOrScript = lower.includes('audit') || lower.includes('run') || lower.includes('run-script')
  if (!invokesAuditOrScript) return false
  if (
    lower.some(
      (token) => /^(?:--filter|--workspace|--workspaces|--recursive)(?:=|$)/i.test(token) || /^-[frw]/i.test(token),
    )
  ) {
    return true
  }

  const supportedOptions = packageManagerDirectoryOptionNames(manager)
  for (let index = 1; index < lower.length && lower[index]?.startsWith('-'); index++) {
    const optionName = lower[index]!.split('=')[0]!
    if (!supportedOptions.includes(optionName)) return true
    if (!lower[index]!.includes('=')) index++
  }
  return false
}

function packageManagerDirectoryOptionNames(manager: string | undefined): string[] {
  if (manager === 'npm') return ['--prefix']
  if (manager === 'pnpm') return ['--dir', '-c']
  return ['--cwd']
}

function scannerTargetOptionNames(executable: string | undefined): string[] {
  const normalizedExecutable = executable?.toLowerCase()
  if (normalizedExecutable === 'npm') return ['--file', '--target-file', '--prefix']
  if (normalizedExecutable === 'pnpm') return ['--file', '--target-file', '--dir', '-c']
  if (normalizedExecutable === 'yarn') return ['--file', '--target-file', '--cwd']
  return ['--file', '--target-file']
}

function invokesShellCommand(tokens: string[]): boolean {
  return ['bash', 'sh'].includes(tokens[0]?.toLowerCase() ?? '') && tokens.slice(1).some((token) => token === '-c')
}

function referencesLocalScript(tokens: string[]): boolean {
  const executable = tokens[0]?.toLowerCase()
  if (!executable) return false
  if (/^(?:\.\.?\/|\/).+/.test(executable)) return true
  if (!LOCAL_SCRIPT_EXECUTORS.has(executable)) return false
  return tokens.slice(1).some((token) => /(?:^|\/)[^\s]+\.(?:[cm]?[jt]sx?|sh)$/.test(token))
}

function commandCoversManifest(
  tokens: string[],
  directory: string,
  target: string | undefined,
  manifests: ManifestFile[],
): boolean {
  if (target) return targetCoversManifest(directory, target, manifests)
  const executable = tokens[0]?.toLowerCase()
  const scansRecursively =
    (executable === 'semgrep' && tokens.includes('--supply-chain')) || tokens.includes('--all-projects')
  if (!scansRecursively) return targetCoversManifest(directory, undefined, manifests)
  const normalizedDirectory = normalizeDirectory(directory)
  return manifests.some((manifest) => {
    if (!hasDependencies(manifest)) return false
    const candidateDirectory = manifestDirectory(manifest)
    return (
      !normalizedDirectory ||
      candidateDirectory === normalizedDirectory ||
      candidateDirectory.startsWith(`${normalizedDirectory}/`)
    )
  })
}

function targetCoversManifest(
  directory: string | undefined,
  target: string | undefined,
  manifests: ManifestFile[],
): boolean {
  const baseDirectory = normalizeDirectory(directory ?? '')
  if (!target) {
    return manifests.some((manifest) => hasDependencies(manifest) && manifestDirectory(manifest) === baseDirectory)
  }
  const normalizedTarget = resolveDirectory(baseDirectory, target)
  if (normalizedTarget === undefined) return false
  const targetBasename = normalizedTarget.split('/').at(-1) ?? ''
  const targetDirectory = /^(?:package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(targetBasename)
    ? normalizeDirectory(normalizedTarget.slice(0, -(targetBasename.length + (normalizedTarget.includes('/') ? 1 : 0))))
    : normalizedTarget
  return manifests.some((manifest) => hasDependencies(manifest) && manifestDirectory(manifest) === targetDirectory)
}

function manifestInDirectory(manifests: ManifestFile[], directory: string): ManifestFile | undefined {
  return manifests.find((manifest) => manifestDirectory(manifest) === normalizeDirectory(directory))
}

function manifestDirectory(manifest: ManifestFile): string {
  const path = normalizePath(manifest.path)
  return normalizeDirectory(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
}

function resolveGitHubRunDirectory(
  step: GitHubRunStep,
  jobDirectory: OptionalValue,
  workflowDirectory: OptionalValue,
): ResolvedValue {
  if (step['working-directory'] !== undefined) return resolveSelectedDirectory(step['working-directory'])
  if (!jobDirectory.ok) return {ok: false}
  if (jobDirectory.present) return resolveSelectedDirectory(jobDirectory.value)
  if (!workflowDirectory.ok) return {ok: false}
  return resolveSelectedDirectory(workflowDirectory.value)
}

function readGitHubDefaultDirectory(defaults: GitHubDefaults): OptionalValue {
  const directory = defaults.run?.['working-directory']
  return {ok: true, present: directory !== undefined, value: directory}
}

function resolveSelectedDirectory(value: unknown): ResolvedValue {
  if (value === undefined) return {ok: true, value: ''}
  if (typeof value !== 'string' || !isSafeRelativePath(value)) return {ok: false}
  return {ok: true, value: normalizeDirectory(value)}
}

function resolveCircleDirectory(value: unknown): ResolvedValue {
  if (value === undefined) return {ok: true, value: ''}
  if (typeof value !== 'string' || isDynamic(value)) return {ok: false}
  const normalized = normalizePath(value)
  if (normalized !== '~/project' && !normalized.startsWith('~/project/')) return {ok: false}
  const relative = normalized === '~/project' ? '' : normalized.slice('~/project/'.length)
  return isSafeRelativePath(relative) ? {ok: true, value: normalizeDirectory(relative)} : {ok: false}
}

function normalizeDirectory(value: string): string {
  return normalizePath(value)
    .split('/')
    .filter((part) => part && part !== '.')
    .join('/')
}

function resolveDirectory(base: string, target: string): string | undefined {
  if (!isSafeRelativePath(target)) return undefined
  const normalizedBase = normalizeDirectory(base)
  const normalizedTarget = normalizeDirectory(target)
  return [normalizedBase, normalizedTarget].filter(Boolean).join('/')
}

function isSafeRelativePath(value: string): boolean {
  const normalized = normalizePath(value.trim())
  if (!normalized || normalized === '.') return true
  if (
    isDynamic(normalized) ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith('~/')
  ) {
    return false
  }
  return !normalized.split('/').includes('..')
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function isKnownOsvWorkflow(uses: string): boolean {
  return /^google\/osv-scanner\/\.github\/workflows\/osv-scanner-reusable(?:-pr)?\.yml@[^\s]+$/i.test(uses)
}

function isDisabled(value: unknown): boolean {
  return value === false || (typeof value === 'string' && /^(?:false|\$\{\{\s*false\s*\}\})$/i.test(value.trim()))
}

function isDynamic(value: string): boolean {
  return /\$|`|\{\{/.test(value)
}

function selectedOption(tokens: string[], names: string[]): {present: boolean; value?: string} {
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    for (const name of names) {
      if (token.toLowerCase() === name) return {present: true, value: tokens[index + 1]}
      if (token.toLowerCase().startsWith(`${name}=`)) {
        return {present: true, value: token.slice(name.length + 1)}
      }
    }
  }
  return {present: false}
}

function isUsableOptionValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0 && !value.startsWith('-')
}

function hasHelpOrVersion(tokens: string[]): boolean {
  return tokens.some((token) => ['--help', '--version', '-h', '-v'].includes(token.toLowerCase()))
}

function firstExecutable(tokens: string[]): string | undefined {
  return tokens.find((token) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))?.toLowerCase()
}

/** Split only sequential basic shell statements. Conditional operators and ambiguous comments are unsupported. */
function splitShell(command: string): ParsedShell {
  const segments: string[] = []
  let current = ''
  let quote: string | undefined
  let escaped = false
  let comment = false
  for (const character of command) {
    if (comment) {
      if (character === '\\') return {ok: false}
      if (character === '\n') comment = false
      else continue
    }
    if (escaped) {
      if (character !== '\n') return {ok: false}
      escaped = false
      continue
    }
    if (character === '\\' && quote !== "'") {
      escaped = true
      continue
    }
    if (quote) {
      current += character
      if (character === quote) quote = undefined
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      current += character
      continue
    }
    if (character === '#' && (current.length === 0 || /\s/.test(current.at(-1)!))) {
      comment = true
      continue
    }
    // Redirections, heredocs, subshells, and function bodies require a shell interpreter.
    if ('|&<>(){}'.includes(character)) return {ok: false}
    if (character === '\n' || character === ';') {
      if (current.trim()) segments.push(current.trim())
      current = ''
      continue
    }
    current += character
  }
  if (quote || escaped) return {ok: false}
  if (current.trim()) segments.push(current.trim())
  return {ok: true, segments}
}

function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: string | undefined
  let escaped = false
  for (const character of command) {
    if (escaped) {
      current += character
      escaped = false
    } else if (character === '\\' && quote !== "'") {
      escaped = true
    } else if (quote) {
      if (character === quote) quote = undefined
      else current += character
    } else if (character === "'" || character === '"') {
      quote = character
    } else if (/\s/.test(character)) {
      if (current) tokens.push(current)
      current = ''
    } else {
      current += character
    }
  }
  if (current) tokens.push(current)
  return tokens
}

function combine(left: Analysis, right: Analysis): Analysis {
  return {recognized: left.recognized || right.recognized, obstacles: [...left.obstacles, ...right.obstacles]}
}

function evidence(): Analysis {
  return {recognized: true, obstacles: []}
}

function obstacle(reason: string): Analysis {
  return {recognized: false, obstacles: [reason]}
}

function noEvidence(): Analysis {
  return {recognized: false, obstacles: []}
}
