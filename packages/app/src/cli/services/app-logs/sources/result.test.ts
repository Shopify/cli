import {renderAppLogSourcesResult} from './result.js'
import {sources} from '../sources.js'
import {testApp, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {outputResult, formatSection} from '@shopify/cli-kit/node/output'
import {describe, test, vi, expect} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')

describe('sources', () => {
  test('prints sources by namespace', async () => {
    // Given
    vi.mocked(formatSection).mockReturnValue('formatted section')

    // When
    const extension = await testFunctionExtension()
    const result = sources(testApp({allExtensions: [extension]}))[0]!
    renderAppLogSourcesResult(
      [
        {...result, source: 'extensions.source1'},
        {...result, source: 'extensions.source2'},
      ],
      'text',
    )

    // Then
    expect(formatSection).toHaveBeenCalledWith('extensions', 'extensions.source1\nextensions.source2')
    expect(outputResult).toHaveBeenCalledWith('formatted section')
  })
})
