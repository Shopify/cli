import {readOptionalRepositoryFile} from '../scanners/discover.js'
import {dirname, isAbsolutePath, joinPath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
// eslint-disable-next-line no-restricted-imports -- cli-kit's executor merges process.env, which violates this audit boundary.
import {spawn} from 'node:child_process'
import {tmpdir} from 'node:os'
import {lstat, mkdir, mkdtemp, rm, unlink, writeFile} from 'node:fs/promises'
import type {Issue, Severity} from '../types.js'
import type {AuditCommandResult, AuditExecutor, ManifestFile} from './types.js'

export type {AuditExecutor} from './types.js'

interface DependencyAuditResult {
  issues: Issue[]
  unresolvedReason?: string
  inspectedFiles: string[]
}

interface AuditSelection {
  command: 'npm' | 'pnpm' | 'yarn' | 'corepack'
  args: string[]
  outputFormat: 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry'
  lockfile: string
  packageManager?: string
}

const PATH_DELIMITER = process.platform === 'win32' ? ';' : ':'
const defaultExecutor: AuditExecutor = (command, args, options) =>
  new Promise((resolve, reject) => {
    // cli-kit's general executor intentionally inherits process.env. Audits require an exact environment boundary.
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      signal: options.signal,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (exitCode) => resolve({stdout, stderr, exitCode: exitCode ?? 1}))
  })
const TRUSTED_REGISTRY = 'https://registry.npmjs.org/'
const LOCKFILE_MANAGERS = new Map<string, 'npm' | 'pnpm' | 'yarn'>([
  ['package-lock.json', 'npm'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
])

export async function auditKnownCves(
  appRoot: string,
  manifests: ManifestFile[],
  executor: AuditExecutor = defaultExecutor,
  timeoutMilliseconds = 15_000,
): Promise<DependencyAuditResult> {
  const packageManifest = manifests.find((manifest) => manifest.path === 'package.json')
  if (!packageManifest)
    return {issues: [], unresolvedReason: 'No root JavaScript package.json was available.', inspectedFiles: []}

  const lockfileContents = new Map<string, Buffer>()
  for (const path of LOCKFILE_MANAGERS.keys()) {
    const result = readOptionalRepositoryFile(appRoot, joinPath(appRoot, path))
    if (result.ok) lockfileContents.set(path, result.content)
  }
  const lockfiles = [...lockfileContents.keys()]
  if (lockfiles.length === 0)
    return {
      issues: [],
      unresolvedReason: 'No supported JavaScript lockfile was found.',
      inspectedFiles: ['package.json'],
    }

  const selection = selectPackageManager(lockfiles, packageManifest.packageManager)
  if ('error' in selection)
    return {issues: [], unresolvedReason: selection.error, inspectedFiles: ['package.json', ...lockfiles]}
  const inspectedFiles = ['package.json', selection.lockfile]
  const selectedLockfile = lockfileContents.get(selection.lockfile)!

  let sandbox: AuditSandbox
  try {
    sandbox = await createAuditSandbox(
      appRoot,
      packageManifest,
      selection.lockfile,
      selectedLockfile,
      selection.packageManager,
    )
    // Sandbox setup failures are expected coverage gaps, never a reason to fall back to the app root.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      issues: [],
      unresolvedReason: `Dependency audit sandbox could not be created: ${redactAuditText(error instanceof Error ? error.message : String(error))}`,
      inspectedFiles,
    }
  }

  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = Symbol('audit-timeout')
  const timeoutPromise = new Promise<typeof timedOut>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort()
      resolve(timedOut)
    }, timeoutMilliseconds)
  })

  let execution: AuditCommandResult | typeof timedOut
  try {
    execution = await Promise.race([
      executor(selection.command, auditArguments(selection, sandbox.userConfigPath), {
        cwd: sandbox.workspace,
        signal: controller.signal,
        env: auditEnvironment(appRoot, sandbox),
      }),
      timeoutPromise,
    ])
    // Command absence, network failures, and aborts are expected audit outcomes.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      issues: [],
      unresolvedReason: `Dependency audit could not run: ${redactAuditText(error instanceof Error ? error.message : String(error))}`,
      inspectedFiles,
    }
  } finally {
    if (timeout) clearTimeout(timeout)
    await removeAuditSandbox(sandbox.root)
  }

  if (execution === timedOut) return {issues: [], unresolvedReason: 'Dependency audit timed out.', inspectedFiles}

  const parsed = parseAuditOutput(execution.stdout, selection.outputFormat)
  if (!parsed) {
    const operationalMessage = redactAuditText(execution.stderr || execution.stdout).slice(0, 240)
    return {
      issues: [],
      unresolvedReason: `Dependency audit returned unusable output${operationalMessage ? `: ${operationalMessage}` : '.'}`,
      inspectedFiles,
    }
  }
  if (execution.exitCode !== 0 && parsed.length === 0)
    return {issues: [], unresolvedReason: 'Dependency audit failed operationally.', inspectedFiles}

  return {
    issues: parsed.map((advisory) => {
      const packageName = redactAuditText(advisory.packageName).slice(0, 160)
      const classification = classifySeverity(advisory.severity)
      return {
        id: 'KNOWN_CVE_IN_DEPENDENCY',
        severity: classification.severity,
        points: classification.points,
        title: 'Known CVE in dependency',
        message: `${packageName} has a ${advisory.severity} vulnerability reported by the package-manager audit.`,
        location: {file: selection.lockfile},
        fix: {automated: false, description: 'Upgrade to a patched dependency version and regenerate the lockfile.'},
      }
    }),
    inspectedFiles,
  }
}

