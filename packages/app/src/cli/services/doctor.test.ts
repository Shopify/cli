import doctor, {appDoctorInstructionsPrompt} from './doctor.js'
import {formatAppDoctorCommand, resolveAppDoctorCommands} from './app-doctor-commands.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorArtifactPaths, ReadTraceResult, ResolvedAppDoctorArtifactPaths} from './app-doctor-artifacts.js'
import type {AppDoctorExecution} from './app-doctor-api.js'
import type {AppDoctorInstructionsDestination} from './doctor.js'
import type {ScanResult, TraceV2} from './app-doctor-engine/index.js'

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
  score: {total: 100, baseline: 100, grade: 'EXCELLENT'},
  scan: {
    timestamp: '2026-08-24T00:00:00.000Z',
    doctor_version: '0.1.0',
    files_scanned: 1,
    rules_run: 1,
    rules_skipped: 0,
    files_skipped_count: 0,
    coverage_complete: true,
    coverage_gaps: [],
    input_hash: 'sha256:input',
    result_hash: 'sha256:result',
    checks_executed: [],
  },
  issues: [],
}

const engine = {
  name: 'shopify-app-doctor',
  version: '1.2.3',
  ruleset: '2026.08.28',
}

const trace = {
  schema_version: 2,
  engine,
  generated_at: '2026-08-24T00:00:00.000Z',
  project: {commit: null, dirty: null, input_hash: 'sha256:input', input_hashes: {}},
  detection: scan.detection,
  score: scan.score,
  findings: [],
  checks_executed: [],
  suppressions: [],
  coverage: {files_scanned: 1, files_skipped: [], complete: true, gaps: []},
  attestation: {digest: 'sha256:digest', signed: false},
} as TraceV2

const reviewPack = {
  schema_version: 1 as const,
  source_scan_id: 'sha256:input',
  doctor_version: '1.2.3',
  generated_at: '2026-08-24T00:00:00.000Z',
  checks: Array.from({length: 31}, (_, index) => ({
    id: `CHECK_${index}`,
    version: 1,
    prompt_hash: 'sha256:prompt',
    prompt: 'prompt',
    severity: 'medium' as const,
  })),
  instructions: 'review',
}

const scanExecution: AppDoctorExecution = {
  operation: 'scan',
  appRoot: '/tmp/unlinked-app',
  scan,
  trace,
  reviewPack,
  engine,
  elapsedMilliseconds: 12,
}

const artifacts: AppDoctorArtifactPaths = {
  artifactDirectory: '/tmp/unlinked-app/.shopify/app-doctor',
  tracePath: '/tmp/unlinked-app/.shopify/app-doctor/trace.json',
  reviewPath: '/tmp/unlinked-app/.shopify/app-doctor/review.json',
}

const resolvedArtifacts: ResolvedAppDoctorArtifactPaths = {
  ...artifacts,
  reviewPath: artifacts.reviewPath!,
  findingsPath: '/tmp/unlinked-app/.shopify/app-doctor/findings.json',
  submissionPath: '/tmp/unlinked-app/.shopify/app-doctor/submission.json',
}

function testDependencies(execution: AppDoctorExecution = scanExecution) {
  return {
    resolveRoot: vi.fn(() => scanExecution.appRoot),
    artifactPaths: vi.fn(() => resolvedArtifacts),
    findingsFileExists: vi.fn(async () => false),
    readTrace: vi.fn<() => Promise<ReadTraceResult>>(async () => ({status: 'missing'})),
    execute: vi.fn(async () => execution),
    writeArtifacts: vi.fn(async () => artifacts),
    canPrompt: vi.fn(() => false),
    selectInstructionsDestination: vi.fn(async (): Promise<AppDoctorInstructionsDestination> => 'nothing'),
    deliverInstructions: vi.fn(async () => {}),
    output: vi.fn(),
    renderReport: vi.fn(),
    setExitCode: vi.fn(),
  }
}

function testOptions() {
  return {
    directory: '/tmp/unlinked-app',
    json: false,
    verbose: false,
    blocking: 'none' as const,
    yes: false,
    skipInstructions: false,
    clean: false,
  }
}

