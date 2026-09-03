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

export function shellForPlatform(platform: NodeJS.Platform = process.platform): AppDoctorShell {
  return platform === 'win32' ? 'cmd' : 'posix'
}

export function quoteShellArgument(value: string, shell: AppDoctorShell): string {
  if (shell === 'cmd') {
    // cmd.exe expands %NAME% inside quotes and does not treat backslashes as escapes.
    return `"${value.replace(/%/g, '%%').replace(/"/g, '""')}"`
  }
  if (shell === 'powershell') return `'${value.replaceAll("'", "''")}'`
  return `'${value.replaceAll("'", `'\\''`)}'`
}

export function formatAppDoctorCommand(
  action: AppDoctorCommand,
  shell: AppDoctorShell = shellForPlatform(),
): string {
  return [action.command, ...action.args]
    .map((argument, index) => {
      const isCommandSyntax = index === 0 || argument === 'app' || argument === 'doctor' || argument.startsWith('-')
      return isCommandSyntax ? argument : quoteShellArgument(argument, shell)
    })
    .join(' ')
}
