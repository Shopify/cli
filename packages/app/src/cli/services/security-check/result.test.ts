import {
  appSecurityInstructionsPrompt,
  literalGlobPattern,
  renderSecurityCheckPromptsTip,
  renderSecurityCheckResult,
  type AppSecurityInstructionsDestination,
} from './result.js'
import {listAppSecurityFiles} from '../app-security-api.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {
  formatAppSecurityCommand,
  quoteShellArgument,
  resolveAppSecurityCommands,
  shellForPlatform,
} from '../app-security-commands.js'
import {appSecurityInstructions} from '../app-security-instructions.js'
import {validAppConfiguration} from '../app-security-selection.test-data.js'
import {committedSecretIssue, scan, scanExecution} from '../security-check.test-data.js'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {fileRealPath, inTemporaryDirectory, matchGlob, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {unstyled} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import clipboard from 'clipboardy'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {symlink} from 'node:fs/promises'
import type {AppSecuritySelection} from '../app-security-selection.js'
import type {AppSecurityScope} from '../app-security-engine/index.js'
import type {SecurityCheckOutcome} from '../security-check.js'

// Tests must not replace the clipboard of the machine that runs them.
vi.mock('clipboardy', () => ({default: {write: vi.fn()}}))

type ScannedSecurityCheck = Extract<SecurityCheckOutcome, {kind: 'scanned'}>
type ListedSecurityCheck = Extract<SecurityCheckOutcome, {kind: 'listed'}>

const originalExitCode = process.exitCode
afterEach(() => {
  process.exitCode = originalExitCode
  vi.unstubAllEnvs()
})

const appDirectory = '/tmp/unlinked-app'

const selection: AppSecuritySelection = {
  kind: 'config',
  appDirectory,
  appConfigFilePath: `${appDirectory}/shopify.app.toml`,
  configClientId: 'toml-client-id',
}

const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

function scanned(overrides: Partial<ScannedSecurityCheck> = {}): ScannedSecurityCheck {
  const checkSelection = overrides.selection ?? selection
  const scope = overrides.scope ?? noScope
  const paths = appSecurityArtifactPaths(checkSelection.appDirectory, 'shopify.app')
  return {
    kind: 'scanned',
    selection: checkSelection,
    resultsKey: 'shopify.app',
    commands: resolveAppSecurityCommands(checkSelection, checkSelection.appDirectory, scope),
    scope,
    scanDirectories: [{directory: checkSelection.appDirectory, origin: 'app_directory'}],
    execution: scanExecution,
    artifacts: {deterministicFindingsPath: paths.deterministicFindingsPath, agentChecksPath: paths.agentChecksPath},
    blocking: {level: 'none', blockedChecks: 0},
    ...overrides,
  }
}

function listed(overrides: Partial<ListedSecurityCheck> = {}): ListedSecurityCheck {
  const checkSelection = overrides.selection ?? selection
  return {
    kind: 'listed',
    selection: checkSelection,
    resultsKey: 'shopify.app',
    commands: resolveAppSecurityCommands(checkSelection, checkSelection.appDirectory, noScope),
    scope: noScope,
    scanDirectories: [{directory: checkSelection.appDirectory, origin: 'app_directory'}],
    paths: ['shopify.app.toml'],
    ignoredScanDirectories: [],
    otherAppDirectories: [],
    ...overrides,
  }
}

const presentationOptions = {
  directory: appDirectory,
  verbose: false,
  printInstructions: false,
  skipInstructions: false,
}

function testDependencies(destination: AppSecurityInstructionsDestination = 'nothing', canPrompt = false) {
  return {
    canPrompt: vi.fn(() => canPrompt),
    selectInstructionsDestination: vi.fn(async () => destination),
  }
}

/** The instructions for the scan that just ran, as `check` prints them. */
function scanInstructions(check: ScannedSecurityCheck): string {
  return appSecurityInstructions({
    appDirectory: check.selection.appDirectory,
    resultsKey: check.resultsKey,
    commands: check.commands,
    scanScope: check.scope,
  })
}

/** Presents the outcome and returns what reached stdout and stderr, without styling. */
async function present(
  check: SecurityCheckOutcome,
  options: Partial<typeof presentationOptions> = {},
  dependencies = testDependencies(),
) {
  return withCapturedStandardStreams(async ({stdout, stderr}) => {
    await renderSecurityCheckResult(check, {...presentationOptions, ...options}, 'text', dependencies)
    return {stdout: unstyled(stdout()), stderr: unstyled(stderr())}
  })
}

/**
 * Presents the outcome as JSON, as a command with `--json` does, and returns the parsed result and the stderr events.
 * Parsing fails unless stdout holds exactly one JSON document.
 */
async function presentJson(
  check: SecurityCheckOutcome,
  options: Partial<typeof presentationOptions> = {},
  dependencies = testDependencies(),
) {
  return withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () =>
      renderSecurityCheckResult(check, {...presentationOptions, ...options}, 'json', dependencies),
    )
    const events = stderr()
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as {type: string; level: string; message: string})
    return {result: JSON.parse(stdout()) as unknown, events}
  })
}