export function parseAuditOutput(
  output: string,
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'yarn-classic' | 'yarn-berry' | string,
): {packageName: string; severity: string}[] | null {
  const trimmed = output.trim()
  if (!trimmed) return null
  try {
    if (packageManager === 'yarn-berry' && trimmed.includes('\n')) {
      try {
        return trimmed.split('\n').flatMap((line) => berryAdvisories(JSON.parse(line)))
        // Parsing each JSON line is speculative because pretty-printed JSON also contains newlines.
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // Fall through to the normal single-document parser.
      }
    }
    if (packageManager === 'yarn' || packageManager === 'yarn-classic') {
      const records = trimmed.split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
      const recognized = records.some((record) => record.type === 'auditAdvisory' || record.type === 'auditSummary')
      if (!recognized) return null
      return records.flatMap((record) => {
        if (record.type !== 'auditAdvisory') return []
        const data = record.data as {advisory?: {module_name?: string; severity?: string}}
        const advisory = data.advisory
        return advisory?.module_name
          ? [{packageName: advisory.module_name, severity: advisory.severity ?? 'unknown'}]
          : []
      })
    }

    const report = JSON.parse(trimmed) as {
      error?: unknown
      vulnerabilities?: Record<string, {severity?: string}>
      advisories?: Record<string, {module_name?: string; severity?: string}>
      metadata?: {vulnerabilities?: Record<string, number>}
      children?: unknown
    }
    if (report.error) return null
    if (report.vulnerabilities)
      return Object.entries(report.vulnerabilities).map(([packageName, vulnerability]) => ({
        packageName,
        severity: vulnerability.severity ?? 'unknown',
      }))
    if (report.advisories)
      return Object.values(report.advisories).flatMap((advisory) =>
        advisory.module_name ? [{packageName: advisory.module_name, severity: advisory.severity ?? 'unknown'}] : [],
      )
    if (report.children) return berryAdvisories(report)
    if (report.metadata?.vulnerabilities) return []
    return null
    // Audit tools emit malformed or partial JSON on operational failures.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return null
  }
}

function berryAdvisories(value: unknown, inheritedName?: string): {packageName: string; severity: string}[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item) => berryAdvisories(item, inheritedName))

  const node = value as Record<string, unknown>
  const nodeName = [node.ident, node.value, node.name, inheritedName].find(
    (candidate): candidate is string => typeof candidate === 'string',
  )
  const children = node.children && typeof node.children === 'object' ? (node.children as Record<string, unknown>) : {}
  const severity = [node.severity, node.Severity, children.Severity].find(
    (candidate): candidate is string => typeof candidate === 'string',
  )
  const current = severity && nodeName ? [{packageName: nodeName, severity}] : []
  const descendants = Object.entries(children).flatMap(([name, child]) =>
    name === 'Severity' ? [] : berryAdvisories(child, name),
  )
  return [...current, ...descendants]
}

function classifySeverity(value: string): {severity: Severity; points: number} {
  switch (value.toLowerCase()) {
    case 'critical':
    case 'high':
      return {severity: 'high', points: -20}
    case 'moderate':
    case 'medium':
      return {severity: 'medium', points: -10}
    case 'low':
    case 'info':
      return {severity: 'low', points: -5}
    default:
      return {severity: 'medium', points: -10}
  }
}

