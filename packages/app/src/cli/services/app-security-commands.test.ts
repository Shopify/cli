/* eslint-disable no-restricted-imports -- cmd.exe percent expansion must be asserted with verbatim Windows arguments */
import {
  formatAppSecurityCommand,
  formatAppSecurityInlineStdinCommand,
  quoteShellArgument,
  resolveAppSecurityCommands,
  shellForPlatform,
  type AppSecurityCommand,
  type AppSecurityCommands,
  type AppSecurityShell,
} from './app-security-commands.js'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, dirname, joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {spawnSync} from 'node:child_process'
import {symlink} from 'node:fs/promises'
import type {AppSecuritySelection} from './app-security-selection.js'
import type {AppSecurityScope} from './app-security-engine/index.js'

const WINDOWS_APP_ROOT = 'C:/Users/50%/my app'
const PAIRED_PERCENT_ROOT = 'C:\\Users\\%NAME%\\my app'

/** Commands with exactly this `--path` value, so the quoting of awkward paths is tested without resolving them. */
function commandsWithPath(pathValue: string, excludePatterns: string[] = []): AppSecurityCommands {
  const args = (subcommand: string): AppSecurityCommands['scan']['args'] => [
    'app',
    'security',
    subcommand,
    {flag: '--path', value: pathValue},
  ]
  return {
    scan: {
      command: 'shopify',
      args: [...args('check'), ...excludePatterns.map((value) => ({flag: '--exclude', value}))],
    },
    record: {command: 'shopify', args: args('record'), stdinPlaceholder: '<findings.json>'},
    review: {command: 'shopify', args: args('review')},
    clean: {command: 'shopify', args: args('clean')},
  }
}

function configSelection(
  configFileName = 'shopify.app.toml',
  clientIdOverride?: string,
  appDirectory = '/tmp/app',
): AppSecuritySelection {
  return {kind: 'config', appDirectory, appConfigFilePath: joinPath(appDirectory, configFileName), clientIdOverride}
}

const noConfigSelection: AppSecuritySelection = {
  kind: 'no-config',
  appDirectory: '/tmp/app',
  clientId: 'client-1',
  clientIdSource: 'picker',
}

