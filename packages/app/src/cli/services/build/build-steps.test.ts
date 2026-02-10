import {executeBuildSteps, BuildStep, BuildContext, BuildStepsConfig, resolveConfigurableValue} from './build-steps.js'
import * as stepsIndex from './steps/index.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./steps/index.js')

describe('executeBuildSteps', () => {
  let mockExtension: ExtensionInstance
  let mockStdout: {write: ReturnType<typeof vi.fn>}
  let mockStderr: {write: ReturnType<typeof vi.fn>}
  let mockOptions: any

  beforeEach(() => {
    mockStdout = {write: vi.fn()}
    mockStderr = {write: vi.fn()}
    mockOptions = {
      stdout: mockStdout,
      stderr: mockStderr,
      app: {} as any,
      environment: 'production' as const,
    }
    mockExtension = {
      directory: '/test/dir',
      outputPath: '/test/output/index.js',
    } as ExtensionInstance
  })

  describe('execution', () => {
    test('executes steps in order and passes context', async () => {
      // Given
      const executionOrder: string[] = []

      vi.mocked(stepsIndex.executeStepByType).mockImplementation(async (step: BuildStep) => {
        executionOrder.push(step.id)
        return {success: true}
      })

      const stepsConfig: BuildStepsConfig = {
        steps: [
          {
            id: 'step1',
            displayName: 'Step 1',
            type: 'copy_files',
            config: {},
          },
          {
            id: 'step2',
            displayName: 'Step 2',
            type: 'copy_files',
            config: {},
          },
          {
            id: 'step3',
            displayName: 'Step 3',
            type: 'copy_files',
            config: {},
          },
        ],
      }

      // When
      await executeBuildSteps(mockExtension, stepsConfig, mockOptions)

      // Then
      expect(executionOrder).toEqual(['step1', 'step2', 'step3'])
      expect(stepsIndex.executeStepByType).toHaveBeenCalledTimes(3)
    })

    test('stops on first error when stopOnError is true', async () => {
      // Given
      vi.mocked(stepsIndex.executeStepByType)
        .mockResolvedValueOnce({success: true})
        .mockRejectedValueOnce(new Error('Step 2 failed'))

      const stepsConfig: BuildStepsConfig = {
        steps: [
          {
            id: 'step1',
            displayName: 'Step 1',
            type: 'copy_files',
            config: {},
          },
          {
            id: 'step2',
            displayName: 'Step 2',
            type: 'copy_files',
            config: {},
          },
          {
            id: 'step3',
            displayName: 'Step 3',
            type: 'copy_files',
            config: {},
          },
        ],
        stopOnError: true,
      }

      // When/Then
      await expect(executeBuildSteps(mockExtension, stepsConfig, mockOptions)).rejects.toThrow('Step 2 failed')

      // Only first two steps should be called
      expect(stepsIndex.executeStepByType).toHaveBeenCalledTimes(2)
    })

    test('continues on error when stopOnError is false', async () => {
      // Given
      vi.mocked(stepsIndex.executeStepByType)
        .mockResolvedValueOnce({success: true})
        .mockRejectedValueOnce(new Error('Step 2 failed'))
        .mockResolvedValueOnce({success: true})

      const stepsConfig: BuildStepsConfig = {
        steps: [
          {
            id: 'step1',
            displayName: 'Step 1',
            type: 'copy_files',
            config: {},
            continueOnError: false,
          },
          {
            id: 'step2',
            displayName: 'Step 2',
            type: 'copy_files',
            config: {},
            continueOnError: true,
          },
          {
            id: 'step3',
            displayName: 'Step 3',
            type: 'copy_files',
            config: {},
          },
        ],
        stopOnError: true,
      }

      // When
      await executeBuildSteps(mockExtension, stepsConfig, mockOptions)

      // Then
      expect(stepsIndex.executeStepByType).toHaveBeenCalledTimes(3)
      expect(mockStderr.write).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Step "Step 2" failed but continuing'),
      )
    })
  })

  describe('step results tracking', () => {
    test('tracks results from completed steps', async () => {
      // Given
      vi.mocked(stepsIndex.executeStepByType)
        .mockResolvedValueOnce({filesCopied: 5})
        .mockResolvedValueOnce({filesCopied: 10})

      const stepsConfig: BuildStepsConfig = {
        steps: [
          {
            id: 'step1',
            displayName: 'Step 1',
            type: 'copy_files',
            config: {},
          },
          {
            id: 'step2',
            displayName: 'Step 2',
            type: 'copy_files',
            config: {},
          },
        ],
      }

      // When
      await executeBuildSteps(mockExtension, stepsConfig, mockOptions)

      // Then
      // We can't directly inspect the context, but we can verify the steps were executed
      expect(stepsIndex.executeStepByType).toHaveBeenCalledTimes(2)
      expect(stepsIndex.executeStepByType).toHaveBeenNthCalledWith(
        1,
        stepsConfig.steps[0],
        expect.objectContaining({
          extension: mockExtension,
          options: mockOptions,
        }),
      )
    })

    test('tracks error results when continueOnError is true', async () => {
      // Given
      vi.mocked(stepsIndex.executeStepByType)
        .mockResolvedValueOnce({success: true})
        .mockRejectedValueOnce(new Error('Step 2 error'))
        .mockResolvedValueOnce({success: true})

      const stepsConfig: BuildStepsConfig = {
        steps: [
          {
            id: 'step1',
            displayName: 'Step 1',
            type: 'copy_files',
            config: {},
          },
          {
            id: 'step2',
            displayName: 'Step 2',
            type: 'copy_files',
            config: {},
            continueOnError: true,
          },
          {
            id: 'step3',
            displayName: 'Step 3',
            type: 'copy_files',
            config: {},
          },
        ],
      }

      // When
      await executeBuildSteps(mockExtension, stepsConfig, mockOptions)

      // Then
      expect(stepsIndex.executeStepByType).toHaveBeenCalledTimes(3)
      expect(mockStderr.write).toHaveBeenCalledWith(expect.stringContaining('Step 2 error'))
    })
  })

  describe('logging', () => {
    test('logs step execution', async () => {
      // Given
      vi.mocked(stepsIndex.executeStepByType).mockResolvedValue({success: true})

      const stepsConfig: BuildStepsConfig = {
        steps: [
          {
            id: 'test-step',
            displayName: 'Test Step',
            type: 'copy_files',
            config: {},
          },
        ],
      }

      // When
      await executeBuildSteps(mockExtension, stepsConfig, mockOptions)

      // Then
      expect(mockStdout.write).toHaveBeenCalledWith('Executing step: Test Step\n')
    })

    test('logs warnings for failed steps with continueOnError', async () => {
      // Given
      vi.mocked(stepsIndex.executeStepByType).mockRejectedValue(new Error('Test error'))

      const stepsConfig: BuildStepsConfig = {
        steps: [
          {
            id: 'test-step',
            displayName: 'Test Step',
            type: 'copy_files',
            config: {},
            continueOnError: true,
          },
        ],
      }

      // When
      await executeBuildSteps(mockExtension, stepsConfig, mockOptions)

      // Then
      expect(mockStderr.write).toHaveBeenCalledWith('Warning: Step "Test Step" failed but continuing: Test error\n')
    })
  })
})

