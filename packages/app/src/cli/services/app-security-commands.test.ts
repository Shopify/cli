/* eslint-disable no-restricted-imports -- cmd.exe percent expansion must be asserted with verbatim Windows arguments */
import {
  formatAppSecurityCommand,
  formatAppSecurityInlineStdinCommand,
  quoteShellArgument,
  resolveAppSecurityCommands,
  shellForPlatform,
  type AppSecurityShell,
} from './app-security-commands.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {spawnSync} from 'node:child_process'

const WINDOWS_APP_ROOT = 'C:/Users/50%/my app'
const PAIRED_PERCENT_ROOT = 'C:\\Users\\%NAME%\\my app'

function undoubleTrailingBackslashes(value: string): string {
  // Inverse of quoteCmdSegment: CommandLineToArgvW keeps half the backslashes before a closer.
  const trailingBackslashes = /\\+$/.exec(value)?.[0]
  if (!trailingBackslashes) return value
  return value.slice(0, value.length - Math.floor(trailingBackslashes.length / 2))
}

function splitQuotedCommand(command: string, shell: AppSecurityShell): string[] {
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
          current = undoubleTrailingBackslashes(current)
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
    expect(quoteShellArgument('C:\\Users\\my app\\', 'cmd')).toBe('"C:\\Users\\my app\\\\"')
    expect(quoteShellArgument("C:\\Users\\O'Brien\\app", 'powershell')).toBe("'C:\\Users\\O''Brien\\app'")
    expect(quoteShellArgument("C:\\Users\\O'Brien\\app", 'posix')).toBe(`'C:\\Users\\O'\\''Brien\\app'`)
  })

  test('escapes paired percent tokens for interactive cmd.exe', () => {
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'cmd')).toBe('"C:\\Users\\\\"^%"NAME"^%"\\my app"')
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'cmd')).not.toContain('%NAME%')
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'powershell')).toBe("'C:\\Users\\%NAME%\\my app'")
    expect(quoteShellArgument(PAIRED_PERCENT_ROOT, 'posix')).toBe("'C:\\Users\\%NAME%\\my app'")
  })
})

describe('resolveAppSecurityCommands', () => {
  test('omits --config for the default shopify.app.toml', () => {
    expect(resolveAppSecurityCommands('/tmp/app').scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: '/tmp/app'},
    ])
    expect(resolveAppSecurityCommands('/tmp/app', 'shopify.app.toml').scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: '/tmp/app'},
    ])
  })

  test('includes --config only on scan for a named configuration', () => {
    const commands = resolveAppSecurityCommands('/tmp/app', 'shopify.app.staging.toml')

    expect(commands.scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: '/tmp/app'},
      {flag: '--config', value: 'staging'},
    ])
    expect(commands.record.args).toEqual(['app', 'security', 'record', {flag: '--path', value: '/tmp/app'}])
    expect(commands.review.args).toEqual(['app', 'security', 'review', {flag: '--path', value: '/tmp/app'}])
    expect(commands.clean.args).toEqual(['app', 'security', 'clean', {flag: '--path', value: '/tmp/app'}])
  })

  test('repeats --ignore patterns in order, after --config, on scan only', () => {
    const commands = resolveAppSecurityCommands('/tmp/app', 'shopify.app.staging.toml', ['generated/', '!build/'])

    expect(commands.scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: '/tmp/app'},
      {flag: '--config', value: 'staging'},
      {flag: '--ignore', value: 'generated/'},
      {flag: '--ignore', value: '!build/'},
    ])
    expect(commands.record.args).toEqual(['app', 'security', 'record', {flag: '--path', value: '/tmp/app'}])
    expect(commands.review.args).toEqual(['app', 'security', 'review', {flag: '--path', value: '/tmp/app'}])
    expect(commands.clean.args).toEqual(['app', 'security', 'clean', {flag: '--path', value: '/tmp/app'}])
  })

  test('omits --ignore when there are no patterns', () => {
    expect(resolveAppSecurityCommands('/tmp/app', undefined, []).scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: '/tmp/app'},
    ])
  })

  test('shows record reading a findings file from stdin in each shell', () => {
    const commands = resolveAppSecurityCommands('/tmp/app')

    expect(formatAppSecurityCommand(commands.record, 'posix')).toBe(
      "shopify app security record --path '/tmp/app' < <findings.json>",
    )
    expect(formatAppSecurityCommand(commands.record, 'cmd')).toBe(
      'shopify app security record --path "/tmp/app" < <findings.json>',
    )
    expect(formatAppSecurityCommand(commands.record, 'powershell')).toBe(
      "Get-Content -Raw <findings.json> | shopify app security record --path '/tmp/app'",
    )
    expect(formatAppSecurityCommand(commands.review, 'posix')).toBe("shopify app security review --path '/tmp/app'")
    expect(formatAppSecurityCommand(commands.clean, 'posix')).toBe("shopify app security clean --path '/tmp/app'")
  })
})

