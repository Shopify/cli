import {nameFixturePrompt} from './name-fixture.js'
import {describe, expect, test, vi} from 'vitest'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

const mockRenderTextPrompt = vi.mocked(renderTextPrompt)

describe('nameFixturePrompt', () => {
  test('returns user input when valid', async () => {
    const identifier = 'abcdef'
    const userInput = 'my-test-fixture'

    mockRenderTextPrompt.mockResolvedValue(userInput)

    const result = await nameFixturePrompt(identifier)

    expect(mockRenderTextPrompt).toHaveBeenCalledWith({
      message: 'What would you like to name this test fixture?',
      defaultValue: 'abcdef',
      validate: expect.any(Function),
    })
    expect(result).toBe(userInput)
  })

  test('prompts for fixture name with default value', async () => {
    const identifier = 'abcdef'

    mockRenderTextPrompt.mockResolvedValue('test-fixture')

    await nameFixturePrompt(identifier)

    expect(mockRenderTextPrompt).toHaveBeenCalledWith({
      message: 'What would you like to name this test fixture?',
      defaultValue: 'abcdef',
      validate: expect.any(Function),
    })
  })

  test('trims whitespace from user input', async () => {
    const identifier = 'abcdef'
    const userInput = '  my-test-fixture  '

    mockRenderTextPrompt.mockResolvedValue(userInput)

    const result = await nameFixturePrompt(identifier)

    expect(result).toBe('my-test-fixture')
  })

  describe('validation', () => {
    test('rejects empty input', async () => {
      const identifier = 'abcdef'

      mockRenderTextPrompt.mockResolvedValue('test-fixture')

      await nameFixturePrompt(identifier)

      const validateFn = mockRenderTextPrompt.mock.calls[0]![0].validate!

      expect(validateFn('')).toBe("Test fixture name can't be empty")
      expect(validateFn('   ')).toBe("Test fixture name can't be empty")
    })

    test('rejects invalid characters', async () => {
      const identifier = 'abcdef'

      mockRenderTextPrompt.mockResolvedValue('test-fixture')

      await nameFixturePrompt(identifier)

      const validateFn = mockRenderTextPrompt.mock.calls[0]![0].validate!

      expect(validateFn('test@fixture')).toBe(
        'Test fixture name can only contain letters, numbers, underscores, and hyphens',
      )
      expect(validateFn('test fixture')).toBe(
        'Test fixture name can only contain letters, numbers, underscores, and hyphens',
      )
      expect(validateFn('test.fixture')).toBe(
        'Test fixture name can only contain letters, numbers, underscores, and hyphens',
      )
      expect(validateFn('test/fixture')).toBe(
        'Test fixture name can only contain letters, numbers, underscores, and hyphens',
      )
      expect(validateFn('test\\fixture')).toBe(
        'Test fixture name can only contain letters, numbers, underscores, and hyphens',
      )
    })

    test('accepts valid characters', async () => {
      const identifier = 'abcdef'

      mockRenderTextPrompt.mockResolvedValue('test-fixture')

      await nameFixturePrompt(identifier)

      const validateFn = mockRenderTextPrompt.mock.calls[0]![0].validate!

      expect(validateFn('test-fixture')).toBeUndefined()
      expect(validateFn('test_fixture')).toBeUndefined()
      expect(validateFn('testFixture')).toBeUndefined()
      expect(validateFn('test123')).toBeUndefined()
      expect(validateFn('123test')).toBeUndefined()
      expect(validateFn('test-123_fixture')).toBeUndefined()
    })
  })
})
