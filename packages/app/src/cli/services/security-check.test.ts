import securityCheck, {appSecurityInstructionsPrompt} from './security-check.js'
import {formatAppSecurityCommand, resolveAppSecurityCommands} from './app-security-commands.js'
import {appSecurityArtifactPaths, writeCheckArtifacts} from './app-security-artifacts.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {describe, expect, test, vi} from 'vitest'
import type {AppSecurityExecution} from './app-security-api.js'
import type {AppSecuritySelection} from './app-security-selection.js'
import type {AppSecurityInstructionsDestination} from './security-check.js'
import type {AgentChecks, DeterministicFindingsDocument, ScanResult} from './app-security-engine/index.js'

const scan: ScanResult = {
  version: '0.1.0',
  timestamp: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null},
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
  project: {commit: null, dirty: null},
  detection: scan.detection,
  coverage: {files_scanned: 1, files_skipped: [], gaps: []},
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
  })),
  instructions: 'review',
}

const scanExecution: AppSecurityExecution = {
  scan,
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

function testDependencies(
  execution: AppSecurityExecution = scanExecution,
  selection: AppSecuritySelection = configSelection,
) {
  return {
    resolveSelection: vi.fn(async () => selection),
    execute: vi.fn(async () => execution),
    writeArtifacts: vi.fn(async () => artifacts),
    canPrompt: vi.fn(() => false),
    selectInstructionsDestination: vi.fn(async (): Promise<AppSecurityInstructionsDestination> => 'nothing'),
    deliverInstructions: vi.fn(async () => {}),
    output: vi.fn(),
    renderInfo: vi.fn(),
    renderReport: vi.fn(),
    setExitCode: vi.fn(),
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
    ignorePatterns: [],
  }
}

describe('securityCheck', () => {
  test('executes, writes artifacts, then renders a report', async () => {
    const dependencies = testDependencies()

    await securityCheck({...testOptions(), verbose: true, blocking: 'high'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith({
      path: appDirectory,
      config: undefined,
      clientId: undefined,
      withoutAppConfig: false,
      allowPrompts: false,
    })
    expect(dependencies.execute).toHaveBeenCalledWith({
      appDirectory,
      appConfigFilePath: `${appDirectory}/shopify.app.toml`,
      clientId: 'toml-client-id',
      ignorePatterns: [],
    })
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(appDirectory, {deterministicFindings, agentChecks})
    expect(dependencies.renderReport).toHaveBeenCalledWith({
      scan,
      selection: configSelection,
      scanDirectories,
      engine,
      verbose: true,
      elapsedMilliseconds: 12,
      commands: resolveAppSecurityCommands(appDirectory, 'shopify.app.toml'),
      deterministicFindingsPath: artifacts.deterministicFindingsPath,
      agentChecksPath: artifacts.agentChecksPath,
      agentCheckCount: 31,
    })
    expect(dependencies.output).not.toHaveBeenCalled()
  })

  test('forwards the config name and includes --config in generated commands', async () => {
    const dependencies = testDependencies(scanExecution, {
      ...configSelection,
      appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`,
    })

    await securityCheck({...testOptions(), configName: 'staging'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({config: 'staging'}))
    expect(dependencies.execute).toHaveBeenCalledWith(
      expect.objectContaining({appConfigFilePath: `${appDirectory}/shopify.app.staging.toml`}),
    )
    expect(dependencies.renderReport).toHaveBeenCalledWith(
      expect.objectContaining({commands: resolveAppSecurityCommands(appDirectory, 'shopify.app.staging.toml')}),
    )
  })

  test('scans with the --client-id override as the effective client ID', async () => {
    const dependencies = testDependencies(scanExecution, {...configSelection, clientIdOverride: 'flag-client-id'})

    await securityCheck({...testOptions(), clientId: 'flag-client-id'}, dependencies)

    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({clientId: 'flag-client-id'}))
  })

  test('forwards ignorePatterns to the scan and repeats them in generated commands and instructions', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('print')
    const ignorePatterns = ['generated/', '!build/']

    await securityCheck({...testOptions(), ignorePatterns}, dependencies)

    const commands = resolveAppSecurityCommands(appDirectory, 'shopify.app.toml', ignorePatterns)
    expect(commands.scan.args).toContainEqual({flag: '--ignore', value: 'generated/'})
    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({ignorePatterns}))
    expect(dependencies.renderReport).toHaveBeenCalledWith(expect.objectContaining({commands}))
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith(expect.objectContaining({commands}))
  })

  test('re-scanning overwrites the check artifacts without prompting and leaves agent findings untouched', async () => {
    await inTemporaryDirectory(async (appRoot) => {
      const paths = appSecurityArtifactPaths(appRoot)
      await mkdir(paths.artifactDirectory)
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

  test('allows prompts only in an interactive terminal without --json', async () => {
    const interactive = testDependencies()
    interactive.canPrompt.mockReturnValue(true)
    await securityCheck({...testOptions(), skipInstructions: true}, interactive)
    expect(interactive.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: true}))

    const nonInteractive = testDependencies()
    await securityCheck({...testOptions(), skipInstructions: true}, nonInteractive)
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
      appConfigFilePath: undefined,
      clientId: 'flag-client-id',
      ignorePatterns: [],
    })
    expect(dependencies.renderInfo).not.toHaveBeenCalled()
    expect(dependencies.renderReport).toHaveBeenCalledWith(
      expect.objectContaining({commands: resolveAppSecurityCommands(appDirectory)}),
    )
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

    expect(dependencies.renderInfo).toHaveBeenCalledWith({
      headline: 'To skip these prompts next time, run:',
      body: [{command: formatAppSecurityCommand(resolveAppSecurityCommands(appDirectory).scan)}],
    })
    expect(dependencies.renderInfo.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.execute.mock.invocationCallOrder[0]!,
    )
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

  test('prints the engine, selection, deterministic findings, and agent checks path as JSON', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await securityCheck({...testOptions(), json: true, yes: true}, dependencies)

    expect(JSON.parse(dependencies.output.mock.calls[0]![0])).toEqual({
      engine,
      selection: {
        app_directory: appDirectory,
        app_config_file: `${appDirectory}/shopify.app.toml`,
        client_id: 'toml-client-id',
        client_id_source: 'config',
        scan_directories: scanDirectories,
      },
      deterministic_findings: deterministicFindings,
      agent_checks_path: artifacts.agentChecksPath,
    })
    expect(dependencies.renderReport).not.toHaveBeenCalled()
    expect(dependencies.resolveSelection).toHaveBeenCalledWith(expect.objectContaining({allowPrompts: false}))
    expect(dependencies.canPrompt).not.toHaveBeenCalled()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
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

    expect(appSecurityInstructionsPrompt).toEqual({
      message: 'How would you like to hand the results to your coding agent?',
      choices: [
        {label: 'Copy instructions to the clipboard', value: 'copy'},
        {label: 'Print instructions to the terminal', value: 'print'},
        {label: 'Nothing', value: 'nothing'},
      ],
      defaultValue: 'copy',
    })
    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledOnce()
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      appDirectory,
      copy: true,
      scanComplete: true,
      commands: resolveAppSecurityCommands(appDirectory, 'shopify.app.toml'),
    })
  })

  test('prints post-scan instructions when selected', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('print')

    await securityCheck(testOptions(), dependencies)

    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      appDirectory,
      copy: false,
      scanComplete: true,
      commands: resolveAppSecurityCommands(appDirectory, 'shopify.app.toml'),
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
      copy: false,
      scanComplete: true,
      commands: resolveAppSecurityCommands(appDirectory, 'shopify.app.toml'),
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

  test('keeps the default exit code when no finding reaches the blocking level', async () => {
    const dependencies = testDependencies()

    await securityCheck({...testOptions(), blocking: 'low'}, dependencies)

    expect(dependencies.setExitCode).not.toHaveBeenCalled()
  })
})