// Boxes wrap text across lines and draw borders, so compare their text with the borders and line breaks removed.
function boxText(output: string): string {
  return output.replaceAll(/[│╭╮╰╯─]/g, ' ').replace(/\s+/g, ' ')
}

describe('literalGlobPattern', () => {
  test.each([
    ['apps/[child]', 'apps/c'],
    ['apps/{a,b}', 'apps/a'],
    ['apps/a*b', 'apps/aXb'],
    ['apps/x?y', 'apps/xzy'],
    ['#child', 'child'],
    ['!child', 'src'],
  ])('gives a glob that matches %s and not %s', (directory, sibling) => {
    const pattern = literalGlobPattern(directory)

    expect(matchGlob(directory, pattern)).toBe(true)
    expect(matchGlob(sibling, pattern)).toBe(false)
  })

  test('gives an --exclude that removes only that directory from the gathered files', async () => {
    await inTemporaryDirectory(async (directory) => {
      const root = await fileRealPath(directory)
      await Promise.all(['!child', '[child]', 'c', 'src'].map((name) => mkdir(joinPath(root, name))))
      await Promise.all([
        writeFile(joinPath(root, 'shopify.app.toml'), validAppConfiguration()),
        writeFile(joinPath(root, '!child', 'shopify.app.toml'), 'name = "Negated"\n'),
        writeFile(joinPath(root, '[child]', 'shopify.app.toml'), 'name = "Bracketed"\n'),
        writeFile(joinPath(root, 'c', 'index.ts'), 'export const c = true\n'),
        writeFile(joinPath(root, 'src', 'index.ts'), 'export const src = true\n'),
      ])
      vi.stubEnv('INIT_CWD', root)

      const gathered = await listAppSecurityFiles({
        appDirectory: root,
        scanDirectories: [root],
        requestedScanDirectories: [root],
        excludePatterns: ['!child', '[child]'].map(literalGlobPattern),
      })

      expect(gathered.paths).toEqual(['c/index.ts', 'shopify.app.toml', 'src/index.ts'])
      expect(gathered.otherAppDirectories).toEqual([])
    })
  })
})

describe('renderSecurityCheckPromptsTip', () => {
  test('shows the command that repeats the run without prompts on stderr', async () => {
    const commands = resolveAppSecurityCommands(selection, appDirectory, noScope)

    const {stdout, stderr} = await withCapturedStandardStreams(({stdout, stderr}) => {
      renderSecurityCheckPromptsTip(commands)
      return {stdout: stdout(), stderr: unstyled(stderr())}
    })

    expect(stdout).toBe('')
    expect(boxText(stderr)).toContain(
      `To skip these prompts next time, run: \`${formatAppSecurityCommand(commands.scan)}\``,
    )
  })
})