function selectPackageManager(lockfiles: string[], declaration?: string): AuditSelection | {error: string} {
  const managers = new Set(lockfiles.map((lockfile) => LOCKFILE_MANAGERS.get(lockfile)!))
  const declared = declaration?.split('@')[0]
  if (declared && !['npm', 'pnpm', 'yarn'].includes(declared))
    return {error: `Unsupported packageManager declaration: ${declared}.`}
  if (declared && !managers.has(declared as 'npm' | 'pnpm' | 'yarn'))
    return {error: 'packageManager conflicts with the available lockfile.'}
  if (!declared && managers.size !== 1)
    return {error: 'Multiple package-manager lockfiles make audit selection ambiguous.'}

  const command = (declared ?? [...managers][0]) as 'npm' | 'pnpm' | 'yarn'
  const lockfile = [...LOCKFILE_MANAGERS].find(([, manager]) => manager === command)?.[0]
  if (!lockfile || !lockfiles.includes(lockfile))
    return {error: 'The selected package manager has no matching lockfile.'}
  if (command === 'npm') return {command, args: ['audit', '--json'], outputFormat: 'npm', lockfile}
  if (command === 'pnpm') return {command, args: ['audit', '--json'], outputFormat: 'pnpm', lockfile}
  const berry = /^yarn@((?:[2-9]|\d{2,})\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(declaration ?? '')
  if (/^yarn@(?:[2-9]|\d{2,})(?:\.|$)/.test(declaration ?? '') && !berry)
    return {error: 'Yarn Berry packageManager must declare an exact supported version.'}
  return berry
    ? {
        command: 'corepack',
        args: [`yarn@${berry[1]}`, 'npm', 'audit', '--all', '--json'],
        outputFormat: 'yarn-berry',
        lockfile,
        packageManager: declaration,
      }
    : {command, args: ['audit', '--json'], outputFormat: 'yarn-classic', lockfile}
}

interface AuditSandbox {
  root: string
  workspace: string
  home: string
  temporaryDirectory: string
  cache: string
  userConfigPath: string
  globalConfigPath: string
}

function isWithin(root: string, path: string): boolean {
  const relative = relativePath(root, path)
  return relative === '' || (!relative.startsWith('../') && relative !== '..' && !isAbsolutePath(relative))
}

function sanitizedPath(appRoot: string): string | undefined {
  const value = process.env.PATH
  if (!value) return undefined
  return value
    .split(PATH_DELIMITER)
    .filter((entry) => {
      if (!entry || !isAbsolutePath(entry)) return false
      const absoluteEntry = resolvePath(entry)
      const normalizedEntry = absoluteEntry.replace(/\\/g, '/')
      return !isWithin(appRoot, absoluteEntry) && !normalizedEntry.includes('/node_modules/.bin')
    })
    .join(PATH_DELIMITER)
}

function isRegistryDependency(name: string, specification: string): boolean {
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) return false
  if (
    specification.startsWith('.') ||
    specification.startsWith('/') ||
    specification.includes('\\') ||
    specification.includes(':') ||
    specification.includes('://') ||
    /^(?:file|link|portal|patch|workspace|git|ssh|github|gitlab|bitbucket):/i.test(specification)
  )
    return false
  // Bare owner/repository shorthands resolve through a forge rather than the forced npm registry.
  return !specification.includes('/')
}

function sanitizedDependencies(value: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string' && isRegistryDependency(entry[0], entry[1]),
    ),
  )
}

