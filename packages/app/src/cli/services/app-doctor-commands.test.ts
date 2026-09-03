/* eslint-disable no-restricted-imports -- cmd.exe percent expansion must be asserted with verbatim Windows arguments */
import {
  formatAppDoctorCommand,
  quoteShellArgument,
  resolveAppDoctorCommands,
  shellForPlatform,
  type AppDoctorShell,
} from './app-doctor-commands.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {spawnSync} from 'node:child_process'

const WINDOWS_APP_ROOT = 'C:/Users/50%/my app'
const PAIRED_PERCENT_ROOT = 'C:\\Users\\%NAME%\\my app'

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
    if (shell === 'cmd' && char === '^' && command[index + 1] === '%') {
      current += '%'
      index += 2
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

  test('selects posix on Windows for Git Bash, MSYS, and Cygwin', () => {
    expect(shellForPlatform('win32', {MSYSTEM: 'MINGW64', SHELL: '/usr/bin/bash'})).toBe('posix')
    expect(shellForPlatform('win32', {SHELL: 'C:\\Program Files\\Git\\bin\\bash.exe', PROMPT: '$P$G'})).toBe('posix')
    expect(shellForPlatform('win32', {CYGWIN: 'nodosfilewarning'})).toBe('posix')
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
    expect(quoteShellArgument(WINDOWS_APP_ROOT, 'cmd')).toBe('"C:/Users/50"^%"/my app"')
    expect(quoteShellArgument(WINDOWS_APP_ROOT, 'powershell')).toBe("'C:/Users/50%/my app'")
    expect(quoteShellArgument(WINDOWS_APP_ROOT, 'posix')).toBe("'C:/Users/50%/my app'")
    expect(quoteShellArgument('C:\\Users\\my "app"', 'cmd')).toBe('"C:\\Users\\my ""app"""')
    expect(quoteShellArgument("C:\\Users\\O'Brien\\app", 'powershell')).toBe("'C:\\Users\\O''Brien\\app'")
    expect(quoteShellArgument("C:\\Users\\O'Brien\\app", 'posix')).toBe(`'C:\\Users\\O'\\''Brien\\app'`)
  })

  test('escapes paired percent tokens for interactive cmd.exe', () => {
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'cmd')).toBe('"C:\\Users\\"^%"NAME"^%"\\my app"')
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'cmd')).not.toContain('%NAME%')
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'powershell')).toBe("'C:\\Users\\%NAME%\\my app'")
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'posix')).toBe("'C:\\Users\\%NAME%\\my app'")
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

  test('quotes a Windows path with paired percent tokens without leaving %NAME% expandable', () => {
    const commands = resolveAppDoctorCommands(PAIRED_PERCENT_ROOT)
    const findingsPath = joinPath(PAIRED_PERCENT_ROOT, '.shopify', 'app-doctor', 'findings.json')

    expect(splitQuotedCommand(formatAppDoctorCommand(commands.scan, 'cmd'), 'cmd')).toEqual([
      'shopify',
      'app',
      'doctor',
      '--path',
      PAIRED_PERCENT_ROOT,
    ])
    expect(splitQuotedCommand(formatAppDoctorCommand(commands.compile, 'cmd'), 'cmd')).toEqual([
      'shopify',
      'app',
      'doctor',
      '--path',
      PAIRED_PERCENT_ROOT,
      '--findings',
      findingsPath,
    ])
    expect(formatAppDoctorCommand(commands.scan, 'cmd')).not.toContain('%NAME%')
    expect(formatAppDoctorCommand(commands.compile, 'powershell')).toContain('%NAME%')
  })

  test.skipIf(process.platform !== 'win32')('cmd quoting preserves paired percents through cmd.exe', async () => {
    await inTemporaryDirectory(async (directory) => {
      const printer = joinPath(directory, 'print-arg.js')
      await writeFile(printer, 'process.stdout.write(process.argv[2] ?? "")\n')
      const commandLine = [process.execPath, printer, PAIRED_PERCENT_ROOT]
        .map((part) => quoteShellArgument(part, 'cmd'))
        .join(' ')
      const result = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${commandLine}"`], {
        encoding: 'utf8',
        env: {...process.env, NAME: 'EXPANDED'},
        windowsVerbatimArguments: true,
        windowsHide: true,
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toBe(PAIRED_PERCENT_ROOT)
      expect(result.stdout).not.toContain('EXPANDED')
    })
  })
})