describe('renderSecurityCheckResult gathering warnings', () => {
  /** The warning for a directory that holds another app configuration, quoted for the shell the tests run in. */
  function otherAppWarning(displayPath: string, excludePattern = displayPath) {
    return `${displayPath} holds another app's configuration, so its files are scanned as part of this app. Use \`--exclude ${quoteShellArgument(excludePattern, shellForPlatform())}\` to leave it out.`
  }

  test('warns once for each scan directory that Git ignores, relative to the working directory, before the report', async () => {
    await inTemporaryDirectory(async (directory) => {
      const realDirectory = await fileRealPath(directory)
      vi.stubEnv('INIT_CWD', directory)
      const execution = {
        ...scanExecution,
        ignoredScanDirectories: [joinPath(realDirectory, 'unlinked-app'), realDirectory],
      }

      const {stderr} = await present(scanned({execution}))

      const warnings = boxText(stderr)
      const first = 'unlinked-app is ignored by Git, so only the files Git tracks in it are scanned.'
      const second = '. is ignored by Git, so only the files Git tracks in it are scanned.'
      expect(warnings).toContain(`${first} Use \`--no-git-ignore\` to scan everything in it.`)
      expect(warnings).toContain(`${second} Use \`--no-git-ignore\` to scan everything in it.`)
      expect(warnings.indexOf(first)).toBeLessThan(warnings.indexOf(second))
      expect(warnings.indexOf(second)).toBeLessThan(warnings.indexOf('No security issues found.'))
    })
  })

  test('warns once for each directory that holds another app configuration, with the --exclude that leaves it out', async () => {
    await inTemporaryDirectory(async (directory) => {
      const realDirectory = await fileRealPath(directory)
      vi.stubEnv('INIT_CWD', directory)
      const execution = {
        ...scanExecution,
        otherAppDirectories: [joinPath(realDirectory, 'apps', 'child'), joinPath(realDirectory, '..', 'backend')],
      }

      const {stderr} = await present(scanned({execution}))

      expect(boxText(stderr)).toContain(otherAppWarning('apps/child'))
      expect(boxText(stderr)).toContain(otherAppWarning('../backend'))
    })
  })

  test('escapes and quotes a directory name that is glob and shell syntax', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.stubEnv('INIT_CWD', directory)
      const execution = {
        ...scanExecution,
        otherAppDirectories: [joinPath(await fileRealPath(directory), 'apps', '$(touch PWNED)')],
      }

      const {stderr} = await present(scanned({execution}))

      expect(boxText(stderr)).toContain(otherAppWarning('apps/$(touch PWNED)', 'apps/$\\(touch PWNED\\)'))
    })
  })

  test('shows warnings relative to the real working directory when it is reached through a symbolic link', async () => {
    await inTemporaryDirectory(async (directory) => {
      const app = joinPath(await fileRealPath(directory), 'app')
      await mkdir(app)
      const link = joinPath(directory, 'linked-app')
      await symlink(app, link, 'dir')
      vi.stubEnv('INIT_CWD', link)
      const execution = {...scanExecution, otherAppDirectories: [joinPath(app, 'apps', 'child')]}

      const {stderr} = await present(scanned({execution}))

      expect(boxText(stderr)).toContain(otherAppWarning('apps/child'))
    })
  })

  test('does not warn when no scan directory is ignored', async () => {
    const {stderr} = await present(scanned())

    expect(stderr).not.toContain('ignored by Git')
    expect(stderr).not.toContain("another app's configuration")
  })
})

