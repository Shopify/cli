import {
  allowedSourceFor,
  declaredAllowedSources,
  findOutboundOrigins,
  type OutboundFinding,
} from '../../../utilities/extensions/theme-egress.js'
import {decodeToml} from '@shopify/cli-kit/node/toml/codec'
import type {Issue} from '../types.js'
import type {RunnerResult} from '../scanners/types.js'
import type {ExtensionInfo, ScanContext, SourceFile} from './types.js'

const CHECK_ID = 'THEME_EXTENSION_UNDECLARED_EGRESS'
export const THEME_EGRESS_FILE_EXTENSIONS = ['.liquid', '.html', '.js', '.mjs', '.css']
const ALLOWED_SOURCES_TABLE = 'capabilities.network_access.allowed_sources'
const LISTED_ORIGINS = 3

/**
 * Finds origins that theme app extensions load from or send requests to without declaring them in
 * `allowed_sources`. With the table declared, each undeclared origin is a finding where it's used. Without it, each
 * extension that contacts external origins gets one finding on its configuration. Navigation targets and URLs built
 * at runtime aren't findings.
 */
export function scanThemeExtensionUndeclaredEgress(context: ScanContext): RunnerResult {
  const issues: Issue[] = []
  const parserFailures: string[] = []
  for (const extension of context.extensions.filter((candidate) => candidate.type === 'theme')) {
    const files = extension.files.flatMap((file) =>
      file.content !== undefined && THEME_EGRESS_FILE_EXTENSIONS.includes(file.ext)
        ? [{path: file.path, content: file.content}]
        : [],
    )
    const allowedSources = declaredAllowedSources(extensionCapabilities(extension))
    const result = findOutboundOrigins(files, allowedSources)
    parserFailures.push(...result.parserFailures)
    const undeclared = result.findings.filter((finding) => finding.kind === 'egress' && finding.status === 'undeclared')
    if (allowedSources) issues.push(...undeclared.map((finding) => undeclaredOriginIssue(finding, extension.files)))
    else if (undeclared.length > 0) issues.push(undeclaredTableIssue(extension, undeclared))
  }
  return {
    issues,
    ...(parserFailures.length > 0 ? {unresolvedReason: `Liquid parser failed for: ${parserFailures.join(', ')}`} : {}),
  }
}

function extensionCapabilities(extension: ExtensionInfo): unknown {
  if (extension.content === undefined) return undefined
  // findExtensions already parsed this TOML successfully.
  return (decodeToml(extension.content) as {capabilities?: unknown}).capabilities
}

function undeclaredOriginIssue(finding: OutboundFinding, files: SourceFile[]): Issue {
  const origin = finding.origin!
  const content = files.find((file) => file.path === finding.file)?.content ?? ''
  return {
    id: CHECK_ID,
    pattern_id: finding.insecure ? 'insecure-origin' : 'undeclared-origin',
    severity: 'medium',
    points: -10,
    title: 'Theme app extension contacts an undeclared origin',
    message: finding.insecure
      ? `${finding.sink} contacts ${origin} over an insecure scheme. ${ALLOWED_SOURCES_TABLE} accepts only HTTPS origins, so this request can't be declared.`
      : `${finding.sink} contacts ${origin}, which isn't in the extension's ${ALLOWED_SOURCES_TABLE}.`,
    location: {file: finding.file, line: finding.line, column: finding.column},
    snippet: content.split('\n')[finding.line - 1]?.trim(),
    fix: {
      automated: false,
      description: finding.insecure
        ? 'Load the resource over HTTPS and declare its origin, or remove the request.'
        : `Add ${allowedSourceFor(origin) ?? origin} to ${ALLOWED_SOURCES_TABLE} in shopify.extension.toml, or remove the request.`,
    },
  }
}

function undeclaredTableIssue(extension: ExtensionInfo, findings: OutboundFinding[]): Issue {
  const origins = [...new Set(findings.map((finding) => finding.origin!))]
  const listed = origins.slice(0, LISTED_ORIGINS).join(', ')
  const more = origins.length > LISTED_ORIGINS ? ` and ${origins.length - LISTED_ORIGINS} more` : ''
  const count = origins.length === 1 ? '1 external origin' : `${origins.length} external origins`
  return {
    id: CHECK_ID,
    pattern_id: 'allowed-sources-not-declared',
    severity: 'medium',
    points: -10,
    title: 'Theme app extension contacts an undeclared origin',
    message: `The theme app extension contacts ${count} (${listed}${more}) but doesn't declare ${ALLOWED_SOURCES_TABLE}.`,
    location: {file: extension.path, line: 1, column: 1},
    fix: {
      automated: false,
      description: `Declare the HTTPS origins the extension needs in ${ALLOWED_SOURCES_TABLE} in shopify.extension.toml.`,
    },
  }
}
