import {sourcesForApp} from './utils.js'
import {sources} from './sources.js'
import {testApp} from '../../models/app/app.test-data.js'
import {outputResult, formatSection} from '@shopify/cli-kit/node/output'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('./utils.js')

describe('sources', () => {
  test('prints sources by namespace', async () => {
    // Given
    vi.mocked(sourcesForApp).mockReturnValue(['extensions.source1', 'extensions.source2', 'arbitrary.text'])
    vi.mocked(formatSection).mockReturnValue('formatted section')

    // When
    sources(testApp())

    // Then
    expect(formatSection).toHaveBeenCalledWith('extensions', 'extensions.source1\nextensions.source2')
    expect(formatSection).toHaveBeenCalledWith('arbitrary', 'arbitrary.text')
    expect(outputResult).toHaveBeenCalledWith('formatted section')
  })
})