describe('renderSecurityCheckResult for a scan', () => {
  test('renders the report on stderr and leaves stdout and the exit code alone', async () => {
    process.exitCode = undefined
    const dependencies = testDependencies()

    const {stdout, stderr} = await present(scanned(), {}, dependencies)

    expect(stdout).toBe('')
    const report = boxText(stderr)
    expect(report).toContain('No security issues found.')
    expect(report).toContain('Config file shopify.app.toml')
    expect(report).toContain('31 checks ready for your coding agent.')
    expect(report).toContain('Deterministic findings: .shopify/app-security/shopify.app/deterministic-findings.json')
    expect(process.exitCode).toBeUndefined()
  })

  test('shows every occurrence with --verbose', async () => {
    const execution = {
      ...scanExecution,
      scan: {
        ...scan,
        issues: [committedSecretIssue, {...committedSecretIssue, location: {file: 'app/routes/other.ts'}}],
      },
    }

    const {stderr} = await present(scanned({execution}), {verbose: true})

    expect(boxText(stderr)).toContain('Fix: remove it')
  })

  test('does not offer coding-agent instructions in CI or another non-interactive environment', async () => {
    const dependencies = testDependencies('copy', false)

    const {stdout} = await present(scanned(), {}, dependencies)

    expect(dependencies.canPrompt).toHaveBeenCalledOnce()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(clipboard.write).not.toHaveBeenCalled()
    expect(stdout).toBe('')
  })

  test('offers the instructions after the report, with copying first', async () => {
    let stderrWhenPrompted = ''
    const dependencies = testDependencies('nothing', true)

    const {stdout} = await withCapturedStandardStreams(async ({stdout, stderr}) => {
      dependencies.selectInstructionsDestination.mockImplementation(async () => {
        stderrWhenPrompted = unstyled(stderr())
        return 'nothing'
      })
      await renderSecurityCheckResult(scanned(), presentationOptions, 'text', dependencies)
      return {stdout: stdout()}
    })

    expect(appSecurityInstructionsPrompt(31, 'text')).toEqual({
      message:
        '31 recommended agent checks available to complete your scan. How do you want to pass that prompt to your agent?',
      choices: [
        {label: 'Copy instructions to the clipboard', value: 'copy'},
        {label: 'Print instructions to the terminal', value: 'print'},
        {label: 'Nothing', value: 'nothing'},
      ],
      defaultValue: 'copy',
    })
    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledExactlyOnceWith(
      appSecurityInstructionsPrompt(31, 'text'),
    )
    expect(boxText(stderrWhenPrompted)).toContain('No security issues found.')
    expect(stdout).toBe('')
    expect(clipboard.write).not.toHaveBeenCalled()
  })

  test('names a single recommended agent check in the singular', () => {
    expect(appSecurityInstructionsPrompt(1, 'text').message).toBe(
      '1 recommended agent check available to complete your scan. How do you want to pass that prompt to your agent?',
    )
  })

  test('copies the instructions for the scan that just ran and confirms on stderr', async () => {
    const check = scanned()

    const {stdout, stderr} = await present(check, {}, testDependencies('copy', true))

    expect(clipboard.write).toHaveBeenCalledExactlyOnceWith(scanInstructions(check))
    expect(scanInstructions(check)).toContain('### 1. Use the existing scan results')
    expect(stderr).toContain('Copied app security check instructions to the clipboard')
    expect(stdout).toBe('')
  })

  test('prints the instructions for the scan that just ran when selected', async () => {
    const check = scanned()

    const {stdout} = await present(check, {}, testDependencies('print', true))

    expect(stdout).toBe(`${scanInstructions(check)}\n`)
    expect(clipboard.write).not.toHaveBeenCalled()
  })

  test('gives the instructions the exact scope of the run, as typed', async () => {
    const scope = {include_dirs: ['backend', './backend/'], excludes: ['**/generated', '!keep'], no_git_ignore: true}
    const check = scanned({scope})

    const {stdout} = await present(check, {printInstructions: true})

    expect(stdout).toContain(JSON.stringify(scope))
    expect(stdout).toContain(formatAppSecurityCommand(check.commands.scan))
  })

  test('does nothing when selected', async () => {
    const dependencies = testDependencies('nothing', true)

    const {stdout} = await present(scanned(), {}, dependencies)

    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledOnce()
    expect(clipboard.write).not.toHaveBeenCalled()
    expect(stdout).toBe('')
  })

  test.each([false, true])(
    '--print-instructions prints without a delivery prompt (interactive=%s)',
    async (interactive) => {
      const check = scanned()
      const dependencies = testDependencies('copy', interactive)

      const {stdout} = await present(check, {printInstructions: true}, dependencies)

      expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
      expect(stdout).toBe(`${scanInstructions(check)}\n`)
    },
  )

  test('--skip-instructions never offers instructions', async () => {
    const dependencies = testDependencies('copy', true)

    const {stdout} = await present(scanned(), {skipInstructions: true}, dependencies)

    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(clipboard.write).not.toHaveBeenCalled()
    expect(stdout).toBe('')
  })

  test.each([
    {level: 'none', blockedChecks: 0, exitCode: undefined},
    {level: 'high', blockedChecks: 1, exitCode: 1},
  ] as const)(
    'warns instead of aborting when the instructions cannot be copied, and exits as --blocking $level requires',
    async ({level, blockedChecks, exitCode}) => {
      process.exitCode = undefined
      vi.mocked(clipboard.write).mockRejectedValue(new Error('Command failed with ENOENT: pbcopy'))
      const execution = {...scanExecution, scan: {...scan, issues: [committedSecretIssue]}}
      const check = scanned({execution, blocking: {level, blockedChecks}})

      const {stdout, stderr} = await present(check, {}, testDependencies('copy', true))

      const warning = boxText(stderr)
      expect(warning).toContain(
        "Couldn't copy the app security check instructions to the clipboard: Command failed with ENOENT: pbcopy",
      )
      expect(warning).toContain('Run the check again with `--print-instructions` to print them.')
      expect(warning.indexOf('1 security issue found.')).toBeLessThan(warning.indexOf("Couldn't copy"))
      expect(warning).not.toContain('Copied app security check instructions')
      expect(stdout).toBe('')
      expect(process.exitCode).toBe(exitCode)
    },
  )

  test('sets exit code 1 after the output when the scan breaches --blocking', async () => {
    process.exitCode = undefined
    const execution = {...scanExecution, scan: {...scan, issues: [committedSecretIssue]}}

    const {stdout, stderr} = await present(scanned({execution, blocking: {level: 'high', blockedChecks: 1}}), {
      printInstructions: true,
    })

    expect(boxText(stderr)).toContain('1 security issue found.')
    expect(stdout).toContain('### 1. Use the existing scan results')
    expect(process.exitCode).toBe(1)
  })
})

