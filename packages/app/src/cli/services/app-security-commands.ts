import {selectedConfigFileName, type AppSecuritySelection} from './app-security-selection.js'
import {getAppConfigurationShorthand} from '../models/app/config-file-naming.js'
import {cwd, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {realpathSync} from 'node:fs'
import type {AppSecurityScope} from './app-security-engine/index.js'

export type AppSecurityShell = 'posix' | 'cmd' | 'powershell'

/** Strings are command syntax, printed bare. Flag values are user input, so they're always quoted. */
type AppSecurityArgument = string | {flag: string; value: string}

export interface AppSecurityCommand {
  command: string
  args: AppSecurityArgument[]
  /** A placeholder for the file piped to the command's stdin. It's shown unquoted so it reads as a placeholder. */
  stdinPlaceholder?: string
}

export interface AppSecurityCommands {
  scan: AppSecurityCommand
  record: AppSecurityCommand
  review: AppSecurityCommand
  clean: AppSecurityCommand
}

const NO_SCOPE: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

/** A path that can't be resolved is compared as written. */
function realPathOrResolved(path: string): string {
  try {
    return realpathSync(path)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return resolvePath(path)
  }
}

/** `--path` is left out when it is the working directory, so the commands read the same wherever the app is. */
function pathArguments(path: string): AppSecurityArgument[] {
  if (realPathOrResolved(path) === realPathOrResolved(cwd())) return []
  return [{flag: '--path', value: relativePath(cwd(), path)}]
}

function selectionArguments(selection: AppSecuritySelection): AppSecurityArgument[] {
  if (selection.kind === 'no-config') {
    return [{flag: '--client-id', value: selection.clientId}, '--without-app-config']
  }
  // `--client-id` excludes `--config`, and a rerun with `--client-id` alone selects the same configuration.
  if (selection.clientIdOverride) return [{flag: '--client-id', value: selection.clientIdOverride}]
  const configFileName = selectedConfigFileName(selection)
  const configShorthand = configFileName ? getAppConfigurationShorthand(configFileName) : undefined
  return configShorthand ? [{flag: '--config', value: configShorthand}] : []
}

function scopeArguments(scope: AppSecurityScope): AppSecurityArgument[] {
  return [
    ...scope.include_dirs.map((includeDir) => ({flag: '--include-dir', value: includeDir})),
    ...scope.excludes.map((excludePattern) => ({flag: '--exclude', value: excludePattern})),
    ...(scope.no_git_ignore ? ['--no-git-ignore'] : []),
  ]
}

/**
 * The commands that repeat the run, relative to the working directory. `path` is the `--path` that was typed.
 * Only `check` takes the scope, so it's the only command that repeats it: rerunning it gathers the same files.
 */
export function resolveAppSecurityCommands(
  selection: AppSecuritySelection,
  path: string,
  scope: AppSecurityScope = NO_SCOPE,
): AppSecurityCommands {
  const command = 'shopify'
  const subcommandArgs = (subcommand: string): AppSecurityArgument[] => [
    'app',
    'security',
    subcommand,
    ...pathArguments(path),
    ...selectionArguments(selection),
  ]

  return {
    scan: {command, args: [...subcommandArgs('check'), ...scopeArguments(scope)]},
    record: {command, args: subcommandArgs('record'), stdinPlaceholder: '<findings.json>'},
    review: {command, args: subcommandArgs('review')},
    clean: {command, args: subcommandArgs('clean')},
  }
}

export function shellForPlatform(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): AppSecurityShell {
  if (platform !== 'win32' || isPosixCompatibleWindowsShell(env)) return 'posix'
  return windowsShell(env)
}

function isPosixCompatibleWindowsShell(env: NodeJS.ProcessEnv): boolean {
  if (env.MSYSTEM || env.CYGWIN) return true
  const shell = env.SHELL ?? ''
  return /(?:^|[\\/])(bash|zsh|sh|fish|dash)(?:\.exe)?$/i.test(shell)
}

function windowsShell(env: NodeJS.ProcessEnv): Exclude<AppSecurityShell, 'posix'> {
  // cmd.exe sets PROMPT when it starts. PowerShell uses a prompt function and usually leaves it unset.
  // Check PROMPT first so a cmd.exe child of PowerShell is not quoted for PowerShell.
  if (env.PROMPT) return 'cmd'
  if (env.POWERSHELL_DISTRIBUTION_CHANNEL || env.PSExecutionPolicyPreference || env.PSModulePath) {
    return 'powershell'
  }
  return 'cmd'
}

export function quoteShellArgument(value: string, shell: AppSecurityShell): string {
  if (shell === 'cmd') return quoteCmdArgument(value)
  if (shell === 'powershell') return `'${value.replaceAll("'", "''")}'`
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function quoteCmdArgument(value: string): string {
  // Interactive cmd.exe expands %VAR% even inside quotes. Quote each segment and join with ^%
  // so percents sit outside quotes. Batch-style %% is not used.
  return value.split('%').map(quoteCmdSegment).join('^%')
}

function quoteCmdSegment(part: string): string {
  const escapedQuotes = part.replace(/"/g, '""')
  // CommandLineToArgvW treats \" as an escaped quote. Double trailing backslashes so they
  // stay path separators instead of escaping this closer.
  const trailingBackslashes = /\\+$/.exec(escapedQuotes)?.[0] ?? ''
  return `"${escapedQuotes}${trailingBackslashes}"`
}

/**
 * Renders a command for the given shell. A command that reads stdin is shown reading its placeholder file:
 * redirected with `<` in POSIX shells and cmd.exe, and piped from `Get-Content -Raw` in PowerShell,
 * which has no `<` redirection. `-Encoding UTF8` because Windows PowerShell 5.1 otherwise reads a file
 * without a byte order mark in the ANSI code page.
 */
export function formatAppSecurityCommand(
  action: AppSecurityCommand,
  shell: AppSecurityShell = shellForPlatform(),
): string {
  const commandLine = formatCommandLine(action, shell)
  if (!action.stdinPlaceholder) return commandLine
  if (shell === 'powershell') return `Get-Content -Raw -Encoding UTF8 ${action.stdinPlaceholder} | ${commandLine}`
  return `${commandLine} < ${action.stdinPlaceholder}`
}

/**
 * Renders a command that reads `document` inline from stdin: a quoted heredoc in POSIX shells and a
 * literal here-string in PowerShell. Both keep the shell from expanding anything inside the document.
 * Returns undefined for cmd.exe, which can't pipe multi-line text inline.
 */
export function formatAppSecurityInlineStdinCommand(
  action: AppSecurityCommand,
  document: string,
  shell: AppSecurityShell = shellForPlatform(),
): string | undefined {
  const commandLine = formatCommandLine(action, shell)
  if (shell === 'posix') return `${commandLine} <<'EOF'\n${document}\nEOF`
  if (shell === 'powershell') return `@'\n${document}\n'@ | ${commandLine}`
  return undefined
}

function formatCommandLine(action: AppSecurityCommand, shell: AppSecurityShell): string {
  const words = action.args.map((argument) =>
    typeof argument === 'string' ? argument : `${argument.flag} ${quoteShellArgument(argument.value, shell)}`,
  )
  return [action.command, ...words].join(' ')
}
