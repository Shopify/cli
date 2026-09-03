import {joinPath} from '@shopify/cli-kit/node/path'

export type AppDoctorShell = 'posix' | 'cmd' | 'powershell'

export interface AppDoctorCommand {
  command: string
  args: string[]
}

export interface AppDoctorCommands {
  scan: AppDoctorCommand
  compile: AppDoctorCommand
}

export function resolveAppDoctorCommands(appRoot: string): AppDoctorCommands {
  const findingsPath = joinPath(appRoot, '.shopify', 'app-doctor', 'findings.json')
  const scan: AppDoctorCommand = {
    command: 'shopify',
    args: ['app', 'doctor', '--path', appRoot],
  }

  return {
    scan,
    compile: {
      command: scan.command,
      args: [...scan.args, '--findings', findingsPath],
    },
  }
}

export function shellForPlatform(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): AppDoctorShell {
  if (platform !== 'win32') return 'posix'
  return windowsShell(env)
}

function windowsShell(env: NodeJS.ProcessEnv): Exclude<AppDoctorShell, 'posix'> {
  // cmd.exe sets PROMPT when it starts. PowerShell uses a prompt function and usually leaves it unset.
  // Check PROMPT first so a cmd.exe child of PowerShell is not quoted for PowerShell.
  if (env.PROMPT) return 'cmd'
  if (env.POWERSHELL_DISTRIBUTION_CHANNEL || env.PSExecutionPolicyPreference || env.PSModulePath) {
    return 'powershell'
  }
  return 'cmd'
}

export function quoteShellArgument(value: string, shell: AppDoctorShell): string {
  if (shell === 'cmd') {
    // Interactive cmd.exe does not treat %% as an escaped percent the way batch files do. Quote and double quotes only.
    return `"${value.replace(/"/g, '""')}"`
  }
  if (shell === 'powershell') return `'${value.replaceAll("'", "''")}'`
  return `'${value.replaceAll("'", `'\\''`)}'`
}

export function formatAppDoctorCommand(action: AppDoctorCommand, shell: AppDoctorShell = shellForPlatform()): string {
  return [action.command, ...action.args]
    .map((argument, index) => {
      const isCommandSyntax = index === 0 || argument === 'app' || argument === 'doctor' || argument.startsWith('-')
      return isCommandSyntax ? argument : quoteShellArgument(argument, shell)
    })
    .join(' ')
}
