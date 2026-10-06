import securityCheck, {appSecurityInstructionsPrompt} from './security-check.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {appSecurityArtifactPaths, writeCheckArtifacts} from './app-security-artifacts.js'
import {resolveAppSecuritySelection} from './app-security-selection.js'
import {validAppConfiguration} from './app-security-selection.test-data.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, fileRealPath, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {cwd, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'
import type {AppSecurityExecution} from './app-security-api.js'
import type {AppSecurityInstructionsDelivery} from './app-security-instructions-output.js'
import type {AppSecuritySelection, AppSecuritySelectionOptions} from './app-security-selection.js'
import type {AppSecurityInstructionsDestination} from './security-check.js'
import type {
  AgentChecks,
  AppSecurityScope,
  DeterministicFindingsDocument,
  ScanResult,
} from './app-security-engine/index.js'

const scan: ScanResult = {
  version: '0.1.0',
  timestamp: '2026-08-24T00:00:00.000Z',
  app: {name: 'Test', type: 'public'},
  detection: {framework: 'none', surface: 'config_only', languages: []},
  capabilities: {
    theme_app_extension: false,
    app_embed: false,
    embedded_app: false,
    script_tags: false,
    webhooks: false,
    app_proxy: false,
    storefront_metafield_writes: false,
    has_backend: false,
    declared_ip_allowlist: false,
    checkout_extension: false,
  },
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    security_version: '0.1.0',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_gaps: [],
    checks_executed: [],
  },
  issues: [],
}

const engine = {
  name: 'shopify-app-security',
  version: '1.2.3',
  ruleset: '2026.08.28',
}

const deterministicFindings: DeterministicFindingsDocument = {
  schema_version: 1,
  source: 'deterministic',
  engine: {name: 'shopify-app-security', version: '1.2.3', ruleset: '2026.08.28'},
  generated_at: '2026-08-24T00:00:00.000Z',
  detection: scan.detection,
  coverage: {
    files_scanned: 1,
    files_skipped: [],
    gaps: [],
    scope: {include_dirs: [], excludes: [], no_git_ignore: false},
    scan_directories: [{directory: '.', origin: 'app_directory'}],
  },
  checks: [],
}

const agentChecks: AgentChecks = {
  schema_version: 1,
  engine: {name: 'shopify-app-security', version: '1.2.3'},
  generated_at: '2026-08-24T00:00:00.000Z',
  checks: Array.from({length: 31}, (_, index) => ({
    id: `CHECK_${index}`,
    version: 1,
    prompt: 'prompt',
    severity: 'medium' as const,
    docs_url: `https://shopify.dev/docs/apps/build/security/app-security-checks/check-${index}`,
  })),
  instructions: 'review',
}

const scanExecution: AppSecurityExecution = {
  scan,
  ignoredScanDirectories: [],
  deterministicFindings,
  agentChecks,
  engine,
  elapsedMilliseconds: 12,
}

const artifacts = {
  deterministicFindingsPath: '/tmp/unlinked-app/.shopify/app-security/deterministic-findings.json',
  agentChecksPath: '/tmp/unlinked-app/.shopify/app-security/agent-checks.json',
}

const appDirectory = '/tmp/unlinked-app'

const configSelection: AppSecuritySelection = {
  kind: 'config',
  appDirectory,
  appConfigFilePath: `${appDirectory}/shopify.app.toml`,
  configClientId: 'toml-client-id',
}

const scanDirectories = [{directory: appDirectory, origin: 'app_directory' as const}]

const noScope: AppSecurityScope = {include_dirs: [], excludes: [], no_git_ignore: false}

/** The commands `check` generates for `--path` `appDirectory`, run from some other directory. */
function commandsFor(selection: AppSecuritySelection = configSelection, scope: AppSecurityScope = noScope) {
  return resolveAppSecurityCommands(selection, appDirectory, scope)
}

