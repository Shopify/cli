import {runThemeCheck} from '../theme-check.js'
import {themeExtensionFiles} from '../../../utilities/extensions/theme.js'
import {
  allowedSourceFor,
  declaredAllowedSources,
  findOutboundOrigins,
  type OutboundFinding,
} from '../../../utilities/extensions/theme-egress.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {relativePath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

const EGRESS_SCANNED_FILE_EXTENSIONS = ['.liquid', '.js', '.mjs', '.css']
const ALLOWED_SOURCES_TABLE = 'capabilities.network_access.allowed_sources'

/**
 * Executes a build_theme build step.
 *
 * Runs theme check on the extension directory and writes any offenses to stdout, then warns about origins the
 * extension contacts without declaring them. Neither fails the build.
 */
export async function executeBuildThemeStep(_step: LifecycleStep, context: BuildContext): Promise<void> {
  const {extension, options} = context
  options.stdout.write(`Running theme check on your Theme app extension...`)
  const offenses = await runThemeCheck(extension.directory)
  if (offenses) options.stdout.write(offenses)
  await warnAboutUndeclaredOrigins(context)
}

/**
 * Warns when the extension loads from or sends requests to origins that `allowed_sources` doesn't cover.
 *
 * This is advisory only. When storefronts enforce the declared origins, blocking deploys belongs in the theme
 * specification's `preDeployValidation`, using the same detector.
 */
async function warnAboutUndeclaredOrigins({extension, options}: BuildContext): Promise<void> {
  try {
    const allowedSources = declaredAllowedSources(extension.configuration.capabilities)
    const paths = (await themeExtensionFiles(extension.directory)).filter((path) =>
      EGRESS_SCANNED_FILE_EXTENSIONS.some((fileExtension) => path.endsWith(fileExtension)),
    )
    const files = await Promise.all(
      paths.map(async (path) => ({path: relativePath(extension.directory, path), content: await readFile(path)})),
    )
    // Navigation (links, form actions, redirects) isn't covered by allowed_sources, so it isn't reported here.
    const egress = findOutboundOrigins(files, allowedSources).findings.filter((finding) => finding.kind === 'egress')
    const message = undeclaredOriginsMessage(egress, allowedSources !== undefined)
    if (message) options.stdout.write(message)
    // The warning must never fail a build or deploy.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`Skipped the check for undeclared network origins: ${error instanceof Error ? error.message : error}`)
  }
}

function undeclaredOriginsMessage(findings: OutboundFinding[], declared: boolean): string | undefined {
  const byOrigin = new Map<string, OutboundFinding[]>()
  for (const finding of findings) {
    if (finding.status !== 'undeclared' || !finding.origin) continue
    byOrigin.set(finding.origin, [...(byOrigin.get(finding.origin) ?? []), finding])
  }

  // Extensions that don't declare allowed_sources get one line, not one per origin.
  if (!declared) {
    if (byOrigin.size === 0) return undefined
    const origins = byOrigin.size === 1 ? '1 external origin' : `${byOrigin.size} external origins`
    return `\n[info]: This extension contacts ${origins}. Consider declaring them in ${ALLOWED_SOURCES_TABLE} in shopify.extension.toml.`
  }

  const dynamic = findings.filter((finding) => finding.status === 'dynamic')
  if (byOrigin.size === 0 && dynamic.length === 0) return undefined
  const lines = [...byOrigin.entries()].map(([origin, occurrences]) => {
    const entry = allowedSourceFor(origin)
    let reason = "isn't in allowed_sources."
    if (occurrences[0]!.insecure) reason = 'uses an insecure scheme. allowed_sources accepts only HTTPS origins.'
    else if (entry !== origin) reason = `isn't in allowed_sources. Declare it as ${entry}.`
    return `[warning]: ${origin} (${locations(occurrences)}) ${reason}`
  })
  if (byOrigin.size > 0) {
    lines.push(
      `Add the origins your extension needs to ${ALLOWED_SOURCES_TABLE} in shopify.extension.toml. Requests to undeclared origins may be blocked on storefronts in the future.`,
    )
  }
  if (dynamic.length > 0) {
    const requests = dynamic.length === 1 ? '1 URL is' : `${dynamic.length} URLs are`
    lines.push(`[info]: ${requests} built at runtime and can't be checked (${locations(dynamic)}).`)
  }
  return `\n${lines.join('\n')}`
}

function locations(findings: OutboundFinding[]): string {
  const [first, ...rest] = findings.map((finding) => `${finding.file}:${finding.line}`)
  return rest.length === 0 ? first! : `${first} and ${rest.length} more`
}
