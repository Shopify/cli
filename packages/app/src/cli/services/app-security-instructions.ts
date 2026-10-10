import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {
  formatAppSecurityCommand,
  formatAppSecurityInlineStdinCommand,
  quoteShellArgument,
  shellForPlatform,
  type AppSecurityCommand,
  type AppSecurityCommands,
  type AppSecurityShell,
} from './app-security-commands.js'
import {getAgentInstructions, type AppSecurityScope} from './app-security-engine/index.js'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import clipboard from 'clipboardy'

const SCAN_CONTEXT_PLACEHOLDER = '{{SCAN_CONTEXT}}'
const RECORD_DOCUMENT_PLACEHOLDER = '<the findings document from step 4>'
const CODE_FENCE_LANGUAGES: {[shell in AppSecurityShell]: string} = {
  posix: 'bash',
  powershell: 'powershell',
  cmd: 'bat',
}

interface AppSecurityInstructionPaths {
  commands: AppSecurityCommands
  scanCommand: string
  recordInstructions: string
  reviewCommand: string
  cleanCommand: string
  deterministicFindingsPath: string
  agentChecksPath: string
  agentFindingsPath: string
  resultsDirectory: string
}

export function shellQuote(
  value: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return quoteShellArgument(value, shellForPlatform(platform, env))
}

