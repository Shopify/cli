import doctor, {appDoctorInstructionsPrompt} from './doctor.js'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorRunOptions, AppDoctorRunResult} from './app-doctor-api.js'
import type {AppDoctorInstructionsDestination} from './doctor.js'
import type {ScanResult} from './app-doctor-engine/types.js'

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

const engineResult: AppDoctorRunResult = {
  scan,
  engine: {
    name: 'shopify-app-doctor',
    version: '1.2.3',
    ruleset: '2026.08.28',
  },
  exitCode: 0,
  elapsedMilliseconds: 12,
  tracePath: '/tmp/unlinked-app/.shopify/app-doctor/trace.json',
  reviewPath: '/tmp/unlinked-app/.shopify/app-doctor/review.json',
  reviewCheckCount: 31,
  jsonReport: {schema_version: 1, findings: []},
}

function testDependencies(result: AppDoctorRunResult = engineResult) {
  return {
    runEngine: vi.fn(async (_options: AppDoctorRunOptions) => result),
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
  test('forwards scan options to the in-tree engine and renders a report', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), verbose: true, blocking: 'high'}, dependencies)

    expect(dependencies.runEngine).toHaveBeenCalledWith({
      directory: '/tmp/unlinked-app',
      blocking: 'high',
      findingsPath: undefined,
    })
    expect(dependencies.renderReport).toHaveBeenCalledWith({
      scan,
      engine: engineResult.engine,
      verbose: true,
      elapsedMilliseconds: 12,
      tracePath: engineResult.tracePath,
      reviewPath: engineResult.reviewPath,
      reviewCheckCount: 31,
      findings: undefined,
    })
    expect(dependencies.output).not.toHaveBeenCalled()
  })

  test('preserves the JSON report and includes engine and ruleset versions', async () => {
    const dependencies = testDependencies({
      ...engineResult,
      jsonReport: {schema_version: 1, findings: []},
    })

    await doctor({...testOptions(), json: true, yes: true}, dependencies)

    expect(dependencies.runEngine).toHaveBeenCalledWith(expect.objectContaining({blocking: 'none'}))
    expect(JSON.parse(dependencies.output.mock.calls[0]![0])).toEqual({
      schema_version: 1,
      findings: [],
      engine: engineResult.engine,
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

  test('uses the engine exit code for blocking findings', async () => {
    const dependencies = testDependencies({...engineResult, exitCode: 1})

    await doctor(testOptions(), dependencies)

    expect(dependencies.setExitCode).toHaveBeenCalledWith(1)
  })
})