describe('renderSecurityCheckResult for --list-files', () => {
  test('prints each gathered path on its own line on stdout, after the gathering warnings on stderr', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.stubEnv('INIT_CWD', directory)
      const dependencies = testDependencies('copy', true)
      const check = listed({
        paths: ['../backend/server.ts', 'app/routes/index.ts', 'shopify.app.toml'],
        ignoredScanDirectories: [joinPath(await fileRealPath(directory), 'unlinked-app')],
      })

      const {stdout, stderr} = await present(check, {}, dependencies)

      expect(stdout).toBe('../backend/server.ts\napp/routes/index.ts\nshopify.app.toml\n')
      expect(boxText(stderr)).toContain(
        'unlinked-app is ignored by Git, so only the files Git tracks in it are scanned.',
      )
      expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    })
  })

  test('prints nothing when no path is gathered', async () => {
    const {stdout, stderr} = await present(listed({paths: []}))

    expect(stdout).toBe('')
    expect(stderr).toBe('')
  })
})

describe('renderSecurityCheckResult when scanning without app configuration was declined', () => {
  test('shows that no app configuration was found, with the next step, and leaves the exit code alone', async () => {
    process.exitCode = undefined

    const {stdout, stderr} = await present({kind: 'cancelled'})

    expect(stdout).toBe('')
    expect(boxText(stderr)).toContain(`No app configuration found at or above ${appDirectory}.`)
    expect(boxText(stderr)).toContain(
      'Pass `--path` to your app directory, or scan without app configuration with `--without-app-config --client-id <client-id>`.',
    )
    expect(process.exitCode).toBeUndefined()
  })
})

