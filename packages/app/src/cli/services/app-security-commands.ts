import {appSecurityArtifactPaths} from './app-security-artifacts.js'
import {getAppConfigurationShorthand} from '../models/app/config-file-naming.js'

export type AppSecurityShell = 'posix' | 'cmd' | 'powershell'

/** Strings are command syntax, printed bare. Flag values are user input, so they're always quoted. */
export type AppSecurityArgument = string | {flag: string; value: string}

export interface AppSecurityCommand {
  command: string
  args: AppSecurityArgument[]
}

export interface AppSecurityCommands {
  scan: AppSecurityCommand
  compile: AppSecurityCommand
  clean: AppSecurityCommand
}

/** `ignorePatterns` are repeated on every command: a compile must discover the same files as its scan. */
export function resolveAppSecurityCommands(
  appRoot: string,
  configFileName?: string,
  ignorePatterns: ReadonlyArray<string> = [],
): AppSecurityCommands {
  const {findingsPath} = appSecurityArtifactPaths(appRoot)
  const configFlag = configFileName ? getAppConfigurationShorthand(configFileName) : undefined
  const scan: AppSecurityCommand = {
    command: 'shopify',
    args: [
      'app',
      'security',
      'check',
      {flag: '--path', value: appRoot},
      ...(configFlag ? [{flag: '--config', value: configFlag}] : []),
      ...ignorePatterns.map((ignorePattern) => ({flag: '--ignore', value: ignorePattern})),
    ],
  }

  return {
    scan,
    compile: {
      command: scan.command,
      args: [...scan.args, {flag: '--findings', value: findingsPath}],
    },
    clean: {
      command: scan.command,
      args: [...scan.args, '--clean'],
    },
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

export function formatAppSecurityCommand(
  action: AppSecurityCommand,
  shell: AppSecurityShell = shellForPlatform(),
): string {
  const words = action.args.map((argument) =>
    typeof argument === 'string' ? argument : `${argument.flag} ${quoteShellArgument(argument.value, shell)}`,
  )
  return [action.command, ...words].join(' ')
}
