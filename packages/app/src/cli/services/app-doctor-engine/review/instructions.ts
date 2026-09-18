/**
 * Standalone agent instructions builder.
 *
 * Pure: takes an already resolved context, review scopes, and the embedded
 * check catalogue, and returns the markdown plus the structured data it was
 * rendered from. No filesystem access, no printing, and no shell knowledge:
 * the caller injects the quoting function for the shell it prints to.
 */
import {encodeAppDoctorReviewBinding} from './binding.js'
import {describeAppDoctorAgentFindingsDocument} from './findings.js'
import {EMBEDDED_APP_DOCTOR_INSTRUCTIONS} from '../checks/embedded.js'
import {compareStrings} from '../context/ordering.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {AppDoctorReviewBinding} from './binding.js'
import type {Check} from '../checks/index.js'
import type {AppDoctorContext} from '../context/types.js'
import type {AppDoctorReviewScope} from '../scopes/types.js'

export interface AppDoctorInstructionsInput {
  readonly context: AppDoctorContext
  readonly scopes: ReadonlyArray<AppDoctorReviewScope>
  readonly checks: ReadonlyArray<Check>
  /** Shell-quotes one argument for the shell the instructions will be pasted into. */
  readonly quote: (value: string) => string
  readonly engine: {readonly name: string; readonly version: string}
}

export interface AppDoctorInstructionsCommand {
  readonly command: 'shopify'
  readonly args: ReadonlyArray<string>
}

export interface AppDoctorInstructionsScope {
  readonly scope_identity: string
  readonly directory: string
  readonly token: string
  readonly record_command: AppDoctorInstructionsCommand
  /** Suggested location for the agent's findings document; any absolute path passed to `--findings` works. */
  readonly findings_path: string
}

export interface AppDoctorInstructionsCheck {
  readonly id: string
  readonly version: number
  readonly prompt_hash: string
  readonly prompt: string
}

export interface AppDoctorInstructions {
  readonly markdown: string
  readonly scopes: ReadonlyArray<AppDoctorInstructionsScope>
  readonly checks: ReadonlyArray<AppDoctorInstructionsCheck>
}

const FINDINGS_FILE_NAME_DIGITS = 16
const PLACEHOLDERS = {
  reviewScopes: '{{REVIEW_SCOPES}}',
  checks: '{{CHECKS}}',
  findingsDocument: '{{FINDINGS_DOCUMENT}}',
} as const

/** `sha256:<hex>` → the first 16 hex digits, enough to keep sibling scope files distinct and short. */
function findingsFileName(scopeIdentity: string): string {
  const digest = scopeIdentity.slice(scopeIdentity.indexOf(':') + 1)
  return `${digest.slice(0, FINDINGS_FILE_NAME_DIGITS)}.json`
}

function sortChecks(checks: ReadonlyArray<Check>): AppDoctorInstructionsCheck[] {
  return [...checks]
    .sort((left, right) => compareStrings(left.id, right.id))
    .map((check) => ({id: check.id, version: check.version, prompt_hash: check.prompt_hash, prompt: check.prompt}))
}

function buildScope(
  input: AppDoctorInstructionsInput,
  checks: ReadonlyArray<AppDoctorInstructionsCheck>,
  scope: AppDoctorReviewScope,
): AppDoctorInstructionsScope {
  const binding: AppDoctorReviewBinding = {
    version: 1,
    configuration_identity: input.context.configurationIdentity,
    scope_identity: scope.scopeIdentity,
    scope: scope.descriptor,
    checks: checks.map((check) => ({id: check.id, version: check.version, prompt_hash: check.prompt_hash})),
    engine: input.engine,
  }
  const token = encodeAppDoctorReviewBinding(binding)
  const findingsPath = joinPath(
    input.context.appRoot,
    '.shopify',
    'app-doctor',
    'review',
    findingsFileName(scope.scopeIdentity),
  )
  return {
    scope_identity: scope.scopeIdentity,
    directory: scope.directory,
    token,
    record_command: {
      command: 'shopify',
      args: [
        'app',
        'doctor',
        'record',
        '--path',
        input.context.appRoot,
        '--config',
        input.context.configurationFileName,
        '--review',
        token,
        '--findings',
        findingsPath,
      ],
    },
    findings_path: findingsPath,
  }
}

