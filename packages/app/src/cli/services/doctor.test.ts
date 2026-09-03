import doctor, {appDoctorInstructionsPrompt} from './doctor.js'
import {describe, expect, test, vi} from 'vitest'
import {resolveAppDoctorCommands} from './app-doctor-commands.js'
import type {AppDoctorArtifactPaths} from './app-doctor-artifacts.js'
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
  schema_version: 1,
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

function testDependencies(execution: AppDoctorExecution = scanExecution) {
  return {
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
  }
}

describe('doctor', () => {
  test('executes, writes artifacts, then renders a report', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), verbose: true, blocking: 'high'}, dependencies)

    expect(dependencies.execute).toHaveBeenCalledWith({
      directory: '/tmp/unlinked-app',
      findingsPath: undefined,
    })
    expect(dependencies.writeArtifacts).toHaveBeenCalledWith(scanExecution)
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

  test('encodes a tagged JSON scan result', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), json: true, yes: true}, dependencies)

    expect(dependencies.execute).toHaveBeenCalledWith(expect.objectContaining({directory: '/tmp/unlinked-app'}))
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