// Selections hold the app directory's real path and paths joined from it with forward slashes, even on Windows.
const onWindows = process.platform === 'win32'
const nativeAppDirectory = onWindows ? 'C:\\apps\\my-app' : '/apps/my-app'
const nativeSelection: AppSecuritySelection = {
  kind: 'config',
  appDirectory: nativeAppDirectory,
  appConfigFilePath: `${nativeAppDirectory}/shopify.app.toml`,
  configClientId: 'toml-client-id',
}

/** The absolute native path of a file below `/apps`, written out independently of the codec. */
function nativePath(relativePath: string): string {
  return onWindows ? `C:\\apps\\${relativePath.replaceAll('/', '\\')}` : `/apps/${relativePath}`
}

const nativeResultsDirectory = nativePath('my-app/.shopify/app-security/shopify.app')

/** The result of a scan of `nativeSelection` without findings or instructions. */
const scanResult = {
  status: 'success',
  valid: true,
  app: {
    directory: nativeAppDirectory,
    configurationPath: nativePath('my-app/shopify.app.toml'),
    clientId: 'toml-client-id',
  },
  resultsDirectory: nativeResultsDirectory,
  deterministicFindingsPath: nativePath('my-app/.shopify/app-security/shopify.app/deterministic-findings.json'),
  agentChecksPath: nativePath('my-app/.shopify/app-security/shopify.app/agent-checks.json'),
  scope: {includeDirs: [], excludes: [], noGitIgnore: false},
  scanDirectories: [{directory: nativeAppDirectory, origin: 'app-directory'}],
  agentCheckCount: 31,
  blocking: {level: 'none', blockedCheckCount: 0},
}