function markdownPath(value: string): string {
  const escaped = value.replace(/`/g, "'")
  return `\`${escaped}\``
}

function codeBlock(content: string, shell: AppSecurityShell): string {
  return `\`\`\`${CODE_FENCE_LANGUAGES[shell]}\n${content}\n\`\`\``
}

/** Shows only the stdin form that works in the agent's shell, so the agent doesn't have to translate it. */
function recordInstructions(record: AppSecurityCommand, shell: AppSecurityShell): string {
  const fileCommand = codeBlock(formatAppSecurityCommand(record, shell), shell)
  const replaceFilePlaceholder = `replacing \`${record.stdinPlaceholder}\` with the file's path`
  const inlineCommand = formatAppSecurityInlineStdinCommand(record, RECORD_DOCUMENT_PLACEHOLDER, shell)

  if (inlineCommand === undefined) {
    return `cmd.exe can't pipe multi-line text inline, so write the document to a file and redirect it to \`record\`, ${replaceFilePlaceholder}:

${fileCommand}`
  }

  const shellNotes =
    shell === 'powershell'
      ? `The closing \`'@\` must start its line. The single-quoted here-string keeps PowerShell from expanding \`$\` in the document.`
      : `The quoted \`'EOF'\` keeps the shell from expanding \`$\` and backticks in the document.`
  // Both PowerShell forms pipe text to a native command, which Windows PowerShell 5.1 encodes as ASCII.
  const encodingNote =
    shell === 'powershell'
      ? `\n\nWindows PowerShell 5.1 pipes text to \`record\` as ASCII by default. If the document contains non-ASCII characters, run \`$OutputEncoding = [System.Text.UTF8Encoding]::new()\` before either command.`
      : ''

  return `${codeBlock(inlineCommand, shell)}

Replace \`${RECORD_DOCUMENT_PLACEHOLDER}\` with the document itself; you don't need to write a file. ${shellNotes}

If you'd rather write the document to a file, pipe the file instead, ${replaceFilePlaceholder}:

${fileCommand}${encodingNote}`
}

function instructionPaths(
  appDirectory: string,
  resultsKey: string,
  shell: AppSecurityShell,
  commands: AppSecurityCommands,
): AppSecurityInstructionPaths {
  const {resultsDirectory, deterministicFindingsPath, agentChecksPath, agentFindingsPath} = appSecurityArtifactPaths(
    appDirectory,
    resultsKey,
  )
  return {
    commands,
    scanCommand: formatAppSecurityCommand(commands.scan, shell),
    recordInstructions: recordInstructions(commands.record, shell),
    reviewCommand: formatAppSecurityCommand(commands.review, shell),
    cleanCommand: formatAppSecurityCommand(commands.clean, shell),
    deterministicFindingsPath,
    agentChecksPath,
    agentFindingsPath,
    resultsDirectory,
  }
}

function initialScanInstructions(paths: AppSecurityInstructionPaths): string {
  return `### 1. Run the scan

Decide what to scan before running the check. By default, \`check\` scans the app directory. If the app's code also lives elsewhere (a backend, a shared library, another repository), add each of those directories with \`--include-dir\`. Skip paths with \`--exclude\`. Use \`--no-git-ignore\` only if Git-ignored files must be scanned. Include only directories relevant to the app. Check the scope with ${markdownPath(`${paths.scanCommand} --list-files`)} and adjust the flags until the list is right. Then run \`check\` with the same flags, and use the same flags every time you run \`check\` again.`
}

function completedScanInstructions(paths: AppSecurityInstructionPaths): string {
  return `### 1. Use the existing scan results

\`shopify app security check\` has already run. It wrote ${markdownPath(paths.deterministicFindingsPath)} and ${markdownPath(paths.agentChecksPath)}. Continue by reading the agent checks. Running \`check\` again is always safe; do so once source files change (step 7).`
}

const BARE_SCOPE_JSON = JSON.stringify({
  include_dirs: [],
  excludes: [],
  no_git_ignore: false,
} satisfies AppSecurityScope)

/** The findings document's `scope`: the exact block of the `check` run, or a block for the agent to fill in. */
function scopeInstructions(scope: AppSecurityScope | undefined): {json: string; guidance: string} {
  if (scope) {
    return {
      json: JSON.stringify(scope),
      guidance: '`scope` is the scope of the `check` run these results come from. Copy it into the document unchanged.',
    }
  }
  return {
    json: BARE_SCOPE_JSON,
    guidance:
      'Fill in `scope` with the flags you settled on with `--list-files`: `include_dirs` and `excludes` hold the `--include-dir` and `--exclude` values exactly as you typed them, in order, and `no_git_ignore` is `true` only if you passed `--no-git-ignore`.',
  }
}

/** Replaces every placeholder with its value. A replacer function keeps `$` in paths and commands literal. */
function fillTemplate(template: string, values: {[placeholder: string]: string}): string {
  return Object.entries(values).reduce(
    (filled, [placeholder, value]) => filled.replaceAll(placeholder, () => value),
    template,
  )
}

interface AppSecurityInstructionsOptions {
  appDirectory: string
  resultsKey: string
  copy: boolean
  writePath?: string
  commands: AppSecurityCommands
  /** Present when `check` has just run in this process. */
  scanScope?: AppSecurityScope
}

interface AppSecurityInstructionsDependencies {
  copyToClipboard(content: string): Promise<void>
  writeToFile(path: string, content: string): Promise<void>
  output(content: string): void
  outputConfirmation(content: string): void
}

const defaultDependencies: AppSecurityInstructionsDependencies = {
  copyToClipboard: (content) => clipboard.write(content),
  writeToFile: writeFile,
  output: outputResult,
  outputConfirmation: (content) => {
    renderSuccess({headline: content})
  },
}

export function appSecurityInstructions(options: {
  appDirectory: string
  resultsKey: string
  commands: AppSecurityCommands
  /** The scope of the `check` run that just finished. Absent for standalone instructions, which start with the scan. */
  scanScope?: AppSecurityScope
  shell?: AppSecurityShell
}): string {
  const shell = options.shell ?? shellForPlatform()
  const paths = instructionPaths(options.appDirectory, options.resultsKey, shell, options.commands)
  const scanContext = options.scanScope ? completedScanInstructions(paths) : initialScanInstructions(paths)
  const scope = scopeInstructions(options.scanScope)
  // Fill the scan context first: it may contain the other placeholders.
  return fillTemplate(getAgentInstructions(), {
    [SCAN_CONTEXT_PLACEHOLDER]: scanContext,
    '{{WORKING_DIRECTORY_LINE}}': `Run these commands from ${markdownPath(cwd())}.`,
    '{{SCOPE_JSON}}': scope.json,
    '{{SCOPE_GUIDANCE}}': scope.guidance,
    '{{SCAN_COMMAND}}': paths.scanCommand,
    '{{RECORD_COMMAND}}': paths.recordInstructions,
    '{{REVIEW_COMMAND}}': paths.reviewCommand,
    '{{CLEAN_COMMAND}}': paths.cleanCommand,
    '{{DETERMINISTIC_FINDINGS_PATH}}': markdownPath(paths.deterministicFindingsPath),
    '{{AGENT_CHECKS_PATH}}': markdownPath(paths.agentChecksPath),
    '{{AGENT_FINDINGS_PATH}}': markdownPath(paths.agentFindingsPath),
  }).trimEnd()
}

export default async function deliverAppSecurityInstructions(
  options: AppSecurityInstructionsOptions,
  dependencies: AppSecurityInstructionsDependencies = defaultDependencies,
): Promise<void> {
  const instructions = appSecurityInstructions({
    appDirectory: options.appDirectory,
    resultsKey: options.resultsKey,
    commands: options.commands,
    scanScope: options.scanScope,
  })

  if (options.copy) {
    await dependencies.copyToClipboard(instructions)
    dependencies.outputConfirmation('Copied app security check instructions to the clipboard')
  } else if (options.writePath) {
    await dependencies.writeToFile(options.writePath, `${instructions}\n`)
    dependencies.outputConfirmation(`Wrote app security check instructions to ${options.writePath}`)
  } else {
    dependencies.output(instructions)
  }
}