/** Every command here is `shopify app doctor <subcommand> --flag value ...`: the fixed words before the first flag. */
const COMMAND_WORD_COUNT = 4

/**
 * Command words and flags are printed as-is; only their values are shell-quoted.
 * The command prefix is recognised by position rather than by matching known
 * words, so a value that happens to equal a command word is still quoted.
 */
function formatCommand(command: AppDoctorInstructionsCommand, quote: (value: string) => string): string {
  return [command.command, ...command.args]
    .map((argument, index) => (index < COMMAND_WORD_COUNT || argument.startsWith('--') ? argument : quote(argument)))
    .join(' ')
}

function describeBoundary(scope: AppDoctorReviewScope): string {
  if (scope.isAppRoot) return 'the app root'
  return scope.descriptor.boundary.app === 'inside' ? 'inside the app' : 'outside the app'
}

function renderScope(
  input: AppDoctorInstructionsInput,
  scope: AppDoctorInstructionsScope,
  reviewScope: AppDoctorReviewScope,
  position: number,
  total: number,
): string {
  return `### Scope ${position} of ${total}

- Directory: \`${scope.directory}\` (${describeBoundary(reviewScope)})
- Scope identity: \`${scope.scope_identity}\`
- Findings document: \`${scope.findings_path}\`
- Record command (copy verbatim; the \`--review\` token is opaque and must not be edited):

\`\`\`bash
${formatCommand(scope.record_command, input.quote)}
\`\`\``
}

function renderScopes(input: AppDoctorInstructionsInput, scopes: ReadonlyArray<AppDoctorInstructionsScope>): string {
  const statusCommand: AppDoctorInstructionsCommand = {
    command: 'shopify',
    args: ['app', 'doctor', 'status', '--path', input.context.appRoot, '--config', input.context.configurationFileName],
  }
  const rendered = scopes.map((scope, index) =>
    renderScope(input, scope, input.scopes[index]!, index + 1, scopes.length),
  )
  return `Configuration: \`${input.context.configurationPath}\`

${rendered.join('\n\n')}

After recording every scope, read the recorded results with:

\`\`\`bash
${formatCommand(statusCommand, input.quote)}
\`\`\``
}

/** A fence one backtick longer than any run inside the prompt keeps the prompt verbatim and unambiguous. */
function fenceFor(content: string): string {
  const longestRun = Math.max(0, ...[...content.matchAll(/`+/g)].map((match) => match[0].length))
  return '`'.repeat(Math.max(3, longestRun + 1))
}

function renderCheck(check: AppDoctorInstructionsCheck): string {
  const fence = fenceFor(check.prompt)
  return `### ${check.id}

- Version: ${check.version}
- Prompt hash: \`${check.prompt_hash}\`

${fence}markdown
${check.prompt}
${fence}`
}

export function buildAppDoctorInstructions(input: AppDoctorInstructionsInput): AppDoctorInstructions {
  const checks = sortChecks(input.checks)
  const scopes = input.scopes.map((scope) => buildScope(input, checks, scope))
  const markdown = EMBEDDED_APP_DOCTOR_INSTRUCTIONS.replace(PLACEHOLDERS.reviewScopes, () =>
    renderScopes(input, scopes),
  )
    .replace(PLACEHOLDERS.checks, () => checks.map(renderCheck).join('\n\n'))
    .replace(PLACEHOLDERS.findingsDocument, () => describeAppDoctorAgentFindingsDocument())
    .trimEnd()
  return {markdown, scopes, checks}
}
