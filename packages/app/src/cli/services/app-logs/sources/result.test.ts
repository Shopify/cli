import {renderAppLogSourcesResult} from './result.js'
import {outputResult, formatSection} from '@shopify/cli-kit/node/output'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')

describe('sources', () => {
  test('prints sources by namespace', async () => {
    // Given
    vi.mocked(formatSection).mockReturnValue('formatted section')

    // When
    renderAppLogSourcesResult(['extensions.source1', 'extensions.source2', 'arbitrary.text'], 'text')

    // Then
    expect(formatSection).toHaveBeenCalledWith('extensions', 'extensions.source1\nextensions.source2')
    expect(formatSection).toHaveBeenCalledWith('arbitrary', 'arbitrary.text')
    expect(outputResult).toHaveBeenCalledWith('formatted section')
  })
})
