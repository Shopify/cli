import {useExtensionsCLISources} from './environment.js'
import {describe, expect, test} from 'vitest'

describe('useExtensionsCLISources', () => {
  test('return true when the SHOPIFY_USE_EXTENSIONS_CLI_SOURCES is truthy', () => {
    // Given
    const environment = {SHOPIFY_USE_EXTENSIONS_CLI_SOURCES: '1'}

    // When
    const got = useExtensionsCLISources(environment)

    // Then
    expect(got).toEqual(true)
  })
})
