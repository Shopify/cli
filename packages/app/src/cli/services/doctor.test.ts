import doctor, {appDoctorSkillInstructionsPrompt, formatDoctorOutput} from './doctor.js'
import {describe, expect, test, vi} from 'vitest'
import type {AppDoctorRunOptions, AppDoctorRunResult} from './app-doctor-api.js'

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
    confirmShowSkillInstructions: vi.fn(async () => false),
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
    skipSkill: false,
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
    expect(dependencies.confirmShowSkillInstructions).not.toHaveBeenCalled()
    expect(dependencies.output).toHaveBeenCalledTimes(1)
  })

  test('does not offer skill instructions in CI or another non-interactive environment', async () => {
    const dependencies = testDependencies()

    await doctor(testOptions(), dependencies)

    expect(dependencies.canPrompt).toHaveBeenCalledOnce()
    expect(dependencies.confirmShowSkillInstructions).not.toHaveBeenCalled()
    expect(dependencies.output).toHaveBeenCalledTimes(1)
  })

  test('offers to show skill setup instructions without claiming it will perform setup', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)
    dependencies.confirmShowSkillInstructions.mockResolvedValue(true)

    await doctor(testOptions(), dependencies)

    expect(appDoctorSkillInstructionsPrompt).toEqual({
      message: 'Show setup instructions for the Shopify App Doctor skill?',
      confirmationMessage: 'Yes, show instructions',
      cancellationMessage: 'No, skip instructions',
      defaultValue: false,
    })
    expect(dependencies.confirmShowSkillInstructions).toHaveBeenCalledOnce()
    expect(dependencies.output).toHaveBeenCalledTimes(2)
    expect(dependencies.output.mock.calls[1]![0]).toContain('Shopify App Doctor skill setup instructions')
    expect(dependencies.output.mock.calls[1]![0]).toContain('engine 1.2.3 (ruleset 2026.08.28)')
    expect(dependencies.output.mock.calls[1]![0]).toContain("Shopify CLI didn't install or change")
  })

  test('--yes shows instructions without prompting or claiming setup occurred, including in CI', async () => {
    const dependencies = testDependencies()

    await doctor({...testOptions(), yes: true}, dependencies)

    expect(dependencies.canPrompt).not.toHaveBeenCalled()
    expect(dependencies.confirmShowSkillInstructions).not.toHaveBeenCalled()
    expect(dependencies.output).toHaveBeenCalledTimes(2)
    expect(dependencies.output.mock.calls[1]![0]).toContain('instructions only')
  })

  test('--skip-skill never offers instructions', async () => {
    const dependencies = testDependencies()
    dependencies.canPrompt.mockReturnValue(true)

    await doctor({...testOptions(), skipSkill: true}, dependencies)

    expect(dependencies.canPrompt).not.toHaveBeenCalled()
    expect(dependencies.confirmShowSkillInstructions).not.toHaveBeenCalled()
    expect(dependencies.output).toHaveBeenCalledTimes(1)
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