describe('formatAppSecurityCommand', () => {
  test('quotes --ignore patterns so the shell does not expand `!`, `*`, or spaces', () => {
    const ignorePatterns = ['!build/', '*.log', 'a b/']
    const commands = resolveAppSecurityCommands('/tmp/app', undefined, ignorePatterns)

    for (const shell of ['posix', 'cmd', 'powershell'] as const) {
      const formatted = formatAppSecurityCommand(commands.scan, shell)
      expect(splitQuotedCommand(formatted, shell)).toEqual([
        'shopify',
        'app',
        'security',
        'check',
        '--path',
        '/tmp/app',
        '--ignore',
        '!build/',
        '--ignore',
        '*.log',
        '--ignore',
        'a b/',
      ])
      expect(formatted).not.toMatch(/ !build\//)
      expect(formatted).not.toMatch(/ \*\.log/)
    }
    expect(formatAppSecurityCommand(commands.scan, 'posix')).toContain(
      "--ignore '!build/' --ignore '*.log' --ignore 'a b/'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'powershell')).toContain(
      "--ignore '!build/' --ignore '*.log' --ignore 'a b/'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'cmd')).toContain(
      '--ignore "!build/" --ignore "*.log" --ignore "a b/"',
    )
  })

  test('quotes an --ignore pattern that starts with `-` or repeats a command word', () => {
    const ignorePatterns = ['-*.log', '-tmp/', 'check']
    const commands = resolveAppSecurityCommands('/tmp/app', undefined, ignorePatterns)

    for (const shell of ['posix', 'cmd', 'powershell'] as const) {
      const formatted = formatAppSecurityCommand(commands.scan, shell)
      expect(splitQuotedCommand(formatted, shell)).toEqual([
        'shopify',
        'app',
        'security',
        'check',
        '--path',
        '/tmp/app',
        '--ignore',
        '-*.log',
        '--ignore',
        '-tmp/',
        '--ignore',
        'check',
      ])
      expect(formatted).not.toMatch(/ -\*\.log/)
      expect(formatted).not.toMatch(/ -tmp\//)
      expect(formatted).not.toMatch(/--ignore check/)
    }
    expect(formatAppSecurityCommand(commands.scan, 'posix')).toContain(
      "--ignore '-*.log' --ignore '-tmp/' --ignore 'check'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'powershell')).toContain(
      "--ignore '-*.log' --ignore '-tmp/' --ignore 'check'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'cmd')).toContain(
      '--ignore "-*.log" --ignore "-tmp/" --ignore "check"',
    )
  })

  test('leaves the command words and every flag name bare and quotes every flag value', () => {
    const commands = resolveAppSecurityCommands('/tmp/app', 'shopify.app.staging.toml', ['generated/'])

    expect(formatAppSecurityCommand(commands.scan, 'posix')).toBe(
      "shopify app security check --path '/tmp/app' --config 'staging' --ignore 'generated/'",
    )
    expect(formatAppSecurityCommand(commands.clean, 'posix')).toBe("shopify app security clean --path '/tmp/app'")
  })

  test('quotes a Windows path with spaces and percents for terminal and instruction shells', () => {
    const commands = resolveAppSecurityCommands(WINDOWS_APP_ROOT)

    for (const shell of ['posix', 'cmd', 'powershell'] as const) {
      expect(splitQuotedCommand(formatAppSecurityCommand(commands.scan, shell), shell)).toEqual([
        'shopify',
        'app',
        'security',
        'check',
        '--path',
        WINDOWS_APP_ROOT,
      ])
      const recordArguments = ['shopify', 'app', 'security', 'record', '--path', WINDOWS_APP_ROOT]
      expect(splitQuotedCommand(formatAppSecurityCommand(commands.record, shell), shell)).toEqual(
        shell === 'powershell'
          ? ['Get-Content', '-Raw', '<findings.json>', '|', ...recordArguments]
          : [...recordArguments, '<', '<findings.json>'],
      )
      expect(splitQuotedCommand(formatAppSecurityCommand(commands.clean, shell), shell)).toEqual([
        'shopify',
        'app',
        'security',
        'clean',
        '--path',
        WINDOWS_APP_ROOT,
      ])
      expect(formatAppSecurityCommand(commands.scan, shell)).not.toContain('50%%')
      expect(formatAppSecurityCommand(commands.record, shell)).not.toContain('50%%')
      expect(formatAppSecurityCommand(commands.clean, shell)).not.toContain('50%%')
    }
  })

  test('quotes a Windows path with paired percent tokens without leaving %NAME% expandable', () => {
    const commands = resolveAppSecurityCommands(PAIRED_PERCENT_ROOT)

    expect(splitQuotedCommand(formatAppSecurityCommand(commands.scan, 'cmd'), 'cmd')).toEqual([
      'shopify',
      'app',
      'security',
      'check',
      '--path',
      PAIRED_PERCENT_ROOT,
    ])
    expect(splitQuotedCommand(formatAppSecurityCommand(commands.review, 'cmd'), 'cmd')).toEqual([
      'shopify',
      'app',
      'security',
      'review',
      '--path',
      PAIRED_PERCENT_ROOT,
    ])
    expect(splitQuotedCommand(formatAppSecurityCommand(commands.clean, 'cmd'), 'cmd')).toEqual([
      'shopify',
      'app',
      'security',
      'clean',
      '--path',
      PAIRED_PERCENT_ROOT,
    ])
    expect(formatAppSecurityCommand(commands.scan, 'cmd')).not.toContain('%NAME%')
    expect(formatAppSecurityCommand(commands.record, 'powershell')).toContain('%NAME%')
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

describe('formatAppSecurityInlineStdinCommand', () => {
  const document = '{"schema_version": 1, "note": "$HOME `id`"}'

  test('pipes the document through a quoted heredoc in POSIX shells', () => {
    const {record} = resolveAppSecurityCommands("/tmp/O'Brien app")

    expect(formatAppSecurityInlineStdinCommand(record, document, 'posix')).toBe(
      `shopify app security record --path '/tmp/O'\\''Brien app' <<'EOF'\n${document}\nEOF`,
    )
  })

  test('pipes the document from a literal here-string in PowerShell', () => {
    const {record} = resolveAppSecurityCommands("C:\\Users\\O'Brien\\my app")

    expect(formatAppSecurityInlineStdinCommand(record, document, 'powershell')).toBe(
      `@'\n${document}\n'@ | shopify app security record --path 'C:\\Users\\O''Brien\\my app'`,
    )
  })

  test('has no inline form for cmd.exe', () => {
    const {record} = resolveAppSecurityCommands('C:\\Users\\my app')

    expect(formatAppSecurityInlineStdinCommand(record, document, 'cmd')).toBeUndefined()
  })
})
