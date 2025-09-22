import {handlePolarisUnifiedChoice} from './generate.js'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {isPolarisUnifiedEnabled} from '@shopify/cli-kit/node/is-polaris-unified-enabled'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {isCI} from '@shopify/cli-kit/node/system'
import {describe, expect, vi, test, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/is-polaris-unified-enabled')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/system')

describe('handlePolarisUnifiedChoice', () => {
  beforeEach(() => {
    vi.mocked(isCI).mockReturnValue(false)
  })

  test('returns true when POLARIS_UNIFIED env var is set to true', async () => {
    // Given
    vi.mocked(isPolarisUnifiedEnabled).mockReturnValue(true)

    // When
    const result = await handlePolarisUnifiedChoice()

    // Then
    expect(result).toBe(true)
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })

  test('returns false when running in unit tests', async () => {
    // Given
    vi.mocked(isPolarisUnifiedEnabled).mockReturnValue(false)
    vi.mocked(isUnitTest).mockReturnValue(true)

    // When
    const result = await handlePolarisUnifiedChoice()

    // Then
    expect(result).toBe(false)
    expect(renderSelectPrompt).not.toHaveBeenCalled()
  })

  test('shows interactive prompt when not in unit tests and no env var', async () => {
    // Given
    vi.mocked(isPolarisUnifiedEnabled).mockReturnValue(false)
    vi.mocked(isUnitTest).mockReturnValue(false)
    vi.mocked(renderSelectPrompt).mockResolvedValue(true)

    // When
    const result = await handlePolarisUnifiedChoice()

    // Then
    expect(result).toBe(true)
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Which template type would you like?',
      choices: [
        {label: 'Polaris Unified (Recommended)', value: true},
        {label: 'Standard (React)', value: false},
      ],
      defaultValue: true,
    })
  })

  test('returns false when user selects Standard React', async () => {
    // Given
    vi.mocked(isPolarisUnifiedEnabled).mockReturnValue(false)
    vi.mocked(isUnitTest).mockReturnValue(false)
    vi.mocked(renderSelectPrompt).mockResolvedValue(false)

    // When
    const result = await handlePolarisUnifiedChoice()

    // Then
    expect(result).toBe(false)
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Which template type would you like?',
      choices: [
        {label: 'Polaris Unified (Recommended)', value: true},
        {label: 'Standard (React)', value: false},
      ],
      defaultValue: true,
    })
  })
})