const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

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
  test('omits --path and --config for the working directory and the default shopify.app.toml', () => {
    const commands = resolveAppSecurityCommands(configSelection(), cwd())

    for (const [subcommand, command] of Object.entries({
      check: commands.scan,
      record: commands.record,
      review: commands.review,
      clean: commands.clean,
    })) {
      expect(command.args).toEqual(['app', 'security', subcommand])
    }
  })

  test('renders --path relative to the working directory when it is somewhere else', () => {
    const nested = resolveAppSecurityCommands(configSelection(), joinPath(cwd(), 'apps', 'web'))
    const parent = resolveAppSecurityCommands(configSelection(), dirname(cwd()))

    expect(nested.scan.args).toEqual(['app', 'security', 'check', {flag: '--path', value: joinPath('apps', 'web')}])
    expect(nested.clean.args).toEqual(['app', 'security', 'clean', {flag: '--path', value: joinPath('apps', 'web')}])
    expect(parent.review.args).toEqual(['app', 'security', 'review', {flag: '--path', value: '..'}])
  })

  test.skipIf(process.platform === 'win32')(
    'omits --path for a symbolic link to the working directory, comparing real paths',
    async () => {
      await inTemporaryDirectory(async (directory) => {
        const link = joinPath(directory, 'link')
        await symlink(cwd(), link)

        expect(resolveAppSecurityCommands(configSelection(), link).scan.args).toEqual(['app', 'security', 'check'])
      })
    },
  )

  test('renders --config on every command for a named configuration', () => {
    const commands = resolveAppSecurityCommands(configSelection('shopify.app.staging.toml'), cwd())
    const configFlag = {flag: '--config', value: 'staging'}

    expect(commands.scan.args).toEqual(['app', 'security', 'check', configFlag])
    expect(commands.record.args).toEqual(['app', 'security', 'record', configFlag])
    expect(commands.review.args).toEqual(['app', 'security', 'review', configFlag])
    expect(commands.clean.args).toEqual(['app', 'security', 'clean', configFlag])
  })

  test('renders --client-id instead of --config when the client ID was overridden', () => {
    const commands = resolveAppSecurityCommands(configSelection('shopify.app.staging.toml', 'override-id'), cwd())
    const clientIdFlag = {flag: '--client-id', value: 'override-id'}

    expect(commands.scan.args).toEqual(['app', 'security', 'check', clientIdFlag])
    expect(commands.record.args).toEqual(['app', 'security', 'record', clientIdFlag])
    expect(commands.review.args).toEqual(['app', 'security', 'review', clientIdFlag])
    expect(commands.clean.args).toEqual(['app', 'security', 'clean', clientIdFlag])
  })

  test('always renders --client-id and --without-app-config without app configuration, even from the picker', () => {
    const commands = resolveAppSecurityCommands(noConfigSelection, cwd())
    const flags = [{flag: '--client-id', value: 'client-1'}, '--without-app-config']

    expect(commands.scan.args).toEqual(['app', 'security', 'check', ...flags])
    expect(commands.record.args).toEqual(['app', 'security', 'record', ...flags])
    expect(commands.review.args).toEqual(['app', 'security', 'review', ...flags])
    expect(commands.clean.args).toEqual(['app', 'security', 'clean', ...flags])
  })

  test('repeats the scope on check only: --include-dir and --exclude as typed and in order, then --no-git-ignore', () => {
    const scope: AppSecurityScope = {
      include_dirs: ['../backend', './lib/', '../backend'],
      excludes: ['generated', '../shared/**'],
      no_git_ignore: true,
    }
    const commands = resolveAppSecurityCommands(configSelection('shopify.app.staging.toml'), cwd(), scope)

    expect(commands.scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--config', value: 'staging'},
      {flag: '--include-dir', value: '../backend'},
      {flag: '--include-dir', value: './lib/'},
      {flag: '--include-dir', value: '../backend'},
      {flag: '--exclude', value: 'generated'},
      {flag: '--exclude', value: '../shared/**'},
      '--no-git-ignore',
    ])
    const configFlag = {flag: '--config', value: 'staging'}
    expect(commands.record.args).toEqual(['app', 'security', 'record', configFlag])
    expect(commands.review.args).toEqual(['app', 'security', 'review', configFlag])
    expect(commands.clean.args).toEqual(['app', 'security', 'clean', configFlag])
  })

  test('orders the flags: --path, --config, --client-id, --without-app-config, --include-dir, --exclude, --no-git-ignore', () => {
    const scope: AppSecurityScope = {include_dirs: ['lib'], excludes: ['generated'], no_git_ignore: true}
    const path = joinPath(cwd(), 'apps', 'web')
    const relativePathValue = joinPath('apps', 'web')

    expect(resolveAppSecurityCommands(configSelection('shopify.app.staging.toml'), path, scope).scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: relativePathValue},
      {flag: '--config', value: 'staging'},
      {flag: '--include-dir', value: 'lib'},
      {flag: '--exclude', value: 'generated'},
      '--no-git-ignore',
    ])
    expect(resolveAppSecurityCommands(noConfigSelection, path, scope).scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: relativePathValue},
      {flag: '--client-id', value: 'client-1'},
      '--without-app-config',
      {flag: '--include-dir', value: 'lib'},
      {flag: '--exclude', value: 'generated'},
      '--no-git-ignore',
    ])
  })

  test('omits the scope flags when the scope is empty', () => {
    expect(resolveAppSecurityCommands(configSelection(), cwd(), noScope).scan.args).toEqual([
      'app',
      'security',
      'check',
    ])
  })

  test('shows record reading a findings file from stdin in each shell', () => {
    const commands = commandsWithPath('/tmp/app')

    expect(formatAppSecurityCommand(commands.record, 'posix')).toBe(
      "shopify app security record --path '/tmp/app' < <findings.json>",
    )
    expect(formatAppSecurityCommand(commands.record, 'cmd')).toBe(
      'shopify app security record --path "/tmp/app" < <findings.json>',
    )
    expect(formatAppSecurityCommand(commands.record, 'powershell')).toBe(
      "Get-Content -Raw -Encoding UTF8 <findings.json> | shopify app security record --path '/tmp/app'",
    )
    expect(formatAppSecurityCommand(commands.review, 'posix')).toBe("shopify app security review --path '/tmp/app'")
    expect(formatAppSecurityCommand(commands.clean, 'posix')).toBe("shopify app security clean --path '/tmp/app'")
  })

  test('leaves the review subcommand unquoted in each shell', () => {
    const commands = commandsWithPath(WINDOWS_APP_ROOT)

    for (const shell of ['posix', 'cmd', 'powershell'] as const) {
      expect(splitQuotedCommand(formatAppSecurityCommand(commands.review, shell), shell)).toEqual([
        'shopify',
        'app',
        'security',
        'review',
        '--path',
        WINDOWS_APP_ROOT,
      ])
      expect(formatAppSecurityCommand(commands.review, shell)).toMatch(/ review --path /)
    }
  })
})