function stagingSelection(): AppSecuritySelection {
  return {
    kind: 'config',
    appDirectory,
    appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`,
    configClientId: 'toml-client-id',
  }
}

function testDependencies(
  execution: AppSecurityExecution = scanExecution,
  selection: AppSecuritySelection = configSelection,
) {
  return {
    resolveSelection: vi.fn(async () => selection),
    execute: vi.fn(async () => execution),
    listFiles: vi.fn(async () => ({paths: ['shopify.app.toml'], ignoredScanDirectories: [] as string[]})),
    writeArtifacts: vi.fn(async () => artifacts),
    canPrompt: vi.fn(() => false),
    selectInstructionsDestination: vi.fn(async (): Promise<AppSecurityInstructionsDestination> => 'nothing'),
    deliverInstructions: vi.fn(
      async (options: {copy: boolean}): Promise<AppSecurityInstructionsDelivery> => ({
        content: 'post-scan instructions',
        copiedToClipboard: options.copy,
      }),
    ),
    output: vi.fn(),
    renderInfo: vi.fn(),
    renderWarning: vi.fn(),
    outputInfo: vi.fn(),
    outputWarn: vi.fn(),
    renderReport: vi.fn(),
    setExitCode: vi.fn(),
    recordMetadata: vi.fn(async () => {}),
  }
}

function testOptions() {
  return {
    directory: appDirectory,
    withoutAppConfig: false,
    json: false,
    verbose: false,
    blocking: 'none' as const,
    yes: false,
    skipInstructions: false,
    includeDirs: [],
    excludePatterns: [],
    noGitIgnore: false,
    listFiles: false,
  }
}

describe('securityCheck', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('executes, writes artifacts, then renders a report', async () => {
    const dependencies = testDependencies()

    await securityCheck({...testOptions(), verbose: true, blocking: 'high'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith({
      path: appDirectory,
      config: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      allowPrompts: false,
      validateClientIdFlag: true,
    })
    expect(dependencies.execute).toHaveBeenCalledWith({
      appDirectory,
      scanDirectories: [appDirectory],
      requestedScanDirectories: [appDirectory],
      appConfigFilePath: `${appDirectory}/shopify.app.toml`,
      clientId: 'toml-client-id',
      includeDirs: [],
      excludePatterns: [],
      noGitIgnore: false,
    })
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appDirectory, 'shopify.app', {
      deterministicFindings,
      agentChecks,
    })
    expect(dependencies.renderReport).toHaveBeenCalledWith({
      scan,
      selection: configSelection,
      scanDirectories,
      engine,
      verbose: true,
      elapsedMilliseconds: 12,
      commands: commandsFor(),
      deterministicFindingsPath: artifacts.deterministicFindingsPath,
      agentChecksPath: artifacts.agentChecksPath,
      agentCheckCount: 31,
    })
    expect(dependencies.output).not.toHaveBeenCalled()
  })

  test('forwards the config name and includes --config in generated commands', async () => {
    const dependencies = testDependencies(scanExecution, stagingSelection())

    await securityCheck({...testOptions(), configName: 'staging'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({config: 'staging'}))
    expect(dependencies.execute).toHaveBeenCalledWith(
      expect.objectContaining({appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`}),
    )
    expect(dependencies.renderReport).toHaveBeenCalledWith(
      expect.objectContaining({commands: commandsFor(stagingSelection())}),
    )
  })

  test('scans with the --client-id override as the effective client ID', async () => {
    const dependencies = testDependencies(scanExecution, {...configSelection, clientIdOverride: 'flag-client-id'})

    await securityCheck({...testOptions(), clientId: 'flag-client-id'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
  })

  test('forwards the scope flags to the scan and repeats them in generated commands and instructions', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('print')
    const excludePatterns = ['generated', '../shared/**']

    await securityCheck({...testOptions(), excludePatterns, noGitIgnore: true}, dependencies)

    const commands = commandsFor(configSelection, {include_dirs: [], excludes: excludePatterns, no_git_ignore: true})
    expect(commands.scan.args).toContainEqual({flag: '--exclude', value: 'generated'})
    expect(commands.scan.args).toContain('--no-git-ignore')
    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({excludePatterns, noGitIgnore: true}))
    expect(dependencies.renderReport).toHaveBeenCalledWith(expect.objectContaining({commands}))
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith(expect.objectContaining({commands}))
  })

  test('scans each --include-dir after the app directory, reports it, and repeats it before --exclude', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const dependencies = testDependencies()
      dependencies.canPrompt.mockReturnValue(true)
      dependencies.selectInstructionsDestination.mockResolvedValue('print')
      const options = {...testOptions(), includeDirs: ['backend', './backend'], excludePatterns: ['generated']}

      await securityCheck(options, dependencies)

      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scanDirectories: [appDirectory, backend],
          requestedScanDirectories: [appDirectory, backend],
        }),
      )
      const commands = commandsFor(configSelection, {
        include_dirs: ['backend', './backend'],
        excludes: ['generated'],
        no_git_ignore: false,
      })
      expect(commands.scan.args.slice(-3)).toEqual([
        {flag: '--include-dir', value: 'backend'},
        {flag: '--include-dir', value: './backend'},
        {flag: '--exclude', value: 'generated'},
      ])
      expect(dependencies.renderReport).toHaveBeenCalledWith(
        expect.objectContaining({
          commands,
          scanDirectories: [
            {directory: appDirectory, origin: 'app_directory'},
            {directory: backend, origin: 'include_dir'},
          ],
        }),
      )
      expect(dependencies.deliverInstructions).toHaveBeenCalledWith(expect.objectContaining({commands}))
    })
  })

  test('lists absolute scan directories with their origins in the JSON selection', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const dependencies = testDependencies()

      await securityCheck({...testOptions(), json: true, includeDirs: ['backend']}, dependencies)

      expect(JSON.parse(dependencies.output.mock.calls[0]![0]).selection.scan_directories).toEqual([
        {directory: appDirectory, origin: 'app_directory'},
        {directory: backend, origin: 'include_dir'},
      ])
    })
  })

  test('leaves out an --include-dir inside the app directory, but still passes it for the Git ignore warning', async () => {
    await inTemporaryDirectory(async (directory) => {
      const realDirectory = await fileRealPath(directory)
      await mkdir(joinPath(directory, 'vendor'))
      vi.stubEnv('INIT_CWD', directory)
      const dependencies = testDependencies(scanExecution, {...configSelection, appDirectory: realDirectory})

      await securityCheck({...testOptions(), includeDirs: ['vendor']}, dependencies)

      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scanDirectories: [realDirectory],
          requestedScanDirectories: [realDirectory, await fileRealPath(joinPath(directory, 'vendor'))],
        }),
      )
    })
  })

  test('aborts on a wrong --include-dir before resolving the selection or scanning', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.stubEnv('INIT_CWD', directory)
      const dependencies = testDependencies()

      await expect(securityCheck({...testOptions(), includeDirs: ['missing']}, dependencies)).rejects.toThrow(
        "--include-dir missing: directory doesn't exist.",
      )

      expect(dependencies.resolveSelection).not.toHaveBeenCalled()
      expect(dependencies.execute).not.toHaveBeenCalled()
    })
  })

  test('warns once for each scan directory that Git ignores, relative to the working directory', async () => {
    vi.stubEnv('INIT_CWD', '/tmp')
    const dependencies = testDependencies({...scanExecution, ignoredScanDirectories: [appDirectory, '/tmp']})

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.renderWarning).toHaveBeenCalledTimes(2)
    expect(dependencies.renderWarning).toHaveBeenNthCalledWith(1, {
      headline: 'unlinked-app is ignored by Git, so only the files Git tracks in it are scanned.',
      body: ['Use', {command: '--no-git-ignore'}, 'to scan everything in it.'],
    })
    expect(dependencies.renderWarning).toHaveBeenNthCalledWith(2, {
      headline: '. is ignored by Git, so only the files Git tracks in it are scanned.',
      body: ['Use', {command: '--no-git-ignore'}, 'to scan everything in it.'],
    })
  })

  test('warns about each ignored scan directory as a diagnostic, not a banner, with --json', async () => {
    vi.stubEnv('INIT_CWD', '/tmp')
    const dependencies = testDependencies({...scanExecution, ignoredScanDirectories: [appDirectory]})

    await securityCheck({...testOptions(), json: true}, dependencies)

    expect(dependencies.renderWarning).not.toHaveBeenCalled()
    expect(dependencies.outputWarn).toHaveBeenCalledWith(
      'unlinked-app is ignored by Git, so only the files Git tracks in it are scanned. Use --no-git-ignore to scan everything in it.',
    )
  })

  test('does not warn when no scan directory is ignored', async () => {
    const dependencies = testDependencies()

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.renderWarning).not.toHaveBeenCalled()
  })

  test('re-scanning overwrites the check artifacts without prompting and leaves agent findings untouched', async () => {
    await inTemporaryDirectory(async (appRoot) => {
      const paths = appSecurityArtifactPaths(appRoot, 'shopify.app')
      await mkdir(paths.resultsDirectory)
      await writeFile(paths.deterministicFindingsPath, '{"previous": "scan"}\n')
      await writeFile(paths.agentChecksPath, '{"previous": "agent checks"}\n')
      // Not valid findings on purpose: check must not read, validate, or rewrite this file.
      const agentFindings = '{"recorded": "by the agent",  "kept": "byte for byte"}'
      await writeFile(paths.agentFindingsPath, agentFindings)

      const rescanFindings: DeterministicFindingsDocument = {
        ...deterministicFindings,
        generated_at: '2026-09-01T00:00:00.000Z',
      }
      const dependencies = {
        ...testDependencies(
          {...scanExecution, deterministicFindings: rescanFindings},
          {...configSelection, appDirectory: appRoot, appConfigFilePath: `${appRoot}/shopify.app.toml`},
        ),
        writeArtifacts: writeCheckArtifacts,
        canPrompt: vi.fn(() => true),
      }

      await securityCheck({...testOptions(), directory: appRoot, skipInstructions: true}, dependencies)

      expect(JSON.parse(await readFile(paths.deterministicFindingsPath))).toEqual(rescanFindings)
      expect(JSON.parse(await readFile(paths.agentChecksPath))).toEqual(agentChecks)
      await expect(readFile(paths.agentFindingsPath)).resolves.toBe(agentFindings)
      expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
      expect(dependencies.renderReport).toHaveBeenCalledWith(
        expect.objectContaining({
          deterministicFindingsPath: paths.deterministicFindingsPath,
          agentChecksPath: paths.agentChecksPath,
        }),
      )
      expect(dependencies.setExitCode).not.toHaveBeenCalled()
    })
  })

  test.each([false, true])('allows prompts only in an interactive terminal, with json %s', async (json) => {
    const interactive = testDependencies()
    interactive.canPrompt.mockReturnValue(true)
    await securityCheck({...testOptions(), json, skipInstructions: true}, interactive)
    expect(interactive.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: true}))

    const nonInteractive = testDependencies()
    await securityCheck({...testOptions(), json, skipInstructions: true}, nonInteractive)
    expect(nonInteractive.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: false}))
  })

  test('scans without app configuration, with no selected TOML and the client ID from the flag', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'flag-client-id',
      clientIdSource: 'flag',
    }
    const dependencies = testDependencies(scanExecution, selection)
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck(
      {...testOptions(), withoutAppConfig: true, clientId: 'flag-client-id', skipInstructions: true},
      dependencies,
    )

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(
      expect.objectContaining({withoutAppConfig: true, clientId: 'flag-client-id'}),
    )
    expect(dependencies.execute).toHaveBeenCalledWith({
      appDirectory,
      scanDirectories: [appDirectory],
      requestedScanDirectories: [appDirectory],
      appConfigFilePath: undefined,
      clientId: 'flag-client-id',
      includeDirs: [],
      excludePatterns: [],
      noGitIgnore: false,
    })
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appDirectory, 'flag-client-id', expect.anything())
    expect(dependencies.renderInfo).not.toHaveBeenCalled()
    expect(dependencies.renderReport).toHaveBeenCalledWith(expect.objectContaining({commands: commandsFor(selection)}))
  })

  test('shows the generated check command after the no-TOML prompt flow', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'picked-client-id',
      clientIdSource: 'picker',
    }
    const dependencies = testDependencies(scanExecution, selection)
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck({...testOptions(), skipInstructions: true}, dependencies)

    const {scan} = commandsFor(selection)
    expect(scan.args.slice(-2)).toEqual([{flag: '--client-id', value: 'picked-client-id'}, '--without-app-config'])
    expect(dependencies.renderInfo).toHaveBeenCalledWith({
      headline: 'To skip these prompts next time, run:',
      body: [{command: formatAppSecurityCommand(scan)}],
    })
    expect(dependencies.renderInfo.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.execute.mock.invocationCallOrder[0]!,
    )
    expect(dependencies.outputInfo).not.toHaveBeenCalled()
  })

  test('shows the generated check command as a diagnostic, not a banner, after prompts with --json', async () => {
    const selection: AppSecuritySelection = {
      kind: 'no-config',
      appDirectory,
      clientId: 'picked-client-id',
      clientIdSource: 'picker',
    }
    const dependencies = testDependencies(scanExecution, selection)
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck({...testOptions(), json: true, skipInstructions: true}, dependencies)

    expect(dependencies.renderInfo).not.toHaveBeenCalled()
    expect(dependencies.outputInfo).toHaveBeenCalledWith(
      `To skip these prompts next time, run: ${formatAppSecurityCommand(commandsFor(selection).scan)}`,
    )
  })

  test('shows the generated check command, with --config, after asking which TOML to scan', async () => {
    const selection: AppSecuritySelection = {
      kind: 'config',
      appDirectory,
      appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`,
      configClientId: 'toml-client-id',
      appConfigFilePicked: true,
    }
    const dependencies = testDependencies(scanExecution, selection)
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck({...testOptions(), skipInstructions: true}, dependencies)

    const {scan} = commandsFor(selection)
    expect(scan.args).toContainEqual({flag: '--config', value: 'staging'})
    expect(dependencies.renderInfo).toHaveBeenCalledWith({
      headline: 'To skip these prompts next time, run:',
      body: [{command: formatAppSecurityCommand(scan)}],
    })
  })

  test('does not show the prompt-flow command when a TOML was found', async () => {
    const dependencies = testDependencies()

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.renderInfo).not.toHaveBeenCalled()
  })

  test('does not write artifacts when the scan fails', async () => {
    const dependencies = testDependencies()
    dependencies.execute.mockRejectedValue(new Error('scan failed'))

    await expect(securityCheck(testOptions(), dependencies)).rejects.toThrow('scan failed')

    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
  })

  test('prints the selection, deterministic findings, agent checks path and instructions as JSON', async () => {
    const dependencies = testDependencies()

    await securityCheck({...testOptions(), json: true, yes: true}, dependencies)

    expect(dependencies.output).toHaveBeenCalledOnce()
    expect(JSON.parse(dependencies.output.mock.calls[0]![0])).toEqual({
      selection: {
        app_directory: appDirectory,
        app_config_file: `${appDirectory}/shopify.app.toml`,
        client_id: 'toml-client-id',
        client_id_source: 'config',
        scan_directories: scanDirectories,
      },
      deterministic_findings: deterministicFindings,
      agent_checks_path: artifacts.agentChecksPath,
      instructions: {content: 'post-scan instructions', copied_to_clipboard: false, path: null},
    })
    expect(dependencies.renderReport).not.toHaveBeenCalled()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      appDirectory,
      resultsKey: 'shopify.app',
      copy: false,
      json: true,
      scanScope: noScope,
      commands: commandsFor(),
    })
  })

  test('asks for the instructions before printing the JSON result in an interactive terminal', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('copy')

    await securityCheck({...testOptions(), json: true}, dependencies)

    expect(dependencies.selectInstructionsDestination.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.output.mock.invocationCallOrder[0]!,
    )
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith(expect.objectContaining({copy: true, json: true}))
    expect(JSON.parse(dependencies.output.mock.calls[0]![0]).instructions).toEqual({
      content: 'post-scan instructions',
      copied_to_clipboard: true,
      path: null,
    })
  })

  test.each([
    ['no instructions are chosen', {canPrompt: true, skipInstructions: false}],
    ['--skip-instructions is passed', {canPrompt: true, skipInstructions: true}],
    ['the terminal is not interactive', {canPrompt: false, skipInstructions: false}],
  ])('prints null instructions in the JSON result when %s', async (_, {canPrompt, skipInstructions}) => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(canPrompt)

    await securityCheck({...testOptions(), json: true, skipInstructions}, dependencies)

    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
    expect(JSON.parse(dependencies.output.mock.calls[0]![0]).instructions).toBeNull()
  })

  test('does not offer coding-agent instructions in CI or another non-interactive environment', async () => {
    const dependencies = testDependencies()

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.canPrompt).toHaveBeenCalledOnce()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
  })

  test('prioritizes copying instructions that start from the scan results', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('copy')

    await securityCheck(testOptions(), dependencies)

    expect(appSecurityInstructionsPrompt(31)).toEqual({
      message:
        '31 recommended agent checks available to complete your scan. How do you want to pass that prompt to your agent?',
      choices: [
        {label: 'Copy instructions to the clipboard', value: 'copy'},
        {label: 'Print instructions to the terminal', value: 'print'},
        {label: 'Nothing', value: 'nothing'},
      ],
      defaultValue: 'copy',
    })
    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledOnce()
    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledWith(31)
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      appDirectory,
      resultsKey: 'shopify.app',
      copy: true,
      json: false,
      scanScope: noScope,
      commands: commandsFor(),
    })
  })

  test('names a single recommended agent check in the singular', () => {
    expect(appSecurityInstructionsPrompt(1).message).toBe(
      '1 recommended agent check available to complete your scan. How do you want to pass that prompt to your agent?',
    )
  })

  test('gives the instructions the exact scope of the run, as typed', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const dependencies = testDependencies()

      await securityCheck(
        {
          ...testOptions(),
          yes: true,
          includeDirs: ['backend', './backend/'],
          excludePatterns: ['**/generated', '!keep'],
          noGitIgnore: true,
        },
        dependencies,
      )

      const scope = {
        include_dirs: ['backend', './backend/'],
        excludes: ['**/generated', '!keep'],
        no_git_ignore: true,
      }
      expect(dependencies.deliverInstructions).toHaveBeenCalledWith(
        expect.objectContaining({scanScope: scope, commands: commandsFor(configSelection, scope)}),
      )
      expect(dependencies.execute).toHaveBeenCalledWith(
        expect.objectContaining({includeDirs: ['backend', './backend/']}),
      )
    })
  })

  test('prints post-scan instructions when selected', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('print')

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      appDirectory,
      resultsKey: 'shopify.app',
      copy: false,
      json: false,
      scanScope: noScope,
      commands: commandsFor(),
    })
  })

  test('does nothing when selected', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledOnce()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
  })

  test('--yes prints post-scan instructions without prompting, including in CI', async () => {
    const dependencies = testDependencies()

    await securityCheck({...testOptions(), yes: true}, dependencies)

    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      appDirectory,
      resultsKey: 'shopify.app',
      copy: false,
      json: false,
      scanScope: noScope,
      commands: commandsFor(),
    })
  })

  test('--skip-instructions never offers instructions', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck({...testOptions(), skipInstructions: true}, dependencies)

    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
  })

  test('sets a blocking exit code from the execution result', async () => {
    const dependencies = testDependencies({
      ...scanExecution,
      scan: {
        ...scan,
        issues: [
          {
            id: 'COMMITTED_SECRET',
            severity: 'high',
            points: -25,
            title: 'Secret',
            message: 'secret',
            location: {file: 'app/routes/index.ts'},
            fix: {automated: false, description: 'remove it'},
          },
        ],
      },
    })

    await securityCheck({...testOptions(), blocking: 'high'}, dependencies)

    expect(dependencies.setExitCode).toHaveBeenCalledWith(1)
  })

  test('records the number of deterministic issues in the command metadata', async () => {
    const issue = {
      id: 'COMMITTED_SECRET',
      severity: 'high' as const,
      points: -25,
      title: 'Secret',
      message: 'secret',
      location: {file: 'app/routes/index.ts'},
      fix: {automated: false, description: 'remove it'},
    }
    const dependencies = testDependencies({
      ...scanExecution,
      scan: {...scan, issues: [issue, {...issue, location: {file: 'app/routes/other.ts'}}]},
    })

    await securityCheck({...testOptions(), json: true}, dependencies)

    expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 2})
  })

  test('records zero findings when the scan finds no issues', async () => {
    const dependencies = testDependencies()

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.recordMetadata).toHaveBeenCalledWith({num_security_findings: 0})
  })

  test('keeps the default exit code when no finding reaches the blocking level', async () => {
    const dependencies = testDependencies()

    await securityCheck({...testOptions(), blocking: 'low'}, dependencies)

    expect(dependencies.setExitCode).not.toHaveBeenCalled()
  })
})

describe('securityCheck --list-files', () => {
  const listFilesOptions = {...testOptions(), listFiles: true}

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('prints each gathered path on its own line and does nothing else', async () => {
    const dependencies = testDependencies()
    dependencies.listFiles.mockResolvedValue({
      paths: ['../backend/server.ts', 'app/routes/index.ts', 'shopify.app.toml'],
      ignoredScanDirectories: [],
    })

    await securityCheck(listFilesOptions, dependencies)

    expect(dependencies.output).toHaveBeenCalledOnce()
    expect(dependencies.output).toHaveBeenCalledWith('../backend/server.ts\napp/routes/index.ts\nshopify.app.toml')
    expect(dependencies.execute).not.toHaveBeenCalled()
    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
    expect(dependencies.renderReport).not.toHaveBeenCalled()
    expect(dependencies.renderInfo).not.toHaveBeenCalled()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
    expect(dependencies.setExitCode).not.toHaveBeenCalled()
  })

  test('prints {"files": [...]} with --json', async () => {
    const dependencies = testDependencies()
    dependencies.listFiles.mockResolvedValue({
      paths: ['app/routes/index.ts', 'shopify.app.toml'],
      ignoredScanDirectories: [],
    })

    await securityCheck({...listFilesOptions, json: true}, dependencies)

    expect(dependencies.output).toHaveBeenCalledOnce()
    expect(JSON.parse(dependencies.output.mock.calls[0]![0])).toEqual({
      files: ['app/routes/index.ts', 'shopify.app.toml'],
    })
  })

  test('prints nothing when no path is gathered, and an empty list with --json', async () => {
    const dependencies = testDependencies()
    dependencies.listFiles.mockResolvedValue({paths: [], ignoredScanDirectories: []})

    await securityCheck(listFilesOptions, dependencies)
    expect(dependencies.output).not.toHaveBeenCalled()

    await securityCheck({...listFilesOptions, json: true}, dependencies)
    expect(JSON.parse(dependencies.output.mock.calls[0]![0])).toEqual({files: []})
  })

  test('resolves without prompts, even in an interactive terminal', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck(listFilesOptions, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: false}))
  })

  test('gathers with the scan directories and the scope of the run, and ignores --client-id', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'backend'))
      vi.stubEnv('INIT_CWD', directory)
      const backend = await fileRealPath(joinPath(directory, 'backend'))
      const dependencies = testDependencies()

      await securityCheck(
        {
          ...listFilesOptions,
          clientId: 'ignored-client-id',
          includeDirs: ['backend'],
          excludePatterns: ['generated'],
          noGitIgnore: true,
        },
        dependencies,
      )

      expect(dependencies.listFiles).toHaveBeenCalledWith({
        appDirectory,
        scanDirectories: [appDirectory, backend],
        requestedScanDirectories: [appDirectory, backend],
        appConfigFilePath: `${appDirectory}/shopify.app.toml`,
        clientId: 'toml-client-id',
        includeDirs: ['backend'],
        excludePatterns: ['generated'],
        noGitIgnore: true,
      })
    })
  })

  test('warns about an ignored scan directory through renderWarning', async () => {
    const dependencies = testDependencies()
    dependencies.listFiles.mockResolvedValue({paths: ['shopify.app.toml'], ignoredScanDirectories: [appDirectory]})
    vi.stubEnv('INIT_CWD', '/tmp')

    await securityCheck(listFilesOptions, dependencies)

    expect(dependencies.renderWarning).toHaveBeenCalledWith({
      headline: 'unlinked-app is ignored by Git, so only the files Git tracks in it are scanned.',
      body: ['Use', {command: '--no-git-ignore'}, 'to scan everything in it.'],
    })
    expect(dependencies.output).toHaveBeenCalledWith('shopify.app.toml')
  })

  test('returns the selection, the results key and the generated check command', async () => {
    const dependencies = testDependencies()

    const resolution = await securityCheck(
      {...listFilesOptions, includeDirs: [], excludePatterns: ['generated'], noGitIgnore: true},
      dependencies,
    )

    expect(resolution.selection).toBe(configSelection)
    expect(resolution.resultsKey).toBe('shopify.app')
    expect(resolution.commands.scan.args).toEqual([
      'app',
      'security',
      'check',
      {flag: '--path', value: relativePath(cwd(), appDirectory)},
      {flag: '--exclude', value: 'generated'},
      '--no-git-ignore',
    ])
  })

  test('lists the real files, one path per line, and writes no results', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await fileRealPath(directory)
      await mkdir(joinPath(appRoot, 'app'))
      await mkdir(joinPath(appRoot, 'generated'))
      await writeFile(joinPath(appRoot, 'shopify.app.toml'), validAppConfiguration())
      await writeFile(joinPath(appRoot, 'app', 'index.ts'), 'export {}\n')
      await writeFile(joinPath(appRoot, 'generated', 'out.ts'), 'export {}\n')
      vi.stubEnv('INIT_CWD', appRoot)

      const {stdout, resolution} = await withCapturedStandardStreams(async ({stdout: captured}) => {
        const result = await securityCheck({
          ...listFilesOptions,
          directory: appRoot,
          excludePatterns: ['**/generated'],
        })
        return {stdout: captured(), resolution: result}
      })

      // Outside a repository, the `.shopify` files that resolving the selection writes are gathered too.
      expect(stdout).toBe(
        ['.shopify/.gitignore', '.shopify/project.json', 'app/index.ts', 'shopify.app.toml'].join('\n').concat('\n'),
      )
      expect(resolution.resultsKey).toBe('shopify.app')
      await expect(fileExists(joinPath(appRoot, '.shopify', 'app-security'))).resolves.toBe(false)
    })
  })

  test('lists the real files as JSON', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await fileRealPath(directory)
      await writeFile(joinPath(appRoot, 'shopify.app.toml'), validAppConfiguration(''))
      await writeFile(joinPath(appRoot, 'index.ts'), 'export {}\n')
      vi.stubEnv('INIT_CWD', appRoot)

      const stdout = await withCapturedStandardStreams(async ({stdout: captured}) => {
        await securityCheck({...listFilesOptions, directory: appRoot, json: true})
        return captured()
      })

      expect(JSON.parse(stdout)).toEqual({files: ['index.ts', 'shopify.app.toml']})
    })
  })
})

describe('securityCheck --client-id lookup', () => {
  const unknownClientId = new AbortError('No app with client ID unknown-client-id found')

  /** The real selection resolver, with the client ID lookup replaced. */
  function resolveSelectionWith(lookUpApp: (clientId: string) => Promise<void>) {
    return (options: AppSecuritySelectionOptions) =>
      resolveAppSecuritySelection(options, {
        confirmScanWithoutAppConfig: async () => true,
        pickClientId: async () => 'picked-client-id',
        pickConfigFile: async () => 'shopify.app.toml',
        lookUpApp,
      })
  }

  async function createApp(directory: string): Promise<string> {
    const appRoot = await fileRealPath(directory)
    await writeFile(joinPath(appRoot, 'shopify.app.toml'), validAppConfiguration('toml-client-id'))
    vi.stubEnv('INIT_CWD', appRoot)
    return appRoot
  }

  test.each([false, true])(
    'looks up --client-id and proceeds when it is found (--list-files: %s)',
    async (listFiles) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const lookUpApp = vi.fn(async (_clientId: string) => {})
        const dependencies = {...testDependencies(), resolveSelection: resolveSelectionWith(lookUpApp)}

        await securityCheck({...testOptions(), directory: appRoot, clientId: 'flag-client-id', listFiles}, dependencies)

        expect(lookUpApp).toHaveBeenCalledWith('flag-client-id')
        if (listFiles) {
          expect(dependencies.listFiles).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
        } else {
          expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appRoot, 'flag-client-id', expect.anything())
        }
      })
    },
  )

  test.each([false, true])(
    'aborts on an unknown --client-id before gathering files or writing results (--list-files: %s)',
    async (listFiles) => {
      await inTemporaryDirectory(async (directory) => {
        const appRoot = await createApp(directory)
        const dependencies = {
          ...testDependencies(),
          writeArtifacts: writeCheckArtifacts,
          resolveSelection: resolveSelectionWith(async () => {
            throw unknownClientId
          }),
        }

        await expect(
          securityCheck({...testOptions(), directory: appRoot, clientId: 'unknown-client-id', listFiles}, dependencies),
        ).rejects.toBe(unknownClientId)

        expect(dependencies.listFiles).not.toHaveBeenCalled()
        expect(dependencies.execute).not.toHaveBeenCalled()
        expect(dependencies.recordMetadata).not.toHaveBeenCalled()
        expect(dependencies.output).not.toHaveBeenCalled()
        await expect(fileExists(joinPath(appRoot, '.shopify', 'app-security'))).resolves.toBe(false)
      })
    },
  )

  test('does not look up the TOML client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appRoot = await createApp(directory)
      const lookUpApp = vi.fn(async (_clientId: string) => {})

      await securityCheck(
        {...testOptions(), directory: appRoot},
        {...testDependencies(), resolveSelection: resolveSelectionWith(lookUpApp)},
      )

      expect(lookUpApp).not.toHaveBeenCalled()
    })
  })
})