describe('renderSecurityCheckResult --json for a scan', () => {
  test('prints one result with the app, the files the scan wrote and its scope, and no report', async () => {
    process.exitCode = undefined

    const {result, events} = await presentJson(scanned({selection: nativeSelection}), {verbose: true})

    expect(result).toStrictEqual(scanResult)
    expect(events).toEqual([])
    expect(process.exitCode).toBeUndefined()
  })

  test('shows the scope as typed and each scan directory with its absolute path and origin', async () => {
    const scope = {include_dirs: ['../backend'], excludes: ['**/generated'], no_git_ignore: true}
    const check = scanned({
      selection: nativeSelection,
      scope,
      scanDirectories: [
        {directory: nativeAppDirectory, origin: 'app_directory'},
        {directory: onWindows ? 'C:\\apps\\backend' : '/apps/backend', origin: 'include_dir'},
        {directory: onWindows ? 'C:\\apps\\shared\\theme' : '/apps/shared/theme', origin: 'app_config_directory'},
      ],
    })

    const {result} = await presentJson(check)

    expect(result).toMatchObject({
      scope: {includeDirs: ['../backend'], excludes: ['**/generated'], noGitIgnore: true},
      scanDirectories: [
        {directory: nativeAppDirectory, origin: 'app-directory'},
        {directory: nativePath('backend'), origin: 'include-dir'},
        {directory: nativePath('shared/theme'), origin: 'app-config-directory'},
      ],
    })
  })

  test('shows a scan without app configuration with a null configuration path', async () => {
    const noConfig: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory: nativeAppDirectory,
      clientId: 'flag-client-id',
      clientIdSource: 'flag',
    }

    const {result} = await presentJson({...scanned({selection: noConfig}), resultsKey: 'flag-client-id'})

    expect(result).toMatchObject({
      app: {directory: nativeAppDirectory, configurationPath: null, clientId: 'flag-client-id'},
      resultsDirectory: nativePath('my-app/.shopify/app-security/flag-client-id'),
    })
  })

  test('reports a --blocking breach as invalid, and sets exit code 1 after the result', async () => {
    process.exitCode = undefined
    const execution = {...scanExecution, scan: {...scan, issues: [committedSecretIssue]}}

    const {result} = await presentJson(
      scanned({selection: nativeSelection, execution, blocking: {level: 'high', blockedChecks: 1}}),
    )

    expect(result).toMatchObject({valid: false, blocking: {level: 'high', blockedCheckCount: 1}})
    expect(process.exitCode).toBe(1)
  })

  test('reports findings below --blocking, or --blocking none, as valid', async () => {
    process.exitCode = undefined
    const execution = {...scanExecution, scan: {...scan, issues: [committedSecretIssue]}}

    const {result} = await presentJson(scanned({execution, blocking: {level: 'none', blockedChecks: 0}}))

    expect(result).toMatchObject({valid: true, blocking: {level: 'none', blockedCheckCount: 0}})
    expect(process.exitCode).toBeUndefined()
  })

  test('--print-instructions includes the instructions in the result, without prompting or copying', async () => {
    const check = scanned({selection: nativeSelection})
    const dependencies = testDependencies('copy', true)

    const {result, events} = await presentJson(check, {printInstructions: true}, dependencies)

    expect(result).toStrictEqual({...scanResult, instructions: {content: scanInstructions(check), copied: false}})
    expect(events).toEqual([])
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(clipboard.write).not.toHaveBeenCalled()
  })

  test('offers to include the instructions in the result, and to copy them as well by default', async () => {
    const dependencies = testDependencies('nothing', true)

    await presentJson(scanned(), {}, dependencies)

    expect(appSecurityInstructionsPrompt(31, 'json')).toEqual({
      message:
        '31 recommended agent checks available to complete your scan. How do you want to pass that prompt to your agent?',
      choices: [
        {label: 'Include instructions in the JSON output and copy them to the clipboard', value: 'copy'},
        {label: 'Include instructions in the JSON output', value: 'print'},
        {label: 'Nothing', value: 'nothing'},
      ],
      defaultValue: 'copy',
    })
    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledExactlyOnceWith(
      appSecurityInstructionsPrompt(31, 'json'),
    )
  })

  test.each([
    {destination: 'copy', copied: true},
    {destination: 'print', copied: false},
  ] as const)(
    'includes the instructions when $destination is chosen, with copied $copied',
    async ({destination, copied}) => {
      const check = scanned({selection: nativeSelection})

      const {result, events} = await presentJson(check, {}, testDependencies(destination, true))

      expect(result).toStrictEqual({...scanResult, instructions: {content: scanInstructions(check), copied}})
      expect(events).toEqual([])
      expect(vi.mocked(clipboard.write).mock.calls).toEqual(copied ? [[scanInstructions(check)]] : [])
    },
  )

  test.each([
    ['Nothing is chosen', {}, testDependencies('nothing', true)],
    ['--skip-instructions is passed', {skipInstructions: true}, testDependencies('copy', true)],
    ['the terminal cannot prompt', {}, testDependencies('copy', false)],
  ])('leaves the instructions out when %s', async (_description, options, dependencies) => {
    const {result} = await presentJson(scanned({selection: nativeSelection}), options, dependencies)

    expect(result).toStrictEqual(scanResult)
    expect(clipboard.write).not.toHaveBeenCalled()
  })

  test.each([
    {level: 'none', blockedChecks: 0, valid: true, exitCode: undefined},
    {level: 'high', blockedChecks: 1, valid: false, exitCode: 1},
  ] as const)(
    'warns on stderr when the instructions cannot be copied, still includes them, and exits as --blocking $level requires',
    async ({level, blockedChecks, valid, exitCode}) => {
      process.exitCode = undefined
      vi.mocked(clipboard.write).mockRejectedValue(new Error('Command failed with ENOENT: pbcopy'))
      const execution = {...scanExecution, scan: {...scan, issues: [committedSecretIssue]}}
      const check = scanned({execution, blocking: {level, blockedChecks}})

      const {result, events} = await presentJson(check, {}, testDependencies('copy', true))

      expect(result).toMatchObject({valid, instructions: {content: scanInstructions(check), copied: false}})
      expect(events).toEqual([
        {
          type: 'diagnostic',
          timestamp: expect.any(String),
          level: 'warning',
          message:
            "Couldn't copy the app security check instructions to the clipboard: Command failed with ENOENT: pbcopy\n\nThe result still includes them.",
        },
      ])
      expect(process.exitCode).toBe(exitCode)
    },
  )

  test('reports gathering warnings as events on stderr', async () => {
    await inTemporaryDirectory(async (directory) => {
      const realDirectory = await fileRealPath(directory)
      vi.stubEnv('INIT_CWD', directory)
      const execution = {
        ...scanExecution,
        ignoredScanDirectories: [joinPath(realDirectory, 'vendor')],
        otherAppDirectories: [joinPath(realDirectory, 'apps', 'child')],
      }

      const {events} = await presentJson(scanned({execution}))

      expect(events).toEqual([
        {
          type: 'diagnostic',
          timestamp: expect.any(String),
          level: 'warning',
          message:
            'vendor is ignored by Git, so only the files Git tracks in it are scanned.\n\nUse --no-git-ignore to scan everything in it.',
        },
        {
          type: 'diagnostic',
          timestamp: expect.any(String),
          level: 'warning',
          message: `apps/child holds another app's configuration, so its files are scanned as part of this app.\n\nUse --exclude ${quoteShellArgument('apps/child', shellForPlatform())} to leave it out.`,
        },
      ])
    })
  })
})