async function createAuditSandbox(
  appRoot: string,
  manifest: ManifestFile,
  lockfile: string,
  lockfileContent: Buffer,
  packageManager?: string,
): Promise<AuditSandbox> {
  const systemTemporaryDirectory = resolvePath(tmpdir())
  const parent = isWithin(appRoot, systemTemporaryDirectory) ? dirname(appRoot) : systemTemporaryDirectory
  const root = await mkdtemp(joinPath(parent, 'shopify-app-doctor-audit-'))
  try {
    const workspace = joinPath(root, 'workspace')
    const home = joinPath(root, 'home')
    const temporaryDirectory = joinPath(root, 'tmp')
    const cache = joinPath(root, 'cache')
    const userConfigPath = joinPath(root, 'empty-user-config')
    const globalConfigPath = joinPath(root, 'empty-global-config')
    await Promise.all([
      mkdir(workspace, {mode: 0o700}),
      mkdir(home, {mode: 0o700}),
      mkdir(temporaryDirectory, {mode: 0o700}),
      mkdir(cache, {mode: 0o700}),
    ])
    const packageJson = JSON.stringify({
      name: 'shopify-app-doctor-audit',
      version: '0.0.0',
      private: true,
      ...(packageManager ? {packageManager} : {}),
      dependencies: sanitizedDependencies(manifest.dependencies),
      devDependencies: sanitizedDependencies(manifest.devDependencies),
    })
    await Promise.all([
      writeFile(joinPath(workspace, 'package.json'), packageJson, {mode: 0o600}),
      writeFile(joinPath(workspace, lockfile), lockfileContent, {mode: 0o600}),
      writeFile(userConfigPath, '', {mode: 0o600}),
      writeFile(globalConfigPath, '', {mode: 0o600}),
      writeFile(
        joinPath(workspace, '.app-doctor-yarnrc.yml'),
        `enableScripts: false\nenableTelemetry: false\nnpmRegistryServer: "${TRUSTED_REGISTRY}"\n`,
        {mode: 0o600},
      ),
    ])
    return {root, workspace, home, temporaryDirectory, cache, userConfigPath, globalConfigPath}
  } catch (error) {
    // Never strand a partially initialized sandbox after a filesystem failure.
    await removeAuditSandbox(root)
    throw error
  }
}

async function removeAuditSandbox(root: string): Promise<void> {
  try {
    const stats = await lstat(root)
    if (stats.isSymbolicLink() || !stats.isDirectory()) await unlink(root)
    else await rm(root, {recursive: true, force: true})
    // Cleanup is best-effort and must not hide an audit result.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // The unique private directory is already absent or became unverifiable.
  }
}

function auditArguments(selection: AuditSelection, userConfigPath: string): string[] {
  if (selection.command === 'npm')
    return [
      ...selection.args,
      '--ignore-scripts',
      `--registry=${TRUSTED_REGISTRY}`,
      `--userconfig=${userConfigPath}`,
      '--no-color',
    ]
  if (selection.command === 'pnpm')
    return [
      ...selection.args,
      '--config.ignore-scripts=true',
      `--config.registry=${TRUSTED_REGISTRY}`,
      `--config.userconfig=${userConfigPath}`,
      '--color=false',
    ]
  if (selection.outputFormat === 'yarn-classic')
    return [
      ...selection.args,
      '--ignore-scripts',
      '--no-default-rc',
      '--non-interactive',
      '--no-progress',
      '--registry',
      TRUSTED_REGISTRY,
    ]
  return selection.args
}

function auditEnvironment(appRoot: string, sandbox: AuditSandbox): Record<string, string | undefined> {
  const executionEnvironment = Object.fromEntries(
    ['PATHEXT', 'SystemRoot', 'COMSPEC', 'WINDIR'].flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]]],
    ),
  )
  return {
    ...executionEnvironment,
    PATH: sanitizedPath(appRoot),
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    TMPDIR: sandbox.temporaryDirectory,
    TMP: sandbox.temporaryDirectory,
    TEMP: sandbox.temporaryDirectory,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    NPM_CONFIG_USERCONFIG: sandbox.userConfigPath,
    NPM_CONFIG_GLOBALCONFIG: sandbox.globalConfigPath,
    NPM_CONFIG_REGISTRY: TRUSTED_REGISTRY,
    NPM_CONFIG_IGNORE_SCRIPTS: 'true',
    NPM_CONFIG_FUND: 'false',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NPM_CONFIG_CACHE: sandbox.cache,
    YARN_RC_FILENAME: '.app-doctor-yarnrc.yml',
    YARN_IGNORE_PATH: '1',
    YARN_ENABLE_SCRIPTS: 'false',
    YARN_ENABLE_TELEMETRY: '0',
    YARN_NPM_REGISTRY_SERVER: TRUSTED_REGISTRY,
    YARN_CACHE_FOLDER: sandbox.cache,
    COREPACK_HOME: sandbox.cache,
    COREPACK_ENABLE_PROJECT_SPEC: '0',
    COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  }
}

function redactAuditText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/g, 'https://[redacted]@')
    .replace(/(_authToken|token|authorization)\s*[=:]\s*[^\s]+/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s]+/g, '[registry-url]')
}