describe('doctor', () => {
  test('executes, writes artifacts, then renders a report', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), verbose: true, blocking: 'high'}, dependencies)

    expect(dependencies.resolveRoot).toHaveBeenCalledWith('/tmp/unlinked-app')
    expect(dependencies.execute).toHaveBeenCalledWith({
      appRoot: '/tmp/unlinked-app',
      findingsPath: undefined,
    })
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(scanExecution, {clean: false})
    expect(dependencies.renderReport).toHaveBeenCalledWith({
      scan,
      engine,
      verbose: true,
      elapsedMilliseconds: 12,
      commands: resolveAppDoctorCommands(scanExecution.appRoot),
      tracePath: artifacts.tracePath,
      reviewPath: artifacts.reviewPath,
      reviewCheckCount: 31,
      findings: undefined,
    })
    expect(dependencies.output).not.toHaveBeenCalled()
  })

  test('refuses to scan when agent findings exist', async () => {
    const dependencies = testDependencies()
    dependencies.findingsFileExists.mockResolvedValue(true)
    const commands = resolveAppDoctorCommands(scanExecution.appRoot)

    const error = await doctor(testOptions(), dependencies).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(AbortError)
    expect(error).toMatchObject({
      message: 'App Doctor did not start a new scan.',
      tryMessage: `Agent findings exist at:\n  ${resolvedArtifacts.findingsPath}\n\nCompile those findings:\n  ${formatAppDoctorCommand(commands.compile)}\n\nTo discard the current agent findings and start over:\n  ${formatAppDoctorCommand(commands.clean)}`,
    })
    expect(dependencies.execute).not.toHaveBeenCalled()
    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
    expect(dependencies.output).not.toHaveBeenCalled()
  })

  test('refuses to scan when a compiled trace exists without a findings file', async () => {
    const dependencies = testDependencies()
    const compiledTrace = structuredClone(trace)
    compiledTrace.suppressions.push({
      id: 'accepted-risk',
      finding_fingerprint: `sha256:${'f'.repeat(64)}`,
      justification: 'Accepted for this test.',
      provenance: {source: 'human', created_at: '2026-08-24T00:00:00.000Z'},
    })
    dependencies.readTrace.mockResolvedValue({status: 'ok', trace: compiledTrace})

    await expect(doctor(testOptions(), dependencies)).rejects.toBeInstanceOf(AbortError)

    expect(dependencies.findingsFileExists).not.toHaveBeenCalled()
    expect(dependencies.execute).not.toHaveBeenCalled()
  })

  test('prioritizes a compiled trace when both protected states exist', async () => {
    const dependencies = testDependencies()
    const compiledTrace = structuredClone(trace)
    compiledTrace.suppressions.push({
      id: 'accepted-risk',
      finding_fingerprint: `sha256:${'f'.repeat(64)}`,
      justification: 'Accepted for this test.',
      provenance: {source: 'human', created_at: '2026-08-24T00:00:00.000Z'},
    })
    dependencies.readTrace.mockResolvedValue({status: 'ok', trace: compiledTrace})
    dependencies.findingsFileExists.mockResolvedValue(true)
    const commands = resolveAppDoctorCommands(scanExecution.appRoot)

    const error = await doctor(testOptions(), dependencies).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(AbortError)
    expect(error).toMatchObject({
      message: 'App Doctor did not start a new scan.',
      tryMessage: `The existing trace contains agent review results:\n  ${resolvedArtifacts.tracePath}\n\nUse the existing trace, or discard the current review and start over:\n  ${formatAppDoctorCommand(commands.clean)}`,
    })
    expect(dependencies.execute).not.toHaveBeenCalled()
    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
  })

  test('allows an initial trace and bypasses the guard for compile and clean operations', async () => {
    const initialDependencies = testDependencies()
    initialDependencies.readTrace.mockResolvedValue({status: 'ok', trace})
    await doctor(testOptions(), initialDependencies)
    expect(initialDependencies.execute).toHaveBeenCalledOnce()

    const invalidTraceDependencies = testDependencies()
    invalidTraceDependencies.readTrace.mockResolvedValue({status: 'invalid', errors: ['invalid trace']})
    await doctor(testOptions(), invalidTraceDependencies)
    expect(invalidTraceDependencies.execute).toHaveBeenCalledOnce()

    const compileDependencies = testDependencies()
    compileDependencies.findingsFileExists.mockResolvedValue(true)
    await doctor({...testOptions(), findingsPath: '/tmp/custom-findings.json'}, compileDependencies)
    expect(compileDependencies.readTrace).not.toHaveBeenCalled()
    expect(compileDependencies.findingsFileExists).not.toHaveBeenCalled()
    expect(compileDependencies.execute).toHaveBeenCalledOnce()

    const cleanDependencies = testDependencies()
    cleanDependencies.findingsFileExists.mockResolvedValue(true)
    await doctor({...testOptions(), clean: true}, cleanDependencies)
    expect(cleanDependencies.readTrace).not.toHaveBeenCalled()
    expect(cleanDependencies.findingsFileExists).not.toHaveBeenCalled()
    expect(cleanDependencies.writeArtifacts).toHaveBeenCalledWith(scanExecution, {clean: true})
  })

  test('does not clean artifacts when the replacement scan fails', async () => {
    const dependencies = testDependencies()
    dependencies.execute.mockRejectedValue(new Error('scan failed'))

    await expect(doctor({...testOptions(), clean: true}, dependencies)).rejects.toThrow('scan failed')

    expect(dependencies.writeArtifacts).not.toHaveBeenCalled()
  })

  test('encodes a tagged JSON scan result', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), json: true, yes: true}, dependencies)

    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({appRoot: '/tmp/unlinked-app'}))
    expect(JSON.parse(dependencies.output.mock.calls[0]![0])).toEqual({
      operation: 'scan',
      engine,
      scan,
      trace,
      reviewPack,
    })
    expect(dependencies.renderReport).not.toHaveBeenCalled()
    expect(dependencies.canPrompt).not.toHaveBeenCalled()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
  })

  test('does not offer coding-agent instructions in CI or another non-interactive environment', async () => {
    const dependencies = testDependencies()

    await doctor(testOptions(), dependencies)

    expect(dependencies.canPrompt).toHaveBeenCalledOnce()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
  })

  test('prioritizes copying instructions that start from the scan results', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('copy')

    await doctor(testOptions(), dependencies)

    expect(appDoctorInstructionsPrompt).toEqual({
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
      directory: '/tmp/unlinked-app',
      copy: true,
      scanComplete: true,
      commands: resolveAppDoctorCommands(scanExecution.appRoot),
    })
  })

  test('prints post-scan instructions when selected', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.selectInstructionsDestination.mockResolvedValue('print')

    await doctor(testOptions(), dependencies)

    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      directory: '/tmp/unlinked-app',
      copy: false,
      scanComplete: true,
      commands: resolveAppDoctorCommands(scanExecution.appRoot),
    })
  })

  test('does nothing when selected', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await doctor(testOptions(), dependencies)

    expect(dependencies.selectInstructionsDestination).toHaveBeenCalledOnce()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
  })

  test('--yes prints post-scan instructions without prompting, including in CI', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), yes: true}, dependencies)

    expect(dependencies.canPrompt).not.toHaveBeenCalled()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).toHaveBeenCalledWith({
      directory: '/tmp/unlinked-app',
      copy: false,
      scanComplete: true,
      commands: resolveAppDoctorCommands(scanExecution.appRoot),
    })
  })

  test('--skip-instructions never offers instructions', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await doctor({...testOptions(), skipInstructions: true}, dependencies)

    expect(dependencies.canPrompt).not.toHaveBeenCalled()
    expect(dependencies.selectInstructionsDestination).not.toHaveBeenCalled()
    expect(dependencies.deliverInstructions).not.toHaveBeenCalled()
  })

  test('does not offer handoff instructions after compiling agent findings', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await doctor({...testOptions(), findingsPath: '/tmp/findings.json'}, dependencies)

    expect(dependencies.canPrompt).not.toHaveBeenCalled()
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

    await doctor({...testOptions(), blocking: 'high'}, dependencies)

    expect(dependencies.setExitCode).toHaveBeenCalledWith(1)
  })
})
