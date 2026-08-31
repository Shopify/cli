import doctor, {appDoctorInstructionsPrompt, formatDoctorOutput} from './doctor.js'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorRunOptions, AppDoctorRunResult} from './app-doctor-api.js'
import type {AppDoctorInstructionsDestination} from './doctor.js'

const engineResult: AppDoctorRunResult = {
  output: 'No security issues found.',
  engine: {
    name: 'shopify-app-doctor',
    version: '1.2.3',
    ruleset: '2026.08.28',
  },
  exitCode: 0,
}

function testDependencies(result: AppDoctorRunResult = engineResult) {
  return {
    runEngine: vi.fn(async (_options: AppDoctorRunOptions) => result),
    canPrompt: vi.fn(() => false),
    selectInstructionsDestination: vi.fn(async (): Promise<AppDoctorInstructionsDestination> => 'nothing'),
    deliverInstructions: vi.fn(async () => {}),
    output: vi.fn(),
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
  test('forwards scan options to the in-tree engine and reports engine versions', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), verbose: true, blocking: 'high'}, dependencies)

    expect(dependencies.runEngine).toHaveBeenCalledWith({
      directory: '/tmp/unlinked-app',
      format: 'human',
      verbose: true,
      blocking: 'high',
      findingsPath: undefined,
    })
    expect(dependencies.output).toHaveBeenCalledWith(
      'No security issues found.\n\nEngine: shopify-app-doctor 1.2.3\nRuleset: 2026.08.28',
    )
  })

  test('preserves the JSON report and includes engine and ruleset versions', async () => {
    const dependencies = testDependencies({
      ...engineResult,
      output: JSON.stringify({schema_version: 1, findings: []}),
    })

    await doctor({...testOptions(), json: true, yes: true}, dependencies)

    expect(dependencies.runEngine).toHaveBeenCalledWith(expect.objectContaining({format: 'json'}))
    expect(JSON.parse(dependencies.output.mock.calls[0]![0])).toEqual({
      schema_version: 1,
      findings: [],
      engine: engineResult.engine,
    })
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

describe('formatDoctorOutput', () => {
  test('keeps existing JSON engine fields while applying authoritative version metadata', () => {
    const output = formatDoctorOutput(
      {
        ...engineResult,
        output: JSON.stringify({engine: {commit: 'abc123'}, findings: []}),
      },
      true,
    )

    expect(JSON.parse(output).engine).toEqual({...engineResult.engine, commit: 'abc123'})
  })
})