describe('formatAppSecurityCommand', () => {
  test('quotes --exclude globs so the shell does not expand `!`, `*`, or spaces', () => {
    const excludePatterns = ['!build/', '*.log', 'a b/']
    const commands = commandsWithPath('/tmp/app', excludePatterns)

    for (const shell of ['posix', 'cmd', 'powershell'] as const) {
      const formatted = formatAppSecurityCommand(commands.scan, shell)
      expect(splitQuotedCommand(formatted, shell)).toEqual([
        'shopify',
        'app',
        'security',
        'check',
        '--path',
        '/tmp/app',
        '--exclude',
        '!build/',
        '--exclude',
        '*.log',
        '--exclude',
        'a b/',
      ])
      expect(formatted).not.toMatch(/ !build\//)
      expect(formatted).not.toMatch(/ \*\.log/)
    }
    expect(formatAppSecurityCommand(commands.scan, 'posix')).toContain(
      "--exclude '!build/' --exclude '*.log' --exclude 'a b/'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'powershell')).toContain(
      "--exclude '!build/' --exclude '*.log' --exclude 'a b/'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'cmd')).toContain(
      '--exclude "!build/" --exclude "*.log" --exclude "a b/"',
    )
  })

  test('quotes an --exclude glob that starts with `-` or repeats a command word', () => {
    const excludePatterns = ['-*.log', '-tmp/', 'check']
    const commands = commandsWithPath('/tmp/app', excludePatterns)

    for (const shell of ['posix', 'cmd', 'powershell'] as const) {
      const formatted = formatAppSecurityCommand(commands.scan, shell)
      expect(splitQuotedCommand(formatted, shell)).toEqual([
        'shopify',
        'app',
        'security',
        'check',
        '--path',
        '/tmp/app',
        '--exclude',
        '-*.log',
        '--exclude',
        '-tmp/',
        '--exclude',
        'check',
      ])
      expect(formatted).not.toMatch(/ -\*\.log/)
      expect(formatted).not.toMatch(/ -tmp\//)
      expect(formatted).not.toMatch(/--exclude check/)
    }
    expect(formatAppSecurityCommand(commands.scan, 'posix')).toContain(
      "--exclude '-*.log' --exclude '-tmp/' --exclude 'check'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'powershell')).toContain(
      "--exclude '-*.log' --exclude '-tmp/' --exclude 'check'",
    )
    expect(formatAppSecurityCommand(commands.scan, 'cmd')).toContain(
      '--exclude "-*.log" --exclude "-tmp/" --exclude "check"',
    )
  })

  test('leaves the command words and every flag name bare and quotes every flag value', () => {
    const commands = resolveAppSecurityCommands(configSelection('shopify.app.staging.toml'), joinPath(cwd(), 'app'), {
      include_dirs: [],
      excludes: ['generated'],
      no_git_ignore: true,
    })

    expect(formatAppSecurityCommand(commands.scan, 'posix')).toBe(
      "shopify app security check --path 'app' --config 'staging' --exclude 'generated' --no-git-ignore",
    )
    expect(formatAppSecurityCommand(commands.clean, 'posix')).toBe(
      "shopify app security clean --path 'app' --config 'staging'",
    )
  })

  test('quotes a Windows path with spaces and percents for terminal and instruction shells', () => {
    const commands = commandsWithPath(WINDOWS_APP_ROOT)

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
          ? ['Get-Content', '-Raw', '-Encoding', 'UTF8', '<findings.json>', '|', ...recordArguments]
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
    const commands = commandsWithPath(PAIRED_PERCENT_ROOT)

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

  test.skipIf(process.platform !== 'win32')(
    'the PowerShell record command reads a findings file without a byte order mark as UTF-8 in Windows PowerShell 5.1',
    // Starting powershell.exe dominates this test and varies widely on CI runners, so it needs more than
    // the 13s Windows default.
    {timeout: 60000},
    async () => {
      await inTemporaryDirectory(async (directory) => {
        const findingsPath = joinPath(directory, 'findings.json')
        const receivedPath = joinPath(directory, 'received.json')
        const saveStdin = joinPath(directory, 'save-stdin.js')
        // writeFile writes UTF-8 without a byte order mark.
        await writeFile(findingsPath, '{"file": "app/café.ts"}')
        // Saves stdin's bytes to a file, so PowerShell's console encoding can't change what the test reads back.
        await writeFile(
          saveStdin,
          "const chunks = []\nprocess.stdin.on('data', (chunk) => chunks.push(chunk))\nprocess.stdin.on('end', () => require('fs').writeFileSync(process.argv[2], Buffer.concat(chunks)))\n",
        )
        // The record command's stdin form, with node in place of shopify.
        const record: AppSecurityCommand = {
          command: `& ${quoteShellArgument(process.execPath, 'powershell')}`,
          args: [quoteShellArgument(saveStdin, 'powershell'), quoteShellArgument(receivedPath, 'powershell')],
          stdinPlaceholder: quoteShellArgument(findingsPath, 'powershell'),
        }
        // As the instructions say: without this, Windows PowerShell 5.1 pipes text to node as ASCII.
        const script = `$OutputEncoding = [System.Text.UTF8Encoding]::new(); ${formatAppSecurityCommand(record, 'powershell')}`
        const result = spawnSync(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
          {encoding: 'utf8', windowsHide: true},
        )

        expect(result.status, result.stderr).toBe(0)
        expect(JSON.parse(await readFile(receivedPath))).toStrictEqual({file: 'app/café.ts'})
      })
    },
  )
})

describe('formatAppSecurityInlineStdinCommand', () => {
  const document = '{"schema_version": 1, "note": "$HOME `id`"}'

  test('pipes the document through a quoted heredoc in POSIX shells', () => {
    const {record} = commandsWithPath("/tmp/O'Brien app")

    expect(formatAppSecurityInlineStdinCommand(record, document, 'posix')).toBe(
      `shopify app security record --path '/tmp/O'\\''Brien app' <<'EOF'\n${document}\nEOF`,
    )
  })

  test('pipes the document from a literal here-string in PowerShell', () => {
    const {record} = commandsWithPath("C:\\Users\\O'Brien\\my app")

    expect(formatAppSecurityInlineStdinCommand(record, document, 'powershell')).toBe(
      `@'\n${document}\n'@ | shopify app security record --path 'C:\\Users\\O''Brien\\my app'`,
    )
  })

  test('has no inline form for cmd.exe', () => {
    const {record} = commandsWithPath('C:\\Users\\my app')

    expect(formatAppSecurityInlineStdinCommand(record, document, 'cmd')).toBeUndefined()
  })
})
