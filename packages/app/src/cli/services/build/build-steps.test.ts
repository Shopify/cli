import {executeStep, BuildStep, BuildContext} from './build-steps.js'
import * as stepsIndex from './steps/index.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./steps/index.js')

describe('executeStep', () => {
  let mockContext: BuildContext

  beforeEach(() => {
    mockContext = {
      extension: {
        directory: '/test/dir',
        outputPath: '/test/output/index.js',
      } as ExtensionInstance,
      options: {
        stdout: {write: vi.fn()} as any,
        stderr: {write: vi.fn()} as any,
        app: {} as any,
        environment: 'production' as const,
      },
      stepResults: new Map(),
    }
  })

  const step: BuildStep = {
    id: 'test-step',
    displayName: 'Test Step',
    type: 'copy_files',
    config: {},
  }

  describe('success', () => {
    test('returns a successful StepResult with output', async () => {
      vi.mocked(stepsIndex.executeStepByType).mockResolvedValue({filesCopied: 3})

      const result = await executeStep(step, mockContext)

      expect(result.stepId).toBe('test-step')
      expect(result.displayName).toBe('Test Step')
      expect(result.success).toBe(true)
      expect(result.output).toEqual({filesCopied: 3})
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    test('logs step execution to stdout', async () => {
      vi.mocked(stepsIndex.executeStepByType).mockResolvedValue({})

      await executeStep(step, mockContext)

      expect(mockContext.options.stdout.write).toHaveBeenCalledWith('Executing step: Test Step\n')
    })
  })

  describe('failure', () => {
    test('throws a wrapped error when the step fails', async () => {
      vi.mocked(stepsIndex.executeStepByType).mockRejectedValue(new Error('something went wrong'))

      await expect(executeStep(step, mockContext)).rejects.toThrow(
        'Build step "Test Step" failed: something went wrong',
      )
    })

    test('returns a failure result and logs a warning when continueOnError is true', async () => {
      vi.mocked(stepsIndex.executeStepByType).mockRejectedValue(new Error('something went wrong'))

      const result = await executeStep({...step, continueOnError: true}, mockContext)

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('something went wrong')
      expect(mockContext.options.stderr.write).toHaveBeenCalledWith(
        'Warning: Step "Test Step" failed but continuing: something went wrong\n',
      )
    })
  })
})