describe('resolveConfigurableValue', () => {
  let mockContext: BuildContext

  beforeEach(() => {
    mockContext = {
      extension: {
        configuration: {
          static_root: 'public',
          nested: {
            field: 'nested-value',
          },
        },
        directory: '/test/dir',
      },
      options: {
        stdout: {write: vi.fn()},
        stderr: {write: vi.fn()},
        app: {} as any,
        environment: 'production',
      },
      stepResults: new Map(),
    } as unknown as BuildContext
  })

  test('returns literal value as-is', () => {
    const result = resolveConfigurableValue('literal-value', mockContext)
    expect(result).toBe('literal-value')
  })

  test('returns literal number as-is', () => {
    const result = resolveConfigurableValue(42, mockContext)
    expect(result).toBe(42)
  })

  test('returns literal boolean as-is', () => {
    const result = resolveConfigurableValue(true, mockContext)
    expect(result).toBe(true)
  })

  test('returns literal array as-is', () => {
    const arr = ['a', 'b', 'c']
    const result = resolveConfigurableValue(arr, mockContext)
    expect(result).toBe(arr)
  })

  test('resolves configPath reference', () => {
    const result = resolveConfigurableValue({configPath: 'static_root'}, mockContext)
    expect(result).toBe('public')
  })

  test('resolves nested configPath reference', () => {
    const result = resolveConfigurableValue({configPath: 'nested.field'}, mockContext)
    expect(result).toBe('nested-value')
  })

  test('returns undefined for missing configPath', () => {
    const result = resolveConfigurableValue({configPath: 'nonexistent'}, mockContext)
    expect(result).toBeUndefined()
  })

  test('returns undefined for deeply nested missing configPath', () => {
    const result = resolveConfigurableValue({configPath: 'nested.missing.field'}, mockContext)
    expect(result).toBeUndefined()
  })

  test('resolves envVar reference', () => {
    process.env.TEST_VAR = 'test-value'
    const result = resolveConfigurableValue({envVar: 'TEST_VAR'}, mockContext)
    expect(result).toBe('test-value')
    delete process.env.TEST_VAR
  })

  test('returns undefined for missing envVar', () => {
    const result = resolveConfigurableValue({envVar: 'NONEXISTENT_VAR'}, mockContext)
    expect(result).toBeUndefined()
  })

  test('returns undefined when value is undefined', () => {
    const result = resolveConfigurableValue(undefined, mockContext)
    expect(result).toBeUndefined()
  })

  test('returns undefined when value is null', () => {
    const result = resolveConfigurableValue(null as any, mockContext)
    expect(result).toBeUndefined()
  })

  test('plucks a field from a TOML array of tables', () => {
    const context = {
      ...mockContext,
      extension: {
        ...mockContext.extension,
        configuration: {
          targeting: [{tools: 'my-tools1.js'}, {tools: 'my-tools2.js'}],
        },
      },
    } as unknown as BuildContext

    const result = resolveConfigurableValue({configPath: 'targeting.tools'}, context)
    expect(result).toEqual(['my-tools1.js', 'my-tools2.js'])
  })

  test('plucks a field from a deeply nested TOML array of tables', () => {
    const context = {
      ...mockContext,
      extension: {
        ...mockContext.extension,
        configuration: {
          extensions: {
            targeting: {
              intents: [{schema: './email-schema.json'}, {schema: './sms-schema.json'}],
            },
          },
        },
      },
    } as unknown as BuildContext

    const result = resolveConfigurableValue({configPath: 'extensions.targeting.intents.schema'}, context)
    expect(result).toEqual(['./email-schema.json', './sms-schema.json'])
  })

  test('returns undefined when array of tables has no matching field', () => {
    const context = {
      ...mockContext,
      extension: {
        ...mockContext.extension,
        configuration: {
          targeting: [{tools: 'my-tools1.js'}, {tools: 'my-tools2.js'}],
        },
      },
    } as unknown as BuildContext

    const result = resolveConfigurableValue({configPath: 'targeting.nonexistent'}, context)
    expect(result).toBeUndefined()
  })
})
