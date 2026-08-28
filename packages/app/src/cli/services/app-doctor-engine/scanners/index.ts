import {
  findAppRoot,
  findAppTomls,
  loadAppToml,
  findExtensions,
  findAppSourceFiles,
  resetSkippedFiles,
  getSkippedFiles,
  findManifests,
  findManifestPaths,
} from './discover.js'
import {detectCapabilities} from '../capabilities/detect.js'
import {calculateScore, computeScanMetadata} from '../scorer/index.js'

// Rules
import {deprecatedScriptTagScope, scopeOverRequest, insecureWebhookUrl} from '../rules/config-rules.js'
import {scanUnsafeInnerHTML} from '../rules/js-rules.js'
import {scanLiquidUnsafeRender, scanMissingSRI, scanExternalCdn} from '../rules/liquid-rules.js'
import {redactText, scanCommittedSecrets} from '../rules/secret-rules.js'
import {scanOutdatedShopifySdk, scanKnownCves} from '../rules/dependency-rules.js'
import {scanDeprecatedScriptTagApi} from '../rules/shopify-rules.js'
import {missingComplianceWebhooks, scanEolApiVersion} from '../rules/compliance-rules.js'
import {scanWeakShopValidation} from '../rules/validation-rules.js'
import {scanAppProxyLiquidInjection} from '../rules/proxy-rules.js'
import {scanExpiringOfflineTokens} from '../rules/token-rules.js'
import {scanTokenLeakage} from '../rules/additional-security-rules.js'
import {redactIssue} from '../trace/index.js'
import {getEngineVersion} from '../version.js'
import {readFileSync} from '@shopify/cli-kit/node/fs'
import {basename, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {captureOutputWithExitCode} from '@shopify/cli-kit/node/system'
import {createHash} from 'node:crypto'
import type {Rule, ScanContext} from '../rules/types.js'
import type {CheckExecution, ScanResult, Issue} from '../types.js'

const ALL_RULES: Rule[] = [deprecatedScriptTagScope, scopeOverRequest, insecureWebhookUrl, missingComplianceWebhooks]

const SCANNER_RULES = [
  {
    id: 'UNSAFE_INNERHTML',
    requires: 'theme_app_extension' as const,
    run: scanUnsafeInnerHTML,
  },
  {
    id: 'LIQUID_UNSAFE_RENDER',
    requires: 'theme_app_extension' as const,
    run: scanLiquidUnsafeRender,
  },
  {
    id: 'MISSING_SRI',
    requires: 'theme_app_extension' as const,
    run: scanMissingSRI,
  },
  {
    id: 'EXTERNAL_CDN_DEPENDENCY',
    requires: 'theme_app_extension' as const,
    run: scanExternalCdn,
  },
  {id: 'DEPRECATED_SCRIPT_TAG_API', run: scanDeprecatedScriptTagApi},
]

const DEPENDENCY_RULES = [
  {id: 'OUTDATED_SHOPIFY_SDK', run: scanOutdatedShopifySdk},
  {id: 'KNOWN_CVE_IN_DEPENDENCY', run: scanKnownCves},
]

const SECRET_RULES = [{id: 'COMMITTED_SECRET', run: scanCommittedSecrets}]

/** Authoritative deterministic rule registry. All versions are trace-contract versions. */
export const DETERMINISTIC_RULES = [
  ...ALL_RULES.map((rule) => ({
    id: rule.id,
    version: 1,
    requires: rule.requires,
  })),
  ...SCANNER_RULES.map((rule) => ({
    id: rule.id,
    version: 1,
    requires: rule.requires,
  })),
  ...DEPENDENCY_RULES.map((rule) => ({id: rule.id, version: 1})),
  ...SECRET_RULES.map((rule) => ({id: rule.id, version: 1})),
  {id: 'EXPIRING_OFFLINE_TOKEN', version: 1},
  {id: 'EOL_API_VERSION', version: 1},
  {id: 'TOKEN_LEAKAGE', version: 1},
  {id: 'WEAK_SHOP_VALIDATION', version: 1},
  {id: 'APP_PROXY_LIQUID_INJECTION', version: 1},
] as const

async function gitProject(appRoot: string): Promise<ScanResult['project']> {
  const run = async (args: string[]): Promise<string | null> => {
    const result = await captureOutputWithExitCode('git', args, {cwd: appRoot})
    return result.exitCode === 0 ? result.stdout.trim() : null
  }
  const commit = await run(['rev-parse', 'HEAD'])
  if (!commit) return {commit: null, dirty: null}
  const status = await run(['status', '--porcelain', '--untracked-files=normal'])
  return {commit, dirty: status === null ? null : status.length > 0}
}

export async function scan(startPath?: string): Promise<ScanResult> {
  const appRoot = findAppRoot(startPath)

  // Clear per-run skip state before discovery so the trace reports only the
  // files this scan declined to read.
  resetSkippedFiles()

  // Discover files
  const appTomls = findAppTomls(appRoot)
  const extensions = findExtensions(appRoot)
  const sourceFiles = findAppSourceFiles(appRoot)
  const manifestPaths = findManifestPaths(appRoot)
  const manifests = findManifests(appRoot, manifestPaths)

  // Use the first app TOML (or merge if multiple)
  const appToml = startPath?.endsWith('.toml') ? loadAppToml(startPath) : (appTomls[0] ?? null)

  // Detect capabilities
  const capabilities = detectCapabilities(appToml, extensions, sourceFiles)

  // Build scan context
  const ctx: ScanContext = {
    appRoot,
    appToml,
    extensions,
    sourceFiles,
    manifests,
    capabilities,
  }

  let issues: Issue[] = []
  let rulesRun = 0
  let rulesSkipped = 0
  const checksExecuted: CheckExecution[] = []
  const record = (id: string, status: 'executed' | 'skipped', before: number, reason?: string): void => {
    checksExecuted.push({
      id,
      version: 1,
      kind: 'rule',
      status,
      findings: status === 'executed' ? issues.length - before : 0,
      ...(reason ? {reason} : {}),
    })
  }

  // Run config-based rules
  for (const rule of ALL_RULES) {
    if (rule.requires && !capabilities[rule.requires]) {
      rulesSkipped++
      record(rule.id, 'skipped', issues.length, `requires capability ${rule.requires}`)
      continue
    }
    rulesRun++
    const before = issues.length
    issues.push(...rule.check(ctx))
    record(rule.id, 'executed', before)
  }

  // Run scanner-based rules
  for (const scanner of SCANNER_RULES) {
    if (scanner.requires && !capabilities[scanner.requires]) {
      rulesSkipped++
      record(scanner.id, 'skipped', issues.length, `requires capability ${scanner.requires}`)
      continue
    }
    rulesRun++
    const before = issues.length

    // Collect files to scan for this rule
    let filesToScan = sourceFiles
    if (scanner.requires === 'theme_app_extension') {
      filesToScan = extensions.flatMap((extension) => extension.files)
    }

    issues.push(...scanner.run(filesToScan))
    record(scanner.id, 'executed', before)
  }

  // Deduplicate: if MISSING_SRI already flagged a script tag on the same
  // file+line, drop the EXTERNAL_CDN_DEPENDENCY finding for that line.
  // Both rules fire on the same external <script> tag — one problem, one
  // deduction. MISSING_SRI is the more specific and more severe finding.
  const sriLines = new Set(
    issues.filter((i) => i.id === 'MISSING_SRI').map((i) => `${i.location.file}:${i.location.line ?? 0}`),
  )
  issues = issues.filter((i) => {
    if (i.id !== 'EXTERNAL_CDN_DEPENDENCY') return true
    const key = `${i.location.file}:${i.location.line ?? 0}`
    return !sriLines.has(key)
  })

  // Run dependency rules
  for (const depRule of DEPENDENCY_RULES) {
    rulesRun++
    const before = issues.length
    issues.push(...depRule.run(manifests))
    record(depRule.id, 'executed', before)
  }

  // Run secret rules
  for (const secretRule of SECRET_RULES) {
    rulesRun++
    const before = issues.length
    // Rules run in registry order so trace execution metadata stays deterministic.
    // eslint-disable-next-line no-await-in-loop
    issues.push(...(await secretRule.run(sourceFiles, appRoot)))
    record(secretRule.id, 'executed', before)
  }

  const runStandalone = (id: string, run: () => Issue[]): void => {
    rulesRun++
    const before = issues.length
    issues.push(...run())
    record(id, 'executed', before)
  }
  runStandalone('EXPIRING_OFFLINE_TOKEN', () => scanExpiringOfflineTokens(sourceFiles, appRoot))
  runStandalone('EOL_API_VERSION', () => scanEolApiVersion(sourceFiles, appRoot))
  runStandalone('TOKEN_LEAKAGE', () => scanTokenLeakage(sourceFiles))
  runStandalone('WEAK_SHOP_VALIDATION', () => scanWeakShopValidation(sourceFiles))
  runStandalone('APP_PROXY_LIQUID_INJECTION', () => scanAppProxyLiquidInjection(sourceFiles))

  // Safety net: some rules have mixed definite/needs_review paths (e.g.
  // UNSAFE_INNERHTML returns "definite" for request-controlled data but
  // "needs_review" for ambiguous cases). Only definite findings enter the
  // trace. Semantic questions are handled by the agentic review track
  // (app-doctor review), not by the static scanner.
  issues = issues.filter((i) => i.confidence !== 'needs_review').map(redactIssue)
  // Recompute counts after filtering and deduplication.
  for (const execution of checksExecuted)
    execution.findings = issues.filter((issue) => issue.id === execution.id).length

  // Calculate score
  const score = calculateScore(issues, capabilities)

  // Compute file hashes for integrity
  const fileHashes = sourceFiles.map((file): string | undefined => {
    if (file.content !== undefined) {
      return createHash('sha256').update(file.content).digest('hex')
    }
    try {
      return createHash('sha256').update(readFileSync(file.absolutePath)).digest('hex')
      // Discovery already records this file as unreadable. Never invent a hash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return undefined
    }
  })

  // Per-file map keyed by project-relative path, so a resolution can record
  // which bytes it was made against and be invalidated when they change.
  const fileHashMap: Record<string, string> = {}
  sourceFiles.forEach((file, index) => {
    const hash = fileHashes[index]
    if (hash) fileHashMap[redactText(file.path)] = `sha256:${hash}`
  })

  // Config files aren't in sourceFiles but many findings point at them
  // (scopes, API version, webhook URLs). Without their hashes those findings
  // can't be staleness-checked — which is exactly where it matters, since
  // editing scopes after attesting is the easy way to invalidate a claim.
  const configPaths = [
    ...appTomls.map((t) => t.path),
    ...extensions.map((extension) => joinPath(appRoot, extension.path)),
    ...manifestPaths.map((manifest) => joinPath(appRoot, manifest)),
  ]
  for (const absolute of configPaths) {
    if (!absolute) continue
    const projectRelativePath = redactText(relativePath(appRoot, absolute) || basename(absolute))
    if (fileHashMap[projectRelativePath]) continue
    try {
      fileHashMap[projectRelativePath] = `sha256:${createHash('sha256').update(readFileSync(absolute)).digest('hex')}`
      // Unreadable config files are omitted rather than assigned a bogus hash.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // Nothing else to do.
    }
  }

  const safeSkippedFiles = [
    ...new Map(
      getSkippedFiles().map((file) => {
        const safe = {
          ...file,
          path: redactText(file.path),
          ...(file.detail ? {detail: redactText(file.detail)} : {}),
        }
        return [`${safe.path}|${safe.reason}`, safe] as const
      }),
    ).values(),
  ]
  const scanMeta = computeScanMetadata(
    sourceFiles.filter((file) => file.content !== undefined).length,
    rulesRun,
    rulesSkipped,
    issues,
    score,
    fileHashMap,
    safeSkippedFiles,
    checksExecuted,
  )

  return {
    version: getEngineVersion(),
    timestamp: new Date().toISOString(),
    project: await gitProject(appRoot),
    app: {
      name: redactText(String(appToml?.raw.name ?? 'Unknown')),
      type: 'public',
    },
    capabilities,
    score,
    scan: scanMeta,
    issues,
  }
}
