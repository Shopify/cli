import {resolveAppSecurityRoot} from './app-security-api.js'
import {appSecurityArtifactPaths, readAgentFindings, readDeterministicFindings} from './app-security-artifacts.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {securityReviewJsonOutputSchema} from './security-review-json.js'
import {timeAgo} from '@shopify/cli-kit/common/string'
import {outputResult} from '@shopify/cli-kit/node/output'
import type {AppSecurityCommand} from './app-security-commands.js'
import type {ReadArtifactResult} from './app-security-artifacts.js'
import type {AgentFindingsArtifact, DeterministicFindingsDocument} from './app-security-engine/index.js'

interface SecurityReviewOptions {
  directory: string
  json: boolean
}

export interface SecurityReviewDependencies {
  resolveRoot(directory: string): string
  readDeterministicFindings(path: string): Promise<ReadArtifactResult<DeterministicFindingsDocument>>
  readAgentFindings(path: string): Promise<ReadArtifactResult<AgentFindingsArtifact>>
  output(content: string): void
  now(): Date
}

const defaultDependencies: SecurityReviewDependencies = {
  resolveRoot: resolveAppSecurityRoot,
  readDeterministicFindings,
  readAgentFindings,
  output: outputResult,
  now: () => new Date(),
}

interface ArtifactSection<T> {
  title: string
  path: string
  result: ReadArtifactResult<T>
  /** The timestamp that the section's age is measured from, such as `generated_at`. */
  timestamp(value: T): string
  timestampVerb: string
  producer: AppSecurityCommand
}

function formatAge(timestamp: string, now: Date): string {
  const time = Date.parse(timestamp)
  if (Number.isNaN(time)) return 'at an unknown time'
  return timeAgo(new Date(time), now)
}

function formatSection<T>(section: ArtifactSection<T>, now: Date): string {
  const {result} = section
  if (result.status === 'missing') {
    return `${section.title}: ${section.path}\nnot found — run \`${formatAppSecurityCommand(section.producer)}\``
  }
  if (result.status === 'invalid') {
    return `${section.title}: ${section.path}\ninvalid — ${result.message}`
  }
  const age = formatAge(section.timestamp(result.value), now)
  return `${section.title}: ${section.path} (${section.timestampVerb} ${age})\n${JSON.stringify(result.value, null, 2)}`
}

// Typed as a plain object literal so the artifact interfaces fit the schema's open-ended shape.
function valueOrNull(result: ReadArtifactResult<{schema_version: number}>): {schema_version: number} | null {
  return result.status === 'ok' ? result.value : null
}

/**
 * Prints the stored scan and agent findings as they are. The two files are independent: they're
 * never compared, and neither is expected to match the other or the current source.
 */
export default async function securityReview(
  options: SecurityReviewOptions,
  dependencies: SecurityReviewDependencies = defaultDependencies,
): Promise<void> {
  const appRoot = dependencies.resolveRoot(options.directory)
  const paths = appSecurityArtifactPaths(appRoot)
  const [scan, agentFindings] = await Promise.all([
    dependencies.readDeterministicFindings(paths.deterministicFindingsPath),
    dependencies.readAgentFindings(paths.agentFindingsPath),
  ])

  if (options.json) {
    dependencies.output(
      securityReviewJsonOutputSchema.encode({
        deterministic_findings: valueOrNull(scan),
        agent_findings: valueOrNull(agentFindings),
      }),
    )
    return
  }

  const commands = resolveAppSecurityCommands(appRoot)
  const now = dependencies.now()
  const sections = [
    formatSection(
      {
        title: 'Deterministic findings',
        path: paths.deterministicFindingsPath,
        result: scan,
        timestamp: (value) => value.generated_at,
        timestampVerb: 'generated',
        producer: commands.scan,
      },
      now,
    ),
    formatSection(
      {
        title: 'Agent findings',
        path: paths.agentFindingsPath,
        result: agentFindings,
        timestamp: (value) => value.recorded_at,
        timestampVerb: 'recorded',
        producer: commands.record,
      },
      now,
    ),
  ]
  dependencies.output(sections.join('\n\n'))
}
