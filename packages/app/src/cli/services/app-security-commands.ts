import {getAppConfigurationShorthand} from '../models/app/config-file-naming.js'

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
  submit: AppSecurityCommand
  clean: AppSecurityCommand
}

/** `ignorePatterns` are repeated on scan so that rerunning the check discovers the same files. */
export function resolveAppSecurityCommands(
  appRoot: string,
  configFileName?: string,
  ignorePatterns: ReadonlyArray<string> = [],
): AppSecurityCommands {
  const configFlag = configFileName ? getAppConfigurationShorthand(configFileName) : undefined
  const command = 'shopify'
  // Only check reads the app configuration and discovers files, so it's the only command that takes --config or --ignore.
  const subcommandArgs = (subcommand: string): AppSecurityArgument[] => [
    'app',
    'security',
    subcommand,
    {flag: '--path', value: appRoot},
  ]

  return {
    scan: {
      command,
      args: [
        ...subcommandArgs('check'),
        ...(configFlag ? [{flag: '--config', value: configFlag}] : []),
        ...ignorePatterns.map((ignorePattern) => ({flag: '--ignore', value: ignorePattern})),
      ],
    },
    record: {command, args: subcommandArgs('record'), stdinPlaceholder: '<findings.json>'},
    review: {command, args: subcommandArgs('review')},
    submit: {command, args: subcommandArgs('submit')},
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
 * which has no `<` redirection.
 */
export function formatAppSecurityCommand(
  action: AppSecurityCommand,
  shell: AppSecurityShell = shellForPlatform(),
): string {
  const commandLine = formatCommandLine(action, shell)
  if (!action.stdinPlaceholder) return commandLine
  if (shell === 'powershell') return `Get-Content -Raw ${action.stdinPlaceholder} | ${commandLine}`
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