describe('renderSecurityCheckPromptsTip --json', () => {
  test('shows the command that repeats the run without prompts as an event on stderr', async () => {
    const commands = resolveAppSecurityCommands(selection, appDirectory, noScope)

    const {stdout, stderr} = await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], async () => renderSecurityCheckPromptsTip(commands))
      return {stdout: stdout(), stderr: stderr()}
    })

    expect(stdout).toBe('')
    expect(JSON.parse(stderr)).toEqual({
      type: 'diagnostic',
      timestamp: expect.any(String),
      level: 'info',
      message: `To skip these prompts next time, run:\n\n${formatAppSecurityCommand(commands.scan)}`,
    })
  })
})

describe('renderSecurityCheckResult --json for --list-files', () => {
  test('prints one result with each gathered file as an absolute native path', async () => {
    const check = listed({
      selection: nativeSelection,
      paths: ['../backend/server.ts', 'app/routes/index.ts', 'shopify.app.toml'],
    })
    const dependencies = testDependencies('copy', true)

    const {result, events} = await presentJson(check, {}, dependencies)

    expect(result).toStrictEqual({
      status: 'success',
      app: scanResult.app,
      scope: {includeDirs: [], excludes: [], noGitIgnore: false},
      scanDirectories: [{directory: nativeAppDirectory, origin: 'app-directory'}],
      files: [
        {path: nativePath('backend/server.ts')},
        {path: nativePath('my-app/app/routes/index.ts')},
        {path: nativePath('my-app/shopify.app.toml')},
      ],
    })
    expect(events).toEqual([])
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
  })

  test('prints a result with no files when none is gathered', async () => {
    const {result} = await presentJson(listed({paths: []}))

    expect(result).toMatchObject({files: []})
  })
})

describe('renderSecurityCheckResult --json when scanning without app configuration was declined', () => {
  test('prints a cancelled result and leaves the exit code alone', async () => {
    process.exitCode = undefined

    const {result, events} = await presentJson({kind: 'cancelled'})

    expect(result).toStrictEqual({status: 'cancelled'})
    expect(events).toEqual([])
    expect(process.exitCode).toBeUndefined()
  })
})
