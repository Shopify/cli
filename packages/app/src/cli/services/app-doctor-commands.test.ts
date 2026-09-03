import {
  formatAppDoctorCommand,
  quoteShellArgument,
  resolveAppDoctorCommands,
  shellForPlatform,
  type AppDoctorShell,
} from './app-doctor-commands.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const WINDOWS_APP_ROOT = 'C:/Users/50%/my app'

function splitQuotedCommand(command: string, shell: AppDoctorShell): string[] {
  const tokens: string[] = []
  let current = ''
  let index = 0

  while (index < command.length) {
    const char = command[index]
    if (char === ' ') {
      if (current.length > 0) tokens.push(current)
      current = ''
      index += 1
      continue
    }
    if (shell === 'cmd' && char === '"') {
      index += 1
      while (index < command.length) {
        if (command[index] === '"' && command[index + 1] === '"') {
          current += '"'
          index += 2
          continue
        }
        if (command[index] === '"') {
          index += 1
          break
        }
        current += command[index]
        index += 1
      }
      continue
    }
    if ((shell === 'powershell' || shell === 'posix') && char === "'") {
      index += 1
      while (index < command.length) {
        if (shell === 'powershell' && command[index] === "'" && command[index + 1] === "'") {
          current += "'"
          index += 2
          continue
        }
        if (shell === 'posix' && command.slice(index, index + 4) === `'\\''`) {
          current += "'"
          index += 4
          continue
        }
        if (command[index] === "'") {
          index += 1
          break
        }
        current += command[index]
        index += 1
      }
      continue
    }
    current += char
    index += 1
  }
  if (current.length > 0) tokens.push(current)
  return tokens
}

describe('shellForPlatform', () => {
  test('selects posix off Windows even when PowerShell variables are present', () => {
    expect(shellForPlatform('darwin', {POWERSHELL_DISTRIBUTION_CHANNEL: 'MSI'})).toBe('posix')
    expect(shellForPlatform('linux', {PSModulePath: 'C:/Program Files/PowerShell/Modules'})).toBe('posix')
  })

  test('selects cmd.exe when the cmd prompt is present', () => {
    expect(shellForPlatform('win32', {PROMPT: '$P$G'})).toBe('cmd')
    expect(
      shellForPlatform('win32', {
        PROMPT: '$P$G',
        POWERSHELL_DISTRIBUTION_CHANNEL: 'MSI',
        PSModulePath: 'C:/Program Files/PowerShell/Modules',
      }),
    ).toBe('cmd')
  })

  test('selects PowerShell when Windows PowerShell advertises itself without a cmd prompt', () => {
    expect(shellForPlatform('win32', {POWERSHELL_DISTRIBUTION_CHANNEL: 'MSI'})).toBe('powershell')
    expect(shellForPlatform('win32', {PSExecutionPolicyPreference: 'RemoteSigned'})).toBe('powershell')
    expect(shellForPlatform('win32', {PSModulePath: 'C:/Program Files/PowerShell/Modules'})).toBe('powershell')
    expect(shellForPlatform('win32', {})).toBe('cmd')
  })
})

describe('quoteShellArgument', () => {
  test('preserves percents, spaces, and quotes for each shell', () => {
    expect(quoteShellArgument(WINDOWS_APP_ROOT, 'cmd')).toBe('"C:/Users/50%/my app"')
    expect(quoteShellArgument(WINDOWS_APP_ROOT, 'powershell')).toBe("'C:/Users/50%/my app'")
    expect(quoteShellArgument(WINDOWS_APP_ROOT, 'posix')).toBe("'C:/Users/50%/my app'")
    expect(quoteShellArgument('C:\\Users\\my "app"', 'cmd')).toBe('"C:\\Users\\my ""app"""')
    expect(quoteShellArgument("C:\\Users\\O'Brien\\app", 'powershell')).toBe("'C:\\Users\\O''Brien\\app'")
    expect(quoteShellArgument("C:\\Users\\O'Brien\\app", 'posix')).toBe(`'C:\\Users\\O'\\''Brien\\app'`)
  })
})

describe('formatAppDoctorCommand', () => {
  test('quotes a Windows path with spaces and percents for terminal and instruction shells', () => {
    const commands = resolveAppDoctorCommands(WINDOWS_APP_ROOT)
    const findingsPath = joinPath(WINDOWS_APP_ROOT, '.shopify', 'app-doctor', 'findings.json')

    for (const shell of ['posix', 'cmd', 'powershell'] as const) {
      expect(splitQuotedCommand(formatAppDoctorCommand(commands.scan, shell), shell)).toEqual([
        'shopify',
        'app',
        'doctor',
        '--path',
        WINDOWS_APP_ROOT,
      ])
      expect(splitQuotedCommand(formatAppDoctorCommand(commands.compile, shell), shell)).toEqual([
        'shopify',
        'app',
        'doctor',
        '--path',
        WINDOWS_APP_ROOT,
        '--findings',
        findingsPath,
      ])
      expect(formatAppDoctorCommand(commands.scan, shell)).not.toContain('50%%')
      expect(formatAppDoctorCommand(commands.compile, shell)).not.toContain('50%%')
    }
  })
})
